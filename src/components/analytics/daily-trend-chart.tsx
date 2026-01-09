"use client";

import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Brush
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyTrendChartProps {
    data: {
        date: string;
        day: number;
        count: number;
        hours: number;
        actualHours: number;
    }[];
}

export function DailyTrendChart({ data }: DailyTrendChartProps) {
    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader>
                <CardTitle>日別 受注件数・作業時間推移</CardTitle>
                <CardDescription>
                    月間の日次パフォーマンス推移
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={data}
                            margin={{
                                top: 20,
                                right: 30, // Extra margin for right Y-axis
                                bottom: 20,
                                left: 20,
                            }}
                        >
                            <CartesianGrid stroke="#f5f5f5" />
                            <XAxis dataKey="day" scale="band" label={{ value: '日', position: 'insideBottomRight', offset: -10 }} />
                            <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" label={{ value: '件数', angle: -90, position: 'insideLeft' }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" label={{ value: '時間(min)', angle: 90, position: 'insideRight' }} />
                            <Tooltip
                                labelFormatter={(value) => `${value}日`}
                                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                            />
                            <Legend verticalAlign="top" />
                            <Bar yAxisId="left" dataKey="count" name="受注件数" barSize={12} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="hours" name="予定稼働(min)" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
                            <Line yAxisId="right" type="monotone" dataKey="actualHours" name="実稼働(min)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                            {/* Brush adds a zoom/slider control below the chart */}
                            <Brush dataKey="day" height={30} stroke="#8884d8" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
