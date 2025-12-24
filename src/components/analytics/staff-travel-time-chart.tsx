"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Order, Staff } from '@/lib/types';
import { differenceInMinutes, parseISO } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StaffTravelTimeChartProps {
    orders: Order[];
    allStaff?: Staff[];
}

export function StaffTravelTimeChart({ orders, allStaff = [] }: StaffTravelTimeChartProps) {
    const [viewMode, setViewMode] = useState<'staff' | 'mother-store'>('staff');

    const data = useMemo(() => {
        const aggregatorMap = new Map<string, { totalMinutes: number; count: number }>();

        orders.forEach(order => {
            // Check for valid timestamps
            if (!order.startTravelTime || !order.arrivalTimestamp) return;

            const start = typeof order.startTravelTime === 'string' ? parseISO(order.startTravelTime) : order.startTravelTime;
            const end = typeof order.arrivalTimestamp === 'string' ? parseISO(order.arrivalTimestamp) : order.arrivalTimestamp;

            // Safe check
            if (!(start instanceof Date) || isNaN(start.getTime())) return;
            if (!(end instanceof Date) || isNaN(end.getTime())) return;

            let duration = differenceInMinutes(end, start);

            // Filter invalid or outlier data (negative or > 5 hours for one trip?)
            if (duration <= 0 || duration > 300) return;

            let key = '不明';

            if (viewMode === 'staff') {
                key = order.staffName || '未割当';
            } else {
                // Determine Mother Store
                // Try to find staff by ID first, then Name
                let staff: Staff | undefined;
                if (order.staffId) {
                    staff = allStaff.find(s => s.id === order.staffId);
                }
                if (!staff && order.staffName) {
                    staff = allStaff.find(s => s.name === order.staffName);
                }

                if (staff && staff['母店']) {
                    key = staff['母店'];
                } else {
                    key = '母店不明';
                }
            }

            const current = aggregatorMap.get(key) || { totalMinutes: 0, count: 0 };
            aggregatorMap.set(key, {
                totalMinutes: current.totalMinutes + duration,
                count: current.count + 1
            });
        });

        // Convert to array and sort by Total Time (descending)
        return Array.from(aggregatorMap.entries())
            .map(([name, { totalMinutes, count }]) => ({
                name,
                totalHours: parseFloat((totalMinutes / 60).toFixed(1)),
                avgMinutes: Math.round(totalMinutes / count),
                count
            }))
            .sort((a, b) => b.totalHours - a.totalHours);

    }, [orders, allStaff, viewMode]);

    // If no data, show empty state in card
    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>移動時間分析</CardTitle>
                            <CardDescription>総移動時間（時間）と平均移動時間（分 / 回）</CardDescription>
                        </div>
                        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'staff' | 'mother-store')}>
                            <TabsList>
                                <TabsTrigger value="staff">スタッフ別</TabsTrigger>
                                <TabsTrigger value="mother-store">母店別</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground border border-dashed rounded-md bg-slate-50">
                        データがありません
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>移動時間分析</CardTitle>
                        <CardDescription>総移動時間（時間）と平均移動時間（分 / 回）</CardDescription>
                    </div>
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'staff' | 'mother-store')}>
                        <TabsList>
                            <TabsTrigger value="staff">スタッフ別</TabsTrigger>
                            <TabsTrigger value="mother-store">母店別</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ left: 20, right: 20, top: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} />
                            <XAxis
                                dataKey="name"
                                type="category"
                                tick={{ fontSize: 12 }}
                                interval={0}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis type="number" />
                            <Tooltip
                                formatter={(value: any, name: any, props: any) => {
                                    if (name === '総移動時間') return [`${value}時間`, name];
                                    if (name === '平均移動時間') return [`${value}分`, name];
                                    return [value, name];
                                }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        // Find payloads
                                        const total = payload.find(p => p.name === '総移動時間');
                                        const avg = payload.find(p => p.name === '平均移動時間');
                                        const count = payload[0].payload.count;

                                        return (
                                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="col-span-2 font-bold text-center border-b pb-1 mb-1">
                                                        {label} ({count}回)
                                                    </div>

                                                    <div className="flex flex-col">
                                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                            総移動時間
                                                        </span>
                                                        <span className="font-bold text-red-500">
                                                            {total?.value}時間
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                            平均/回
                                                        </span>
                                                        <span className="font-bold text-blue-500">
                                                            {avg?.value}分
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            <Bar dataKey="totalHours" name="総移動時間" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                            <Bar dataKey="avgMinutes" name="平均移動時間" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
