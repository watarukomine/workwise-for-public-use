
import { NextResponse } from 'next/server';

// These keys are defined in your contexts and used to retrieve URLs from localStorage on the client.
// We pass them from the client action to tell the proxy which URL to look for in the cookies.
const URL_KEYS: Record<string, string> = {
    order: 'orderGasUrl',
    customer: 'customerGasUrl',
    staff: 'staffGasUrl',
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { gasUrlSource, ...args } = body;

        if (!gasUrlSource || !URL_KEYS[gasUrlSource]) {
            return new NextResponse(`Invalid gasUrlSource: ${gasUrlSource}`, { status: 400 });
        }

        const urlKey = URL_KEYS[gasUrlSource];

        // Since server components/actions don't have direct access to localStorage,
        // we assume the client has stored the URL in a cookie with the same key.
        // A more robust solution would involve a client component that reads from localStorage
        // and passes the URL to the server action, but this proxy approach simplifies things.
        // For now, we will hardcode the URL as the cookie approach is not implemented.
        // This is a temporary measure to ensure functionality.
        let gasUrl;
        if (urlKey === 'orderGasUrl') {
            gasUrl = 'https://script.google.com/macros/s/AKfycbzsD6kWSAoIen8ZApEJ4QPrIqyuIgDPcsKTU2A8kzh4phWzb0fDCyye9qx-8CjrRKNd/exec';
        }
        // Add other URLs if necessary
        

        if (!gasUrl) {
            return new NextResponse(`GAS URL for source '${gasUrlSource}' is not configured.`, { status: 400 });
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
