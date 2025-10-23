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

interface StaffTableProps {
    staff: Staff[];
    isLoading: boolean;
}

export function StaffTable({ staff, isLoading }: StaffTableProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>スタッフ名</TableHead>
                <TableHead>スタッフID</TableHead>
                <TableHead>カレンダーID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      スタッフ情報を読み込んでいます...
                    </TableCell>
                  </TableRow>
              ) : staff && staff.length > 0 ? (
                staff.map((member) => (
                  <TableRow key={member.id}>
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
                    <TableCell colSpan={3} className="h-24 text-center">
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
