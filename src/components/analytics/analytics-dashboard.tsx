"use client";

import { findKey, calculateWorkDurationMinutes } from '@/lib/utils';
import { useState, useMemo, useEffect } from 'react';
import { useOrder } from '@/contexts/order-context';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import { useUserProfile } from '@/hooks/use-user-profile';
import { StaffWorkloadChart } from './staff-workload-chart';
import { TireSizeAnalysisChart } from './tire-size-analysis-chart';
import { StaffTravelTimeChart } from './staff-travel-time-chart';
import { ShopDistributionChart } from './shop-distribution-chart';
import { MainStoreShareChart } from './main-store-share-chart';
import { DayOfWeekChart } from './day-of-week-chart';
import { TimeOfDayChart } from './time-of-day-chart';
import { DailyTrendChart } from './daily-trend-chart';
import { Button } from '@/components/ui/button';



import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToExcel, exportToPDF, exportDashboardToPDF } from '@/lib/export-utils';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, format, getDay, getDate, getHours } from 'date-fns';
import { Download } from 'lucide-react';
import { Staff, Order } from '@/lib/types';

export function AnalyticsDashboard() {
    const { orders: allOrders = [], isLoading: isOrdersLoading } = useOrder();
    const { allStaff = [], isLoading: isStaffLoading } = useSelectedStaff();
    const { profile, isLoading: isProfileLoading } = useUserProfile();
    const { loadRange } = useOrder();
    const [dateRange, setDateRange] = useState('this-month');
    const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);
    const [loadedRanges, setLoadedRanges] = useState<Set<string>>(new Set());

    // Auto-load historical data when needed
    useEffect(() => {
        const fetchHistory = async () => {
            // If already loading or already fetched this session, skip
            if (isFetchingHistory || loadedRanges.has(dateRange)) return;

            const now = new Date();
            let start = startOfMonth(now);
            let range = 31; // Default month range

            if (dateRange === 'last-month') {
                start = startOfMonth(subMonths(now, 1));
                range = 60; // 2 months to be safe
            } else if (dateRange === 'all-time') {
                // For "All time", fetch a large range (e.g., last 3 years) around current date or specific base
                range = 1000; 
            } else if (dateRange === 'this-month') {
                // Even for "this-month", we want at least 31 days to cover the whole month
                range = 31;
            } else {
                return; // Nothing to fetch for other types if any
            }

            setIsFetchingHistory(true);
            try {
                await loadRange(start, range);
                setLoadedRanges(prev => {
                    const next = new Set(prev);
                    next.add(dateRange);
                    return next;
                });
            } catch (error) {
                console.error("Failed to load historical analytics data:", error);
            } finally {
                setIsFetchingHistory(false);
            }
        };

        fetchHistory();
    }, [dateRange, loadRange, isFetchingHistory, loadedRanges]);

    // Filter Logic
    const filteredData = useMemo(() => {
        const now = new Date();
        let start = startOfMonth(now);
        let end = endOfMonth(now);
        let isFullRange = false;

        if (dateRange === 'last-month') {
            start = startOfMonth(subMonths(now, 1));
            end = endOfMonth(subMonths(now, 1));
        } else if (dateRange === 'all-time') {
            start = new Date(2000, 0, 1); // Way in the past
            end = new Date(2099, 11, 31); // Way in the future
            isFullRange = true;
        }

        let relevantOrders = allOrders.filter((order: Order) => {
            if (!order.scheduledDate) return false;
            // scheduledDate is YYYY-MM-DD string
            const orderDate = new Date(order.scheduledDate);
            if (isFullRange) return true; // Show all if all-time
            return isWithinInterval(orderDate, { start, end });
        });

        // Filter by Staff
        if (selectedStaffId !== 'all') {
            const targetStaff = allStaff.find(s => s.id === selectedStaffId);
            const targetName = targetStaff?.name;

            relevantOrders = relevantOrders.filter(order => {
                if (order.staffId === selectedStaffId) return true;
                if (targetName && order.staffName === targetName) return true;
                return false;
            });
        }

        return { orders: relevantOrders, start, end };
    }, [allOrders, dateRange, selectedStaffId, allStaff]);

    // Helper to calculate duration
    const getOrderDuration = (order: Order) => {
        if (typeof order.workDuration === 'number' && order.workDuration > 0) {
            return order.workDuration / 60; // Hours
        }
        if (typeof (order as any).actualDuration === 'number' && (order as any).actualDuration > 0) {
            return (order as any).actualDuration / 60; // Hours
        }
        const computedMin = calculateWorkDurationMinutes(order.actualStartTime, order.arrivalTimestamp, order.actualEndTime);
        if (computedMin && computedMin > 0) {
            return computedMin / 60; // Hours
        }
        return (order.estimatedDuration || 60) / 60; // Hours
    };

    // Aggregation Logic (Staff Workload)
    const staffWorkloadData = useMemo(() => {
        const workloadMap = new Map<string, { name: string, tasks: number, hours: number, actualHours: number, color: string }>();

        // Initialize with all staff to show 0s
        allStaff.forEach((staff: Staff) => {
            workloadMap.set(staff.id, {
                name: staff.name,
                tasks: 0,
                hours: 0,
                actualHours: 0,
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

                // Calculate actual duration if timestamps exist
                let durationHours = (order.estimatedDuration || 60) / 60;
                let actualDurationHours = 0;

                // 0. Pre-computed workDuration from Firestore (Highest Priority)
                if (typeof order.workDuration === 'number' && order.workDuration > 0) {
                    actualDurationHours = order.workDuration / 60;
                } else if (typeof (order as any).actualDuration === 'number' && (order as any).actualDuration > 0) {
                    actualDurationHours = (order as any).actualDuration / 60;
                }

                // 1. Try raw data column if workDuration is not yet set
                if (actualDurationHours === 0 && order.raw) {
                    const rawDuration = findKey(order.raw, ['作業所要時間', '作業時間', '作業時間（分）', '作業時間(分)', 'workTime', 'actualDuration', '実稼働時間', '所要時間']);
                    if (rawDuration) {
                        const valStr = String(rawDuration);
                        // Handle "1:30" or "1:30:00" format (H:mm)
                        if (valStr.includes(':') && !valStr.includes('1899')) {
                            const parts = valStr.split(':');
                            if (parts.length >= 2) {
                                const h = parseInt(parts[0], 10);
                                const m = parseInt(parts[1], 10);
                                if (!isNaN(h) && !isNaN(m)) {
                                    actualDurationHours = h + (m / 60); // Hours
                                }
                            }
                        }
                        // Handle GAS Date object string (1899-12-30...)
                        else if (valStr.includes('1899')) {
                            const date = new Date(valStr);
                            if (!isNaN(date.getTime())) {
                                actualDurationHours = (date.getHours() * 60 + date.getMinutes()) / 60; // Minutes to Hours
                            }
                        }
                        // Handle raw minutes (90)
                        else {
                            const parsed = parseFloat(valStr);
                            if (!isNaN(parsed) && parsed > 0) {
                                actualDurationHours = parsed / 60; // Minutes to Hours
                            }
                        }
                    }
                }

                // 2. Fallback to timestamps (with arrivalTimestamp fallback)
                if (actualDurationHours === 0 && (order.actualStartTime || order.arrivalTimestamp) && order.actualEndTime) {
                    const computedMin = calculateWorkDurationMinutes(order.actualStartTime, order.arrivalTimestamp, order.actualEndTime);
                    if (computedMin && computedMin > 0) {
                        actualDurationHours = computedMin / 60; // Hours
                    }
                }

                workloadMap.set(staffId, {
                    ...current,
                    tasks: current.tasks + 1,
                    hours: current.hours + ((order.estimatedDuration || 60) / 60), // Convert Minutes to Hours
                    actualHours: (current.actualHours || 0) + actualDurationHours
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

    // Aggregation Logic (Main Store Share)
    const mainStoreShareData = useMemo(() => {
        const storeMap = new Map<string, number>();

        filteredData.orders.forEach((order: Order) => {
            const storeName = order.mainStore || '主管店舗不明';
            storeMap.set(storeName, (storeMap.get(storeName) || 0) + 1);
        });

        const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#8dd1e1', '#a4de6c'];

        return Array.from(storeMap.entries()).map(([name, value], index) => ({
            name,
            value,
            color: colors[index % colors.length]
        }));
    }, [filteredData.orders]);

    // Aggregation: Day of Week
    const dayOfWeekData = useMemo(() => {
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const map = new Map<number, { count: number; hours: number }>();
        // Initialize
        for (let i = 0; i < 7; i++) map.set(i, { count: 0, hours: 0 });

        filteredData.orders.forEach(order => {
            if (order.scheduledDate) {
                const date = new Date(order.scheduledDate);
                const day = getDay(date); // 0 = Sun, 6 = Sat
                const current = map.get(day)!;
                map.set(day, {
                    count: current.count + 1,
                    hours: current.hours + getOrderDuration(order)
                });
            }
        });

        // Rotate to start from Monday as per business usual? Or Sunday?
        // Chart typically shows Mon-Sun or Sun-Sat. Let's do Mon-Sun (1-6, 0).
        // Let's stick to standard Sunday first or whatever makes sense.
        // Array order: Sun, Mon, Tue ...
        return Array.from(map.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([key, val]) => ({
                day: days[key],
                count: val.count,
                hours: parseFloat(val.hours.toFixed(1))
            }));
    }, [filteredData.orders]);

    // Aggregation: Time of Day
    const timeOfDayData = useMemo(() => {
        const map = new Map<number, { count: number; hours: number }>();
        // Only 8:00 to 19:00 (include 19:00? usually "8-19" means up to 19:xx, so index 19 is included)
        for (let i = 8; i <= 19; i++) map.set(i, { count: 0, hours: 0 });

        filteredData.orders.forEach(order => {
            // Use actualStartTime if available, else scheduledTime
            let hour = -1;
            if (order.actualStartTime) {
                hour = getHours(new Date(order.actualStartTime));
            } else if (order.scheduledTime) {
                // Check if it looks like an ISO string or Date string
                if (order.scheduledTime.includes('T') || order.scheduledTime.includes('-')) {
                    const d = parseISO(order.scheduledTime);
                    if (!isNaN(d.getTime())) {
                        hour = getHours(d);
                    }
                } else {
                    // Try "HH:mm" format, handle "9:00", "09:00", "9:00:00"
                    // Remove any surrounding whitespace
                    const timeStr = order.scheduledTime.trim();
                    const parts = timeStr.split(':');
                    if (parts.length >= 1) {
                        const h = parseInt(parts[0], 10);
                        if (!isNaN(h)) hour = h;
                    }
                }
            }

            if (hour >= 8 && hour <= 19) {
                const current = map.get(hour)!;
                map.set(hour, {
                    count: current.count + 1,
                    hours: current.hours + getOrderDuration(order)
                });
            }
        });

        return Array.from(map.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([hour, val]) => ({
                hour: `${hour}:00`,
                count: val.count,
                hours: parseFloat(val.hours.toFixed(1))
            }));
    }, [filteredData.orders]);

    // Aggregation: Daily Trend
    const dailyTrendData = useMemo(() => {
        // Initialize all days in month
        const daysInMonth = new Date(filteredData.end).getDate(); // Last day number
        const map = new Map<number, { count: number; hours: number; actualHours: number; dateStr: string }>();

        for (let i = 1; i <= daysInMonth; i++) {
            map.set(i, { count: 0, hours: 0, actualHours: 0, dateStr: `${i}` });
        }

        filteredData.orders.forEach(order => {
            if (order.scheduledDate) {
                const date = new Date(order.scheduledDate);
                const day = getDate(date);
                if (map.has(day)) {
                    const current = map.get(day)!;

                    // Scheduled/Estimated Hours
                    const estimated = (order.estimatedDuration || 60) / 60; // Hours

                    // Actual Hours
                    let actual = 0;

                    // 0. Pre-computed workDuration from Firestore
                    if (typeof order.workDuration === 'number' && order.workDuration > 0) {
                        actual = order.workDuration / 60;
                    } else if (typeof (order as any).actualDuration === 'number' && (order as any).actualDuration > 0) {
                        actual = (order as any).actualDuration / 60;
                    }

                    // 1. Try raw data column if workDuration not set
                    if (actual === 0 && order.raw) {
                        const rawDuration = findKey(order.raw, ['作業所要時間', '作業時間', '作業時間（分）', '作業時間(分)', 'workTime', 'actualDuration', '実稼働時間', '所要時間']);
                        if (rawDuration) {
                            const valStr = String(rawDuration);
                            if (valStr.includes(':') && !valStr.includes('1899')) {
                                const parts = valStr.split(':');
                                if (parts.length >= 2) {
                                    const h = parseInt(parts[0], 10);
                                    const m = parseInt(parts[1], 10);
                                    if (!isNaN(h) && !isNaN(m)) {
                                        actual = h + (m / 60);
                                    }
                                }
                            } else if (valStr.includes('1899')) {
                                const date = new Date(valStr);
                                if (!isNaN(date.getTime())) {
                                    actual = (date.getHours() * 60 + date.getMinutes()) / 60;
                                }
                            } else {
                                const parsed = parseFloat(valStr);
                                if (!isNaN(parsed) && parsed > 0) {
                                    actual = parsed / 60;
                                }
                            }
                        }
                    }

                    // 2. Fallback to timestamps
                    if (actual === 0 && (order.actualStartTime || order.arrivalTimestamp) && order.actualEndTime) {
                        const computedMin = calculateWorkDurationMinutes(order.actualStartTime, order.arrivalTimestamp, order.actualEndTime);
                        if (computedMin && computedMin > 0) {
                            actual = computedMin / 60;
                        }
                    }

                    map.set(day, {
                        ...current,
                        count: current.count + 1,
                        hours: current.hours + estimated,
                        actualHours: current.actualHours + actual
                    });
                }
            }
        });

        return Array.from(map.values()).map(d => ({
            date: d.dateStr,
            day: parseInt(d.dateStr), // For sorting/brush
            count: d.count,
            hours: parseFloat(d.hours.toFixed(2)),
            actualHours: parseFloat(d.actualHours.toFixed(2))
        }));
    }, [filteredData]);


    const handleExportExcel = () => {
        const title = `${format(filteredData.start, 'yyyy年MM月')}活動レポート`;

        // 1. Overview Sheet
        const overviewSheet = [
            { '項目': '集計期間', '値': `${format(filteredData.start, 'yyyy/MM/dd')} 〜 ${format(filteredData.end, 'yyyy/MM/dd')}` },
            { '項目': '総作業件数', '値': filteredData.orders.length },
            { '項目': '総稼働予定時間 (h)', '値': (filteredData.orders.reduce((acc, o) => acc + (o.estimatedDuration || 60), 0) / 60).toFixed(1) },
            { '項目': '稼働スタッフ数', '値': staffWorkloadData.length }
        ];

        // 2. Staff Workload Sheet
        const staffSheet = staffWorkloadData.map(d => ({
            'スタッフ名': d.name,
            '担当件数': d.tasks,
            '予定総時間(h)': parseFloat(d.hours.toFixed(1)),
            '実績総時間(h)': parseFloat((d.actualHours || 0).toFixed(1)),
            '乖離(h)': parseFloat(((d.actualHours || 0) - d.hours).toFixed(1))
        }));

        // 3. Daily Trend Sheet
        const trendSheet = dailyTrendData.map(d => ({
            '日付': `${format(filteredData.start, 'yyyy/MM')}/${d.date}`,
            '受注件数': d.count,
            '予定稼働時間(h)': d.hours,
            '実作業時間(h)': d.actualHours
        }));

        // 4. Shop Distribution Sheet
        const shopSheet = shopDistributionData.map(d => ({
            '拠点（母店）': d.name,
            '作業件数': d.value,
            'シェア(%)': ((d.value / filteredData.orders.length) * 100).toFixed(1) + '%'
        }));

        // 5. Main Store Share Sheet
        const mainStoreSheet = mainStoreShareData.map(d => ({
            '担当店舗': d.name,
            '作業件数': d.value,
            'シェア(%)': ((d.value / filteredData.orders.length) * 100).toFixed(1) + '%'
        }));

        // 6. Day of Week Sheet
        const dowSheet = dayOfWeekData.map(d => ({
            '曜日': d.day,
            '件数': d.count
        }));

        // 7. Time of Day Sheet
        const timeSheet = timeOfDayData.map(d => ({
            '時間帯': d.hour,
            '件数': d.count
        }));

        // 8. Travel Time (Logic replicated from StaffTravelTimeChart)
        const travelMap = new Map<string, { totalMinutes: number; count: number }>();
        filteredData.orders.forEach(order => {
            if (!order.startTravelTime || !order.arrivalTimestamp) return;
            const start = typeof order.startTravelTime === 'string' ? parseISO(order.startTravelTime) : order.startTravelTime;
            const end = typeof order.arrivalTimestamp === 'string' ? parseISO(order.arrivalTimestamp) : order.arrivalTimestamp;
            if (!(start instanceof Date) || isNaN(start.getTime())) return;
            if (!(end instanceof Date) || isNaN(end.getTime())) return;
            let duration = (end.getTime() - start.getTime()) / (1000 * 60);
            if (duration <= 0 || duration > 300) return;
            // Staff name key
            const key = order.staffName || '未割当';
            const current = travelMap.get(key) || { totalMinutes: 0, count: 0 };
            travelMap.set(key, { totalMinutes: current.totalMinutes + duration, count: current.count + 1 });
        });
        const travelSheet = Array.from(travelMap.entries()).map(([name, val]) => ({
            'スタッフ名': name,
            '総移動時間(h)': (val.totalMinutes / 60).toFixed(1),
            '平均移動時間(分)': Math.round(val.totalMinutes / val.count),
            '回数': val.count
        })).sort((a, b) => parseFloat(b['総移動時間(h)']) - parseFloat(a['総移動時間(h)']));


        // 9. Tire Size (Logic replicated from TireSizeAnalysisChart)
        const tireMap = new Map<string, { totalMinutes: number; count: number }>();
        filteredData.orders.forEach(order => {
            let duration = 0;
            // Priority 0: workDuration
            if (typeof order.workDuration === 'number' && order.workDuration > 0) {
                duration = order.workDuration;
            } else if (typeof (order as any).actualDuration === 'number' && (order as any).actualDuration > 0) {
                duration = (order as any).actualDuration;
            }
            // Priority 1: Timestamps
            if (duration === 0 && (order.actualStartTime || order.arrivalTimestamp) && order.actualEndTime) {
                const computedMin = calculateWorkDurationMinutes(order.actualStartTime, order.arrivalTimestamp, order.actualEndTime);
                if (computedMin && computedMin > 0 && computedMin <= 600) {
                    duration = computedMin;
                }
            }
            // Priority 2: Fallback Logic
            if (duration === 0 && order.actualStartTime && order.actualEndTime) {
                const start = typeof order.actualStartTime === 'string' ? parseISO(order.actualStartTime) : order.actualStartTime;
                const end = typeof order.actualEndTime === 'string' ? parseISO(order.actualEndTime) : order.actualEndTime;
                if ((start instanceof Date) && !isNaN(start.getTime()) && (end instanceof Date) && !isNaN(end.getTime())) {
                    const diff = (end.getTime() - start.getTime()) / (1000 * 60);
                    if (diff > 0 && diff <= 600) duration = diff;
                }
            }
            // Priority 3: Raw column
            if (duration === 0 && order.raw) {
                const keys = ['作業時間（分）', '作業時間(分)', '作業時間', 'workTime', '作業所要時間', '所要時間'];
                let val: any;
                for (const k of keys) { if (order.raw[k]) { val = order.raw[k]; break; } }
                if (val) {
                    if (typeof val === 'string' && (val.includes('T') || val.includes('1899-'))) {
                        const d = parseISO(val);
                        if (!isNaN(d.getTime())) duration = d.getHours() * 60 + d.getMinutes();
                    } else {
                        const p = parseInt(String(val), 10);
                        if (!isNaN(p) && p > 0 && p !== 1899) duration = p;
                    }
                }
            }

            // If 0 or negative, skip this order for average calculation
            if (duration <= 0) return;

            // Extract Inch
            const tireSize = order.tireSize || '';
            let inch = '';
            const rMatch = tireSize.toUpperCase().match(/[Z]?R(\d{2})/);
            if (rMatch) inch = rMatch[1];
            if (!inch) {
                const inchMatch = tireSize.match(/(\d{2})\s*(inch|インチ|in)/i);
                if (inchMatch) inch = inchMatch[1];
            }
            if (!inch) {
                const simpleMatch = tireSize.trim().match(/^(\d{2})$/);
                if (simpleMatch) inch = simpleMatch[1];
            }
            if (!inch) return;

            const current = tireMap.get(inch) || { totalMinutes: 0, count: 0 };
            tireMap.set(inch, { totalMinutes: current.totalMinutes + duration, count: current.count + 1 });
        });
        const tireSheet = Array.from(tireMap.entries()).map(([inch, val]) => ({
            'インチ': inch,
            '平均作業時間(分)': Math.round(val.totalMinutes / val.count),
            'サンプル数': val.count
        })).sort((a, b) => parseInt(a['インチ']) - parseInt(b['インチ']));


        exportToExcel([
            { name: '概要', data: overviewSheet },
            { name: '日別推移', data: trendSheet },
            { name: 'スタッフ稼働', data: staffSheet },
            { name: '母店別シェア', data: shopSheet },
            { name: '主管店舗別シェア', data: mainStoreSheet },
            { name: '曜日別', data: dowSheet },
            { name: '時間帯別', data: timeSheet },
            { name: '移動時間', data: travelSheet },
            { name: 'タイヤサイズ別', data: tireSheet }
        ], title);
    };

    const handleExportPDF = async () => {
        const title = `${format(filteredData.start, 'yyyy年MM月')} 活動レポート`;
        const chartIds = [
            'chart-daily-trend',         // Row 1: Full
            'chart-workload',            // Row 2: Full
            ['chart-shop-dist', 'chart-main-store'], // Row 3: Grid
            ['chart-day-week', 'chart-time-day'],    // Row 4: Grid
            ['chart-travel', 'chart-tire-size']      // Row 5: Grid
        ];

        await exportDashboardToPDF(title, chartIds, title);
    };

    if (isOrdersLoading || isStaffLoading || isProfileLoading) {
        return <div className="p-8 text-center">データを読み込んでいます...</div>;
    }

    if (!profile || profile.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <p className="text-lg font-semibold mb-2">アクセス権限がありません</p>
                <p>このページを表示するには管理者権限が必要です。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">分析ダッシュボード</h2>
                    <p className="text-muted-foreground">{format(filteredData.start, 'yyyy年MM月dd日')} - {format(filteredData.end, 'yyyy年MM月dd日')} の活動状況</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="スタッフを選択" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全スタッフ</SelectItem>
                            {allStaff.map(staff => (
                                <SelectItem key={staff.id} value={staff.id}>
                                    {staff.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="期間を選択" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="this-month">今月</SelectItem>
                            <SelectItem value="last-month">先月</SelectItem>
                            <SelectItem value="all-time">全期間</SelectItem>
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

            {isFetchingHistory && (
                <div className="bg-muted p-2 rounded-md text-sm text-center animate-pulse">
                    過去のデータをロードしています... しばらくお待ちください。
                </div>
            )}

            <div className="space-y-6">
                {/* Full Width Charts */}
                <div id="chart-daily-trend">
                    <DailyTrendChart data={dailyTrendData} />
                </div>
                <div id="chart-workload">
                    <StaffWorkloadChart data={staffWorkloadData} />
                </div>

                {/* 2-Column Grid Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div id="chart-shop-dist"><ShopDistributionChart data={shopDistributionData} /></div>
                    <div id="chart-main-store"><MainStoreShareChart data={mainStoreShareData} /></div>

                    <div id="chart-day-week"><DayOfWeekChart data={dayOfWeekData} /></div>
                    <div id="chart-time-day"><TimeOfDayChart data={timeOfDayData} /></div>

                    <div id="chart-travel"><StaffTravelTimeChart orders={filteredData.orders} allStaff={allStaff} /></div>
                    <div id="chart-tire-size"><TireSizeAnalysisChart orders={filteredData.orders} /></div>
                </div>
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
