
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isValid, format, parseISO } from 'date-fns';
import type { Order, WithId, Staff } from './types';
import { logMissingField, logInvalidDate, logOldDateDetected, validationLogger } from './order-validation-logger';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a date string to 'yyyy-MM-dd' format.
 * Handles ISO strings, slash-separated dates, and various formats from GAS/Firestore.
 * Uses string parsing first to avoid timezone issues with new Date().
 */
export const normalizeDateStr = (dStr: any): string => {
  if (!dStr) return '';
  try {
    if (dStr instanceof Date) {
      if (!isNaN(dStr.getTime())) {
        const y = dStr.getFullYear();
        const m = String(dStr.getMonth() + 1).padStart(2, '0');
        const day = String(dStr.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return '';
    }

    // Handle Firestore Timestamp objects ({ seconds } or { _seconds })
    if (typeof dStr === 'object') {
      const sec = dStr.seconds !== undefined ? dStr.seconds : dStr._seconds;
      if (typeof sec === 'number') {
        const d = new Date(sec * 1000);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        }
      }
    }

    let s = String(dStr).trim();

    // Fast path: already in yyyy-MM-dd format
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // Remove Japanese date characters: 2026年07月28日 -> 2026-07-28
    s = s.replace(/年|\/|月/g, '-').replace(/日/g, '').trim();

    // Handle space or T split (e.g., "2026-07-28 14:20:00" or "2026-07-28T15:00:00.000Z")
    const cleanDatePart = s.split(/[ T]/)[0];
    const parts = cleanDatePart.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    const d = new Date(dStr);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (e) {}
  return String(dStr).replace(/\//g, '-').trim();
};

export function findKey(item: any, possibleKeys: string[]) {
  if (!item || typeof item !== 'object') {
    return undefined;
  }

  // Helper to normalize keys: remove all whitespace (including full-width) and lowercase
  const normalize = (s: string) => s.replace(/[\s\u3000]+/g, '').toLowerCase();

  for (const key of possibleKeys) {
    const normKey = normalize(key);
    for (const itemKey in item) {
      if (normalize(itemKey) === normKey) {
        return item[itemKey];
      }
    }
  }
  return undefined;
}

export const formatDate = (dateString: string | undefined | null, formatString: string = 'yyyy/MM/dd'): string => {
  if (!dateString) return '';
  const str = String(dateString).trim();
  if (!str || str === 'null' || str === 'undefined' || str === 'N/A') return '';

  try {
    // Fast path: already YYYY/MM/DD or YYYY-MM-DD
    if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(str)) {
      const parts = str.split(/[\/\-]/);
      return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
    }

    let date = parseISO(str);
    if (!isValid(date)) {
      date = new Date(str);
    }

    if (isValid(date)) {
      if (date.getFullYear() <= 1970) return '';
      const formatted = format(date, formatString);
      if (!formatted.includes('NaN')) {
        return formatted;
      }
    }
  } catch (e) {}

  return str.includes('NaN') ? '' : str.replace(/-/g, '/');
};

export const formatTime = (date: Date | string | any) => {
  if (!date) return '';

  // Handle Firestore Timestamp object
  if (date && typeof date === 'object' && 'seconds' in date) {
    date = new Date(date.seconds * 1000);
  }

  // Handle cases like "1899-12-29T15:00:00.000Z" which come from Sheets for time-only values
  if (typeof date === 'string' && date.startsWith('1899-12-')) {
    const d = parseISO(date);
    if (isValid(d)) {
      return format(d, 'HH:mm');
    }
  }

  let d = date;
  if (typeof date === 'string') {
    // Try to normalize slash dates to ISO format
    const normalizedStr = date.replace(/\//g, '-').replace(' ', 'T');
    d = parseISO(normalizedStr);
    if (!isValid(d)) {
      d = new Date(date);
    }
  }

  if (!d || !isValid(d) || isNaN(d.getTime())) {
    if (typeof date === 'string') {
      const today = new Date();
      const timePart = date.includes(' ') ? date.split(' ')[1] : date;
      const [hours, minutes] = timePart.split(':');
      if (hours && minutes) {
        today.setHours(parseInt(hours, 10), parseInt(minutes, 10));
        if (isValid(today)) {
          return format(today, 'HH:mm');
        }
      }
    }
    return "";
  }
  // Ignore 1970 bugs completely, return empty string so it doesn't prefill 09:00
  if (d.getFullYear() <= 1970) return '';
  return format(d, 'HH:mm');
};

export const mapRawToOrder = (rawOrder: any, fallbackId?: string): WithId<Order> => {
  // Try to find the robust System ID first (B column), checking both root and raw object
  const sysId = findKey(rawOrder, ['SystemID', 'systemId', 'sysId']) || 
                (rawOrder?.raw ? findKey(rawOrder.raw, ['SystemID', 'systemId', 'sysId']) : undefined);
  // Find the visual ID / Row Number (A column: 受注行番号 / 受注 No)
  const visualId = findKey(rawOrder, ['受注行番号', '通し番号', '受注 No', '受注 ID', '受注id', '受注ID', 'displayId']) ||
                   (rawOrder?.raw ? findKey(rawOrder.raw, ['受注行番号', '通し番号', '受注 No', '受注 ID', '受注id', '受注ID', 'displayId']) : undefined);

  // Generate a deterministic ID based on content if System/Visual IDs are missing
  // This is crucial for "Accompanying" (同行) tasks to have stable IDs across refreshes, preventing "resurrection" after deletion
  let contentId = '';
  if (!sysId && !visualId) {
    const cDate = findKey(rawOrder, ['作業予定日', 'date']);
    const cTime = findKey(rawOrder, ['予定時間', 'expectedTime', 'scheduledTime']);
    const cStaff = findKey(rawOrder, ['担当者', 'staffName', 'staff']);
    const cContent = findKey(rawOrder, ['業務内容', 'taskDetails', 'title']);

    if (cDate && cStaff && cContent) {
      // Normalize components to ensure stability across format variations
      const normDate = formatDate(String(cDate), 'yyyy-MM-dd');
      const normTime = cTime ? formatTime(cTime) : '';
      const normStaff = String(cStaff).trim();
      const normContent = String(cContent).trim();

      // Simple hash-like string: gen-DATE-TIME-STAFF-CONTENT (sanitized)
      const rawStr = `${normDate}-${normTime}-${normStaff}-${normContent}`;
      // Create a simple mostly-unique hash code
      let hash = 0;
      for (let i = 0; i < rawStr.length; i++) {
        const char = rawStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      contentId = `gen-${Math.abs(hash).toString(36)}`;
    }
  }

  // If SystemID exists, use it. Otherwise fallback to visualId, then contentId, then fallbackId/random
  const orderId = sysId ? String(sysId) : (visualId ? String(visualId) : (contentId || fallbackId || `ord-${Math.random()}`));

  const rawDurationVal = findKey(rawOrder, ['作業時間（分）', '作業時間(分)', '作業時間', '作業所要時間']);
  let duration = 60; // Default
  if (rawDurationVal) {
    const valStr = String(rawDurationVal);
    // Handle GAS Date object string for Duration (e.g. "1899-12-30T...")
    if (valStr.includes('1899')) {
      const date = new Date(valStr);
      if (!isNaN(date.getTime())) {
        duration = date.getHours() * 60 + date.getMinutes();
      }
    } else {
      const parsed = parseInt(valStr, 10);
      if (!isNaN(parsed) && parsed !== 1899) {
        duration = parsed;
      }
    }
  }
  let scheduledTime = findKey(rawOrder, ['チップ配置作業予定', '予定時間', 'scheduledTime', '開始日時', '開始時間', '開始', 'シフト開始', '出勤時間', '勤務開始', '業務開始時間', '勤務開始時間']);

  const customerName = findKey(rawOrder, ['店舗名', 'お取引先名', '店舗名称', '店舗', '取引先']) || '';

  // Extract tire size - try multiple possible column names
  const tireSize = findKey(rawOrder, ['タイヤサイズ', 'サイズ', 'タイヤ']) || '';

  let taskDetails = findKey(rawOrder, ['業務内容', '作業内容', '詳細', 'taskDetails']) || customerName;
  if (scheduledTime) {
    // Optionally format time if needed, but raw string might be enough for detail view
    // taskDetails += `\n予定: ${scheduledTime}`; 
  }
  let scheduledDateVal = formatDate(String(findKey(rawOrder, ['作業予定日', '日付', '予定日', 'date', 'scheduledDate', 'シフト日', '勤務日', '出勤日']) || ''), 'yyyy-MM-dd');

  // Log if scheduled date is missing
  if (!scheduledDateVal && scheduledTime) {
    logMissingField(String(orderId), customerName || '不明', '作業予定日', 'utils');
  }

  // Improved: Combine F column (date) with G column (time)
  // CRITICAL FIX: Always use date from scheduledDateVal if available. 
  // Ignore date component in scheduledTime (G column) because it might be wrong (e.g. 1899, or next day).
  if (scheduledTime) {
    const timeStr = String(scheduledTime);

    if (scheduledDateVal) {
      // Try to extract time components
      let hours = '00';
      let minutes = '00';
      let seconds = '00';
      let foundTime = false;

      // Case 1: HH:mm format
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
        const parts = timeStr.split(':');
        hours = parts[0].padStart(2, '0');
        minutes = parts[1].padStart(2, '0');
        seconds = (parts[2] || '00').padStart(2, '0');
        foundTime = true;
      }
      // Case 2: Date object / ISO string (handle standard JS Date str or ISO)
      else {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
          hours = String(d.getHours()).padStart(2, '0');
          minutes = String(d.getMinutes()).padStart(2, '0');
          seconds = String(d.getSeconds()).padStart(2, '0');
          foundTime = true;
        }
      }

      if (foundTime) {
        scheduledTime = `${scheduledDateVal}T${hours}:${minutes}:${seconds}`;
      }
    }
  }

  // Fallback: If no explicit date column, try to extract date from scheduledTime if it contains a full date
  if (!scheduledDateVal && scheduledTime) {
    const timeStr = String(scheduledTime);
    if (timeStr.includes('/') || timeStr.includes('-')) {
      try {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
          scheduledDateVal = format(d, 'yyyy-MM-dd');
        }
      } catch (e) { }
    }
  }

  // Helper to parse date/time values which might be just time strings
  const parseDateTimeValue = (val: any): Date | undefined => {
    if (!val) return undefined;

    // Handle Date objects (GAS/Sheets often return Date objects)
    if (val instanceof Date) {
      if (!isNaN(val.getTime())) {
        // If year is >= 1970, it's likely a real timestamp
        if (val.getFullYear() >= 1970) return val;

        // If year is < 1970 (e.g. 1899/1900), it's likely a time-only cell
        // Combine with scheduledDateVal if available
        if (scheduledDateVal) {
          const base = new Date(scheduledDateVal);
          base.setHours(val.getHours(), val.getMinutes(), val.getSeconds(), 0);
          return base;
        }
        return val; // Fallback
      }
    }

    const date = new Date(val);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1970) {
      return date;
    }

    // Try parsing as Time string (HH:mm) combined with scheduled date
    const valStr = String(val).trim();
    if (valStr.match(/^\d{1,2}:\d{2}/) && scheduledDateVal) {
      const [h, m] = valStr.split(':');
      const d = new Date(scheduledDateVal);
      d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
    return undefined;
  };

  // FIX: Also normalize scheduledEndTime to use the correct date
  let scheduledEndTime = findKey(rawOrder, ['チップ配置作業完了予定', '終了時間', 'endTime', 'scheduledEndTime', '終了日時', 'シフト終了', '退勤時間', '勤務終了', '業務終了時間', '勤務終了時間']);
  if (scheduledEndTime && scheduledDateVal) {
    const timeStr = String(scheduledEndTime);
    let hours = '00';
    let minutes = '00';
    let seconds = '00';
    let foundTime = false;

    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
      const parts = timeStr.split(':');
      hours = parts[0].padStart(2, '0');
      minutes = parts[1].padStart(2, '0');
      seconds = (parts[2] || '00').padStart(2, '0');
      foundTime = true;
    } else {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        hours = String(d.getHours()).padStart(2, '0');
        minutes = String(d.getMinutes()).padStart(2, '0');
        seconds = String(d.getSeconds()).padStart(2, '0');
        foundTime = true;
      }
    }

    if (foundTime) {
      scheduledEndTime = `${scheduledDateVal}T${hours}:${minutes}:${seconds}`;
    }
  }

  return {
    id: String(orderId),
    displayId: visualId ? String(visualId) : undefined,
    rawOrderId: (sysId || visualId) ? String(sysId || visualId) : undefined,
    customerCode: String(
      findKey(rawOrder, ['customerCode', 'userCode', 'ユーザーコード', 'usercode', '顧客コード']) ||
      (rawOrder.raw ? findKey(rawOrder.raw, ['customerCode', 'userCode', 'ユーザーコード', 'usercode', '顧客コード']) : undefined) ||
      '00000'
    ),
    taskDetails: findKey(rawOrder, ['作業内容', '業務内容', 'taskDetails', 'Description', '作業', '作業内容・商品詳細', '内容']) || '',
    status: (() => {
      const raw = findKey(rawOrder, ['受注ステータス', 'status']) || '未割当';
      if (['お客まち', '点検', 'お預かり済', '点検待ち', '洗車待ち'].some(s => raw.includes(s))) {
        return '未着手';
      }
      return raw;
    })(),
    scheduledDate: scheduledDateVal,
    scheduledTime: scheduledTime || '',
    _type: findKey(rawOrder, ['_type', 'type']) || (findKey(rawOrder, ['ユーザーコード', 'customerCode', 'お取引先コード']) ? 'order' : 'task'),
    estimatedDuration: !isNaN(duration) && duration > 0 ? duration : 60,
    value: parseFloat(findKey(rawOrder, ['金額', '売上', 'price', 'value']) || 0),
    staffName: findKey(rawOrder, ['担当', 'スタッフ名', 'staffName', '氏名', '担当者', 'スタッフ', '名前', '担当者名', '社員名', '配置担当', 'staff']) || '',
    staffId: findKey(rawOrder, ['スタッフID', 'スタッフコード', 'staffId', '担当者ID', '担当ID', '社員ID', '社員コード', 'staff_id']) || '',
    mainStore: findKey(rawOrder, ['主管店舗', 'mainStore', '主管']) || '',
    customerName: findKey(rawOrder, ['店舗名', 'お取引先名', '店舗名称', '店舗', '名称', 'お名前', 'Customer', 'storeName']) || '（店舗名未設定）',
    address: findKey(rawOrder, ['住所', 'Address', '納品先', 'お届け先', '納品先住所', 'お届け先住所', '現場住所']) || '',
    scheduledEndTime: scheduledEndTime || '',
    actualStartTime: (() => {
      const val = findKey(rawOrder, ['作業開始', '作業開始時間', '開始時間', 'startTime', 'startedAt', 'actualStartTime', 'startWork']);
      return parseDateTimeValue(val);
    })(),
    actualEndTime: (() => {
      const val = findKey(rawOrder, ['作業完了', '作業完了時間', '作業終了時間', '終了時間', 'completionTime', 'completedAt', 'actualEndTime', 'finishedAt', 'completeWork']);
      return parseDateTimeValue(val);
    })(),
    startTravelTime: (() => {
      const val = findKey(rawOrder, ['移動開始', '移動開始時間', '移動開始日時', 'startTravel', 'startTravelTime']);
      return parseDateTimeValue(val);
    })(),
    arrivalTimestamp: (() => {
      const val = findKey(rawOrder, ['現場到着', '現場到着時間', '現場到着日時', 'arrive', 'arrival', 'arrivalTimestamp']);
      return parseDateTimeValue(val);
    })(),
    cancelDate: findKey(rawOrder, ['キャンセル日時', 'cancelDate']),
    cancelContact: findKey(rawOrder, ['キャンセル連絡者', 'cancelContact']),
    equipmentStatus: findKey(rawOrder, ['機材有無', 'equipmentStatus']) || '',
    tireNumber: String(findKey(rawOrder, ['タイヤ品番', '品番', 'tireNumber']) || ''),
    tireSize: String(findKey(rawOrder, ['タイヤサイズ', 'サイズ', 'Size', 'タイヤ名/サイズ', 'tireSize']) || ''),
    carName: String(findKey(rawOrder, ['車名', 'vehicleName', '車種', '車両', '車輌', '登録車名', 'carName']) || ''),
    regNo: String(findKey(rawOrder, ['登録ナンバー(下４桁)', 'regNo', '登録ナンバー', 'ナンバー', '車番', '登録番号']) || ''),
    comment: String(findKey(rawOrder, ['任意コメント(ﾘﾏｰｸ2　10ｹﾀ)', '任意コメント', 'コメント', '備考', 'comment']) || ''),
    specialNotes: String(findKey(rawOrder, ['特記事項', 'specialNotes', '連絡事項']) || ''),
    description: findKey(rawOrder, ['作業内容', '業務内容', 'taskDetails', 'Description', '作業', '作業内容・商品詳細', '内容']) || '',
    quantity: findKey(rawOrder, ['本数', 'honsu', '数量', 'Qty', 'Quantity', '本', 'quantity']) || '',
    serviceType: findKey(rawOrder, ['作業内容', '作業区分', 'サービス種別', 'サービス区分', 'serviceType']) || '',
    orderNo: String(findKey(rawOrder, ['受注No(ﾘﾏｰｸ1 8ｹﾀ)', '受注No(リマーク1 8ケタ)', '受注No(リマーク1)', 'orderNoRemark', 'orderNo']) || rawOrder.orderNo || rawOrder.orderNoRemark || ''),
    picName: findKey(rawOrder, ['ご担当者様', 'picName', '担当者名']) || '',
    orderNoRemark: String(findKey(rawOrder, ['受注No(ﾘﾏｰｸ1 8ｹﾀ)', '受注No(リマーク1 8ケタ)', '受注No(リマーク1)', 'orderNoRemark', 'orderNo']) || rawOrder.orderNoRemark || rawOrder.orderNo || ''),
    entryStatus: findKey(rawOrder, ['入庫状況', 'entryStatus']) || '',
    productName: findKey(rawOrder, ['品名', 'productName']) || '',
    sensor: findKey(rawOrder, ['空気圧センサーパッキン交換', 'sensor']) || '',
    arrangement: findKey(rawOrder, ['タイヤ手配状況', 'arrangement']) || '',
    disposal: findKey(rawOrder, ['廃タイヤ処分', 'disposal']) || '',
    contact: findKey(rawOrder, ['連絡先', 'contact']) || '',
    lastLocation: findKey(rawOrder, ['最終位置情報（緯度,経度）', 'lastLocation']) || '',
    chipWorkScheduled: findKey(rawOrder, ['チップ配置作業予定', 'chipWorkScheduled']) || '',
    chipWorkCompleted: findKey(rawOrder, ['チップ配置作業完了予定', 'chipWorkCompleted']) || '',
    clockIn: findKey(rawOrder, ['出勤ボタン', 'clockIn']) || '',
    readConfirmation: findKey(rawOrder, ['既読確認', 'readConfirmation']) || '',
    workDuration: findKey(rawOrder, ['作業所要時間', 'workDuration']) || '',
    clockOut: findKey(rawOrder, ['退勤ボタン', 'clockOut']) || '',
    travelTime: (() => {
      const val = findKey(rawOrder, ['移動時間（分）', '移動時間', 'travelTime']);
      return val ? parseInt(String(val), 10) : undefined;
    })(),
    travelDistance: findKey(rawOrder, ['移動距離', 'travelDistance']),
    emergencyMessage: findKey(rawOrder, ['緊急連絡']) || '',
    adminReply: findKey(rawOrder, ['管理者返信']) || '',
    isConfirmed: !!(findKey(rawOrder, ['既読確認', '既読', 'confirmedAt', 'readAt'])),
    confirmedAt: String(findKey(rawOrder, ['既読確認', '既読', 'confirmedAt', 'readAt']) || ''),
    raw: rawOrder, // Preserve raw data for context processing
    // Validation metadata - check if this order has any logged issues
    hasValidationIssues: (() => {
      const logs = validationLogger.getLogsForOrder(String(orderId));
      return logs.some(log => log.severity === 'error' || log.severity === 'warning');
    })(),
    validationWarnings: (() => {
      const logs = validationLogger.getLogsForOrder(String(orderId));
      return logs
        .filter(log => log.severity === 'error' || log.severity === 'warning')
        .map(log => log.reason);
    })(),
    isEmergency: (() => {
      // 1. Check the dedicated '緊急フラグ' column (Boolean or text "TRUE")
      const flagVal = findKey(rawOrder, ['緊急フラグ']);
      if (flagVal === true || String(flagVal).toLowerCase() === 'true') return true;

      // 2. Fallback for older data: check '緊急連絡' for tags
      const msg = findKey(rawOrder, ['緊急連絡']) || '';
      return String(msg).includes('【緊急】');
    })(),
    submitter: findKey(rawOrder, ['フォーム入力者']) || '',
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

// Default Office / Base Location (e.g. Headquarters / Main Store in Kanagawa)
export const DEFAULT_OFFICE_LOCATION = {
  name: '自拠点（事務所）',
  latitude: 35.4437,
  longitude: 139.6380
};

/**
 * Asynchronously fetches real-time driving travel time in minutes via Google Maps Distance Matrix API.
 * Fallbacks to refined Haversine distance if API fails or coordinates missing.
 */
export async function fetchRealtimeTravelMinutes(
  originLat: number | null | undefined,
  originLng: number | null | undefined,
  destLat: number | null | undefined,
  destLng: number | null | undefined
): Promise<number> {
  if (!originLat || !originLng || !destLat || !destLng) {
    return 30;
  }

  try {
    const res = await fetch(`/api/distance-matrix?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`);
    if (res.ok) {
      const data = await res.json();
      if (data.durationMinutes && typeof data.durationMinutes === 'number') {
        console.log(`[Google Maps Distance Matrix] Real-time duration: ${data.durationMinutes} mins (${data.durationText})`);
        return data.durationMinutes;
      }
    }
  } catch (err) {
    console.warn("Distance Matrix API fetch failed, falling back to refined estimate:", err);
  }

  return calculateTravelTimeMinutes(originLat, originLng, destLat, destLng);
}

/**
 * Calculates estimated driving travel time in minutes between two lat/lng coordinates.
 * Refined fallback with 1.45 winding factor and 20km/h urban speed.
 */
export function calculateTravelTimeMinutes(
  originLat: number | null | undefined,
  originLng: number | null | undefined,
  destLat: number | null | undefined,
  destLng: number | null | undefined
): number {
  if (!originLat || !originLng || !destLat || !destLng) {
    return 30; // Default estimate 30 min if coordinates are unknown
  }

  const R = 6371; // Earth radius in km
  const dLat = (destLat - originLat) * (Math.PI / 180);
  const dLng = (destLng - originLng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(originLat * (Math.PI / 180)) *
      Math.cos(destLat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistanceKm = R * c;

  // Road distance estimation: straight distance * 1.45 (winding factor)
  const roadDistanceKm = straightDistanceKm * 1.45;

  // Real-world urban driving speed considering traffic & lights: 20 km/h
  const travelHours = roadDistanceKm / 20;
  const travelMinutes = Math.max(5, Math.round(travelHours * 60)); // Minimum 5 min

  return travelMinutes;
}
