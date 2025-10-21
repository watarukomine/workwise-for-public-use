import type { Staff, Customer, ScheduleEvent, StaffStatus } from './types';

export const staffData: Staff[] = [
  { id: 'staff-1', name: '佐藤 花子', calendarId: 'hanako.sato@example.com', avatarUrl: 'https://picsum.photos/seed/hanako/100/100', color: 'hsl(217, 91%, 60%)' },
  { id: 'staff-2', name: '鈴木 一郎', calendarId: 'ichiro.suzuki@example.com', avatarUrl: 'https://picsum.photos/seed/ichiro/100/100', color: 'hsl(142, 71%, 45%)' },
  { id: 'staff-3', name: '高橋 美咲', calendarId: 'misaki.takahashi@example.com', avatarUrl: 'https://picsum.photos/seed/misaki/100/100', color: 'hsl(346, 77%, 58%)' },
  { id: 'staff-4', name: '田中 健太', calendarId: 'kenta.tanaka@example.com', avatarUrl: 'https://picsum.photos/seed/kenta/100/100', color: 'hsl(38, 92%, 50%)' },
];

export const customerData: Customer[] = [
  { id: 'cust-1', name: '桜ヶ丘中央病院', address: '神奈川県横浜市中区桜木町1-1-1', latitude: 35.4513, longitude: 139.6322 },
  { id: 'cust-2', name: 'みなとみらい高校', address: '神奈川県横浜市西区みなとみらい3-5-1', latitude: 35.4658, longitude: 139.6353 },
  { id: 'cust-3', name: 'ベイサイドモール', address: '神奈川県横浜市金沢区白帆5-2', latitude: 35.3813, longitude: 139.6455 },
  { id: 'cust-4', name: 'レイクサイド・アパートメンツ', address: '神奈川県横浜市旭区上白根町123' },
  { id: 'cust-5', name: '横浜ビジネスパーク', address: '神奈川県横浜市保土ケ谷区神戸町134', latitude: 35.4593, longitude: 139.5962 },
  { id: 'cust-6', name: '京浜工業地帯 倉庫', address: '神奈川県横浜市鶴見区大黒ふ頭15' },
];

const today = new Date();
const setTime = (date: Date, hours: number, minutes: number) => {
  const newDate = new Date(date);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate;
};

export const scheduleData: ScheduleEvent[] = [
  { id: 'event-1', title: '定期メンテナンス', customerId: 'cust-1', staffId: 'staff-1', start: setTime(today, 9, 0), end: setTime(today, 11, 0) },
  { id: 'event-2', title: 'システムアップグレード', customerId: 'cust-3', staffId: 'staff-2', start: setTime(today, 10, 0), end: setTime(today, 14, 0) },
  { id: 'event-3', title: '緊急修理', customerId: 'cust-2', staffId: 'staff-3', start: setTime(today, 11, 30), end: setTime(today, 13, 0) },
  { id: 'event-4', title: '新規設置', customerId: 'cust-5', staffId: 'staff-1', start: setTime(today, 14, 0), end: setTime(today, 16, 30) },
  { id: 'event-5', title: 'オイル交換', customerId: 'cust-4', staffId: 'staff-4', start: setTime(today, 8, 30), end: setTime(today, 9, 30) },
];

export const staffStatusData: StaffStatus[] = [
  { staffId: 'staff-1', status: 'Working', lastAction: '作業開始: 定期メンテナンス', distanceFromSite: '0 km' },
  { staffId: 'staff-2', status: 'On Site', lastAction: 'ベイサイドモールに到着', distanceFromSite: '0 km' },
  { staffId: 'staff-3', status: 'En Route', lastAction: 'みなとみらい高校へ向けて出発', distanceFromSite: '3.2 km' },
  { staffId: 'staff-4', status: 'Idle', lastAction: '次の指示を待っています', distanceFromSite: undefined },
];
