// This file is no longer used and can be safely deleted.
// The app now calls the Google Apps Script URL directly from server actions.
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    return NextResponse.json({
        status: 'error',
        message: 'This API endpoint is deprecated and should not be used.'
    }, { status: 410 });
}
