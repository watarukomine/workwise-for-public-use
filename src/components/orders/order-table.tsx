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
import { Button } from '@/components/ui/button';
import { Search, MoreHorizontal } from 'lucide-react';
import { cn, findKey, formatDate, formatTime as formatTimeUtil } from '@/lib/utils';
import { format, isValid, parseISO } from 'date-fns';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OrderTableProps {
  orders: any[]; // Use any[] to be flexible with raw GAS data
  isLoading: boolean;
}

export function OrderTable({ orders: rawOrders, isLoading }: OrderTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [page, setPage] = React.useState(1);
  const rowsPerPage = 10;
  const { profile } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  const filteredOrders = React.useMemo(() => {
    const ordersToDisplay = rawOrders || [];

    if (searchTerm.trim() !== '') {
        return ordersToDisplay.filter(order =>
            ['受注ID', 'お取引先名', '担当'].some(key => 
                String(findKey(order, [key]) || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }
    
    return ordersToDisplay;
  }, [rawOrders, searchTerm]);

  const paginatedOrders = React.useMemo(() => {
    return filteredOrders.slice(
      (page - 1) * rowsPerPage,
      page * rowsPerPage
    );
  }, [filteredOrders, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);

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
        '本数': ['本数'],
        '担当': ['担当', 'staffName'],
        '受注ステータス': ['受注ステータス', 'status'],
      };

    const keys = dbKeys[header] || [header];
    let value = findKey(order, keys);
    
    if (header === '作業予定日') {
        value = formatDate(value, 'yyyy/MM/dd');
    }
    if (header === '予定時間') {
        value = formatTimeUtil(value);
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={headers.length + 1} className="h-24 text-center">
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
                        const cellValue = getFormattedValue(order, header);
                        if (header === '機材有無') {
                            return <TableCell key={header}>{cellValue ? '○' : ''}</TableCell>
                        }
                        if (header === '受注ステータス') {
                           return <TableCell key={header}><Badge variant={cellValue === '未割当' ? 'secondary' : 'outline'}>{cellValue || 'N/A'}</Badge></TableCell>
                        }
                        return <TableCell key={header}>{cellValue}</TableCell>
                      })}
                      <TableCell>
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                      <span className="sr-only">メニューを開く</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleRowClick(order)} disabled={!isAdmin || !order.Order_URL}>
                                    スプレッドシートで開く
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>詳細を表示</DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={headers.length + 1} className="h-24 text-center">
                    {(rawOrders || []).length === 0 && !searchTerm ? "表示対象の受注情報が見つかりません。" : "検索条件に合う受注が見つかりません。"}
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
