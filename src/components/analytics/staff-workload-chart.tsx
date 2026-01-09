"use client";

import {
    Bar,
    BarChart,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StaffWorkloadChartProps {
    data: {
        name: string;
        tasks: number;
        hours: number;
        actualHours?: number;
        color: string;
    }[];
}

export function StaffWorkloadChart({ data }: StaffWorkloadChartProps) {
    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>スタッフ別稼働状況</CardTitle>
                <CardDescription>
                    期間内の担当タスク数、推定稼働、および実稼働時間
                </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#3b82f6"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                            label={{ value: '件数', angle: -90, position: 'insideLeft' }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#f43f5e"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                            label={{ value: '時間(h)', angle: 90, position: 'insideRight' }}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                            formatter={(value: number, name: string) => {
                                if (name === 'タスク数') return [value, name];
                                return [value.toFixed(2), name];
                            }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="tasks" name="タスク数" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar yAxisId="right" dataKey="hours" name="推定稼働(h)" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar yAxisId="right" dataKey="actualHours" name="実稼働(h)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
