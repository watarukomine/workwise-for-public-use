
'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { CheckInClient } from './check-in-client';

export default function CheckInPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <CheckInClient />
        </Suspense>
    )
}
