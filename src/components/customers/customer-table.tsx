
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
import type { Customer } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useUserProfile } from '@/hooks/use-user-profile';

type CustomerWithUrl = Customer & { Order_URL?: string };
interface CustomerTableProps {
  customers: any[]; // Use any[] to be flexible with raw GAS data
  isLoading: boolean;
}

// Function to map raw data from GAS to the Customer type
const mapRawDataToCustomers = (rawData: any[]): CustomerWithUrl[] => {
  if (!Array.isArray(rawData)) {
    return [];
  }
  return rawData.map(item => ({
    id: item['ユーザーコード'] || item['id'] || String(item['No'] || Math.random()),
    No: item['No'],
    userCode: item['ユーザーコード'],
    '旧 チャネル SEQ': item['旧 チャネル SEQ'],
    storeName: item['店舗'],
    '管理C': item['管理C'],
    '機材有無': item['機材有無'],
    address: item['住所'],
    latitude: Number(item['緯度']),
    longitude: Number(item['経度']),
    '電話番号': item['電話番号'],
    '営業時間': item['営業時間'],
    // Keep original keys for compatibility if needed elsewhere
    ...item
  }));
};


export function CustomerTable({ customers: rawCustomers, isLoading }: CustomerTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [page, setPage] = React.useState(1);
  const rowsPerPage = 10;
  const { profile } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  // Map the raw data to structured Customer data
  const mappedCustomers = React.useMemo(() => mapRawDataToCustomers(rawCustomers), [rawCustomers]);

  const filteredCustomers = React.useMemo(() => {
    if (searchTerm.trim() === '') {
      return mappedCustomers;
    }
    return mappedCustomers.filter(customer =>
      (customer.storeName && String(customer.storeName).toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.userCode && String(customer.userCode).toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [mappedCustomers, searchTerm]);

  const paginatedCustomers = React.useMemo(() => {
    return filteredCustomers.slice(
      (page - 1) * rowsPerPage,
      page * rowsPerPage
    );
  }, [filteredCustomers, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredCustomers.length / rowsPerPage);
  
  const handleRowDoubleClick = (customer: CustomerWithUrl) => {
    if (isAdmin && customer && customer.Order_URL) {
      window.open(customer.Order_URL, '_blank', 'noopener,noreferrer');
    }
  };


  const headers = [
    { key: 'userCode', label: 'ユーザーコード' },
    { key: 'storeName', label: '店舗名' },
    { key: 'address', label: '住所' },
    { key: '電話番号', label: '電話番号' },
    { key: '機材有無', label: '機材有無' },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="店舗名、コードで検索..."
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
                {headers.map(header => <TableHead key={header.key}>{header.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={headers.length} className="h-24 text-center">
                    データを読み込んでいます...
                  </TableCell>
                </TableRow>
              ) : paginatedCustomers.length > 0 ? (
                paginatedCustomers.map((customer, index) => (
                  <TableRow 
                    key={customer.id || index}
                    onDoubleClick={() => handleRowDoubleClick(customer)}
                    className={cn(isAdmin && customer.Order_URL && "cursor-pointer")}
                  >
                    {headers.map(header => (
                      <TableCell key={header.key}>
                        {customer[header.key as keyof Customer] !== undefined && customer[header.key as keyof Customer] !== null ? String(customer[header.key as keyof Customer]) : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={headers.length} className="h-24 text-center">
                    {mappedCustomers.length === 0 && !searchTerm ? "販売店情報が見つかりません。" : "検索条件に合う販売店が見つかりません。"}
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
