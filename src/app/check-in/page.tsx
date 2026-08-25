'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, MapPin, AlertCircle, Loader2, PlayCircle, LogIn, LogOut, CheckCircle, MessageSquare, Send, RefreshCw, BadgeCheck, Truck, Building, PauseCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useUserProfile } from '@/hooks/use-user-profile';
import { updateSheetStatus } from '@/app/actions/gas-actions';
import { ORDER_GAS_URL, STATUS_COLUMN_NAME } from '@/lib/settings';
import type { StaffStatus, WithId, ScheduleEvent } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn, findKey, calculateTravelTimeMinutes, fetchRealtimeTravelMinutes, getStoreLocation, DEFAULT_OFFICE_LOCATION, formatDate, formatTime } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { useOrder } from '@/contexts/order-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActionType = 'Confirm Read' | 'Clock Out' | 'Start Travel' | 'Arrive' | 'Begin Task' | 'Finish Task' | 'Wait' | 'Emergency';
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
  const { refetchOrders, orders, scheduleEvents, saveLocalEvent, deleteLocalEvent } = useOrder();
  const [manualTime, setManualTime] = React.useState('');
  const [isCorrectionMode, setIsCorrectionMode] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<ActionType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const [optimisticStatus, setOptimisticStatus] = React.useState<string | null>(null);
  const [emergencyMessage, setEmergencyMessage] = React.useState('');
  const [isConfirmedOptimistic, setIsConfirmedOptimistic] = React.useState<boolean | null>(null);
  const [isNextStepDialogOpen, setIsNextStepDialogOpen] = React.useState(false);
  const [isProcessingNextStep, setIsProcessingNextStep] = React.useState(false);

  const handleNextStepAction = async (step: 'next_task' | 'return_office' | 'wait') => {
    setIsProcessingNextStep(true);
    try {
      const now = new Date();
      let newStatus = '待機中';
      let nextDest = '';
      let etaStr = '';

      // Get current GPS location if available
      let currentLat: number | null = null;
      let currentLng: number | null = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          currentLat = pos.coords.latitude;
          currentLng = pos.coords.longitude;
        } catch (err) {
          console.warn("GPS lookup failed for next step:", err);
        }
      }

      if (step === 'wait') {
        newStatus = '待機中';
      } else if (step === 'return_office') {
        newStatus = '帰社中';
        const staffStore = profile?.['母店'] || (profile as any)?.mainStore || (profile as any)?.storeName || '横浜店';
        const targetOfficeLocation = getStoreLocation(staffStore);
        nextDest = targetOfficeLocation.name;

        const travelMin = await fetchRealtimeTravelMinutes(
          currentLat,
          currentLng,
          targetOfficeLocation.latitude,
          targetOfficeLocation.longitude
        );
        const etaDate = new Date(now.getTime() + travelMin * 60000);
        etaStr = etaDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      } else if (step === 'next_task') {
        newStatus = '移動中';
        // Find next scheduled order for today for this staff
        const todayStr = formatDate(now.toISOString(), 'yyyy-MM-dd');
        const staffOrders = orders.filter(o => {
          const oDate = o.scheduledDate ? formatDate(o.scheduledDate, 'yyyy-MM-dd') : '';
          const isMyOrder = (profile?.name && o.staffName === profile.name) || (profile?.id && o.staffId === profile.id);
          return oDate === todayStr && isMyOrder && o.status !== '作業完了' && o.status !== 'キャンセル' && o.id !== currentOrder?.id;
        });

        // Sort by scheduledTime
        staffOrders.sort((a, b) => {
          const tA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : 0;
          const tB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : 0;
          return tA - tB;
        });

        const nextOrder = staffOrders[0];

        if (nextOrder) {
          nextDest = nextOrder.customerName || (nextOrder as any).storeName || '次の現場';
          const destLat = nextOrder.latitude || DEFAULT_OFFICE_LOCATION.latitude;
          const destLng = nextOrder.longitude || DEFAULT_OFFICE_LOCATION.longitude;
          const travelMin = calculateTravelTimeMinutes(currentLat, currentLng, destLat, destLng);
          const etaDate = new Date(now.getTime() + travelMin * 60000);
          etaStr = etaDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        } else {
          nextDest = '次の現場';
          etaStr = new Date(now.getTime() + 30 * 60000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        }
      }

      // Update Firestore
      const sysId = (currentOrder as any)?.systemId || currentOrder?.id?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '') || orderId?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '');
      if (sysId) {
        const { OrderService } = await import('@/services/order-service');
        const updateData: any = {
          status: newStatus,
          updatedAt: now.toISOString()
        };
        if (nextDest) updateData.nextDestination = nextDest;
        if (etaStr) updateData.estimatedArrivalTime = etaStr;
        await OrderService.updateOrder(sysId, updateData);
      }

      setOptimisticStatus(newStatus);
      toast({
        title: `「${newStatus}」に更新しました`,
        description: etaStr ? `予定時刻: ${etaStr} (${nextDest})` : undefined
      });
      refetchOrders().catch(e => console.error(e));
    } catch (e: any) {
      toast({ variant: 'destructive', title: '更新エラー', description: e.message });
    } finally {
      setIsProcessingNextStep(false);
      setIsNextStepDialogOpen(false);
    }
  };

  const currentOrder = React.useMemo(() => {
    if (!orderId) return null;
    const cleanId = orderId.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '');

    // Search in orders AND scheduleEvents
    const fromOrders = orders.find(o => o.id === cleanId || o.rawOrderId === cleanId || o.id === orderId || o.rawOrderId === orderId);
    if (fromOrders) return fromOrders;

    const fromEvents = scheduleEvents.find(e => (e as any).systemId === cleanId || e.id === cleanId || e.id === orderId);
    return fromEvents || null;
  }, [orders, scheduleEvents, orderId]);

  // Use optimistic status if available, otherwise fall back to context data
  const currentStatus = optimisticStatus || currentOrder?.status || '未着手';

  // Reset optimistic status when the underlying order status updates to match it
  React.useEffect(() => {
    if (currentOrder?.status && currentOrder.status === optimisticStatus) {
      setOptimisticStatus(null);
    }
    // Also reset if orderId changes
  }, [currentOrder?.status, optimisticStatus, orderId]);

  // Also reset optimistic status if orderId changes completely
  React.useEffect(() => {
    setOptimisticStatus(null);
  }, [orderId]);

  // Safety timeout for isLoading
  React.useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        console.warn(`[CheckIn] Action ${isLoading} timed out, resetting loading state.`);
        setIsLoading(null);
        setError('操作がタイムアウトしました。通信環境を確認して、もう一度お試しください。');
      }, 30000); // 30s safety timeout
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Visibility API: Sync whenever tab/app becomes visible
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[CheckIn] Tab became visible, refetching...');
        refetchOrders().catch(e => console.error(e));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetchOrders]);


  const getJapaneseActionName = (action: ActionType | 'Emergency') => {
    // ... (existing map)
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

  // ... (handleEmergency, handleActionClick, handleConfirmCorrection)
  // Inside executeCheckIn/executeUpdate:



  const handleEmergency = async () => {
    if (!emergencyMessage.trim()) {
      setError('緊急連絡の内容を入力してください。');
      return;
    }
    await executeCheckIn('Emergency');
  };

  const handleActionClick = (action: ActionType) => {
    if (isCorrectionMode) {
      setPendingAction(action);
      // Default to current time in HH:mm format for input type="time"
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setManualTime(`${hours}:${minutes}`);
      setIsDialogOpen(true);
    } else {
      executeCheckIn(action);
    }
  };

  const handleConfirmCorrection = () => {
    if (!pendingAction) return;

    let actionDate = new Date();
    const [hours, minutes] = manualTime.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      actionDate.setHours(hours, minutes, 0, 0);
    } else {
      setError('時刻の形式が正しくありません。');
      return;
    }

    executeCheckIn(pendingAction, actionDate);
    setIsDialogOpen(false);
    setPendingAction(null);
  };

  const executeCheckIn = async (action: ActionType | 'Emergency', manualDate?: Date) => {
    setIsLoading(action === 'Emergency' ? 'Emergency' : action as ActionType);
    setError(null);

    const now = manualDate || new Date();
    const isManual = !!manualDate;

    // Handle Confirm Read action
    if (action === 'Confirm Read') {
      try {
        const sysId = (currentOrder as any)?.systemId ||
          currentOrder?.id?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '') ||
          orderId?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '');
        if (!sysId || !profile?.name) throw new Error('受注IDまたはユーザー情報が取得できません');

        // 1. Direct Write to Firestore (Primary) to ensure instant reflection on the PC timeline
        const { OrderService } = await import('@/services/order-service');
        await OrderService.updateOrder(sysId, {
          isConfirmed: true,
          confirmedAt: now.toISOString()
        });

        // 2. Async Background Backup to GAS Spreadsheet (non-blocking)
        const { updateSheetStatus } = await import('@/app/actions/gas-actions');
        updateSheetStatus({
          gasUrl: ORDER_GAS_URL,
          action: 'confirmRead',
          systemId: sysId,
          staffName: profile.name,
          timestamp: now.toISOString(),
        } as any).catch(gasErr => {
          console.warn("GAS background sync skipped or warning for confirmRead:", gasErr);
        });

        setIsConfirmedOptimistic(true);
        toast({ title: '確認済にしました', description: `${profile.name}として記録しました。` });
        refetchOrders().catch(e => console.error(e));
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'エラー', description: e.message });
      } finally {
        setIsLoading(null);
      }
      return;
    }

    const bypassGeolocation = isManual || action === 'Emergency';

    const statusMap: Partial<Record<string, string>> = {
      'Start Travel': '移動中',
      'Begin Task': '作業中',
      'Finish Task': '作業完了',
      'Clock Out': '帰社中',
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
      if (latitude !== null && longitude !== null) {
        setLocation({ latitude, longitude });
      }

      try {
        const eventTitleForUpdate = `(ID: ${orderId || 'N/A'})`;
        const sysId = (currentOrder as any)?.systemId || currentOrder?.id?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '') || orderId?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '') || '';

        // 1. Direct Write to Staff User Document in Firestore (Primary for Staff Location & Status & ETA)
        if (profile?.id) {
          try {
            const { doc, updateDoc, setDoc } = await import('firebase/firestore');
            const { initializeFirebase } = await import('@/firebase');
            const { firestore: db } = initializeFirebase();
            const userRef = doc(db, 'users', profile.id);

            let etaStr: string | undefined = undefined;
            let destStr: string | undefined = undefined;

            if (action === 'Clock Out') {
              const travelMin = await fetchRealtimeTravelMinutes(
                latitude,
                longitude,
                DEFAULT_OFFICE_LOCATION.latitude,
                DEFAULT_OFFICE_LOCATION.longitude
              );
              const etaDate = new Date(now.getTime() + travelMin * 60000);
              destStr = DEFAULT_OFFICE_LOCATION.name;
              etaStr = etaDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            } else if (action === 'Start Travel') {
              // Target destination is the currentOrder itself
              const targetOrder = currentOrder;
              if (targetOrder) {
                destStr = targetOrder.customerName || (targetOrder as any).storeName || targetOrder.title || '現場';
                const destLat = targetOrder.latitude || DEFAULT_OFFICE_LOCATION.latitude;
                const destLng = targetOrder.longitude || DEFAULT_OFFICE_LOCATION.longitude;
                const travelMin = await fetchRealtimeTravelMinutes(latitude, longitude, destLat, destLng);
                const etaDate = new Date(now.getTime() + travelMin * 60000);
                etaStr = etaDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
              }
            }

            const nowIso = new Date().toISOString();
            const staffFields: any = {
              latitude,
              longitude,
              lastLocationUpdatedAt: nowIso,
              updatedAt: nowIso,
              statusUpdatedAt: nowIso,
              currentStatus: statusValue
            };
            if (etaStr) staffFields.estimatedArrivalTime = etaStr;
            if (destStr) staffFields.nextDestination = destStr;

            await updateDoc(userRef, staffFields).catch(async () => {
              await setDoc(userRef, staffFields, { merge: true });
            });
          } catch (staffLocErr) {
            console.warn("Failed to update staff user location & ETA:", staffLocErr);
          }
        }

        // 2. Direct Write to Order Firestore Document (Primary for Order Status & ETA)
        if (sysId) {
          const { OrderService } = await import('@/services/order-service');
          const firestoreFields: any = {
            status: statusValue,
            updatedAt: new Date().toISOString()
          };
          if (latitude !== null) firestoreFields.latitude = latitude;
          if (longitude !== null) firestoreFields.longitude = longitude;

          // Calculate ETA for Clock Out (帰社中) or Start Travel (移動中)
          if (action === 'Clock Out') {
            const userStore = profile?.['母店'] || (profile as any)?.mainStore || (profile as any)?.storeName;
            const targetOfficeLocation = getStoreLocation(userStore);
            const travelMin = await fetchRealtimeTravelMinutes(
              latitude,
              longitude,
              targetOfficeLocation.latitude,
              targetOfficeLocation.longitude
            );
            const etaDate = new Date(now.getTime() + travelMin * 60000);
            firestoreFields.nextDestination = targetOfficeLocation.name;
            firestoreFields.estimatedArrivalTime = etaDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          } else if (action === 'Start Travel') {
            // Target destination is the currentOrder itself
            const targetOrder = currentOrder;
            if (targetOrder) {
              const targetDest = targetOrder.customerName || (targetOrder as any).storeName || targetOrder.title || '現場';
              const destLat = targetOrder.latitude || DEFAULT_OFFICE_LOCATION.latitude;
              const destLng = targetOrder.longitude || DEFAULT_OFFICE_LOCATION.longitude;
              const travelMin = await fetchRealtimeTravelMinutes(latitude, longitude, destLat, destLng);
              const etaDate = new Date(now.getTime() + travelMin * 60000);
              firestoreFields.nextDestination = targetDest;
              firestoreFields.estimatedArrivalTime = etaDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            }
          }

          const timeFieldMap: Record<string, string> = {
            'Start Travel': 'startTravelTime',
            'Arrive': 'arrivalTimestamp',
            'Begin Task': 'actualStartTime',
            'Finish Task': 'actualEndTime',
          };
          const mappedField = timeFieldMap[action];
          if (mappedField) {
            firestoreFields[mappedField] = now.toISOString();
          }

          await OrderService.updateOrder(sysId, firestoreFields);
        }

        // 3. Async Background Backup to GAS Spreadsheet (non-blocking)
        updateSheetStatus({
          gasUrl: ORDER_GAS_URL,
          eventTitle: eventTitleForUpdate,
          staffName: profile.name,
          statusValue: statusValue,
          timestamp: new Date().toISOString(), // Log timestamp is ALWAYS "real now"
          latitude: latitude,
          longitude: longitude,
          actionType: action as any,
          actionTimestamp: now.toISOString(), // Action Timestamp is real or corrected
          comment: (action as string) === 'Emergency' ? emergencyMessage : (isManual ? '【修正】' : ''),
          emergencyFlag: (action as string) === 'Emergency' ? true : undefined,
          systemId: sysId,
          startTravelTime: action === 'Start Travel' ? now.toISOString() : (currentOrder as any)?.startTravelTime,
          arrivalTimestamp: action === 'Arrive' ? now.toISOString() : (currentOrder as any)?.arrivalTimestamp,
          actualStartTime: action === 'Begin Task' ? now.toISOString() : (currentOrder as any)?.actualStartTime,
          actualEndTime: action === 'Finish Task' ? now.toISOString() : (currentOrder as any)?.actualEndTime,
        }).catch(gasErr => {
          console.warn("GAS background sync skipped or warning:", gasErr);
        });

        // Optimistic update done
        setOptimisticStatus(statusValue);

        // Unblock UI immediately
        setIsLoading(null);

        toast({
          title: (action as string) === 'Emergency' ? '緊急連絡を送信しました' : (isManual ? 'ステータス時間を修正しました' : 'ステータスを更新しました'),
          description: `ステータスを「${statusValue}」に更新しました。`,
          variant: (action as string) === 'Emergency' ? 'destructive' : 'default',
        });

        const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        setLastAction({ action: action as ActionType, time: currentTime });

        if ((action as string) === 'Emergency') setEmergencyMessage('');

        if (isManual && isCorrectionMode) {
          setIsCorrectionMode(false);
          setManualTime('');
        }

        if (action === 'Finish Task') {
          setIsNextStepDialogOpen(true);
        }

        // Refetch in background
        refetchOrders().catch(e => console.error("Background refetch failed:", e));

      } catch (e: any) {
        setIsLoading(null); // Ensure loading is cleared on error too
        const errorMessage = e.message || 'スプレッドシートの更新に失敗しました。';
        setError(errorMessage);
        toast({
          variant: 'destructive',
          title: '更新エラー',
          description: errorMessage
        });
      }
    };

    if (!bypassGeolocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => executeUpdate(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          console.warn("[CheckIn] Geolocation warning:", err);
          toast({
            title: '位置情報の取得をスキップしました',
            description: '現在地なしでステータスを更新します。',
          });
          executeUpdate(null, null);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
      );
    } else {
      await executeUpdate(null, null);
      setIsLoading(null);
    }
  };

  const isButtonDisabled = (action: ActionType | 'Emergency') => {
    if ((action as string) === 'Emergency') return !!isLoading;
    if (['Confirm Read', 'Clock Out', 'Wait'].includes(action)) return false;
    if (!orderId) return true;

    // Explicitly disable workflow buttons if the task is already finished
    if (['作業完了', '完了'].includes(currentStatus)) return true;

    if (isCorrectionMode) return false;

    switch (action) {
      case 'Start Travel':
        // Enable if not already started travel/task, or if in an initial/idle status
        return !['未着手', '未割当', '割当済', '待機中', '出勤済', ''].includes(currentStatus);
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

  const isAlreadyConfirmed = isConfirmedOptimistic ?? currentOrder?.isConfirmed ?? false;

  const actionButtons: { action: ActionType; label: string; icon: React.ElementType }[] = [
    { action: 'Confirm Read', label: isAlreadyConfirmed ? '確認済み ✓' : 'タスク確認', icon: BadgeCheck },
    { action: 'Start Travel', label: '移動開始', icon: PlayCircle },
    { action: 'Arrive', label: '現場到着', icon: MapPin },
    { action: 'Begin Task', label: '作業開始', icon: Clock },
    { action: 'Finish Task', label: '作業完了', icon: CheckCircle },
    { action: 'Clock Out', label: '帰社', icon: Building },
    { action: 'Wait', label: '位置情報更新', icon: RefreshCw },
  ];

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>作業記録</CardTitle>
              <CardDescription>現在地情報と共に、作業状況を記録します。</CardDescription>
              {orderId && <div className="text-sm font-medium mt-1 text-slate-600">現在のステータス: <span className="text-blue-600">{currentStatus}</span></div>}
            </div>
            <div className="flex gap-2">
              {isLoading && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground animate-pulse"
                  onClick={() => {
                    setIsLoading(null);
                    setError('操作をキャンセルしました。');
                  }}
                >
                  キャンセル
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsLoading('Wait' as any);
                  refetchOrders()
                    .then(() => toast({ title: "データを更新しました" }))
                    .finally(() => setIsLoading(null));
                }}
                disabled={!!isLoading}
              >
                <RefreshCw className={cn("h-4 w-4", isLoading === 'Wait' && "animate-spin")} />
              </Button>
              <Button
                variant={isCorrectionMode ? "destructive" : "outline"}
                size="sm"
                onClick={() => setIsCorrectionMode(!isCorrectionMode)}
              >
                {isCorrectionMode ? "修正モードON" : "修正"}
              </Button>
            </div>
          </div>

          {isCorrectionMode && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              修正モード有効中: ボタンを押すと時間指定画面が開きます。
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {currentOrder && (
            <div className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">
                    {currentOrder.orderNo ? `受注No: ${currentOrder.orderNo}` : `ID: ${orderId}`}
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {currentOrder.customerName || (currentOrder as any).storeName || '店舗・現場名未設定'}
                  </h3>
                </div>
                <Badge variant="outline" className="text-xs font-semibold">
                  {currentOrder.serviceType || currentOrder.taskDetails || '作業'}
                </Badge>
              </div>

              {/* 作業予定日時の照合カード（当初予定 vs チップ配置時刻） */}
              {(() => {
                const rawData = currentOrder.raw || {};
                const origDateRaw = findKey(rawData, ['作業予定日', '予定日', '日付', 'scheduledDate']) || currentOrder.scheduledDate || '';
                const origDate = origDateRaw ? (origDateRaw instanceof Date ? formatDate(origDateRaw.toISOString(), 'yyyy/MM/dd') : formatDate(String(origDateRaw), 'yyyy/MM/dd') || String(origDateRaw)) : '';
                const origTimeRaw = findKey(rawData, ['予定時間', '作業予定時間', '希望時間', '開始時間']) || currentOrder.scheduledTime || '';
                const origTime = origTimeRaw ? formatTime(origTimeRaw) : '';

                const chipStartRaw = findKey(rawData, ['チップ配置作業予定', 'chipWorkScheduled']) || (currentOrder as any).start;
                const chipEndRaw = findKey(rawData, ['チップ配置作業完了予定', 'chipWorkCompleted']) || (currentOrder as any).end;
                const chipDate = chipStartRaw ? (chipStartRaw instanceof Date ? formatDate(chipStartRaw.toISOString(), 'yyyy/MM/dd') : formatDate(String(chipStartRaw), 'yyyy/MM/dd') || (origDate || '---')) : (origDate || '---');
                const chipStartTime = chipStartRaw ? formatTime(chipStartRaw) : '';
                const chipEndTime = chipEndRaw ? formatTime(chipEndRaw) : '';

                const hasDateDiff = Boolean(origDate && chipDate && origDate !== chipDate && origDate !== '---' && chipDate !== '---');
                const hasTimeDiff = Boolean(origTime && chipStartTime && origTime !== chipStartTime);
                const hasDiff = hasDateDiff || hasTimeDiff;

                return (
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        作業予定日時の確認
                      </span>
                      {hasDiff ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold">
                          ⚠️ 予定と配置時刻にズレあり
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                          ✓ 当初予定通り
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={cn("p-2 rounded border", hasDiff ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200" : "bg-slate-50 dark:bg-slate-900/40 border-slate-100")}>
                        <div className="text-[10px] text-muted-foreground font-semibold">📋 フォーム当初予定</div>
                        <div className="font-bold text-foreground mt-0.5 text-xs">
                          {origDate || '日付未設定'}<br />{origTime ? origTime : '時間指定なし'}
                        </div>
                      </div>
                      <div className={cn("p-2 rounded border", hasDiff ? "bg-blue-50/70 dark:bg-blue-950/20 border-blue-200" : "bg-slate-50 dark:bg-slate-900/40 border-slate-100")}>
                        <div className="text-[10px] text-muted-foreground font-semibold">⏱️ 実際の配置時刻</div>
                        <div className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 text-xs">
                          {chipDate || '日付未設定'}<br />{chipStartTime ? `${chipStartTime}〜${chipEndTime || ''}` : '未割当'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 基本情報グリッド */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <div>
                  <span className="text-muted-foreground">フォーム入力者: </span>
                  <span className="font-semibold text-foreground">
                    {currentOrder.submitter || (currentOrder.raw ? findKey(currentOrder.raw, ['フォーム入力者', '入力者', 'Submitter', '連絡者名']) : undefined) || '---'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">担当者: </span>
                  <span className="font-semibold text-foreground">{currentOrder.staffName || profile?.name || '---'}</span>
                </div>
                {(currentOrder.carName || currentOrder.regNo) && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">車両: </span>
                    <span className="font-semibold text-foreground">
                      {currentOrder.carName || ''} {currentOrder.regNo ? `(${currentOrder.regNo})` : ''}
                    </span>
                  </div>
                )}
                {(currentOrder.tireSize || currentOrder.quantity) && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">タイヤ: </span>
                    <span className="font-semibold text-foreground">
                      {currentOrder.tireSize || ''} {currentOrder.quantity ? `(${currentOrder.quantity}本)` : ''}
                    </span>
                  </div>
                )}
                {currentOrder.specialNotes && (
                  <div className="col-span-2 bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 text-amber-900 dark:text-amber-200">
                    <span className="font-bold">特記事項: </span>
                    <span>{currentOrder.specialNotes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

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
                onClick={() => handleActionClick(action)}
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
              {currentOrder?.raw && findKey(currentOrder.raw, ['緊急連絡']) && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md text-sm text-red-900">
                  <p className="font-bold mb-1">管理者からの返信:</p>
                  <div className="bg-blue-50 p-2 rounded border border-blue-100 mb-2">
                    <p className="whitespace-pre-wrap text-blue-800">{String(findKey(currentOrder.raw, ['管理者返信']) || '返信待ち...')}</p>
                  </div>
                  <p className="font-bold mb-1">あなたの送信内容:</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{String(findKey(currentOrder.raw, ['緊急連絡']) || '').replace(/【緊急】/g, '').trim()}</p>
                </div>
              )}
              <Textarea
                placeholder="事故・遅延・トラブルなど、緊急時の連絡事項を入力してください。"
                className="mb-2"
                value={emergencyMessage}
                onChange={(e) => setEmergencyMessage(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-red-400 hover:bg-red-500 text-white"
                  onClick={handleEmergency}
                  disabled={!!isLoading || !emergencyMessage.trim()}
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
                          recoveryStatus = '待機中';
                        } else if (currentOrder.actualStartTime) {
                          recoveryStatus = '作業中';
                        } else if (currentOrder.arrivalTimestamp) {
                          recoveryStatus = '作業待ち';
                        } else if (currentOrder.startTravelTime) {
                          recoveryStatus = '移動中';
                        }
                      }

                      const currentComment = currentOrder?.raw ? (findKey(currentOrder.raw, ['緊急連絡']) || '') : '';
                      const newComment = String(currentComment).replace(/【緊急】/g, '').trim();

                      // Optimistic Update
                      if (currentOrder && currentOrder.raw) {
                        saveLocalEvent({
                          ...currentOrder,
                          staffId: profile.id,
                          staffName: profile.name,
                          title: currentOrder.customerName || '受注',
                          status: recoveryStatus,
                          isEmergency: false,
                          description: newComment,
                          start: currentOrder.scheduledTime ?? '',
                          end: currentOrder.scheduledEndTime ?? '',
                          raw: {
                            ...currentOrder.raw,
                            '緊急連絡': newComment,
                            '緊急フラグ': false,
                            '管理者返信': '',
                            '受注ステータス': recoveryStatus
                          }
                        } as WithId<ScheduleEvent>);
                      }

                      await updateSheetStatus({
                        gasUrl: ORDER_GAS_URL,
                        eventTitle: eventTitleForUpdate,
                        staffName: profile.name,
                        statusValue: recoveryStatus,
                        timestamp: now.toISOString(),
                        actionType: null,
                        comment: newComment,
                        emergencyFlag: false,
                        adminReply: '',
                        systemId: (currentOrder as any)?.systemId || currentOrder?.id?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '') || orderId?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '')
                      });
                      toast({ title: '緊急連絡を解除しました', description: `ステータスを「${recoveryStatus}」に戻しました。` });
                      setEmergencyMessage('');
                      if (typeof refetchOrders === 'function') {
                        await refetchOrders();
                      }
                      setTimeout(() => {
                        if (currentOrder) deleteLocalEvent(currentOrder.id);
                      }, 5000);
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
                {getJapaneseActionName(lastAction.action as ActionType)} @ {lastAction.time}
                {location && !['Clock In', 'Clock Out'].includes(lastAction.action as ActionType) && <span className="text-xs block mt-1">({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})</span>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修正時間の入力</DialogTitle>
            <DialogDescription>
              「{pendingAction && getJapaneseActionName(pendingAction)}」の実績時間を入力してください。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="time" className="sr-only">
                時間
              </Label>
              <Input
                id="time"
                type="time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="text-center text-lg"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCorrection}
            >
              決定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNextStepDialogOpen} onOpenChange={setIsNextStepDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>作業完了後の移動先を選択</DialogTitle>
            <DialogDescription>
              作業が完了しました。次のアクションを選択してください。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              className="w-full justify-start h-12 text-base gap-3"
              onClick={() => handleNextStepAction('next_task')}
              disabled={isProcessingNextStep}
            >
              <Truck className="h-5 w-5" />
              次の現場へ移動開始
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-12 text-base gap-3"
              onClick={() => handleNextStepAction('return_office')}
              disabled={isProcessingNextStep}
            >
              <Building className="h-5 w-5" />
              帰社する
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start h-12 text-base gap-3"
              onClick={() => handleNextStepAction('wait')}
              disabled={isProcessingNextStep}
            >
              <PauseCircle className="h-5 w-5" />
              待機する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
