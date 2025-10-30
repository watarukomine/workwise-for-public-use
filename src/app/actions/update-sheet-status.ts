
'use server';

import type { StaffStatus } from '@/lib/types';

interface UpdateSheetStatusArgs {
    gasUrl: string;
    eventTitle?: string | null;
    staffName?: string | null;
    statusValue?: StaffStatus['status'] | '';
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    data?: any;
}

export async function updateSheetStatus(args: UpdateSheetStatusArgs): Promise<GasResponse> {
    const { gasUrl, ...data } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }

    // dataオブジェクトからnullまたはundefinedのプロパティを削除
    const filteredData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== null && value !== undefined) {
            (acc as any)[key] = value;
        }
        return acc;
    }, {});


    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            cache: 'no-store',
            redirect: 'follow',
            headers: {
                'Content-Type': 'application/json',
            },
            // GASがe.postData.contentsで受け取るために、dataオブジェクトでラップする
            body: JSON.stringify({ data: filteredData }),
        });
        
        if (response.redirected && response.url.includes('accounts.google.com')) {
             throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GASへのリクエストに失敗しました。 Status: ${response.status}. Response: ${errorText}`);
        }

        const result = await response.json();
        
        if (result.status === 'error' || result.error) {
            throw new Error(result.message || 'GASスクリプトでシート更新エラーが発生しました。');
        }

        return result;
    } catch (error: any) {
        console.error('Failed to call GAS for sheet update:', error);
        return {
            status: 'error',
            message: `シート更新用のGAS呼び出しに失敗しました: ${error.message}`,
        };
    }
}
