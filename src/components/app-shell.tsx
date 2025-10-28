
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
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useIsMobile } from '@/hooks/use-mobile';


const allNavItems = [
  { href: '/', label: '本日の予定', icon: ClipboardList, roles: ['admin', 'staff'] },
  { href: '/optimizer', label: 'ルート最適化', icon: Map, roles: ['admin', 'staff'] },
  { href: '/orders', label: '受注管理', icon: ShoppingBag, roles: ['admin'] },
  { href: '/customers', label: '販売店情報', icon: Building2, roles: ['admin'] },
  { href: '/staff', label: 'スタッフ管理', icon: Users, roles: ['admin', 'staff'] },
  { href: '/check-in', label: 'チェックイン', icon: MapPin, roles: ['staff'], mobileOnly: true },
];

function NavMenu() {
  const pathname = usePathname();
  const { profile, isLoading } = useUserProfile();
  const isMobile = useIsMobile();

  const navItems = React.useMemo(() => {
    if (isLoading || !profile) {
      return [];
    }
    
    if (profile.role === 'admin') {
      return allNavItems.filter(item => !item.mobileOnly || isMobile);
    }

    return allNavItems.filter(item => {
        const roleMatch = item.roles.includes(profile.role);
        const deviceMatch = !item.mobileOnly || isMobile;
        return roleMatch && deviceMatch;
    });
  }, [profile, isLoading, isMobile]);

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const { profile, isLoading, clearProfile } = useUserProfile();
  const [isAuthLoading, setIsAuthLoading] = React.useState(false);

  const handleSignOut = async () => {
    setIsAuthLoading(true);
    clearProfile();
    toast({
      title: "ログアウトしました",
    });
    router.push('/login');
    setIsAuthLoading(false);
  };
  
  const displayName = profile?.name || 'Anonymous';
  const displayEmail = profile?.email || '...';

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
          {isLoading || isAuthLoading ? (
             <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start items-center gap-3 p-2 h-auto text-left">
                   <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatarUrl} data-ai-hint="person" />
                    <AvatarFallback>{displayName.charAt(0) ?? 'A'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 -space-y-1">
                    <p className="text-sm font-semibold">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{displayEmail}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/staff')}>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild className="w-full">
              <Link href="/login">
                 <LogIn className="mr-2 h-4 w-4" />
                 ログイン / 新規登録
              </Link>
            </Button>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-6 sticky top-0 z-30">
          <SidebarTrigger className="md:hidden" />
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
