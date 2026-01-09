
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
import { cn, findKey } from '@/lib/utils';
import { useUserProfile } from '@/hooks/use-user-profile';
import { CUSTOMER_SHEET_URL } from '@/lib/settings';

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
  if (rawData.length > 0) {
    console.log('First Customer Row Keys:', Object.keys(rawData[0]));
    console.log('First Customer Row Data:', rawData[0]);
  }

  return rawData.map(item => {
    let latitude: number | undefined = Number(findKey(item, ['緯度']));
    let longitude: number | undefined = Number(findKey(item, ['経度']));

    if (isNaN(latitude) || isNaN(longitude) || !latitude || !longitude) {
      const coordsValue = findKey(item, ['緯度・経度', '座標', '緯度経度']);
      if (typeof coordsValue === 'string' && coordsValue.includes(',')) {
        const parts = coordsValue.split(',').map(part => part.trim());
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon)) {
          latitude = lat;
          longitude = lon;
        }
      }
    }

    // Fallback for userCode: if undefined or null, use empty string to avoid display issues
    const userCode = item['ユーザーコード'] !== undefined && item['ユーザーコード'] !== null
      ? String(item['ユーザーコード'])
      : '';

    return {
      id: userCode || item['id'] || String(item['No'] || Math.random()),
      No: item['No'],
      userCode: userCode,
      '旧 チャネル SEQ': item['旧 チャネル SEQ'],
      storeName: findKey(item, ['店舗', '店舗名', 'storeName']),
      mainStoreCode: findKey(item, ['主管店舗コード', 'Main Store Code', 'mainStoreCode']),
      mainStore: findKey(item, ['主管店舗', 'Main Store', 'mainStore']), // Reverted '保管店舗'
      '管理C': findKey(item, ['管理C']),
      '機材有無': item['機材有無'],
      address: item['住所'],
      latitude: latitude,
      longitude: longitude,
      '電話番号': item['電話番号'],
      '営業時間': item['営業時間'],
      // Keep original keys for compatibility if needed elsewhere
      ...item
    }
  });
};


export function CustomerTable({ customers: rawCustomers, isLoading }: CustomerTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
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
      (customer.userCode && String(customer.userCode).toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.mainStore && String(customer.mainStore).toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [mappedCustomers, searchTerm]);


  const handleRowDoubleClick = () => {
    if (isAdmin && CUSTOMER_SHEET_URL) {
      window.open(CUSTOMER_SHEET_URL, '_blank', 'noopener,noreferrer');
    }
  };


  const headers = [
    { key: 'userCode', label: 'ユーザーコード' },
    { key: 'storeName', label: '店舗名' },
    { key: 'mainStore', label: '主管店舗' },
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
        <div className="rounded-md border h-[calc(100vh-250px)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
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
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer, index) => (
                  <TableRow
                    key={customer.id || index}
                    onDoubleClick={handleRowDoubleClick}
                    className={cn(isAdmin && CUSTOMER_SHEET_URL && "cursor-pointer")}
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
        <div className="flex items-center justify-between space-x-2 py-4">
          <span className="text-sm text-muted-foreground">
            全 {filteredCustomers.length} 件
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
