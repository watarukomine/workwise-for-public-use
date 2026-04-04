
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Database } from 'lucide-react';

export function StaffImporter() {
  const [isClient, setIsClient] = React.useState(false);
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            スタッフデータ取得設定
          </CardTitle>
          <CardDescription>
            現在はFirestoreデータベースをプライマリデータソースとして使用しています。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          Google Apps Scriptによるデータ取得・更新機能はFirestore移行に伴い無効化されました。
        </CardContent>
      </Card>
    </div>
  );
}
