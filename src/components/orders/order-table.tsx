
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Search, MoreHorizontal, Download } from 'lucide-react';
import { cn, findKey } from '@/lib/utils';
import { format, isValid, parseISO, startOfToday, isAfter, isEqual } from 'date-fns';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OrderTableProps {
  orders: any[]; // Use any[] to be flexible with raw GAS data
  isLoading: boolean;
}

const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '';
    try {
        const date = parseISO(dateString);
        return format(date, 'yyyy/MM/dd');
    } catch {
        return dateString;
    }
};

const formatTime = (date: Date | string) => {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || !isValid(d)) return '';
  return format(d, 'HH:mm');
};

const ORDER_KEYS: Record<string, string[]> = {
  '受注ID': ['受注 ID', '受注id', 'id', '受注ID'],
  'お取引先名': ['お取引先名', '店舗', 'customerName'],
  '機材有無': ['機材有無', 'equipmentStatus'],
  '作業予定日': ['作業予定日', 'scheduledDate'],
  '予定時間': ['予定時間', 'scheduledTime'],
  'タイヤサイズ': ['タイヤサイズ', 'tireSize'],
  '本数': ['本数', 'honsu'],
  '担当': ['担当', 'staffName'],
  '受注ステータス': ['受注ステータス', 'status'],
};

const EXPORT_HEADERS = [
  '受注 No',
  'SystemID',
  'ユーザーコード',
  '店舗名',
  '主管店舗',
  '機材有無',
  '作業予定日',
  '予定時間',
  'ご担当者様',
  'キャンセル日時',
  'キャンセル連絡者',
  '作業',
  '受注No(ﾘﾏｰｸ1 8ｹﾀ)',
  '任意コメント(ﾘﾏｰｸ2　10ｹﾀ)',
  '車名',
  '登録ナンバー(下４桁)',
  '入庫状況',
  'タイヤ品番',
  'タイヤサイズ',
  '品名',
  '作業内容',
  '本数',
  '空気圧センサーパッキン交換',
  'タイヤ手配状況',
  '廃タイヤ処分',
  '連絡先',
  '受注ステータス',
  '担当',
  '最終更新日時',
  '特記事項',
  'フォーム入力者',
  '最終位置情報（緯度,経度）',
  'チップ配置作業予定',
  'チップ配置作業完了予定',
  '出勤ボタン',
  '既読確認',
  '移動開始',
  '現場到着',
  '作業開始',
  '作業完了',
  '作業所要時間',
  '退勤ボタン',
  '緊急フラグ',
  '緊急連絡',
  '管理者返信'
];

const EXPORT_MAPPING: Record<string, string> = {
  '受注 No': 'orderNo',
  'SystemID': 'id',
  'ユーザーコード': 'userCode',
  '店舗名': 'customerName',
  '主管店舗': 'mainStore',
  '機材有無': 'equipmentStatus',
  '作業予定日': 'scheduledDate',
  '予定時間': 'scheduledTime',
  'ご担当者様': 'picName',
  'キャンセル日時': 'cancelDate',
  'キャンセル連絡者': 'cancelContact',
  '作業': 'taskDetails',
  '受注No(ﾘﾏｰｸ1 8ｹﾀ)': 'orderNoRemark',
  '任意コメント(ﾘﾏｰｸ2　10ｹﾀ)': 'comment',
  '車名': 'carName',
  '登録ナンバー(下４桁)': 'regNo',
  '入庫状況': 'entryStatus',
  'タイヤ品番': 'tireNumber',
  'タイヤサイズ': 'tireSize',
  '品名': 'productName',
  '作業内容': 'serviceType',
  '本数': 'quantity',
  '空気圧センサーパッキン交換': 'sensor',
  'タイヤ手配状況': 'arrangement',
  '廃タイヤ処分': 'disposal',
  '連絡先': 'contact',
  '受注ステータス': 'status',
  '担当': 'staffName',
  '最終更新日時': 'updatedAt',
  '特記事項': 'specialNotes',
  'フォーム入力者': 'submitter',
  '最終位置情報（緯度,経度）': 'lastLocation',
  'チップ配置作業予定': 'chipWorkScheduled',
  'チップ配置作業完了予定': 'chipWorkCompleted',
  '出勤ボタン': 'clockIn',
  '既読確認': 'readConfirmation',
  '移動開始': 'startTravel',
  '現場到着': 'arrival',
  '作業開始': 'startWork',
  '作業完了': 'completeWork',
  '作業所要時間': 'workDuration',
  '退勤ボタン': 'clockOut',
  '緊急フラグ': 'isEmergency',
  '緊急連絡': 'emergencyMessage',
  '管理者返信': 'adminReply'
};


export function OrderTable({ orders: rawOrders, isLoading }: OrderTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [sortType, setSortType] = React.useState<'spreadsheet' | 'scheduledDate'>('spreadsheet');
  const { profile } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const headers = React.useMemo(() => [
    '受注ID', 'お取引先名', '機材有無', '作業予定日', '予定時間', 'タイヤサイズ', '本数', '担当', '受注ステータス'
  ], []);

  const getFormattedValue = React.useCallback((order: any, header: string) => {
    const keys = ORDER_KEYS[header] || [header];
    let value = findKey(order, keys);
    
    if (header === '作業予定日') {
        value = formatDate(value);
    }
    if (header === '予定時間') {
        value = formatTime(value);
    }
    if (header === '本数') {
      const honsu = findKey(order, ['本数', 'honsu']);
      value = honsu !== undefined && honsu !== null ? String(honsu) : '';
    }
    
    return value !== undefined && value !== null ? String(value) : '';
  }, []);

  const filteredAndSortedOrders = React.useMemo(() => {
    const today = startOfToday();
    const searchLower = debouncedSearch.trim().toLowerCase();

    // Map to include original index for stable sorting
    let ordersToDisplay = (rawOrders || []).map((order, index) => ({ ...order, _originalIndex: index }));

    if (searchLower !== '') {
        // If searching, search across all displayed columns and raw data
        ordersToDisplay = ordersToDisplay.filter(order => {
            const matchesDisplayed = headers.some(header => {
                const cellValue = getFormattedValue(order, header).toLowerCase();
                return cellValue.includes(searchLower);
            });

            const raw = order.raw || {};
            const matchesRaw = Object.values(raw).some(val => 
                String(val).toLowerCase().includes(searchLower)
            );

            return matchesDisplayed || matchesRaw;
        });
    } else {
        // If not searching, filter to only show today and future orders
        ordersToDisplay = ordersToDisplay.filter(order => {
            const workDateStr = findKey(order, ['作業予定日', 'scheduledDate']);
            if (!workDateStr) return false;
            try {
                const workDate = parseISO(workDateStr);
                return isValid(workDate) && (isAfter(workDate, today) || isEqual(workDate, today));
            } catch {
                return false;
            }
        });
    }
    
    if (sortType === 'scheduledDate') {
        // Sort by 作業予定日
        ordersToDisplay.sort((a, b) => {
            const dateKeys = ORDER_KEYS['作業予定日'] || ['作業予定日'];
            const dateA = parseISO(findKey(a, dateKeys) || '0');
            const dateB = parseISO(findKey(b, dateKeys) || '0');
            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;
            return a._originalIndex - b._originalIndex;
        });
    } else {
        // Sort by original index (spreadsheet order)
        ordersToDisplay.sort((a, b) => a._originalIndex - b._originalIndex);
    }

    return ordersToDisplay;
  }, [rawOrders, debouncedSearch, sortType, headers, getFormattedValue]);
    
  const handleRowClick = (order: any) => {
    if (isAdmin && order && order.Order_URL) {
      window.open(order.Order_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handleExportCSV = () => {
    const escapeCell = (val: string) => {
      let cellStr = val || '';
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('\r')) {
        cellStr = `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    };

    const headerRow = EXPORT_HEADERS.map(h => escapeCell(h)).join(',');
    const dataRows = (rawOrders || []).map(order => {
      const raw = order.raw || {};
      const rowValues = EXPORT_HEADERS.map(h => {
        // 1. Prefer raw original data
        if (raw[h] !== undefined && raw[h] !== null) {
          return String(raw[h]);
        }
        // 2. Check mapped key
        const key = EXPORT_MAPPING[h];
        let val = key ? order[key] : undefined;
        
        // Restore formatted values if needed
        if (key === 'scheduledDate' && val) {
          if (typeof val === 'string') {
            val = val.replace(/-/g, '/');
          }
        }
        
        return val !== undefined && val !== null ? String(val) : '';
      });
      return rowValues.map(v => escapeCell(v)).join(',');
    });

    const csvContent = [headerRow, ...dataRows].join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = format(new Date(), 'yyyyMMdd_HHmmss');
    link.href = url;
    link.download = `受注データバックアップ_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };


  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="受注ID、お取引先名、担当者で絞り込み..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm text-muted-foreground whitespace-nowrap">並び順:</span>
            <Select value={sortType} onValueChange={(value: 'spreadsheet' | 'scheduledDate') => setSortType(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="並び順を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spreadsheet">スプレッドシート順</SelectItem>
                <SelectItem value="scheduledDate">作業予定日順</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={isLoading || !rawOrders || rawOrders.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              CSVエクスポート
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[60vh] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={headers.length} className="h-24 text-center">
                    データを読み込んでいます...
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedOrders.length > 0 ? (
                filteredAndSortedOrders.map((order, index) => {
                  const hasUrl = !!order.Order_URL;
                  return (
                    <TableRow 
                      key={order.id || index}
                      onDoubleClick={() => handleRowClick(order)}
                      className={cn(isAdmin && hasUrl && "cursor-pointer hover:bg-muted/50")}
                    >
                      {headers.map(header => {
                        const cellValue = getFormattedValue(order, header);
                        if (header === '機材有無') {
                            return <TableCell key={header}>{cellValue ? '○' : ''}</TableCell>
                        }
                        if (header === '受注ステータス') {
                           return <TableCell key={header}><Badge variant={cellValue === '未割当' ? 'secondary' : 'outline'}>{cellValue || 'N/A'}</Badge></TableCell>
                        }
                        return <TableCell key={header}>{cellValue}</TableCell>
                      })}
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={headers.length} className="h-24 text-center">
                    {(rawOrders || []).length === 0 && !searchTerm ? "表示対象の受注情報が見つかりません。" : "検索条件に合う受注が見つかりません。"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
