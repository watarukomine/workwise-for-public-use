
'use client';

import './globals.css';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/toaster';
import React from 'react';
import { SelectedStaffProvider } from '@/contexts/selected-staff-context';
import { FirebaseClientProvider } from '@/firebase';
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
        <FirebaseClientProvider>
          <UserProfileProvider>
            <SelectedStaffProvider>
              <AppShell>{children}</AppShell>
            </SelectedStaffProvider>
          </UserProfileProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}

    