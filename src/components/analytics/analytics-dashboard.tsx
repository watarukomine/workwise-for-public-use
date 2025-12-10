"use client";

import { useState, useMemo } from 'react';
import { useOrder } from '@/contexts/order-context';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { StaffWorkloadChart } from './staff-workload-chart';
import { ShopDistributionChart } from './shop-distribution-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToExcel, exportToPDF } from '@/lib/export-utils';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, format } from 'date-fns';
import { Download } from 'lucide-react';
import { Staff, Order } from '@/lib/types';

export function AnalyticsDashboard() {
    const { allOrders, isLoading: isOrdersLoading } = useOrder();
    const { allStaff, isLoading: isStaffLoading } = useSelectedStaff();
    const [dateRange, setDateRange] = useState('this-month');

    // Filter Logic
    const filteredData = useMemo(() => {
        const now = new Date();
        let start = startOfMonth(now);
        let end = endOfMonth(now);

        if (dateRange === 'last-month') {
            start = startOfMonth(subMonths(now, 1));
            end = endOfMonth(subMonths(now, 1));
        }

        const relevantOrders = allOrders.filter((order: Order) => {
            if (!order.scheduledDate) return false;
            // scheduledDate is YYYY-MM-DD string
            const orderDate = new Date(order.scheduledDate);
            return isWithinInterval(orderDate, { start, end });
        });

        return { orders: relevantOrders, start, end };
    }, [allOrders, dateRange]);

    // Aggregation Logic (Staff Workload)
    const staffWorkloadData = useMemo(() => {
        const workloadMap = new Map<string, { name: string, tasks: number, hours: number, color: string }>();

        // Initialize with all staff to show 0s
        allStaff.forEach((staff: Staff) => {
            workloadMap.set(staff.id, {
                name: staff.name,
                tasks: 0,
                hours: 0,
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
                workloadMap.set(staffId, {
                    ...current,
                    tasks: current.tasks + 1,
                    hours: current.hours + (order.estimatedDuration || 60) / 60
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
            // Logical "Shop" determination. 
            // 1. Check order.customerName if it implies a shop?
            // 2. Or, check the *Staff's* mother store for who handled it? 
            // User asked for "Shop Distribution" (likely which shop received the order OR which shop's staff handled it).
            // Let's assume grouping by "Staff's Mother Store" (who did the work) is the most available metric since Order doesn't always have "Shop" field clearly defined except in details.

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


    const handleExportExcel = () => {
        const title = `${format(filteredData.start, 'yyyy年MM月')}活動レポート`;
        // Flatten data for export
        // Export 1: Staff Summary
        const staffSheet = staffWorkloadData.map(d => ({
            'スタッフ名': d.name,
            '担当件数': d.tasks,
            '推定稼働時間(h)': d.hours.toFixed(1)
        }));
        exportToExcel(staffSheet, title, 'スタッフ稼働状況');
    };

    const handleExportPDF = () => {
        const title = `${format(filteredData.start, 'yyyy年MM月')} 活動レポート`;
        const headers = ['スタッフ名', '担当件数', '稼働時間(h)'];
        const data = staffWorkloadData.map(d => [d.name, d.tasks, d.hours.toFixed(1)]);
        exportToPDF(title, headers, data, title);
    };

    if (isOrdersLoading || isStaffLoading) {
        return <div className="p-8 text-center">データを読み込んでいます...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">分析ダッシュボード</h2>
                    <p className="text-muted-foreground">{format(filteredData.start, 'yyyy年MM月dd日')} - {format(filteredData.end, 'yyyy年MM月dd日')} の活動状況</p>
                </div>
                <div className="flex items-center gap-2">
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
                <StaffWorkloadChart data={staffWorkloadData} />
                <ShopDistributionChart data={shopDistributionData} />
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
