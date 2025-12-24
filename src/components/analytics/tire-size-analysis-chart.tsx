"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Order } from '@/lib/types';
import { differenceInMinutes, parseISO } from 'date-fns';
import { findKey } from '@/lib/utils';

interface TireSizeAnalysisChartProps {
    orders: Order[];
}

export function TireSizeAnalysisChart({ orders }: TireSizeAnalysisChartProps) {
    const data = useMemo(() => {
        const inchMap = new Map<string, { totalMinutes: number; count: number }>();

        orders.forEach(order => {
            // 1. Calculate Duration
            let duration = 0;

            // Priority 1: Actual Timestamps
            if (order.actualStartTime && order.actualEndTime) {
                const start = typeof order.actualStartTime === 'string' ? parseISO(order.actualStartTime) : order.actualStartTime;
                const end = typeof order.actualEndTime === 'string' ? parseISO(order.actualEndTime) : order.actualEndTime;

                if ((start instanceof Date) && !isNaN(start.getTime()) && (end instanceof Date) && !isNaN(end.getTime())) {
                    const diff = differenceInMinutes(end, start);
                    if (diff > 0 && diff <= 600) {
                        duration = diff;
                    }
                }
            }

            // Priority 2: Manual Entry (estimatedDuration)
            // Only use if timestamps failed AND we have a valid manual entry.
            // In utils.ts, estimatedDuration defaults to 60. We need to check if it's a REAL value.
            // We use findKey to be robust against column name variations (like spaces).
            if (duration === 0) {
                const rawDuration = order.raw ? findKey(order.raw, ['作業時間（分）', '作業時間(分)', '作業時間', 'workTime', '作業所要時間']) : undefined;

                if (rawDuration) {
                    // Handle ISO Date strings from Sheets (e.g., "1899-12-30T00:45:00.000Z")
                    if (typeof rawDuration === 'string' && (rawDuration.includes('T') || rawDuration.includes('1899-'))) {
                        const date = parseISO(rawDuration);
                        if (!isNaN(date.getTime())) {
                            // Extract hours and minutes
                            const hours = date.getHours();
                            const minutes = date.getMinutes();
                            const totalMinutes = hours * 60 + minutes;
                            if (totalMinutes > 0) {
                                duration = totalMinutes;
                            }
                        }
                    }
                    // Handle "HH:mm" format if it appears as string
                    else if (typeof rawDuration === 'string' && rawDuration.includes(':')) {
                        const [hoursStr, minutesStr] = rawDuration.split(':');
                        const h = parseInt(hoursStr, 10);
                        const m = parseInt(minutesStr, 10);
                        if (!isNaN(h) && !isNaN(m)) {
                            duration = h * 60 + m;
                        }
                    }
                    // Handle direct number (string or number type)
                    else {
                        const parsed = parseInt(String(rawDuration), 10);
                        // If it parsed as 1899, it might have been a date string that slipped through? 
                        // But the check above should catch '1899-'.
                        if (!isNaN(parsed) && parsed > 0 && parsed !== 1899) {
                            duration = parsed;
                        }
                    }
                }
            }

            // If still 0, we skip this order for the average calculation
            if (duration === 0) return;


            // Extract Inch
            const tireSize = order.tireSize || '';
            // Match "R" + digits or "inch" or simple 2 digits
            let inch = '';

            const rMatch = tireSize.toUpperCase().match(/[Z]?R(\d{2})/);
            if (rMatch) {
                inch = rMatch[1];
            }

            if (!inch) {
                const inchMatch = tireSize.match(/(\d{2})\s*(inch|インチ|in)/i);
                if (inchMatch) {
                    inch = inchMatch[1];
                }
            }

            if (!inch) {
                const simpleMatch = tireSize.trim().match(/^(\d{2})$/);
                if (simpleMatch) {
                    inch = simpleMatch[1];
                }
            }

            if (!inch) return;

            const current = inchMap.get(inch) || { totalMinutes: 0, count: 0 };
            inchMap.set(inch, {
                totalMinutes: current.totalMinutes + duration,
                count: current.count + 1
            });
        });

        // Convert to array and sort by Inch value
        return Array.from(inchMap.entries())
            .map(([inch, { totalMinutes, count }]) => ({
                name: inch,
                avgMinutes: Math.round(totalMinutes / count),
                count: count
            }))
            .sort((a, b) => parseInt(a.name) - parseInt(b.name));

    }, [orders]);

    // If no data, show empty state in card
    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>タイヤサイズ別 平均作業時間</CardTitle>
                    <CardDescription>インチ数ごとの平均実作業時間（分）</CardDescription>
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
                <CardTitle>タイヤサイズ別 平均作業時間</CardTitle>
                <CardDescription>インチ数ごとの平均実作業時間（分）</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="name"
                                label={{ value: 'インチ', position: 'insideBottom', offset: -5 }}
                            />
                            <YAxis
                                label={{ value: '分', angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip
                                formatter={(value: any, name: any, props: any) => [
                                    `${value}分`,
                                    '平均時間'
                                ]}
                                labelFormatter={(label) => `${label}インチ`}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                            インチ
                                                        </span>
                                                        <span className="font-bold text-muted-foreground">
                                                            {label}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                            平均時間
                                                        </span>
                                                        <span className="font-bold">
                                                            {payload[0].value}分
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                            サンプル数
                                                        </span>
                                                        <span className="font-bold text-muted-foreground">
                                                            {payload[0].payload.count}件
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            <Bar dataKey="avgMinutes" fill="#82ca9d" name="平均時間" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
