
'use client';
import * as React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2, Download, Loader2, Settings2 } from 'lucide-react';
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface CustomerTableProps {
  customers: any[];
  isLoading: boolean;
}

// Fields to exclude
const EXCLUDED_FIELDS = new Set([
  'createdAt', 'updatedAt', '__memo', 'Order_URL',
]);

// Priority fields
const PRIORITY_FIELDS = [
  'ユーザーコード', 'userCode', '店舗', 'storeName', '母店', 'mainStore',
  '住所', 'address', '電話番号', '機材有無', '緯度', 'latitude', '経度', 'longitude',
];

const SELECT_FIELDS: Record<string, string[]> = {
  '機材有無': ['○', '−', ''],
};

const COLUMN_VISIBILITY_KEY = 'workwise_customer_columns_v1';

// --- Dynamic column extraction ---
function extractColumns(customers: any[]): string[] {
  const fieldSet = new Set<string>();
  customers.forEach(c => { Object.keys(c).forEach(key => { if (!EXCLUDED_FIELDS.has(key)) fieldSet.add(key); }); });
  const allFields = Array.from(fieldSet);
  const prioritized: string[] = [];
  const rest: string[] = [];
  PRIORITY_FIELDS.forEach(pf => { if (allFields.includes(pf)) prioritized.push(pf); });
  allFields.forEach(f => { if (!prioritized.includes(f)) rest.push(f); });
  rest.sort();
  return [...prioritized, ...rest];
}

// --- EditableCell ---
interface EditableCellProps {
  value: string;
  fieldKey: string;
  selectOptions?: string[];
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (newValue: string) => Promise<void>;
  onCancel: () => void;
  onNavigate: (direction: 'next' | 'prev') => void;
}

function EditableCell({ value, fieldKey, selectOptions, isEditing, onStartEdit, onSave, onCancel, onNavigate }: EditableCellProps) {
  const [editValue, setEditValue] = React.useState(value);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (isEditing) { setEditValue(value); setTimeout(() => inputRef.current?.focus(), 0); } }, [isEditing, value]);
  React.useEffect(() => { if (saveStatus !== 'idle') { const t = setTimeout(() => setSaveStatus('idle'), 1200); return () => clearTimeout(t); } }, [saveStatus]);

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
    return <div className={cn("cursor-pointer rounded px-2 py-1 min-h-[28px] text-sm hover:bg-muted/60 border border-transparent hover:border-border/40 truncate max-w-[200px]", flashClass)} onClick={onStartEdit} title={value}>{value || <span className="text-muted-foreground/40">−</span>}</div>;
  }

  if (selectOptions) {
    return (
      <Select value={editValue} onValueChange={(val) => { setEditValue(val); setIsSaving(true); onSave(val).then(() => setSaveStatus('success')).catch(() => { setSaveStatus('error'); setEditValue(value); }).finally(() => setIsSaving(false)); }} open={isEditing} onOpenChange={(o) => { if (!o) onCancel(); }}>
        <SelectTrigger className="h-7 text-xs border-primary"><SelectValue placeholder="選択..." /></SelectTrigger>
        <SelectContent>{selectOptions.map(opt => (<SelectItem key={opt || '__empty'} value={opt || ' '}>{opt || '（なし）'}</SelectItem>))}</SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <Input ref={inputRef} type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSave} className="h-7 text-xs border-primary px-1.5" disabled={isSaving} />
      {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );
}

// --- CSV Export ---
function exportToCSV(customers: any[], columns: string[]) {
  const rows = customers.map(c => columns.map(col => { const v = c[col]; return v !== undefined && v !== null ? String(v) : ''; }));
  const csvContent = [columns, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `販売店一覧_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`; link.click();
  URL.revokeObjectURL(url);
}

// --- Main ---
export function CustomerTable({ customers: rawCustomers, isLoading }: CustomerTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [editingCell, setEditingCell] = React.useState<{ rowId: string; colIdx: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const isAdmin = profile?.role === 'admin';

  const allColumns = React.useMemo(() => extractColumns(rawCustomers || []), [rawCustomers]);

  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(() => {
    try { const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY); if (saved) return new Set(JSON.parse(saved)); } catch {}
    return new Set(PRIORITY_FIELDS);
  });

  React.useEffect(() => { if (visibleColumns.size === 0 && allColumns.length > 0) setVisibleColumns(new Set(PRIORITY_FIELDS.filter(f => allColumns.includes(f)))); }, [allColumns]);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => { const next = new Set(prev); if (next.has(col)) next.delete(col); else next.add(col); try { localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(Array.from(next))); } catch {} return next; });
  };

  const displayColumns = React.useMemo(() => allColumns.filter(c => visibleColumns.has(c)), [allColumns, visibleColumns]);

  const filteredCustomers = React.useMemo(() => {
    const list = rawCustomers || [];
    if (searchTerm.trim() === '') return list;
    const term = searchTerm.toLowerCase();
    return list.filter((cust: any) => displayColumns.some(col => String(cust[col] || '').toLowerCase().includes(term)));
  }, [rawCustomers, searchTerm, displayColumns]);

  const handleSaveCell = React.useCallback(async (customerId: string, fieldKey: string, newValue: string) => {
    await CustomerService.updateCustomer(customerId, { [fieldKey]: newValue });
    toast({ title: '保存しました', description: `${fieldKey} を更新しました。` });
    setEditingCell(null);
  }, [toast]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    try { await CustomerService.deleteCustomer(deleteTarget); toast({ title: '削除しました' }); }
    catch (e: any) { toast({ variant: 'destructive', title: '削除に失敗', description: e.message }); }
    setDeleteTarget(null);
  }, [deleteTarget, toast]);

  const handleAddRow = React.useCallback(async () => {
    setIsCreating(true);
    try { await CustomerService.createCustomer({ 'ユーザーコード': '', '店舗': '', '住所': '', '電話番号': '', '機材有無': '' }); toast({ title: '新規販売店を追加しました' }); }
    catch (e: any) { toast({ variant: 'destructive', title: '追加に失敗', description: e.message }); }
    setIsCreating(false);
  }, [toast]);

  const handleNavigate = React.useCallback((rowId: string, colIdx: number, direction: 'next' | 'prev') => {
    const editableIndices = displayColumns.map((_, i) => i);
    const pos = editableIndices.indexOf(colIdx);
    if (direction === 'next') { const next = editableIndices[pos + 1]; if (next !== undefined) setEditingCell({ rowId, colIdx: next }); else { const rIds = filteredCustomers.map((o: any) => o.id); const ri = rIds.indexOf(rowId); if (ri < rIds.length - 1) setEditingCell({ rowId: rIds[ri + 1], colIdx: 0 }); else setEditingCell(null); } }
    else { const prev = editableIndices[pos - 1]; if (prev !== undefined) setEditingCell({ rowId, colIdx: prev }); else { const rIds = filteredCustomers.map((o: any) => o.id); const ri = rIds.indexOf(rowId); if (ri > 0) setEditingCell({ rowId: rIds[ri - 1], colIdx: editableIndices[editableIndices.length - 1] }); else setEditingCell(null); } }
  }, [displayColumns, filteredCustomers]);

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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />列の表示 ({displayColumns.length}/{allColumns.length})</Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 max-h-[400px] overflow-auto p-3" align="end">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">表示する列を選択</p>
                  <div className="space-y-1.5">{allColumns.map(col => (<label key={col} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"><Checkbox checked={visibleColumns.has(col)} onCheckedChange={() => toggleColumn(col)} className="h-3.5 w-3.5" /><span className="truncate">{col}</span></label>))}</div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredCustomers, displayColumns)} disabled={filteredCustomers.length === 0} className="gap-1.5"><Download className="h-3.5 w-3.5" /> CSV出力</Button>
              {isAdmin && <Button size="sm" onClick={handleAddRow} disabled={isCreating} className="gap-1.5">{isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}新規追加</Button>}
            </div>
          </div>

          <ScrollArea className="h-[65vh] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow className="hover:bg-transparent">
                  {displayColumns.map(col => (<TableHead key={col} className="text-xs font-semibold whitespace-nowrap px-2">{col}</TableHead>))}
                  {isAdmin && <TableHead className="w-[40px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={displayColumns.length + (isAdmin ? 1 : 0)} className="h-32 text-center"><div className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />読み込み中...</div></TableCell></TableRow>
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer: any) => (
                    <TableRow key={customer.id} className={cn("transition-colors", editingCell?.rowId === customer.id && "bg-primary/[0.02]")}>
                      {displayColumns.map((col, colIdx) => {
                        const val = customer[col];
                        const strValue = val !== undefined && val !== null ? String(val) : '';
                        const isCellEditing = editingCell?.rowId === customer.id && editingCell?.colIdx === colIdx;
                        return (
                          <TableCell key={col} className="py-1 px-1.5">
                            <EditableCell value={strValue} fieldKey={col} selectOptions={SELECT_FIELDS[col]}
                              isEditing={!!isCellEditing} onStartEdit={() => isAdmin && setEditingCell({ rowId: customer.id, colIdx })}
                              onSave={(v) => handleSaveCell(customer.id, col, v)} onCancel={() => setEditingCell(null)} onNavigate={(d) => handleNavigate(customer.id, colIdx, d)} />
                          </TableCell>
                        );
                      })}
                      {isAdmin && <TableCell className="py-1 px-1"><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(customer.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>}
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={displayColumns.length + (isAdmin ? 1 : 0)} className="h-32 text-center text-muted-foreground">{(rawCustomers || []).length === 0 ? "販売店情報がありません。" : "検索条件に合う販売店が見つかりません。"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground"><span>{filteredCustomers.length} 件表示</span><span>セルをクリックして編集 · ⚙️ 列の表示/非表示</span></div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>販売店を削除しますか？</AlertDialogTitle><AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
