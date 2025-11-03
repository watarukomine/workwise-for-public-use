
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isValid, format, parseISO } from 'date-fns';
import type { Order, WithId } from './types';

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
    return "Invalid time";
  }
  return format(d, 'HH:mm');
};

export const mapRawToOrder = (rawOrder: any): WithId<Order> => {
    const duration = parseInt(findKey(rawOrder, ['作業時間（分）', '作業時間(分)', '作業時間']), 10);
    const scheduledTime = findKey(rawOrder, ['予定時間']);
    
    const line1 = `${findKey(rawOrder, ['お取引先名', '店舗', '取引先']) || ''}${scheduledTime ? `：${formatTime(scheduledTime)}` : ''}`;
    
    const line2 = `${findKey(rawOrder, ['タイヤサイズ', 'サイズ']) || ''}${findKey(rawOrder, ['本数']) ? ` / ${findKey(rawOrder, ['本数'])}本` : ''}`;

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

    