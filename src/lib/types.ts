
import type { Timestamp } from 'firebase/firestore';

export type WithId<T> = T & { id: string };

export type Staff = {
  id: string; // Corresponds to Firebase Auth UID
  name: string;
  email: string | null;
  photoURL?: string | null;
  avatarUrl?: string;
  color?: string;
  role: 'admin' | 'staff';
  area?: '県西' | '県央' | '県東';
  '母店'?: string;
  password?: string;
  'ロール'?: 'admin' | 'staff';
  department?: string; // from user's code
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  calendarId?: string;
  'コントローラー'?: string;
  controller?: string;
};

export type Customer = {
  id: string;
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
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  storeName?: string;
  userCode?: string;
  mainStoreCode?: string;
  mainStore?: string;
};

export type Order = {
  id: string;
  rawOrderId?: string;
  customerCode: string;
  customerName: string;
  address: string;
  taskDetails: string;
  serviceType: string;
  status: string;
  scheduledDate: string;
  scheduledTime?: string;
  scheduledEndTime?: string; // Added field
  estimatedDuration: number;
  value: number;
  staffName?: string;
  staffId?: string; // Added field
  mainStore?: string; // Added field for D column
  actualStartTime?: Date; // Added for analytics
  actualEndTime?: Date; // Added for analytics
  startTravelTime?: Date; // Added for travel analysis
  arrivalTimestamp?: Date; // Added for travel analysis
  equipmentStatus?: string;
  tireSize?: string;
  taskCalendarEventId?: string;
  travelCalendarEventId?: string;
  '本数'?: string;
  raw?: Record<string, any>;
};

export type ScheduleEvent = WithId<Order> & {
  tripId?: string;
  orderId?: string;
  title: string;
  description?: string;
  locationId?: string;
  staffId: string;
  start: Date | string;
  end: Date | string;
  allDay?: boolean;
  resource?: any;
  calendarEventId?: string;
};

export type StaffStatus = {
  staffId: string;
  status: '未割当' | '作業待ち' | '移動中' | '作業中' | '作業完了' | '待機中' | '移動開始' | '現場到着' | '作業開始' | '出勤済' | '退勤済' | string;
  lastAction: string;
  distanceFromSite?: string;
  latitude?: number;
  longitude?: number;
  lastUpdate?: string;
  message?: string;
};

export type DailyAttendance = {
  id: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  staffIds: string[];
  checkedOutIds?: string[]; // New field for managing clock-out status
  scheduledStaffIds?: string[]; // New field for shift schedule
  updatedAt?: Timestamp;
};
