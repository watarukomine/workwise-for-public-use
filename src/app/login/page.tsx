
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import { signInWithEmail, sendPasswordReset } from '@/lib/auth';
import { useUserProfile } from '@/hooks/use-user-profile';

const loginSchema = z.object({
  email: z.string().min(1, { message: 'IDまたはメールアドレスを入力してください。' }),
  password: z.string().min(1, { message: 'パスワードを入力してください。' }),
});

type LoginSchema = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const { toast } = useToast();
  const { setProfile } = useUserProfile();

  const loginForm = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLogin = async (data: LoginSchema) => {
    setIsLoading(true);
    setError(null);
    try {
      const userProfile = await signInWithEmail(data.email, data.password);
      setProfile(userProfile);
      toast({
        title: 'ログインしました',
        description: 'WorkWiseへようこそ！',
      });
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message || 'ログイン中に不明なエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = loginForm.getValues('email');
    if (!email || !z.string().email().safeParse(email).success) {
      setError('パスワードを再設定するには、まず有効なメールアドレスを入力してください。');
      return;
    }

    setIsResetting(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      toast({
        title: 'リセットメールを送信しました',
        description: 'メールボックスを確認してパスワードを再設定してください。',
      });
    } catch (e: any) {
      setError(e.message || 'パスワードリセット中にエラーが発生しました。');
    } finally {
      setIsResetting(false);
    }
  };

  const togglePasswordVisibility = () => setIsPasswordVisible((prev) => !prev);

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">ログイン</CardTitle>
          <CardDescription className="text-center">
            アカウント情報を入力してログインしてください。
          </CardDescription>
        </CardHeader>
        <Form {...loginForm}>
          <form onSubmit={loginForm.handleSubmit(handleLogin)}>
            <CardContent className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID または メールアドレス</FormLabel>
                    <FormControl>
                      <Input placeholder="例: STAFF001 または メールアドレス" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>パスワード</FormLabel>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="px-0 font-normal h-auto text-xs"
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={isResetting}
                      >
                        パスワードをお忘れですか？
                      </Button>
                    </div>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={isPasswordVisible ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                        onClick={togglePasswordVisibility}
                      >
                        {isPasswordVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full font-bold" disabled={isLoading || isResetting}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                ログイン
              </Button>
              
              <div className="text-center text-sm text-muted-foreground mt-2">
                アカウントをお持ちでないですか？{' '}
                <Link href="/signup" className="text-primary font-medium hover:underline">
                  新規登録
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
