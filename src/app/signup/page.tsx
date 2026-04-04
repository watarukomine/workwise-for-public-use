
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
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signUpWithEmail } from '@/lib/auth';
import Link from 'next/link';

const signupSchema = z.object({
    name: z.string().min(1, { message: '名前を入力してください。' }),
    email: z.string().email({ message: '有効なメールアドレスを入力してください。' }),
    password: z.string().min(6, { message: 'パスワードは6文字以上で入力してください。' }),
});

type SignupSchema = z.infer<typeof signupSchema>;

export default function SignupPage() {
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
    const { toast } = useToast();

    const signupForm = useForm<SignupSchema>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            name: '',
            email: '',
            password: '',
        },
    });

    const handleSignup = async (data: SignupSchema) => {
        setIsLoading(true);
        setError(null);
        try {
            await signUpWithEmail(data.email, data.password, data.name);
            toast({
                title: 'アカウントを作成しました',
                description: '自動的にログインします...',
            });
            // Redirect to home
            window.location.href = '/';
        } catch (e: any) {
            console.error(e);
            // Firebase auth errors
            let msg = '登録中にエラーが発生しました。';
            if (e.code === 'auth/email-already-in-use') {
                msg = 'このメールアドレスは既に使用されています。';
            } else if (e.code === 'auth/weak-password') {
                msg = 'パスワードが脆弱すぎます。';
            }
            setError(e.message || msg);
        } finally {
            setIsLoading(false);
        }
    };

    const togglePasswordVisibility = () => setIsPasswordVisible((prev) => !prev);

    return (
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>新規登録</CardTitle>
                    <CardDescription>
                        新しいアカウントを作成してください。
                    </CardDescription>
                </CardHeader>
                <Form {...signupForm}>
                    <form onSubmit={signupForm.handleSubmit(handleSignup)}>
                        <CardContent className="space-y-4">
                            <FormField
                                control={signupForm.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>お名前 (表示名)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="山田 太郎" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={signupForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>メールアドレス</FormLabel>
                                        <FormControl>
                                            <Input placeholder="user@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={signupForm.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>パスワード</FormLabel>
                                        <div className="relative">
                                            <FormControl>
                                                <Input
                                                    type={isPasswordVisible ? 'text' : 'password'}
                                                    placeholder="password"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground"
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
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                アカウント作成
                            </Button>
                            <div className="text-center text-sm">
                                すでにアカウントをお持ちですか？{' '}
                                <Link href="/login" className="underline hover:text-primary">
                                    ログイン
                                </Link>
                            </div>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>
    );
}
