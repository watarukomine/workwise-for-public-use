
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Users,
  Building2,
  Map,
  ClipboardList,
  MapPin,
  Briefcase,
  LogIn,
  LogOut,
  ShoppingBag,
  CalendarDays,
} from 'lucide-react';

import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarContent,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import React, { useState, createContext, useContext } from 'react';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserProfile } from '@/hooks/use-user-profile';
import { signOut } from '@/lib/auth';


const allNavItems = [
  { href: '/', label: '本日の予定', icon: ClipboardList, roles: ['admin', 'staff'] },
  { href: '/optimizer', label: 'ルート最適化', icon: Map, roles: ['admin', 'staff'] },
  { href: '/orders', label: '受注管理', icon: ShoppingBag, roles: ['admin'] },
  { href: '/customers', label: '販売店情報', icon: Building2, roles: ['admin'] },
  { href: '/staff', label: 'スタッフ管理', icon: Users, roles: ['admin', 'staff'] },
  { href: '/check-in', label: 'チェックイン', icon: MapPin, roles: ['staff'], mobileOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const { profile, isLoading: isUserLoading } = useUserProfile();
  const [isAuthLoading, setIsAuthLoading] = React.useState(false);
  const [forceMobileView, setForceMobileView] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();

  const handleSignOut = () => {
    setIsAuthLoading(true);
    try {
      signOut();
      toast({
        title: "ログアウトしました",
      });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "ログアウトエラー",
        description: "ログアウト中に問題が発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsAuthLoading(false);
    }
  };
  
  const displayName = profile?.name || 'Anonymous';
  const displayEmail = profile?.email || '...';
  const isLoading = isUserLoading || isAuthLoading;
  
  const clonedChildren = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, { forceMobileView, setForceMobileView });
    }
    return child;
  });

  const NavMenu = () => {
    const { profile, isLoading } = useUserProfile();
    const userRole = profile?.role;

    const navItems = React.useMemo(() => {
        if (isLoading || !profile) {
            return [];
        }
        
        const isActuallyMobile = isMobile || forceMobileView;

        return allNavItems.filter(item => {
            const roleMatch = item.roles.includes(userRole || 'staff');
            const deviceMatch = !item.mobileOnly || isActuallyMobile;
            return roleMatch && deviceMatch;
        });

    }, [profile, isLoading, isMobile, userRole, forceMobileView]);

    if (isLoading) {
        return (
            <div className="p-4 space-y-2">
                <div className="h-8 bg-gray-200 rounded-md animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded-md animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded-md animate-pulse"></div>
            </div>
        )
    }

    return (
        <SidebarMenu>
            {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                        asChild
                        isActive={pathname === item.href}
                        tooltip={item.label}
                        className="font-medium"
                    >
                        <Link href={item.href}>
                            <item.icon />
                            <span>{item.label}</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    )
  }

  return (
    <SidebarProvider>
    <Sidebar>
        <SidebarHeader>
        <div className="flex items-center gap-2 p-2">
            <Button variant="ghost" size="icon" className="shrink-0 text-primary hover:bg-primary/10 rounded-full">
            <Briefcase className="size-5" />
            </Button>
            <h1 className="text-xl font-bold tracking-tight text-primary">WorkWise</h1>
        </div>
        </SidebarHeader>
        <SidebarContent>
        {profile && <NavMenu />}
        </SidebarContent>
        <SidebarFooter className="p-2">
        {isLoading ? (
            <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        ) : !profile ? (
            <Button asChild className="w-full">
            <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                ログイン / 新規登録
            </Link>
            </Button>
        ) : null}
        </SidebarFooter>
    </Sidebar>
    <SidebarInset>
        <header className="flex h-16 items-center justify-between gap-4 border-b bg-background/80 backdrop-blur-sm px-6 sticky top-0 z-30">
        <SidebarTrigger className="md:hidden" />
        <div className="flex-1"></div>
        {isLoading ? (
            <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        ) : profile ? (
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 p-1 h-auto rounded-full">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatarUrl || ''} data-ai-hint="person" />
                    <AvatarFallback>{displayName.charAt(0) ?? 'A'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 -space-y-1 text-left hidden md:block">
                    <p className="text-sm font-semibold">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{displayEmail}</p>
                </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/staff')}>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>Log out</DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        ) : null}
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{clonedChildren}</main>
    </SidebarInset>
    </SidebarProvider>
  );
}
