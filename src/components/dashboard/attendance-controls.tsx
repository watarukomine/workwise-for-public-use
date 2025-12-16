'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { useUserProfile } from '../../hooks/use-user-profile';
import {
    getDailyAttendanceDetails,
    updateStaffStatus
} from '../../services/attendance-service';
import { Loader2, LogIn, LogOut } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { Card, CardContent } from '../../components/ui/card';
import { format } from 'date-fns';

interface AttendanceControlsProps {
    onStatusChange?: () => void;
    variant?: 'default' | 'compact';
}

export function AttendanceControls({ onStatusChange, variant = 'default' }: AttendanceControlsProps) {
    const { profile } = useUserProfile();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState<'present' | 'checked_out' | 'absent' | 'unknown'>('unknown');
    const [isUpdating, setIsUpdating] = useState(false);

    // Only for logged-in staff (not admin viewing others, though admin could see this for themselves)
    // If admin wants to manage OTHERS, that's a different component.
    // This is for "My Attendance".

    useEffect(() => {
        if (!profile) return;
        checkStatus();
    }, [profile]);

    const checkStatus = async () => {
        if (!profile) return;
        setIsLoading(true);
        try {
            const today = new Date();
            const { staffIds, checkedOutIds } = await getDailyAttendanceDetails(today);

            if (checkedOutIds.includes(profile.id)) {
                setStatus('checked_out');
            } else if (staffIds.includes(profile.id)) {
                setStatus('present');
            } else {
                setStatus('absent');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClockIn = async () => {
        if (!profile) return;
        setIsUpdating(true);
        try {
            await updateStaffStatus(new Date(), profile.id, 'present');
            setStatus('present');
            toast({ title: '出勤しました', description: 'ダッシュボードに表示されます。' });
            onStatusChange?.();
        } catch (e) {
            toast({ variant: 'destructive', title: 'エラー', description: '出勤処理に失敗しました。' });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleClockOut = async () => {
        if (!profile) return;
        setIsUpdating(true);
        try {
            await updateStaffStatus(new Date(), profile.id, 'checked_out');
            setStatus('checked_out');
            toast({ title: '退勤しました', description: 'お疲れ様でした。' });
            onStatusChange?.();
        } catch (e) {
            toast({ variant: 'destructive', title: 'エラー', description: '退勤処理に失敗しました。' });
        } finally {
            setIsUpdating(false);
        }
    };

    if (!profile) return null;

    if (isLoading) {
        return <div className="flex items-center gap-2 p-2"><Loader2 className="h-4 w-4 animate-spin" /> </div>;
    }

    if (variant === 'compact') {
        // Compact mode: Icon-only buttons with status indicator dot
        return (
            <div className="flex items-center gap-2">
                {/* Status Indicator */}
                <div
                    className={`w-2 h-2 rounded-full shrink-0 ${status === 'present' ? 'bg-green-600' :
                            status === 'checked_out' ? 'bg-gray-400' : 'bg-orange-500'
                        }`}
                    title={status === 'present' ? '出勤中' : status === 'checked_out' ? '退勤済' : '未出勤'}
                />

                {status !== 'present' && status !== 'checked_out' && (
                    <Button onClick={handleClockIn} disabled={isUpdating} size="icon" className="bg-green-600 hover:bg-green-700 h-8 w-8 rounded-full shadow-sm">
                        <LogIn className="h-4 w-4" />
                    </Button>
                )}
                {status === 'present' && (
                    <Button onClick={handleClockOut} disabled={isUpdating} variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm">
                        <LogOut className="h-4 w-4" />
                    </Button>
                )}
                {status === 'checked_out' && (
                    <Button onClick={handleClockIn} disabled={isUpdating} variant="outline" size="icon" className="h-8 w-8 rounded-full shadow-sm">
                        <LogIn className="h-4 w-4" />
                    </Button>
                )}
            </div>
        );
    }

    return (
        <Card className="mb-4">
            <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-muted-foreground">{format(new Date(), 'M月d日')}のステータス</span>
                    <span className={`text-lg font-bold ${status === 'present' ? 'text-green-600' :
                        status === 'checked_out' ? 'text-gray-500' : 'text-orange-500'
                        }`}>
                        {status === 'present' ? '出勤中' :
                            status === 'checked_out' ? '退勤済' : '未出勤'}
                    </span>
                </div>

                <div className="flex gap-2">
                    {status !== 'present' && status !== 'checked_out' && (
                        <Button onClick={handleClockIn} disabled={isUpdating} className="bg-green-600 hover:bg-green-700">
                            <LogIn className="mr-2 h-4 w-4" />
                            出勤
                        </Button>
                    )}
                    {status === 'present' && (
                        <Button onClick={handleClockOut} disabled={isUpdating} variant="secondary">
                            <LogOut className="mr-2 h-4 w-4" />
                            退勤
                        </Button>
                    )}
                    {/* Allow re-clock in if checked out? Yes, usually needed. */}
                    {status === 'checked_out' && (
                        <Button onClick={handleClockIn} disabled={isUpdating} variant="outline" size="sm">
                            再出勤
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
