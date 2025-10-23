
'use client';
import * as React from 'react';
import type { Customer } from '@/lib/types';
import { customerData } from '@/lib/data'; // Import local data
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

export function CustomerTable() {
  // Use local data directly
  const [customers] = React.useState<Customer[]>(customerData);
  const [isLoading, setIsLoading] = React.useState(false); // No real fetching, so set to false
  const [searchTerm, setSearchTerm] = React.useState('');
  const [page, setPage] = React.useState(1);
  const rowsPerPage = 10;

  const filteredCustomers = React.useMemo(() => {
    return customers.filter(customer =>
      customer && customer.userCode && customer.userCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  const paginatedCustomers = React.useMemo(() => {
    return filteredCustomers.slice(
      (page - 1) * rowsPerPage,
      page * rowsPerPage
    );
  }, [filteredCustomers, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredCustomers.length / rowsPerPage);

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
                <TableHead>No</TableHead>
                <TableHead>ユーザーコード</TableHead>
                <TableHead>店舗</TableHead>
                <TableHead>住所</TableHead>
                <TableHead>電話番号</TableHead>
                <TableHead>営業時間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    データを読み込んでいます...
                  </TableCell>
                </TableRow>
              ) : paginatedCustomers.length > 0 ? (
                paginatedCustomers.map((customer, index) => (
                  <TableRow key={customer.id || index}>
                    <TableCell className="font-medium">{customer.no}</TableCell>
                    <TableCell>{customer.userCode}</TableCell>
                    <TableCell>{customer.storeName}</TableCell>
                    <TableCell>{customer.address}</TableCell>
                    <TableCell>{customer.phoneNumber}</TableCell>
                    <TableCell>{customer.businessHours}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    {customers.length === 0 ? "顧客情報が見つかりません。" : "検索条件に合う顧客が見つかりません。"}
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
