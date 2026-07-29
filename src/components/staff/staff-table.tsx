
'use client';
import * as React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Search, Trash2, Download, Loader2, Check, Settings2, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { useSelectedStaff } from '../../contexts/selected-staff-context';
import { useUserProfile } from '../../hooks/use-user-profile';
import { useToast } from '@/hooks/use-toast';
import { StaffService } from '@/services/staff-service';
import { STORE_COLORS } from '../../lib/constants';
import { Staff, WithId } from '../../lib/types';
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

interface StaffTableProps {
  staff: (WithId<Staff> & { Order_URL?: string })[] | null;
  isLoading: boolean;
}

// --- System/internal fields to exclude ---
// Order-related fields that may have been mixed into the users collection via GAS import
const ORDER_FIELDS_TO_EXCLUDE = [
  'scheduledTime', 'scheduledDate', 'staffName', 'status', 'taskDetails',
  'uid', 'ご担当者様', 'キャンセル日時', 'キャンセル連絡者', 'スタッフ名',
  'タイヤサイズ', 'タイヤ品番', 'タイヤ手配状況', 'タイヤ状況',
  'チップ配置作業予定', 'チップ配置作業完了予定', 'フォーム入力者',
  '予定時間', '作業予定日', '作業内容', '本数', '機材有無', '空気圧センサーパッキン交換',
  '受注ステータス', '受注 ID', '受注ID', '受注 No', '受注No',
  'SystemID', 'systemId', 'customerName', 'customerCode', 'お取引先名',
  'ユーザーコード', '主管店舗', '主管店舗コード', '店舗名', '店舗',
  '品名', '担当', 'address', 'scheduledEndTime', 'estimatedDuration',
  'actualDuration', 'actualEndTime', 'actualStartTime', 'arrivalTimestamp',
  'serviceType', 'staffId', 'startTravelTime', 'value',
  '_importedAt', '_source', '任意コメント', 'リマーク',
];
const EXCLUDED_FIELDS = new Set([
  'Order_URL', 'createdAt', 'updatedAt', '__memo', 'password',
  'calendarId', 'photoURL', 'avatarUrl',
  ...ORDER_FIELDS_TO_EXCLUDE,
]);

// Priority fields shown first
const PRIORITY_FIELDS = ['name', 'email', '母店', 'area', 'role', 'color', 'id'];

// Read-only fields
const READONLY_FIELDS = new Set(['id']);

// Fields with select options
const SELECT_FIELDS: Record<string, string[]> = {
  'role': ['admin', 'staff', 'admin/staff', 'controller'],
  'ロール': ['admin', 'staff', 'admin/staff', 'controller'],
  'area': ['県西', '県央', '県東'],
  '母店': ['横浜店', '横須賀店', '東名川崎店', '相模原店', '厚木店', '綾瀬店', '小田原店'],
};

const COLUMN_VISIBILITY_KEY = 'workwise_staff_columns_v1';

// --- Extract dynamic columns ---
function extractColumns(staffList: any[]): string[] {
  const fieldSet = new Set<string>();
  staffList.forEach(s => {
    Object.keys(s).forEach(key => { if (!EXCLUDED_FIELDS.has(key)) fieldSet.add(key); });
  });
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
  isReadonly: boolean;
  selectOptions?: string[];
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (newValue: string) => Promise<void>;
  onCancel: () => void;
  onNavigate: (direction: 'next' | 'prev') => void;
}

function EditableCell({ value, fieldKey, isReadonly, selectOptions, isEditing, onStartEdit, onSave, onCancel, onNavigate }: EditableCellProps) {
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

  if (isReadonly) return <span className="text-xs text-muted-foreground font-mono truncate block max-w-[90px]" title={value}>{value ? value.slice(-8) : ''}</span>;

  if (fieldKey === 'color') {
    return (
      <div className="flex items-center gap-2 cursor-pointer" onClick={onStartEdit}>
        <div className="h-5 w-5 rounded-full border" style={{ backgroundColor: value || '#888' }} />
        {isEditing && <Input ref={inputRef} type="color" value={editValue || '#888888'} onChange={(e) => setEditValue(e.target.value)} onBlur={() => { if (editValue !== value) handleSave(); else onCancel(); }} className="h-7 w-16 p-0 border-primary" />}
      </div>
    );
  }

  const flashClass = saveStatus === 'success' ? 'animate-pulse bg-green-50 dark:bg-green-900/20' : saveStatus === 'error' ? 'animate-pulse bg-red-50 dark:bg-red-900/20' : '';

  if (!isEditing) {
    if (selectOptions && (fieldKey === 'role' || fieldKey === 'ロール')) {
      const getBadgeVariant = (val: string) => {
        const norm = String(val || '').toLowerCase().trim();
        if (norm === 'admin') return 'default';
        if (norm === 'admin/staff' || (norm.includes('admin') && norm.includes('staff'))) return 'outline';
        if (norm === 'controller') return 'destructive';
        return 'secondary';
      };
      const isDual = value === 'admin/staff' || value === 'admin\\staff' || (value?.includes('admin') && value?.includes('staff'));
      return (
        <div className={cn("cursor-pointer rounded px-1 py-0.5", flashClass)} onClick={onStartEdit}>
          <Badge variant={getBadgeVariant(value)} className={cn("text-xs font-mono", isDual && "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300")}>
            {value || '−'}
          </Badge>
        </div>
      );
    }
    return <div className={cn("cursor-pointer rounded px-2 py-1 min-h-[28px] text-sm hover:bg-muted/60 border border-transparent hover:border-border/40 truncate max-w-[200px]", flashClass)} onClick={onStartEdit} title={value}>{value || <span className="text-muted-foreground/40">−</span>}</div>;
  }

  if (selectOptions) {
    return (
      <Select value={editValue} onValueChange={(val) => { setEditValue(val); setIsSaving(true); onSave(val).then(() => setSaveStatus('success')).catch(() => { setSaveStatus('error'); setEditValue(value); }).finally(() => setIsSaving(false)); }} open={isEditing} onOpenChange={(o) => { if (!o) onCancel(); }}>
        <SelectTrigger className="h-7 text-xs border-primary"><SelectValue placeholder="選択..." /></SelectTrigger>
        <SelectContent>{selectOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
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
function exportToCSV(staffList: any[], columns: string[]) {
  const rows = staffList.map(s => columns.map(col => { const v = s[col]; return v !== undefined && v !== null ? String(v) : ''; }));
  const csvContent = [columns, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `スタッフ一覧_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`; link.click();
  URL.revokeObjectURL(url);
}

// --- Main ---
export function StaffTable({ staff, isLoading }: StaffTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [editingCell, setEditingCell] = React.useState<{ rowId: string; colIdx: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const { pendingSelectedStaffIds, togglePendingStaffSelection, applyPendingSelection, appliedSelectedStaffIds } = useSelectedStaff();
  const isAdmin = profile?.role === 'admin';
  const staffList = staff || [];

  const allColumns = React.useMemo(() => extractColumns(staffList), [staffList]);

  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(() => {
    try { const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY); if (saved) return new Set(JSON.parse(saved)); } catch {}
    return new Set(PRIORITY_FIELDS);
  });

  React.useEffect(() => { if (visibleColumns.size === 0 && allColumns.length > 0) setVisibleColumns(new Set(PRIORITY_FIELDS.filter(f => allColumns.includes(f)))); }, [allColumns]);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => { const next = new Set(prev); if (next.has(col)) next.delete(col); else next.add(col); try { localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(Array.from(next))); } catch {} return next; });
  };

  const displayColumns = React.useMemo(() => allColumns.filter(c => visibleColumns.has(c)), [allColumns, visibleColumns]);

  const filteredStaff = React.useMemo(() => {
    if (searchTerm.trim() === '') return staffList;
    const term = searchTerm.toLowerCase();
    return staffList.filter(s => displayColumns.some(col => String(s[col as keyof typeof s] || '').toLowerCase().includes(term)));
  }, [staffList, searchTerm, displayColumns]);

  const isAllSelected = staffList.length > 0 && pendingSelectedStaffIds.length === staffList.length;
  const isSelectionChanged = JSON.stringify(pendingSelectedStaffIds.sort()) !== JSON.stringify(appliedSelectedStaffIds.sort());

  const handleSelectAll = () => {
    const allIds = staffList.map(s => s.id);
    if (isAllSelected) allIds.forEach(id => { if (pendingSelectedStaffIds.includes(id)) togglePendingStaffSelection(id); });
    else allIds.forEach(id => { if (!pendingSelectedStaffIds.includes(id)) togglePendingStaffSelection(id); });
  };

  const handleSaveCell = React.useCallback(async (staffId: string, fieldKey: string, newValue: string) => {
    await StaffService.updateStaff(staffId, { [fieldKey]: newValue });
    toast({ title: '保存しました', description: `${fieldKey} を更新しました。` });
    setEditingCell(null);
  }, [toast]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    try { const { firestore } = (await import('@/firebase')).initializeFirebase(); const { doc, deleteDoc } = await import('firebase/firestore'); await deleteDoc(doc(firestore, 'users', deleteTarget)); toast({ title: '削除しました' }); }
    catch (e: any) { toast({ variant: 'destructive', title: '削除に失敗', description: e.message }); }
    setDeleteTarget(null);
  }, [deleteTarget, toast]);

  const handleNavigate = React.useCallback((rowId: string, colIdx: number, direction: 'next' | 'prev') => {
    const editableIndices = displayColumns.map((c, i) => READONLY_FIELDS.has(c) ? -1 : i).filter(i => i >= 0);
    const pos = editableIndices.indexOf(colIdx);
    if (direction === 'next') { const next = editableIndices[pos + 1]; if (next !== undefined) setEditingCell({ rowId, colIdx: next }); else { const rIds = filteredStaff.map(o => o.id); const ri = rIds.indexOf(rowId); if (ri < rIds.length - 1) setEditingCell({ rowId: rIds[ri + 1], colIdx: editableIndices[0] }); else setEditingCell(null); } }
    else { const prev = editableIndices[pos - 1]; if (prev !== undefined) setEditingCell({ rowId, colIdx: prev }); else { const rIds = filteredStaff.map(o => o.id); const ri = rIds.indexOf(rowId); if (ri > 0) setEditingCell({ rowId: rIds[ri - 1], colIdx: editableIndices[editableIndices.length - 1] }); else setEditingCell(null); } }
  }, [displayColumns, filteredStaff]);

  const handleMoveOrder = React.useCallback(async (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= filteredStaff.length) return;

    const currentStaff = filteredStaff[currentIndex];
    const targetStaff = filteredStaff[targetIndex];

    try {
      await Promise.all([
        StaffService.updateStaff(currentStaff.id, { sortOrder: targetIndex }),
        StaffService.updateStaff(targetStaff.id, { sortOrder: currentIndex })
      ]);
      toast({ title: '並び順を更新しました', description: `${currentStaff.name || 'スタッフ'} の並び順を変更しました。` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '並び順の更新に失敗', description: e.message });
    }
  }, [filteredStaff, toast]);

  return (
    <>
      <Card className="shadow-sm">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="スタッフ名、メール、母店で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-9" />
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
              <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredStaff, displayColumns)} disabled={filteredStaff.length === 0} className="gap-1.5"><Download className="h-3.5 w-3.5" /> CSV出力</Button>
              {isAdmin && <Button onClick={applyPendingSelection} disabled={!isSelectionChanged} size="sm" className="gap-1.5"><Check className="h-3.5 w-3.5" /> 選択を適用</Button>}
            </div>
          </div>

          <ScrollArea className="h-[65vh] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow className="hover:bg-transparent">
                  {isAdmin && <TableHead className="w-[40px]"><Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} disabled={staffList.length === 0} /></TableHead>}
                  {isAdmin && <TableHead className="w-[70px] text-xs font-semibold text-center">並び順</TableHead>}
                  {displayColumns.map(col => (<TableHead key={col} className="text-xs font-semibold whitespace-nowrap px-2">{col}</TableHead>))}
                  {isAdmin && <TableHead className="w-[40px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={displayColumns.length + (isAdmin ? 3 : 0)} className="h-32 text-center"><div className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />読み込み中...</div></TableCell></TableRow>
                ) : filteredStaff.length > 0 ? (
                  filteredStaff.map((member, idx) => (
                    <TableRow key={member.id} data-state={pendingSelectedStaffIds.includes(member.id) && isAdmin ? 'selected' : ''} className={cn("transition-colors", editingCell?.rowId === member.id && "bg-primary/[0.02]", member['母店'] ? STORE_COLORS[member['母店']] || '' : '')}>
                      {isAdmin && <TableCell className="py-1 px-1"><Checkbox checked={pendingSelectedStaffIds.includes(member.id)} onCheckedChange={() => togglePendingStaffSelection(member.id)} /></TableCell>}
                      {isAdmin && (
                        <TableCell className="py-1 px-1 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" disabled={idx === 0} onClick={() => handleMoveOrder(idx, 'up')} title="上へ移動">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" disabled={idx === filteredStaff.length - 1} onClick={() => handleMoveOrder(idx, 'down')} title="下へ移動">
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                      {displayColumns.map((col, colIdx) => {
                        const val = member[col as keyof typeof member];
                        const strValue = val !== undefined && val !== null ? String(val) : '';
                        const isCellEditing = editingCell?.rowId === member.id && editingCell?.colIdx === colIdx;
                        return (
                          <TableCell key={col} className="py-1 px-1.5">
                            <EditableCell value={strValue} fieldKey={col} isReadonly={READONLY_FIELDS.has(col)} selectOptions={SELECT_FIELDS[col]}
                              isEditing={!!isCellEditing} onStartEdit={() => isAdmin && !READONLY_FIELDS.has(col) && setEditingCell({ rowId: member.id, colIdx })}
                              onSave={(v) => handleSaveCell(member.id, col, v)} onCancel={() => setEditingCell(null)} onNavigate={(d) => handleNavigate(member.id, colIdx, d)} />
                          </TableCell>
                        );
                      })}
                      {isAdmin && <TableCell className="py-1 px-1"><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(member.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>}
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={displayColumns.length + (isAdmin ? 3 : 0)} className="h-32 text-center text-muted-foreground">{staffList.length === 0 ? "スタッフ情報がありません。" : "検索条件に合うスタッフが見つかりません。"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground"><span>{filteredStaff.length} 件表示</span><span>セルをクリックして編集 · ⚙️ 列の表示/非表示</span></div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>スタッフを削除しますか？</AlertDialogTitle><AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
