/**
 * アプリケーション全体で使用される設定値を管理します。
 * GASのURLなど、環境によって変更される可能性のある値を一元管理します。
 */

// 注: これらのURLはサンプルです。実際のGASのデプロイURLやシートのURLに置き換えてください。

// -----------------------------------------------------------------------------
// GAS (Google Apps Script) API Configuration
// -----------------------------------------------------------------------------
// Note: These URLs point to the deployed Web App URL of your GAS project.
// Ensure your GAS project is deployed with "Execute as: Me" and "Who has access: Anyone".

// -----------------------------------------------------------------------------
// GAS (Google Apps Script) API Configuration
// -----------------------------------------------------------------------------
// Note: These URLs point to the deployed Web App URL of your GAS project.
// Ensure your GAS project is deployed with "Execute as: Me" and "Who has access: Anyone".

// Staff Data Script (Unified)
export const STAFF_GAS_URL = process.env.NEXT_PUBLIC_STAFF_GAS_URL || 'https://script.google.com/macros/s/AKfycbwYhwK50z_vFldzSxVuTA31vTZhyOPzZ43iFzqJApNf7j79Dbx5TyB9-tSgRlAjuLTc/exec';

// Customer Data Script (Unified)
export const CUSTOMER_GAS_URL = process.env.NEXT_PUBLIC_CUSTOMER_GAS_URL || 'https://script.google.com/macros/s/AKfycbwYhwK50z_vFldzSxVuTA31vTZhyOPzZ43iFzqJApNf7j79Dbx5TyB9-tSgRlAjuLTc/exec';

// Order & Task Management Script (Unified)
export const ORDER_GAS_URL = process.env.NEXT_PUBLIC_ORDER_GAS_URL || 'https://script.google.com/macros/s/AKfycbwYhwK50z_vFldzSxVuTA31vTZhyOPzZ43iFzqJApNf7j79Dbx5TyB9-tSgRlAjuLTc/exec';


// --- スプレッドシート本体のURL ---

/**
 * スタッフ情報が記載されているスプレッドシートのURL。
 * staff/page.tsx のヘッダークリックで開かれます。
 */
export const STAFF_SHEET_URL = process.env.NEXT_PUBLIC_STAFF_SHEET_URL || 'https://docs.google.com/spreadsheets/d/1IP9wxp-VsctyXVn5UI3oRWeik4gMrFA5DFxt-40HGOk/edit?usp=sharing';

/**
 * 販売店情報が記載されているスプレッドシートのURL。
 * customers/page.tsx のヘッダークリックで開かれます。
 */
export const CUSTOMER_SHEET_URL = process.env.NEXT_PUBLIC_CUSTOMER_SHEET_URL || 'https://docs.google.com/spreadsheets/d/1IZ2VwJ1AT5NvEkUoU0tL6OJXXI3hfDVQ8_773HZwUJI/edit?usp=sharing';

/**
 * 受注情報が記載されているスプレッドシートのURL。
 * orders/page.tsx のヘッダークリックで開かれます。
 */
export const ORDER_SHEET_URL = process.env.NEXT_PUBLIC_ORDER_SHEET_URL || 'https://docs.google.com/spreadsheets/d/17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s/edit?usp=sharing';

/**
 * 【移行期間用】旧スプレッドシート版の受注情報スプレッドシートURL。
 */
export const OLD_ORDER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s/edit?usp=sharing';
export const OLD_ORDER_SPREADSHEET_ID = '17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s';


// --- その他設定 ---

/**
 * スプレッドシートでステータスを管理している列のヘッダー名。
 */
export const STATUS_COLUMN_NAME = '受注ステータス';
