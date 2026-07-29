export const MAIN_STORES = [
  '横浜店',
  '横須賀店',
  '東名川崎店',
  '相模原店',
  '厚木店',
  '綾瀬店',
  '小田原店',
] as const;

export interface StoreLocation {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export const STORE_LOCATIONS: Record<string, StoreLocation> = {
  '横浜店': {
    name: '横浜店',
    address: '神奈川県横浜市保土ケ谷区法泉３丁目２７−９',
    latitude: 35.44618655316335,
    longitude: 139.5664574053842,
  },
  '横須賀店': {
    name: '横須賀店',
    address: '神奈川県横須賀市大矢部２丁目１１−１６',
    latitude: 35.241932012607535,
    longitude: 139.67738000000114,
  },
  '東名川崎店': {
    name: '東名川崎店',
    address: '神奈川県川崎市宮前区馬絹２丁目４−１７',
    latitude: 35.58151406452486,
    longitude: 139.59445975772667,
  },
  '東名川崎': {
    name: '東名川崎店',
    address: '神奈川県川崎市宮前区馬絹２丁目４−１７',
    latitude: 35.58151406452486,
    longitude: 139.59445975772667,
  },
  '相模原店': {
    name: '相模原店',
    address: '神奈川県相模原市中央区南橋本３丁目９−１６',
    latitude: 35.593133877999485,
    longitude: 139.34401845715982,
  },
  '厚木店': {
    name: '厚木店',
    address: '神奈川県厚木市岡田３１８４',
    latitude: 35.419215056140445,
    longitude: 139.36373258660512,
  },
  '厚木': {
    name: '厚木店',
    address: '神奈川県厚木市岡田３１８４',
    latitude: 35.419215056140445,
    longitude: 139.36373258660512,
  },
  '綾瀬店': {
    name: '綾瀬店',
    address: '神奈川県綾瀬市吉岡東１丁目１５−５１',
    latitude: 35.4264363355401,
    longitude: 139.42009704227777,
  },
  '小田原店': {
    name: '小田原店',
    address: '神奈川県小田原市飯泉９４−２',
    latitude: 35.280270808807884,
    longitude: 139.1705679442837,
  },
};

export const DEFAULT_OFFICE_LOCATION: StoreLocation = STORE_LOCATIONS['横浜店'];

export const STORE_COLORS: Record<string, string> = {
  '横浜店': 'bg-blue-50/70 dark:bg-blue-950/20',
  '横須賀店': 'bg-teal-50/70 dark:bg-teal-950/20',
  '東名川崎店': 'bg-green-50/70 dark:bg-green-950/20',
  '東名川崎': 'bg-green-50/70 dark:bg-green-950/20',
  '相模原店': 'bg-yellow-50/70 dark:bg-yellow-950/20',
  '厚木店': 'bg-purple-50/70 dark:bg-purple-950/20',
  '厚木': 'bg-purple-50/70 dark:bg-purple-950/20',
  '綾瀬店': 'bg-orange-50/70 dark:bg-orange-950/20',
  '小田原店': 'bg-rose-50/70 dark:bg-rose-950/20',
};

export const STORE_ORDER: Record<string, number> = {
  '横浜店': 1,
  '横須賀店': 2,
  '東名川崎店': 3,
  '東名川崎': 3,
  '相模原店': 4,
  '厚木店': 5,
  '厚木': 5,
  '綾瀬店': 6,
  '小田原店': 7,
};
