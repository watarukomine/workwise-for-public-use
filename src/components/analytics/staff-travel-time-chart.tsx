"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Order } from '@/lib/types';
import { differenceInMinutes, parseISO } from 'date-fns';

interface StaffTravelTimeChartProps {
    orders: Order[];
}

export function StaffTravelTimeChart({ orders }: StaffTravelTimeChartProps) {
    const data = useMemo(() => {
        const staffMap = new Map<string, { totalMinutes: number; count: number }>();

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

            // Use Order Staff Name
            const staffName = order.staffName || '未割当';

            const current = staffMap.get(staffName) || { totalMinutes: 0, count: 0 };
            staffMap.set(staffName, {
                totalMinutes: current.totalMinutes + duration,
                count: current.count + 1
            });
        });

        // Convert to array and sort by Total Time (descending)
        return Array.from(staffMap.entries())
            .map(([name, { totalMinutes, count }]) => ({
                name,
                totalHours: parseFloat((totalMinutes / 60).toFixed(1)),
                avgMinutes: Math.round(totalMinutes / count),
                count
            }))
            .sort((a, b) => b.totalHours - a.totalHours);

    }, [orders]);

    if (data.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>スタッフ別 移動時間分析</CardTitle>
                <CardDescription>総移動時間（時間）と平均移動時間（分 / 回）</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} />
                            <XAxis type="number" />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={100}
                                tick={{ fontSize: 12 }}
                            />
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
                            <Bar dataKey="totalHours" name="総移動時間" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                            <Bar dataKey="avgMinutes" name="平均移動時間" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
