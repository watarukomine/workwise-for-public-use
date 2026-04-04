
'use client';
import * as React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2, Download, Loader2, Settings2 } from 'lucide-react';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface OrderTableProps {
  orders: any[];
  isLoading: boolean;
}

// --- Known fields with special handling ---
const STATUS_OPTIONS = ['未割当', '作業待ち', '移動中', '作業中', '作業完了', '待機中', 'キャンセル'];
const EQUIPMENT_OPTIONS = ['○', '−', ''];

// Fields to exclude from display (internal/system fields)
const EXCLUDED_FIELDS = new Set([
  'raw', 'hasValidationIssues', 'validationWarnings', 'taskCalendarEventId',
  'travelCalendarEventId', 'Order_URL', 'createdAt', 'updatedAt',
  '__memo', 'isConfirmed', 'isEmergency',
]);

// Priority columns (shown first, in this order)
const PRIORITY_FIELDS = [
  'id', 'customerName', 'お取引先名', 'customerCode', 'ユーザーコード',
  'equipmentStatus', '機材有無', 'scheduledDate', '作業予定日',
  'scheduledTime', '予定時間', 'tireSize', 'タイヤサイズ', '本数',
  'staffName', '担当', 'status', '受注ステータス',
];

// Read-only fields
const READONLY_FIELDS = new Set(['id', 'displayId', 'rawOrderId']);

// Fields that should use dropdown select
const SELECT_FIELDS: Record<string, string[]> = {
  'status': STATUS_OPTIONS,
  '受注ステータス': STATUS_OPTIONS,
  'equipmentStatus': EQUIPMENT_OPTIONS,
  '機材有無': EQUIPMENT_OPTIONS,
};

// Column visibility storage key
const COLUMN_VISIBILITY_KEY = 'workwise_order_columns_v1';

// --- Dynamic column extraction ---
function extractColumns(orders: any[]): string[] {
  const fieldSet = new Set<string>();
  orders.forEach(order => {
    Object.keys(order).forEach(key => {
      if (!EXCLUDED_FIELDS.has(key)) {
        fieldSet.add(key);
      }
    });
  });

  // Sort: priority fields first, then alphabetically
  const allFields = Array.from(fieldSet);
  const prioritized: string[] = [];
  const rest: string[] = [];

  PRIORITY_FIELDS.forEach(pf => {
    if (allFields.includes(pf)) prioritized.push(pf);
  });

  allFields.forEach(f => {
    if (!prioritized.includes(f)) rest.push(f);
  });
  rest.sort();

  return [...prioritized, ...rest];
}

// --- EditableCell component ---
interface EditableCellProps {
  value: string;
  fieldKey: string;
  isReadonly: boolean;
  selectOptions?: string[];
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (newValue: string) => Promise<void>;
  onCancel: () => void;
  onNavigate: (direction: 'next' | 'prev') => void;
  staffNames: string[];
}

function EditableCell({ value, fieldKey, isReadonly, selectOptions, isEditing, onStartEdit, onSave, onCancel, onNavigate, staffNames }: EditableCellProps) {
  const [editValue, setEditValue] = React.useState(value);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing) { setEditValue(value); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [isEditing, value]);

  React.useEffect(() => {
    if (saveStatus !== 'idle') { const timer = setTimeout(() => setSaveStatus('idle'), 1200); return () => clearTimeout(timer); }
  }, [saveStatus]);

  const handleSave = async () => {
    if (editValue === value) { onCancel(); return; }
    setIsSaving(true);
    try { await onSave(editValue); setSaveStatus('success'); }
    catch { setSaveStatus('error'); setEditValue(value); }
    finally { setIsSaving(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    else if (e.key === 'Escape') { e.preventDefault(); setEditValue(value); onCancel(); }
    else if (e.key === 'Tab') { e.preventDefault(); handleSave(); onNavigate(e.shiftKey ? 'prev' : 'next'); }
  };

  if (isReadonly) {
    return <span className="text-xs text-muted-foreground font-mono truncate block max-w-[100px]" title={value}>{value ? value.slice(-8) : '−'}</span>;
  }

  const flashClass = saveStatus === 'success' ? 'animate-pulse bg-green-50 dark:bg-green-900/20' : saveStatus === 'error' ? 'animate-pulse bg-red-50 dark:bg-red-900/20' : '';

  // Determine if this is a staff dropdown
  const isStaffField = fieldKey === 'staffName' || fieldKey === '担当';
  const actualOptions = isStaffField ? staffNames : selectOptions;

  if (!isEditing) {
    if (actualOptions) {
      return (
        <div className={cn("cursor-pointer rounded px-1 py-0.5 transition-colors duration-300", flashClass)} onClick={onStartEdit}>
          <Badge variant={value === '未割当' ? 'secondary' : value === '作業完了' ? 'default' : 'outline'} className="text-xs">{value || '−'}</Badge>
        </div>
      );
    }
    return (
      <div className={cn("cursor-pointer rounded px-2 py-1 min-h-[28px] text-sm transition-colors duration-300 hover:bg-muted/60 border border-transparent hover:border-border/40 truncate max-w-[200px]", flashClass)} onClick={onStartEdit} title={value}>
        {value || <span className="text-muted-foreground/40">−</span>}
      </div>
    );
  }

  if (actualOptions) {
    return (
      <Select value={editValue} onValueChange={(val) => { setEditValue(val); setIsSaving(true); onSave(val).then(() => setSaveStatus('success')).catch(() => { setSaveStatus('error'); setEditValue(value); }).finally(() => setIsSaving(false)); }} open={isEditing} onOpenChange={(open) => { if (!open) onCancel(); }}>
        <SelectTrigger className="h-7 text-xs border-primary"><SelectValue placeholder="選択..." /></SelectTrigger>
        <SelectContent>{actualOptions.map(opt => (<SelectItem key={opt || '__empty'} value={opt || ' '}>{opt || '（なし）'}</SelectItem>))}</SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <Input ref={inputRef} type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSave} className="h-7 text-xs border-primary focus-visible:ring-2 focus-visible:ring-primary/30 px-1.5" disabled={isSaving} />
      {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />}
    </div>
  );
}

// --- CSV Export ---
function exportToCSV(orders: any[], columns: string[]) {
  const rows = orders.map(order => columns.map(col => {
    const val = order[col];
    return val !== undefined && val !== null ? String(val) : '';
  }));
  const csvContent = [columns, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
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

  // Extract all dynamic columns from data
  const allColumns = React.useMemo(() => extractColumns(rawOrders || []), [rawOrders]);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    // Default: show priority fields
    return new Set(PRIORITY_FIELDS.filter(f => allColumns.includes(f)));
  });

  // Update defaults when columns change
  React.useEffect(() => {
    if (visibleColumns.size === 0 && allColumns.length > 0) {
      setVisibleColumns(new Set(PRIORITY_FIELDS.filter(f => allColumns.includes(f))));
    }
  }, [allColumns]);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      try { localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  const displayColumns = React.useMemo(() => allColumns.filter(c => visibleColumns.has(c)), [allColumns, visibleColumns]);

  const filteredAndSortedOrders = React.useMemo(() => {
    const today = startOfToday();
    let ordersToDisplay = (rawOrders || []).filter(order => {
      const workDateStr = findKey(order, ['作業予定日', 'scheduledDate']);
      if (!workDateStr) return true;
      try {
        const workDate = parseISO(workDateStr);
        return isValid(workDate) && (isAfter(workDate, today) || isEqual(workDate, today));
      } catch { return false; }
    });

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      ordersToDisplay = ordersToDisplay.filter(order =>
        displayColumns.some(col => String(order[col] || '').toLowerCase().includes(term))
      );
    }

    ordersToDisplay.sort((a, b) => {
      const dateA = findKey(a, ['scheduledDate', '作業予定日']) || '';
      const dateB = findKey(b, ['scheduledDate', '作業予定日']) || '';
      return dateA.localeCompare(dateB);
    });

    return ordersToDisplay;
  }, [rawOrders, searchTerm, displayColumns]);

  const handleSaveCell = React.useCallback(async (orderId: string, fieldKey: string, newValue: string) => {
    await OrderService.updateOrder(orderId, { [fieldKey]: newValue });
    toast({ title: '保存しました', description: `${fieldKey} を更新しました。` });
    setEditingCell(null);
  }, [toast]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await OrderService.deleteOrder(deleteTarget);
      toast({ title: '削除しました' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '削除に失敗', description: e.message });
    }
    setDeleteTarget(null);
  }, [deleteTarget, toast]);

  const handleAddRow = React.useCallback(async () => {
    setIsCreating(true);
    try {
      const today = format(new Date(), 'yyyy/MM/dd');
      await OrderService.createOrder({ customerName: '', customerCode: '', address: '', taskDetails: '', serviceType: '', status: '未割当', scheduledDate: today, estimatedDuration: 30, value: 0 });
      toast({ title: '新規受注を追加しました' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '追加に失敗', description: e.message });
    }
    setIsCreating(false);
  }, [toast]);

  const handleNavigate = React.useCallback((rowId: string, colIdx: number, direction: 'next' | 'prev') => {
    const editableIndices = displayColumns.map((c, i) => READONLY_FIELDS.has(c) ? -1 : i).filter(i => i >= 0);
    const currentPos = editableIndices.indexOf(colIdx);
    if (direction === 'next') {
      const nextIdx = editableIndices[currentPos + 1];
      if (nextIdx !== undefined) setEditingCell({ rowId, colIdx: nextIdx });
      else {
        const rowIds = filteredAndSortedOrders.map(o => o.id);
        const ri = rowIds.indexOf(rowId);
        if (ri < rowIds.length - 1) setEditingCell({ rowId: rowIds[ri + 1], colIdx: editableIndices[0] });
        else setEditingCell(null);
      }
    } else {
      const prevIdx = editableIndices[currentPos - 1];
      if (prevIdx !== undefined) setEditingCell({ rowId, colIdx: prevIdx });
      else {
        const rowIds = filteredAndSortedOrders.map(o => o.id);
        const ri = rowIds.indexOf(rowId);
        if (ri > 0) setEditingCell({ rowId: rowIds[ri - 1], colIdx: editableIndices[editableIndices.length - 1] });
        else setEditingCell(null);
      }
    }
  }, [displayColumns, filteredAndSortedOrders]);

  return (
    <>
      <Card className="shadow-sm">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-9" />
            </div>
            <div className="flex items-center gap-2">
              {/* Column visibility toggle */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" />
                    列の表示 ({displayColumns.length}/{allColumns.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 max-h-[400px] overflow-auto p-3" align="end">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">表示する列を選択</p>
                  <div className="space-y-1.5">
                    {allColumns.map(col => (
                      <label key={col} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                        <Checkbox checked={visibleColumns.has(col)} onCheckedChange={() => toggleColumn(col)} className="h-3.5 w-3.5" />
                        <span className="truncate">{col}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredAndSortedOrders, displayColumns)} disabled={filteredAndSortedOrders.length === 0} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> CSV出力
              </Button>
              {isAdmin && (
                <Button size="sm" onClick={handleAddRow} disabled={isCreating} className="gap-1.5">
                  {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  新規追加
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="h-[65vh] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow className="hover:bg-transparent">
                  {displayColumns.map(col => (
                    <TableHead key={col} className="text-xs font-semibold whitespace-nowrap px-2">{col}</TableHead>
                  ))}
                  {isAdmin && <TableHead className="w-[40px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={displayColumns.length + (isAdmin ? 1 : 0)} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />読み込み中...</div>
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedOrders.length > 0 ? (
                  filteredAndSortedOrders.map((order) => (
                    <TableRow key={order.id} className={cn("transition-colors", editingCell?.rowId === order.id && "bg-primary/[0.02]")}>
                      {displayColumns.map((col, colIdx) => {
                        const val = order[col];
                        const strValue = val !== undefined && val !== null ? String(val) : '';
                        const isCellEditing = editingCell?.rowId === order.id && editingCell?.colIdx === colIdx;
                        const isReadonly = READONLY_FIELDS.has(col);
                        const selectOpts = SELECT_FIELDS[col];

                        return (
                          <TableCell key={col} className="py-1 px-1.5">
                            <EditableCell
                              value={strValue} fieldKey={col} isReadonly={isReadonly} selectOptions={selectOpts}
                              isEditing={!!isCellEditing}
                              onStartEdit={() => isAdmin && !isReadonly && setEditingCell({ rowId: order.id, colIdx })}
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
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(order.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={displayColumns.length + (isAdmin ? 1 : 0)} className="h-32 text-center text-muted-foreground">
                      {(rawOrders || []).length === 0 && !searchTerm ? "受注情報がありません。" : "検索条件に合う受注が見つかりません。"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>{filteredAndSortedOrders.length} 件表示</span>
            <span>セルをクリックして編集 · Tab で次のセルへ · ⚙️ 列の表示/非表示を切替</span>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>受注データを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
