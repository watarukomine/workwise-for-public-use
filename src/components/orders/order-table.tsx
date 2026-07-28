
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
import { cn, findKey, formatDate, formatTime, normalizeDateStr } from '@/lib/utils';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { OrderService } from "@/services/order-service";
import { useCustomer } from '@/contexts/customer-context';


interface OrderTableProps {
  orders: any[]; // Use any[] to be flexible with raw GAS data
  isLoading: boolean;
}



const ORDER_KEYS: Record<string, string[]> = {
  '受注ID': ['systemId', 'SystemID', 'displayId', '受注 No', '受注 ID', '受注id', 'id', '受注ID'],
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
  '受注行番号',
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
  '受注行番号': 'displayId',
  '受注 No': 'displayId',
  'SystemID': 'id',
  'ユーザーコード': 'customerCode',
  '店舗名': 'customerName',
  '主管店舗': 'mainStore',
  '機材有無': 'equipmentStatus',
  '作業予定日': 'scheduledDate',
  '予定時間': 'scheduledTime',
  'ご担当者様': 'picName',
  'キャンセル日時': 'cancelDate',
  'キャンセル連絡者': 'cancelContact',
  '作業': 'taskDetails',
  '受注No(ﾘﾏｰｸ1 8ｹﾀ)': 'orderNo',
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
  const [showPastOrders, setShowPastOrders] = React.useState(false); // Default to showing today & future orders
  
  // Dialog States
  const [selectedOrder, setSelectedOrder] = React.useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  const { profile } = useUserProfile();
  const isAdmin = profile?.role === 'admin';
  const { customers } = useCustomer();

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
    
    if (header === 'お取引先名') {
      const currentName = value !== undefined && value !== null ? String(value) : '';
      if (currentName && currentName !== '（店舗名未設定）' && currentName !== '(店舗名未設定)' && currentName !== '店舗名未設定') {
        return currentName;
      }
      const customerCode = findKey(order, ['お取引先コード', '顧客コード', 'customerCode', 'ユーザーコード']);
      if (customerCode && customers) {
        const paddedCode = String(customerCode).trim().padStart(5, '0');
        const match = customers.find(c => {
          const cCode = c.userCode || c['ユーザーコード'] || '';
          return String(cCode).trim().padStart(5, '0') === paddedCode;
        });
        if (match && match.storeName) {
          return match.storeName;
        }
      }
      return '(店舗名未設定)';
    }

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
  }, [customers]);

  const filteredAndSortedOrders = React.useMemo(() => {
    const searchLower = debouncedSearch.trim().toLowerCase();
    const todayStr = normalizeDateStr(new Date());

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
    } else if (!showPastOrders) {
        // If not searching AND showPastOrders is false, filter to only show today and future orders
        ordersToDisplay = ordersToDisplay.filter(order => {
            const workDateRaw = findKey(order, [
              '作業予定日', 'scheduledDate', '日付', '予定日', 'date', 
              'workScheduledDate', 'シフト日', '勤務日', '出勤日'
            ]) || (order.raw ? findKey(order.raw, ['作業予定日', 'scheduledDate', '日付']) : undefined);

            if (!workDateRaw) return true; // Keep undated tasks as current/new tasks
            const normWorkDate = normalizeDateStr(workDateRaw);
            if (!normWorkDate) return true;
            return normWorkDate >= todayStr;
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
    setSelectedOrder(order);
    const formInit: Record<string, any> = {};
    const raw = order.raw || {};
    EXPORT_HEADERS.forEach(h => {
      const normalize = (s: string) => s.replace(/[\s\u3000]+/g, '').replace(/[\r\n]/g, '').toLowerCase();
      const normH = normalize(h);
      let val = undefined;
      for (const rawKey in raw) {
        if (normalize(rawKey) === normH) {
          val = raw[rawKey];
          break;
        }
      }
      if (val === undefined || val === null || val === '') {
        const key = EXPORT_MAPPING[h];
        val = key ? order[key] : undefined;
      }
      formInit[h] = val !== undefined && val !== null ? val : '';
    });
    // Explicit mapping for displayId (A column) and orderNo (M column)
    const displayIdVal = order.displayId || formInit['受注行番号'] || formInit['受注 No'] || '';
    const remark1Val = order.orderNo || order.orderNoRemark || formInit['受注No(ﾘﾏｰｸ1 8ｹﾀ)'] || '';
    formInit['受注行番号'] = displayIdVal;
    formInit['受注 No'] = displayIdVal;
    formInit['受注No(ﾘﾏｰｸ1 8ｹﾀ)'] = remark1Val;
    formInit['orderNo'] = remark1Val;
    formInit['orderNoRemark'] = remark1Val;

    // Explicit mappings for non-standard or custom fields
    formInit['isEmergency'] = order.isEmergency || false;
    formInit['emergencyMessage'] = order.emergencyMessage || '';
    formInit['adminReply'] = order.adminReply || '';
    formInit['comment'] = order.comment || formInit['任意コメント(ﾘﾏｰｸ2　10ｹﾀ)'] || '';
    formInit['任意コメント(ﾘﾏｰｸ2　10ｹﾀ)'] = formInit['comment'];

    // Progress fields fallback from Order object & Firestore
    const formatTimeVal = (val: any) => {
      if (!val) return '';
      if (typeof val === 'string' && val.includes('T')) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      }
      return String(val);
    };

    const formatDateVal = (val: any) => {
      if (!val) return '';
      if (typeof val === 'string' && val.includes('T')) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      }
      return String(val);
    };

    formInit['既読確認'] = formInit['既読確認'] || formatDateVal(order.confirmedAt) || order.readConfirmation || '';
    formInit['移動開始'] = formInit['移動開始'] || formatTimeVal(order.startTravelTime) || order.startTravel || '';
    formInit['現場到着'] = formInit['現場到着'] || formatTimeVal(order.arrivalTimestamp) || order.arrival || '';
    formInit['作業開始'] = formInit['作業開始'] || formatTimeVal(order.actualStartTime) || order.startWork || '';
    formInit['作業完了'] = formInit['作業完了'] || formatTimeVal(order.actualEndTime) || order.completeWork || '';
    formInit['作業所要時間'] = formInit['作業所要時間'] || order.actualDuration || order.workDuration || '';
    formInit['出勤ボタン'] = formInit['出勤ボタン'] || order.clockIn || '';
    formInit['退勤ボタン'] = formInit['退勤ボタン'] || order.clockOut || '';
    formInit['最終位置情報（緯度,経度）'] = formInit['最終位置情報（緯度,経度）'] || order.lastLocation || (order.latitude && order.longitude ? `${order.latitude}, ${order.longitude}` : '');
    formInit['チップ配置作業予定'] = formInit['チップ配置作業予定'] || order.chipWorkScheduled || '';
    formInit['チップ配置作業完了予定'] = formInit['チップ配置作業完了予定'] || order.chipWorkCompleted || '';

    // Auto-resolve storeName from customerMaster on details dialog load
    const currentStoreName = formInit['店舗名'] || '';
    if (currentStoreName === '' || currentStoreName === '（店舗名未設定）' || currentStoreName === '(店舗名未設定)' || currentStoreName === '店舗名未設定') {
      const code = formInit['ユーザーコード'] || '';
      if (code && customers) {
        const paddedCode = String(code).trim().padStart(5, '0');
        const match = customers.find(c => {
          const cCode = c.userCode || c['ユーザーコード'] || '';
          return String(cCode).trim().padStart(5, '0') === paddedCode;
        });
        if (match && match.storeName) {
          formInit['店舗名'] = match.storeName;
        }
      }
    }
    
    setEditForm(formInit);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedOrder) return;
    setIsSaving(true);
    try {
      const updateData: Record<string, any> = {};
      
      EXPORT_HEADERS.forEach(h => {
        const key = EXPORT_MAPPING[h];
        if (key) {
          const val = editForm[h];
          if (val === '') {
            updateData[key] = '';
          } else if (['quantity'].includes(key)) {
            updateData[key] = Number(val);
          } else {
            updateData[key] = val;
          }
        }
      });
      
      const remark1Val = editForm['受注No(ﾘﾏｰｸ1 8ｹﾀ)'] || editForm['orderNo'] || editForm['orderNoRemark'] || '';
      updateData.orderNo = remark1Val;
      updateData.orderNoRemark = remark1Val;

      updateData.isEmergency = editForm['isEmergency'] || false;
      updateData.emergencyMessage = editForm['emergencyMessage'] || '';
      updateData.adminReply = editForm['adminReply'] || '';
      updateData.comment = editForm['comment'] || editForm['任意コメント(ﾘﾏｰｸ2　10ｹﾀ)'] || '';

      const updatedRaw = { ...(selectedOrder.raw || {}) };
      EXPORT_HEADERS.forEach(h => {
        updatedRaw[h] = editForm[h];
      });
      updatedRaw['受注 No'] = remark1Val;
      updatedRaw['受注No(ﾘﾏｰｸ1 8ｹﾀ)'] = remark1Val;
      updateData.raw = updatedRaw;

      await OrderService.updateOrder(selectedOrder.id, updateData);
      setIsDialogOpen(false);
      alert('受注データを更新しました。');
    } catch (e: any) {
      console.error(e);
      alert(`更新に失敗しました: ${e.message}`);
    } finally {
      setIsSaving(false);
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
    <>
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
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <div className="flex items-center gap-2 border px-3 py-1.5 rounded-md bg-muted/30">
              <Switch
                id="show-past-orders"
                checked={showPastOrders}
                onCheckedChange={setShowPastOrders}
              />
              <Label htmlFor="show-past-orders" className="text-xs cursor-pointer font-medium whitespace-nowrap">
                過去データも表示 ({showPastOrders ? '全件表示中' : '本日以降のみ'})
              </Label>
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">並び順:</span>
            <Select value={sortType} onValueChange={(value: 'spreadsheet' | 'scheduledDate') => setSortType(value)}>
              <SelectTrigger className="w-[160px]">
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
                  return (
                    <TableRow 
                      key={order.id || index}
                      onDoubleClick={() => handleRowClick(order)}
                      className={cn(isAdmin && "cursor-pointer hover:bg-muted/50")}
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

    {/* 受注詳細・編集ダイアログ */}
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center justify-between">
            <span>受注詳細・編集</span>
            {selectedOrder && (
              <span className="text-sm font-normal text-muted-foreground mr-6">
                ID: {selectedOrder.id}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {selectedOrder && (
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">基本情報</TabsTrigger>
              <TabsTrigger value="task">作業・車両</TabsTrigger>
              <TabsTrigger value="status">進行状況</TabsTrigger>
              <TabsTrigger value="other">緊急・その他</TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              {/* 1. 基本情報タブ */}
              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayId">受注行番号</Label>
                    <Input
                      id="displayId"
                      value={editForm['受注行番号'] || editForm['受注 No'] || editForm['displayId'] || selectedOrder.displayId || ''}
                      onChange={(e) => setEditForm(prev => ({ 
                        ...prev, 
                        '受注行番号': e.target.value,
                        '受注 No': e.target.value 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="SystemID">SystemID</Label>
                    <Input
                      id="SystemID"
                      value={editForm['SystemID'] || ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userCode">ユーザーコード</Label>
                    <Input
                      id="userCode"
                      value={editForm['ユーザーコード'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, 'ユーザーコード': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerName">店舗名</Label>
                    <Input
                      id="customerName"
                      value={editForm['店舗名'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '店舗名': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mainStore">主管店舗</Label>
                    <Input
                      id="mainStore"
                      value={editForm['主管店舗'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '主管店舗': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="picName">ご担当者様</Label>
                    <Input
                      id="picName"
                      value={editForm['ご担当者様'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, 'ご担当者様': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">作業予定日 (yyyy/MM/dd)</Label>
                    <Input
                      id="scheduledDate"
                      value={editForm['作業予定日'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '作業予定日': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduledTime">予定時間 (HH:mm)</Label>
                    <Input
                      id="scheduledTime"
                      value={editForm['予定時間'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '予定時間': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staffName">担当スタッフ</Label>
                    <Input
                      id="staffName"
                      value={editForm['担当'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '担当': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">受注ステータス</Label>
                    <Select
                      value={editForm['受注ステータス'] || '未割当'}
                      onValueChange={(val) => setEditForm(prev => ({ ...prev, '受注ステータス': val }))}
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder="ステータスを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="未割当">未割当</SelectItem>
                        <SelectItem value="作業待ち">作業待ち</SelectItem>
                        <SelectItem value="移動中">移動中</SelectItem>
                        <SelectItem value="作業中">作業中</SelectItem>
                        <SelectItem value="作業完了">作業完了</SelectItem>
                        <SelectItem value="キャンセル">キャンセル</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* 2. 作業・車両詳細タブ */}
              <TabsContent value="task" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="task">作業</Label>
                    <Input
                      id="task"
                      value={editForm['作業'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '作業': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serviceType">作業内容</Label>
                    <Input
                      id="serviceType"
                      value={editForm['作業内容'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '作業内容': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productName">品名</Label>
                    <Input
                      id="productName"
                      value={editForm['品名'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '品名': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tireNumber">タイヤ品番</Label>
                    <Input
                      id="tireNumber"
                      value={editForm['タイヤ品番'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, 'タイヤ品番': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tireSize">タイヤサイズ</Label>
                    <Input
                      id="tireSize"
                      value={editForm['タイヤサイズ'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, 'タイヤサイズ': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">本数</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={editForm['本数'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '本数': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sensor">空気圧センサーパッキン交換</Label>
                    <Input
                      id="sensor"
                      value={editForm['空気圧センサーパッキン交換'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '空気圧センサーパッキン交換': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arrangement">タイヤ手配状況</Label>
                    <Input
                      id="arrangement"
                      value={editForm['タイヤ手配状況'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, 'タイヤ手配状況': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="disposal">廃タイヤ処分</Label>
                    <Input
                      id="disposal"
                      value={editForm['廃タイヤ処分'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '廃タイヤ処分': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="equipmentStatus">機材有無</Label>
                    <Input
                      id="equipmentStatus"
                      value={editForm['機材有無'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '機材有無': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">連絡先</Label>
                    <Input
                      id="contact"
                      value={editForm['連絡先'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '連絡先': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carName">車名</Label>
                    <Input
                      id="carName"
                      value={editForm['車名'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '車名': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regNo">登録ナンバー(下４桁)</Label>
                    <Input
                      id="regNo"
                      value={editForm['登録ナンバー(下４桁)'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '登録ナンバー(下４桁)': e.target.value }))}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* 3. 進行状況タブ */}
              <TabsContent value="status" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="entryStatus">入庫状況</Label>
                    <Input
                      id="entryStatus"
                      value={editForm['入庫状況'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '入庫状況': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="readConfirmation">既読確認</Label>
                    <Input
                      id="readConfirmation"
                      value={editForm['既読確認'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '既読確認': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clockIn">出勤ボタン</Label>
                    <Input
                      id="clockIn"
                      value={editForm['出勤ボタン'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '出勤ボタン': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTravel">移動開始</Label>
                    <Input
                      id="startTravel"
                      value={editForm['移動開始'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '移動開始': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arrival">現場到着</Label>
                    <Input
                      id="arrival"
                      value={editForm['現場到着'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '現場到着': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startWork">作業開始</Label>
                    <Input
                      id="startWork"
                      value={editForm['作業開始'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '作業開始': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="completeWork">作業完了</Label>
                    <Input
                      id="completeWork"
                      value={editForm['作業完了'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '作業完了': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workDuration">作業所要時間</Label>
                    <Input
                      id="workDuration"
                      value={editForm['作業所要時間'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '作業所要時間': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clockOut">退勤ボタン</Label>
                    <Input
                      id="clockOut"
                      value={editForm['退勤ボタン'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '退勤ボタン': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastLocation">最終位置情報（緯度,経度）</Label>
                    <Input
                      id="lastLocation"
                      value={editForm['最終位置情報（緯度,経度）'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '最終位置情報（緯度,経度）': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chipWorkScheduled">チップ配置作業予定</Label>
                    <Input
                      id="chipWorkScheduled"
                      value={editForm['チップ配置作業予定'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, 'チップ配置作業予定': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chipWorkCompleted">チップ配置作業完了予定</Label>
                    <Input
                      id="chipWorkCompleted"
                      value={editForm['チップ配置作業完了予定'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, 'チップ配置作業完了予定': e.target.value }))}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* 4. 緊急・その他タブ */}
              <TabsContent value="other" className="space-y-4">
                <div className="flex items-center space-x-2 py-2">
                  <Switch
                    id="isEmergency"
                    checked={editForm['isEmergency'] || false}
                    onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, 'isEmergency': checked }))}
                  />
                  <Label htmlFor="isEmergency" className="font-bold text-destructive">緊急フラグ</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyMessage">緊急連絡内容</Label>
                  <Textarea
                    id="emergencyMessage"
                    value={editForm['emergencyMessage'] || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, 'emergencyMessage': e.target.value }))}
                    placeholder="緊急時の連絡事項を入力..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminReply">管理者返信</Label>
                  <Textarea
                    id="adminReply"
                    value={editForm['adminReply'] || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, 'adminReply': e.target.value }))}
                    placeholder="管理者からの指示や返信を入力..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="comment">任意コメント(ﾘﾏｰｸ2 10ｹﾀ)</Label>
                    <Input
                      id="comment"
                      value={editForm['任意コメント(ﾘﾏｰｸ2　10ｹﾀ)'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '任意コメント(ﾘﾏｰｸ2　10ｹﾀ)': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orderNoRemark">受注No(ﾘﾏｰｸ1 8ｹﾀ)</Label>
                    <Input
                      id="orderNoRemark"
                      value={editForm['受注No(ﾘﾏｰｸ1 8ｹﾀ)'] || editForm['orderNo'] || editForm['orderNoRemark'] || selectedOrder.orderNo || ''}
                      onChange={(e) => setEditForm(prev => ({ 
                        ...prev, 
                        '受注No(ﾘﾏｰｸ1 8ｹﾀ)': e.target.value,
                        'orderNo': e.target.value,
                        'orderNoRemark': e.target.value 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="submitter">フォーム入力者</Label>
                    <Input
                      id="submitter"
                      value={editForm['フォーム入力者'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, 'フォーム入力者': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cancelDate">キャンセル日時</Label>
                    <Input
                      id="cancelDate"
                      value={editForm['キャンセル日時'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, 'キャンセル日時': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cancelContact">キャンセル連絡者</Label>
                    <Input
                      id="cancelContact"
                      value={editForm['キャンセル連絡者'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, 'キャンセル連絡者': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specialNotes">特記事項</Label>
                    <Textarea
                      id="specialNotes"
                      value={editForm['特記事項'] || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, '特記事項': e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="updatedAt">最終更新日時</Label>
                    <Input
                      id="updatedAt"
                      value={editForm['最終更新日時'] || ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="min-w-[80px]">
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
