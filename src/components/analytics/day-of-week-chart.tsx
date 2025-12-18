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
    ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DayOfWeekChartProps {
    data: {
        day: string;
        count: number;
        hours: number;
    }[];
}

export function DayOfWeekChart({ data }: DayOfWeekChartProps) {
    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>曜日別 受注件数・作業時間</CardTitle>
                <CardDescription>
                    曜日ごとのパフォーマンス分析
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={data}
                            margin={{
                                top: 20,
                                right: 20,
                                bottom: 20,
                                left: 20,
                            }}
                        >
                            <CartesianGrid stroke="#f5f5f5" />
                            <XAxis dataKey="day" scale="band" />
                            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" label={{ value: '件数', angle: -90, position: 'insideLeft' }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#ff7300" label={{ value: '時間(h)', angle: 90, position: 'insideRight' }} />
                            <Tooltip
                                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                            />
                            <Legend />
                            <Bar yAxisId="left" dataKey="count" name="受注件数" barSize={20} fill="#8884d8" radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="hours" name="作業時間(h)" stroke="#ff7300" strokeWidth={2} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
