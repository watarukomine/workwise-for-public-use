
'use client';
import * as React from 'react';
import { useActionState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

import type { Customer, Staff, StaffStatus } from '@/lib/types';
import { optimizeRoute, OptimizeRouteInput, OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Loader2, MapPinned, Route as RouteIcon, PlusCircle, X } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

type State = {
  data: OptimizeRouteOutput | null;
  error: string | null;
  options: {
    avoidHighways: boolean;
  };
};

type Location = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'customer' | 'staff';
};

interface RouteOptimizerProps {
  onRouteOptimized: (data: OptimizeRouteOutput | null, options: { avoidHighways: boolean }) => void;
}

async function formAction(_prevState: State, formData: FormData): Promise<State> {
  const startLocationId = formData.get('startLocation') as string;
  const endLocationId = formData.get('endLocation') as string;
  const waypointIds = formData.getAll('waypoints') as string[];
  const optimizeFor = formData.get('optimizeFor') as OptimizeRouteInput['optimizeFor'];
  const avoidHighways = formData.get('avoidHighways') === 'on';
  const allLocations = JSON.parse(formData.get('allLocations') as string) as Location[];

  if (!startLocationId || !endLocationId) {
    return { data: null, error: '出発地と目的地を選択してください。', options: { avoidHighways } };
  }

  const findLocation = (id: string) => allLocations.find(loc => loc.id === id);

  const startLocation = findLocation(startLocationId);
  const endLocation = findLocation(endLocationId);
  const waypoints = waypointIds.map(findLocation).filter((loc): loc is Location => !!loc);

  if (!startLocation || !endLocation) {
    return { data: null, error: '有効な出発地と目的地が見つかりません。', options: { avoidHighways } };
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
  const [pending, setPending] = React.useState(false);
  
  React.useEffect(() => {
    let form: HTMLFormElement | null = null;
    const findForm = (el: HTMLElement | null): HTMLFormElement | null => {
        if (!el) return null;
        if (el.tagName === 'FORM') return el as HTMLFormElement;
        return findForm(el.parentElement);
    }
    
    const handleFormSubmit = () => setPending(true);
    const observer = new MutationObserver(() => {
        setPending(false);
    });

    const button = document.getElementById('optimizer-submit-button');
    if (button) {
      form = findForm(button);
      if (form) {
        form.addEventListener('submit', handleFormSubmit);
        const resultsContainer = document.getElementById('optimizer-results');
        if(resultsContainer) {
            observer.observe(resultsContainer, { childList: true, subtree: true });
        }
      }
    }
    return () => {
      if (form) {
        form.removeEventListener('submit', handleFormSubmit);
      }
      observer.disconnect();
    };
  }, []);

  return (
    <Button id="optimizer-submit-button" type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RouteIcon className="mr-2 h-4 w-4" />}
      ルートを最適化
    </Button>
  );
}

const LocationSelector: React.FC<{
  locations: Location[];
  selectedValue: string | undefined;
  onSelect: (id: string | undefined) => void;
  placeholder: string;
}> = ({ locations, selectedValue, onSelect, placeholder }) => {
  const [open, setOpen] = React.useState(false);
  const staffLocations = locations.filter(l => l.type === 'staff');
  const customerLocations = locations.filter(l => l.type === 'customer');
  const selectedLocationName = locations.find(l => l.id === selectedValue)?.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <span className="truncate">{selectedLocationName || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="ロケーションを検索..." />
          <CommandList>
            <CommandEmpty>該当するロケーションが見つかりません。</CommandEmpty>
            <CommandGroup heading="スタッフ">
              {staffLocations.map(location => (
                <CommandItem key={location.id} value={location.name} onSelect={() => { onSelect(location.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", selectedValue === location.id ? "opacity-100" : "opacity-0")} />
                  {location.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="販売店">
              {customerLocations.map(location => (
                <CommandItem key={location.id} value={location.name} onSelect={() => { onSelect(location.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", selectedValue === location.id ? "opacity-100" : "opacity-0")} />
                  {location.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};


export function RouteOptimizer({ onRouteOptimized }: RouteOptimizerProps) {
  const firestore = useFirestore();
  const staffCollection = useMemoFirebase(() => collection(firestore, 'staff'), [firestore]);
  const customersCollection = useMemoFirebase(() => collection(firestore, 'customers'), [firestore]);
  const staffStatusCollection = useMemoFirebase(() => collection(firestore, 'staffStatus'), [firestore]);
  
  const { data: customers } = useCollection<Customer>(customersCollection);
  const { data: staff } = useCollection<Staff>(staffCollection);
  const { data: staffStatusData } = useCollection<StaffStatus>(staffStatusCollection);
  
  const [startLocation, setStartLocation] = React.useState<string | undefined>();
  const [endLocation, setEndLocation] = React.useState<string | undefined>();
  const [waypoints, setWaypoints] = React.useState<string[]>([]);
  const [state, formActionWithState] = useActionState(formAction, { data: null, error: null, options: { avoidHighways: false } });

  React.useEffect(() => {
    onRouteOptimized(state.data, state.options);
  }, [state.data, state.options, onRouteOptimized]);

  const allLocations = React.useMemo(() => {
    if (!customers || !staff || !staffStatusData) return [];

    const staffWithStatus = staffStatusData.map(status => {
        const staffDetails = staff.find(s => s.id === status.staffId);
        return { ...staffDetails, ...status };
    }).filter(s => s.id);

    const customerLocations: Location[] = customers
      .filter(c => c.latitude && c.longitude && c.storeName)
      .map(c => ({
        id: c.id,
        name: c.storeName!,
        address: c.address,
        latitude: c.latitude!,
        longitude: c.longitude!,
        type: 'customer'
      }));

    const staffLocations: Location[] = staffWithStatus
      .filter(s => s.latitude && s.longitude)
      .map(s => ({
        id: s.id!,
        name: `${s.name} (現在地)`,
        address: 'Current Location',
        latitude: s.latitude!,
        longitude: s.longitude!,
        type: 'staff'
      }));

    return [...customerLocations, ...staffLocations];
  }, [customers, staff, staffStatusData]);
  
  const availableWaypointLocations = allLocations.filter(
    loc => loc.id !== startLocation && loc.id !== endLocation
  );

  const addWaypoint = () => {
    setWaypoints(prev => [...prev, '']);
  };

  const updateWaypoint = (index: number, id: string) => {
    setWaypoints(prev => {
        const newWaypoints = [...prev];
        newWaypoints[index] = id;
        return newWaypoints;
    });
  };

  const removeWaypoint = (index: number) => {
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  };
  
  const isLoading = !customers || !staff || !staffStatusData;

  if (isLoading) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>ルート詳細</CardTitle>
                <CardDescription>出発地、目的地、経由地、最適化の基準を選択してください。</CardDescription>
            </CardHeader>
            <CardContent>
                <p>Loading locations...</p>
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
             <input type="hidden" name="allLocations" value={JSON.stringify(allLocations)} />
             {startLocation && <input type="hidden" name="startLocation" value={startLocation} />}
             {endLocation && <input type="hidden" name="endLocation" value={endLocation} />}
             {waypoints.map((id, index) => id && <input key={index} type="hidden" name="waypoints" value={id} />)}

            <div className="space-y-2">
                <Label>出発地</Label>
                <LocationSelector locations={allLocations} selectedValue={startLocation} onSelect={setStartLocation} placeholder="出発地を選択..." />
            </div>

            <div className="space-y-2">
                <Label>経由地</Label>
                 <div className="space-y-2">
                    {waypoints.map((waypointId, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="flex-grow">
                                <LocationSelector 
                                    locations={availableWaypointLocations} 
                                    selectedValue={waypointId} 
                                    onSelect={(id) => updateWaypoint(index, id!)} 
                                    placeholder="経由地を選択..."
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
                <LocationSelector locations={allLocations} selectedValue={endLocation} onSelect={setEndLocation} placeholder="目的地を選択..." />
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
