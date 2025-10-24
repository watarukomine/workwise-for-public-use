
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  Users,
  Building2,
  Route,
  Briefcase,
  LogIn,
  Home,
  Map,
  ClipboardList,
  Upload,
  MapPin,
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
  useSidebar,
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

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.86 2.25-5.02 2.25-4.33 0-7.87-3.55-7.87-7.95s3.54-7.95 7.87-7.95c2.43 0 3.97 1.02 4.88 1.94l2.6-2.58C18.44 1.56 15.82 0 12.48 0 5.6 0 0 5.6 0 12.5S5.6 25 12.48 25c7.2 0 12.04-4.92 12.04-12.16 0-.8-.08-1.44-.2-2.02h-11.84z" />
    </svg>
);

const navItems = [
  { href: '/', label: '本日の予定', icon: ClipboardList, mobile: true },
  { href: '/optimizer', label: 'ルート最適化', icon: Map, mobile: true },
  { href: '/customers', label: '販売店情報', icon: Building2, mobile: false },
  { href: '/staff', label: 'スタッフ一覧', icon: Users, mobile: false },
  { href: '/import', label: 'データ取込', icon: Upload, mobile: false },
  { href: '/check-in', label: 'チェックイン', icon: MapPin, mobile: true },
];

const mockUser = {
  uid: 'mock-user-123',
  displayName: 'デモユーザー',
  email: 'demo@example.com',
  photoURL: `https://picsum.photos/seed/mock-user-123/100/100`,
}

function NavMenu() {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  
  const visibleItems = isMobile ? navItems.filter(item => item.mobile) : navItems;

  return (
      <SidebarMenu>
        {visibleItems.map((item) => (
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
  const [user, setUser] = React.useState(mockUser);
  const [isLoading, setIsLoading] = React.useState(false);


  const handleSignIn = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setUser(mockUser);
    setIsLoading(false);
    toast({
      title: "ログインしました",
      description: "デモモードへようこそ！",
    });
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    // @ts-ignore
    setUser(null);
    setIsLoading(false);
    toast({
      title: "ログアウトしました",
    });
  };

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
          <NavMenu />
        </SidebarContent>
        <SidebarFooter className="p-2">
          {isLoading ? (
             <div className="flex items-center gap-3 p-2 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-muted" />
                    <div className="h-2 w-1/2 rounded bg-muted" />
                </div>
            </div>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start items-center gap-3 p-2 h-auto text-left">
                   <Avatar className="h-9 w-9">
                    <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`} data-ai-hint="person" />
                    <AvatarFallback>{user.displayName?.charAt(0) ?? 'A'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 -space-y-1">
                    <p className="text-sm font-semibold">{user.displayName || 'Anonymous User'}</p>
                    <p className="text-xs text-muted-foreground">{user.email || `UID: ${user.uid.slice(0,6)}...`}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleSignIn} className="w-full">
              <GoogleIcon className="mr-2 h-4 w-4 fill-white" />
              Sign In with Google
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
