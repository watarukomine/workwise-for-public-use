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
        color: string;
    }[];
}

export function StaffWorkloadChart({ data }: StaffWorkloadChartProps) {
    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>スタッフ別稼働状況</CardTitle>
                <CardDescription>
                    期間内の担当タスク数と推定稼働時間
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
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                        />
                        <Legend />
                        <Bar dataKey="tasks" name="タスク数" fill="#adfa1d" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="hours" name="稼働時間(h)" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
