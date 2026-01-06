"use client";

import React, { useState } from 'react';
import { useOrder } from '@/contexts/order-context';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function DebugStatusPage() {
    const { orders, rawOrdersData, statuses, scheduleEvents, refetchOrders, isLoading: isOrderLoading } = useOrder();
    const { allStaff, isLoading: isStaffLoading } = useSelectedStaff();
    const [filterStaff, setFilterStaff] = useState<string>('');

    const filteredRawOrders = React.useMemo(() => {
        if (!rawOrdersData || !Array.isArray(rawOrdersData)) return [];
        if (!filterStaff) return rawOrdersData;
        return rawOrdersData.filter(o =>
            (o.staffName && o.staffName.includes(filterStaff)) ||
            (o.raw && JSON.stringify(o.raw).includes(filterStaff))
        );
    }, [rawOrdersData, filterStaff]);

    const filteredStatuses = React.useMemo(() => {
        if (!statuses || !Array.isArray(statuses)) return [];
        if (!filterStaff) return statuses;
        // Find staff ID by name if possible
        const staff = allStaff?.find(s => s.name?.includes(filterStaff));
        if (staff) {
            return statuses.filter(s => s.staffId === staff.id);
        }
        return statuses;
    }, [statuses, filterStaff, allStaff]);

    if (isOrderLoading || isStaffLoading) return <div className="p-8">Loading Data...</div>;

    return (
        <div className="container mx-auto p-4 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Status Debug Dashboard</h1>
                <Button onClick={() => refetchOrders()}>Refetch Data</Button>
            </div>

            <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
                <p className="font-bold">Instructions:</p>
                <ul className="list-disc pl-5">
                    <li>Check if the "Moving" status appears in <strong>Raw Data</strong>.</li>
                    <li>If it appears in Raw Data but not in <strong>Computed Statuses</strong>, the parsing logic is failing.</li>
                    <li>Check the <strong>Last Update</strong> timestamp. If it is invalid or not "Today", it might be ignored.</li>
                </ul>
            </div>

            <div>
                <input
                    type="text"
                    placeholder="Filter by Staff Name..."
                    className="border p-2 rounded w-full max-w-sm"
                    value={filterStaff}
                    onChange={(e) => setFilterStaff(e.target.value)}
                />
            </div>

            <Card>
                <CardHeader><CardTitle>Computed Statuses (OrderContext)</CardTitle></CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse border border-gray-300">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border p-2">Staff ID</th>
                                    <th className="border p-2">Staff Name</th>
                                    <th className="border p-2">Status</th>
                                    <th className="border p-2">Last Action</th>
                                    <th className="border p-2">Last Update (State)</th>
                                    <th className="border p-2">Coords</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStatuses.map(s => {
                                    const staff = allStaff.find(st => st.id === s.staffId);
                                    return (
                                        <tr key={s.staffId}>
                                            <td className="border p-2 font-mono text-xs">{s.staffId}</td>
                                            <td className="border p-2 font-bold">{staff?.name || 'Unknown'}</td>
                                            <td className="border p-2 text-blue-600">{s.status}</td>
                                            <td className="border p-2">{s.lastAction}</td>
                                            <td className="border p-2">
                                                {s.lastUpdate ? (
                                                    <div>
                                                        <div>{format(new Date(s.lastUpdate), 'yyyy-MM-dd HH:mm:ss')}</div>
                                                        <div className="text-xs text-gray-400">{s.lastUpdate}</div>
                                                        <div className={new Date(s.lastUpdate).toDateString() === new Date().toDateString() ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                                                            isToday: {new Date(s.lastUpdate).toDateString() === new Date().toDateString() ? 'YES' : 'NO'}
                                                        </div>
                                                    </div>
                                                ) : 'N/A'}
                                            </td>
                                            <td className="border p-2">{s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : 'None'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Staff Data Debug (Raw Keys check)</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {allStaff.filter(s => !filterStaff || s.name.includes(filterStaff)).map(staff => (
                            <div key={staff.id} className="border p-4 rounded text-xs font-mono">
                                <div className="font-bold text-lg">{staff.name}</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="font-bold border-b mb-2">Mapped Object</div>
                                        <div>Email: <span className={staff.email ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{staff.email || "(Empty)"}</span></div>
                                        <div>Role: {staff.role}</div>
                                        <div>Color: <span style={{ backgroundColor: staff.color }} className="px-2">{staff.color}</span></div>
                                    </div>
                                    <div>
                                        <div className="font-bold border-b mb-2">Raw Object Keys & Values</div>
                                        <pre className="whitespace-pre-wrap break-all">
                                            {JSON.stringify(staff, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Raw Orders Data (GAS)</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500 mb-2">Showing {filteredRawOrders.length} records</p>
                    <div className="space-y-4">
                        {filteredRawOrders.map((order, idx) => (
                            <div key={idx} className="border p-4 rounded bg-gray-50 text-xs font-mono overflow-auto">
                                <div className="font-bold mb-1 border-b pb-1">Record #{idx} - ID: {order.id}</div>
                                <pre>{JSON.stringify(order.raw, null, 2)}</pre>
                                <hr className="my-2" />
                                <div>Parsed Status: {order.status}</div>
                                <div>Parsed Staff: {order.staffName}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
