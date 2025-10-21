
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
  userCode: string;
  storeName?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phoneNumber?: string;
  businessHours?: string;
  // Legacy fields from import
  "No"?: string;
  "ユーザーコード"?: string;
  "店舗"?: string;
  "住所"?: string;
  "緯度"?: number | string;
  "経度"?: number | string;
  "電話番号"?: string;
  "営業時間"?: string;
  name?: string; // for search
};

export type ScheduleEvent = {
  id: string;
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
