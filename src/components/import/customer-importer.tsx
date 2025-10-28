'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, Download, CheckCircle, Building, Columns } from 'lucide-react';
import { useCustomer } from '@/contexts/customer-context';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

function isFetchError(error: unknown): error is TypeError {
  return error instanceof TypeError;
}

export function CustomerImporter() {
  const { 
    customerGasUrl,
    setCustomerGasUrl,
    setCustomers,
    isLoading: isContextLoading,
    error: contextError,
    customers,
  } = useCustomer();
  
  const [localUrl, setLocalUrl] = React.useState(customerGasUrl);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [importSuccess, setImportSuccess] = React.useState(false);
  const [rawResponse, setRawResponse] = React.useState<any | null>(null);
  
  const { toast } = useToast();

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
      const response = await fetch(localUrl, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
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
       if (isFetchError(e)) {
         if (e.message.includes('Failed to fetch')) {
             setError('データの取得に失敗しました。CORSポリシーまたはネットワークの問題が考えられます。GAS側で正しくCORSヘッダーが設定されているか確認してください。');
         } else {
            setError(`予期せぬネットワークエラー: ${e.message}`);
         }
       } else if (e instanceof Error) {
        setError(`エラーが発生しました: ${e.message}`);
       } else {
        setError('不明なエラーが発生しました。');
       }
    } finally {
      setIsLoading(false);
    }
  };
  
  const headers = customers && customers.length > 0 ? Object.keys(customers[0]) : [];
  const loading = isLoading || isContextLoading;

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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

       {importSuccess && (
        <Alert variant="default" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
          <AlertTitle className="text-green-800 dark:text-green-400">インポート完了</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            販売店データが正常に読み込まれ、URLが保存されました。「販売店情報」ページで確認できます。
          </AlertDescription>
        </Alert>
      )}

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Columns className="h-6 w-6" />
                取得データのカラム構成
            </CardTitle>
            <CardDescription>
              GASから取得したデータヘッダー（1行目のキー）の一覧です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside bg-muted rounded-md p-4 space-y-1 font-mono text-sm">
                {headers.map((header) => (
                    <li key={header}>{header}</li>
                ))}
            </ul>
          </CardContent>
        </Card>
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

      {customers && customers.length > 0 && (
         <Card>
           <CardHeader>
             <CardTitle>取得データプレビュー</CardTitle>
              <CardDescription>
                現在アプリケーションに読み込まれている {customers.length} 件のデータを表示しています。
              </CardDescription>
           </CardHeader>
           <CardContent>
             <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHead key={header}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {customers.slice(0, 5).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {headers.map((header) => (
                          <TableCell key={`${rowIndex}-${header}`}>
                            {typeof row[header] === 'object' ? JSON.stringify(row[header]) : String(row[header])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
             </div>
           </CardContent>
           {customers && customers.length > 5 && (
              <CardFooter>
                  <p className="text-sm text-muted-foreground">
                      {`他 ${customers.length - 5} 件のデータ...`}
                  </p>
              </CardFooter>
           )}
         </Card>
      )}
    </div>
  );
}
