"use client";

import { useState, useMemo } from 'react';
import { useOrder } from '@/contexts/order-context';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import { StaffWorkloadChart } from './staff-workload-chart';
import { TireSizeAnalysisChart } from './tire-size-analysis-chart';
import { StaffTravelTimeChart } from './staff-travel-time-chart';
import { ShopDistributionChart } from './shop-distribution-chart';
import { MainStoreShareChart } from './main-store-share-chart';
import { DayOfWeekChart } from './day-of-week-chart';
import { TimeOfDayChart } from './time-of-day-chart';
import { DailyTrendChart } from './daily-trend-chart';
import { Button } from '@/components/ui/button';



import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToExcel, exportToPDF, exportDashboardToPDF } from '@/lib/export-utils';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, format, getDay, getDate, getHours } from 'date-fns';
import { Download } from 'lucide-react';
import { Staff, Order } from '@/lib/types';

export function AnalyticsDashboard() {
    const { orders: allOrders = [], isLoading: isOrdersLoading } = useOrder();
    const { allStaff = [], isLoading: isStaffLoading } = useSelectedStaff();
    const { profile, isLoading: isProfileLoading } = useUserProfile();
    const [dateRange, setDateRange] = useState('this-month');
    const [selectedStaffId, setSelectedStaffId] = useState<string>('all');

    // Filter Logic
    const filteredData = useMemo(() => {
        const now = new Date();
        let start = startOfMonth(now);
        let end = endOfMonth(now);

        if (dateRange === 'last-month') {
            start = startOfMonth(subMonths(now, 1));
            end = endOfMonth(subMonths(now, 1));
        }

        let relevantOrders = allOrders.filter((order: Order) => {
            if (!order.scheduledDate) return false;
            // scheduledDate is YYYY-MM-DD string
            const orderDate = new Date(order.scheduledDate);
            return isWithinInterval(orderDate, { start, end });
        });

        // Staff Filter
        if (selectedStaffId && selectedStaffId !== 'all') {
            relevantOrders = relevantOrders.filter(order => {
                // Check ID match
                if (order.staffId === selectedStaffId) return true;
                // Check Name match if ID missing (fallback)
                if (!order.staffId && order.staffName) {
                    const staff = allStaff.find(s => s.id === selectedStaffId);
                    return staff && staff.name === order.staffName;
                }
                return false;
            });
        }

        return { orders: relevantOrders, start, end };
    }, [allOrders, dateRange, selectedStaffId, allStaff]);

    // Helper to calculate duration
    const getOrderDuration = (order: Order) => {
        // Prefer actual time difference if available
        if (order.actualStartTime && order.actualEndTime) {
            const start = new Date(order.actualStartTime);
            const end = new Date(order.actualEndTime);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                const diffMs = end.getTime() - start.getTime();
                if (diffMs > 0) {
                    return diffMs / (1000 * 60 * 60); // Hours
                }
            }
        }
        // Fallback to estimated duration
        return (order.estimatedDuration || 60) / 60; // Hours
    };

    // Aggregation Logic (Staff Workload)
    const staffWorkloadData = useMemo(() => {
        const workloadMap = new Map<string, { name: string, tasks: number, hours: number, actualHours: number, color: string }>();

        // Initialize with all staff to show 0s
        allStaff.forEach((staff: Staff) => {
            workloadMap.set(staff.id, {
                name: staff.name,
                tasks: 0,
                hours: 0,
                actualHours: 0,
                color: staff.color || '#cccccc'
            });
        });

        filteredData.orders.forEach((order: Order) => {
            // Find staff by name (since order only has staff name string usually, or we verify mapping)
            // In this app, order.staffId is usually reliable if set via app, but let's check.
            // If order.staffId is missing, try to find by name
            let staffId = order.staffId;
            if (!staffId && order.staffName) {
                const found = allStaff.find((s: Staff) => s.name === order.staffName);
                if (found) staffId = found.id;
            }

            if (staffId && workloadMap.has(staffId)) {
                const current = workloadMap.get(staffId)!;

                // Calculate actual duration if timestamps exist
                let durationHours = (order.estimatedDuration || 60) / 60;
                let actualDurationHours = 0;

                if (order.actualStartTime && order.actualEndTime) {
                    const start = new Date(order.actualStartTime);
                    const end = new Date(order.actualEndTime);
                    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                        const diffMs = end.getTime() - start.getTime();
                        if (diffMs > 0) {
                            actualDurationHours = diffMs / (1000 * 60 * 60);
                        }
                    }
                }

                workloadMap.set(staffId, {
                    ...current,
                    tasks: current.tasks + 1,
                    hours: current.hours + durationHours,
                    actualHours: (current.actualHours || 0) + actualDurationHours
                });
            }
        });

        return Array.from(workloadMap.values())
            .filter(w => w.tasks > 0) // Optional: Hide 0 activity staff? Or keep them? Let's keep distinct active ones for chart clarity
            .sort((a, b) => b.tasks - a.tasks);
    }, [allStaff, filteredData.orders]);

    // Aggregation Logic (Shop Distribution)
    const shopDistributionData = useMemo(() => {
        const shopMap = new Map<string, number>();

        filteredData.orders.forEach((order: Order) => {
            let staffShop = '不明';
            const staff = allStaff.find((s: Staff) => s.name === order.staffName || s.id === order.staffId);
            if (staff && staff['母店']) {
                staffShop = staff['母店'];
            }

            shopMap.set(staffShop, (shopMap.get(staffShop) || 0) + 1);
        });

        const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

        return Array.from(shopMap.entries()).map(([name, value], index) => ({
            name,
            value,
            color: colors[index % colors.length]
        }));
    }, [allStaff, filteredData.orders]);

    // Aggregation Logic (Main Store Share)
    const mainStoreShareData = useMemo(() => {
        const storeMap = new Map<string, number>();

        filteredData.orders.forEach((order: Order) => {
            const storeName = order.mainStore || '主管店舗不明';
            storeMap.set(storeName, (storeMap.get(storeName) || 0) + 1);
        });

        const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#8dd1e1', '#a4de6c'];

        return Array.from(storeMap.entries()).map(([name, value], index) => ({
            name,
            value,
            color: colors[index % colors.length]
        }));
    }, [filteredData.orders]);

    // Aggregation: Day of Week
    const dayOfWeekData = useMemo(() => {
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const map = new Map<number, { count: number; hours: number }>();
        // Initialize
        for (let i = 0; i < 7; i++) map.set(i, { count: 0, hours: 0 });

        filteredData.orders.forEach(order => {
            if (order.scheduledDate) {
                const date = new Date(order.scheduledDate);
                const day = getDay(date); // 0 = Sun, 6 = Sat
                const current = map.get(day)!;
                map.set(day, {
                    count: current.count + 1,
                    hours: current.hours + getOrderDuration(order)
                });
            }
        });

        // Rotate to start from Monday as per business usual? Or Sunday?
        // Chart typically shows Mon-Sun or Sun-Sat. Let's do Mon-Sun (1-6, 0).
        // Let's stick to standard Sunday first or whatever makes sense.
        // Array order: Sun, Mon, Tue ...
        return Array.from(map.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([key, val]) => ({
                day: days[key],
                count: val.count,
                hours: parseFloat(val.hours.toFixed(1))
            }));
    }, [filteredData.orders]);

    // Aggregation: Time of Day
    const timeOfDayData = useMemo(() => {
        const map = new Map<number, { count: number; hours: number }>();
        for (let i = 0; i < 24; i++) map.set(i, { count: 0, hours: 0 });

        filteredData.orders.forEach(order => {
            // Use actualStartTime if available, else scheduledTime
            let hour = -1;
            if (order.actualStartTime) {
                hour = getHours(new Date(order.actualStartTime));
            } else if (order.scheduledTime) {
                // scheduledTime "HH:mm"
                const parts = order.scheduledTime.split(':');
                if (parts.length >= 1) hour = parseInt(parts[0]);
            }

            if (hour >= 0 && hour < 24) {
                const current = map.get(hour)!;
                map.set(hour, {
                    count: current.count + 1,
                    hours: current.hours + getOrderDuration(order)
                });
            }
        });

        return Array.from(map.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([hour, val]) => ({
                hour: `${hour}:00`,
                count: val.count,
                hours: parseFloat(val.hours.toFixed(1))
            }));
    }, [filteredData.orders]);

    // Aggregation: Daily Trend
    const dailyTrendData = useMemo(() => {
        // Initialize all days in month
        const daysInMonth = new Date(filteredData.end).getDate(); // Last day number
        const map = new Map<number, { count: number; hours: number; dateStr: string }>();

        for (let i = 1; i <= daysInMonth; i++) {
            map.set(i, { count: 0, hours: 0, dateStr: `${i}` });
        }

        filteredData.orders.forEach(order => {
            if (order.scheduledDate) {
                const date = new Date(order.scheduledDate);
                const day = getDate(date);
                if (map.has(day)) {
                    const current = map.get(day)!;
                    map.set(day, {
                        ...current,
                        count: current.count + 1,
                        hours: current.hours + getOrderDuration(order)
                    });
                }
            }
        });

        return Array.from(map.values()).map(d => ({
            date: d.dateStr,
            day: parseInt(d.dateStr), // For sorting/brush
            count: d.count,
            hours: parseFloat(d.hours.toFixed(1))
        }));
    }, [filteredData]);


    const handleExportExcel = () => {
        const title = `${format(filteredData.start, 'yyyy年MM月')}活動レポート`;

        // Calculate total tasks for percentage
        const totalTasks = staffWorkloadData.reduce((sum, d) => sum + d.tasks, 0);

        // Flatten data for export
        // Export 1: Staff Summary
        const staffSheet = staffWorkloadData.map(d => ({
            'スタッフ名': d.name,
            '担当件数': d.tasks,
            '構成比': totalTasks > 0 ? `${(d.tasks / totalTasks * 100).toFixed(1)}%` : '0.0%',
            '推定稼働時間(h)': d.hours.toFixed(1),
            '実稼働時間(h)': d.actualHours.toFixed(1)
        }));
        exportToExcel(staffSheet, title, 'スタッフ稼働状況');
    };

    const handleExportPDF = async () => {
        const title = `${format(filteredData.start, 'yyyy年MM月')} 活動レポート`;
        const chartIds = [
            'chart-workload',
            'chart-shop-dist',
            'chart-main-store',
            'chart-travel',
            'chart-day-week',
            'chart-time-day',
            'chart-daily-trend',
            'chart-tire-size'
        ];

        await exportDashboardToPDF(title, chartIds, title);
    };

    if (isOrdersLoading || isStaffLoading || isProfileLoading) {
        return <div className="p-8 text-center">データを読み込んでいます...</div>;
    }

    if (!profile || profile.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <p className="text-lg font-semibold mb-2">アクセス権限がありません</p>
                <p>このページを表示するには管理者権限が必要です。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">分析ダッシュボード</h2>
                    <p className="text-muted-foreground">{format(filteredData.start, 'yyyy年MM月dd日')} - {format(filteredData.end, 'yyyy年MM月dd日')} の活動状況</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="スタッフを選択" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全スタッフ</SelectItem>
                            {allStaff.map(staff => (
                                <SelectItem key={staff.id} value={staff.id}>
                                    {staff.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="期間を選択" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="this-month">今月</SelectItem>
                            <SelectItem value="last-month">先月</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleExportExcel}>
                        <Download className="mr-2 h-4 w-4" /> Excel出力
                    </Button>
                    <Button variant="outline" onClick={handleExportPDF}>
                        <Download className="mr-2 h-4 w-4" /> PDF出力
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div id="chart-workload"><StaffWorkloadChart data={staffWorkloadData} /></div>
                <div id="chart-shop-dist"><ShopDistributionChart data={shopDistributionData} /></div>
                <div id="chart-main-store"><MainStoreShareChart data={mainStoreShareData} /></div>
                <div id="chart-travel"><StaffTravelTimeChart orders={filteredData.orders} allStaff={allStaff} /></div>

                {/* New Charts */}
                <div id="chart-day-week"><DayOfWeekChart data={dayOfWeekData} /></div>
                <div id="chart-time-day"><TimeOfDayChart data={timeOfDayData} /></div>
                <div id="chart-daily-trend"><DailyTrendChart data={dailyTrendData} /></div>

                <div id="chart-tire-size"><TireSizeAnalysisChart orders={filteredData.orders} /></div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>受注リスト概要</CardTitle>
                    <CardDescription>期間内の全受注データのサマリ</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{filteredData.orders.length} <span className="text-sm font-normal text-muted-foreground">件の受注</span></div>
                </CardContent>
            </Card>
        </div>
    );
}
