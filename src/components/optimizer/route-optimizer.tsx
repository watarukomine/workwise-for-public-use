
'use client';
import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';

import type { Customer, Order, Staff, StaffStatus, WithId } from '@/lib/types';
import { optimizeRoute, OptimizeRouteInput, OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Loader2, MapPinned, Route as RouteIcon, PlusCircle, X, MapPin as MapPinIcon, User as UserIcon, ExternalLink, Flag, Navigation, Building2 } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn, findKey } from '@/lib/utils';
import { STORE_LOCATIONS, STORE_ORDER } from '@/lib/constants';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type State = {
  data: OptimizeRouteOutput | null;
  error: string | null;
  options: {
    avoidHighways: boolean;
  };
};

export type Location = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'customer' | 'staff' | 'custom';
  orderId?: string; // Optional link to a specific order
};

interface RouteOptimizerProps {
  onRouteOptimized: (data: OptimizeRouteOutput | null, options: { avoidHighways: boolean }) => void;
  staff: WithId<Staff>[];
  staffStatus: StaffStatus[];
  allCustomers: WithId<Customer>[];
  orders?: WithId<Order>[]; // Added to link locations to actual orders
  placesLibraryReady: boolean;
}

async function formAction(_prevState: State, formData: FormData): Promise<State> {
  const startLocationString = formData.get('startLocation') as string;
  const endLocationString = formData.get('endLocation') as string;
  const waypointStrings = formData.getAll('waypoints') as string[];
  const optimizeFor = formData.get('optimizeFor') as OptimizeRouteInput['optimizeFor'];
  const avoidsHighways = formData.get('avoidHighways') === 'on';

  const parseLocation = (locString: string | null): Location | null => {
    if (!locString) return null;
    try {
      return JSON.parse(locString);
    } catch {
      return null;
    }
  }

  const startLocation = parseLocation(startLocationString);
  const endLocation = parseLocation(endLocationString);
  const waypoints = waypointStrings.map(parseLocation).filter((loc: Location | null): loc is Location => !!loc);

  if (!startLocation || !endLocation) {
    return { data: null, error: '出発地と目的地を選択または入力してください。', options: { avoidHighways: avoidsHighways } };
  }

  if (!startLocation.latitude || !startLocation.longitude || !endLocation.latitude || !endLocation.longitude) {
    return { data: null, error: '出発地または目的地の座標が取得できませんでした。', options: { avoidHighways: avoidsHighways } };
  }

  try {
    const result = await optimizeRoute({
      startLocation,
      endLocation,
      waypoints,
      optimizeFor: optimizeFor,
      avoidHighways: avoidsHighways,
    });
    return { data: result, error: null, options: { avoidHighways: avoidsHighways } };
  } catch (e) {
    console.error(e);
    return { data: null, error: 'ルートの最適化に失敗しました。もう一度お試しください。', options: { avoidHighways: avoidsHighways } };
  }
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button id="optimizer-submit-button" type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RouteIcon className="mr-2 h-4 w-4" />}
      ルートを最適化
    </Button>
  );
}

const PlacesAutocompleteSelector: React.FC<{
  predefinedLocations: Location[];
  onSelect: (location: Location | null) => void;
  placeholder: string;
  value: Location | null;
  placesLibraryReady: boolean;
}> = ({ predefinedLocations, onSelect, placeholder, value, placesLibraryReady }) => {
  const {
    ready,
    value: inputValue,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: 'jp' },
    },
    debounce: 300,
  });

  const [open, setOpen] = React.useState(false);
  const [isLocating, setIsLocating] = React.useState(false);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("このブラウザは位置情報をサポートしていません。");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onSelect({
          id: 'current-location',
          name: '現在地',
          address: '現在地',
          latitude,
          longitude,
          type: 'custom',
        });
        setValue('現在地', false);
        setOpen(false);
        setIsLocating(false);
      },
      (error) => {
        console.error("Error getting location", error);
        alert("位置情報の取得に失敗しました。");
        setIsLocating(false);
      }
    );
  };

  const handleSelect = async (address: string) => {
    setValue(address, false);
    clearSuggestions();
    try {
      const results = await getGeocode({ address });
      const { lat, lng } = await getLatLng(results[0]);
      onSelect({
        id: results[0].place_id,
        name: address.split(',')[0],
        address: results[0].formatted_address,
        latitude: lat,
        longitude: lng,
        type: 'custom',
      });
      setOpen(false);
    } catch (error) {
      console.log('Error: ', error);
    }
  };

  const handlePredefinedSelect = async (location: Location) => {
    setValue(location.name, false);
    setOpen(false);

    if (!location.latitude || !location.longitude || isNaN(location.latitude) || isNaN(location.longitude)) {
      try {
        const results = await getGeocode({ address: location.address });
        const { lat, lng } = await getLatLng(results[0]);
        onSelect({
          ...location,
          latitude: lat,
          longitude: lng,
        });
      } catch (error) {
        console.error('Failed to geocode address for predefined location:', error);
        alert(`店舗「${location.name}」の住所「${location.address}」から座標を取得できませんでした。`);
        onSelect(null);
      }
    } else {
      onSelect(location);
    }
  };

  const storeLocations = predefinedLocations.filter(loc => loc.type === 'custom' && loc.id.startsWith('store-'));
  const staffLocations = predefinedLocations.filter(loc => loc.type === 'staff');
  const customerLocations = predefinedLocations.filter(loc => loc.type === 'customer');

  const filterLocations = (locations: Location[], input: string) => {
    if (!input) return locations;
    return locations.filter(loc =>
      loc.name.toLowerCase().includes(input.toLowerCase()) ||
      loc.address.toLowerCase().includes(input.toLowerCase())
    );
  }

  const filteredStores = filterLocations(storeLocations, inputValue);
  const filteredStaff = filterLocations(staffLocations, inputValue);
  const filteredCustomers = filterLocations(customerLocations, inputValue);

  const displayName = value ? value.name : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal" disabled={!placesLibraryReady}>
          <span className="truncate">{displayName}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="地名や住所を検索..."
            disabled={!ready}
            value={inputValue}
            onValueChange={setValue}
          />
          <CommandList>
            <CommandEmpty>該当する場所が見つかりません。</CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="current-location"
                onSelect={handleUseCurrentLocation}
                className="flex items-center text-blue-600 font-medium cursor-pointer"
              >
                {isLocating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="mr-2 h-4 w-4 fill-current" />
                )}
                現在地を使用
              </CommandItem>
            </CommandGroup>

            {filteredStores.length > 0 && (
              <CommandGroup heading="自社店舗・拠点">
                {filteredStores.map((location) => (
                  <CommandItem
                    key={location.id}
                    value={`${location.name} ${location.address}`}
                    onSelect={() => handlePredefinedSelect(location)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center truncate mr-2">
                      <Building2 className="mr-2 h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
                      <span className="truncate font-medium">{location.name}</span>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground truncate max-w-[140px]">
                      {location.address}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredStaff.length > 0 && (
              <CommandGroup heading="出勤スタッフ">
                {filteredStaff.map((location) => (
                  <CommandItem
                    key={location.id}
                    value={`${location.name} ${(location as any).mainStore || ''}`}
                    onSelect={() => handlePredefinedSelect(location)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center truncate mr-2">
                      <UserIcon className="mr-2 h-4 w-4 shrink-0 text-blue-500" style={{ color: (location as any).color }} />
                      <span className="truncate">{location.name}</span>
                    </div>
                    {(location as any).mainStore && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-medium">
                        {(location as any).mainStore}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredCustomers.length > 0 && (
              <CommandGroup heading="販売店">
                {filteredCustomers.map((location) => (
                  <CommandItem
                    key={location.id}
                    value={`${location.name} ${location.address}`}
                    onSelect={() => handlePredefinedSelect(location)}
                    className="flex items-center"
                  >
                    <MapPinIcon className="mr-2 h-4 w-4" />
                    <p className="truncate">{location.name}</p>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {status === 'OK' && (
              <CommandGroup heading="Googleマップの検索結果">
                {data.map(({ place_id, description }) => (
                  <CommandItem key={place_id} value={description} onSelect={() => handleSelect(description)}>
                    <MapPinIcon className="mr-2 h-4 w-4" />
                    {description}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};


export function RouteOptimizer({ onRouteOptimized, staff, staffStatus, allCustomers, orders = [], placesLibraryReady }: RouteOptimizerProps) {

  const [startLocation, setStartLocation] = React.useState<Location | null>(null);
  const [endLocation, setEndLocation] = React.useState<Location | null>(null);
  const [waypoints, setWaypoints] = React.useState<(Location | null)[]>([]);
  const [state, formActionWithState] = useActionState(formAction, { data: null, error: null, options: { avoidHighways: false } });

  React.useEffect(() => {
    onRouteOptimized(state.data, state.options);
  }, [state.data, state.options, onRouteOptimized]);

  const predefinedLocations = React.useMemo(() => {
    const storeLocs: Location[] = Object.values(STORE_LOCATIONS).map(store => ({
      id: `store-${store.name}`,
      name: store.name,
      address: store.address,
      latitude: store.latitude,
      longitude: store.longitude,
      type: 'custom' as const,
    }));

    const staffLocs: Location[] = (staff || [])
      .slice()
      .sort((a, b) => {
        const storeA = String((a as any)['母店'] || (a as any).mainStore || (a as any).storeName || '').trim();
        const storeB = String((b as any)['母店'] || (b as any).mainStore || (b as any).storeName || '').trim();
        const orderA = STORE_ORDER[storeA] || 99;
        const orderB = STORE_ORDER[storeB] || 99;
        return orderA - orderB;
      })
      .map(s => ({
        id: s.id,
        name: s.name || (s as any)['氏名'] || (s as any)['名前'] || (s as any)['担当'] || '名前未設定',
        address: (s as any).lastAction || (s as any).currentStatus || '現在地',
        latitude: Number((s as any)['緯度'] ?? (s as any).latitude ?? (s as any).lat ?? 0),
        longitude: Number((s as any)['経度'] ?? (s as any).longitude ?? (s as any).lng ?? 0),
        type: 'staff' as const,
        mainStore: (s as any)['母店'] || (s as any).mainStore || (s as any).storeName || '',
      }));

    const customerLocs = (allCustomers || []).map(c => {
      let latitude = Number(findKey(c, ['緯度', 'latitude', 'lat']));
      let longitude = Number(findKey(c, ['経度', 'longitude', 'lng']));

      if (isNaN(latitude) || isNaN(longitude) || !latitude || !longitude) {
        const coordsValue = findKey(c, ['緯度・経度', '座標', '緯度経度', '緯度,経度']);
        if (typeof coordsValue === 'string' && coordsValue.includes(',')) {
          const parts = coordsValue.split(',').map(part => part.trim());
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lon)) {
            latitude = lat;
            longitude = lon;
          } else {
            latitude = 0;
            longitude = 0;
          }
        } else {
          latitude = 0;
          longitude = 0;
        }
      }

      // Safe ID generation: prefer userCode, then id, then random fallback
      const safeId = c.userCode || c.id || `customer-${Math.random().toString(36).substr(2, 9)}`;

      // Check if this customer has an order today/selected date
      const linkedOrder = orders.find(o => o.customerCode === c.userCode);

      return {
        id: String(safeId),
        name: String(findKey(c, ['店舗', 'storeName']) || c.name || '名称未設定'),
        address: String(findKey(c, ['住所', 'address']) || '住所未設定'),
        latitude: latitude,
        longitude: longitude,
        type: 'customer' as const,
        orderId: linkedOrder?.id,
      };
    });

    return [...storeLocs, ...staffLocs, ...customerLocs];
  }, [staff, staffStatus, allCustomers]);

  const addWaypoint = () => {
    setWaypoints(prev => [...prev, null]);
  };

  const updateWaypoint = (index: number, location: Location | null) => {
    setWaypoints(prev => {
      const newWaypoints = [...prev];
      newWaypoints[index] = location;
      return newWaypoints;
    });
  };

  const removeWaypoint = (index: number) => {
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  };

  const handleOpenGoogleMaps = () => {
    if (!state.data || !state.data.optimizedRoute || state.data.optimizedRoute.length < 2) return;

    const route = state.data.optimizedRoute;
    const origin = `${route[0].latitude},${route[0].longitude}`;
    const destination = `${route[route.length - 1].latitude},${route[route.length - 1].longitude}`;
    const waypoints = route.slice(1, -1).map(loc => `${loc.latitude},${loc.longitude}`).join('|');

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;

    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>ルート詳細</CardTitle>
          <CardDescription>出発地、目的地、経由地、最適化の基準を選択してください。</CardDescription>
        </CardHeader>
        <form
          action={formActionWithState}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
        >
          <CardContent className="space-y-6">
            <input type="hidden" name="startLocation" value={startLocation ? JSON.stringify(startLocation) : ''} />
            <input type="hidden" name="endLocation" value={endLocation ? JSON.stringify(endLocation) : ''} />
            {waypoints.filter(loc => loc).map((loc: Location | null, index: number) => <input key={index} type="hidden" name="waypoints" value={JSON.stringify(loc)} />)}

            <div className="space-y-2">
              <Label>出発地</Label>
              <PlacesAutocompleteSelector
                predefinedLocations={predefinedLocations}
                value={startLocation}
                onSelect={setStartLocation}
                placeholder="出発地を選択または検索..."
                placesLibraryReady={placesLibraryReady}
              />
            </div>

            <div className="space-y-2">
              <Label>経由地</Label>
              <div className="space-y-2">
                {waypoints.map((waypoint, index) => {
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-grow">
                        <PlacesAutocompleteSelector
                          predefinedLocations={predefinedLocations}
                          value={waypoint}
                          onSelect={(loc) => updateWaypoint(index, loc)}
                          placeholder="経由地を選択または検索..."
                          placesLibraryReady={placesLibraryReady}
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeWaypoint(index)} aria-label="経由地を削除">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addWaypoint} className="mt-2">
                <PlusCircle className="mr-2 h-4 w-4" />
                経由地を追加
              </Button>
            </div>

            <div className="space-y-2">
              <Label>目的地</Label>
              <PlacesAutocompleteSelector
                predefinedLocations={predefinedLocations}
                value={endLocation}
                onSelect={setEndLocation}
                placeholder="目的地を選択または検索..."
                placesLibraryReady={placesLibraryReady}
              />
            </div>

            <div className="space-y-2">
              <Label>最適化の基準</Label>
              <RadioGroup name="optimizeFor" defaultValue="time" className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="time" id="time" />
                  <Label htmlFor="time">移動時間</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="distance" id="distance" />
                  <Label htmlFor="distance">距離</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="avoid-highways" name="avoidHighways" />
                <Label htmlFor="avoid-highways" className="font-normal">高速道路を使用しない</Label>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>

      <div id="optimizer-results">
        {state.error && (
          <Alert variant="destructive">
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {!state.data && !state.error && (
          <Card className="h-full">
            <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground h-48 pt-6">
              <MapPinned className="h-12 w-12 mb-4" />
              <p>最適化されたルートがここに表示されます。</p>
            </CardContent>
          </Card>
        )}

        {state.data && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>最適化されたルート</CardTitle>
                <CardDescription>選択に基づいた最も効率的な経路です。</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleOpenGoogleMaps}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Googleマップで開く
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                  {state.data.estimatedTravelTime && (
                    <div className="flex flex-col p-3 bg-muted rounded-md">
                      <span className="text-muted-foreground text-xs">推定時間</span>
                      <span className="font-semibold text-lg">{state.data.estimatedTravelTime}</span>
                    </div>
                  )}
                  {state.data.estimatedTravelDistance && (
                    <div className="flex flex-col p-3 bg-muted rounded-md">
                      <span className="text-muted-foreground text-xs">推定距離</span>
                      <span className="font-semibold text-lg">{state.data.estimatedTravelDistance}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">巡回順</h3>
                <ol className="relative border-l border-border space-y-4">
                  {state.data.optimizedRoute.map((location: any, index: number) => {
                    return (
                      <li key={location.id} className="ml-6">
                        <span className={cn(
                          "absolute -left-[10.5px] top-1 flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold",
                          index === 0 ? "bg-green-600 text-white" :
                            index === state.data!.optimizedRoute.length - 1 ? "bg-red-600 text-white" :
                              "bg-primary text-primary-foreground"
                        )}>
                          {index === 0 ? "S" : index === state.data!.optimizedRoute.length - 1 ? "G" : index + 1}
                        </span>
                        <div className="pl-2">
                          <h4 className="font-medium">{location.name}</h4>
                          <p className="text-sm text-muted-foreground">{location.address}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
