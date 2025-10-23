'use client';
import type { Staff } from '@/lib/types';
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface StaffTableProps {
    staff: Staff[];
    isLoading: boolean;
}

export function StaffTable({ staff, isLoading }: StaffTableProps) {
  const { 
    pendingSelectedStaffIds, 
    togglePendingStaffSelection,
    applyPendingSelection,
    appliedSelectedStaffIds,
  } = useSelectedStaff();
  
  const isAllSelected = staff.length > 0 && pendingSelectedStaffIds.length === staff.length;

  const handleSelectAll = () => {
    const allStaffIds = staff.map(s => s.id);
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

  const isSelectionChanged = JSON.stringify(pendingSelectedStaffIds.sort()) !== JSON.stringify(appliedSelectedStaffIds.sort());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>スタッフ一覧</CardTitle>
          <Button 
            onClick={applyPendingSelection}
            disabled={!isSelectionChanged}
          >
            <Check className="mr-2 h-4 w-4" />
            選択を適用
          </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="すべてのスタッフを選択"
                  />
                </TableHead>
                <TableHead>スタッフ名</TableHead>
                <TableHead>スタッフID</TableHead>
                <TableHead>カレンダーID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      スタッフ情報を読み込んでいます...
                    </TableCell>
                  </TableRow>
              ) : staff && staff.length > 0 ? (
                staff.map((member) => (
                  <TableRow key={member.id} data-state={pendingSelectedStaffIds.includes(member.id) ? 'selected' : ''}>
                    <TableCell>
                       <Checkbox
                          checked={pendingSelectedStaffIds.includes(member.id)}
                          onCheckedChange={() => togglePendingStaffSelection(member.id)}
                          aria-label={`${member.name}を選択`}
                        />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div 
                          className="h-6 w-6 rounded-full border" 
                          style={{ backgroundColor: member.color }} 
                        />
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.id}</TableCell>
                    <TableCell className="text-muted-foreground">{member.calendarId}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      スタッフが見つかりません。
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
