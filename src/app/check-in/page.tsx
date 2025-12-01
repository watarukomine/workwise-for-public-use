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
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';

type ActionType = 'Clock In' | 'Clock Out' | 'Start Travel' | 'Arrive' | 'Begin Task' | 'Finish Task' | 'Wait' | 'Send Message';
type StatusValue = StaffStatus['status'];

function CheckInClient() {
  const [isLoading, setIsLoading] = React.useState<ActionType | null>(null);
  const [location, setLocation] = React.useState<{ latitude: number, longitude: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastAction, setLastAction] = React.useState<{ action: ActionType, time: string } | null>(null);
  const [message, setMessage] = React.useState('');
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');


  const getJapaneseActionName = (action: ActionType) => {
    const map: Record<ActionType, string> = {
        'Clock In': '出勤',
        'Clock Out': '退勤',
        'Start Travel': '移動開始',
        'Arrive': '現場到着',
        'Begin Task': '作業開始',
        'Finish Task': '作業完了',
        'Wait': '位置情報更新',
        'Send Message': 'メッセージ送信'
    };
    return map[action];
  };

  const handleAction = async (action: ActionType) => {
    setIsLoading(action);
    setError(null);
    const now = new Date();
    
    // Actions that don't require location or sheet updates
    if (action === 'Clock In' || action === 'Clock Out') {
        console.log(`Action: ${action}`);
        setTimeout(() => {
          const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          setLastAction({ action, time: currentTime });
          toast({
            title: 'アクションを記録しました',
            description: `${getJapaneseActionName(action)} at ${currentTime}`,
          });
          setIsLoading(null);
        }, 1000);
        return;
    }
    
    if (action === 'Send Message') {
        if (!message.trim()) {
            setError('メッセージを入力してください。');
            setIsLoading(null);
            return;
        }
        console.log(`Message to admin: ${message}`);
        setTimeout(() => {
          toast({
            title: 'メッセージを送信しました',
            description: '管理者にメッセージが送信されました。',
          });
          const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          setLastAction({ action: 'Send Message', time: currentTime });
          setMessage('');
          setIsLoading(null);
        }, 1000);
        return;
    }

    // Map actions to their corresponding status values for the sheet update
    const statusMap: Partial<Record<ActionType, StatusValue>> = {
      'Start Travel': '移動中',
      'Begin Task': '作業中',
      'Finish Task': '作業完了',
      'Wait': '待機中',
      'Arrive': '作業待ち',
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
                actionType: action,
                actionTimestamp: now.toISOString()
            });

            if (result.status === 'error') {
                throw new Error(result.message);
            }

            toast({
                title: 'ステータスを更新しました',
                description: result.message,
            });

            const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            setLastAction({ action, time: currentTime });

        } catch (e: any) {
            setError(e.message || 'スプレッドシートの更新に失敗しました。');
            toast({
                variant: 'destructive',
                title: '更新エラー',
                description: e.message || 'スプレッドシートの更新に失敗しました。'
            });
        }
        
        setIsLoading(null);
      },
      (err) => {
        let message = '';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = '位置情報の利用が許可されていません。ブラウザの設定を確認してください。';
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
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const actionButtons: { action: ActionType; label: string; icon: React.ElementType }[] = [
    { action: 'Clock In', label: '出勤', icon: LogIn },
    { action: 'Clock Out', label: '退勤', icon: LogOut },
    { action: 'Start Travel', label: '移動開始', icon: PlayCircle },
    { action: 'Arrive', label: '現場到着', icon: MapPin },
    { action: 'Begin Task', label: '作業開始', icon: Clock },
    { action: 'Finish Task', label: '作業完了', icon: CheckCircle },
    { action: 'Wait', label: '位置情報更新', icon: RefreshCw },
  ];

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>勤怠・作業記録</CardTitle>
          <CardDescription>現在地情報と共に、作業状況を記録します。対象のオーダーID: {orderId || '未選択'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {actionButtons.map(({ action, label, icon: Icon }) => (
              <Button
                key={action}
                size="lg"
                className={cn(
                  "h-20 text-base flex-col",
                  action === 'Wait' && "col-span-2"
                )}
                onClick={() => handleAction(action)}
                disabled={!!isLoading || (!orderId && !['Clock In', 'Clock Out', 'Send Message', 'Wait'].includes(action))}
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
                {location && !['Clock In', 'Clock Out', 'Send Message'].includes(lastAction.action) && <span className="text-xs block mt-1">({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})</span>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            管理者へ連絡
          </CardTitle>
          <CardDescription>緊急の連絡や報告がある場合に使用してください。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="メッセージを入力..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isLoading === 'Send Message'}
          />
          <Button
            className="w-full"
            onClick={() => handleAction('Send Message')}
            disabled={!!isLoading}
          >
            {isLoading === 'Send Message' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            メッセージ送信
          </Button>
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
