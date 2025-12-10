
'use client';
import Link from 'next/link';
// import Image from 'next/image'; // Unused now
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
    BarChart,
    BookOpen,
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
import { Button, buttonVariants } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';


const allNavItems = [
    { href: '/dashboard', label: 'ダッシュボード', icon: ClipboardList, roles: ['admin', 'staff'] },
    { href: '/optimizer', label: 'ルート最適化', icon: Map, roles: ['admin', 'staff'] },
    { href: '/orders', label: '受注管理', icon: ShoppingBag, roles: ['admin'] },
    { href: '/customers', label: '販売店情報', icon: Building2, roles: ['admin'] },
    { href: '/staff', label: 'スタッフ管理', icon: Users, roles: ['admin', 'staff'] },
    { href: '/admin/analytics', label: '分析レポート', icon: BarChart, roles: ['admin'] },
    { href: '/check-in', label: 'チェックイン', icon: MapPin, roles: ['admin', 'staff'], mobileOnly: true },
    { href: '/user_manual.pdf', label: 'マニュアル', icon: BookOpen, roles: ['admin', 'staff'], target: '_blank' },
];

interface AppShellContextType {
    forceMobileView: boolean;
    setForceMobileView: React.Dispatch<React.SetStateAction<boolean>>;
}

const AppShellContext = createContext<AppShellContextType | undefined>(undefined);

export function AppShellProvider({ children }: { children: React.ReactNode }) {
    const [forceMobileView, setForceMobileView] = useState(false);

    return (
        <AppShellContext.Provider value={{ forceMobileView, setForceMobileView }}>
            {children}
        </AppShellContext.Provider>
    );
}

export function useAppShell() {
    const context = useContext(AppShellContext);
    if (!context) {
        throw new Error('useAppShell must be used within an AppShellProvider');
    }
    return context;
}

const DesktopNav = () => {
    const { profile, isLoading } = useUserProfile();
    const pathname = usePathname();
    const userRole = profile?.role;

    const navItems = React.useMemo(() => {
        if (isLoading || !profile) return [];
        return allNavItems.filter(item => {
            const roleMatch = item.roles.includes(userRole || 'staff');
            const deviceMatch = !item.mobileOnly;
            return roleMatch && deviceMatch;
        });
    }, [profile, isLoading, userRole]);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2">
                <div className="h-8 w-24 bg-gray-200 rounded-md animate-pulse"></div>
                <div className="h-8 w-24 bg-gray-200 rounded-md animate-pulse"></div>
                <div className="h-8 w-24 bg-gray-200 rounded-md animate-pulse"></div>
            </div>
        )
    }

    return (
        <nav className="flex items-center gap-2">
            {navItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    target={item.target ? item.target : undefined}
                    className={cn(
                        buttonVariants({ variant: pathname === item.href ? 'secondary' : 'ghost', size: 'sm' }),
                        'font-medium'
                    )}
                >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                </Link>
            ))}
        </nav>
    );
};

export function AppShell({ children }: { children: React.ReactNode }) {
    const { toast } = useToast();
    const router = useRouter();
    const { profile, isLoading: isUserLoading, clearProfile } = useUserProfile();
    const [isAuthLoading, setIsAuthLoading] = React.useState(false);
    const { forceMobileView } = useAppShell();
    const isMobile = useIsMobile() || forceMobileView;
    const pathname = usePathname();

    const handleSignOut = () => {
        setIsAuthLoading(true);
        try {
            signOut();
            clearProfile();
            toast({
                title: "ログアウトしました",
            });
            router.push('/login');
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

    const NavMenu = () => {
        const { profile, isLoading } = useUserProfile();
        const userRole = profile?.role;

        const navItems = React.useMemo(() => {
            if (isLoading || !profile) return [];
            return allNavItems.filter(item => item.roles.includes(userRole || 'staff'));
        }, [profile, isLoading, userRole]);

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
                            <Link href={item.href} target={item.target ? item.target : undefined}>
                                <item.icon />
                                <span>{item.label}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        )
    }

    const showLoginButton = !profile && pathname !== '/login';

    if (isMobile) {
        return (
            <SidebarProvider>
                <Sidebar>
                    <SidebarHeader>
                        <div className="flex items-center gap-2 p-2">
                            <Button variant="ghost" size="icon" className="shrink-0 text-primary hover:bg-primary/10 rounded-full">
                                {/* Use standard img tag to avoid Next.js Image optimization issues with local assets if they occur */}
                                {/* Use standard img tag to avoid Next.js Image optimization issues with local assets if they occur */}
                                <img src="/icons/icon-192x192.png" alt="Logo" width={24} height={24} className="rounded-sm" />
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
                        ) : showLoginButton ? (
                            <Button asChild className="w-full">
                                <Link href="/login">
                                    <LogIn className="mr-2 h-4 w-4" />
                                    ログイン
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
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => router.push('/staff')}>Profile</DropdownMenuItem>
                                    <DropdownMenuItem>Settings</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleSignOut}>Log out</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : null}
                    </header>
                    <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
                </SidebarInset>
            </SidebarProvider>
        )
    }

    // Desktop layout
    return (
        <div className="min-h-screen w-full flex flex-col">
            <header className="flex h-16 items-center justify-between gap-4 border-b bg-background/80 backdrop-blur-sm px-6 sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="shrink-0 text-primary hover:bg-primary/10 rounded-full">
                            {/* Use standard img tag to avoid Next.js Image optimization issues with local assets if they occur */}
                            <img src="/icons/icon-192x192.png" alt="Logo" width={24} height={24} className="rounded-sm" />
                        </Button>
                        <h1 className="text-xl font-bold tracking-tight text-primary">WorkWise</h1>
                    </div>
                    {profile && <DesktopNav />}
                </div>

                <div className="flex items-center gap-4">
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
                                    <div className="flex-1 -space-y-1 text-left">
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
                    ) : showLoginButton ? (
                        <Button asChild size="sm">
                            <Link href="/login">
                                <LogIn className="mr-2 h-4 w-4" />
                                ログイン
                            </Link>
                        </Button>
                    ) : null}
                </div>
            </header>
            <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </div>
    )
}
