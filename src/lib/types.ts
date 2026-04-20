
import type { Timestamp } from 'firebase/firestore';

export type WithId<T> = T & { id: string };

export type Staff = {
  id: string; // Corresponds to Firebase Auth UID
  _type?: 'staff' | 'order'; // Isolation marker
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
  id: string; // System ID (Unique: Date_User_UUID)
  displayId?: string; // Visual ID (Row Number: 1, 2, 3...)
  rawOrderId?: string;
  tripId?: string;
  customerCode?: string;
  customerName?: string;
  address: string;
  taskDetails: string;
  serviceType: string;
  status: string;
  scheduledDate: string;
  scheduledTime?: string;
  scheduledEndTime?: string; // Added field
  estimatedDuration: number;
  travelTime?: number; // Accurate travel time in minutes from Google Maps
  travelDistance?: string; // Accurate travel distance string (e.g. "12.5 km")
  value: number;
  staffName?: string;
  staffId?: string; // Added field
  mainStore?: string; // Added field for D column
  actualStartTime?: Date | string; // Added for analytics
  actualEndTime?: Date | string; // Added for analytics
  startTravelTime?: Date | string; // Added for analytics
  arrivalTimestamp?: Date | string; // Added for analytics
  equipmentStatus?: string;
  tireNumber?: string;
  tireSize?: string;
  carName?: string;
  regNo?: string;
  comment?: string;
  specialNotes?: string;
  taskCalendarEventId?: string;
  travelCalendarEventId?: string;
  cancelDate?: string;
  cancelContact?: string;
  '本数'?: string;
  arrivalStatus?: string;
  productName?: string;
  sensor?: string;
  arrangement?: string;
  disposal?: string;
  picName?: string;
  orderNo?: string;
  contact?: string;
  systemId?: string; // Legacy ID or generated system ID
  latitude?: number;
  longitude?: number;
  raw?: Record<string, any>;
  // Validation metadata
  hasValidationIssues?: boolean;
  validationWarnings?: string[];
  isEmergency?: boolean;
  emergencyMessage?: string;
  adminReply?: string;
  isConfirmed?: boolean;
  submitter?: string;
  confirmedAt?: string;
  description?: string;
  updatedAt?: string | Date;
  createdAt?: string | Date; // Added for tracking
  _type?: 'order' | 'task'; // Added for isolation
};

export type ScheduleEvent = WithId<Order> & {
  tripId?: string;
  orderId?: string;
  systemId?: string; // Original spreadsheet ID (clean)
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
