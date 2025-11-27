'use client';
import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { cn, findKey } from '@/lib/utils';
import { format, isValid, parseISO } from 'date-fns';
import { useUserProfile } from '@/hooks/use-user-profile';

interface OrderTableProps {
  orders: any[]; // Use any[] to be flexible with raw GAS data
  isLoading: boolean;
}

const formatDate = (dateString: string) => {
  if (!dateString || !isValid(parseISO(dateString))) {
    return dateString; // Return original string if invalid
  }
  try {
    return format(new Date(dateString), 'MM/dd');
  } catch {
    return dateString;
  }
};

const formatTime = (timeString: string) => {
    if (!timeString) return timeString;
    
    if (typeof timeString === 'string' && timeString.startsWith('1899-12-')) {
        const date = new Date(timeString);
        if (isValid(date)) {
            return format(date, 'HH:mm');
        }
    }

    const date = new Date(timeString);
    if (!isValid(date)) {
        const today = new Date();
        const [hours, minutes] = timeString.split(':');
        if (hours && minutes) {
            today.setHours(parseInt(hours, 10), parseInt(minutes, 10));
            if (isValid(today)) {
                return format(today, 'HH:mm');
            }
        }
        return timeString; // Return original if still invalid
    }
    try {
        return format(date, 'HH:mm');
    } catch {
        return timeString;
    }
};

const formatDateTime = (dateTimeString: string) => {
    if (!dateTimeString || !isValid(parseISO(dateTimeString))) return dateTimeString;
    try {
        return format(new Date(dateTimeString), 'MM-dd HH:mm');
    } catch {
        return dateTimeString;
    }
};


export function OrderTable({ orders: rawOrders, isLoading }: OrderTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [page, setPage] = React.useState(1);
  const rowsPerPage = 10;
  const { profile } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  const filteredOrders = React.useMemo(() => {
    if (!rawOrders) return [];

    let ordersToDisplay = rawOrders;

    if (searchTerm.trim() === '') {
      return ordersToDisplay;
    }
    
    return ordersToDisplay.filter(order =>
        Object.values(order).some(value => 
            String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );
  }, [rawOrders, searchTerm]);

  const paginatedOrders = React.useMemo(() => {
    return filteredOrders.slice(
      (page - 1) * rowsPerPage,
      page * rowsPerPage
    );
  }, [filteredOrders, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);

  const headers = [
    '受注ID', 'ユーザーコード', 'お取引先名', '作業予定日', '予定時間', 'ご担当者様', '作業場所',
    '受注No(ﾘﾏｰｸ1 8ｹﾀ)', '任意コメント(ﾘﾏｰｸ2 10ｹﾀ)', '車名', '登録ナンバー(下４桁)',
    '入庫状況', 'タイヤ品番', 'タイヤサイズ', '品名', '作業内容', '本数', '空気圧センサー\nパッキン交換',
    'タイヤ手配状況', '廃タイヤ処分', '連絡先', '受注ステータス', '担当', '最終更新日時',
    '最終位置情報（緯度,経度）', 'チップ配置作業予定', '移動開始', '現場到着', '作業開始', '作業完了',
    '作業所要時間', '退勤ボタン', '緊急連絡'
  ];
    
  const handleRowClick = (order: any) => {
    if (isAdmin && order && order.Order_URL) {
      window.open(order.Order_URL, '_blank', 'noopener,noreferrer');
    }
  };
  
  const headersToFormat: Record<string, (value: any) => string> = {
    '作業予定日': formatDate,
    '受付日': formatDate,
    '予定時間': formatTime,
    'チップ配置作業予定': formatDateTime,
    '移動開始': formatDateTime,
    '現場到着': formatDateTime,
    '作業開始': formatDateTime,
    '作業完了': formatDateTime,
    '作業終了': formatDateTime,
    '最終更新日時': formatDateTime,
  };
  
  const getFormattedValue = (order: any, header: string) => {
      const dbKeys: Record<string, string[]> = {
        '受注ID': ['受注ID', 'id'],
        'ユーザーコード': ['ユーザーコード'],
        'お取引先名': ['お取引先名'],
        '作業予定日': ['作業予定日'],
        '予定時間': ['予定時間'],
        'ご担当者様': ['ご担当者様'],
        '作業場所': ['作業場所'],
        '受注No(ﾘﾏｰｸ1 8ｹﾀ)': ['受注No(ﾘﾏｰｸ1 8ｹﾀ)'],
        '任意コメント(ﾘﾏｰｸ2 10ｹﾀ)': ['任意コメント(ﾘﾏｰｸ2 10ｹﾀ)'],
        '車名': ['車名'],
        '登録ナンバー(下４桁)': ['登録ナンバー(下４桁)'],
        '入庫状況': ['入庫状況'],
        'タイヤ品番': ['タイヤ品番'],
        'タイヤサイズ': ['タイヤサイズ'],
        '品名': ['品名'],
        '作業内容': ['作業内容'],
        '本数': ['本数'],
        '空気圧センサー\nパッキン交換': ['空気圧センサー', 'パッキン交換', '空気圧センサーパッキン交換'],
        'タイヤ手配状況': ['タイヤ手配状況'],
        '廃タイヤ処分': ['廃タイヤ処分'],
        '連絡先': ['連絡先'],
        '受注ステータス': ['受注ステータス'],
        '担当': ['担当'],
        '最終更新日時': ['最終更新日時'],
        '最終位置情報（緯度,経度）': ['最終位置情報（緯度,経度）'],
        'チップ配置作業予定': ['チップ配置作業予定'],
        '移動開始': ['移動開始'],
        '現場到着': ['現場到着'],
        '作業開始': ['作業開始'],
        '作業完了': ['作業完了'],
        '作業所要時間': ['作業所要時間'],
        '退勤ボタン': ['退勤ボタン'],
        '緊急連絡': ['緊急連絡'],
      };

    const keys = dbKeys[header] || [header.replace('\n', '')];
    const value = findKey(order, keys);
    
      if (headersToFormat[header]) {
        return headersToFormat[header](value);
      }
      
      return value !== undefined && value !== null ? String(value) : '';
  };


  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="h-48">
                {headers.map(header => (
                  <TableHead key={header} className="p-0">
                    <div className="relative w-8 h-full">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[270deg] whitespace-nowrap">
                         {header.split('\n').map((line, index) => <div key={index}>{line}</div>)}
                      </div>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={headers.length || 1} className="h-24 text-center">
                    データを読み込んでいます...
                  </TableCell>
                </TableRow>
              ) : paginatedOrders.length > 0 ? (
                paginatedOrders.map((order, index) => {
                  const hasUrl = !!order.Order_URL;
                  return (
                    <TableRow 
                      key={index}
                      onDoubleClick={() => handleRowClick(order)}
                      className={cn(isAdmin && hasUrl && "cursor-pointer hover:bg-muted/50")}
                    >
                      {headers.map(header => {
                        const cellContent = getFormattedValue(order, header);
                        return <TableCell key={header} className="whitespace-nowrap px-2 py-1 text-xs">{cellContent}</TableCell>
                      })}
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={headers.length || 1} className="h-24 text-center">
                    {rawOrders.length === 0 && !searchTerm ? "表示対象の受注情報が見つかりません。" : "検索条件に合う受注が見つかりません。"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
          <span className="text-sm text-muted-foreground">
            {totalPages > 0 ? `${totalPages}ページ中の${page}ページ` : '0ページ中の0ページ'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            前へ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || totalPages === 0}
          >
            次へ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}