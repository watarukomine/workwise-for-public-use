
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

interface CustomerTableProps {
  customers: any[]; // Use any[] to be flexible with GAS data
  isLoading: boolean;
}

export function CustomerTable({ customers, isLoading }: CustomerTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [page, setPage] = React.useState(1);
  const rowsPerPage = 10;

  const validCustomers = Array.isArray(customers) ? customers : [];

  const filteredCustomers = React.useMemo(() => {
    if (searchTerm.trim() === '') {
      return validCustomers;
    }
    return validCustomers.filter(customer =>
      customer && customer['ユーザーコード'] && String(customer['ユーザーコード']).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [validCustomers, searchTerm]);

  const paginatedCustomers = React.useMemo(() => {
    return filteredCustomers.slice(
      (page - 1) * rowsPerPage,
      page * rowsPerPage
    );
  }, [filteredCustomers, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredCustomers.length / rowsPerPage);

  const headers = [
    'No', 'ユーザーコード', '旧 チャネル SEQ', '店舗', '管理C', '機材有無', 
    '住所', '緯度', '経度', '電話番号', '営業時間'
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ユーザーコードで検索..."
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
                  <TableRow key={customer['ユーザーコード'] || index}>
                    {headers.map(header => (
                      <TableCell key={header}>
                        {customer[header] !== undefined && customer[header] !== null ? String(customer[header]) : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={headers.length} className="h-24 text-center">
                    {validCustomers.length === 0 && !searchTerm ? "販売店情報が見つかりません。" : "検索条件に合う販売店が見つかりません。"}
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
