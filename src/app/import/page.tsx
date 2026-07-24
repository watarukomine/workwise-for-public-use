'use client';

import React, { useState, useCallback, useRef } from 'react';
import { getGeocode, getLatLng } from 'use-places-autocomplete';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2, Upload, CheckCircle, AlertCircle, Database, FileSpreadsheet,
  Trash2, Eye, ArrowRight, UploadCloud, X, Download,
} from 'lucide-react';
import { initializeFirebase } from '@/firebase';
import { collection, doc, writeBatch, getDocs, query, limit } from 'firebase/firestore';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CustomerService } from '@/services/customer-service';


// --- CSV Parser ---
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++; // Skip the next quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip the \n in \r\n
        }
        row.push(cell.trim());
        if (row.length > 0 || cell !== '') {
          result.push(row);
        }
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
  }

  // Handle the last cell and row if not empty
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    result.push(row);
  }

  if (result.length === 0) return { headers: [], rows: [] };

  // Clean headers (remove newlines and excess whitespace)
  const headers = result[0].map(h => h.replace(/[\r\n]/g, '').replace(/\s+/g, ' '));
  const rows = result.slice(1);
  return { headers, rows };
}


// --- Collection Presets ---
const COLLECTION_PRESETS = [
  { value: 'orders', label: '受注データ', icon: '📦', description: 'orders コレクション' },
  { value: 'users', label: 'スタッフ', icon: '👤', description: 'users コレクション' },
  { value: 'customers', label: '販売店情報', icon: '🏪', description: 'customers コレクション' },
  { value: 'custom', label: 'カスタム', icon: '⚙️', description: '任意のコレクション名を指定' },
];

// --- Field Mappings for Auto-conversion ---
const FIELD_MAPPINGS: Record<string, string> = {
  // 受注データ（orders）用マッピング
  '受注 ID': 'displayId',
  '受注ID': 'displayId',
  'SystemID': 'id',
  'お取引先コード': 'customerCode',
  '顧客コード': 'customerCode',
  'お取引先名': 'customerName',
  '顧客名': 'customerName',
  '店舗名': 'customerName',
  '店舗': 'customerName',
  '主管店舗': 'mainStore',
  '作業内容': 'serviceType', // CSV 20列: 作業内容
  '作業': 'taskDetails',     // CSV 11列: 作業
  '詳細': 'taskDetails',
  '作業予定日': 'scheduledDate',
  '日付': 'scheduledDate',
  '予定日': 'scheduledDate',
  '予定時間': 'scheduledTime',
  '開始時間': 'scheduledTime',
  '開始': 'scheduledTime',
  '終了時間': 'scheduledEndTime',
  '終了': 'scheduledEndTime',
  '予定終了時間': 'scheduledEndTime',
  'ご担当者様': 'picName',
  '担当者名': 'picName',
  '担当': 'staffName', // CSV 27列: 担当
  'スタッフ名': 'staffName',
  '担当者': 'staffName',
  'スタッフ': 'staffName',
  'スタッフID': 'staffId',
  'スタッフコード': 'staffId',
  '注文番号': 'orderNo',
  '受注 No': 'orderNo', // CSV 0列: 受注 No
  '受注No': 'orderNo',
  '任意コメント': 'comment',
  '車名': 'carName',
  '登録ナンバー': 'regNo',
  '登録ナンバー(下４桁)': 'regNo',
  '受注ステータス': 'status', // CSV 26列: 受注ステータス
  '入庫状況': 'entryStatus', // CSV 16列: 入庫状況
  'タイヤ品番': 'tireNumber',
  'タイヤサイズ': 'tireSize',
  '品名': 'productName',
  '本数': 'quantity',
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

  // 顧客（販売店）マスタ用
  'ユーザーコード': 'userCode',
  '住所': 'address',
  '緯度': 'latitude',
  '経度': 'longitude',
  '母店': 'mainStore',

  // A〜AS列追加分
  'キャンセル日時': 'cancelDate',
  'キャンセル連絡者': 'cancelContact',
  '受注No(ﾘﾏｰｸ1 8ｹﾀ)': 'orderNoRemark',
  '任意コメント(ﾘﾏｰｸ2　10ｹﾀ)': 'comment',
  '最終更新日時': 'updatedAt',
  '最終位置情報（緯度,経度）': 'lastLocation',
  'チップ配置作業予定': 'chipWorkScheduled',
  'チップ配置作業完了予定': 'chipWorkCompleted',
  '出勤ボタン': 'clockIn',
  '既読確認': 'readConfirmation',
  '移動開始': 'startTravel',
  '現場到着': 'arrival',
  '作業開始': 'startWork',
  '作業完了': 'completeWork',
  '作業所要時間': 'workDuration',
  '退勤ボタン': 'clockOut',
  '緊急フラグ': 'isEmergency',
  '緊急連絡': 'emergencyMessage',
  '管理者返信': 'adminReply',
  '機材有無': 'equipmentStatus'
};




// --- Steps ---
type Step = 'upload' | 'preview' | 'importing' | 'done';

export default function ImportPage() {
  // State
  const [step, setStep] = useState<Step>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [targetCollection, setTargetCollection] = useState('orders');
  const [customCollection, setCustomCollection] = useState('');
  const [idColumn, setIdColumn] = useState<string>('__auto__');
  const [mergeMode, setMergeMode] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const router = useRouter();

  React.useEffect(() => {
    if (!isProfileLoading && !profile) router.push('/login');
  }, [isProfileLoading, profile, router]);

  const downloadCSVTemplate = (type: 'orders' | 'customers' | 'staff') => {
    let headers: string[] = [];
    let sampleRow: string[] = [];
    let filename = '';

    if (type === 'orders') {
      headers = [
        '受注ID', 'SystemID', '顧客コード', 'お取引先名', '主管店舗', '作業内容', 
        '作業予定日', '予定時間', 'ご担当者様', '注文番号', '任意コメント', 
        '車名', '登録ナンバー', '受注ステータス', 'タイヤ品番', 'タイヤサイズ', 
        '品名', '本数', '空気圧センサーパッキン交換', 'タイヤ手配状況', 
        '廃タイヤ処分', '連絡者名', '特記事項', 'フォーム入力者'
      ];
      sampleRow = [
        '1', '20260624_05155_abc', '05155', '津久井店', '相模原', '販売店店舗内作業',
        '2026/06/24', '10:00', '担当者名', '12345678', 'コメント',
        'プリウス', '湘南500あ1234', '入庫待ち', 'T1000', '195/65R15',
        'エコピア', '4', '無', '定期便で配送手配済',
        '回収有り：廃タイヤラベル在庫有り', '連絡者名', '特記事項など', 'フォーム入力者名'
      ];
      filename = '受注データ_テンプレート.csv';
    } else if (type === 'customers') {
      headers = ['ユーザーコード', '店舗', '住所', '電話番号', '機材有無', '母店'];
      sampleRow = ['05155', '津久井店', '相模原市緑区太井１４１', '042-784-XXXX', '○', '相模原'];
      filename = '販売店情報_テンプレート.csv';
    } else if (type === 'staff') {
      headers = ['name', 'email', 'role', 'area', '母店', 'color'];
      sampleRow = ['山田 太郎', 'yamada@example.com', 'staff', '県央', '厚木', '#EF4444'];
      filename = 'スタッフ登録_テンプレート.csv';
    }


    const csvContent = [headers, sampleRow].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // --- File Processing ---
  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.tsv') && !file.name.endsWith('.txt')) {
      alert('CSVファイル (.csv) を選択してください。');
      return;
    }
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Try Shift-JIS detection - if garbled, suggest UTF-8
      const { headers: h, rows: r } = parseCSV(text);
      if (h.length === 0) {
        alert('CSVファイルにデータがありません。');
        return;
      }
      setHeaders(h);
      setRows(r);
      // Auto-detect ID column
      const idCandidates = ['SystemID', 'systemId', 'id', 'ID', 'ユーザーコード', 'userCode', 'staffId', '受注ID', '受注 ID', '受注番号'];
      const found = idCandidates.find(c => h.includes(c));
      setIdColumn(found || '__auto__');
      setStep('preview');
    };
    // Try reading as UTF-8 first
    reader.readAsText(file, 'UTF-8');
  }, []);

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

  // --- Drag & Drop ---
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  // --- Import ---
  const handleImport = async () => {
    const collName = targetCollection === 'custom' ? customCollection : targetCollection;
    if (!collName) { alert('コレクション名を入力してください。'); return; }

    setStep('importing');
    setLogs([]);
    setImportResult(null);

    addLog(`🚀 インポート開始: ${rows.length} 件 → ${collName}`);
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
          // Build document from row
          const docData: Record<string, any> = {};
          const raw: Record<string, any> = {};

          headers.forEach((h, idx) => {
            const val = row[idx] || '';
            raw[h] = val; // Store original raw data

            // Apply mapping
            let mappedField = FIELD_MAPPINGS[h] || h;
            if (collName === 'orders' && mappedField === 'userCode') {
              mappedField = 'customerCode';
            }
            if (collName === 'customers' && mappedField === 'customerCode') {
              mappedField = 'userCode';
            }
            
            // Try to convert numbers for specific fields or if it looks like a number
            if (val !== '' && !isNaN(Number(val)) && val.length < 15 && !['scheduledTime', 'scheduledEndTime', 'scheduledDate', 'staffId', 'userCode', 'customerCode'].includes(mappedField)) {
              docData[mappedField] = Number(val);
            } else {
              docData[mappedField] = val;
            }
          });

          // Post-processing for normalization
          if (collName === 'orders') {
            // Normalize Date: yyyy-MM-dd or yyyy/MM/dd -> yyyy/MM/dd
            if (docData.scheduledDate) {
              docData.scheduledDate = docData.scheduledDate.replace(/-/g, '/');
            }
            // Ensure type
            if (!docData._type) {
              docData._type = docData.customerCode ? 'order' : 'task';
            }
            // If it's a generic shift, ensure taskDetails is set
            if (docData._type === 'task' && !docData.taskDetails && docData.customerName) {
               docData.taskDetails = docData.customerName;
            }

            // Auto-resolve customer details from master using customerCode
            const userCode = docData.customerCode || '';
            const currentName = docData.customerName || '';
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


          docData.raw = raw;
          docData._importedAt = new Date().toISOString();
          docData._source = `csv-import:${csvFile?.name || 'unknown'}`;

          try {
            let docRef;
            const idVal = idColumn !== '__auto__' ? docData[FIELD_MAPPINGS[idColumn] || idColumn] : null;
            
            if (idVal) {
              docRef = doc(firestore, collName, String(idVal));
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

  // --- Reset ---
  const handleReset = () => {
    setCsvFile(null); setHeaders([]); setRows([]); setStep('upload');
    setImportResult(null); setLogs([]); setImportProgress({ current: 0, total: 0 });
  };

  // --- Auth Guard ---
  if (isProfileLoading || !profile) {
    return <div className="flex items-center justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (profile.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto mt-20">
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>権限がありません</AlertTitle>
          <AlertDescription>この機能は管理者のみ使用できます。</AlertDescription></Alert>
      </div>
    );
  }

  const collName = targetCollection === 'custom' ? customCollection : targetCollection;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 pb-20">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Database className="h-6 w-6" />
          データインポート
        </h1>
        <p className="text-muted-foreground">
          CSVファイルからFirestoreデータベースにデータをインポートします。スプレッドシートからCSVとしてダウンロードしたファイルをアップロードしてください。
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { key: 'upload', label: '1. ファイル選択' },
          { key: 'preview', label: '2. プレビュー・設定' },
          { key: 'importing', label: '3. インポート実行' },
          { key: 'done', label: '4. 完了' },
        ].map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            <Badge
              variant={step === s.key ? 'default' : 'outline'}
              className={cn("text-xs", step === s.key ? '' : 'text-muted-foreground')}
            >
              {s.label}
            </Badge>
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />CSVファイルをアップロード</CardTitle>
            <CardDescription>スプレッドシートから「ファイル → ダウンロード → カンマ区切り(.csv)」でダウンロードしたファイルを使用してください。</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200",
                isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className={cn("h-12 w-12 mx-auto mb-4 transition-colors", isDragging ? "text-primary" : "text-muted-foreground/50")} />
              <p className="text-lg font-medium mb-1">ここにCSVファイルをドラッグ＆ドロップ</p>
              <p className="text-sm text-muted-foreground mb-4">または クリックしてファイルを選択</p>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> ファイルを選択
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                aria-label="CSVファイルを選択"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
              />
            </div>

            <div className="mt-4 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">💡 CSVの準備方法:</p>
              <ol className="list-decimal list-inside space-y-0.5 ml-2">
                <li>Googleスプレッドシートを開く</li>
                <li>「ファイル」→「ダウンロード」→「カンマ区切り形式(.csv)」を選択</li>
                <li>ダウンロードされたCSVファイルをここにドロップ</li>
              </ol>
              <p className="mt-2">※ 1行目がヘッダー（列名）として扱われます。UTF-8 / Shift-JIS 両対応。</p>
            </div>

            <div className="mt-6 border-t pt-4">
              <p className="text-xs font-semibold mb-2 text-muted-foreground flex items-center gap-1">📥 インポート用CSVテンプレートのダウンロード</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={(e) => { e.stopPropagation(); downloadCSVTemplate('customers'); }}>
                  <Download className="h-3.5 w-3.5" /> 販売店情報テンプレート
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={(e) => { e.stopPropagation(); downloadCSVTemplate('staff'); }}>
                  <Download className="h-3.5 w-3.5" /> スタッフ登録テンプレート
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={(e) => { e.stopPropagation(); downloadCSVTemplate('orders'); }}>
                  <Download className="h-3.5 w-3.5" /> 受注データテンプレート
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />データプレビュー</CardTitle>
                  <CardDescription className="mt-1">
                    <span className="font-medium">{csvFile?.name}</span> — {headers.length} カラム × {rows.length} 行
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-muted-foreground">
                  <X className="h-3.5 w-3.5" /> やり直す
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Encoding fix */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-muted-foreground">文字化けの場合:</span>
                <Button variant="outline" size="sm" onClick={rereadAsShiftJIS} className="text-xs h-7">Shift-JISとして再読み込み</Button>
              </div>

              {/* Preview table */}
              <ScrollArea className="h-[300px] rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[40px] text-xs">#</TableHead>
                      {headers.map((h, i) => (
                        <TableHead key={i} className="text-xs font-semibold whitespace-nowrap px-2">
                          {h}
                          {idColumn === h && <Badge variant="default" className="ml-1 text-[10px] px-1">ID</Badge>}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((row, ri) => (
                      <TableRow key={ri}>
                        <TableCell className="text-xs text-muted-foreground">{ri + 1}</TableCell>
                        {headers.map((_, ci) => (
                          <TableCell key={ci} className="text-xs py-1 px-2 max-w-[200px] truncate" title={row[ci]}>
                            {row[ci] || <span className="text-muted-foreground/30">−</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {rows.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  ※ プレビューは最初の50行のみ表示。全 {rows.length} 行がインポートされます。
                </p>
              )}
            </CardContent>
          </Card>

          {/* Import Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">インポート設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Target Collection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">インポート先コレクション</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COLLECTION_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => setTargetCollection(preset.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-all",
                        targetCollection === preset.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <span className="text-lg">{preset.icon}</span>
                      <span className="font-medium">{preset.label}</span>
                      <span className="text-[10px] text-muted-foreground">{preset.description}</span>
                    </button>
                  ))}
                </div>
                {targetCollection === 'custom' && (
                  <input
                    type="text"
                    value={customCollection}
                    onChange={(e) => setCustomCollection(e.target.value)}
                    placeholder="コレクション名を入力..."
                    className="mt-2 w-full px-3 py-2 text-sm border rounded-md"
                  />
                )}
              </div>

              {/* ID Column */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">ドキュメントIDに使用するカラム</Label>
                <Select value={idColumn} onValueChange={setIdColumn}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">🔄 自動生成（Firestore任意ID）</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>📌 {h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  ※ 同じIDのドキュメントが既にある場合、データが上書き/マージされます。<strong>（販売店情報をCSVで一括更新したい場合は、IDに「ユーザーコード」または「userCode」を指定し、下記のマージモードをオンにしてください）</strong>
                </p>
              </div>

              {/* Merge Mode */}
              <div className="flex items-center gap-3">
                <Switch id="merge-mode" checked={mergeMode} onCheckedChange={setMergeMode} />
                <Label htmlFor="merge-mode" className="text-sm">
                  マージモード（既存データを保持して追加分だけ更新）
                </Label>
              </div>

              {/* Import Button */}
              <div className="pt-2">
                <Button onClick={handleImport} size="lg" className="w-full gap-2" disabled={!collName}>
                  <Upload className="h-4 w-4" />
                  {rows.length} 件を「{collName || '...'}」にインポート
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 3: Importing */}
      {step === 'importing' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />インポート実行中...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{importProgress.current} / {importProgress.total} 件</span>
                <span>{importProgress.total > 0 ? Math.round(importProgress.current / importProgress.total * 100) : 0}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 dynamic-width"
                  style={{ '--dynamic-width': `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` } as React.CSSProperties}
                />
              </div>
            </div>
            {logs.length > 0 && (
              <div className="bg-muted/50 rounded-md p-3 max-h-[200px] overflow-auto font-mono text-xs space-y-0.5">
                {logs.map((log, i) => (
                  <div key={i} className={log.includes('❌') ? 'text-destructive' : log.includes('✅') || log.includes('✨') ? 'text-green-600' : 'text-muted-foreground'}>
                    {log}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Done */}
      {step === 'done' && importResult && (
        <>
          <Alert className={importResult.failed === 0 ? 'border-green-500/50 bg-green-50 dark:bg-green-900/10' : ''}>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700 dark:text-green-400">インポート完了</AlertTitle>
            <AlertDescription>
              <div className="space-y-1 mt-1">
                <p><strong>{importResult.success}</strong> 件が「{collName}」コレクションにインポートされました。</p>
                {importResult.failed > 0 && <p className="text-destructive">{importResult.failed} 件が失敗しました。</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  ファイル: {csvFile?.name} | カラム: {headers.length} | 総行数: {rows.length}
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {importResult.errors.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm text-destructive">エラー詳細</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-[150px] overflow-auto text-xs font-mono text-destructive space-y-0.5">
                  {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              </CardContent>
            </Card>
          )}

          {logs.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">実行ログ</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-md p-3 max-h-[200px] overflow-auto font-mono text-xs space-y-0.5">
                  {logs.map((log, i) => (
                    <div key={i} className={log.includes('❌') ? 'text-destructive' : log.includes('✅') || log.includes('✨') ? 'text-green-600' : 'text-muted-foreground'}>
                      {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button onClick={handleReset} variant="outline" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> 別のファイルをインポート
            </Button>
            <Button onClick={() => {
              if (collName === 'orders') router.push('/orders');
              else if (collName === 'users') router.push('/staff');
              else if (collName === 'customers') router.push('/customers');
              else router.push('/dashboard');
            }} className="gap-1.5">
              <Eye className="h-3.5 w-3.5" /> データを確認する
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
