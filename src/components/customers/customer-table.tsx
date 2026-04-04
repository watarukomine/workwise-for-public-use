
'use client';
import * as React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2, Download, Loader2 } from 'lucide-react';
import { cn, findKey } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useToast } from '@/hooks/use-toast';
import { CustomerService } from '@/services/customer-service';
import { format } from 'date-fns';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CustomerTableProps {
  customers: any[];
  isLoading: boolean;
}

// --- Column definitions ---
type ColumnType = 'text' | 'number' | 'select' | 'readonly';

interface ColumnDef {
  header: string;
  fieldKey: string;
  lookupKeys: string[];
  type: ColumnType;
  options?: string[];
  width?: string;
}

const EQUIPMENT_OPTIONS = ['○', '−', ''];

const COLUMNS: ColumnDef[] = [
  { header: 'ユーザーコード', fieldKey: 'ユーザーコード', lookupKeys: ['ユーザーコード', 'userCode'], type: 'text', width: 'w-[120px]' },
  { header: '店舗名', fieldKey: '店舗', lookupKeys: ['店舗', '店舗名', 'storeName'], type: 'text', width: 'min-w-[160px]' },
  { header: '主管店舗', fieldKey: '母店', lookupKeys: ['主管店舗', '主管店舗名', '母店', '母店名', 'mainStore'], type: 'text', width: 'w-[120px]' },
  { header: '住所', fieldKey: '住所', lookupKeys: ['住所', 'address'], type: 'text', width: 'min-w-[200px]' },
  { header: '電話番号', fieldKey: '電話番号', lookupKeys: ['電話番号'], type: 'text', width: 'w-[130px]' },
  { header: '機材有無', fieldKey: '機材有無', lookupKeys: ['機材有無', 'equipmentStatus'], type: 'select', options: EQUIPMENT_OPTIONS, width: 'w-[80px]' },
  { header: '緯度', fieldKey: '緯度', lookupKeys: ['緯度', 'latitude'], type: 'number', width: 'w-[100px]' },
  { header: '経度', fieldKey: '経度', lookupKeys: ['経度', 'longitude'], type: 'number', width: 'w-[100px]' },
];

// --- EditableCell ---
interface EditableCellProps {
  value: string;
  column: ColumnDef;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (newValue: string) => Promise<void>;
  onCancel: () => void;
  onNavigate: (direction: 'next' | 'prev') => void;
}

function EditableCell({ value, column, isEditing, onStartEdit, onSave, onCancel, onNavigate }: EditableCellProps) {
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

  const flashClass = saveStatus === 'success' ? 'animate-pulse bg-green-50 dark:bg-green-900/20' : saveStatus === 'error' ? 'animate-pulse bg-red-50 dark:bg-red-900/20' : '';

  if (!isEditing) {
    return (
      <div className={cn("cursor-pointer rounded px-2 py-1 min-h-[28px] text-sm transition-colors duration-300 hover:bg-muted/60 border border-transparent hover:border-border/40", flashClass)} onClick={onStartEdit}>
        {value || <span className="text-muted-foreground/40">−</span>}
      </div>
    );
  }

  if (column.type === 'select') {
    return (
      <Select value={editValue} onValueChange={(val) => { setEditValue(val); setIsSaving(true); onSave(val).then(() => setSaveStatus('success')).catch(() => { setSaveStatus('error'); setEditValue(value); }).finally(() => setIsSaving(false)); }} open={isEditing} onOpenChange={(open) => { if (!open) onCancel(); }}>
        <SelectTrigger className="h-7 text-xs border-primary"><SelectValue placeholder="選択..." /></SelectTrigger>
        <SelectContent>{(column.options || []).map(opt => (<SelectItem key={opt || '__empty'} value={opt || ' '}>{opt || '（なし）'}</SelectItem>))}</SelectContent>
      </Select>
    );
  }

  const inputType = column.type === 'number' ? 'number' : 'text';

  return (
    <div className="flex items-center gap-0.5">
      <Input ref={inputRef} type={inputType} value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSave} className="h-7 text-xs border-primary focus-visible:ring-2 focus-visible:ring-primary/30 px-1.5" disabled={isSaving} />
      {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />}
    </div>
  );
}

// --- CSV Export ---
function exportToCSV(customers: any[], columns: ColumnDef[]) {
  const headers = columns.map(c => c.header);
  const rows = customers.map(cust => columns.map(col => {
    const val = findKey(cust, col.lookupKeys);
    return val !== undefined && val !== null ? String(val) : '';
  }));
  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `販売店一覧_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Main component ---
export function CustomerTable({ customers: rawCustomers, isLoading }: CustomerTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [editingCell, setEditingCell] = React.useState<{ rowId: string; colIdx: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const isAdmin = profile?.role === 'admin';

  const filteredCustomers = React.useMemo(() => {
    const list = rawCustomers || [];
    if (searchTerm.trim() === '') return list;
    const term = searchTerm.toLowerCase();
    return list.filter((cust: any) =>
      COLUMNS.some(col => String(findKey(cust, col.lookupKeys) || '').toLowerCase().includes(term))
    );
  }, [rawCustomers, searchTerm]);

  const getCellValue = (customer: any, col: ColumnDef): string => {
    const val = findKey(customer, col.lookupKeys);
    return val !== undefined && val !== null ? String(val) : '';
  };

  const handleSaveCell = React.useCallback(async (customerId: string, col: ColumnDef, newValue: string) => {
    const updateData: Record<string, any> = {};
    updateData[col.fieldKey] = col.type === 'number' ? (newValue ? Number(newValue) : 0) : newValue;
    col.lookupKeys.forEach(key => { if (key !== col.fieldKey) updateData[key] = updateData[col.fieldKey]; });
    await CustomerService.updateCustomer(customerId, updateData);
    toast({ title: '保存しました', description: `${col.header} を更新しました。` });
    setEditingCell(null);
  }, [toast]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await CustomerService.deleteCustomer(deleteTarget);
      toast({ title: '削除しました', description: '販売店データを削除しました。' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '削除に失敗', description: e.message });
    }
    setDeleteTarget(null);
  }, [deleteTarget, toast]);

  const handleAddRow = React.useCallback(async () => {
    setIsCreating(true);
    try {
      const newId = await CustomerService.createCustomer({
        'ユーザーコード': '',
        '店舗': '',
        '住所': '',
        '電話番号': '',
        '機材有無': '',
      });
      toast({ title: '新規販売店を追加しました', description: '各セルをクリックして情報を入力してください。' });
      setTimeout(() => setEditingCell({ rowId: newId, colIdx: 0 }), 500);
    } catch (e: any) {
      toast({ variant: 'destructive', title: '追加に失敗', description: e.message });
    }
    setIsCreating(false);
  }, [toast]);

  const handleNavigate = React.useCallback((rowId: string, colIdx: number, direction: 'next' | 'prev') => {
    const editableIndices = COLUMNS.map((_, i) => i);
    const currentPos = editableIndices.indexOf(colIdx);
    if (direction === 'next') {
      const nextIdx = editableIndices[currentPos + 1];
      if (nextIdx !== undefined) setEditingCell({ rowId, colIdx: nextIdx });
      else {
        const rowIds = filteredCustomers.map((o: any) => o.id);
        const currentRowIdx = rowIds.indexOf(rowId);
        if (currentRowIdx < rowIds.length - 1) setEditingCell({ rowId: rowIds[currentRowIdx + 1], colIdx: 0 });
        else setEditingCell(null);
      }
    } else {
      const prevIdx = editableIndices[currentPos - 1];
      if (prevIdx !== undefined) setEditingCell({ rowId, colIdx: prevIdx });
      else {
        const rowIds = filteredCustomers.map((o: any) => o.id);
        const currentRowIdx = rowIds.indexOf(rowId);
        if (currentRowIdx > 0) setEditingCell({ rowId: rowIds[currentRowIdx - 1], colIdx: editableIndices[editableIndices.length - 1] });
        else setEditingCell(null);
      }
    }
  }, [filteredCustomers]);

  return (
    <>
      <Card className="shadow-sm">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="店舗名、コード、住所で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-9" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredCustomers, COLUMNS)} disabled={filteredCustomers.length === 0} className="gap-1.5">
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
                  {COLUMNS.map(col => (
                    <TableHead key={col.header} className={cn("text-xs font-semibold whitespace-nowrap", col.width)}>{col.header}</TableHead>
                  ))}
                  {isAdmin && <TableHead className="w-[40px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length + (isAdmin ? 1 : 0)} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />販売店情報を読み込んでいます...</div>
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer: any) => (
                    <TableRow key={customer.id} className={cn("transition-colors", editingCell?.rowId === customer.id && "bg-primary/[0.02]")}>
                      {COLUMNS.map((col, colIdx) => {
                        const cellValue = getCellValue(customer, col);
                        const isCellEditing = editingCell?.rowId === customer.id && editingCell?.colIdx === colIdx;
                        return (
                          <TableCell key={col.header} className={cn("py-1 px-1.5", col.width)}>
                            <EditableCell value={cellValue} column={col} isEditing={!!isCellEditing}
                              onStartEdit={() => isAdmin && setEditingCell({ rowId: customer.id, colIdx })}
                              onSave={(newVal) => handleSaveCell(customer.id, col, newVal)}
                              onCancel={() => setEditingCell(null)}
                              onNavigate={(dir) => handleNavigate(customer.id, colIdx, dir)} />
                          </TableCell>
                        );
                      })}
                      {isAdmin && (
                        <TableCell className="py-1 px-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(customer.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length + (isAdmin ? 1 : 0)} className="h-32 text-center text-muted-foreground">
                      {(rawCustomers || []).length === 0 && !searchTerm ? "販売店情報がありません。「新規追加」から登録してください。" : "検索条件に合う販売店が見つかりません。"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>{filteredCustomers.length} 件表示</span>
            <span>セルをクリックして編集 · Tab で次のセルへ移動</span>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>販売店データを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>この操作は取り消せません。この販売店は Firestore から完全に削除されます。</AlertDialogDescription>
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
