import { Suspense } from 'react';
import { CheckInClient } from './check-in-client';
import { Loader2 } from 'lucide-react';

export default function CheckInPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <CheckInClient />
    </Suspense>
  );
}
