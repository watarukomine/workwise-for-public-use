
'use client';
import * as React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Search, Plus, Trash2, Download, Loader2, Check } from 'lucide-react';
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

interface StaffTableProps {
  staff: (WithId<Staff> & { Order_URL?: string })[] | null;
  isLoading: boolean;
}

// --- Column definitions ---
type ColumnType = 'text' | 'select' | 'readonly' | 'color';

interface ColumnDef {
  header: string;
  fieldKey: string;
  type: ColumnType;
  options?: string[];
  width?: string;
}

const ROLE_OPTIONS = ['admin', 'staff'];
const AREA_OPTIONS = ['県西', '県央', '県東'];
const MOTHER_STORE_OPTIONS = ['厚木', '藤沢', '横須賀', '小田原', '相模原', '平塚', '秦野', '大和'];

const COLUMNS: ColumnDef[] = [
  { header: 'スタッフ名', fieldKey: 'name', type: 'text', width: 'min-w-[120px]' },
  { header: 'メールアドレス', fieldKey: 'email', type: 'text', width: 'min-w-[180px]' },
  { header: '母店', fieldKey: '母店', type: 'select', options: MOTHER_STORE_OPTIONS, width: 'w-[100px]' },
  { header: 'エリア', fieldKey: 'area', type: 'select', options: AREA_OPTIONS, width: 'w-[80px]' },
  { header: 'ロール', fieldKey: 'role', type: 'select', options: ROLE_OPTIONS, width: 'w-[90px]' },
  { header: 'カラー', fieldKey: 'color', type: 'color', width: 'w-[80px]' },
  { header: 'スタッフID', fieldKey: 'id', type: 'readonly', width: 'w-[100px]' },
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
    if (editValue === value) { onCancel(); return; }
    setIsSaving(true);
    try {
      await onSave(editValue);
      setSaveStatus('success');
    } catch {
      setSaveStatus('error');
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    else if (e.key === 'Escape') { e.preventDefault(); setEditValue(value); onCancel(); }
    else if (e.key === 'Tab') { e.preventDefault(); handleSave(); onNavigate(e.shiftKey ? 'prev' : 'next'); }
  };

  if (column.type === 'readonly') {
    return <span className="text-xs text-muted-foreground font-mono truncate block max-w-[90px]" title={value}>{value ? value.slice(-8) : ''}</span>;
  }

  if (column.type === 'color') {
    return (
      <div className="flex items-center gap-2 cursor-pointer" onClick={onStartEdit}>
        <div className="h-5 w-5 rounded-full border" style={{ backgroundColor: value || '#888' }} />
        {isEditing && (
          <Input ref={inputRef} type="color" value={editValue || '#888888'} onChange={(e) => { setEditValue(e.target.value); }}
            onBlur={() => { if (editValue !== value) { handleSave(); } else { onCancel(); } }}
            className="h-7 w-16 p-0 border-primary" />
        )}
      </div>
    );
  }

  const flashClass = saveStatus === 'success' ? 'animate-pulse bg-green-50 dark:bg-green-900/20' : saveStatus === 'error' ? 'animate-pulse bg-red-50 dark:bg-red-900/20' : '';

  if (!isEditing) {
    if (column.type === 'select' && column.header === 'ロール') {
      return (
        <div className={cn("cursor-pointer rounded px-1 py-0.5 transition-colors duration-300", flashClass)} onClick={onStartEdit}>
          <Badge variant={value === 'admin' ? 'default' : 'secondary'} className="text-xs">{value || '−'}</Badge>
        </div>
      );
    }
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
        <SelectContent>{(column.options || []).map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
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
function exportToCSV(staffList: any[], columns: ColumnDef[]) {
  const headers = columns.map(c => c.header);
  const rows = staffList.map(s => columns.map(col => {
    const val = s[col.fieldKey];
    return val !== undefined && val !== null ? String(val) : '';
  }));
  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `スタッフ一覧_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Main ---
export function StaffTable({ staff, isLoading }: StaffTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [editingCell, setEditingCell] = React.useState<{ rowId: string; colIdx: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const {
    pendingSelectedStaffIds, togglePendingStaffSelection, applyPendingSelection, appliedSelectedStaffIds,
  } = useSelectedStaff();
  const isAdmin = profile?.role === 'admin';

  const staffList = staff || [];

  const filteredStaff = React.useMemo(() => {
    if (searchTerm.trim() === '') return staffList;
    const term = searchTerm.toLowerCase();
    return staffList.filter(s =>
      s.name?.toLowerCase().includes(term) ||
      s.email?.toLowerCase().includes(term) ||
      s['母店']?.toLowerCase().includes(term)
    );
  }, [staffList, searchTerm]);

  const isAllSelected = staffList.length > 0 && pendingSelectedStaffIds.length === staffList.length;
  const isSelectionChanged = JSON.stringify(pendingSelectedStaffIds.sort()) !== JSON.stringify(appliedSelectedStaffIds.sort());

  const handleSelectAll = () => {
    const allStaffIds = staffList.map(s => s.id);
    if (isAllSelected) {
      allStaffIds.forEach(id => { if (pendingSelectedStaffIds.includes(id)) togglePendingStaffSelection(id); });
    } else {
      allStaffIds.forEach(id => { if (!pendingSelectedStaffIds.includes(id)) togglePendingStaffSelection(id); });
    }
  };

  const handleSaveCell = React.useCallback(async (staffId: string, col: ColumnDef, newValue: string) => {
    const updateData: Record<string, any> = { [col.fieldKey]: newValue };
    await StaffService.updateStaff(staffId, updateData);
    toast({ title: '保存しました', description: `${col.header} を更新しました。` });
    setEditingCell(null);
  }, [toast]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const { firestore } = (await import('@/firebase')).initializeFirebase();
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(firestore, 'users', deleteTarget));
      toast({ title: '削除しました', description: 'スタッフデータを削除しました。' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '削除に失敗', description: e.message });
    }
    setDeleteTarget(null);
  }, [deleteTarget, toast]);

  const handleNavigate = React.useCallback((rowId: string, colIdx: number, direction: 'next' | 'prev') => {
    const editableIndices = COLUMNS.map((c, i) => c.type !== 'readonly' ? i : -1).filter(i => i >= 0);
    const currentPos = editableIndices.indexOf(colIdx);
    if (direction === 'next') {
      const nextIdx = editableIndices[currentPos + 1];
      if (nextIdx !== undefined) { setEditingCell({ rowId, colIdx: nextIdx }); }
      else {
        const rowIds = filteredStaff.map(o => o.id);
        const currentRowIdx = rowIds.indexOf(rowId);
        if (currentRowIdx < rowIds.length - 1) setEditingCell({ rowId: rowIds[currentRowIdx + 1], colIdx: editableIndices[0] });
        else setEditingCell(null);
      }
    } else {
      const prevIdx = editableIndices[currentPos - 1];
      if (prevIdx !== undefined) { setEditingCell({ rowId, colIdx: prevIdx }); }
      else {
        const rowIds = filteredStaff.map(o => o.id);
        const currentRowIdx = rowIds.indexOf(rowId);
        if (currentRowIdx > 0) setEditingCell({ rowId: rowIds[currentRowIdx - 1], colIdx: editableIndices[editableIndices.length - 1] });
        else setEditingCell(null);
      }
    }
  }, [filteredStaff]);

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
              <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredStaff, COLUMNS)} disabled={filteredStaff.length === 0} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> CSV出力
              </Button>
              {isAdmin && (
                <Button onClick={applyPendingSelection} disabled={!isSelectionChanged} size="sm" className="gap-1.5">
                  <Check className="h-3.5 w-3.5" /> 選択を適用
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="h-[65vh] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow className="hover:bg-transparent">
                  {isAdmin && (
                    <TableHead className="w-[40px]">
                      <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} aria-label="すべて選択" disabled={staffList.length === 0} />
                    </TableHead>
                  )}
                  {COLUMNS.map(col => (
                    <TableHead key={col.header} className={cn("text-xs font-semibold whitespace-nowrap", col.width)}>{col.header}</TableHead>
                  ))}
                  {isAdmin && <TableHead className="w-[40px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length + (isAdmin ? 2 : 0)} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />スタッフ情報を読み込んでいます...</div>
                    </TableCell>
                  </TableRow>
                ) : filteredStaff.length > 0 ? (
                  filteredStaff.map((member) => (
                    <TableRow key={member.id} data-state={pendingSelectedStaffIds.includes(member.id) && isAdmin ? 'selected' : ''} className={cn("transition-colors", editingCell?.rowId === member.id && "bg-primary/[0.02]", member['母店'] ? STORE_COLORS[member['母店']] || '' : '')}>
                      {isAdmin && (
                        <TableCell className="py-1 px-1">
                          <Checkbox checked={pendingSelectedStaffIds.includes(member.id)} onCheckedChange={() => togglePendingStaffSelection(member.id)} aria-label={`${member.name}を選択`} />
                        </TableCell>
                      )}
                      {COLUMNS.map((col, colIdx) => {
                        const cellValue = member[col.fieldKey as keyof typeof member];
                        const strValue = cellValue !== undefined && cellValue !== null ? String(cellValue) : '';
                        const isCellEditing = editingCell?.rowId === member.id && editingCell?.colIdx === colIdx;
                        return (
                          <TableCell key={col.header} className={cn("py-1 px-1.5", col.width)}>
                            <EditableCell value={strValue} column={col} isEditing={!!isCellEditing}
                              onStartEdit={() => isAdmin && col.type !== 'readonly' && setEditingCell({ rowId: member.id, colIdx })}
                              onSave={(newVal) => handleSaveCell(member.id, col, newVal)}
                              onCancel={() => setEditingCell(null)}
                              onNavigate={(dir) => handleNavigate(member.id, colIdx, dir)} />
                          </TableCell>
                        );
                      })}
                      {isAdmin && (
                        <TableCell className="py-1 px-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(member.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length + (isAdmin ? 2 : 0)} className="h-32 text-center text-muted-foreground">
                      {staffList.length === 0 && !searchTerm ? "スタッフ情報がありません。" : "検索条件に合うスタッフが見つかりません。"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>{filteredStaff.length} 件表示</span>
            <span>セルをクリックして編集 · Tab で次のセルへ移動</span>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>スタッフデータを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>この操作は取り消せません。このスタッフは Firestore から完全に削除されます。</AlertDialogDescription>
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
