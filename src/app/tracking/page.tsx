
'use client';
import * as React from 'react';
import { StaffMap } from '@/components/tracking/staff-map';
import { APIProvider } from '@vis.gl/react-google-maps';
import { staffData as allStaff, staffStatusData } from '@/lib/data';
import type { Customer, Staff, StaffStatus } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, getFirestore } from 'firebase/firestore';

export default function TrackingPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const firestore = getFirestore();
  const customersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, isLoading: isLoadingCustomers } =
    useCollection<Customer>(customersCollection);

  const staffWithStatus = staffStatusData.map((status) => {
    const staffDetails = allStaff.find((staff) => staff.id === status.staffId);
    return { ...staffDetails, ...status } as Staff & StaffStatus;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">スタッフ追跡</h1>
        <p className="text-muted-foreground">
          スタッフの現在地と顧客の場所を地図で確認します。
        </p>
      </div>
      <div className="h-[70vh]">
        {apiKey ? (
          <APIProvider apiKey={apiKey}>
            <StaffMap
              staff={staffWithStatus}
              customers={customers || []}
              isLoading={isLoadingCustomers}
            />
          </APIProvider>
        ) : (
          <div className="flex items-center justify-center h-full rounded-lg border border-dashed shadow-sm">
            <Alert variant="destructive" className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Google Maps APIキーがありません</AlertTitle>
              <AlertDescription>
                Google Maps APIキーが設定されていません。地図を表示するには、
                <code>.env</code>ファイルに
                <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>
                として追加してください。
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
