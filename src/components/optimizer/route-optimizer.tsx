'use client';
import * as React from 'react';
import { useActionState } from 'react';

import type { Customer } from '@/lib/types';
import { optimizeRoute, OptimizeRouteInput, OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Loader2, MapPinned, Route as RouteIcon } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type State = {
  data: OptimizeRouteOutput | null;
  error: string | null;
};

async function formAction(_prevState: State, formData: FormData): Promise<State> {
  const selectedLocationIds = formData.getAll('locations') as string[];
  const optimizeFor = formData.get('optimizeFor') as OptimizeRouteInput['optimizeFor'];
  const allCustomers = JSON.parse(formData.get('allCustomers') as string) as Customer[];

  if (selectedLocationIds.length < 2) {
    return { data: null, error: 'Please select at least two locations to optimize.' };
  }
  
  const selectedCustomers = allCustomers.filter(c => selectedLocationIds.includes(c.id));

  // Simulate automatic geocoding
  const locationsWithCoords = selectedCustomers.map(loc => {
    if (loc.latitude && loc.longitude) {
      return loc;
    }
    // Simulate finding coordinates for an address
    return {
      ...loc,
      latitude: 33.5 + Math.random(), // Random latitude in a plausible range
      longitude: -117.5 - Math.random(), // Random longitude in a plausible range
    };
  })

  try {
    const result = await optimizeRoute({
      locations: locationsWithCoords,
      optimizeFor: optimizeFor,
    });
    return { data: result, error: null };
  } catch (e) {
    return { data: null, error: 'Failed to optimize route. Please try again.' };
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
    // A bit of a hack to get form pending state without experimental useFormStatus
    const button = document.getElementById('optimizer-submit-button');
    if (button) {
      form = findForm(button);
      if (form) {
        const handleFormSubmit = () => setPending(true);
        form.addEventListener('submit', handleFormSubmit);
      }
    }
    return () => {
      if (form) {
        form.removeEventListener('submit', handleFormSubmit);
      }
    };
  }, []);

  return (
    <Button id="optimizer-submit-button" type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RouteIcon className="mr-2 h-4 w-4" />}
      Optimize Route
    </Button>
  );
}

export function RouteOptimizer({ customers }: { customers: Customer[] }) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [state, formActionWithState] = useActionState(formAction, { data: null, error: null });

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Route Details</CardTitle>
          <CardDescription>Select locations and optimization criteria.</CardDescription>
        </CardHeader>
        <form action={formActionWithState}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Locations</Label>
              <input type="hidden" name="allCustomers" value={JSON.stringify(customers)} />
              {selected.map(id => <input key={id} type="hidden" name="locations" value={id} />)}
              
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    <span className="truncate">{selected.length > 0 ? `${selected.length} location(s) selected` : "Select locations..."}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search location..." />
                    <CommandList>
                      <CommandEmpty>No location found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name}
                            onSelect={() => {
                              setSelected(current => 
                                current.includes(customer.id) 
                                  ? current.filter(id => id !== customer.id) 
                                  : [...current, customer.id]
                              );
                              setOpen(true);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selected.includes(customer.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {customer.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>Optimize For</Label>
              <RadioGroup name="optimizeFor" defaultValue="time" className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="time" id="time" />
                  <Label htmlFor="time">Travel Time</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="distance" id="distance" />
                  <Label htmlFor="distance">Distance</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Optimized Route</CardTitle>
          <CardDescription>The most efficient path based on your selection.</CardDescription>
        </CardHeader>
        <CardContent>
          {state.error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {!state.data && !state.error && (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48">
              <MapPinned className="h-12 w-12 mb-4" />
              <p>Your optimized route will appear here.</p>
            </div>
          )}

          {state.data && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Summary</h3>
                <p className="text-sm text-muted-foreground">{state.data.summary}</p>
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                  {state.data.estimatedTravelTime && (
                    <div className="flex flex-col p-3 bg-muted rounded-md">
                      <span className="text-muted-foreground text-xs">Est. Time</span>
                      <span className="font-semibold text-lg">{state.data.estimatedTravelTime}</span>
                    </div>
                  )}
                  {state.data.estimatedTravelDistance && (
                     <div className="flex flex-col p-3 bg-muted rounded-md">
                      <span className="text-muted-foreground text-xs">Est. Distance</span>
                      <span className="font-semibold text-lg">{state.data.estimatedTravelDistance}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Route Order</h3>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
