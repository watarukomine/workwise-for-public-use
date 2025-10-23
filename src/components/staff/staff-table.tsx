
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
} from "@/components/ui/card";
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { useSelectedStaff } from '@/contexts/selected-staff-context';

interface StaffTableProps {
    staff: Staff[];
    isLoading: boolean;
}

export function StaffTable({ staff, isLoading }: StaffTableProps) {
  const { selectedStaffIds, toggleStaffSelection } = useSelectedStaff();
  const isAllSelected = staff.length > 0 && selectedStaffIds.length === staff.length;

  const handleSelectAll = () => {
    const allStaffIds = staff.map(s => s.id);
    if (isAllSelected) {
      // Deselect all
      allStaffIds.forEach(id => {
        if (selectedStaffIds.includes(id)) {
          toggleStaffSelection(id);
        }
      });
    } else {
      // Select all
      allStaffIds.forEach(id => {
        if (!selectedStaffIds.includes(id)) {
          toggleStaffSelection(id);
        }
      });
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
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
                  <TableRow key={member.id} data-state={selectedStaffIds.includes(member.id) ? 'selected' : ''}>
                    <TableCell>
                       <Checkbox
                          checked={selectedStaffIds.includes(member.id)}
                          onCheckedChange={() => toggleStaffSelection(member.id)}
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
