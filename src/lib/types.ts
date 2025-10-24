
import type { Timestamp } from 'firebase/firestore';

export type WithId<T> = T & { id: string };

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'staff';
};

export type Staff = {
  id: string;
  name: string;
  email: string | null;
  calendarId?: string; // Made optional
  avatarUrl?: string; // Made optional
  color?: string; // Made optional
  role?: 'admin' | 'staff';
};

export type Customer = {
  id:string;
  No?: string;
  'ユーザーコード'?: string;
  '旧 チャネル SEQ'?: string;
  '店舗'?: string;
  '管理C'?: string;
  '機材有無'?: string;
  '住所'?: string;
  '緯度'?: number;
  '経度'?: number;
  '電話番号'?: string;
  '営業時間'?: string;
  // for compatibility
  name?: string; 
  address?: string;
  latitude?: number;
  longitude?: number;
  storeName?: string;
  userCode?: string;
};

export type ScheduleEvent = {
  id: string;
  tripId?: string; // To group travel and task events
  orderId?: string; // To link back to the original order
  title?: string;
  locationId: string;
  staffId: string;
  start: Date | string | Timestamp;
  end: Date | string | Timestamp;
};

export type StaffStatus = {
  staffId: string;
  status: 'Idle' | 'En Route' | 'On Site' | 'Working' | 'Departing';
  lastAction: string;
  distanceFromSite?: string;
  latitude?: number;
  longitude?: number;
  message?: string;
};

export type Order = {
  id: string;
  customerCode: string;
  taskDetails: string;
  estimatedDuration: number; // in minutes
};

    