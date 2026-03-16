import './globals.css';
import { AppShell, AppShellProvider } from '@/components/app-shell';
import { Toaster } from '@/components/ui/toaster';
import React from 'react';
import { SelectedStaffProvider } from '@/contexts/selected-staff-context';
import { CustomerProvider } from '@/contexts/customer-context';
import { OrderProvider } from '@/contexts/order-context';
import { UserProfileProvider } from '@/contexts/user-profile-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { FcmHandler } from '@/components/fcm-handler';
import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'WorkWise',
  description: 'Efficiently manage your workforce.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
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
