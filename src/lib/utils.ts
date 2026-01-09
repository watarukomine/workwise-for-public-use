
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isValid, format, parseISO } from 'date-fns';
import type { Order, WithId, Staff } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function findKey(item: any, possibleKeys: string[]) {
  if (!item || typeof item !== 'object') {
    return undefined;
  }
  for (const key of possibleKeys) {
    const lowerKey = key.toLowerCase().trim();
    for (const itemKey in item) {
      if (itemKey.toLowerCase().trim() === lowerKey) {
        return item[itemKey];
      }
    }
  }
  return undefined;
}

export const formatDate = (dateString: string | undefined | null, formatString: string = 'yyyy/MM/dd'): string => {
  if (!dateString) return '';
  try {
    const date = parseISO(dateString);
    if (isValid(date)) {
      return format(date, formatString);
    }
  } catch (e) {
    // Fallback for non-ISO strings if necessary
  }
  return dateString; // Return original string if invalid
};

export const formatTime = (date: Date | string) => {
  if (!date) return '';

  // Handle cases like "1899-12-29T15:00:00.000Z" which come from Sheets for time-only values
  if (typeof date === 'string' && date.startsWith('1899-12-')) {
    const d = parseISO(date);
    if (isValid(d)) {
      return format(d, 'HH:mm');
    }
  }

  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || !isValid(d) || isNaN(d.getTime())) {
    if (typeof date === 'string') {
      const today = new Date();
      const [hours, minutes] = date.split(':');
      if (hours && minutes) {
        today.setHours(parseInt(hours, 10), parseInt(minutes, 10));
        if (isValid(today)) {
          return format(today, 'HH:mm');
        }
      }
    }
    return "";
  }
  return format(d, 'HH:mm');
};

export const mapRawToOrder = (rawOrder: any): WithId<Order> => {
  const idKeys = ['受注 ID', '受注id', '受注ID', 'id'];
  const orderId = findKey(rawOrder, idKeys);

  // Ensure unique ID if missing
  // const uniqueId = String(orderId || `ord-rand-${Math.random()}`);

  const rawDurationVal = findKey(rawOrder, ['作業時間（分）', '作業時間(分)', '作業時間', '作業所要時間']);
  let duration = 60; // Default
  if (rawDurationVal) {
    const valStr = String(rawDurationVal);
    // Handle GAS Date object string for Duration (e.g. "1899-12-30T...")
    if (valStr.includes('1899-12-30')) {
      const date = new Date(valStr);
      if (!isNaN(date.getTime())) {
        duration = date.getHours() * 60 + date.getMinutes();
      }
    } else {
      const parsed = parseInt(valStr, 10);
      if (!isNaN(parsed)) {
        duration = parsed;
      }
    }
  }
  const scheduledTime = findKey(rawOrder, ['チップ配置作業予定', '予定時間', 'チップ配置作業予定', 'scheduledTime', '開始日時']);

  const customerName = findKey(rawOrder, ['お取引先名', '店舗名', '店舗', '取引先']) || '';

  // Extract tire size - try multiple possible column names
  const tireSize = findKey(rawOrder, ['タイヤサイズ', 'サイズ', 'タイヤ']) || '';

  let taskDetails = findKey(rawOrder, ['業務内容', 'taskDetails']) || customerName;
  if (scheduledTime) {
    // Optionally format time if needed, but raw string might be enough for detail view
    // taskDetails += `\n予定: ${scheduledTime}`; 
  }

  return {
    id: String(orderId || `ord-${Math.random()}`),
    rawOrderId: orderId ? String(orderId) : undefined,
    customerCode: String(findKey(rawOrder, ['ユーザーコード', 'usercode']) || ''),
    taskDetails: taskDetails, // Simplified for initial view, detailed view can show more
    status: findKey(rawOrder, ['受注ステータス', 'status']) || '未割当',
    scheduledDate: formatDate(String(findKey(rawOrder, ['作業予定日']) || ''), 'yyyy-MM-dd'),
    scheduledTime: scheduledTime || '',
    estimatedDuration: !isNaN(duration) && duration > 0 ? duration : 60,
    value: parseFloat(findKey(rawOrder, ['金額']) || 0),
    staffName: findKey(rawOrder, ['担当', 'スタッフ名', 'staffName']) || '',
    mainStore: findKey(rawOrder, ['主管店舗', 'mainStore']) || '',
    customerName: customerName,
    address: findKey(rawOrder, ['住所', 'Address']) || '',
    scheduledEndTime: findKey(rawOrder, ['チップ配置作業完了予定', '終了時間', 'endTime', 'scheduledEndTime', '終了日時']) || '',
    actualStartTime: (() => {
      const val = findKey(rawOrder, ['作業開始時間', '開始時間', 'startTime', 'startedAt', 'actualStartTime']);
      return val ? new Date(val) : undefined;
    })(),
    actualEndTime: (() => {
      const val = findKey(rawOrder, ['作業完了時間', '作業終了時間', '終了時間', 'completionTime', 'completedAt', 'actualEndTime', 'finishedAt']);
      return val ? new Date(val) : undefined;
    })(),
    startTravelTime: (() => {
      const val = findKey(rawOrder, ['移動開始', 'startTravel']);
      return val ? new Date(val) : undefined;
    })(),
    arrivalTimestamp: (() => {
      const val = findKey(rawOrder, ['現場到着', 'arrive']);
      return val ? new Date(val) : undefined;
    })(),
    cancelDate: findKey(rawOrder, ['キャンセル日時', 'cancelDate']),
    cancelContact: findKey(rawOrder, ['キャンセル連絡者', 'cancelContact']),
    equipmentStatus: findKey(rawOrder, ['機材有無']) || '',
    tireSize: String(tireSize || ''),
    '本数': findKey(rawOrder, ['本数', 'honsu']) || '',
    serviceType: findKey(rawOrder, ['サービス種別', 'サービス区分']) || '',
    raw: rawOrder // Preserve raw data for context processing
  };
};

export function getContrastingTextColor(hexColor: string): string {
  if (!hexColor) return '#000000';

  let color = hexColor;
  if (color.startsWith('hsl')) {
    // Basic HSL to hex conversion - this is a simplification
    // and won't handle all cases, but is better than nothing.
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      let h = parseInt(match[1]);
      let s = parseInt(match[2]) / 100;
      let l = parseInt(match[3]) / 100;
      let c = (1 - Math.abs(2 * l - 1)) * s;
      let x = c * (1 - Math.abs((h / 60) % 2 - 1));
      let m = l - c / 2;
      let r = 0, g = 0, b = 0;
      if (0 <= h && h < 60) { r = c; g = x; b = 0; }
      else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
      else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
      else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
      else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
      else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

      const toHex = (c: number) => ('0' + Math.round((c + m) * 255).toString(16)).slice(-2);
      color = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } else {
      return '#000000';
    }
  }


  const cleanHex = color.startsWith('#') ? color.slice(1) : color;
  if (cleanHex.length !== 6) return '#000000';

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

  return (yiq >= 128) ? '#000000' : '#FFFFFF';
}

export function darkenColor(color: string, amount: number): string {
  let r = 0, g = 0, b = 0;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    }
  } else {
    return color;
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  l = Math.max(0, l * (1 - amount));

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

export function lightenColor(color: string, amount: number): string {
  let r = 0, g = 0, b = 0;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    }
  } else {
    return color;
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  // Lighten logic: Increase lightness towards 1.0
  l = Math.min(1, l + (1 - l) * amount);

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}
