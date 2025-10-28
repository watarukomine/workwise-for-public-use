
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { signInWithEmail, signUpWithEmail } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUserProfile } from '@/hooks/use-user-profile';

const loginSchema = z.object({
  email: z.string().email({ message: '有効なメールアドレスを入力してください。' }),
  password: z.string().min(1, { message: 'パスワードを入力してください。' }),
});

const signUpSchema = loginSchema.extend({
    name: z.string().min(1, { message: '名前を入力してください。' }),
});

type LoginSchema = z.infer<typeof loginSchema>;
type SignUpSchema = z.infer<typeof signUpSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { setProfile } = useUserProfile();

  const loginForm = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const signUpForm = useForm<SignUpSchema>({
    resolver: zodResolver(signUpSchema),
     defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const handleLogin = async (data: LoginSchema) => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await signInWithEmail(data.email, data.password);
      setProfile(user); // Update the global profile
      toast({
        title: 'ログインしました',
        description: 'WorkWiseへようこそ！',
      });
      router.push('/'); 
    } catch (e: any) {
      setError(e.message || 'ログイン中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (data: SignUpSchema) => {
    setIsLoading(true);
    setError(null);
     try {
      const user = await signUpWithEmail(data.email, data.password, data.name);
      setProfile(user); // Update the global profile
      toast({
        title: 'アカウントを処理しました',
        description: 'WorkWiseへようこそ！',
      });
       router.push('/');
    } catch (e: any) {
      setError(e.message || '新規登録中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <Tabs defaultValue="login" className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">ログイン</TabsTrigger>
          <TabsTrigger value="signup">新規登録</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>ログイン</CardTitle>
              <CardDescription>アカウント情報を入力してログインしてください。</CardDescription>
            </CardHeader>
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)}>
                <CardContent className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>メールアドレス</FormLabel>
                        <FormControl>
                          <Input placeholder="admin@example.com" {...field} />
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
                        <FormLabel>パスワード</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                   {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                   <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    ログイン
                  </Button>
                   <Alert variant="default" className="mt-4">
                    <AlertTitle>サンプルアカウント</AlertTitle>
                    <AlertDescription className="text-xs">
                        <p>テスト用に、以下のアカウントでログインできます。</p>
                        <p className="mt-2"><strong>管理者ID:</strong> admin@example.com</p>
                        <p><strong>一般ID:</strong> staff@example.com</p>
                        <p><strong>PW (共通):</strong> password</p>
                    </AlertDescription>
                   </Alert>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </TabsContent>
        
        <TabsContent value="signup">
          <Card>
            <CardHeader>
              <CardTitle>新規登録</CardTitle>
              <CardDescription>新しいアカウントを作成します。（このセッションでのみ有効です）</CardDescription>
            </CardHeader>
             <Form {...signUpForm}>
              <form onSubmit={signUpForm.handleSubmit(handleSignUp)}>
                 <CardContent className="space-y-4">
                    <FormField
                        control={signUpForm.control}
                        name="name"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>名前</FormLabel>
                            <FormControl>
                            <Input placeholder="山田 太郎" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={signUpForm.control}
                        name="email"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>メールアドレス</FormLabel>
                            <FormControl>
                            <Input placeholder="email@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={signUpForm.control}
                        name="password"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>パスワード</FormLabel>
                            <FormControl>
                            <Input type="password" placeholder="6文字以上" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    登録する
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
