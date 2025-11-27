
'use client';

import './globals.css';
import { AppShell, AppShellProvider } from '@/components/app-shell';
import { Toaster } from '@/components/ui/toaster';
import React from 'react';
import { SelectedStaffProvider } from '@/contexts/selected-staff-context';
import { CustomerProvider } from '@/contexts/customer-context';
import { OrderProvider } from '@/contexts/order-context';
import { UserProfileProvider } from '@/contexts/user-profile-provider';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>WorkWise</title>
        <meta name="description" content="Efficiently manage your workforce." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        
      </head>
      <body className="font-body antialiased">
        <UserProfileProvider>
          <SelectedStaffProvider>
            <CustomerProvider>
              <OrderProvider>
                <AppShellProvider>
                    <AppShell>
                        {children}
                    </AppShell>
                </AppShellProvider>
              </OrderProvider>
            </CustomerProvider>
          </SelectedStaffProvider>
        </UserProfileProvider>
        <Toaster />
      </body>
    </html>
  );
}
