import type { Staff, Customer, ScheduleEvent, StaffStatus } from './types';

export const staffData: Staff[] = [
  { id: 'staff-1', name: 'Sarah Chen', calendarId: 'sarah.chen@example.com', avatarUrl: 'https://picsum.photos/seed/sarah/100/100', color: 'hsl(217, 91%, 60%)' },
  { id: 'staff-2', name: 'Mike Davis', calendarId: 'mike.davis@example.com', avatarUrl: 'https://picsum.photos/seed/mike/100/100', color: 'hsl(142, 71%, 45%)' },
  { id: 'staff-3', name: 'Emily Rodriguez', calendarId: 'emily.rodriguez@example.com', avatarUrl: 'https://picsum.photos/seed/emily/100/100', color: 'hsl(346, 77%, 58%)' },
  { id: 'staff-4', name: 'David Lee', calendarId: 'david.lee@example.com', avatarUrl: 'https://picsum.photos/seed/david/100/100', color: 'hsl(38, 92%, 50%)' },
];

export const customerData: Customer[] = [
  { id: 'cust-1', name: 'Oak Valley Hospital', address: '123 Health St, Rivertown, USA', latitude: 34.0522, longitude: -118.2437 },
  { id: 'cust-2', name: 'Pioneer High School', address: '456 Education Ave, Mapleton, USA', latitude: 34.1522, longitude: -118.3437 },
  { id: 'cust-3', name: 'City Center Mall', address: '789 Commerce Blvd, Bayview, USA', latitude: 34.0522, longitude: -118.4437 },
  { id: 'cust-4', name: 'Lakeside Apartments', address: '101 Residence Rd, Greenfield, USA' },
  { id: 'cust-5', name: 'Metro Office Complex', address: '212 Business Park Dr, Summit, USA', latitude: 33.9522, longitude: -118.2437 },
  { id: 'cust-6', name: 'Coastal Industrial', address: '333 Industry Way, Port City, USA' },
];

const today = new Date();
const setTime = (date: Date, hours: number, minutes: number) => {
  const newDate = new Date(date);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate;
};

export const scheduleData: ScheduleEvent[] = [
  { id: 'event-1', title: 'Routine Maintenance', customerId: 'cust-1', staffId: 'staff-1', start: setTime(today, 9, 0), end: setTime(today, 11, 0) },
  { id: 'event-2', title: 'System Upgrade', customerId: 'cust-3', staffId: 'staff-2', start: setTime(today, 10, 0), end: setTime(today, 14, 0) },
  { id: 'event-3', title: 'Emergency Repair', customerId: 'cust-2', staffId: 'staff-3', start: setTime(today, 11, 30), end: setTime(today, 13, 0) },
  { id: 'event-4', title: 'New Installation', customerId: 'cust-5', staffId: 'staff-1', start: setTime(today, 13, 0), end: setTime(today, 16, 0) },
];

export const staffStatusData: StaffStatus[] = [
  { staffId: 'staff-1', status: 'Working', lastAction: 'Started Task: Routine Maintenance', distanceFromSite: '0 mi' },
  { staffId: 'staff-2', status: 'On Site', lastAction: 'Arrived at City Center Mall', distanceFromSite: '0 mi' },
  { staffId: 'staff-3', status: 'En Route', lastAction: 'Departing for Pioneer High School', distanceFromSite: '3.2 mi' },
  { staffId: 'staff-4', status: 'Idle', lastAction: 'Available for assignment', distanceFromSite: undefined },
];
