'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, MapPin, AlertCircle, Loader2, PlayCircle, LogIn, LogOut, CheckCircle, MessageSquare, Send, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useUserProfile } from '@/hooks/use-user-profile';
import { updateSheetStatus } from '@/app/actions/gas-actions';
import { ORDER_GAS_URL, STATUS_COLUMN_NAME } from '@/lib/settings';
import type { StaffStatus } from '@/lib/types';
import { updateStaffStatus } from '@/services/attendance-service';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { useOrder } from '@/contexts/order-context';

type ActionType = 'Clock In' | 'Clock Out' | 'Start Travel' | 'Arrive' | 'Begin Task' | 'Finish Task' | 'Wait' | 'Emergency';
type StatusValue = StaffStatus['status'];

function CheckInClient() {
  const [isLoading, setIsLoading] = React.useState<ActionType | null>(null);
  const [location, setLocation] = React.useState<{ latitude: number, longitude: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastAction, setLastAction] = React.useState<{ action: ActionType, time: string } | null>(null);
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { refetchOrders, orders } = useOrder();
  const [manualTime, setManualTime] = React.useState('');

  const handleAction = async (action: ActionType | 'Emergency') => {
    setIsLoading(action);
    setError(null);
    let actionDate = new Date();

    // In Correction Mode, if manualTime is set, use it
    if (isCorrectionMode && manualTime) {
      const [hours, minutes] = manualTime.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        actionDate.setHours(hours, minutes, 0, 0);
        // Safety check: if manual time is in future? User might want to correct to future? Allow it.
      }
    }

    const now = actionDate;

    // Check geolocation ONLY if NOT in correction mode (unless Emergency)
    // If correction mode is ON, bypass geolocation check if user wants (implicit request for "can't press button")
    // But let's keep it safe: if Correction Mode, we bypass geolocation check.
    const bypassGeolocation = isCorrectionMode;

    if (action === 'Clock In' || action === 'Clock Out') {
      try {
        if (!profile?.id) {
          throw new Error("ユーザー情報を取得できませんでした。");
        }
        const status = action === 'Clock In' ? 'present' : 'checked_out';

        await updateStaffStatus(now, profile.id, status);

        const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        setLastAction({ action, time: currentTime });
        toast({
          title: isCorrectionMode ? `${action === 'Clock In' ? '出勤' : '退勤'}時間を修正しました` : (action === 'Clock In' ? '出勤しました' : '退勤しました'),
          description: `${currentTime}に記録しました。`,
        });
      } catch (e: any) {
        console.error("Clock In/Out failed:", e);
        toast({
          variant: 'destructive',
          title: 'エラー',
          description: `記録に失敗しました: ${e.message}`
        });
      } finally {
        setIsLoading(null);
      }
      return;
    }

    const statusMap: Partial<Record<string, string>> = {
      'Start Travel': '移動中',
      'Begin Task': '作業中',
      'Finish Task': '作業完了',
      'Wait': '待機中',
      'Arrive': '作業待ち',
      'Emergency': '緊急',
    };

    const statusValue = statusMap[action];

    if (!statusValue) {
      console.error("No status defined for this action:", action);
      setIsLoading(null);
      return;
    }

    const executeUpdate = async (latitude: number | null, longitude: number | null) => {
      if (!profile?.name) {
        setError('ユーザー情報が取得できません。ログインしているか確認してください。');
        return;
      }

      try {
        const eventTitleForUpdate = `(ID: ${orderId || 'N/A'})`;

        const result = await updateSheetStatus({
          gasUrl: ORDER_GAS_URL,
          eventTitle: eventTitleForUpdate,
          staffName: profile.name,
          statusValue: statusValue,
          timestamp: new Date().toISOString(), // Log timestamp is ALWAYS "real now"
          latitude: latitude,
          longitude: longitude,
          actionType: action as any,
          actionTimestamp: now.toISOString(), // Action Timestamp is the corrected time
          comment: action === 'Emergency' ? `【緊急】${emergencyMessage}` : (isCorrectionMode ? '【修正】' : '')
        });

        if (result.status === 'error') {
          throw new Error(result.message);
        }

        await refetchOrders();

        toast({
          title: action === 'Emergency' ? '緊急連絡を送信しました' : (isCorrectionMode ? 'ステータス時間を修正しました' : 'ステータスを更新しました'),
          description: result.message,
          variant: action === 'Emergency' ? 'destructive' : 'default',
        });

        const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        setLastAction({ action: action, time: currentTime });

        if (action === 'Emergency') setEmergencyMessage('');

        // Turn off correction mode
        if (isCorrectionMode) {
          setIsCorrectionMode(false);
          setManualTime('');
        }

      } catch (e: any) {
        const errorMessage = e.message || 'スプレッドシートの更新に失敗しました。';
        // ... existing error handling ...
        setError(errorMessage);
        toast({
          variant: 'destructive',
          title: '更新エラー',
          description: errorMessage
        });
      }
    };

    if (!bypassGeolocation && navigator.geolocation) {
      // Normal flow
      navigator.geolocation.getCurrentPosition(
        (pos) => executeUpdate(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          // ... existing error handling ...
          setError('位置情報の取得に失敗しました。修正モードを試してください。');
          setIsLoading(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      // Bypass flow (Correction Mode or No Geo)
      await executeUpdate(null, null);
      setIsLoading(null);
    }
  };

  // ... (keep isButtonDisabled)

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            {/* ... existing header ... */}
            <div>
              <CardTitle>作業記録</CardTitle>
              <CardDescription>現在地情報と共に、作業状況を記録します。対象のオーダーID: {orderId || '未選択'}</CardDescription>
              {orderId && <div className="text-sm font-medium mt-1 text-slate-600">現在のステータス: <span className="text-blue-600">{currentStatus}</span></div>}
            </div>
            <Button
              variant={isCorrectionMode ? "destructive" : "outline"}
              size="sm"
              onClick={() => setIsCorrectionMode(!isCorrectionMode)}
            >
              {isCorrectionMode ? "修正モードON" : "修正"}
            </Button>
          </div>

          {/* Manual Time Input for Correction Mode */}
          {isCorrectionMode && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
              <label className="text-xs font-semibold text-red-700 mb-1 block">指定時間に修正 (未入力なら現在時刻)</label>
              <input
                type="time"
                className="w-full text-lg p-2 border rounded"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
              />
              <p className="text-xs text-red-600 mt-2">
                ※ 位置情報のチェックがスキップされます。
                <br />
                ※ ボタンを押すと、この時間で記録されます。
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {actionButtons.map(({ action, label, icon: Icon }) => (
              <Button
                key={action}
                size="lg"
                className={cn(
                  "h-20 text-base flex-col",
                  action === 'Wait' && "col-span-2",
                  isCorrectionMode && "ring-2 ring-red-400 border-red-400 bg-red-50 text-red-900 hover:bg-red-100"
                )}
                onClick={() => handleAction(action)}
                disabled={!!isLoading || isButtonDisabled(action)}
              >
                {isLoading === action ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Icon className="h-6 w-6 mb-1" />
                    {label}
                  </>
                )}
              </Button>
            ))}
          </div>

          {/* Emergency Contact Section */}
          {orderId && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold mb-2 text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                緊急連絡
              </h3>
              <Textarea
                placeholder="事故・遅延・トラブルなど、緊急時の連絡事項を入力してください。"
                className="mb-2"
                value={emergencyMessage}
                onChange={(e) => setEmergencyMessage(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-red-400 hover:bg-red-500 text-white"
                  onClick={() => handleAction('Emergency')}
                  disabled={!!isLoading || !emergencyMessage}
                >
                  <Send className="mr-2 h-4 w-4" />
                  緊急連絡を送信
                </Button>
                <Button
                  variant="outline"
                  className="flex-none px-4 text-muted-foreground border-dashed"
                  onClick={async () => {
                    if (!profile) return;
                    setIsLoading('Emergency');
                    try {
                      const eventTitleForUpdate = `(ID: ${orderId || 'N/A'})`;
                      const now = new Date();

                      let recoveryStatus = '未着手';
                      if (currentOrder) {
                        if (currentOrder.actualEndTime) {
                          recoveryStatus = '待機中'; // Finished -> Waiting
                        } else if (currentOrder.actualStartTime) {
                          recoveryStatus = '作業中'; // Started -> Working
                        } else if (currentOrder.arrivalTimestamp) {
                          recoveryStatus = '作業待ち'; // Arrived -> Waiting for Work
                        } else if (currentOrder.startTravelTime) {
                          recoveryStatus = '移動中'; // Started Travel -> Moving
                        }
                      }

                      await updateSheetStatus({
                        gasUrl: ORDER_GAS_URL,
                        eventTitle: eventTitleForUpdate,
                        staffName: profile.name,
                        statusValue: recoveryStatus,
                        timestamp: now.toISOString(),
                        actionType: null,
                        comment: '' // Clear comment
                      });
                      toast({ title: '緊急連絡を解除しました', description: `ステータスを「${recoveryStatus}」に戻しました。` });
                      setEmergencyMessage('');
                    } catch (error) {
                      console.error("Failed to clear emergency:", error);
                      toast({ variant: "destructive", title: "解除に失敗しました" });
                    } finally {
                      setIsLoading(null);
                    }
                  }}
                  disabled={!!isLoading}
                >
                  解除
                </Button>
              </div>
            </div>
          )}

          {/* ... existing alerts ... */}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!orderId && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>オーダーが選択されていません</AlertTitle>
              <AlertDescription>
                勤怠以外の記録を行うには、スケジュール画面からタスクを選択してください。
              </AlertDescription>
            </Alert>
          )}

          {lastAction && (
            <Alert>
              <MapPin className="h-4 w-4" />
              <AlertTitle>最後の記録</AlertTitle>
              <AlertDescription>
                {getJapaneseActionName(lastAction.action)} @ {lastAction.time}
                {location && !['Clock In', 'Clock Out'].includes(lastAction.action) && <span className="text-xs block mt-1">({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})</span>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <CheckInClient />
    </Suspense>
  )
}
