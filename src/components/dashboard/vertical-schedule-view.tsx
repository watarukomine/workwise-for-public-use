'use client';

import * as React from 'react';
import type { WithId, Staff, Customer } from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { format, parseISO, isEqual, startOfDay, isValid } from 'date-fns';
import { Clock, MapPin, Briefcase, FileText } from 'lucide-react';
import { cn, findKey, isStaffMatched, formatDate } from '../../lib/utils';
import { useCustomer } from '../../contexts/customer-context';
import Link from 'next/link';
import { useOrder } from '../../contexts/order-context';
import { STORE_COLORS } from '../../lib/constants';
import { useUserProfile } from '../../hooks/use-user-profile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../ui/dialog";
import { Button } from '../ui/button';

interface VerticalScheduleViewProps {
  staffData: WithId<Staff>[];
  currentDate: Date;
  checkedOutStaffIds?: Set<string>;
  scheduledStaffIds?: Set<string>;
}

const formatTime = (date: Date | string | undefined) => {
  if (!date) return '時間未定';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return '無効な時間';
  return format(d, 'HH:mm');
};

export function VerticalScheduleView({ staffData, currentDate, checkedOutStaffIds, scheduledStaffIds }: VerticalScheduleViewProps) {
  const { customers } = useCustomer();
  const { scheduleEvents, orders } = useOrder();
  const { profile } = useUserProfile();
  const [selectedEvent, setSelectedEvent] = React.useState<any | null>(null);

  const getCustomerById = (id: string | undefined): WithId<Customer> | undefined => {
    if (!id || id === '00000' || id === '0') return undefined;
    return customers.find(c => (c.id === id || c.userCode === id) && c.userCode !== '00000' && c.userCode !== '0');
  };

  // Filter for events assigned to the currently displayed staff for the current date and sort by start time
  const staffIds = new Set(staffData.map(s => s.id));
  const relevantEvents = (scheduleEvents || [])
    .filter(event => {
      const eventDate = parseISO(event.start as string);
      return event.staffId &&
        staffIds.has(event.staffId) &&
        isValid(eventDate) &&
        isEqual(startOfDay(eventDate), startOfDay(currentDate)) &&
        !event.title.includes('移動'); // Hide travel events
    })
    .sort((a, b) => {
      const startA = typeof a.start === 'string' ? parseISO(a.start) : a.start;
      const startB = typeof b.start === 'string' ? parseISO(b.start) : b.start;
      return startA.getTime() - startB.getTime();
    });

  if (relevantEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>モバイル スケジュール</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
            <Briefcase className="h-12 w-12 mb-4" />
            <p className="font-semibold">本日の予定はまだありません。</p>
            <p className="text-sm">管理者がタスクを割り当てるのをお待ちください。</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {relevantEvents.map((event) => {
        const customer = getCustomerById(event.locationId);
        const isTravel = event.title.includes('移動');
        const staffMember = staffData.find(s => s.id === event.staffId);
        const areaBgClass = staffMember?.['母店'] ? STORE_COLORS[staffMember['母店']] || '' : '';

        // Match underlying order object from orders state
        const targetOrder = orders?.find(o =>
          o.id === event.id ||
          o.rawOrderId === event.id ||
          (event.rawOrderId && (o.id === event.rawOrderId || o.rawOrderId === event.rawOrderId))
        );

        // Extract order details with complete fallbacks for Firestore DB + raw data
        const raw = (event as any).raw || (targetOrder as any)?.raw;

        const carName = (targetOrder as any)?.carName || (targetOrder as any)?.carModel || (event as any).carName || (raw ? findKey(raw, ['車名', '車種', '車両']) : undefined);
        const regNo = (targetOrder as any)?.regNo || (targetOrder as any)?.carNumber || (event as any).regNo || (raw ? findKey(raw, ['登録ナンバー(下４桁)', '登録ナンバー', 'ナンバー', '車番', '登録番号']) : undefined);
        const tireSize = (targetOrder as any)?.tireSize || (targetOrder as any)?.size || (event as any).tireSize || (raw ? findKey(raw, ['タイヤサイズ', 'サイズ', 'タイヤ']) : undefined);
        const tireNumberRaw = (targetOrder as any)?.tireNumber || (targetOrder as any)?.quantity || (targetOrder as any)?.['本数'] || (event as any).tireNumber || (raw ? findKey(raw, ['本数', 'honsu']) : undefined);
        const tireNumber = tireNumberRaw ? String(tireNumberRaw).replace(/本$/, '') : undefined;
        const arrangement = (targetOrder as any)?.arrangement || (event as any).arrangement || (raw ? findKey(raw, ['タイヤ手配状況', '手配', '手配状況']) : undefined);
        const disposal = (targetOrder as any)?.disposal || (event as any).disposal || (raw ? findKey(raw, ['廃タイヤ処分', '廃タイヤ', '廃タイヤ回収']) : undefined);
        const serviceType = (targetOrder as any)?.serviceType || (targetOrder as any)?.taskDetails || (event as any).serviceType || (event as any).taskDetails || (raw ? findKey(raw, ['作業内容', 'サービス種別', 'サービス区分', '作業区分']) : undefined);
        const specialNotes = (targetOrder as any)?.specialNotes || (targetOrder as any)?.comment || (event as any).specialNotes || (raw ? findKey(raw, ['特記事項', '詳細', '連絡事項', '備考', 'リマーク1', 'リマーク2']) : undefined);

        // フォーム入力者
        const submitter = (targetOrder as any)?.submitter || (event as any).submitter || (raw ? findKey(raw, ['フォーム入力者', '入力者', 'Submitter', '連絡者名']) : undefined) || '---';

        // 予定時間の照合データ
        const origDateRaw = (targetOrder as any)?.scheduledDate || (event as any).scheduledDate || (raw ? findKey(raw, ['作業予定日', '予定日', '日付', 'scheduledDate']) : undefined);
        const origDate = origDateRaw ? (origDateRaw instanceof Date ? format(origDateRaw, 'yyyy/MM/dd') : formatDate(String(origDateRaw), 'yyyy/MM/dd') || String(origDateRaw)) : '';
        const origTimeRaw = (targetOrder as any)?.scheduledTime || (event as any).scheduledTime || (raw ? findKey(raw, ['予定時間', '作業予定時間', '希望時間', '開始時間']) : undefined);
        const origTime = origTimeRaw ? (typeof origTimeRaw === 'string' && origTimeRaw.includes('T') ? formatTime(origTimeRaw) : String(origTimeRaw)) : '';

        const chipStartTime = formatTime(event.start);
        const chipEndTime = formatTime(event.end);

        const hasTimeDiff = Boolean(origTime && chipStartTime && origTime !== '時間未定' && origTime !== '無効な時間' && !origTime.includes(chipStartTime));

        const isGeneric = (event as any).isGeneric ||
          (targetOrder as any)?.isGeneric ||
          event.id?.startsWith('generic-') ||
          event.id?.startsWith('event-') ||
          event.id?.startsWith('task-') ||
          ['移動', '業務', '休憩', '研修', '同行', '商談', '会議'].some(t => String(event.title || (event as any).taskDetails || '').includes(t));

        // Resolve clean storeName for CardTitle
        let resolvedStoreName = '';
        if (isGeneric) {
          const mainTaskName = event.title || (event as any).taskDetails || '汎用タスク';
          const rawDest = (event as any).destination || (event as any).storeName || (targetOrder as any)?.destination || (targetOrder as any)?.storeName || (event as any).customerName;
          const cleanDest = (rawDest && 
            rawDest !== '（店舗名未設定）' && 
            rawDest !== '(店舗名未設定)' && 
            rawDest !== '店舗名未設定' && 
            !rawDest.startsWith('社員') && 
            !['移動', '業務', '休憩', '研修', '同行', '商談', '会議', '汎用タスク', '社内作業'].includes(rawDest))
            ? String(rawDest).trim()
            : undefined;

          resolvedStoreName = (cleanDest && !mainTaskName.includes(cleanDest))
            ? `${mainTaskName}：${cleanDest}`
            : mainTaskName;
        } else {
          resolvedStoreName = customer?.storeName || (targetOrder as any)?.customerName || (event as any).customerName || (raw ? findKey(raw, ['店舗名', '顧客名', '販売店名', '店舗']) : undefined);
        }
        
        if (!isGeneric && (!resolvedStoreName || resolvedStoreName.includes('店舗名未設定'))) {
          const code = (event as any).customerCode || (targetOrder as any)?.customerCode || (event as any).userCode || (raw ? findKey(raw, ['ユーザーコード', '顧客コード']) : undefined);
          if (code && code !== '00000' && code !== '0' && customers) {
            const paddedCode = String(code).trim().padStart(5, '0');
            if (paddedCode !== '00000') {
              const match = customers.find(c => {
                const cCode = c.userCode || c['ユーザーコード'] || '';
                return cCode && String(cCode).trim().padStart(5, '0') === paddedCode && paddedCode !== '00000';
              });
              if (match?.storeName) {
                resolvedStoreName = match.storeName;
              }
            }
          }
        }

        const displayTitle = (resolvedStoreName && !resolvedStoreName.includes('店舗名未設定'))
          ? resolvedStoreName
          : (event.title && !event.title.includes('店舗名未設定') ? event.title : '店舗名未設定');

        const eventCard = (
          <Card 
            onClick={() => setSelectedEvent({ ...event, targetOrder, raw, displayTitle, staffMember, customer, submitter, origDate, origTime, chipStartTime, chipEndTime, hasTimeDiff, carName, regNo, tireSize, tireNumber, arrangement, disposal, serviceType, specialNotes })}
            className={cn(
              "cursor-pointer hover:bg-muted/50 relative overflow-hidden transition-all shadow-sm border",
              areaBgClass,
              isTravel && "bg-secondary/50 border-dashed",
              checkedOutStaffIds?.has(event.staffId || '') && "opacity-50 grayscale bg-gray-100 dark:bg-gray-800",
              profile && event.staffId !== profile.id && "opacity-60 grayscale-[0.5]"
            )}
          >
            {/* 完了(済)マーク */}
            {event.status === '完了' && (
              <div className="absolute top-2 right-2 z-10 pointer-events-none">
                <div className="border-2 border-red-600 rounded-full w-6 h-6 flex items-center justify-center bg-white/95 shadow-sm rotate-[-12deg]">
                  <span className="text-[11px] font-extrabold text-red-600 leading-none select-none">済</span>
                </div>
              </div>
            )}
            
            {/* 既読(確)マーク */}
            {event.isConfirmed && (
              <div className="absolute top-2 left-2 z-10 pointer-events-none">
                <div className="border-2 border-blue-600 rounded-full w-6 h-6 flex items-center justify-center bg-white/95 shadow-sm">
                  <span className="text-[11px] font-extrabold text-blue-600 leading-none select-none">確</span>
                </div>
              </div>
            )}

            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-lg leading-tight font-extrabold text-slate-900 dark:text-slate-100">
                  店舗名：{displayTitle}
                </CardTitle>
                <div
                  className="w-3 h-8 rounded-full dynamic-bg shrink-0"
                  {...{ 'style': { '--dynamic-bg-color': staffMember?.color || 'gray' } as any }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-sm space-y-2.5">
              {/* 作業予定時刻 & 照合カード */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>配置時刻：{chipStartTime} - {chipEndTime}</span>
                  </div>
                  {hasTimeDiff ? (
                    <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold px-1.5 py-0">
                      ⚠️ 予定とズレあり
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                      ✓ 予定通り
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  <div className={cn("p-1.5 rounded border", hasTimeDiff ? "bg-amber-50/80 dark:bg-amber-950/20 border-amber-200" : "bg-white dark:bg-slate-800 border-slate-100")}>
                    <span className="text-[10px] text-muted-foreground block font-semibold">📋 フォーム当初予定</span>
                    <span className="font-bold text-foreground">{origTime || '時間指定なし'}</span>
                  </div>
                  <div className={cn("p-1.5 rounded border", hasTimeDiff ? "bg-blue-50/80 dark:bg-blue-950/20 border-blue-200" : "bg-white dark:bg-slate-800 border-slate-100")}>
                    <span className="text-[10px] text-muted-foreground block font-semibold">⏱️ 実際のチップ配置</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{chipStartTime}〜{chipEndTime}</span>
                  </div>
                </div>
              </div>

              {customer?.address && (
                <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
                  <span>{customer.address}</span>
                </div>
              )}

              {/* 担当者 & フォーム入力者 */}
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">担当:</span>
                  <span className="font-bold text-foreground">{staffMember?.name || '未設定'}</span>
                  {staffMember && (() => {
                    const isShiftOn = !scheduledStaffIds || scheduledStaffIds.size === 0 || isStaffMatched(staffMember, Array.from(scheduledStaffIds));
                    return !isShiftOn ? (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-800 border-amber-300 font-bold">
                        シフト外
                      </Badge>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">フォーム入力者:</span>
                  <span className="font-bold text-foreground truncate">{submitter}</span>
                </div>
              </div>

              <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700/60 space-y-1 text-xs text-slate-800 dark:text-slate-200">
                {carName && <div><span className="font-bold text-slate-500">車種:</span> {carName}</div>}
                {regNo && <div><span className="font-bold text-slate-500">ナンバー:</span> {regNo}</div>}
                {tireSize && <div><span className="font-bold text-blue-600 dark:text-blue-400">サイズ:</span> {tireSize}</div>}
                {tireNumber && <div><span className="font-bold text-blue-600 dark:text-blue-400">本数:</span> {tireNumber}本</div>}
                {arrangement && <div><span className="font-bold text-amber-600 dark:text-amber-400">手配:</span> {arrangement}</div>}
                {disposal && <div><span className="font-bold text-purple-600 dark:text-purple-400">廃タイヤ:</span> {disposal}</div>}
                {serviceType && <div><span className="font-bold text-emerald-700 dark:text-emerald-400">作業内容:</span> {serviceType}</div>}
                {specialNotes && <div className="text-red-600 dark:text-red-400 font-medium"><span className="font-bold">特記:</span> {specialNotes}</div>}
              </div>
            </CardContent>
          </Card>
        );

        return (
          <React.Fragment key={event.id}>
            {eventCard}
          </React.Fragment>
        );
      })}

      {/* モバイル用 詳細モーダルダイアログ */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  {selectedEvent.displayTitle}
                </DialogTitle>
                <DialogDescription>
                  {selectedEvent.serviceType || selectedEvent.taskDetails || '作業予定の詳細情報'}
                </DialogDescription>
              </DialogHeader>

              {/* 作業予定日時の照合カード */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 my-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center gap-1 text-slate-800 dark:text-slate-200">
                    <Clock className="w-4 h-4 text-blue-600" />
                    作業予定日時の照合
                  </span>
                  {selectedEvent.hasTimeDiff ? (
                    <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px]">
                      ⚠️ 予定と配置時刻にズレあり
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      ✓ 当初予定通り
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={cn("p-2 rounded border", selectedEvent.hasTimeDiff ? "bg-amber-50/80 dark:bg-amber-950/20 border-amber-200" : "bg-white dark:bg-slate-800 border-slate-100")}>
                    <div className="text-[10px] font-semibold text-muted-foreground">📋 フォーム当初予定</div>
                    <div className="font-bold text-foreground text-sm mt-0.5">
                      {selectedEvent.origDate || '日付未設定'}<br />{selectedEvent.origTime || '時間指定なし'}
                    </div>
                  </div>
                  <div className={cn("p-2 rounded border", selectedEvent.hasTimeDiff ? "bg-blue-50/80 dark:bg-blue-950/20 border-blue-200" : "bg-white dark:bg-slate-800 border-slate-100")}>
                    <div className="text-[10px] font-semibold text-muted-foreground">⏱️ 実際の配置時刻</div>
                    <div className="font-bold text-blue-600 dark:text-blue-400 text-sm mt-0.5">
                      {format(currentDate, 'yyyy/MM/dd')}<br />{selectedEvent.chipStartTime} 〜 {selectedEvent.chipEndTime}
                    </div>
                  </div>
                </div>
              </div>

              {/* 詳細情報リスト */}
              <div className="space-y-2 text-xs border rounded-lg p-3 bg-card">
                <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                  <div>
                    <span className="text-muted-foreground block font-medium">担当者</span>
                    <span className="font-bold text-foreground text-sm">{selectedEvent.staffMember?.name || '未設定'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">フォーム入力者</span>
                    <span className="font-bold text-foreground text-sm">{selectedEvent.submitter}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 py-1">
                  <div>
                    <span className="text-muted-foreground block">車名 / ナンバー</span>
                    <span className="font-semibold text-foreground">{selectedEvent.carName || '-'} {selectedEvent.regNo ? `(${selectedEvent.regNo})` : ''}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">タイヤ品番 / サイズ / 本数</span>
                    <span className="font-semibold text-foreground">
                      {selectedEvent.tireSize || '-'} {selectedEvent.tireNumber ? `(${selectedEvent.tireNumber}本)` : ''}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 py-1 border-t">
                  <div>
                    <span className="text-muted-foreground block">タイヤ手配状況</span>
                    <span className="font-semibold text-foreground">{selectedEvent.arrangement || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">廃タイヤ処分</span>
                    <span className="font-semibold text-foreground">{selectedEvent.disposal || '-'}</span>
                  </div>
                </div>

                {selectedEvent.specialNotes && (
                  <div className="pt-2 border-t text-red-600 dark:text-red-400">
                    <span className="font-bold block mb-0.5">特記事項:</span>
                    <p className="whitespace-pre-wrap">{selectedEvent.specialNotes}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                {selectedEvent.rawOrderId && (
                  <Button asChild size="sm" className="w-full mr-2">
                    <Link href={`/check-in?orderId=${selectedEvent.id}`}>
                      作業記録画面へ進む
                    </Link>
                  </Button>
                )}
                <DialogClose asChild>
                  <Button variant="outline" size="sm" className={selectedEvent.rawOrderId ? "" : "w-full"}>
                    閉じる
                  </Button>
                </DialogClose>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
