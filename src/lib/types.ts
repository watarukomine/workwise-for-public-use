import type { Timestamp } from 'firebase/firestore';

export type WithId<T> = T & { id: string };

export type Staff = {
  id: string; // Corresponds to Firebase Auth UID
  name: string;
  email: string | null;
  photoURL?: string | null;
  calendarId?: string; 
  avatarUrl?: string; 
  color?: string; 
  role: 'admin' | 'staff';
  area?: '県西' | '県央' | '県東';
  '母店'?: string;
  password?: string; 
  'ロール'?: 'admin' | 'staff';
  department?: string; // from user's code
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
  name?: string; 
  address?: string;
  latitude?: number;
  longitude?: number;
  storeName?: string;
  userCode?: string;
};

export type ScheduleEvent = {
  id: string;
  tripId?: string; 
  orderId?: string; 
  rawOrderId?: string; 
  title: string;
  description?: string;
  locationId?: string;
  staffId?: string;
  start: Date | string | Timestamp;
  end: Date | string | Timestamp;
  // For react-big-calendar
  staffName?: string;
  status?: string;
  allDay?: boolean;
  resource?: any;
};

export type StaffStatus = {
  staffId: string;
  status: '未割当' | '作業待ち' | '移動中' | '作業中' | '作業完了' | '待機中';
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
  estimatedDuration: number; 
  raw?: any; 
  rawOrderId?: string;
  customerName?: string; // from user's code
  productName?: string; // from user's code
  amount?: number; // from user's code
  deliveryDate?: string; // from user's code
  staff?: string; // from user's code
  status?: string; // from user's code
};
