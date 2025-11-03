
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
import { cn } from '@/lib/utils';
import { format, isToday, parseISO, isValid } from 'date-fns';
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
    // Handles ISO-8601 DateTime strings or just time strings
    if (!timeString) return timeString;
    const date = new Date(timeString);
    if (!isValid(date)) {
        // Handle cases like "10:00" which might be parsed as invalid date alone
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

// Helper to parse dates which might be in various formats
const parseDate = (dateString: any): Date | null => {
  if (!dateString || typeof dateString !== 'string') return null;
  const date = parseISO(dateString); // Handles 'YYYY-MM-DDTHH:mm:ss.sssZ'
  if (isValid(date)) {
    return date;
  }
  // Add other parsing logic if necessary for other formats
  return null;
}

export function OrderTable({ orders: rawOrders, isLoading }: OrderTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [page, setPage] = React.useState(1);
  const rowsPerPage = 10;
  const { profile } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  const filteredOrders = React.useMemo(() => {
    if (!rawOrders) return [];

    let ordersToDisplay = rawOrders.filter(order => {
        const scheduledDate = parseDate(order['作業予定日']);
        const receptionDate = parseDate(order['受付日']);
        const isScheduledForToday = scheduledDate ? isToday(scheduledDate) : false;
        const isReceivedToday = receptionDate ? isToday(receptionDate) : false;
        return isScheduledForToday || isReceivedToday;
    });

    if (searchTerm.trim() === '') {
      return ordersToDisplay;
    }
    
    // A simple search across all values of an order object
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

  const headers = rawOrders && rawOrders.length > 0 
    ? Object.keys(rawOrders[0]).filter(key => key !== 'Order_URL') // Hide Order_URL column
    : [];
    
  const handleRowClick = (order: any) => {
    if (isAdmin && order && order.Order_URL) {
      window.open(order.Order_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const headersToFormat: Record<string, (value: string) => string> = {
    '作業予定日': formatDate,
    '受付日': formatDate, // Format reception date as well
    '予定時間': formatTime,
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map(header => <TableHead key={header} className="[writing-mode:vertical-rl] text-center h-40">
                  {header}
                </TableHead>)}
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
                      {headers.map(header => (
                        <TableCell key={header}>
                          {headersToFormat[header] 
                            ? headersToFormat[header](order[header])
                            : (order[header] !== undefined && order[header] !== null ? String(order[header]) : '')}
                        </TableCell>
                      ))}
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
            {totalPages > 0 ? totalPages : 1}ページ中の{page}ページ
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
