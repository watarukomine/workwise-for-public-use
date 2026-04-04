
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
import { Search, Plus, Trash2, Download, Loader2, Check, X } from 'lucide-react';
import { cn, findKey } from '@/lib/utils';
import { format, isValid, parseISO, startOfToday, isAfter, isEqual } from 'date-fns';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { OrderService } from '@/services/order-service';
import { useToast } from '@/hooks/use-toast';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OrderTableProps {
  orders: any[];
  isLoading: boolean;
}

// --- Column definition ---
type ColumnType = 'text' | 'number' | 'date' | 'time' | 'select' | 'readonly';

interface ColumnDef {
  header: string;
  fieldKey: string;          // primary Firestore field key
  lookupKeys: string[];      // fallback keys for reading
  type: ColumnType;
  options?: string[];        // for select type
  width?: string;
}

const STATUS_OPTIONS = ['未割当', '作業待ち', '移動中', '作業中', '作業完了', '待機中', 'キャンセル'];
const EQUIPMENT_OPTIONS = ['○', '−', ''];

const COLUMNS: ColumnDef[] = [
  { header: '受注ID', fieldKey: 'id', lookupKeys: ['受注 ID', '受注id', 'id'], type: 'readonly', width: 'w-[90px]' },
  { header: 'お取引先名', fieldKey: 'customerName', lookupKeys: ['お取引先名', '店舗', 'customerName'], type: 'text', width: 'min-w-[140px]' },
  { header: '機材有無', fieldKey: 'equipmentStatus', lookupKeys: ['機材有無', 'equipmentStatus'], type: 'select', options: EQUIPMENT_OPTIONS, width: 'w-[80px]' },
  { header: '作業予定日', fieldKey: 'scheduledDate', lookupKeys: ['作業予定日', 'scheduledDate'], type: 'date', width: 'w-[130px]' },
  { header: '予定時間', fieldKey: 'scheduledTime', lookupKeys: ['予定時間', 'scheduledTime'], type: 'time', width: 'w-[100px]' },
  { header: 'タイヤサイズ', fieldKey: 'tireSize', lookupKeys: ['タイヤサイズ', 'tireSize'], type: 'text', width: 'w-[120px]' },
  { header: '本数', fieldKey: '本数', lookupKeys: ['本数', 'honsu'], type: 'number', width: 'w-[60px]' },
  { header: '担当', fieldKey: 'staffName', lookupKeys: ['担当', 'staffName'], type: 'select', options: [], width: 'w-[100px]' },
  { header: 'ステータス', fieldKey: 'status', lookupKeys: ['受注ステータス', 'status'], type: 'select', options: STATUS_OPTIONS, width: 'w-[120px]' },
];

// --- EditableCell component ---
interface EditableCellProps {
  value: string;
  column: ColumnDef;
  orderId: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (newValue: string) => Promise<void>;
  onCancel: () => void;
  onNavigate: (direction: 'next' | 'prev' | 'down') => void;
  staffNames: string[];
}

function EditableCell({ value, column, orderId, isEditing, onStartEdit, onSave, onCancel, onNavigate, staffNames }: EditableCellProps) {
  const [editValue, setEditValue] = React.useState(value);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing) {
      setEditValue(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, value]);

  React.useEffect(() => {
    if (saveStatus !== 'idle') {
      const timer = setTimeout(() => setSaveStatus('idle'), 1200);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const handleSave = async () => {
    if (editValue === value) {
      onCancel();
      return;
    }
    setIsSaving(true);
    try {
      await onSave(editValue);
      setSaveStatus('success');
    } catch {
      setSaveStatus('error');
      setEditValue(value); // revert
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(value);
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleSave();
      onNavigate(e.shiftKey ? 'prev' : 'next');
    }
  };

  if (column.type === 'readonly') {
    return (
      <span className="text-xs text-muted-foreground font-mono truncate block max-w-[80px]" title={value}>
        {value ? value.slice(-6) : ''}
      </span>
    );
  }

  // Flash animation classes
  const flashClass = saveStatus === 'success'
    ? 'animate-pulse bg-green-50 dark:bg-green-900/20'
    : saveStatus === 'error'
    ? 'animate-pulse bg-red-50 dark:bg-red-900/20'
    : '';

  if (!isEditing) {
    // Display mode
    if (column.type === 'select' && column.header === 'ステータス') {
      return (
        <div
          className={cn("cursor-pointer rounded px-1 py-0.5 transition-colors duration-300", flashClass)}
          onClick={onStartEdit}
        >
          <Badge variant={value === '未割当' ? 'secondary' : value === '作業完了' ? 'default' : 'outline'} className="text-xs">
            {value || '−'}
          </Badge>
        </div>
      );
    }
    return (
      <div
        className={cn(
          "cursor-pointer rounded px-2 py-1 min-h-[28px] text-sm transition-colors duration-300 hover:bg-muted/60 border border-transparent hover:border-border/40",
          flashClass
        )}
        onClick={onStartEdit}
      >
        {value || <span className="text-muted-foreground/40">−</span>}
      </div>
    );
  }

  // Edit mode: select
  if (column.type === 'select') {
    const options = column.header === '担当' ? staffNames : (column.options || []);
    return (
      <Select
        value={editValue}
        onValueChange={(val) => {
          setEditValue(val);
          // Auto-save on select
          setIsSaving(true);
          onSave(val).then(() => setSaveStatus('success')).catch(() => {
            setSaveStatus('error');
            setEditValue(value);
          }).finally(() => setIsSaving(false));
        }}
        open={isEditing}
        onOpenChange={(open) => { if (!open) onCancel(); }}
      >
        <SelectTrigger className="h-7 text-xs border-primary focus:ring-2 focus:ring-primary/30">
          <SelectValue placeholder="選択..." />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt || '__empty'} value={opt || ' '}>
              {opt || '（なし）'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Edit mode: input
  const inputType = column.type === 'date' ? 'date' : column.type === 'time' ? 'time' : column.type === 'number' ? 'number' : 'text';

  return (
    <div className="flex items-center gap-0.5">
      <Input
        ref={inputRef}
        type={inputType}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        className="h-7 text-xs border-primary focus-visible:ring-2 focus-visible:ring-primary/30 px-1.5"
        disabled={isSaving}
      />
      {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />}
    </div>
  );
}

// --- CSV Export ---
function exportToCSV(orders: any[], columns: ColumnDef[]) {
  const headers = columns.map(c => c.header);
  const rows = orders.map(order =>
    columns.map(col => {
      const val = findKey(order, col.lookupKeys);
      return val !== undefined && val !== null ? String(val) : '';
    })
  );

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  // BOM + UTF-8 for Excel compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `受注一覧_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Main component ---
export function OrderTable({ orders: rawOrders, isLoading }: OrderTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [editingCell, setEditingCell] = React.useState<{ rowId: string; colIdx: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const { profile } = useUserProfile();
  const { allStaff } = useSelectedStaff();
  const { toast } = useToast();
  const isAdmin = profile?.role === 'admin';

  const staffNames = React.useMemo(() => allStaff.map(s => s.name).filter(Boolean), [allStaff]);

  // Enrich columns with dynamic staff names
  const columns = React.useMemo(() =>
    COLUMNS.map(col => col.header === '担当' ? { ...col, options: staffNames } : col),
    [staffNames]
  );

  const filteredAndSortedOrders = React.useMemo(() => {
    const today = startOfToday();
    let ordersToDisplay = (rawOrders || []).filter(order => {
      const workDateStr = findKey(order, ['作業予定日', 'scheduledDate']);
      if (!workDateStr) return true; // show orders without date
      try {
        const workDate = parseISO(workDateStr);
        return isValid(workDate) && (isAfter(workDate, today) || isEqual(workDate, today));
      } catch {
        return false;
      }
    });

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      ordersToDisplay = ordersToDisplay.filter(order =>
        columns.some(col =>
          String(findKey(order, col.lookupKeys) || '').toLowerCase().includes(term)
        )
      );
    }

    ordersToDisplay.sort((a, b) => {
      const dateA = findKey(a, ['scheduledDate', '作業予定日']) || '';
      const dateB = findKey(b, ['scheduledDate', '作業予定日']) || '';
      return dateA.localeCompare(dateB);
    });

    return ordersToDisplay;
  }, [rawOrders, searchTerm, columns]);

  // --- Cell value getter ---
  const getCellValue = (order: any, col: ColumnDef): string => {
    const val = findKey(order, col.lookupKeys);
    if (val === undefined || val === null) return '';
    if (col.type === 'date') {
      try {
        const d = parseISO(String(val));
        return isValid(d) ? format(d, 'yyyy-MM-dd') : String(val);
      } catch { return String(val); }
    }
    return String(val);
  };

  // --- Save handler ---
  const handleSaveCell = React.useCallback(async (orderId: string, col: ColumnDef, newValue: string) => {
    const updateData: Record<string, any> = {};
    updateData[col.fieldKey] = col.type === 'number' ? (newValue ? Number(newValue) : 0) : newValue;

    // Also update lookup aliases for compatibility
    if (col.lookupKeys.length > 1) {
      col.lookupKeys.forEach(key => {
        if (key !== col.fieldKey) {
          updateData[key] = updateData[col.fieldKey];
        }
      });
    }

    await OrderService.updateOrder(orderId, updateData);
    toast({ title: '保存しました', description: `${col.header} を更新しました。` });
    setEditingCell(null);
  }, [toast]);

  // --- Delete handler ---
  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await OrderService.deleteOrder(deleteTarget);
      toast({ title: '削除しました', description: '受注データを削除しました。' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '削除に失敗', description: e.message });
    }
    setDeleteTarget(null);
  }, [deleteTarget, toast]);

  // --- New row handler ---
  const handleAddRow = React.useCallback(async () => {
    setIsCreating(true);
    try {
      const today = format(new Date(), 'yyyy/MM/dd');
      const newId = await OrderService.createOrder({
        customerName: '',
        customerCode: '',
        address: '',
        taskDetails: '',
        serviceType: '',
        status: '未割当',
        scheduledDate: today,
        estimatedDuration: 30,
        value: 0,
        equipmentStatus: '',
      });
      toast({ title: '新規受注を追加しました', description: '各セルをクリックして情報を入力してください。' });
      // Auto-edit the customer name cell of the new row
      setTimeout(() => {
        setEditingCell({ rowId: newId, colIdx: 1 });
      }, 500);
    } catch (e: any) {
      toast({ variant: 'destructive', title: '追加に失敗', description: e.message });
    }
    setIsCreating(false);
  }, [toast]);

  // --- Navigation between cells ---
  const handleNavigate = React.useCallback((rowId: string, colIdx: number, direction: 'next' | 'prev' | 'down') => {
    const editableIndices = columns.map((c, i) => c.type !== 'readonly' ? i : -1).filter(i => i >= 0);
    const currentEditablePos = editableIndices.indexOf(colIdx);

    if (direction === 'next') {
      const nextIdx = editableIndices[currentEditablePos + 1];
      if (nextIdx !== undefined) {
        setEditingCell({ rowId, colIdx: nextIdx });
      } else {
        // Move to next row, first editable column
        const rowIds = filteredAndSortedOrders.map(o => o.id);
        const currentRowIdx = rowIds.indexOf(rowId);
        if (currentRowIdx < rowIds.length - 1) {
          setEditingCell({ rowId: rowIds[currentRowIdx + 1], colIdx: editableIndices[0] });
        } else {
          setEditingCell(null);
        }
      }
    } else if (direction === 'prev') {
      const prevIdx = editableIndices[currentEditablePos - 1];
      if (prevIdx !== undefined) {
        setEditingCell({ rowId, colIdx: prevIdx });
      } else {
        const rowIds = filteredAndSortedOrders.map(o => o.id);
        const currentRowIdx = rowIds.indexOf(rowId);
        if (currentRowIdx > 0) {
          setEditingCell({ rowId: rowIds[currentRowIdx - 1], colIdx: editableIndices[editableIndices.length - 1] });
        } else {
          setEditingCell(null);
        }
      }
    }
  }, [columns, filteredAndSortedOrders]);

  return (
    <>
      <Card className="shadow-sm">
        <CardContent className="pt-5">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="受注ID、お取引先名、担当者で絞り込み..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(filteredAndSortedOrders, columns)}
                disabled={filteredAndSortedOrders.length === 0}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                CSV出力
              </Button>
              {isAdmin && (
                <Button
                  size="sm"
                  onClick={handleAddRow}
                  disabled={isCreating}
                  className="gap-1.5"
                >
                  {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  新規追加
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <ScrollArea className="h-[65vh] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow className="hover:bg-transparent">
                  {columns.map((col) => (
                    <TableHead key={col.header} className={cn("text-xs font-semibold whitespace-nowrap", col.width)}>
                      {col.header}
                    </TableHead>
                  ))}
                  {isAdmin && <TableHead className="w-[40px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + (isAdmin ? 1 : 0)} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        データを読み込んでいます...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedOrders.length > 0 ? (
                  filteredAndSortedOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className={cn(
                        "transition-colors",
                        editingCell?.rowId === order.id && "bg-primary/[0.02]"
                      )}
                    >
                      {columns.map((col, colIdx) => {
                        const cellValue = getCellValue(order, col);
                        const isCellEditing = editingCell?.rowId === order.id && editingCell?.colIdx === colIdx;

                        return (
                          <TableCell
                            key={col.header}
                            className={cn("py-1 px-1.5", col.width)}
                          >
                            <EditableCell
                              value={cellValue}
                              column={col}
                              orderId={order.id}
                              isEditing={!!isCellEditing}
                              onStartEdit={() => isAdmin && col.type !== 'readonly' && setEditingCell({ rowId: order.id, colIdx })}
                              onSave={(newVal) => handleSaveCell(order.id, col, newVal)}
                              onCancel={() => setEditingCell(null)}
                              onNavigate={(dir) => handleNavigate(order.id, colIdx, dir)}
                              staffNames={staffNames}
                            />
                          </TableCell>
                        );
                      })}
                      {isAdmin && (
                        <TableCell className="py-1 px-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(order.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length + (isAdmin ? 1 : 0)} className="h-32 text-center text-muted-foreground">
                      {(rawOrders || []).length === 0 && !searchTerm
                        ? "表示対象の受注情報が見つかりません。「新規追加」ボタンから受注を登録してください。"
                        : "検索条件に合う受注が見つかりません。"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>{filteredAndSortedOrders.length} 件表示</span>
            <span>セルをクリックして編集 · Tab で次のセルへ移動</span>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>受注データを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。この受注データは Firestore から完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
