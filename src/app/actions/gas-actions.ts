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
}

async function callGasApi(args: GasApiArgs): Promise<GasResponse> {
    const { gasUrl, ...bodyPayload } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }

    try {
        console.log("Sending request to GAS with body:", bodyPayload);

        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyPayload),
            cache: 'no-store',
            redirect: 'follow',
        });

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
    tireNumber: string;
    tireSize: string;
    productName?: string;
    quantity: string;
    sensor?: string;
    arrangement?: string;
    disposal: string;
    contact?: string;
    specialNotes?: string;
}): Promise<GasResponse> {
    return callGasApi({ ...args, action: 'createOrder' });
}

export async function updateOrderDateTime(args: {
    gasUrl: string;
    orderId: string;
    scheduledDate?: string;
    scheduledTime?: string;
}): Promise<GasResponse> {
    return callGasApi({ ...args, action: 'updateOrderSchedule' });
}
