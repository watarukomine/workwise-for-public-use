'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { WithId, Staff } from '@/lib/types';
import { getMonthlyAttendance, saveDailyAttendance } from '@/services/attendance-service';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface MonthlyShiftTableProps {
    staffList: WithId<Staff>[];
    refreshTrigger?: number;
}

export function MonthlyShiftTable({ staffList, refreshTrigger = 0 }: MonthlyShiftTableProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [attendanceData, setAttendanceData] = useState<{ [date: string]: string[] }>({});
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const daysInMonth = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    useEffect(() => {
        const fetchAttendance = async () => {
            setIsLoading(true);
            try {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth() + 1;
                const data = await getMonthlyAttendance(year, month);
                setAttendanceData(data);
            } catch (error) {
                console.error("Failed to fetch monthly attendance:", error);
                toast({
                    variant: "destructive",
                    title: "エラー",
                    description: "シフトデータの取得に失敗しました。",
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchAttendance();
    }, [currentMonth, toast]);

    const handleMonthChange = (direction: 'next' | 'prev') => {
        setCurrentMonth(prev => {
            const newDate = new Date(prev);
            if (direction === 'next') {
                newDate.setMonth(newDate.getMonth() + 1);
            } else {
                newDate.setMonth(newDate.getMonth() - 1);
            }
            return newDate;
        });
    };

    const handleCellClick = async (day: Date, staffId: string, isAttending: boolean) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const currentAttendingIds = attendanceData[dateKey] || [];

        // Optimistic Update
        let newAttendingIds: string[];
        if (isAttending) {
            // Remove
            newAttendingIds = currentAttendingIds.filter(id => id !== staffId);
        } else {
            // Add
            newAttendingIds = [...currentAttendingIds, staffId];
        }

        setAttendanceData(prev => ({
            ...prev,
            [dateKey]: newAttendingIds
        }));

        try {
            await saveDailyAttendance(day, newAttendingIds);
            /* 
            // Toast might be too noisy for every click, keeping it subtle or removing success toast.
            toast({
                title: "保存しました",
                description: `${format(day, 'M/d')}の変更を保存しました。`,
                duration: 1000,
            });
            */
        } catch (error) {
            console.error("Failed to save attendance:", error);
            toast({
                variant: "destructive",
                title: "保存エラー",
                description: "変更の保存に失敗しました。ページをリロードしてください。",
            });
            // Revert on error
            setAttendanceData(prev => ({
                ...prev,
                [dateKey]: currentAttendingIds
            }));
        }
    };

    if (staffList.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">スタッフデータがありません。</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                    {format(currentMonth, 'yyyy年 M月', { locale: ja })} シフト表
                </h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleMonthChange('prev')}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleMonthChange('next')}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[800px] select-none">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px] sticky left-0 bg-background z-10">スタッフ名</TableHead>
                            {daysInMonth.map(day => {
                                const dayOfWeek = getDay(day);
                                return (
                                    <TableHead
                                        key={day.toISOString()}
                                        className={cn(
                                            "text-center min-w-[40px] p-1",
                                            dayOfWeek === 0 && "text-red-500",
                                            dayOfWeek === 6 && "text-blue-500"
                                        )}
                                    >
                                        <div>{format(day, 'd')}</div>
                                        <div className="text-xs">{format(day, 'E', { locale: ja })}</div>
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={daysInMonth.length + 1} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    <p className="text-xs text-muted-foreground mt-2">読み込み中...</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            staffList.map(staff => (
                                <TableRow key={staff.id}>
                                    <TableCell className="font-medium sticky left-0 bg-background z-10 border-r shadow-[1px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        {staff.name}
                                    </TableCell>
                                    {daysInMonth.map(day => {
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        const attendingIds = attendanceData[dateKey] || [];
                                        const isAttending = attendingIds.includes(staff.id);

                                        return (
                                            <TableCell
                                                key={day.toISOString()}
                                                className="text-center p-1 border-l cursor-pointer hover:bg-muted/50 transition-colors"
                                                onClick={() => handleCellClick(day, staff.id, isAttending)}
                                            >
                                                {isAttending ? (
                                                    <div className="flex justify-center">
                                                        <div className="h-4 w-4 rounded-full bg-green-500 shadow-sm" title="クリックで欠席に変更" />
                                                    </div>
                                                ) : (
                                                    <div className="h-4 w-4 mx-auto rounded-full hover:bg-gray-200" title="クリックで出勤に変更">
                                                        <span className="text-muted-foreground opacity-20">-</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="text-xs text-muted-foreground text-right mt-2 space-y-1">
                <p>※ 表のセルをクリックすることで、出勤/欠席の状態を切り替えることができます。</p>
                <p>※ ●は出勤登録済みを示します。</p>
            </div>
        </div>
    );
}
