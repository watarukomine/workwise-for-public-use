
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isValid, format, parseISO } from 'date-fns';
import type { Order, WithId, Staff } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Helper function to find a value from an object with multiple possible keys.
 * It checks keys in a case-insensitive and trim-safe manner.
 * @param item The object to search within.
 * @param possibleKeys An array of possible keys to look for.
 * @returns The value of the first key found, or undefined if no key is found.
 */
export const findKey = (item: any, possibleKeys: string[]) => {
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
    const duration = parseInt(findKey(rawOrder, ['作業時間（分）', '作業時間(分)', '作業時間']), 10);
    const scheduledTime = findKey(rawOrder, ['予定時間', 'チップ配置作業予定']);
    
    const customerName = findKey(rawOrder, ['お取引先名', '店舗', '取引先']) || '';
    const tireSize = findKey(rawOrder, ['タイヤサイズ', 'サイズ']) || '';
    const unitCount = findKey(rawOrder, ['本数']) || '';
    
    const equipmentStatus = findKey(rawOrder, ['機材有無']) || '';
    let equipmentMark = '(×)';
    if (equipmentStatus === '〇') {
        equipmentMark = '(〇)';
    } else if (equipmentStatus === '△') {
        equipmentMark = '(△)';
    }
    
    const line1 = `${customerName}${equipmentMark}${scheduledTime ? `：${formatTime(scheduledTime)}` : ''}`;
    const line2 = `${tireSize}${unitCount ? ` / ${unitCount}本` : ''}`;

    let taskDetails = line1;
    if (line2.trim() && line2.trim() !== '/') {
        taskDetails += `\n${line2.trim()}`;
    }
    
    const idKeys = ['受注 ID', '受注id', '受注ID', 'id'];
    const orderId = findKey(rawOrder, idKeys);

    return {
        id: String(orderId || `ord-${Math.random()}`),
        customerCode: String(findKey(rawOrder, ['ユーザーコード', 'usercode']) || ''),
        taskDetails: taskDetails.trim(),
        estimatedDuration: !isNaN(duration) && duration > 0 ? duration : 60,
        raw: rawOrder,
        rawOrderId: String(orderId || '')
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
        let m = l - c/2;
        let r=0,g=0,b=0;
        if (0 <= h && h < 60) { [r,g,b] = [c,x,0]; } 
        else if (60 <= h && h < 120) { [r,g,b] = [x,c,0]; }
        else if (120 <= h && h < 180) { [r,g,b] = [0,c,x]; }
        else if (180 <= h && h < 240) { [r,g,b] = [0,x,c]; }
        else if (240 <= h && h < 300) { [r,g,b] = [x,0,c]; }
        else if (300 <= h && h < 360) { [r,g,b] = [c,0,x]; }
        
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
