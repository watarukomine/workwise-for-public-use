
'use server';

import type { StaffStatus } from '@/lib/types';

interface UpdateSheetStatusArgs {
    gasUrl: string;
    eventTitle?: string | null;
    staffName?: string | null;
    statusValue?: StaffStatus['status'] | '';
    timestamp?: string; // タイムスタンプを追加
}

interface GasResponse {
    status: 'success' | 'error';
    message: string;
    data?: any;
}

export async function updateSheetStatus(args: UpdateSheetStatusArgs): Promise<GasResponse> {
    const { gasUrl, eventTitle, staffName, statusValue, timestamp } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }

    try {
        const url = new URL(gasUrl);
        const params = new URLSearchParams();

        if (eventTitle) {
            params.append('eventTitle', eventTitle);
        }
        // staffName は空文字列も許容するため、undefined/null のみチェック
        if (staffName !== null && staffName !== undefined) {
            params.append('staffName', staffName);
        }
        if (statusValue) {
            params.append('statusValue', statusValue);
        }
        if (timestamp) { // タイムスタンプを追加
            params.append('timestamp', timestamp);
        }
        
        // データはURLパラメータとして送信し、リクエスト自体はPOSTで行う
        const response = await fetch(`${url.origin}${url.pathname}?${params.toString()}`, {
            method: 'POST',
            cache: 'no-store',
            redirect: 'follow',
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
            const errorMessage = result.message || 'GASスクリプトでシート更新エラーが発生しました。';
            // エラーメッセージにGASからの詳細が含まれているか確認
            if (errorMessage.includes('doPost Error')) {
                 throw new Error(errorMessage);
            }
            throw new Error(`GASスクリプトエラー: ${errorMessage}`);
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
