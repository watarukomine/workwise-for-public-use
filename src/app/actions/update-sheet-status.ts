
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
}

export async function updateSheetStatus(args: UpdateSheetStatusArgs): Promise<GasResponse> {
    const { gasUrl, eventTitle, staffName, statusValue } = args;

    if (!gasUrl) {
        return { status: 'error', message: 'GAS URLが設定されていません。' };
    }
    
    // Build the URL with query parameters
    const url = new URL(gasUrl);
    if (eventTitle) {
        url.searchParams.append('eventTitle', eventTitle);
    }
    // Allow sending an empty string to clear the name
    if (staffName !== undefined && staffName !== null) {
        url.searchParams.append('staffName', staffName);
    }
    // Allow sending an empty string or a specific status
    if (statusValue) {
        url.searchParams.append('statusValue', statusValue);
    }

    try {
        const response = await fetch(url.toString(), {
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
