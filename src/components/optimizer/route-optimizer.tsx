'use client';
import * as React from 'react';

import type { Customer, Order, Staff, StaffStatus, WithId } from '@/lib/types';
import { optimizeRoute, OptimizeRouteInput, OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Loader2, MapPinned, Route as RouteIcon, PlusCircle, X, MapPin as MapPinIcon, User as UserIcon, ExternalLink, Flag, Navigation, Building2 } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { STORE_LOCATIONS, STORE_ORDER } from '@/lib/constants';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

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

/**
 * Fallback Haversine distance solver for ultra-fast instant response (<5ms)
 */
function calculateDistanceFallback(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function solveInstantFallback(start: Location, end: Location, waypoints: Location[], avoidHighways: boolean): OptimizeRouteOutput {
  const remaining = [...waypoints];
  const route: Location[] = [start];
  let current = start;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = calculateDistanceFallback(current.latitude, current.longitude, remaining[i].latitude, remaining[i].longitude);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }
    current = remaining.splice(nearestIdx, 1)[0];
    route.push(current);
  }
  route.push(end);

  let totalDistanceKm = 0;
  const resultRoute = route.map((loc, i) => {
    if (i === 0) return { ...loc, travelTimeFromPrevious: 0 };
    const d = calculateDistanceFallback(route[i - 1].latitude, route[i - 1].longitude, loc.latitude, loc.longitude);
    const estLegKm = d * 1.25;
    totalDistanceKm += estLegKm;
    const speed = avoidHighways ? 30 : (estLegKm > 25 ? 60 : 40);
    const legMins = Math.round((estLegKm / speed) * 60);
    return {
      ...loc,
      travelTimeFromPrevious: Math.max(1, legMins),
      travelDistanceFromPrevious: `${estLegKm.toFixed(1)} km`,
    };
  });

  const overallSpeed = avoidHighways ? 30 : (totalDistanceKm > 25 ? 60 : 40);
  const totalMins = Math.round((totalDistanceKm / overallSpeed) * 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  return {
    optimizedRoute: resultRoute as any,
    estimatedTravelTime: hours > 0 ? `${hours}時間${mins}分` : `${Math.max(1, mins)}分`,
    estimatedTravelDistance: `${totalDistanceKm.toFixed(1)} km`,
  };
}

const PlacesAutocompleteSelector: React.FC<{
  predefinedLocations: Location[];
  value: Location | null;
  onSelect: (location: Location | null) => void;
  placeholder?: string;
  placesLibraryReady: boolean;
}> = ({ predefinedLocations, value, onSelect, placeholder, placesLibraryReady }) => {
  const [open, setOpen] = React.useState(false);
  const [isLocating, setIsLocating] = React.useState(false);

  const {
    ready,
    value: inputValue,
    setValue,
    suggestions: { status, data: suggestionsData },
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: 'jp' },
    },
    debounce: 300,
  });

  React.useEffect(() => {
    if (placesLibraryReady && !ready) {
      // init autocomplete if needed
    }
  }, [placesLibraryReady, ready]);

  const handlePredefinedSelect = (location: Location) => {
    onSelect(location);
    setValue(location.name, false);
    setOpen(false);
  };

  const handleGooglePlacesSelect = async (description: string, placeId: string) => {
    setValue(description, false);
    clearSuggestions();
    setOpen(false);

    try {
      const results = await getGeocode({ placeId });
      const { lat, lng } = await getLatLng(results[0]);
      onSelect({
        id: `google-${placeId}`,
        name: description.split(',')[0] || description,
        address: description,
        latitude: lat,
        longitude: lng,
        type: 'custom',
      });
    } catch (error) {
      console.error('Error fetching geocode:', error);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('お使いのブラウザは位置情報をサポートしていません。');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude, longitude } = position.coords;
        onSelect({
          id: `current-${Date.now()}`,
          name: '現在地',
          address: '現在取得したGPS位置',
          latitude,
          longitude,
          type: 'custom',
        });
        setValue('現在地', false);
        setOpen(false);
      },
      (error) => {
        setIsLocating(false);
        console.error('Geolocation error:', error);
        alert('現在地の取得に失敗しました。位置情報の利用が許可されているかご確認ください。');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const filteredStores = React.useMemo(() => {
    return predefinedLocations.filter(loc => loc.type === 'custom');
  }, [predefinedLocations]);

  const filteredStaff = React.useMemo(() => {
    return predefinedLocations.filter(loc => loc.type === 'staff');
  }, [predefinedLocations]);

  const filteredCustomers = React.useMemo(() => {
    return predefinedLocations.filter(loc => loc.type === 'customer');
  }, [predefinedLocations]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-left h-auto py-2"
        >
          {value ? (
            <div className="flex flex-col truncate">
              <span className="font-medium truncate flex items-center gap-1.5">
                {value.type === 'staff' && <UserIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                {value.type === 'customer' && <MapPinIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                {value.type === 'custom' && <Building2 className="h-3.5 w-3.5 text-purple-500 shrink-0" />}
                {value.name}
              </span>
              <span className="text-xs text-muted-foreground truncate">{value.address}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder || '場所を選択...'}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="拠点名、出勤スタッフ、販売店名で検索..."
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
                    <div className="flex items-center truncate">
                      <UserIcon className="mr-2 h-4 w-4 shrink-0 text-blue-500" />
                      <span className="truncate font-medium">{location.name}</span>
                    </div>
                    {(location as any).mainStore && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-medium">
                        {(location as any).mainStore}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredCustomers.length > 0 && (
              <CommandGroup heading="登録販売店">
                {filteredCustomers.slice(0, 300).map((location) => (
                  <CommandItem
                    key={location.id}
                    value={`${location.name} ${location.address}`}
                    onSelect={() => handlePredefinedSelect(location)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center truncate mr-2">
                      <MapPinIcon className="mr-2 h-4 w-4 shrink-0 text-red-500" />
                      <span className="truncate">{location.name}</span>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground truncate max-w-[120px]">
                      {location.address}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {status === 'OK' && suggestionsData.length > 0 && (
              <CommandGroup heading="Googleマップ検索結果">
                {suggestionsData.map(({ place_id, description }) => (
                  <CommandItem
                    key={place_id}
                    value={description}
                    onSelect={() => handleGooglePlacesSelect(description, place_id)}
                  >
                    <MapPinIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <span className="truncate">{description}</span>
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
  const [optimizeFor, setOptimizeFor] = React.useState<'time' | 'distance'>('time');
  const [avoidHighways, setAvoidHighways] = React.useState(false);

  const [isOptimizing, setIsOptimizing] = React.useState(false);
  const [optimizedData, setOptimizedData] = React.useState<OptimizeRouteOutput | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const predefinedLocations = React.useMemo(() => {
    const seenStores = new Set<string>();
    const storeLocs: Location[] = [];
    Object.values(STORE_LOCATIONS).forEach(store => {
      if (!seenStores.has(store.name)) {
        seenStores.add(store.name);
        storeLocs.push({
          id: `store-${store.name}`,
          name: store.name,
          address: store.address,
          latitude: store.latitude,
          longitude: store.longitude,
          type: 'custom' as const,
        });
      }
    });

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
        mainStore: (s as any)['母店'] || (s as any).mainStore || (s as any).storeName || ''
      }))
      .filter(s => s.latitude !== 0 && s.longitude !== 0);

    const customerLocs: Location[] = (allCustomers || [])
      .map(c => {
        const linkedOrder = orders.find(o => (o as any).userCode === (c as any).userCode || (o as any).customerName === c.name);
        return {
          id: c.id,
          name: c.name || (c as any)['販売店名'] || (c as any)['顧客名'] || '店舗名未設定',
          address: c.address || (c as any)['住所'] || '',
          latitude: Number((c as any)['緯度'] ?? c.latitude ?? (c as any).lat ?? 0),
          longitude: Number((c as any)['経度'] ?? c.longitude ?? (c as any).lng ?? 0),
          type: 'customer' as const,
          orderId: linkedOrder?.id
        };
      })
      .filter(c => c.latitude !== 0 && c.longitude !== 0);

    return [...storeLocs, ...staffLocs, ...customerLocs];
  }, [staff, allCustomers, orders]);

  const addWaypoint = () => setWaypoints(prev => [...prev, null]);
  const removeWaypoint = (index: number) => setWaypoints(prev => prev.filter((_, i) => i !== index));
  const updateWaypoint = (index: number, location: Location | null) => {
    setWaypoints(prev => {
      const next = [...prev];
      next[index] = location;
      return next;
    });
  };

  const handleOptimizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startLocation || !endLocation) {
      setErrorMsg('出発地と目的地を選択または入力してください。');
      return;
    }

    if (!startLocation.latitude || !startLocation.longitude || !endLocation.latitude || !endLocation.longitude) {
      setErrorMsg('出発地または目的地の座標が取得できませんでした。');
      return;
    }

    setErrorMsg(null);
    setIsOptimizing(true);

    const validWaypoints = waypoints.filter((w): w is Location => w !== null && !!w.latitude && !!w.longitude);

    try {
      // 1. Race promise with 12-second timeout to allow complete Google Routes API calculation
      const apiPromise = optimizeRoute({
        startLocation,
        endLocation,
        waypoints: validWaypoints,
        optimizeFor,
        avoidHighways,
      });

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000));

      const result = await Promise.race([apiPromise, timeoutPromise]);

      if (result) {
        setOptimizedData(result);
        onRouteOptimized(result, { avoidHighways });
      } else {
        // Fallback to instant local calculation
        console.warn('[OPTIMIZER] API timeout, using instant physical calculation fallback');
        const instantResult = solveInstantFallback(startLocation, endLocation, validWaypoints, avoidHighways);
        setOptimizedData(instantResult);
        onRouteOptimized(instantResult, { avoidHighways });
      }
    } catch (err) {
      console.error('[OPTIMIZER_SUBMIT_ERROR]', err);
      // Instant fallback on error
      const instantResult = solveInstantFallback(startLocation, endLocation, validWaypoints, avoidHighways);
      setOptimizedData(instantResult);
      onRouteOptimized(instantResult, { avoidHighways });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleOpenGoogleMaps = () => {
    if (!optimizedData || !optimizedData.optimizedRoute || optimizedData.optimizedRoute.length === 0) return;

    const route = optimizedData.optimizedRoute;
    const origin = `${route[0].latitude},${route[0].longitude}`;
    const destination = `${route[route.length - 1].latitude},${route[route.length - 1].longitude}`;

    const waypointsParam = route.slice(1, -1).map(loc => `${loc.latitude},${loc.longitude}`).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypointsParam) {
      url += `&waypoints=${encodeURIComponent(waypointsParam)}`;
    }
    if (avoidHighways) {
      url += `&avoid=highways`;
    }

    window.open(url, '_blank');
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>ルート詳細</CardTitle>
          <CardDescription>出発地、目的地、経由地、最適化の基準を選択してください。</CardDescription>
        </CardHeader>
        <form onSubmit={handleOptimizeSubmit}>
          <CardContent className="space-y-4">
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
                {waypoints.map((waypoint, index) => (
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
                ))}
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
              <RadioGroup value={optimizeFor} onValueChange={(v: 'time' | 'distance') => setOptimizeFor(v)} className="flex gap-4">
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
                <Checkbox id="avoid-highways" checked={avoidHighways} onCheckedChange={(c) => setAvoidHighways(!!c)} />
                <Label htmlFor="avoid-highways" className="font-normal cursor-pointer">高速道路を使用しない</Label>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button id="optimizer-submit-button" type="submit" disabled={isOptimizing} className="w-full sm:w-auto">
              {isOptimizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RouteIcon className="mr-2 h-4 w-4" />}
              ルートを最適化
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div>
        {errorMsg && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {!optimizedData && !errorMsg && (
          <Card className="h-full">
            <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground h-48 pt-6">
              <MapPinned className="h-12 w-12 mb-4" />
              <p>最適化されたルートがここに表示されます。</p>
            </CardContent>
          </Card>
        )}

        {optimizedData && (
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
                  {optimizedData.estimatedTravelTime && (
                    <div className="flex flex-col p-3 bg-muted rounded-md">
                      <span className="text-muted-foreground text-xs">推定時間</span>
                      <span className="font-semibold text-lg">{optimizedData.estimatedTravelTime}</span>
                    </div>
                  )}
                  {optimizedData.estimatedTravelDistance && (
                    <div className="flex flex-col p-3 bg-muted rounded-md">
                      <span className="text-muted-foreground text-xs">推定距離</span>
                      <span className="font-semibold text-lg">{optimizedData.estimatedTravelDistance}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">巡回順</h3>
                <ol className="relative border-l border-border space-y-4">
                  {optimizedData.optimizedRoute.map((location: any, index: number) => (
                    <li key={location.id} className="ml-6">
                      <span className={cn(
                        "absolute -left-[10.5px] top-1 flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold",
                        index === 0 ? "bg-green-600 text-white" :
                          index === optimizedData.optimizedRoute.length - 1 ? "bg-red-600 text-white" :
                            "bg-primary text-primary-foreground"
                      )}>
                        {index === 0 ? "S" : index === optimizedData.optimizedRoute.length - 1 ? "G" : index + 1}
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
