'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// A simple type guard to check if the error is a fetch error
function isFetchError(error: unknown): error is TypeError {
  return error instanceof TypeError;
}

export function GasImporter() {
  const [gasUrl, setGasUrl] = React.useState('');
  const [rawData, setRawData] = React.useState<any>(null);
  const [tableData, setTableData] = React.useState<any[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleFetchData = async () => {
    if (!gasUrl) {
      setError('GASのウェブアプリURLを入力してください。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTableData(null);
    setRawData(null);

    try {
      const response = await fetch(gasUrl, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      setRawData(result);
      
      let dataToDisplay: any[] | null = null;

      if (Array.isArray(result)) {
        dataToDisplay = result;
      } else if (result && typeof result === 'object' && Array.isArray(result.data)) {
        dataToDisplay = result.data;
      } else if (result && typeof result === 'object' && Object.keys(result).length > 0) {
        // If it's an object, but not the expected format, don't try to make a table out of it
        // but also don't throw an error. The raw view is what's important here.
        dataToDisplay = []; 
      }

      if (dataToDisplay) {
         setTableData(dataToDisplay);
      }
      
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
  
  const headers = tableData && tableData.length > 0 ? Object.keys(tableData[0]) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>スプレッドシートデータ取得</CardTitle>
          <CardDescription>
            Google Apps Scriptをウェブアプリとして公開し、そのURLを貼り付けてください。スクリプトはJSON配列形式でデータを返す必要があります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full max-w-lg items-center space-x-2">
            <Input
              type="url"
              placeholder="https://script.google.com/macros/s/..."
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              disabled={isLoading}
            />
            <Button onClick={handleFetchData} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              データ取得
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

      {rawData && (
        <Card>
          <CardHeader>
            <CardTitle>生のデータ（Raw Response）</CardTitle>
            <CardDescription>GASから返された生のJSONデータです。この内容が空や意図しない形式の場合、GAS側に問題がある可能性があります。</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 w-full rounded-md border bg-muted p-4">
              <pre className="text-sm">
                <code>{JSON.stringify(rawData, null, 2)}</code>
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {tableData && (
         <Card>
           <CardHeader>
             <CardTitle>取得データプレビュー</CardTitle>
              <CardDescription>
                {tableData.length > 0 ? `取得した ${tableData.length} 件のデータを表示しています。` : '表示するテーブルデータがありません。生のデータ（Raw Response）を確認してください。'}
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
                  {tableData.length > 0 ? (
                    tableData.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {headers.map((header) => (
                          <TableCell key={`${rowIndex}-${header}`}>
                            {typeof row[header] === 'object' ? JSON.stringify(row[header]) : String(row[header])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={headers.length || 1} className="h-24 text-center">
                        データが見つかりませんでした。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
             </div>
           </CardContent>
         </Card>
      )}
    </div>
  );
}
