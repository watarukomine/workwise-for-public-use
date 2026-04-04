
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, CheckCircle, AlertCircle, Database } from 'lucide-react';
import { initializeFirebase } from '@/firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useRouter } from 'next/navigation';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxtBAAbHfVaAA0GS48QOsVlzlCupeGHPNGlO5rLOsS4IHM49nNrJRnj7Pd6f0bPpOaK/exec';

interface SeedResult {
  collection: string;
  success: number;
  failed: number;
  error?: string;
}

// Collections config
const SEED_CONFIGS = [
  {
    name: 'スタッフ',
    action: 'getStaffList',
    firestoreCollection: 'users',
    idKeys: ['id', 'staffId', 'スタッフID'],
    responseKeys: ['staffList', 'data', 'result'],
  },
  {
    name: '販売店情報',
    action: 'getCustomerList',
    firestoreCollection: 'customers',
    idKeys: ['ユーザーコード', 'userCode', 'id'],
    responseKeys: ['customerList', 'data', 'result'],
  },
  {
    name: '受注データ',
    action: 'getOrderData',
    firestoreCollection: 'orders',
    idKeys: ['SystemID', 'systemId', '受注 ID', '受注ID', 'id'],
    responseKeys: ['orders', 'data', 'result'],
  },
];

function findId(record: any, keys: string[]): string | null {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return String(record[key]);
    }
  }
  return null;
}

function extractArray(data: any, keys: string[]): any[] {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (data[key] && Array.isArray(data[key])) return data[key];
  }
  // Try to find any array
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

function cleanRecord(record: any): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    cleaned[key] = value;
  }
  cleaned._importedAt = new Date().toISOString();
  cleaned._source = 'spreadsheet-seed';
  return cleaned;
}

export default function ImportPage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [results, setResults] = useState<SeedResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const router = useRouter();

  React.useEffect(() => {
    if (!isProfileLoading && !profile) router.push('/login');
  }, [isProfileLoading, profile, router]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const seedCollection = async (config: typeof SEED_CONFIGS[0]): Promise<SeedResult> => {
    setCurrentStep(`📡 ${config.name} をGASから取得中...`);
    addLog(`${config.name}: GASからデータ取得開始 (action=${config.action})`);

    try {
      // Fetch from GAS
      const url = `${GAS_URL}?action=${config.action}`;
      const response = await fetch(url, { redirect: 'follow' });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const records = extractArray(data, config.responseKeys);
      
      addLog(`${config.name}: ${records.length} 件のレコードを受信`);
      
      if (records.length === 0) {
        addLog(`${config.name}: データが空です。スキップ`);
        return { collection: config.name, success: 0, failed: 0, error: 'データが空です' };
      }

      // Show sample fields
      const sampleKeys = Object.keys(records[0]);
      addLog(`${config.name}: フィールド = [${sampleKeys.slice(0, 10).join(', ')}${sampleKeys.length > 10 ? '...' : ''}]`);

      // Write to Firestore using batched writes
      const { firestore } = initializeFirebase();
      const BATCH_SIZE = 450;
      let success = 0;
      let failed = 0;

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const slice = records.slice(i, i + BATCH_SIZE);
        
        setCurrentStep(`✍️ ${config.name}: ${i + 1}〜${Math.min(i + BATCH_SIZE, records.length)} / ${records.length} 件を書き込み中...`);

        for (const record of slice) {
          const docId = findId(record, config.idKeys);
          const cleaned = cleanRecord(record);
          
          try {
            if (docId) {
              const docRef = doc(firestore, config.firestoreCollection, docId);
              batch.set(docRef, cleaned, { merge: true });
            } else {
              // Auto-generate ID
              const colRef = collection(firestore, config.firestoreCollection);
              const docRef = doc(colRef);
              batch.set(docRef, cleaned);
            }
            success++;
          } catch (e: any) {
            addLog(`  ❌ エラー: ${e.message}`);
            failed++;
          }
        }
        
        await batch.commit();
        addLog(`${config.name}: バッチ ${Math.floor(i / BATCH_SIZE) + 1} (${slice.length}件) 書き込み完了`);
      }

      addLog(`${config.name}: ✅ 完了 (${success}件成功 / ${failed}件失敗)`);
      return { collection: config.name, success, failed };
    } catch (e: any) {
      addLog(`${config.name}: ❌ エラー: ${e.message}`);
      return { collection: config.name, success: 0, failed: 0, error: e.message };
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    setResults([]);
    setLogs([]);
    addLog('🚀 シード処理を開始します...');

    const allResults: SeedResult[] = [];

    for (const config of SEED_CONFIGS) {
      const result = await seedCollection(config);
      allResults.push(result);
      setResults([...allResults]);
    }

    setCurrentStep('');
    addLog('✨ すべてのシード処理が完了しました！');
    setIsSeeding(false);
  };

  if (isProfileLoading || !profile) {
    return <div className="flex items-center justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (profile.role !== 'admin') {
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>権限がありません</AlertTitle></Alert>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Database className="h-6 w-6" />
          スプレッドシート → Firestore インポート
        </h1>
        <p className="text-muted-foreground">
          GAS（Google Apps Script）経由でスプレッドシートのデータを取得し、Firestoreデータベースにインポートします。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>インポート対象</CardTitle>
          <CardDescription>以下の3つのコレクションにデータを投入します（既存データはマージされます）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {SEED_CONFIGS.map(config => {
              const result = results.find(r => r.collection === config.name);
              return (
                <div key={config.name} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <p className="font-medium text-sm">{config.name}</p>
                    <p className="text-xs text-muted-foreground">→ {config.firestoreCollection}</p>
                  </div>
                  {result ? (
                    result.error ? (
                      <span className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{result.error}</span>
                    ) : (
                      <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />{result.success} 件</span>
                    )
                  ) : isSeeding && currentStep.includes(config.name) ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
              );
            })}
          </div>

          <Button onClick={handleSeed} disabled={isSeeding} size="lg" className="w-full gap-2">
            {isSeeding ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{currentStep}</>
            ) : (
              <><Upload className="h-4 w-4" />スプレッドシートデータをインポート</>
            )}
          </Button>
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">実行ログ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-md p-3 max-h-[300px] overflow-auto font-mono text-xs space-y-0.5">
              {logs.map((log, i) => (
                <div key={i} className={log.includes('❌') ? 'text-destructive' : log.includes('✅') || log.includes('✨') ? 'text-green-600' : 'text-muted-foreground'}>
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && !isSeeding && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>インポート完了</AlertTitle>
          <AlertDescription>
            {results.map(r => `${r.collection}: ${r.success}件`).join(' / ')}
            <br />
            <span className="text-xs">各管理ページでデータを確認してください。</span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
