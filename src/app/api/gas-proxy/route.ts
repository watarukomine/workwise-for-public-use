
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// These keys are defined in your contexts and used to retrieve URLs from localStorage on the client.
// We will now have a separate key for the staff data source.
const URL_KEYS: Record<string, string> = {
    order: 'orderGasUrl',
    customer: 'customerGasUrl',
    staff: 'staffGasUrl', // Added for staff data
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // The 'gasUrl' is now passed directly from the action, which reads it from the context/localStorage.
        // This makes the proxy more generic and reliable.
        const { gasUrl, ...args } = body;

        if (!gasUrl) {
            return new NextResponse(`GAS URL was not provided to the proxy.`, { status: 400 });
        }

        const formData = new URLSearchParams();
        Object.entries(args).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, String(value));
            }
        });

        const gasResponse = await fetch(gasUrl, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
            redirect: 'follow',
        });

        if (gasResponse.url.includes('accounts.google.com')) {
            throw new Error('GASへのアクセス権限がありません。GASのデプロイ設定で「アクセスできるユーザー」を「全員」にしてください。');
        }

        const responseText = await gasResponse.text();
        if (!gasResponse.ok) {
            throw new Error(`GAS script returned a non-OK response. Status: ${gasResponse.status}. Response: ${responseText}`);
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`GAS script returned a non-JSON response: ${responseText}`);
        }

        if (result.status === 'error') {
            throw new Error(result.message || 'GAS script returned a JSON-formatted error.');
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[GAS PROXY ERROR]', error);
        return new NextResponse(error.message, { status: 500 });
    }
}
