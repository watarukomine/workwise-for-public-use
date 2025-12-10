
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

// This is now populated from the OrderContext in page.tsx
export const unassignedOrdersData: WithId<Order>[] = [];

export const staffStatusData: StaffStatus[] = [
  { staffId: '1', status: '待機中', lastAction: 'オフィスで待機中', latitude: 35.4658, longitude: 139.622, message: '本日、体調不良のため大事をとって休憩を多めに取らせていただきます。' },
  { staffId: '2', status: '移動中', lastAction: 'ABCストアへ移動中', distanceFromSite: '約15分', latitude: 35.45, longitude: 139.635 },
  { staffId: '3', status: '作業中', lastAction: 'さくら商店で新商品の陳列中', latitude: 35.48, longitude: 139.636 },
  { staffId: '4', status: '作業完了', lastAction: 'ベイサイドカフェに到着', latitude: 35.465, longitude: 139.622 },
];


function getTodayAt(hour: number, minute: number = 0): Date {
  const today = new Date();
  today.setHours(hour, minute, 0, 0);
  return today;
}

export const scheduleData: WithId<ScheduleEvent>[] = [];
