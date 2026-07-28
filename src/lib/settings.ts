/**
 * アプリケーション全体で使用される設定値を管理します。
 * GASのURLなど、環境によって変更される可能性のある値を一元管理します。
 */

// -----------------------------------------------------------------------------
// GAS (Google Apps Script) API Configuration
// -----------------------------------------------------------------------------
// Note: These URLs point to the deployed Web App URL of your GAS project.
// Ensure your GAS project is deployed with "Execute as: Me" and "Who has access: Anyone".

// Staff Data Script (Unified)
export const STAFF_GAS_URL = process.env.NEXT_PUBLIC_STAFF_GAS_URL || '';

// Customer Data Script (Unified)
export const CUSTOMER_GAS_URL = process.env.NEXT_PUBLIC_CUSTOMER_GAS_URL || '';

// Order & Task Management Script (Unified)
export const ORDER_GAS_URL = process.env.NEXT_PUBLIC_ORDER_GAS_URL || '';


// --- スプレッドシート本体のURL ---

/**
 * スタッフ情報が記載されているスプレッドシートのURL。
 */
export const STAFF_SHEET_URL = process.env.NEXT_PUBLIC_STAFF_SHEET_URL || '';

/**
 * 販売店情報が記載されているスプレッドシートのURL。
 */
export const CUSTOMER_SHEET_URL = process.env.NEXT_PUBLIC_CUSTOMER_SHEET_URL || '';

/**
 * 受注情報が記載されているスプレッドシートのURL。
 */
export const ORDER_SHEET_URL = process.env.NEXT_PUBLIC_ORDER_SHEET_URL || '';

/**
 * 【移行期間用】旧スプレッドシート版の受注情報スプレッドシートURL。
 */
export const OLD_ORDER_SHEET_URL = process.env.NEXT_PUBLIC_ORDER_SHEET_URL || '';
export const OLD_ORDER_SPREADSHEET_ID = process.env.NEXT_PUBLIC_OLD_ORDER_SPREADSHEET_ID || '17P4aHYXFdPUtWCrZY4G_LY_zcUYP9ClHNRVcMvj6c6s';


// --- その他設定 ---

/**
 * スプレッドシートでステータスを管理している列のヘッダー名。
 */
export const STATUS_COLUMN_NAME = '受注ステータス';
