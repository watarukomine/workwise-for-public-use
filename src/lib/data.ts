
import type { Staff, Customer, ScheduleEvent, StaffStatus, Order, WithId } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getAvatarUrl = (avatarId: string) => {
  return PlaceHolderImages.find(img => img.id === avatarId)?.imageUrl || '';
};

export const staffData: WithId<Staff>[] = [
  {
    id: '1',
    name: '佐藤 太郎',
    calendarId: 'taro.sato@example.com',
    color: 'hsl(217, 91%, 60%)',
    avatarUrl: getAvatarUrl('avatar2'),
  },
  {
    id: '2',
    name: '鈴木 花子',
    calendarId: 'hanako.suzuki@example.com',
    color: 'hsl(12, 76%, 61%)',
    avatarUrl: getAvatarUrl('avatar1'),
  },
  {
    id: '3',
    name: '高橋 一郎',
    calendarId: 'ichiro.takahashi@example.com',
    color: 'hsl(173, 58%, 39%)',
    avatarUrl: getAvatarUrl('avatar4'),
  },
  {
    id: '4',
    name: '田中 美咲',
    calendarId: 'misaki.tanaka@example.com',
    color: 'hsl(43, 74%, 66%)',
    avatarUrl: getAvatarUrl('avatar3'),
  },
];

export const customerData: WithId<Customer>[] = [
    { id: 'C001', No: '1', userCode: 'CUST001', storeName: 'ABCストア', address: '神奈川県横浜市中区元町1-1', '電話番号': '045-111-1111', '営業時間': '10:00-19:00', latitude: 35.442, longitude: 139.648, name: 'ABCストア' },
    { id: 'C002', No: '2', userCode: 'CUST002', storeName: 'XYZマート', address: '神奈川県横浜市西区みなとみらい2-2', '電話番号': '045-222-2222', '営業時間': '09:00-21:00', latitude: 35.456, longitude: 139.63, name: 'XYZマート' },
    { id: 'C003', No: '3', userCode: 'CUST003', storeName: 'さくら商店', address: '神奈川県横浜市神奈川区東神奈川1-12', '電話番号': '045-333-3333', '営業時間': '09:30-18:30', latitude: 35.48, longitude: 139.636, name: 'さくら商店' },
    { id: 'C004', No: '4', userCode: 'CUST004', storeName: 'みなと薬局', address: '神奈川県横浜市中区山下町200', '電話番号': '045-444-4444', '営業時間': '09:00-18:00', latitude: 35.443, longitude: 139.643, name: 'みなと薬局' },
    { id: 'C005', No: '5', userCode: 'CUST005', storeName: 'ベイサイドカフェ', address: '神奈川県横浜市西区高島1-1', '電話番号': '045-555-5555', '営業時間': '08:00-20:00', latitude: 35.465, longitude: 139.622, name: 'ベイサイドカフェ' },
    { id: 'C006', No: '6', userCode: 'CUST006', storeName: 'グリーンフラワー', address: '神奈川県横浜市青葉区美しが丘1-1-2', '電話番号': '045-666-6666', '営業時間': '10:00-19:00', latitude: 35.548, longitude: 139.55, name: 'グリーンフラワー' },
    { id: 'C007', No: '7', userCode: 'CUST007', storeName: 'かもめベーカリー', address: '神奈川県横浜市港北区新横浜2-5', '電話番号': '045-777-7777', '営業時間': '07:30-18:00', latitude: 35.508, longitude: 139.617, name: 'かもめベーカリー' },
    { id: 'C008', No: '8', userCode: 'CUST008', storeName: 'ブックポート横浜', address: '神奈川県横浜市西区南幸1-5-1', '電話番号': '045-888-8888', '営業時間': '10:00-22:00', latitude: 35.466, longitude: 139.622, name: 'ブックポート横浜' },
    { id: 'C009', No: '9', userCode: 'CUST009', storeName: 'オーシャンビューホテル', address: '神奈川県横浜市中区海岸通1-1', '電話番号': '045-999-9999', '営業時間': '24時間', latitude: 35.45, longitude: 139.64, name: 'オーシャンビューホテル' },
    { id: 'C010', No: '10', userCode: 'CUST010', storeName: 'サンセットダイナー', address: '神奈川県横浜市金沢区海の公園10', '電話番号': '045-000-0000', '営業時間': '11:00-22:00', latitude: 35.33, longitude: 139.645, name: 'サンセットダイナー' },
];

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
