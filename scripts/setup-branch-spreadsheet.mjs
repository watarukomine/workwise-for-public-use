#!/usr/bin/env node

/**
 * 拠点展開用スプレッドシート自動作成スクリプト
 * 
 * 使い方: node scripts/setup-branch-spreadsheet.mjs [拠点名]
 */

import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';

// --- Configuration ---
const branchName = process.argv[2] || 'Master_Template';
const adminEmails = [
  'watarukomine@gmail.com',
  'kanagawa.toyota.parts@gmail.com'
];

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

// --- Main Process ---
async function setup() {
  console.log(`🚀 拠点「${branchName}」用のスプレッドシート作成を開始します...`);

  // Load service account
  const __dirname = decodeURIComponent(new URL('.', import.meta.url).pathname);
  const serviceAccountPath = join(__dirname, '..', 'service-account.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  try {
    // 1. Create Spreadsheet
    console.log('   スプレッドシートを新規作成中...');
    const spreadsheet = await sheets.spreadsheets.create({
      resource: {
        properties: { title: `WorkWise_Backup_Master_${branchName}` }
      },
      fields: 'spreadsheetId,properties/title'
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    console.log(`   ✅ 作成完了 (ID: ${spreadsheetId})`);

    // 2. Share with Admins
    console.log('   管理者に権限を付与中...');
    for (const email of adminEmails) {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: {
          type: 'user',
          role: 'writer', // Editor
          emailAddress: email
        }
      });
      console.log(`      - ${email} に共有しました`);
    }

    // 3. Setup Sheets and Headers
    console.log('   シートの構成を設定中...');
    
    // Default sheet is 'Sheet1' (index 0). Rename it to '受注管理'.
    const initialSheets = (await sheets.spreadsheets.get({ spreadsheetId })).data.sheets;
    const firstSheetId = initialSheets[0].properties.sheetId;

    const requests = [
      // Rename first sheet
      {
        updateSheetProperties: {
          properties: { sheetId: firstSheetId, title: '受注管理' },
          fields: 'title'
        }
      }
    ];

    // Add other sheets
    const otherSheets = ['スタッフマスタ', '販売店情報', '行動予定'];
    for (const title of otherSheets) {
      requests.push({
        addSheet: { properties: { title } }
      });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    // Write Headers to each sheet
    for (const [title, headers] of Object.entries(HEADERS)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${title}!A1`,
        valueInputOption: 'RAW',
        resource: { values: [headers] }
      });
      console.log(`      - シート「${title}」のヘッダーを設定しました`);
    }

    console.log('\n✨ 全てのセットアップが完了しました！');
    console.log('--------------------------------------------------');
    console.log(`【スプレッドシート名】: ${spreadsheet.data.properties.title}`);
    console.log(`【Spreadsheet ID】: ${spreadsheetId}`);
    console.log(`【URL】: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
    console.log('--------------------------------------------------');
    console.log('\n※ 次にこのスプレッドシートの「拡張機能」>「Apps Script」を開き、');
    console.log('   最新の gas_full_code.js を貼り付けてデプロイしてください。');

  } catch (err) {
    console.error('❌ エラーが発生しました:', err.message);
    if (err.message.includes('API has not been used')) {
      console.log('\n⚠️ Google Sheets API または Drive API が有効になっていない可能性があります。');
      console.log('   Google Cloud Console で以下のURLから有効化してください：');
      console.log('   https://console.cloud.google.com/apis/library/sheets.googleapis.com');
      console.log('   https://console.cloud.google.com/apis/library/drive.googleapis.com');
    }
  }
}

setup();
