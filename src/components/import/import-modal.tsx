'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, Play, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { initializeFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { format, parseISO, isValid } from 'date-fns';
import { CustomerService } from '@/services/customer-service';

// Dialog Import from ui
import {
  Dialog as ShadcnDialog,
  DialogContent as ShadcnDialogContent,
  DialogHeader as ShadcnDialogHeader,
  DialogTitle as ShadcnDialogTitle,
  DialogTrigger as ShadcnDialogTrigger,
  DialogDescription as ShadcnDialogDescription,
} from '@/components/ui/dialog';

interface ImportModalProps {
  targetCollection: 'users' | 'orders' | 'customers';
  trigger: React.ReactNode;
}

// Field Mappings matching target/master database
const FIELD_MAPPINGS: Record<string, string> = {
  '受注 ID': 'displayId',
  '受注ID': 'displayId',
  '受注No': 'orderNo',
  '受注 No': 'orderNo',
  '注文番号': 'orderNo',
  '受注No\r\n(ﾘﾏｰｸ1 8ｹﾀ)': 'orderNo',
  '受注No(ﾘﾏｰｸ1 8ｹﾀ)': 'orderNo',
  'SystemID': 'id',
  'systemId': 'id',
  'お取引先コード': 'customerCode',
  '顧客コード': 'customerCode',
  'ユーザーコード': 'customerCode',
  'お取引先名': 'customerName',
  '顧客名': 'customerName',
  '店舗名': 'customerName',
  '店舗': 'customerName',
  '主管店舗': 'mainStore',
  '作業内容': 'serviceType',
  '作業': 'taskDetails',
  '詳細': 'taskDetails',
  '作業予定日': 'scheduledDate',
  '日付': 'scheduledDate',
  '予定日': 'scheduledDate',
  '予定時間': 'scheduledTime',
  '開始時間': 'scheduledTime',
  '開始': 'scheduledTime',
  '終了時間': 'scheduledEndTime',
  '予定終了時間': 'scheduledEndTime',
  '終了': 'scheduledEndTime',
  'ご担当者様': 'picName',
  '担当者名': 'picName',
  '作業担当': 'staffName',
  '担当スタッフ': 'staffName',
  '担当': 'staffName',
  'スタッフ名': 'staffName',
  '担当者': 'staffName',
  'スタッフ': 'staffName',
  'スタッフID': 'staffId',
  'スタッフコード': 'staffId',
  '車名': 'carName',
  '登録番号': 'regNo',
  '登録ナンバー': 'regNo',
  '登録ナンバー(下４桁)': 'regNo',
  'ナンバー': 'regNo',
  'ステータス': 'status',
  '受注ステータス': 'status',
  '入庫状況': 'entryStatus',
  'タイヤ品番': 'productName',
  'タイヤサイズ': 'tireSize',
  'サイズ': 'tireSize',
  '品名': 'productName',
  '本数': 'quantity',
  '任意コメント\n(ﾘﾏｰｸ2　10ｹﾀ)': 'comment',
  '任意コメント(ﾘﾏｰｸ2　10ｹﾀ)': 'comment',
  '任意コメント': 'comment',
  'コメント': 'comment',
  '空気圧センサーパッキン交換': 'sensor',
  'タイヤ手配状況': 'arrangement',
  '手配': 'arrangement',
  '廃タイヤ処分': 'disposal',
  '廃タイヤ': 'disposal',
  '連絡先': 'contact',
  '連絡者名': 'contact',
  '連絡者': 'contact',
  '特記事項': 'specialNotes',
  'フォーム入力者': 'submitter',
  '住所': 'address',
  '緯度': 'latitude',
  '経度': 'longitude',
  '母店': 'mainStore',
  '氏名': 'name',
  '名前': 'name',
  'メール': 'email',
  'メールアドレス': 'email',
  'ロール': 'role',
  '役職': 'role',
  '権限': 'role',
  '職種': 'role',
  'エリア': 'area',
  '拠点': 'area',
  'コントローラー': 'controller',
  'キャンセル日時': 'cancelDate',
  'キャンセル連絡者': 'cancelContact',
  '最終更新日時': 'updatedAt',
  '最終位置情報（緯度,経度）': 'lastLocation',
  'チップ配置作業予定': 'chipWorkScheduled',
  'チップ配置作業完了予定': 'chipWorkCompleted',
  '出勤ボタン': 'clockIn',
};

// Simple date normalizer
function normalizeDateStr(dateStr: any): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim().replace(/-/g, '/');
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) return clean;
  
  try {
    const parsed = parseISO(clean);
    if (isValid(parsed)) return format(parsed, 'yyyy/MM/dd');
  } catch (e) {}
  
  return clean;
}

// CSV Parser
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n');
  const result: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row: string[] = [];
    let inQuotes = false;
    let currentToken = '';

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentToken.trim());
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    row.push(currentToken.trim());
    result.push(row);
  }

  if (result.length === 0) return { headers: [], rows: [] };
  const headers = result[0].map(h => h.replace(/^"|"$/g, '').trim());
  const rows = result.slice(1).map(r => r.map(cell => cell.replace(/^"|"$/g, '').trim()));
  return { headers, rows };
}

// Address Geocoding Mock/Service lookup (using global window google)
async function getGeocode(args: { address: string }): Promise<any> {
  const google = (window as any).google;
  if (!google || !google.maps || !google.maps.Geocoder) {
    throw new Error('Google Maps API is not loaded');
  }
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode(args, (results: any, status: any) => {
      if (status === 'OK' && results && results[0]) {
        resolve(results);
      } else {
        reject(new Error(`Geocode failed: ${status}`));
      }
    });
  });
}

async function getLatLng(result: any): Promise<{ lat: number; lng: number }> {
  const lat = result.geometry.location.lat();
  const lng = result.geometry.location.lng();
  return { lat, lng };
}

export function ImportModal({ targetCollection, trigger }: ImportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [idColumn, setIdColumn] = useState<string>('__auto__');
  const [mergeMode, setMergeMode] = useState<boolean>(true);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [logs, setLogs] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const collLabel = targetCollection === 'users' ? 'スタッフ' : targetCollection === 'customers' ? '販売店情報' : '受注データ';

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.tsv') && !file.name.endsWith('.txt')) {
      alert('CSVファイル (.csv) を選択してください。');
      return;
    }
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      if (h.length === 0) {
        alert('CSVファイルにデータがありません。');
        return;
      }
      setHeaders(h);
      setRows(r);

      // Auto-detect ID column based on target mapping
      let idCandidates = ['SystemID', 'systemId', 'id', 'ID'];
      if (targetCollection === 'users') {
        idCandidates = ['スタッフID', 'スタッフコード', 'id', 'ID', 'SystemID'];
      } else if (targetCollection === 'customers') {
        idCandidates = ['ユーザーコード', 'userCode', '顧客コード', 'お取引先コード', 'id'];
      } else if (targetCollection === 'orders') {
        idCandidates = ['SystemID', 'systemId', '受注ID', '受注 ID', '受注番号', 'id'];
      }

      const found = idCandidates.find(c => h.includes(c));
      setIdColumn(found || '__auto__');
      setStep('preview');
    };
    reader.readAsText(file, 'UTF-8');
  }, [targetCollection]);

  const rereadAsShiftJIS = useCallback(() => {
    if (!csvFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      setHeaders(h);
      setRows(r);
    };
    reader.readAsText(csvFile, 'Shift_JIS');
  }, [csvFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleImport = async () => {
    const collName = targetCollection;
    setStep('importing');
    setLogs([]);
    setImportResult(null);

    addLog(`🚀 インポート開始: ${rows.length} 件 → ${collLabel}`);
    addLog(`📋 フィールド: [${headers.join(', ')}]`);
    addLog(`🔑 IDカラム: ${idColumn === '__auto__' ? '自動生成' : idColumn}`);

    const { firestore } = initializeFirebase();
    const BATCH_SIZE = 450;
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Load customer master data if target is orders
    let customerMaster: any[] = [];
    if (collName === 'orders') {
      try {
        customerMaster = await CustomerService.getAllCustomers();
        addLog(`ℹ️ 顧客マスタから ${customerMaster.length} 件の販売店情報をロードしました。`);
      } catch (err: any) {
        console.warn("Failed to fetch customer master for auto-resolving names:", err);
      }
    }

    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const slice = rows.slice(i, i + BATCH_SIZE);

        for (const row of slice) {
          // Skip empty rows (all columns are empty)
          const isRowEmpty = row.every(val => !val || String(val).trim() === '');
          if (isRowEmpty) {
            continue;
          }

          // Build document from row
          const docData: Record<string, any> = {};
          const raw: Record<string, any> = {};

          headers.forEach((h, idx) => {
            const val = row[idx] || '';
            raw[h] = val; // Store original raw data

            let mappedField = FIELD_MAPPINGS[h] || h;
            if (collName === 'users' && h === '母店') {
              mappedField = '母店';
            }
            if (collName === 'orders' && mappedField === 'userCode') {
              mappedField = 'customerCode';
            }
            if (collName === 'customers' && mappedField === 'customerCode') {
              mappedField = 'userCode';
            }
            
            if (val !== '' && !isNaN(Number(val)) && val.length < 15 && !['scheduledTime', 'scheduledEndTime', 'scheduledDate', 'staffId', 'userCode', 'customerCode'].includes(mappedField)) {
              docData[mappedField] = Number(val);
            } else {
              docData[mappedField] = val;
            }
          });

          // Normalizations
          if (collName === 'orders') {
            if (!docData.id) {
              const idVal = raw['SystemID'] || raw['systemId'] || raw['ID'] || raw['id'] || docData.displayId;
              if (idVal) docData.id = idVal;
            }
            if (!docData.scheduledDate) {
              const dateVal = raw['作業予定日'] || raw['予定日'] || raw['日付'] || raw['scheduledDate'] || raw['作業日'];
              if (dateVal) docData.scheduledDate = String(dateVal).replace(/-/g, '/');
            }
            if (!docData.customerCode && !docData.userCode) {
              const codeVal = raw['お取引先コード'] || raw['顧客コード'] || raw['ユーザーコード'] || raw['customerCode'] || raw['userCode'];
              if (codeVal) docData.customerCode = String(codeVal).trim().padStart(5, '0');
            }
            if (!docData.customerName && !docData.storeName) {
              const nameVal = raw['お取引先名'] || raw['顧客名'] || raw['店舗名'] || raw['店舗'] || raw['customerName'] || raw['storeName'];
              if (nameVal) docData.customerName = nameVal;
            }
            if (!docData.scheduledTime) {
              const timeVal = raw['予定時間'] || raw['開始時間'] || raw['時間'] || raw['scheduledTime'];
              if (timeVal) docData.scheduledTime = timeVal;
            }

            if (docData.scheduledDate) {
              docData.scheduledDate = String(docData.scheduledDate).replace(/-/g, '/');
            }
            if (!docData._type) {
              docData._type = docData.customerCode ? 'order' : 'task';
            }
            if (docData._type === 'task' && !docData.taskDetails && docData.customerName) {
               docData.taskDetails = docData.customerName;
            }

            const userCode = docData.customerCode || docData.userCode || '';
            const currentName = docData.customerName || docData.storeName || '';
            if (userCode !== '') {
              const paddedCode = String(userCode).trim().padStart(5, '0');
              docData.customerCode = paddedCode;

              if (currentName === '' || currentName === '（店舗名未設定）' || currentName === '(店舗名未設定)' || currentName === '店舗名未設定') {
                const match = customerMaster.find(c => {
                  const cCode = c.userCode || c['ユーザーコード'] || '';
                  return String(cCode).trim().padStart(5, '0') === paddedCode;
                });
                if (match) {
                  const storeName = match.storeName || match['店舗'] || match.name || '';
                  if (storeName) {
                    docData.customerName = storeName;
                    raw['店舗名'] = storeName;
                    raw['お取引先名'] = storeName;
                  }
                  const mainStore = match.mainStore || match['母店'] || '';
                  if (mainStore && !docData.mainStore) {
                    docData.mainStore = mainStore;
                    raw['主管店舗'] = mainStore;
                  }
                  const address = match.address || match['住所'] || '';
                  if (address && !docData.address) {
                    docData.address = address;
                    raw['住所'] = address;
                  }
                }
              }
            }
          }

          if (collName === 'customers') {
            const address = docData.address || '';
            const latVal = docData.latitude;
            const lngVal = docData.longitude;
            const hasCoords = latVal && lngVal && !isNaN(Number(latVal)) && !isNaN(Number(lngVal)) && Number(latVal) !== 0 && Number(lngVal) !== 0;

            if (address && !hasCoords) {
              try {
                addLog(`🔍 店舗「${docData.storeName || '名称未設定'}」の住所「${address}」から座標を取得中...`);
                const results = await getGeocode({ address });
                const { lat, lng } = await getLatLng(results[0]);
                docData.latitude = lat;
                docData.longitude = lng;
                addLog(`✅ 座標取得成功: ${lat}, ${lng}`);
              } catch (err) {
                console.error(`Failed to geocode address: ${address}`, err);
                addLog(`⚠️ 住所「${address}」からの座標取得に失敗しました。座標なしで登録します。`);
              }
            }
          }

          if (collName === 'users') {
            const rawRoleStr = String(docData.role || raw['ロール'] || raw['役職'] || raw['権限'] || raw['職種'] || '').toLowerCase().trim();
            const staffName = String(docData.name || raw['氏名'] || raw['名前'] || raw['スタッフ名'] || '').trim();

            const isDualRole = (rawRoleStr.includes('admin') && rawRoleStr.includes('staff')) ||
                               (rawRoleStr.includes('管理者') && rawRoleStr.includes('スタッフ')) ||
                               rawRoleStr.includes('兼任') ||
                               rawRoleStr.includes('admin\\staff') ||
                               rawRoleStr.includes('admin/staff') ||
                               staffName.includes('杉山和彦');

            if (isDualRole) {
              docData.role = 'admin/staff';
            } else if (rawRoleStr.includes('admin') || rawRoleStr.includes('管理者')) {
              docData.role = 'admin';
            } else if (rawRoleStr.includes('controller') || rawRoleStr.includes('コントローラー')) {
              docData.role = 'controller';
            } else if (rawRoleStr.includes('staff') || rawRoleStr.includes('スタッフ')) {
              docData.role = 'staff';
            } else if (!docData.role) {
              docData.role = 'staff';
            }

            if (!docData.name && staffName) {
              docData.name = staffName;
            }

            // Normalizations for staff fields
            if (!docData.password) {
              const pwdVal = raw['パスワード'] || raw['password'];
              if (pwdVal) docData.password = String(pwdVal).trim();
            }
            if (!docData.email) {
              const emailVal = raw['メールアドレス'] || raw['メール'] || raw['email'];
              if (emailVal) docData.email = String(emailVal).trim();
            }

            const ctrlVal = String(raw['コントローラー'] || raw['controller'] || '').trim();
            docData.controller = ctrlVal === '⚪︎' || ctrlVal === '○' || ctrlVal === '1' || ctrlVal.toLowerCase() === 'true';

            const idVal = raw['スタッフID'] || raw['スタッフID'] || raw['id'] || raw['ID'] || docData.staffId || docData.id;
            if (idVal) {
              docData.id = String(idVal).trim();
            }
          }

          docData.raw = raw;
          docData._importedAt = new Date().toISOString();
          docData._source = `csv-import:${csvFile?.name || 'unknown'}`;

          try {
            let docRef;
            const finalIdVal = idColumn !== '__auto__' ? docData[FIELD_MAPPINGS[idColumn] || idColumn] : null;
            
            if (finalIdVal) {
              docRef = doc(firestore, collName, String(finalIdVal));
            } else {
              docRef = doc(collection(firestore, collName));
            }

            if (mergeMode) {
              batch.set(docRef, docData, { merge: true });
            } else {
              batch.set(docRef, docData);
            }
            success++;
          } catch (e: any) {
            errors.push(`行 ${i + rows.indexOf(row) + 2}: ${e.message}`);
            failed++;
          }
        }

        await batch.commit();
        setImportProgress({ current: Math.min(i + BATCH_SIZE, rows.length), total: rows.length });
        addLog(`✍️ バッチ ${Math.floor(i / BATCH_SIZE) + 1}: ${slice.length} 件書き込み完了`);
      }
    } catch (e: any) {
      addLog(`❌ バッチエラー: ${e.message}`);
      errors.push(e.message);
    }

    addLog(`✨ 完了: ${success} 件成功, ${failed} 件失敗`);
    setImportResult({ success, failed, errors });
    setStep('done');
  };

  const handleReset = () => {
    setCsvFile(null); setHeaders([]); setRows([]); setStep('upload');
    setImportResult(null); setLogs([]); setImportProgress({ current: 0, total: 0 });
  };

  return (
    <ShadcnDialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) handleReset(); }}>
      <ShadcnDialogTrigger asChild>
        {trigger}
      </ShadcnDialogTrigger>
      <ShadcnDialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 overflow-hidden bg-background">
        <ShadcnDialogHeader className="mb-2">
          <ShadcnDialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            {collLabel}のCSVインポート
          </ShadcnDialogTitle>
          <ShadcnDialogDescription>
            {collLabel}のCSVデータをデータベース（Firestore）に直接登録・一括マージします。
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {step === 'upload' && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById(`modal-csv-file-${targetCollection}`)?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center min-h-[300px] ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 bg-card hover:bg-accent/10'
              }`}
            >
              <Upload className="h-12 w-12 text-muted-foreground mb-4 animate-bounce" />
              <p className="text-lg font-semibold mb-1">ここにCSVファイルをドラッグ＆ドロップ</p>
              <p className="text-sm text-muted-foreground mb-6">またはクリックしてファイルを選択</p>
              
              <input
                id={`modal-csv-file-${targetCollection}`}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processFile(file);
                }}
              />
              
              <div className="text-xs text-muted-foreground/80 max-w-md bg-muted/50 p-3 rounded-lg border">
                ※ インポート先は自動的に「<strong>{collLabel}</strong>」に固定されます。誤インポートの心配はありません。
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="bg-accent/30 p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                  <p className="font-semibold flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    読み込み成功: <span className="text-primary font-bold">{csvFile?.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    列数: {headers.length} | 行数: {rows.length} 件 (プレビューは先頭5件)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={rereadAsShiftJIS} className="text-xs gap-1.5 h-8">
                    <RefreshCw className="h-3 w-3" /> Shift-JISで再読込 (文字化け時)
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs h-8">
                    クリア
                  </Button>
                </div>
              </div>

              {/* ID Selection & Merge Toggle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-card p-4 rounded-xl border">
                <div className="space-y-2">
                  <Label htmlFor="id-col-select" className="text-sm font-semibold">主キー (ドキュメントIDとして使用する列)</Label>
                  <select
                    id="id-col-select"
                    value={idColumn}
                    onChange={(e) => setIdColumn(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="__auto__">自動生成 (新しいランダムなIDで全追加)</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h} ({FIELD_MAPPINGS[h] || 'カスタムフィールド'})</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    指定した列の値がFirestoreのドキュメントIDになります。
                  </p>
                </div>

                <div className="flex flex-col justify-center space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-accent/20 border">
                    <div className="space-y-0.5">
                      <Label htmlFor="merge-switch" className="text-sm font-semibold cursor-pointer">既存データとマージ (上書き更新)</Label>
                      <p className="text-xs text-muted-foreground">同じIDのデータがある場合、指定列のみ上書きします。</p>
                    </div>
                    <Switch
                      id="merge-switch"
                      checked={mergeMode}
                      onCheckedChange={setMergeMode}
                    />
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="rounded-xl border overflow-hidden bg-card">
                <div className="bg-muted px-4 py-2 border-b text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>マッピングプレビュー</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">ヘッダー ➡ データベース</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-accent/10">
                        {headers.map((h, idx) => {
                          const dbField = FIELD_MAPPINGS[h] || h;
                          return (
                            <th key={idx} className="p-3 font-semibold border-r whitespace-nowrap">
                              <span className="text-muted-foreground block text-[10px] font-normal mb-0.5">{h}</span>
                              <span className="text-primary font-mono">{dbField}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx} className="border-b hover:bg-muted/30">
                          {headers.map((_, cIdx) => (
                            <td key={cIdx} className="p-3 border-r text-muted-foreground max-w-[200px] truncate">
                              {row[cIdx] || <span className="text-muted-foreground/30 italic">空</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleReset}>キャンセル</Button>
                <Button onClick={handleImport} className="gap-2">
                  <Play className="h-4 w-4" /> {rows.length} 件をインポート実行
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-4 py-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>書き込み処理中...</span>
                  <span>{importProgress.current} / {importProgress.total} 件</span>
                </div>
                <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-slate-950 text-slate-200 p-4 font-mono text-xs space-y-1">
                <p className="text-muted-foreground mb-2">=== 実行プロセスログ ===</p>
                <ScrollArea className="h-48">
                  {logs.map((log, idx) => (
                    <div key={idx} className="leading-5">
                      {log}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
          )}

          {step === 'done' && importResult && (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center justify-center text-center p-6 bg-accent/20 rounded-xl border">
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <h3 className="text-xl font-bold mb-1">インポート処理が完了しました</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  <strong>{importResult.success}</strong> 件のデータが「<strong>{collLabel}</strong>」コレクションに正常に書き込まれました。
                </p>
              </div>

              {importResult.failed > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-semibold text-sm">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    エラー発生: {importResult.failed} 件の書き込みに失敗
                  </div>
                  <ScrollArea className="h-32 rounded bg-black/5 p-2 font-mono text-xs text-red-700 dark:text-red-400">
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} className="py-0.5">{err}</div>
                    ))}
                  </ScrollArea>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={() => { setIsOpen(false); handleReset(); window.location.reload(); }} size="lg">
                  画面を更新して閉じる
                </Button>
              </div>
            </div>
          )}
        </div>
      </ShadcnDialogContent>
    </ShadcnDialog>
  );
}
