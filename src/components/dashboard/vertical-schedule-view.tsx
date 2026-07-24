
'use client';

import * as React from 'react';
import type { WithId, Staff, Customer } from '../../lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
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
  const { scheduleEvents } = useOrder();
  const { profile } = useUserProfile();

  const getCustomerById = (id: string | undefined): WithId<Customer> | undefined => {
    if (!id) return undefined;
    // customer.id is userCode in some contexts. Let's find by either.
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
          <CardTitle>ダッシュボード</CardTitle>
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
      {relevantEvents.map((event, index) => {
        const customer = getCustomerById(event.locationId);
        const isTravel = event.title.includes('移動');
        const staffMember = staffData.find(s => s.id === event.staffId);
        const areaBgClass = staffMember?.['母店'] ? STORE_COLORS[staffMember['母店']] || '' : '';

        const staffColorStyle = { backgroundColor: staffMember?.color || 'gray' };

        // Extract order details from raw data
        const raw = (event as any).raw;
        const carName = raw ? findKey(raw, ['車名', '車種', '車両']) : undefined;
        const regNo = raw ? findKey(raw, ['登録ナンバー(下４桁)', '登録ナンバー', 'ナンバー', '車番', '登録番号']) : undefined;
        const tireSize = raw ? findKey(raw, ['タイヤサイズ', 'サイズ', 'タイヤ']) : undefined;
        const tireNumber = raw ? findKey(raw, ['本数', 'honsu']) : undefined;
        const arrangement = raw ? findKey(raw, ['タイヤ手配状況', '手配']) : undefined;
        const disposal = raw ? findKey(raw, ['廃タイヤ処分', '廃タイヤ']) : undefined;
        const serviceType = raw ? findKey(raw, ['作業内容', 'サービス種別', 'サービス区分']) : undefined;
        const specialNotes = raw ? findKey(raw, ['特記事項', '詳細', '連絡事項']) : (event as any).specialNotes;
        const hasOrderDetails = !isTravel && (carName || regNo || tireSize || tireNumber || arrangement || disposal || serviceType || specialNotes);

        // Resolve clean storeName for CardTitle
        let resolvedStoreName = customer?.storeName || (event as any).customerName || '';
        if (!resolvedStoreName || resolvedStoreName === '（店舗名未設定）' || resolvedStoreName === '(店舗名未設定)' || resolvedStoreName === '店舗名未設定') {
          const code = (event as any).customerCode || (event as any).userCode || (raw ? findKey(raw, ['ユーザーコード', '顧客コード']) : undefined);
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

        const displayTitle = (resolvedStoreName && resolvedStoreName !== '（店舗名未設定）' && resolvedStoreName !== '(店舗名未設定)' && resolvedStoreName !== '店舗名未設定')
          ? resolvedStoreName
          : (event.title && !event.title.includes('店舗名未設定') ? event.title : '店舗名未設定');

        const eventCard = (
          <Card className={cn(
            "cursor-pointer hover:bg-muted/50 relative overflow-hidden",
            areaBgClass, // Apply store background color
            isTravel && "bg-secondary/50 border-dashed",
            checkedOutStaffIds?.has(event.staffId || '') && "opacity-50 grayscale bg-gray-100 dark:bg-gray-800",
            // Dim tasks assigned to other staff members
            profile && event.staffId !== profile.id && "opacity-40 grayscale-[0.8]"
          )}>
            {/* 完了(済)マーク */}
            {event.status === '完了' && (
              <div className="absolute top-1 right-1 z-10 pointer-events-none">
                <div className="border border-red-600 rounded-full w-5 h-5 flex items-center justify-center bg-white/90 shadow-sm rotate-neg-15">
                  <span className="text-[10px] font-bold text-red-600 leading-none select-none">済</span>
                </div>
              </div>
            )}
            
            {/* 既読(確)マーク */}
            {event.isConfirmed && (
              <div className="absolute top-1 left-1 z-10 pointer-events-none">
                <div className="border border-blue-600 rounded-full w-5 h-5 flex items-center justify-center bg-white/90 shadow-sm">
                  <span className="text-[10px] font-bold text-blue-600 leading-none select-none">確</span>
                </div>
              </div>
            )}

            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg leading-tight font-bold">{displayTitle}</CardTitle>
                <div
                  className="w-3 h-10 rounded-full dynamic-bg"
                  {...{ 'style': { '--dynamic-bg-color': staffMember?.color || 'gray' } as any }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{formatTime(event.start)} - {formatTime(event.end)}</span>
              </div>
              {customer?.address && <div className="flex items-start gap-2 mt-2">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>{customer.address}</span>
              </div>}
              {staffMember && (
                <div className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-black/20 p-1 rounded inline-block">
                  <span>担当: {staffMember.name}</span>
                </div>
              )}
              {hasOrderDetails && (
                <div className="mt-3 pt-2 border-t border-muted flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {carName && <span><span className="font-semibold text-slate-500">車種:</span> {carName}</span>}
                  {regNo && <span><span className="font-semibold text-slate-500">ナンバー:</span> {regNo}</span>}
                  {tireSize && <span><span className="font-semibold text-blue-600">サイズ:</span> {tireSize}</span>}
                  {tireNumber && <span><span className="font-semibold text-blue-600">本数:</span> {tireNumber}本</span>}
                  {arrangement && <span><span className="font-semibold text-orange-600">手配:</span> {arrangement}</span>}
                  {disposal && <span><span className="font-semibold text-purple-600">廃タイヤ:</span> {disposal}</span>}
                  {serviceType && (
                    <span className="w-full mt-1">
                      <span className="font-semibold text-green-700">作業内容:</span> {serviceType}
                    </span>
                  )}
                  {specialNotes && (
                    <span className="w-full mt-1">
                      <span className="font-semibold text-red-600">特記:</span> <span className="text-slate-700">{specialNotes}</span>
                    </span>
                  )}
                </div>
              )}
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
