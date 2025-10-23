
'use client';

import { StaffTable } from "@/components/staff/staff-table";
import type { Staff } from '@/lib/types';
import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbywC5IoTryeIFRyo7rU4hBaTb7u9p4aK1p0UBvYeuzJiyVDaHqfjYeyA61seoH9LpeQYw/exec?sheet=スタッフマスタ';

// A simple hash function to generate a number from a string
const stringToHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

// Function to generate a pleasant HSL color from a string
const generateHslColorFromString = (str: string) => {
  const hash = stringToHash(str);
  const h = (hash % 360 + 360) % 360; // Hue (0-359)
  const s = 70 + (hash % 10); // Saturation (70-80%)
  const l = 50 + (hash % 10); // Lightness (50-60%)
  return `hsl(${h}, ${s}%, ${l}%)`;
};


export default function StaffPage() {
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchStaff = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(GAS_URL, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTPエラー: ${response.status}`);
        }
        const result = await response.json();
        
        let staffData: any[] | null = null;
        if (Array.isArray(result)) {
            staffData = result;
        } else if (result && typeof result === 'object' && Array.isArray(result.data)) {
            staffData = result.data;
        }

        if (staffData !== null) {
          const formattedStaff = staffData.map((member, index) => {
            const staffId = member['スタッフID'] || String(index + 1);
            // Assign a color automatically if it's not provided in the sheet
            const color = member['カラー'] || generateHslColorFromString(staffId);
            
            return {
              id: staffId,
              name: member['スタッフ名'] || '',
              calendarId: member['カレンダーID'] || '',
              color: color,
              avatarUrl: member.avatarUrl || `https://picsum.photos/seed/${staffId}/100/100`
            };
          });
          setStaff(formattedStaff);
        } else {
          if (result && typeof result === 'object') {
            setStaff([]);
          } else {
             setError('GASから受信したデータの形式が予期せぬものです。');
             setStaff([]);
          }
        }

      } catch (e: unknown) {
        console.error('Failed to fetch staff data:', e);
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

    fetchStaff();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">スタッフ一覧</h1>
        <p className="text-muted-foreground">
          スプレッドシートから取得したチームメンバーの一覧です。
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <StaffTable staff={staff} isLoading={isLoading} />
    </div>
  );
}
