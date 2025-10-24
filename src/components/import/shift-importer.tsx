
'use client';

import * as React from 'react';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, UploadCloud, FileCheck2, UserCheck } from 'lucide-react';
import Papa from 'papaparse';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export function ShiftImporter() {
  const { allStaff, setPendingSelection } = useSelectedStaff();
  const { toast } = useToast();
  const router = useRouter();
  
  const [file, setFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [foundStaff, setFoundStaff] = React.useState<string[] | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
      setError(null);
      setFoundStaff(null);
    }
  };

  const handleImport = () => {
    if (!file) {
      setError('まず、CSVファイルを選択してください。');
      return;
    }
    if (allStaff.length === 0) {
      setError('スタッフデータがまだ読み込まれていません。先にスタッフ一覧ページを表示してください。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFoundStaff(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as { [key: string]: string }[];
        const errors = results.errors;

        if (errors.length > 0) {
          setError(`CSVの解析中にエラーが発生しました: ${errors[0].message}`);
          setIsLoading(false);
          return;
        }

        // Identify the column for staff names/IDs
        const header = results.meta.fields;
        if (!header) {
          setError('CSVにヘッダー行がありません。');
          setIsLoading(false);
          return;
        }

        const nameColumn = header.find(h => h.includes('スタッフ名'));
        const idColumn = header.find(h => h.includes('スタッフID'));

        if (!nameColumn && !idColumn) {
          setError('CSVに「スタッフ名」または「スタッフID」の列が見つかりませんでした。');
          setIsLoading(false);
          return;
        }

        const scheduledStaffIdentifiers = new Set(data.map(row => row[nameColumn || idColumn!]).filter(Boolean));

        const matchedStaffIds: string[] = [];
        const matchedStaffNames: string[] = [];

        allStaff.forEach(staff => {
          const identifierToMatch = nameColumn ? staff.name : staff.id;
          if (scheduledStaffIdentifiers.has(identifierToMatch)) {
            matchedStaffIds.push(staff.id);
            matchedStaffNames.push(staff.name);
          }
        });

        setPendingSelection(matchedStaffIds);
        setFoundStaff(matchedStaffNames);
        
        toast({
          title: "シフトを読み込みました",
          description: `${matchedStaffIds.length}人のスタッフが選択されました。スタッフ一覧ページで確認・適用してください。`,
        });

        setIsLoading(false);
      },
      error: (err) => {
        setError(`ファイルの読み込みに失敗しました: ${err.message}`);
        setIsLoading(false);
      }
    });
  };

  const goToStaffPage = () => {
    router.push('/staff');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>シフト表インポート (CSV)</CardTitle>
        <CardDescription>
          CSV形式のシフト表をアップロードすると、その日の出勤スタッフが自動で選択されます。
          CSVには「スタッフ名」または「スタッフID」の列を含めてください。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex w-full max-w-lg items-center space-x-2">
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isLoading}
            className="cursor-pointer file:cursor-pointer file:font-semibold file:text-primary"
          />
          <Button onClick={handleImport} disabled={isLoading || !file}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            インポート
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {foundStaff !== null && (
          <Alert variant={foundStaff.length > 0 ? "default" : "destructive"}>
            <FileCheck2 className="h-4 w-4" />
            <AlertTitle>インポート結果</AlertTitle>
            <AlertDescription>
              {foundStaff.length > 0 ? (
                <>
                  <p>{foundStaff.length}人の出勤スタッフが選択されました。スタッフ一覧ページで確定してください。</p>
                  <ul className="mt-2 list-disc list-inside text-xs">
                    {foundStaff.map(name => <li key={name}>{name}</li>)}
                  </ul>
                </>
              ) : (
                'CSV内のスタッフ情報と一致するスタッフが見つかりませんでした。'
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      {foundStaff !== null && foundStaff.length > 0 && (
         <CardFooter>
            <Button onClick={goToStaffPage}>
                <UserCheck className="mr-2 h-4 w-4" />
                スタッフ一覧で確認する
            </Button>
         </CardFooter>
      )}
    </Card>
  );
}
