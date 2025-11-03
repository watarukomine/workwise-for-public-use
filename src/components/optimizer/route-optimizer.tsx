
'use client';
import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';

import type { Customer, Staff, StaffStatus, WithId } from '@/lib/types';
import { optimizeRoute, OptimizeRouteInput, OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Loader2, MapPinned, Route as RouteIcon, PlusCircle, X, MapPin as MapPinIcon, User as UserIcon } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn, findKey } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';

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
};

interface RouteOptimizerProps {
  onRouteOptimized: (data: OptimizeRouteOutput | null, options: { avoidHighways: boolean }) => void;
  staff: WithId<Staff>[];
  staffStatus: StaffStatus[];
  customers: WithId<Customer>[];
}

async function formAction(_prevState: State, formData: FormData): Promise<State> {
  const startLocationString = formData.get('startLocation') as string;
  const endLocationString = formData.get('endLocation') as string;
  const waypointStrings = formData.getAll('waypoints') as string[];
  const optimizeFor = formData.get('optimizeFor') as OptimizeRouteInput['optimizeFor'];
  const avoidHighways = formData.get('avoidHighways') === 'on';

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
  const waypoints = waypointStrings.map(parseLocation).filter((loc): loc is Location => !!loc);
  
  if (!startLocation || !endLocation) {
    return { data: null, error: '出発地と目的地を選択または入力してください。', options: { avoidHighways } };
  }
  
  if (!startLocation.latitude || !startLocation.longitude || !endLocation.latitude || !endLocation.longitude) {
      return { data: null, error: '出発地または目的地の座標が取得できませんでした。', options: { avoidHighways } };
  }

  try {
    const result = await optimizeRoute({
      startLocation,
      endLocation,
      waypoints,
      optimizeFor: optimizeFor,
      avoidHighways: avoidHighways,
    });
    return { data: result, error: null, options: { avoidHighways } };
  } catch (e) {
    console.error(e);
    return { data: null, error: 'ルートの最適化に失敗しました。もう一度お試しください。', options: { avoidHighways } };
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
}> = ({ predefinedLocations, onSelect, placeholder, value }) => {
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
  
  const handlePredefinedSelect = (location: Location) => {
      setValue(location.name, false);
      onSelect(location);
      setOpen(false);
  }

  const staffLocations = predefinedLocations.filter(loc => loc.type === 'staff');
  const customerLocations = predefinedLocations.filter(loc => loc.type === 'customer');

  const filteredStaff = inputValue
    ? staffLocations.filter(loc => loc.name.toLowerCase().includes(inputValue.toLowerCase()))
    : staffLocations;

  const filteredCustomers = inputValue
    ? customerLocations.filter(
        (loc) =>
          loc.name.toLowerCase().includes(inputValue.toLowerCase()) ||
          loc.address.toLowerCase().includes(inputValue.toLowerCase())
      )
    : customerLocations;
  
  const displayName = value ? value.name : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
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
            
            {filteredStaff.length > 0 && (
                <CommandGroup heading="スタッフ">
                  {filteredStaff.map((location) => (
                    <CommandItem
                      key={location.id}
                      value={`${location.name}`}
                      onSelect={() => handlePredefinedSelect(location)}
                      className="flex items-center"
                    >
                      <UserIcon className="mr-2 h-4 w-4" />
                       <p className="truncate">{location.name}</p>
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


export function RouteOptimizer({ onRouteOptimized, staff, staffStatus, customers }: RouteOptimizerProps) {
  
  const [startLocation, setStartLocation] = React.useState<Location | null>(null);
  const [endLocation, setEndLocation] = React.useState<Location | null>(null);
  const [waypoints, setWaypoints] = React.useState<(Location | null)[]>([]);
  const [state, formActionWithState] = useActionState(formAction, { data: null, error: null, options: { avoidHighways: false } });

  React.useEffect(() => {
    onRouteOptimized(state.data, state.options);
  }, [state.data, state.options, onRouteOptimized]);

  const predefinedLocations = React.useMemo(() => {
    const staffWithLocation = staff.map(s => {
        const status = staffStatus.find(ss => ss.staffId === s.id);
        return status && status.latitude && status.longitude ? { ...s, ...status } : null;
    }).filter((s): s is (Staff & StaffStatus) => s !== null);

    const staffLocs: Location[] = staffWithLocation.map(s => ({
        id: s.id,
        name: `${s.name}（現在地）`,
        address: ``,
        latitude: s.latitude!,
        longitude: s.longitude!,
        type: 'staff',
    }));
    
    const customerLocs = customers.reduce((acc: Location[], c) => {
      const latVal = findKey(c, ['緯度']);
      const lonVal = findKey(c, ['経度']);
      const coordsVal = findKey(c, ['緯度・経度', '座標', '緯度経度']);

      let latitude: number | undefined;
      let longitude: number | undefined;

      if (latVal !== undefined && lonVal !== undefined && !isNaN(Number(latVal)) && !isNaN(Number(lonVal))) {
        latitude = Number(latVal);
        longitude = Number(lonVal);
      } else if (typeof coordsVal === 'string' && coordsVal.includes(',')) {
        const parts = coordsVal.split(',').map(part => parseFloat(part.trim()));
        if (!isNaN(parts[0]) && !isNaN(parts[1])) {
          latitude = parts[0];
          longitude = parts[1];
        }
      }

      if (latitude !== undefined && longitude !== undefined) {
        acc.push({
          id: String(findKey(c, ['ユーザーコード'])),
          name: String(findKey(c, ['店舗', 'storeName']) || '名称未設定'),
          address: String(findKey(c, ['住所', 'address']) || '住所未設定'),
          latitude: latitude,
          longitude: longitude,
          type: 'customer' as const,
        });
      }
      return acc;
    }, []);

    return [...staffLocs, ...customerLocs];
  }, [staff, staffStatus, customers]);
  
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
  
  const isLoading = !customers || !staff || !staffStatus;

  if (isLoading) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>ルート詳細</CardTitle>
                <CardDescription>出発地、目的地、経由地、最適化の基準を選択してください。</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </CardContent>
        </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>ルート詳細</CardTitle>
          <CardDescription>出発地、目的地、経由地、最適化の基準を選択してください。</CardDescription>
        </CardHeader>
        <form action={formActionWithState}>
          <CardContent className="space-y-6">
             <input type="hidden" name="startLocation" value={startLocation ? JSON.stringify(startLocation) : ''} />
             <input type="hidden" name="endLocation" value={endLocation ? JSON.stringify(endLocation) : ''} />
             {waypoints.filter(loc => loc).map((loc, index) => <input key={index} type="hidden" name="waypoints" value={JSON.stringify(loc)} />)}

            <div className="space-y-2">
                <Label>出発地</Label>
                <PlacesAutocompleteSelector
                  predefinedLocations={predefinedLocations}
                  value={startLocation}
                  onSelect={setStartLocation}
                  placeholder="出発地を選択または検索..."
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
            <CardHeader>
                <CardTitle>最適化されたルート</CardTitle>
                <CardDescription>選択に基づいた最も効率的な経路です。</CardDescription>
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
                    {state.data.optimizedRoute.map((location, index) => (
                        <li key={location.id} className="ml-6">
                        <span className="absolute -left-[10.5px] top-1 flex items-center justify-center w-5 h-5 bg-primary rounded-full text-primary-foreground text-xs font-bold">
                            {index + 1}
                        </span>
                        <div className="pl-2">
                            <h4 className="font-medium">{location.name}</h4>
                            <p className="text-sm text-muted-foreground">{location.address}</p>
                        </div>
                        </li>
                    ))}
                    </ol>
                </div>
            </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}

    