
export type Staff = {
  id: string;
  name: string;
  calendarId: string;
  avatarUrl: string;
  color: string;
};

export type Customer = {
  id: string;
  "No": string;
  "ユーザーコード": string;
  "旧チャネルSEQ"?: string;
  "店舗"?: string;
  "管理C"?: string;
  "機材 有無"?: string;
  "住所": string;
  "緯度"?: number;
  "経度"?: number;
  "電話番号"?: string;
  "営業時間"?: string;
  // The name property is added for search functionality.
  // It will be mapped from one of the Japanese fields.
  name?: string;
};

export type ScheduleEvent = {
  id: string;
  title?: string;
  locationId: string;
  staffId: string;
  start: string;
  end: string;
};

export type StaffStatus = {
  staffId: string;
  status: 'Idle' | 'En Route' | 'On Site' | 'Working' | 'Departing';
  lastAction: string;
  distanceFromSite?: string;
  latitude?: number;
  longitude?: number;
};
