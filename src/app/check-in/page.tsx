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
  const [isCorrectionMode, setIsCorrectionMode] = React.useState(false);

  const currentOrder = React.useMemo(() => {
    if (!orderId) return null;
    return orders.find(o => o.rawOrderId === orderId || o.id === orderId);
  }, [orders, orderId]);

  const currentStatus = currentOrder?.status || '未着手';

  const [emergencyMessage, setEmergencyMessage] = React.useState('');

  const getJapaneseActionName = (action: ActionType | 'Emergency') => {
    const map: Record<string, string> = {
      'Start Travel': '移動開始',
      'Arrive': '現場到着',
      'Begin Task': '作業開始',
      'Finish Task': '作業完了',
      'Wait': '位置情報更新',
      'Emergency': '緊急連絡',
    };
    return map[action] || action;
  };

  const handleEmergency = async () => {
    if (!emergencyMessage.trim()) {
      setError('緊急連絡の内容を入力してください。');
      return;
    }

    // Use 'Wait' action type as base, but carry the message? 
    // Or we define a new action 'Emergency'
    await handleAction('Emergency');
  };

  const handleAction = async (action: ActionType | 'Emergency') => {
    setIsLoading(action);
    setError(null);
    const now = new Date();

    // Removed Clock In/Out logical block here -> Restoring it
    if (action === 'Clock In' || action === 'Clock Out') {
      try {
        if (!profile?.id) {
          throw new Error("ユーザー情報を取得できませんでした。");
        }
        const status = action === 'Clock In' ? 'present' : 'checked_out'; // Using 'checked_out' (退勤) and 'present' (出勤) logic for Firestore
        // Note: Dashboard uses 'present' / 'checked_out' / 'break' ?
        // Referencing check-in-client.tsx (previous view):
        // const status = action === 'Clock In' ? 'present' : 'checked_out';

        await updateStaffStatus(now, profile.id, status);

        const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        setLastAction({ action, time: currentTime });
        toast({
          title: action === 'Clock In' ? '出勤しました' : '退勤しました',
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
      'Emergency': '緊急', // New Status?
    };

    const statusValue = statusMap[action];

    if (!statusValue) {
      console.error("No status defined for this action:", action);
      setIsLoading(null);
      return;
    }

    if (!navigator.geolocation) {
      setError('お使いのブラウザは位置情報取得に対応していません。');
      setIsLoading(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });

        console.log(`Action: ${action}`, { latitude, longitude });

        if (!profile?.name) {
          setError('ユーザー情報が取得できません。ログインしているか確認してください。');
          setIsLoading(null);
          return;
        }

        try {
          const eventTitleForUpdate = `(ID: ${orderId || 'N/A'})`;

          const result = await updateSheetStatus({
            gasUrl: ORDER_GAS_URL,
            eventTitle: eventTitleForUpdate,
            staffName: profile.name,
            statusValue: statusValue,
            timestamp: now.toISOString(),
            latitude: latitude,
            longitude: longitude,
            actionType: action as any,
            actionTimestamp: now.toISOString(),
            comment: action === 'Emergency' ? `【緊急】${emergencyMessage}` : ''
          });

          if (result.status === 'error') {
            throw new Error(result.message);
          }

          await refetchOrders();

          toast({
            title: action === 'Emergency' ? '緊急連絡を送信しました' : 'ステータスを更新しました',
            description: result.message,
            variant: action === 'Emergency' ? 'destructive' : 'default',
          });

          const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          setLastAction({ action: action, time: currentTime });

          if (action === 'Emergency') setEmergencyMessage('');

          // Turn off correction mode after successful action
          if (isCorrectionMode) setIsCorrectionMode(false);

        } catch (e: any) {
          // Check for "Server Action not found" which happens when deployment changes
          const errorMessage = e.message || 'スプレッドシートの更新に失敗しました。';

          if (errorMessage.includes('not found') || errorMessage.includes('Server Action')) {
            setError('システムの更新が必要です。ページを再読み込みしてください。');
            toast({
              variant: 'destructive',
              title: '更新エラー',
              description: 'システムのバージョンが古くなっています。ページを更新して再試行してください。'
            });
          } else {
            setError(errorMessage);
            toast({
              variant: 'destructive',
              title: '更新エラー',
              description: errorMessage
            });
          }
        }

        setIsLoading(null);
      },
      (err) => {
        let message = '';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = '位置情報の利用がブロックされています。iPhoneの設定 > プライバシーとセキュリティ > 位置情報サービス > SafariのWebサイト から、このサイトの権限を「使用中のみ許可」に変更してください。';
            break;
          case err.POSITION_UNAVAILABLE:
            message = '現在地の取得に失敗しました。';
            break;
          case err.TIMEOUT:
            message = '位置情報の取得がタイムアウトしました。';
            break;
          default:
            message = '不明なエラーが発生しました。';
            break;
        }
        setError(message);
        setIsLoading(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const isButtonDisabled = (action: ActionType | 'Emergency') => {
    if ((action as string) === 'Emergency') return !!isLoading; // Always allow if not already loading
    if (['Clock In', 'Clock Out', 'Wait'].includes(action)) return false;
    if (!orderId) return true;
    if (isCorrectionMode) return false;

    // Sequential logic
    switch (action) {
      case 'Start Travel':
        return !['未着手', '待機中', ''].includes(currentStatus);
      case 'Arrive':
        return currentStatus !== '移動中';
      case 'Begin Task':
        return currentStatus !== '作業待ち';
      case 'Finish Task':
        return currentStatus !== '作業中';
      default:
        return false;
    }
  };

  const actionButtons: { action: ActionType; label: string; icon: React.ElementType }[] = [
    { action: 'Clock In', label: '出勤', icon: LogIn },
    { action: 'Start Travel', label: '移動開始', icon: PlayCircle },
    { action: 'Arrive', label: '現場到着', icon: MapPin },
    { action: 'Begin Task', label: '作業開始', icon: Clock },
    { action: 'Finish Task', label: '作業完了', icon: CheckCircle },
    { action: 'Clock Out', label: '退勤', icon: LogOut },
    { action: 'Wait', label: '位置情報更新', icon: RefreshCw },
  ];

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
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
