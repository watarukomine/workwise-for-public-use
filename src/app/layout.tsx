
'use client';

import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/toaster';
import React from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';

// This can't be in the same file as the metadata export if it's a client component.
// But for now, we will add 'use client' to the whole file to fix the immediate error.
// A better solution would be to move DataSeeder to its own file.


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
          <AppShell>{children}</AppShell>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
