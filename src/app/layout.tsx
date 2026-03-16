
'use client';

import './globals.css';
import { AppShell, AppShellProvider } from '@/components/app-shell';
import { Toaster } from '@/components/ui/toaster';
import React, { useEffect } from 'react';
import { SelectedStaffProvider } from '@/contexts/selected-staff-context';
import { CustomerProvider } from '@/contexts/customer-context';
import { OrderProvider } from '@/contexts/order-context';
import { UserProfileProvider } from '@/contexts/user-profile-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useRouter } from 'next/navigation';
import { FcmHandler } from '@/components/fcm-handler';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <title>WorkWise</title>
        <meta name="description" content="Efficiently manage your workforce." />
        <link rel="icon" href="/icons/icon-192x192.png" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png"></link>
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <FirebaseClientProvider>
          <UserProfileProvider>
            <SelectedStaffProvider>
              <CustomerProvider>
                <OrderProvider>
                  <AppShellProvider>
                    <FcmHandler />
                    <AppShell>
                      {children}
                    </AppShell>
                  </AppShellProvider>
                </OrderProvider>
              </CustomerProvider>
            </SelectedStaffProvider>
          </UserProfileProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
