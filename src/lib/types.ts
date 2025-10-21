export type Staff = {
  id: string;
  name: string;
  calendarId: string;
  avatarUrl: string;
  color: string;
};

export type Customer = {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
};

export type ScheduleEvent = {
  id: string;
  title?: string;
  customerId: string;
  staffId: string;
  start: Date;
  end: Date;
};

export type StaffStatus = {
  staffId: string;
  status: 'Idle' | 'En Route' | 'On Site' | 'Working' | 'Departing';
  lastAction: string;
  distanceFromSite?: string;
};
