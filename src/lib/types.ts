

export type Staff = {
  id: string;
  name: string;
  calendarId: string;
  avatarUrl: string;
  color: string;
};

export type Customer = {
  id: string;
  no?: string;
  userCode?: string; // from sheet
  usercode?: string; // from sheet, api lowercases it
  storeName?: string;
  storename?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phoneNumber?: string;
  phonenumber?: string;
  businessHours?: string;
  businesshours?: string;
  name?: string; // for search
};

export type ScheduleEvent = {
  id: string;
  tripId?: string; // To group travel and task events
  orderId?: string; // To link back to the original order
  title?: string;
  locationId: string;
  staffId: string;
  start: Date | string;
  end: Date | string;
};

export type StaffStatus = {
  staffId: string;
  status: 'Idle' | 'En Route' | 'On Site' | 'Working' | 'Departing';
  lastAction: string;
  distanceFromSite?: string;
  latitude?: number;
  longitude?: number;
};

export type Order = {
  id: string;
  customerCode: string;
  taskDetails: string;
  estimatedDuration: number; // in minutes
};
