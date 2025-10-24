'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, MapPin, AlertCircle, Loader2, PlayCircle, LogIn, LogOut, CheckCircle, MessageSquare, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

type ActionType = 'Clock In' | 'Clock Out' | 'Start Travel' | 'Arrive' | 'Begin Task' | 'Finish Task' | 'Send Message';

export default function CheckInPage() {
  const [isLoading, setIsLoading] = React.useState<ActionType | null>(null);
  const [location, setLocation] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastAction, setLastAction] = React.useState<{ action: ActionType; time: string } | null>(null);
  const [message, setMessage] = React.useState('');
  const { toast } = useToast();

  const handleAction = (action: ActionType) => {
    setIsLoading(action);
    setError(null);

    // For actions that don't require location, handle them immediately.
    if (action === 'Clock In' || action === 'Clock Out') {
        console.log(`Action: ${action}`);
        setTimeout(() => {
          const currentTime = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
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
        // TODO: ここでメッセージをFirestoreに保存する
        setTimeout(() => {
          toast({
            title: 'メッセージを送信しました',
            description: '管理者にメッセージが送信されました。',
          });
          // Also update the local state to show the message in the status
          // This is a mock implementation. In a real app, this would be driven by Firestore.
          const currentTime = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          setLastAction({ action: 'Send Message', time: currentTime });
          setMessage(''); // Clear textarea
          setIsLoading(null);
        }, 1000);
        return;
    }


    if (!navigator.geolocation) {
      setError('お使いのブラウザは位置情報取得に対応していません。');
      setIsLoading(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });

        // TODO: ここで緯度・経度とアクションをFirestoreに保存する
        console.log(`Action: ${action}`, { latitude, longitude });

        setTimeout(() => {
          const currentTime = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          setLastAction({ action, time: currentTime });
          toast({
            title: 'アクションを記録しました',
            description: `${getJapaneseActionName(action)} at ${currentTime}`,
          });
          setIsLoading(null);
        }, 1000); // Simulate network request
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
    { action: 'Finish Task', label: '作業終了', icon: CheckCircle },
  ];

  const getJapaneseActionName = (action: ActionType) => {
    const map: Record<ActionType, string> = {
        'Clock In': '出勤',
        'Clock Out': '退勤',
        'Start Travel': '移動開始',
        'Arrive': '現場到着',
        'Begin Task': '作業開始',
        'Finish Task': '作業終了',
        'Send Message': 'メッセージ送信'
    };
    return map[action];
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>勤怠・作業記録</CardTitle>
          <CardDescription>現在地情報と共に、作業状況を記録します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {actionButtons.map(({ action, label, icon: Icon }) => (
              <Button
                key={action}
                size="lg"
                className="h-20 text-base flex-col"
                onClick={() => handleAction(action)}
                disabled={!!isLoading}
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

          {lastAction && (
             <Alert>
              <MapPin className="h-4 w-4" />
              <AlertTitle>最後の記録</AlertTitle>
              <AlertDescription>
                {getJapaneseActionName(lastAction.action)} @ {lastAction.time}
                {location && (lastAction.action !== 'Clock In' && lastAction.action !== 'Clock Out' && lastAction.action !== 'Send Message') && <span className="text-xs block mt-1">({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})</span>}
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
