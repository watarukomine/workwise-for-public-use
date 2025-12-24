"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Order } from '@/lib/types';
import { differenceInMinutes, parseISO } from 'date-fns';

interface TireSizeAnalysisChartProps {
    orders: Order[];
}

export function TireSizeAnalysisChart({ orders }: TireSizeAnalysisChartProps) {
    const data = useMemo(() => {
        const inchMap = new Map<string, { totalMinutes: number; count: number }>();

        orders.forEach(order => {
            // Filter for completed tasks with valid timestamps
            if (!order.actualStartTime || !order.actualEndTime) return;

            // Simple status check - if it has start/end time, it's considered done or actionable for this stat.
            // Some might use order.status === '完了' but timestamps are the source of truth for duration.

            // Parsing Dates
            const start = typeof order.actualStartTime === 'string' ? parseISO(order.actualStartTime) : order.actualStartTime;
            const end = typeof order.actualEndTime === 'string' ? parseISO(order.actualEndTime) : order.actualEndTime;
            // Handle Firestore timestamps if they slip through as objects? 
            // In types.ts they are Date objects usually after service conversion. 
            // Let's assume they are Dates or ISO strings.

            // Safe check for Date validity
            if (!(start instanceof Date) || isNaN(start.getTime())) return;
            if (!(end instanceof Date) || isNaN(end.getTime())) return;

            const duration = differenceInMinutes(end, start);
            if (duration <= 0 || duration > 600) return; // Filter reasonable outliers (0 or >10 hrs)

            // Extract Inch
            const tireSize = order.tireSize || '';
            // Regex to find "R" followed by digits, or just take last 2 digits if they are numbers?
            // User heuristic: "tire size lower 2 digits is inch".
            // Implementation: Find the last 2 digits in the string.
            // Example: "195/65R15" -> "15"
            // Example: "205/60R16 92H" -> "16" (if strict last 2 digits of string might capture load index "92"?)

            // Refined Heuristic: "R" followed by 2 digits is standard.
            // Let's try matching "R" + digits.
            let inch = '';
            // 1. Look for R/ZR followed by digits (standard format: 195/65R15)
            const rMatch = tireSize.toUpperCase().match(/[Z]?R(\d{2})/);
            if (rMatch) {
                inch = rMatch[1];
            }

            // 2. Look for "inch" or "インチ" (e.g. 14インチ)
            if (!inch) {
                const inchMatch = tireSize.match(/(\d{2})\s*(inch|インチ|in)/i);
                if (inchMatch) {
                    inch = inchMatch[1];
                }
            }

            // 3. Fallback: If the string is just 2 digits (e.g. "14")
            if (!inch) {
                const simpleMatch = tireSize.trim().match(/^(\d{2})$/);
                if (simpleMatch) {
                    inch = simpleMatch[1];
                }
            }

            if (!inch) return; // Could not determine inch

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
