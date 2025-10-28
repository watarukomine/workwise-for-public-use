'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoaderCircle, AlertCircle, Download, CheckCircle, Building } from 'lucide-react';
import { useCustomer } from '@/contexts/customer-context';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchGasData } from '@/app/actions/fetch-gas-data';

export function CustomerImporter() {
  const { 
    customerGasUrl,
    setCustomerGasUrl,
    setCustomers,
    isLoading: isContextLoading,
    error: contextError,
  } = useCustomer();
  
  const [localUrl, setLocalUrl] = React.useState(customerGasUrl);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [importSuccess, setImportSuccess] = React.useState(false);
  const [rawResponse, setRawResponse] = React.useState<any | null>(null);
  const [isClient, setIsClient] = React.useState(false);
  
  const { toast } = useToast();

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    setLocalUrl(customerGasUrl);
  }, [customerGasUrl]);
  
  React.useEffect(() => {
    if (contextError) setError(contextError);
  }, [contextError]);


  const handleFetchData = async () => {
    if (!localUrl) {
      setError('GASのウェブアプリURLを入力してください。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImportSuccess(false);
    setRawResponse(null);

    try {
      const result = await fetchGasData(localUrl);

      setRawResponse(result);
      const dataToProcess = result.data || (Array.isArray(result) ? result : []);
      
      setCustomers(dataToProcess);
      setCustomerGasUrl(localUrl); 
      setImportSuccess(true);
      toast({
         title: 'インポート成功',
         description: `${dataToProcess.length}件の販売店情報がアプリケーションに反映されました。`,
       });
      
    } catch (e: unknown) {
      console.error('GAS Fetch Error:', e);
      if (e instanceof Error) {
        setError(`データの取得に失敗しました: ${e.message}`);
      } else {
        setError('不明なエラーが発生しました。');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const loading = isLoading || isContextLoading || !isClient;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-6 w-6" />
            販売店データ設定
          </CardTitle>
          <CardDescription>
            販売店情報を含むGoogle Apps ScriptのURLを設定します。設定後はアプリ起動時に自動でデータが読み込まれます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full max-w-lg items-center space-x-2">
            <Input
              type="url"
              placeholder="https://script.google.com/macros/s/..."
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              disabled={loading}
            />
            <Button onClick={handleFetchData} disabled={loading}>
              {loading ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              URLを保存・更新
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

       {importSuccess && !isLoading && (
        <Alert variant="default" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
          <AlertTitle className="text-green-800 dark:text-green-400">インポート完了</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            販売店データが正常に読み込まれ、URLが保存されました。「販売店情報」ページで確認できます。
          </AlertDescription>
        </Alert>
      )}

      {rawResponse && (
        <Card>
          <CardHeader>
            <CardTitle>生のデータ（Raw Response）</CardTitle>
            <CardDescription>GASから返された生のJSONデータです。この内容が空や意図しない形式の場合、GAS側に問題がある可能性があります。</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 w-full rounded-md border bg-muted p-4">
              <pre className="text-sm">
                <code>{JSON.stringify(rawResponse, null, 2)}</code>
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
