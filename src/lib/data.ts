
import type { Staff, Customer, ScheduleEvent, StaffStatus, Order, WithId } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getAvatarUrl = (avatarId: string) => {
  return PlaceHolderImages.find(img => img.id === avatarId)?.imageUrl || '';
};

// This static data is now a fallback, authentication will be handled via GAS.
export const staffData: WithId<Staff>[] = [
  {
    id: '1',
    name: '管理者ユーザー',
    email: 'admin@example.com',
    password: 'password', // Plain text for demo purposes only
    role: 'admin',
    calendarId: 'admin@example.com',
    color: 'hsl(262, 83%, 58%)',
    avatarUrl: getAvatarUrl('avatar2'),
  },
  {
    id: '2',
    name: '一般スタッフ',
    email: 'staff@example.com',
    password: 'password', // Plain text for demo purposes only
    role: 'staff',
    calendarId: 'staff@example.com',
    color: 'hsl(12, 76%, 61%)',
    avatarUrl: getAvatarUrl('avatar1'),
  },
];


export const customerData: WithId<Customer>[] = [];

export const unassignedOrdersData: WithId<Order>[] = [
    { id: 'ORD001', customerCode: 'CUST001', taskDetails: '商品棚の整理', estimatedDuration: 60 },
    { id: 'ORD002', customerCode: 'CUST003', taskDetails: '新商品の陳列', estimatedDuration: 90 },
    { id: 'ORD003', customerCode: 'CUST005', taskDetails: '在庫確認と発注', estimatedDuration: 75 },
    { id: 'ORD004', customerCode: 'CUST008', taskDetails: '販促物の設置', estimatedDuration: 45 },
];

export const staffStatusData: StaffStatus[] = [
    { staffId: '1', status: 'Idle', lastAction: 'オフィスで待機中', latitude: 35.4658, longitude: 139.622, message: '本日、体調不良のため大事をとって休憩を多めに取らせていただきます。' },
    { staffId: '2', status: 'En Route', lastAction: 'ABCストアへ移動中', distanceFromSite: '約15分', latitude: 35.45, longitude: 139.635 },
    { staffId: '3', status: 'Working', lastAction: 'さくら商店で新商品の陳列中', latitude: 35.48, longitude: 139.636 },
    { staffId: '4', status: 'On Site', lastAction: 'ベイサイドカフェに到着', latitude: 35.465, longitude: 139.622 },
];


function getTodayAt(hour: number, minute: number = 0): Date {
    const today = new Date();
    today.setHours(hour, minute, 0, 0);
    return today;
}

export const scheduleData: WithId<ScheduleEvent>[] = [
  {
    id: 'event-1',
    staffId: '2',
    locationId: 'C001',
    title: '移動: ABCストア',
    start: getTodayAt(9, 0),
    end: getTodayAt(9, 30),
    tripId: 'trip-1'
  },
  {
    id: 'event-2',
    staffId: '2',
    locationId: 'C001',
    orderId: 'ORD001',
    title: '商品棚の整理',
    start: getTodayAt(9, 30),
    end: getTodayAt(10, 30),
    tripId: 'trip-1'
  },
  {
    id: 'event-3',
    staffId: '3',
    locationId: 'C003',
    title: '移動: さくら商店',
    start: getTodayAt(10, 0),
    end: getTodayAt(10, 30),
    tripId: 'trip-2'
  },
    {
    id: 'event-4',
    staffId: '3',
    locationId: 'C003',
    orderId: 'ORD002',
    title: '新商品の陳列',
    start: getTodayAt(10, 30),
    end: getTodayAt(12, 0),
    tripId: 'trip-2'
  },
   {
    id: 'event-5',
    staffId: '1',
    title: '休憩',
    locationId: '',
    start: getTodayAt(12, 0),
    end: getTodayAt(13, 0),
  },
];
