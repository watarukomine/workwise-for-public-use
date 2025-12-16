/**
 * アプリケーション全体で使用される設定値を管理します。
 * GASのURLなど、環境によって変更される可能性のある値を一元管理します。
 */

// 注: これらのURLはサンプルです。実際のGASのデプロイURLやシートのURLに置き換えてください。

// --- データソース (Google Apps Script) ---

/**
 * スタッフマスターのデータを取得・更新するためのGoogle Apps ScriptのURL。
 * 主に staff-context.tsx や auth.ts で使用されます。
 */
export const STAFF_GAS_URL = 'https://script.google.com/macros/s/AKfycbxGeXICGCJIbu-EuaRINfiVp1UTEz3IO9A2bGP-monXgwIHIv7PRomaFaM-s10KppDWzA/exec';

/**
 * 顧客情報（販売店情報）を取得・更新するためのGoogle Apps ScriptのURL。
 * 主に customer-context.tsx で使用されます。
 */
export const CUSTOMER_GAS_URL = 'https://script.google.com/macros/s/AKfycbygUg4b1tD4Y489xg0Fz09e84DtDAy_35KhJ_VD4RyJ3J1DavI0B_aZP5ck8hssWPCi/exec';

/**
 * 受注情報を取得・更新し、カレンダー連携も行うGoogle Apps ScriptのURL。
 * 主に order-context.tsx や schedule-view.tsx で使用されます。
 */
export const ORDER_GAS_URL = 'https://script.google.com/macros/s/AKfycbw8OeWsfo_X7mtox8nJJ77JKTh7a72qS79Ed48xTd5kXo6GdVRliy53dL2kfBUL3HwQ/exec';


// --- スプレッドシート本体のURL ---

/**
 * スタッフ情報が記載されているスプレッドシートのURL。
 * staff/page.tsx のヘッダークリックで開かれます。
 */
export const STAFF_SHEET_URL = 'https://docs.google.com/spreadsheets/d/18vztZhnAqDmQtlCNMERncTsCSe_hfMQ7TvcF-5S6IIo/edit?usp=sharing';

/**
 * 販売店情報が記載されているスプレッドシートのURL。
 * customers/page.tsx のヘッダークリックで開かれます。
 */
export const CUSTOMER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1ojkHXVYFyomm-2RMbWq6QrG4NPCit2y6lxXQFsK_J60/edit?usp=sharing';

/**
 * 受注情報が記載されているスプレッドシートのURL。
 * orders/page.tsx のヘッダークリックで開かれます。
 */
export const ORDER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s/edit?usp=sharing';


// --- その他設定 ---

/**
 * スプレッドシートでステータスを管理している列のヘッダー名。
 */
export const STATUS_COLUMN_NAME = '受注ステータス';
