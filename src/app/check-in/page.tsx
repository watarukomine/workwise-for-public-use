'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, MapPin, AlertCircle, Loader2, PlayCircle, LogIn, LogOut, CheckCircle, MessageSquare, Send, RefreshCw, BadgeCheck, Truck, Building, PauseCircle, Car, CheckCheck, ArrowRightCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useUserProfile } from '@/hooks/use-user-profile';
import { updateSheetStatus } from '@/app/actions/gas-actions';
import { ORDER_GAS_URL, STATUS_COLUMN_NAME } from '@/lib/settings';
import type { StaffStatus, WithId, ScheduleEvent, Order } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn, findKey, calculateTravelTimeMinutes, fetchRealtimeTravelMinutes, getStoreLocation, DEFAULT_OFFICE_LOCATION, formatDate, formatTime, calculateWorkDurationMinutes } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
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
          return oDate === todayStr && isMyOrder && o.status !== '作業完了' && o.status !== '完了' && o.id !== currentOrder?.id;
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

  // 同一店舗の連続受注を判定・管理
  const sameStoreOrdersInfo = React.useMemo(() => {
    if (!currentOrder || !profile) {
      return {
        allSameStore: [] as Order[],
        nextSameStoreOrders: [] as Order[],
        precedingOrders: [] as Order[],
        isContinuous: false,
        currentIndex: 0,
        totalCount: 0,
        isArrivedAtStore: false,
        nextOrder: null as Order | null,
      };
    }

    const targetStore = currentOrder.customerName || (currentOrder as any).storeName || (currentOrder.raw ? findKey(currentOrder.raw, ['店舗名', '店舗', '顧客名']) : '') || '';
    const targetCode = currentOrder.customerCode || (currentOrder as any).userCode || (currentOrder.raw ? findKey(currentOrder.raw, ['ユーザーコード', '顧客コード']) : '') || '';
    const targetDate = currentOrder.scheduledDate ? formatDate(currentOrder.scheduledDate, 'yyyy-MM-dd') : formatDate(new Date().toISOString(), 'yyyy-MM-dd');

    // 自分の当日の全オーダー
    const myTodayOrders = orders.filter(o => {
      const oDate = o.scheduledDate ? formatDate(o.scheduledDate, 'yyyy-MM-dd') : '';
      const isMy = (profile?.name && o.staffName === profile.name) || (profile?.id && o.staffId === profile.id);
      return isMy && oDate === targetDate && o.status !== 'キャンセル';
    });

    // 同じ店舗のオーダーを抽出
    const sameStore = myTodayOrders.filter(o => {
      const sName = o.customerName || (o as any).storeName || (o.raw ? findKey(o.raw, ['店舗名', '店舗', '顧客名']) : '') || '';
      const sCode = o.customerCode || (o as any).userCode || (o.raw ? findKey(o.raw, ['ユーザーコード', '顧客コード']) : '') || '';

      const codeMatch = targetCode && sCode && (targetCode === sCode || String(targetCode).padStart(5, '0') === String(sCode).padStart(5, '0'));
      const nameMatch = targetStore && sName && (targetStore === sName || targetStore.includes(sName) || sName.includes(targetStore));
      return codeMatch || nameMatch;
    });

    // 時間順にソート
    sameStore.sort((a, b) => {
      const tA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : 0;
      const tB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : 0;
      return tA - tB;
    });

    const currentCleanId = (currentOrder as any).systemId || currentOrder.id?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '');
    const currentIndex = sameStore.findIndex(o => {
      const oCleanId = (o as any).systemId || o.id?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '');
      return oCleanId === currentCleanId || o.id === currentOrder.id;
    });

    const precedingOrders = currentIndex > 0 ? sameStore.slice(0, currentIndex) : [];
    const nextSameStoreOrders = currentIndex >= 0 ? sameStore.slice(currentIndex + 1).filter(o => o.status !== '作業完了' && o.status !== '完了') : [];

    // 先行タスクがすでに現場到着または作業中・完了しているか
    const isArrivedAtStore = precedingOrders.some(o =>
      ['作業待ち', '作業中', '作業完了', '完了'].includes(o.status || '') ||
      !!(o as any).arrivalTimestamp || !!(o as any).actualStartTime
    );

    return {
      allSameStore: sameStore,
      nextSameStoreOrders,
      precedingOrders,
      isContinuous: sameStore.length > 1,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
      totalCount: sameStore.length,
      isArrivedAtStore,
      nextOrder: nextSameStoreOrders[0] || null,
    };
  }, [currentOrder, orders, profile]);

  // 次の同店舗タスクへ進む
  const handleProceedToNextSameStore = async (nextOrder: Order) => {
    setIsProcessingNextStep(true);
    try {
      const nextSysId = (nextOrder as any).systemId || nextOrder.id?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '') || nextOrder.id;
      // 次のオーダーのステータスが「未着手」等の場合、「作業待ち（到着済）」に更新
      if (['未着手', '未割当', '割当済', '待機中', '出勤済', ''].includes(nextOrder.status || '')) {
        const { OrderService } = await import('@/services/order-service');
        const nowIso = new Date().toISOString();
        const arrivalToUse = (currentOrder as any)?.arrivalTimestamp || (currentOrder as any)?.actualEndTime || nowIso;
        await OrderService.updateOrder(nextSysId, {
          status: '作業待ち',
          arrivalTimestamp: arrivalToUse,
          updatedAt: nowIso
        });
      }
      setIsNextStepDialogOpen(false);
      router.push(`/check-in?orderId=${nextSysId}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'エラー', description: e.message });
    } finally {
      setIsProcessingNextStep(false);
    }
  };

  // 同店舗の残り全件を一括完了にする
  const handleBatchCompleteRemainingSameStore = async () => {
    if (!sameStoreOrdersInfo.nextSameStoreOrders || sameStoreOrdersInfo.nextSameStoreOrders.length === 0) return;
    setIsProcessingNextStep(true);
    try {
      const { OrderService } = await import('@/services/order-service');
      const now = new Date();
      const nowIso = now.toISOString();
      const arrivalToUse = (currentOrder as any)?.arrivalTimestamp || (currentOrder as any)?.actualEndTime || nowIso;

      const totalCount = sameStoreOrdersInfo.nextSameStoreOrders.length;
      const totalDurationMin = calculateWorkDurationMinutes(arrivalToUse, null, nowIso) || (totalCount * 45);
      const allocatedDurationPerOrder = Math.max(Math.round(totalDurationMin / (totalCount + 1)), 15);

      for (let i = 0; i < sameStoreOrdersInfo.nextSameStoreOrders.length; i++) {
        const target = sameStoreOrdersInfo.nextSameStoreOrders[i];
        const sysId = (target as any).systemId || target.id?.replace(/^trip-/, '').replace(/(-task|-travel)$/i, '') || target.id;

        const fields: any = {
          status: '作業完了',
          arrivalTimestamp: arrivalToUse,
          actualStartTime: arrivalToUse,
          actualEndTime: nowIso,
          workDuration: allocatedDurationPerOrder,
          actualDuration: allocatedDurationPerOrder,
          updatedAt: nowIso
        };

        await OrderService.updateOrder(sysId, fields);

        // GAS にもバックグラウンド通知
        updateSheetStatus({
          gasUrl: ORDER_GAS_URL,
          eventTitle: `(ID: ${sysId})`,
          staffName: profile?.name || '',
          statusValue: '作業完了',
          timestamp: nowIso,
          actionType: 'Finish Task',
          actionTimestamp: nowIso,
          systemId: sysId,
          arrivalTimestamp: arrivalToUse,
          actualStartTime: arrivalToUse,
          actualEndTime: nowIso,
          workDuration: allocatedDurationPerOrder,
          actualDuration: allocatedDurationPerOrder,
          '所要時間': allocatedDurationPerOrder,
          '作業時間（分）': allocatedDurationPerOrder,
        }).catch(e => console.warn("Batch GAS sync skipped:", e));
      }

      toast({
        title: '一括作業完了しました！',
        description: `この店舗の残り全件（${totalCount}台）の作業を完了として記録しました。`
      });

      setIsNextStepDialogOpen(false);
      refetchOrders().catch(e => console.error(e));
    } catch (e: any) {
      toast({ variant: 'destructive', title: '一括完了エラー', description: e.message });
    } finally {
      setIsProcessingNextStep(false);
    }
  };

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

          const currentStart = action === 'Begin Task' ? now.toISOString() : (currentOrder as any)?.actualStartTime;
          let currentArrival = action === 'Arrive' ? now.toISOString() : (currentOrder as any)?.arrivalTimestamp;

          // 同店舗ですでに現場到着済みの場合、先行タスクの到着時刻または完了時刻を引き継ぐ
          if (!currentArrival && sameStoreOrdersInfo.isArrivedAtStore) {
            const prev = sameStoreOrdersInfo.precedingOrders.find(o => (o as any).arrivalTimestamp || (o as any).actualEndTime);
            currentArrival = (prev as any)?.arrivalTimestamp || (prev as any)?.actualEndTime || now.toISOString();
            firestoreFields.arrivalTimestamp = currentArrival;
          }

          const currentEnd = action === 'Finish Task' ? now.toISOString() : (currentOrder as any)?.actualEndTime;

          // 作業完了時に作業開始が未打刻の場合、現場到着時刻を作業開始時刻として自動補完
          let resolvedStartTime = currentStart;
          if (action === 'Finish Task' && !resolvedStartTime && currentArrival) {
            resolvedStartTime = currentArrival;
            firestoreFields.actualStartTime = currentArrival;
          }

          const computedDuration = calculateWorkDurationMinutes(resolvedStartTime, currentArrival, currentEnd);

          if (computedDuration !== null) {
            firestoreFields.workDuration = computedDuration;
            firestoreFields.actualDuration = computedDuration;
          }

          await OrderService.updateOrder(sysId, firestoreFields);
        }

        // 3. Async Background Backup to GAS Spreadsheet (non-blocking)
        let currentArrivalForGas = action === 'Arrive' ? now.toISOString() : (currentOrder as any)?.arrivalTimestamp;
        if (!currentArrivalForGas && sameStoreOrdersInfo.isArrivedAtStore) {
          const prev = sameStoreOrdersInfo.precedingOrders.find(o => (o as any).arrivalTimestamp || (o as any).actualEndTime);
          currentArrivalForGas = (prev as any)?.arrivalTimestamp || (prev as any)?.actualEndTime || now.toISOString();
        }
        let resolvedStartForGas = action === 'Begin Task' ? now.toISOString() : (currentOrder as any)?.actualStartTime;
        if (action === 'Finish Task' && !resolvedStartForGas && currentArrivalForGas) {
          resolvedStartForGas = currentArrivalForGas;
        }
        const currentEndForGas = action === 'Finish Task' ? now.toISOString() : (currentOrder as any)?.actualEndTime;
        const computedDurationForGas = calculateWorkDurationMinutes(resolvedStartForGas, currentArrivalForGas, currentEndForGas);

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
          arrivalTimestamp: currentArrivalForGas,
          actualStartTime: resolvedStartForGas,
          actualEndTime: currentEndForGas,
          workDuration: computedDurationForGas,
          actualDuration: computedDurationForGas,
          '所要時間': computedDurationForGas ?? '',
          '作業時間（分）': computedDurationForGas ?? '',
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
        // 同じ店舗ですでに到着済みの場合は移動不要なので無効化（スキップ）
        if (sameStoreOrdersInfo.isArrivedAtStore) return true;
        // Enable if not already started travel/task, or if in an initial/idle status
        return !['未着手', '未割当', '割当済', '待機中', '出勤済', ''].includes(currentStatus);
      case 'Arrive':
        // 同じ店舗ですでに到着済みの場合は到着も不要なので無効化（スキップ）
        if (sameStoreOrdersInfo.isArrivedAtStore) return true;
        return currentStatus !== '移動中';
      case 'Begin Task':
        // 同店舗ですでに現場到着済みなら、未着手等の初期状態でも直接「作業開始」を押せる！
        if (sameStoreOrdersInfo.isArrivedAtStore && ['未着手', '未割当', '割当済', '待機中', '出勤済', ''].includes(currentStatus)) {
          return false;
        }
        return currentStatus !== '作業待ち';
      case 'Finish Task':
        // 同店舗ですでに現場到着済みなら、未着手等の初期状態でも直接「作業完了」を押せる！
        if (sameStoreOrdersInfo.isArrivedAtStore && ['未着手', '未割当', '割当済', '待機中', '出勤済', ''].includes(currentStatus)) {
          return false;
        }
        // 「作業中」だけでなく、現場到着後の「作業待ち」でも作業完了を押せるように緩和
        return !['作業中', '作業待ち'].includes(currentStatus);
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
              {/* 同店舗の連続作業バッジ */}
              {sameStoreOrdersInfo.isContinuous && (
                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Car className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    同店舗での作業: <span className="underline decoration-blue-500 underline-offset-2">{sameStoreOrdersInfo.currentIndex + 1}台目</span> / 全{sameStoreOrdersInfo.totalCount}台
                  </span>
                  {sameStoreOrdersInfo.isArrivedAtStore && ['未着手', '未割当', '割当済', '待機中', '出勤済', ''].includes(currentStatus) && (
                    <span className="text-[11px] bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200 px-2 py-0.5 rounded-full font-bold shadow-xs">
                      現場到着済（移動不要）
                    </span>
                  )}
                </div>
              )}

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

          {/* ヘルプ案内（作業待ち または 同店舗到着済みのとき） */}
          {(currentStatus === '作業待ち' || (sameStoreOrdersInfo.isArrivedAtStore && ['未着手', '未割当', '割当済', '待機中', '出勤済', ''].includes(currentStatus))) && (
            <div className="p-2.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 rounded-md text-xs text-blue-800 dark:text-blue-300 flex items-start gap-1.5 leading-relaxed">
              <span className="font-bold shrink-0">💡 ヒント:</span>
              <span>
                {sameStoreOrdersInfo.isArrivedAtStore && ['未着手', '未割当', '割当済', '待機中', '出勤済', ''].includes(currentStatus)
                  ? 'すでに同じ店舗に到着しているため、移動開始・現場到着は不要です。作業開始または作業完了をそのまま押してください。'
                  : '作業開始を押し忘れて作業に入った場合でも、作業終了後にそのまま「作業完了」を押せば、到着時刻からの所要時間が自動計算されます。'
                }
              </span>
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
            <DialogTitle>
              {sameStoreOrdersInfo.nextSameStoreOrders.length > 0 ? "同店舗の次の作業を選択" : "作業完了後の移動先を選択"}
            </DialogTitle>
            <DialogDescription>
              {sameStoreOrdersInfo.nextSameStoreOrders.length > 0
                ? `この店舗（${currentOrder?.customerName || '同店舗'}）には、続けて別の作業予定があります。`
                : "作業が完了しました。次のアクションを選択してください。"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-3">
            {/* 同店舗の連続作業がある場合の優先メニュー */}
            {sameStoreOrdersInfo.nextSameStoreOrders.length > 0 && (
              <div className="p-3 bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl space-y-2.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <Car className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>この店舗で続けて作業（残り{sameStoreOrdersInfo.nextSameStoreOrders.length}台）</span>
                </div>

                {/* ボタン①: 続けて次の台（2台目）へ進む */}
                {sameStoreOrdersInfo.nextOrder && (
                  <Button
                    className="w-full justify-start h-auto py-2.5 px-3.5 text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-2.5 rounded-lg"
                    onClick={() => handleProceedToNextSameStore(sameStoreOrdersInfo.nextOrder!)}
                    disabled={isProcessingNextStep}
                  >
                    <ArrowRightCircle className="h-5 w-5 shrink-0" />
                    <div className="text-left leading-tight">
                      <div className="text-sm font-bold">🚗 続けて{sameStoreOrdersInfo.currentIndex + 2}台目の作業へ進む</div>
                      <div className="text-[11px] font-normal opacity-90 mt-0.5">
                        {sameStoreOrdersInfo.nextOrder.carName || '車両'} {sameStoreOrdersInfo.nextOrder.regNo ? `(${sameStoreOrdersInfo.nextOrder.regNo})` : ''}
                        {sameStoreOrdersInfo.nextOrder.tireSize ? ` / ${sameStoreOrdersInfo.nextOrder.tireSize}` : ''}
                      </div>
                    </div>
                  </Button>
                )}

                {/* ボタン②: この店舗の残り全件もまとめて完了にする */}
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-2.5 px-3.5 text-xs font-bold border-green-400 bg-white dark:bg-slate-900 text-green-800 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/50 flex items-center gap-2 rounded-lg"
                  onClick={handleBatchCompleteRemainingSameStore}
                  disabled={isProcessingNextStep}
                >
                  <CheckCheck className="h-4.5 w-4.5 text-green-600 shrink-0" />
                  <div className="text-left leading-tight">
                    <div className="font-bold">✨ この店舗の残り全件（{sameStoreOrdersInfo.nextSameStoreOrders.length}台）もまとめて作業完了にする</div>
                    <div className="text-[10px] font-normal text-muted-foreground mt-0.5">
                      全台まとめて作業が終わった場合にワンタップで完了できます
                    </div>
                  </div>
                </Button>
              </div>
            )}

            {/* 通常の移動アクション */}
            <div className="pt-1 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground px-0.5">
                {sameStoreOrdersInfo.nextSameStoreOrders.length > 0 ? "または次の移動先へ:" : "移動先を選択:"}
              </div>
              <Button
                variant={sameStoreOrdersInfo.nextSameStoreOrders.length > 0 ? "outline" : "default"}
                className="w-full justify-start h-11 text-sm gap-2.5"
                onClick={() => handleNextStepAction('next_task')}
                disabled={isProcessingNextStep}
              >
                <Truck className="h-4.5 w-4.5" />
                別の現場へ移動開始
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-11 text-sm gap-2.5"
                onClick={() => handleNextStepAction('return_office')}
                disabled={isProcessingNextStep}
              >
                <Building className="h-4.5 w-4.5" />
                帰社する
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start h-11 text-sm gap-2.5"
                onClick={() => handleNextStepAction('wait')}
                disabled={isProcessingNextStep}
              >
                <PauseCircle className="h-4.5 w-4.5" />
                待機する
              </Button>
            </div>
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
