"use client";
import * as React from 'react';
import { RouteOptimizer } from "@/components/optimizer/route-optimizer";
import { RouteMap } from "@/components/optimizer/route-map";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { OptimizeRouteOutput } from '@/ai/flows/optimize-route-for-efficiency';
import type { Customer, Staff, StaffStatus } from '@/lib/types';
import { useSelectedStaff } from '@/contexts/selected-staff-context';

const CUSTOMERS_GAS_URL = 'https://script.google.com/macros/s/AKfycbywC5IoTryeIFRyo7rU4hBaTb7u9p4aK1p0UBvYeuzJiyVDaHqfjYeyA61seoH9LpeQYw/exec';

// This function simulates fetching or generating dynamic status for staff
const generateStaffStatus = (staff: Staff[]): StaffStatus[] => {
  const statuses: StaffStatus['status'][] = ['Idle', 'En Route', 'Working', 'On Site'];
  const locations = [
    { lat: 35.4658, lng: 139.622 }, // Yokohama Station area
    { lat: 35.45,   lng: 139.635 }, // Near Minato Mirai
    { lat: 35.48,   lng: 139.636 }, // Higashi-Kanagawa
    { lat: 35.465,  lng: 139.622 }, // Another Yokohama spot
  ];
  const lastActions = [
      'オフィスで待機中',
      'ABCストアへ移動中',
      'さくら商店で新商品の陳列中',
      'ベイサイドカフェに到着'
  ];

  return staff.map((s, index) => ({
    staffId: s.id,
    status: statuses[index % statuses.length],
    lastAction: lastActions[index % lastActions.length],
    latitude: locations[index % locations.length].lat,
    longitude: locations[index % locations.length].lng,
    distanceFromSite: s.id === '2' ? '約15分' : undefined,
  }));
};

const mapRawDataToCustomers = (rawData: any[]): Customer[] => {
  if (!Array.isArray(rawData)) {
    return [];
  }
  return rawData.map(item => ({
    id: item['ユーザーコード'] || item['id'] || String(item['No'] || Math.random()),
    No: item['No'],
    userCode: item['ユーザーコード'],
    '旧 チャネル SEQ': item['旧 チャネル SEQ'],
    storeName: item['店舗'],
    '管理C': item['管理C'],
    '機材有無': item['機材有無'],
    address: item['住所'],
    latitude: Number(item['緯度']),
    longitude: Number(item['経度']),
    '電話番号': item['電話番号'],
    '営業時間': item['営業時間'],
    // Keep original keys for compatibility if needed elsewhere
    ...item
  }));
};

export default function OptimizerPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [optimizedRoute, setOptimizedRoute] = React.useState<OptimizeRouteOutput | null>(null);
  const [avoidHighways, setAvoidHighways] = React.useState(false);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [isCustomersLoading, setIsCustomersLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const { appliedSelectedStaffIds, allStaff } = useSelectedStaff();
  
  const [staffStatuses, setStaffStatuses] = React.useState<StaffStatus[]>([]);

  // Fetch customers from GAS
  React.useEffect(() => {
    const fetchCustomers = async () => {
      setIsCustomersLoading(true);
      setError(null);
      try {
        const response = await fetch(CUSTOMERS_GAS_URL, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTPエラー: ${response.status}`);
        }
        const result = await response.json();
        
        let customerData: any[] | null = null;
        if (Array.isArray(result)) {
            customerData = result;
        } else if (result && typeof result === 'object' && Array.isArray(result.data)) {
            customerData = result.data;
        }

        if (customerData !== null) {
          setCustomers(mapRawDataToCustomers(customerData));
        } else {
          if (result && typeof result === 'object' && Object.keys(result).length === 0) {
            setCustomers([]);
          } else {
             setError('GASから受信した販売店データの形式が予期せぬものです。');
             setCustomers([]);
          }
        }
      } catch (e) {
        console.error('Failed to fetch customer data for optimizer:', e);
        if (e instanceof Error && e.message.includes('Failed to fetch')) {
          setError('販売店データの取得に失敗しました。CORSポリシーまたはネットワークの問題が考えられます。');
        } else {
          setError('販売店データの取得中に不明なエラーが発生しました。');
        }
      } finally {
        setIsCustomersLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const filteredStaff = React.useMemo(() => {
    if (appliedSelectedStaffIds.length === 0) {
      return allStaff;
    }
    return allStaff.filter(s => appliedSelectedStaffIds.includes(s.id));
  }, [appliedSelectedStaffIds, allStaff]);

  // Generate and filter statuses based on the currently selected staff
  React.useEffect(() => {
    const allGeneratedStatuses = generateStaffStatus(allStaff);
    if (appliedSelectedStaffIds.length === 0) {
      setStaffStatuses(allGeneratedStatuses);
    } else {
      const selectedIds = new Set(appliedSelectedStaffIds);
      setStaffStatuses(allGeneratedStatuses.filter(status => selectedIds.has(status.staffId)));
    }
  }, [appliedSelectedStaffIds, allStaff]);
  
  const staffWithStatus = React.useMemo(() => {
    return filteredStaff.map(staffMember => {
      const status = staffStatuses.find(s => s.staffId === staffMember.id);
      return status ? { ...staffMember, ...status } : null;
    }).filter((s): s is (Staff & StaffStatus) => s !== null);
  }, [filteredStaff, staffStatuses]);

  const handleRouteOptimized = (data: OptimizeRouteOutput | null, options: { avoidHighways: boolean }) => {
    setOptimizedRoute(data);
    setAvoidHighways(options.avoidHighways);
  }
  
  const isLoading = isCustomersLoading || !allStaff;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ルート最適化</h1>
        <p className="text-muted-foreground">
          複数の作業場所間の最も効率的なルートを生成します。
        </p>
      </div>
       {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          {isLoading ? (
            <p>Loading optimizer...</p>
          ) : (
            <RouteOptimizer 
              onRouteOptimized={handleRouteOptimized}
              staff={filteredStaff}
              staffStatus={staffStatuses}
              customers={customers}
            />
          )}
        </div>
        <div className="lg:col-span-2">
          {apiKey ? (
            <APIProvider apiKey={apiKey}>
               {isLoading ? (
                 <p>Loading map...</p>
               ) : (
                <RouteMap 
                  staff={staffWithStatus} 
                  customers={customers || []} 
                  optimizedRoute={optimizedRoute?.optimizedRoute}
                  avoidHighways={avoidHighways}
                />
               )}
            </APIProvider>
          ) : (
            <div className="flex items-center justify-center h-full rounded-lg border border-dashed shadow-sm">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Google Maps APIキーがありません</AlertTitle>
                    <AlertDescription>
                        Google Maps APIキーが設定されていません。地図を表示するには、<code>.env</code>ファイルに<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>として追加してください。
                    </AlertDescription>
                </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

    