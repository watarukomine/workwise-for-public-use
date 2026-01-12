'use client';
import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { useSelectedStaff } from '../../contexts/selected-staff-context';
import { Button } from '../ui/button';
import { Check, Grid, List, ExternalLink, Trash2, Pencil } from 'lucide-react';
import { Staff, WithId } from '../../lib/types';
import { Badge } from '../ui/badge';
import { useUserProfile } from '../../hooks/use-user-profile';
import { cn } from '../../lib/utils';
import { STORE_COLORS } from '../../lib/constants';

interface StaffTableProps {
  staff: (WithId<Staff> & { Order_URL?: string })[] | null;
  isLoading: boolean;
}

export function StaffTable({ staff, isLoading }: StaffTableProps) {
  const { profile } = useUserProfile();
  const {
    pendingSelectedStaffIds,
    togglePendingStaffSelection,
    applyPendingSelection,
    appliedSelectedStaffIds,
  } = useSelectedStaff();

  const staffList = staff || [];
  const isAdmin = profile?.role === 'admin';
  const isAllSelected = staffList.length > 0 && pendingSelectedStaffIds.length === staffList.length;

  const handleSelectAll = () => {
    const allStaffIds = staffList.map(s => s.id);
    if (isAllSelected) {
      // Deselect all
      allStaffIds.forEach(id => {
        if (pendingSelectedStaffIds.includes(id)) {
          togglePendingStaffSelection(id);
        }
      });
    } else {
      // Select all
      allStaffIds.forEach(id => {
        if (!pendingSelectedStaffIds.includes(id)) {
          togglePendingStaffSelection(id);
        }
      });
    }
  };

  const handleRowDoubleClick = (member: WithId<Staff> & { Order_URL?: string }) => {
    if (isAdmin && member && member.Order_URL) {
      window.open(member.Order_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const isSelectionChanged = JSON.stringify(pendingSelectedStaffIds.sort()) !== JSON.stringify(appliedSelectedStaffIds.sort());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>スタッフ一覧</CardTitle>
        {isAdmin && (
          <Button
            onClick={applyPendingSelection}
            disabled={!isSelectionChanged}
          >
            <Check className="mr-2 h-4 w-4" />
            選択を適用
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && (
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="すべてのスタッフを選択"
                      disabled={staffList.length === 0}
                    />
                  </TableHead>
                )}
                <TableHead>スタッフ名</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>母店</TableHead>
                <TableHead>ロール</TableHead>
                <TableHead>スタッフID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    スタッフ情報を読み込んでいます...
                  </TableCell>
                </TableRow>
              ) : staffList && staffList.length > 0 ? (
                staffList.map((member) => {
                  const areaBgClass = member['母店'] ? STORE_COLORS[member['母店']] || '' : '';
                  const staffColorStyle = { backgroundColor: member.color } as React.CSSProperties;
                  return (
                    <TableRow
                      key={member.id}
                      data-state={pendingSelectedStaffIds.includes(member.id) && isAdmin ? 'selected' : ''}
                      onDoubleClick={() => handleRowDoubleClick(member)}
                      className={cn(
                        isAdmin && member.Order_URL && "cursor-pointer hover:bg-muted/50",
                        member['母店'] ? STORE_COLORS[member['母店']] || '' : '' // Used STORE_COLORS directly
                      )}
                    >
                      {isAdmin && (
                        <TableCell>
                          <Checkbox
                            checked={pendingSelectedStaffIds.includes(member.id)}
                            onCheckedChange={() => togglePendingStaffSelection(member.id)}
                            aria-label={`${member.name}を選択`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="h-6 w-6 rounded-full border"
                            style={staffColorStyle}
                          />
                          <span className="font-medium">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.email}</TableCell>
                      <TableCell className="text-muted-foreground">{member['母店']}</TableCell>
                      <TableCell>
                        <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{member.id}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    表示するスタッフ情報がありません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
