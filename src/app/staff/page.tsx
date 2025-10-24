
'use client';

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function StaffPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">スタッフ・ユーザー管理</h1>
        <p className="text-muted-foreground">
          現在この機能はメンテナンス中です。
        </p>
      </div>
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>機能利用不可</AlertTitle>
        <AlertDescription>
          現在、セキュリティルールの問題により、スタッフ一覧機能をご利用いただけません。ご不便をおかけして申し訳ありませんが、解決まで今しばらくお待ちください。
        </AlertDescription>
      </Alert>
    </div>
  );
}
