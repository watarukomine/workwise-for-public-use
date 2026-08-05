'use server';

interface GasApiArgs {
    gasUrl: string;
    [key: string]: any;
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    data?: any;
    eventId?: string;
    orderId?: string;
    displayId?: string | number;
}

import { ORDER_GAS_URL } from '@/lib/settings';

async function callGasApi(args: GasApiArgs): Promise<GasResponse> {
    const { gasUrl, ...bodyPayload } = args;
    const targetUrl = gasUrl || ORDER_GAS_URL || 'https://script.google.com/macros/s/AKfycbyxFXMdbcTfvrA0cZ_V1av92eDy7LHRuNU9dY1sJzb0jquEs4QhGRTnxSaFRCH9uYik/exec';

    if (!targetUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for GAS execution

        console.log("Sending request to GAS with body:", bodyPayload);

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyPayload),
            cache: 'no-store',
            redirect: 'follow',
            keepalive: true,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        console.log("GAS response status:", response.status);

        if (response.redirected && response.url.includes('accounts.google.com')) {
            throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GASへのリクエストに失敗しました。 Status: ${response.status}. Response: ${errorText}`);
        }

        const result = await response.json();
        console.log("GAS response:", result);

        if (result.status === 'error' || result.error) {
            const errorMessage = result.message || 'GASスクリプトでエラーが発生しました。';
            throw new Error(`GASスクリプトエラー: ${errorMessage}`);
        }

        return result;
    } catch (error: any) {
        console.error('Failed to call GAS API:', error);
        return {
            status: 'error',
            message: `GAS呼び出しに失敗しました: ${error.message}`,
        };
    }
}


export async function updateSheetStatus(args: {
    gasUrl: string;
    eventTitle?: string | null;
    staffName?: string | null;
    statusValue?: string | null;
    timestamp?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    actionType?: string | null;
    actionTimestamp?: string | null;
    scheduledTime?: string | null;
    scheduledEndTime?: string | null;
    scheduledDate?: string | null;
    comment?: string | null;
    estimatedDuration?: number | null;
    cancelDate?: string | null;
    cancelContact?: string | null;
    systemId?: string | null;
    [key: string]: any;
}): Promise<GasResponse> {
    return callGasApi(args);
}

export async function sendIcsEmail(args: {
    gasUrl: string;
    staffName: string;
    staffEmail: string;
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    location: string;
    isUpdate: boolean;
    submitter?: string;
}): Promise<GasResponse> {
    return callGasApi({ ...args, operation: 'sendEmail' });
}

export async function createTask(args: {
    gasUrl: string;
    staffName: string;
    taskName: string;
    description?: string;
    startTime: string;
    endTime: string;
    estimatedDuration: number;
}): Promise<GasResponse> {
    return callGasApi({ ...args, action: 'createTask' });
}

export async function createOrder(args: {
    gasUrl: string;
    systemId?: string;
    displayId?: string;
    userCode?: string;
    storeName: string;
    workType: string;
    scheduledDate: string;
    scheduledTime: string;
    picName?: string;
    orderNo?: string;
    comment?: string;
    carName?: string;
    regNo: string;
    status?: string;
    tireNumber?: string;
    tireSize?: string;
    productName?: string;
    quantity: string;
    sensor?: string;
    arrangement?: string;
    disposal: string;
    contact?: string;
    specialNotes?: string;
    submitter?: string;
}): Promise<GasResponse> {
    return callGasApi({ 
        ...args, 
        action: 'createOrder',
        operation: 'createOrder',
        SystemID: args.systemId,
        '受注 No': args.displayId || args.orderNo,
        '受注行番号': args.displayId,
        'ユーザーコード': args.userCode,
        '店舗名': args.storeName,
        '作業区分': args.workType,
        '作業予定日': args.scheduledDate,
        '予定時間': args.scheduledTime,
        'ご担当者様': args.picName,
        '受注No(ﾘﾏｰｸ1 8ｹﾀ)': args.orderNo,
        '任意コメント(ﾘﾏｰｸ2　10ｹﾀ)': args.comment,
        '車名': args.carName,
        '登録ナンバー(下４桁)': args.regNo,
        '受注ステータス': args.status || '未割当',
        'タイヤ品番': args.tireNumber,
        'タイヤサイズ': args.tireSize,
        '品名': args.productName,
        '本数': args.quantity,
        '空気圧センサーパッキン交換': args.sensor,
        'タイヤ手配状況': args.arrangement,
        '廃タイヤ処分': args.disposal,
        '連絡先': args.contact,
        '特記事項': args.specialNotes,
        'フォーム入力者': args.submitter
    });
}

export async function updateOrderDateTime(args: {
    gasUrl: string;
    orderId: string;
    scheduledDate?: string;
    scheduledTime?: string;
}): Promise<GasResponse> {
    return callGasApi({ ...args, action: 'updateOrderSchedule' });
}

export async function submitOrderDetachedServerAction(payload: any): Promise<{ status: string }> {
    try {
        const res = await callGasApi({
            gasUrl: ORDER_GAS_URL,
            ...payload
        });
        console.log('[ServerSync] GAS sync completed successfully:', res);
        return { status: 'success' };
    } catch (err: any) {
        console.error('[ServerSync] GAS sync error:', err);
        return { status: 'error' };
    }
}
