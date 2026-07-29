'use client';

import * as React from 'react';
import type { WithId, Staff, Customer } from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { format, parseISO, isEqual, startOfDay, isValid } from 'date-fns';
import { Clock, MapPin, Briefcase } from 'lucide-react';
import { cn, findKey } from '../../lib/utils';
import { useCustomer } from '../../contexts/customer-context';
import Link from 'next/link';
import { useOrder } from '../../contexts/order-context';
import { STORE_COLORS } from '../../lib/constants';
import { useUserProfile } from '../../hooks/use-user-profile';

interface VerticalScheduleViewProps {
  staffData: WithId<Staff>[];
  currentDate: Date;
  checkedOutStaffIds?: Set<string>;
}

const formatTime = (date: Date | string | undefined) => {
  if (!date) return '時間未定';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(d.getTime())) return '無効な時間';
  return format(d, 'HH:mm');
};

export function VerticalScheduleView({ staffData, currentDate, checkedOutStaffIds }: VerticalScheduleViewProps) {
  const { customers } = useCustomer();
  const { scheduleEvents, orders } = useOrder();
  const { profile } = useUserProfile();

  const getCustomerById = (id: string | undefined): WithId<Customer> | undefined => {
    if (!id) return undefined;
    return customers.find(c => c.id === id || c.userCode === id);
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

        // Resolve clean storeName for CardTitle
        let resolvedStoreName = customer?.storeName || (targetOrder as any)?.customerName || (event as any).customerName || (raw ? findKey(raw, ['店舗名', '顧客名', '販売店名', '店舗']) : undefined);
        
        if (!resolvedStoreName || resolvedStoreName.includes('店舗名未設定')) {
          const code = (event as any).customerCode || (targetOrder as any)?.customerCode || (event as any).userCode || (raw ? findKey(raw, ['ユーザーコード', '顧客コード']) : undefined);
          if (code && customers) {
            const paddedCode = String(code).trim().padStart(5, '0');
            const match = customers.find(c => {
              const cCode = c.userCode || c['ユーザーコード'] || '';
              return String(cCode).trim().padStart(5, '0') === paddedCode;
            });
            if (match?.storeName) {
              resolvedStoreName = match.storeName;
            }
          }
        }

        const displayTitle = (resolvedStoreName && !resolvedStoreName.includes('店舗名未設定'))
          ? resolvedStoreName
          : (event.title && !event.title.includes('店舗名未設定') ? event.title : '店舗名未設定');

        const eventCard = (
          <Card className={cn(
            "cursor-pointer hover:bg-muted/50 relative overflow-hidden transition-all shadow-sm border",
            areaBgClass,
            isTravel && "bg-secondary/50 border-dashed",
            checkedOutStaffIds?.has(event.staffId || '') && "opacity-50 grayscale bg-gray-100 dark:bg-gray-800",
            profile && event.staffId !== profile.id && "opacity-60 grayscale-[0.5]"
          )}>
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
            <CardContent className="p-4 pt-1 text-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                <span>作業予定時刻：{formatTime(event.start)} - {formatTime(event.end)}</span>
              </div>

              {customer?.address && (
                <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
                  <span>{customer.address}</span>
                </div>
              )}

              {staffMember && (
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  担当: {staffMember.name}
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 space-y-1 text-xs text-slate-800 dark:text-slate-200">
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

        const isOwnTask = profile?.id === event.staffId;
        return (
          <React.Fragment key={event.id}>
            {event.rawOrderId && !isTravel && isOwnTask ? (
              <Link href={`/check-in?orderId=${event.id}`}>
                {eventCard}
              </Link>
            ) : (
              eventCard
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
