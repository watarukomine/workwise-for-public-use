
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
import { Search, MoreHorizontal } from 'lucide-react';
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

export function OrderTable({ orders: rawOrders, isLoading }: OrderTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const { profile } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  const filteredAndSortedOrders = React.useMemo(() => {
    const today = startOfToday();
    let ordersToDisplay = (rawOrders || []).filter(order => {
        const workDateStr = findKey(order, ['作業予定日', 'scheduledDate']);
        if (!workDateStr) return false;
        try {
            const workDate = parseISO(workDateStr);
            return isValid(workDate) && (isAfter(workDate, today) || isEqual(workDate, today));
        } catch {
            return false;
        }
    });

    if (searchTerm.trim() !== '') {
        ordersToDisplay = ordersToDisplay.filter(order =>
            ['受注ID', 'お取引先名', '担当'].some(key => 
                String(findKey(order, [key]) || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }
    
    // Sort by 作業予定日
    ordersToDisplay.sort((a, b) => {
        const dateA = parseISO(findKey(a, ['作業予定日']) || '0');
        const dateB = parseISO(findKey(b, ['作業予定日']) || '0');
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;
        return 0;
    });

    return ordersToDisplay;
  }, [rawOrders, searchTerm]);

  const headers = [
    '受注ID', 'お取引先名', '機材有無', '作業予定日', '予定時間', 'タイヤサイズ', '本数', '担当', '受注ステータス'
  ];
    
  const handleRowClick = (order: any) => {
    if (isAdmin && order && order.Order_URL) {
      window.open(order.Order_URL, '_blank', 'noopener,noreferrer');
    }
  };
  
  const getFormattedValue = (order: any, header: string) => {
      const dbKeys: Record<string, string[]> = {
        '受注ID': ['受注 ID', '受注id', 'id'],
        'お取引先名': ['お取引先名', '店舗', 'customerName'],
        '機材有無': ['機材有無', 'equipmentStatus'],
        '作業予定日': ['作業予定日', 'scheduledDate'],
        '予定時間': ['予定時間', 'scheduledTime'],
        'タイヤサイズ': ['タイヤサイズ', 'tireSize'],
        '本数': ['本数', 'honsu'],
        '担当': ['担当', 'staffName'],
        '受注ステータス': ['受注ステータス', 'status'],
      };

    const keys = dbKeys[header] || [header];
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
  };


  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="受注ID、お取引先名、担当者で絞り込み..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
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
                      key={index}
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
