
'use client';

import { CustomerTable } from '@/components/customers/customer-table';
import type { Customer } from '@/lib/types';
import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyodF8JkDDsa94t5duYustImTCASnyk4W3wXlLTL2RJSIL75FihzGkK6oAIg5GEUaxgrw/exec';

export default function CustomersPage() {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
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
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error('データ形式が正しくありません。JSON配列を取得できませんでした。');
        }
        setCustomers(data);
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
