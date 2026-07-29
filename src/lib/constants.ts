export const MAIN_STORES = [
  '横浜店',
  '横須賀店',
  '東名川崎店',
  '相模原店',
  '厚木店',
  '綾瀬店',
  '小田原店',
] as const;

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
