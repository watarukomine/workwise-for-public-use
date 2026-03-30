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

// Staff Data Script
export const STAFF_GAS_URL = 'https://script.google.com/macros/s/AKfycbxN0xxsMnhJeiy5uWWZIYB8d1E3s6UFTd1b57UttH-o1i-e0EQmRbYzC0SbJqnLJd5a/exec';

// Customer Data Script
export const CUSTOMER_GAS_URL = 'https://script.google.com/macros/s/AKfycbxN0xxsMnhJeiy5uWWZIYB8d1E3s6UFTd1b57UttH-o1i-e0EQmRbYzC0SbJqnLJd5a/exec';

// Order & Task Management Script (Unified)
export const ORDER_GAS_URL = "https://script.google.com/macros/s/AKfycbxN0xxsMnhJeiy5uWWZIYB8d1E3s6UFTd1b57UttH-o1i-e0EQmRbYzC0SbJqnLJd5a/exec";


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
export const CUSTOMER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1jZdToM75DunESxVU07QjSCbYEsqd_nSwxzjr09a52CA/edit?usp=sharing';

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
