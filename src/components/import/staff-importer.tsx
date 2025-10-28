
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, Download, CheckCircle, Users, Columns } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useToast } from '@/hooks/use-toast';
import type { Staff, WithId } from '@/lib/types';
import { useRouter } from 'next/navigation';

// A simple type guard to check if the error is a fetch error
function isFetchError(error: unknown): error is TypeError {
  return error instanceof TypeError;
}

export function StaffImporter() {
  const [gasUrl, setGasUrl] = React.useState('');
  const [rawData, setRawData] = React.useState<any>(null);
  const [tableData, setTableData] = React.useState<any[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [importSuccess, setImportSuccess] = React.useState(false);
  const [columnHeaders, setColumnHeaders] = React.useState<string[] | null>(null);
  
  const { setAllStaff } = useSelectedStaff();
  const { toast } = useToast();
  const router = useRouter();


  const handleFetchData = async () => {
    if (!gasUrl) {
      setError('GASのウェブアプリURLを入力してください。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTableData(null);
    setRawData(null);
    setImportSuccess(false);
    setColumnHeaders(null);

    try {
      const response = await fetch(gasUrl, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      setRawData(result);
      
      let dataToProcess: any[] | null = null;

      if (Array.isArray(result)) {
        dataToProcess = result;
      } else if (result && typeof result === 'object' && Array.isArray(result.data)) {
        dataToProcess = result.data;
      }

      if (dataToProcess) {
         setTableData(dataToProcess);
         if (dataToProcess.length > 0) {
           setColumnHeaders(Object.keys(dataToProcess[0])); // Extract headers
           const staffList: WithId<Staff>[] = dataToProcess.map((item: any) => {
              const roleValue = item['権限（Staff /Admin）'];
              return {
                id: String(item['スタッフID']),
                role: typeof roleValue === 'string' && roleValue.toLowerCase() === 'admin' ? 'admin' : 'staff',
                name: item['スタッフ名'],
                email: item['メールアドレス'],
                password: item['パスワード'],
                calendarId: item['カレンダーID'],
                color: item['カラー'],
                avatarUrl: `https://picsum.photos/seed/${item['スタッフID']}/100/100`,
              }
           });

           setAllStaff(staffList);
           setImportSuccess(true);
           toast({
             title: 'インポート成功',
             description: `${staffList.length}件のスタッフ情報がアプリケーションに反映されました。`,
           });
         }
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
           <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            スタッフデータ取得
          </CardTitle>
          <CardDescription>
            スタッフ情報を含むGoogle Apps Scriptをウェブアプリとして公開し、そのURLを貼り付けてください。この操作により、アプリ全体のスタッフ情報が更新されます。
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

       {importSuccess && (
        <Alert variant="default" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
          <AlertTitle className="text-green-800 dark:text-green-400">インポート完了</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            スタッフデータが正常に読み込まれました。「スタッフ管理」ページで確認できます。再度ログインすると権限が反映されます。
          </AlertDescription>
        </Alert>
      )}

      {columnHeaders && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Columns className="h-6 w-6" />
                取得データのカラム構成
            </CardTitle>
            <CardDescription>
              GASから取得したデータヘッダー（1行目のキー）の一覧です。この中に権限に関するカラムが存在するかご確認ください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside bg-muted rounded-md p-4 space-y-1 font-mono text-sm">
                {columnHeaders.map((header) => (
                    <li key={header}>{header}</li>
                ))}
            </ul>
          </CardContent>
        </Card>
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
                    tableData.slice(0, 5).map((row, rowIndex) => (
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
           {tableData && tableData.length > 5 && (
              <CardFooter>
                  <p className="text-sm text-muted-foreground">
                      {`他 ${tableData.length - 5} 件のデータがインポートされました...`}
                  </p>
              </CardFooter>
           )}
         </Card>
      )}
    </div>
  );
}
