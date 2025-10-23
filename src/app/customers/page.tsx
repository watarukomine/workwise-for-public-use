
'use client';

import { CustomerTable } from '@/components/customers/customer-table';
import type { Customer } from '@/lib/types';
import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbw-QyW8LgFU1iiwipAhauNqukcd6hLxV8cDsdh0MmwIsgbP89pSsH58p680ZOB2etc8cA/exec';

export default function CustomersPage() {
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(GAS_URL);
        if (!response.ok) {
          throw new Error(`HTTPエラー: ${response.status}`);
        }
        const result = await response.json();
        
        let customerData: any[] | null = null;

        // Check if the result itself is an array
        if (Array.isArray(result)) {
            customerData = result;
        // Check if the result is an object containing a 'data' array
        } else if (result && typeof result === 'object' && Array.isArray(result.data)) {
            customerData = result.data;
        }

        if (customerData !== null) {
          setCustomers(customerData);
        } else {
          // If the format is still unexpected, log an error message but try to render anyway if it's an object.
          // This prevents the app from crashing and allows for inspection.
          console.error('GAS response received, but in an unexpected format:', result);
          setError('GASから受信したデータの形式が予期せぬものです。開発者コンソールで内容を確認してください。');
          // Try to set the data anyway if it's an array-like structure, otherwise an empty array.
          setCustomers(result && typeof result === 'object' ? Object.values(result).find(Array.isArray) || [] : []);
        }

      } catch (e: unknown) {
        console.error('Failed to fetch customer data:', e);
        if (e instanceof Error) {
            if (e.message.includes('Failed to fetch')) {
                 setError('データの取得に失敗しました。CORSポリシーまたはネットワークの問題が考えられます。GAS側で正しくCORSヘッダーが設定されているか確認してください。');
            } else {
                setError(`エラーが発生しました: ${e.message}`);
            }
        } else {
            setError('不明なエラーが発生しました。');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">販売店情報</h1>
        <p className="text-muted-foreground">
          スプレッドシートから取得した販売店の一覧です。
        </p>
      </div>
       {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <CustomerTable customers={customers} isLoading={isLoading} />
    </div>
  );
}
