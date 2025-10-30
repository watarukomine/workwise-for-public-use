
'use server';

import { GoogleAuth } from 'google-auth-library';
import { firebaseConfig } from '@/firebase/config';

// 関数の引数の型定義
interface UpdateCalendarEventArgs {
    operation: 'create' | 'update' | 'delete';
    calendarId: string;
    eventId?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
}

// レスポンスの型定義
interface FunctionResponse {
    status: 'success' | 'error';
    message: string;
    eventId?: string;
}

// Cloud FunctionのトリガーURLを構築
const functionRegion = 'asia-northeast1';
const functionName = 'updatecalendarevent'; // CRITICAL: This must be all lowercase.
const functionUrl = `https://${functionRegion}-${firebaseConfig.projectId}.cloudfunctions.net/${functionName}`;


/**
 * Google認証を行い、Cloud Functionを直接HTTPリクエストで呼び出します。
 * @param args - カレンダー操作のための引数
 * @returns - Cloud Functionからのレスポンス
 */
export async function updateCalendarEvent(args: UpdateCalendarEventArgs): Promise<FunctionResponse> {
    try {
        // Google Cloud環境の認証情報を自動で取得
        const auth = new GoogleAuth();
        const client = await auth.getIdTokenClient(functionUrl);

        console.log(`Calling Cloud Function at: ${functionUrl}`);
        console.log('With args:', args);

        // onRequestトリガーはペイロードを直接受け取る
        const response = await client.request({
            url: functionUrl,
            method: 'POST',
            data: args, // onCallと違い、dataでラップしない
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const resultData = response.data as any;
        
        if (!resultData) {
           throw new Error('Cloud Functionからのレスポンスの形式が不正です。');
        }

        console.log('Cloud Function response received:', resultData);
        return resultData as FunctionResponse;

    } catch (error: any) {
        console.error('Failed to call Cloud Function for calendar update:', error.response?.data || error.message);
        
        const errorMessage = error.response?.data?.error?.message || error.response?.data || error.message || '不明なエラーです。';
        
        return {
            status: 'error',
            message: `カレンダー連携用のCloud Function呼び出しに失敗しました: ${errorMessage}`,
        };
    }
}
