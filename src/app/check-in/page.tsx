'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ActionType = 'Arrive' | 'Begin Task' | 'Finish Task' | 'Depart';

export default function CheckInPage() {
  const [isLoading, setIsLoading] = React.useState<ActionType | null>(null);
  const [location, setLocation] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastAction, setLastAction] = React.useState<{ action: ActionType; time: string } | null>(null);
  const { toast } = useToast();

  const handleAction = (action: ActionType) => {
    setIsLoading(action);
    setError(null);

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
            description: `${action} at ${currentTime}`,
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
    { action: 'Arrive', label: '現場到着', icon: MapPin },
    { action: 'Begin Task', label: '作業開始', icon: Clock },
    { action: 'Finish Task', label: '作業終了', icon: Clock },
    { action: 'Depart', label: '現場出発', icon: MapPin },
  ];

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
                {lastAction.action} @ {lastAction.time}
                {location && <span className="text-xs block mt-1">({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})</span>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
