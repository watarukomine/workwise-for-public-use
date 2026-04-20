#!/usr/bin/env node

/**
 * 既存のスプレッドシートへのヘッダー設定スクリプト
 */

import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';

// --- Spreadsheet IDs from user ---
const SPREADSHEETS = {
  '受注管理': '1A3rbqD87QenOoHx3EYNpnqBujN5TrT2Xn_3tUTCiqmY',
  '販売店情報': '1IZ2VwJ1AT5NvEkUoU0tL6OJXXI3hfDVQ8_773HZwUJI',
  'スタッフマスタ': '1IP9wxp-VsctyXVn5UI3oRWeik4gMrFA5DFxt-40HGOk',
  '行動予定': '1IP9wxp-VsctyXVn5UI3oRWeik4gMrFA5DFxt-40HGOk'
};

// --- Headers Definitions ---
const HEADERS = {
  '受注管理': [
    '受注ID', 'SystemID', '顧客コード', 'お取引先名', '主管店舗', 
    '作業予定日', '予定時間', 'ご担当者様', '担当', '受注ステータス', 
    'タイヤ品番', 'タイヤサイズ', '品名', '本数', '空気圧センサー', 
    'タイヤ手配状況', '廃タイヤ処分', '車名', '登録ナンバー', 
    '連絡者名', '任意コメント', '特記事項', '緊急フラグ', 
    '管理者返信', '既読確認', '最終更新日時'
  ],
  'スタッフマスタ': [
    'ID', 'name', 'email', 'role', 'department', 'controller', 'isActive', 'displayName', 'color', 'avatarUrl', '自己紹介'
  ],
  '販売店情報': [
    '顧客コード', '店舗名', '住所', '電話番号', '緯度', '経度', '営業時間', '担当者名', '備考'
  ],
  '行動予定': [
    'ID', 'スタッフ名', '業務内容', '詳細', '開始日時', '終了日時', '作成日時'
  ]
};

async function setup() {
  console.log('🚀 指定されたスプレッドシートへのセットアップを開始します...');

  const __dirname = decodeURIComponent(new URL('.', import.meta.url).pathname);
  const serviceAccountPath = join(__dirname, '..', 'service-account.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    for (const [title, spreadsheetId] of Object.entries(SPREADSHEETS)) {
      console.log(`   シート「${title}」を設定中 (ID: ${spreadsheetId})...`);

      // Verify if sheet exists, if not create it (only for the multi-sheet file)
      const ss = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetExists = ss.data.sheets.some(s => s.properties.title === title);

      if (!sheetExists) {
        console.log(`      - シート「${title}」が存在しないため作成します...`);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [{ addSheet: { properties: { title } } }]
          }
        });
      }

      // Update headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${title}!A1`,
        valueInputOption: 'RAW',
        resource: { values: [HEADERS[title]] }
      });
      
      console.log(`      ✅ 「${title}」のヘッダーを設定しました。`);
    }

    console.log('\n✨ 全てのシートの構成が完了しました！');
    console.log('--------------------------------------------------');
    console.log('以下の ID を gas_full_code.js の冒頭に貼り付けてください：');
    console.log(`const ORDER_SPREADSHEET_ID = "${SPREADSHEETS['受注管理']}";`);
    console.log(`const STAFF_SPREADSHEET_ID = "${SPREADSHEETS['スタッフマスタ']}";`);
    console.log(`const CUSTOMER_SPREADSHEET_ID = "${SPREADSHEETS['販売店情報']}";`);
    console.log('--------------------------------------------------');

  } catch (err) {
    console.error('❌ エラーが発生しました:', err.message);
  }
}

setup();
