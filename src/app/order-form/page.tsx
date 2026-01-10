'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { createOrder } from '@/app/actions/gas-actions';
import { useToast } from '@/hooks/use-toast';
import { useCustomer } from '@/contexts/customer-context';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ORDER_GAS_URL } from '@/lib/settings';
import { findKey } from '@/lib/utils';

// Schema definition
const orderFormSchema = z.object({
    userCode: z.string().optional(),
    storeName: z.string().min(1, '店舗名（お取引先様名）は必須です'),
    workType: z.string().min(1, '作業を選択してください'), // Changed to string to allow 'その他' and custom logic
    otherWorkType: z.string().optional(), // Added for custom input
    scheduledDate: z.string().min(1, '作業予定日は必須です'),
    scheduledTime: z.string().min(1, '予定時間は必須です'),
    picName: z.string().optional(),
    orderNo: z.string().max(8, '受注No(リマーク1)は8桁以内で入力してください').optional(),
    comment: z.string().max(10, '任意コメント(リマーク2)は10桁以内で入力してください').optional(),
    specialNotes: z.string().optional(), // Added
    carName: z.string().optional(),
    regNo: z.string().min(4, '登録ナンバー(下4桁)は必須です'),
    status: z.string().optional(),
    tireNumber: z.string().min(1, 'タイヤ品番は必須です'),
    tireSize: z.string().min(1, 'タイヤサイズは必須です'),
    productName: z.string().optional(),
    quantity: z.string().min(1, '本数は必須です'),
    sensor: z.string().optional(),
    arrangement: z.string().optional(),
    disposal: z.string().min(1, '廃タイヤ処分は必須です'),
    contact: z.string().optional(),
}).refine((data) => {
    if (data.workType === 'その他' && !data.otherWorkType) {
        return false;
    }
    return true;
}, {
    message: "作業内容を入力してください",
    path: ["otherWorkType"],
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

export default function OrderFormPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const { toast } = useToast();
    const { customers } = useCustomer();

    const ABBREVIATIONS = [
        { key: /^(RY|ＲＹ)/i, value: 'レンタリース横浜' },
        { key: /^(WTK|WT|ＷＴＫ|ＷＴ)/i, value: 'ウエインズトヨタ神奈川' },
        { key: /^(VS|ＶＳ)/i, value: 'ビークルステーション' },
    ];

    const form = useForm<OrderFormValues>({
        resolver: zodResolver(orderFormSchema),
        defaultValues: {
            status: '点検',
            disposal: '回収有り：廃タイヤラベル在庫有り',
            quantity: '4',
            sensor: '無', // Default to '無' as it's common
            arrangement: '手配済み', // Default pick
            workType: '販売店店舗内作業', // Default
        }
    });

    const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = form;

    // Watch storeName and userCode for changes
    const storeNameWatched = watch('storeName');
    const userCodeWatched = watch('userCode');

    // 1. Store Name -> User Code (and Abbreviations)
    React.useEffect(() => {
        if (!storeNameWatched) return;

        // A. Abbreviation Expansion
        let expandedName = storeNameWatched;
        let isModified = false;

        for (const abbr of ABBREVIATIONS) {
            if (abbr.key.test(expandedName)) {
                // Ensure we don't double replace if already correct (fuzzy check)
                if (!expandedName.startsWith(abbr.value)) {
                    expandedName = expandedName.replace(abbr.key, abbr.value);
                    isModified = true;
                }
            }
        }

        if (isModified) {
            // Update the store name field first
            // This will trigger this effect again with the new name, so we return early to let the next cycle handle lookup
            setValue('storeName', expandedName);
            return;
        }

        // B. Lookup User Code
        if (expandedName.length > 2 && customers.length > 0) {
            const normalizedInput = expandedName.replace(/\s|[　]/g, '');

            const matchedCustomer = customers.find(c => {
                const rawC = c as any;
                const cNameCandidates = [
                    rawC['店舗'],
                    rawC['店舗名'],
                    c.storeName,
                    rawC.name,
                    findKey(c, ['店舗', '店舗名', 'storeName'])
                ];

                // Check if any candidate name contains the input (or implies it)
                return cNameCandidates.some(n => {
                    const str = String(n || '');
                    return str.replace(/\s|[　]/g, '').includes(normalizedInput);
                });
            });

            if (matchedCustomer) {
                const rawMatched = matchedCustomer as any;
                const code = rawMatched['ユーザーコード'] || matchedCustomer.userCode || findKey(matchedCustomer, ['ユーザーコード', 'userCode']);
                if (code) {
                    const currentCode = form.getValues('userCode');
                    // Update if empty OR if it doesn't match the found code (to allow correction)
                    if (!currentCode || currentCode !== String(code)) {
                        setValue('userCode', String(code), { shouldValidate: true });
                    }
                }
            }
        }
    }, [storeNameWatched, customers, setValue, form]);

    // 2. User Code -> Store Name
    React.useEffect(() => {
        if (!userCodeWatched || userCodeWatched.length < 3) return;
        if (customers.length === 0) return;

        const inputCode = userCodeWatched.replace(/\s|[　]/g, '');

        const matchedCustomer = customers.find(c => {
            const rawC = c as any;
            const codeCandidates = [
                rawC['ユーザーコード'],
                c.userCode,
                findKey(c, ['ユーザーコード', 'userCode'])
            ];

            return codeCandidates.some(code => String(code || '') === inputCode);
        });

        if (matchedCustomer) {
            const rawMatched = matchedCustomer as any;
            const storeName = findKey(matchedCustomer, ['店舗', '店舗名', 'storeName']) || rawMatched['店舗'] || matchedCustomer.storeName || rawMatched.name;

            if (storeName) {
                const currentStoreName = form.getValues('storeName');
                // Only update if currently empty
                // If user typed code, they expect store name.
                if (!currentStoreName) {
                    setValue('storeName', String(storeName));
                }
            }
        }
    }, [userCodeWatched, customers, setValue, form]);

    const onSubmit = async (data: OrderFormValues) => {
        setIsSubmitting(true);
        try {
            if (!ORDER_GAS_URL) {
                throw new Error('システム設定エラー: 連携URLが設定されていません。');
            }

            // Handle 'その他' work type
            const submissionData = { ...data };
            if (data.workType === 'その他' && data.otherWorkType) {
                submissionData.workType = data.otherWorkType;
            }

            const result = await createOrder({
                gasUrl: ORDER_GAS_URL,
                ...submissionData,
            });

            if (result.status === 'success') {
                setIsSuccess(true);
                window.scrollTo(0, 0);
            } else {
                throw new Error(result.message || '送信に失敗しました。');
            }
        } catch (error: any) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: '送信エラー',
                description: error.message || '予期せぬエラーが発生しました。時間をおいて再試行してください。',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md text-center py-10">
                    <CardContent className="space-y-4">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-gray-900">送信完了</h2>
                        <p className="text-gray-600">
                            ご注文ありがとうございます。<br />
                            内容を受け付けました。
                        </p>
                        <Button onClick={() => { setIsSuccess(false); reset(); }} className="mt-4">
                            新しい注文を入力する
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900">タイヤ作業 ご注文フォーム</h1>
                    <p className="mt-2 text-gray-600">以下の項目にご入力の上、送信ボタンを押してください。</p>
                </div>

                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 shadow-sm rounded-r-md">
                    <div className="flex items-start">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" />
                        <div>
                            <h3 className="text-sm font-bold text-amber-800 mb-1">作業要請に関するお願い</h3>
                            <p className="text-sm text-amber-700 leading-relaxed">
                                タイヤサイズ19インチ以上の作業につきましては弊社店舗持ち帰り作業をお願いしております。<br />
                                安全作業を進めていくため、持ち帰り作業にご協力くださいますよう宜しくお願い致します。
                            </p>
                        </div>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                            {/* 基本情報 */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium border-b pb-2">基本情報</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="userCode">ユーザーコード (5桁)</Label>
                                        <Input id="userCode" type="text" placeholder="12345" {...register('userCode')} className={errors.userCode ? "border-red-500" : ""} />
                                        {errors.userCode && <p className="text-red-500 text-xs">{errors.userCode.message}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="storeName">店舗名 <span className="text-red-500">*</span></Label>
                                        <Input id="storeName" {...register('storeName')} className={errors.storeName ? "border-red-500" : ""} />
                                        {errors.storeName && <p className="text-red-500 text-xs">{errors.storeName.message}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="workType">作業 <span className="text-red-500">*</span></Label>
                                        <select id="workType" {...register('workType')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                            <option value="販売店店舗内作業">販売店店舗内作業</option>
                                            <option value="TCC作業">TCC作業</option>
                                            <option value="持ち帰り作業">持ち帰り作業</option>
                                            <option value="配送のみ">配送のみ</option>
                                            <option value="その他">その他</option>
                                        </select>
                                        {errors.workType && <p className="text-red-500 text-xs">{errors.workType.message}</p>}
                                    </div>
                                    {form.watch('workType') === 'その他' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="otherWorkType">作業内容 (その他) <span className="text-red-500">*</span></Label>
                                            <Input id="otherWorkType" {...register('otherWorkType')} className={errors.otherWorkType ? "border-red-500" : ""} />
                                            {errors.otherWorkType && <p className="text-red-500 text-xs">{errors.otherWorkType.message}</p>}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="scheduledDate">作業予定日 <span className="text-red-500">*</span></Label>
                                        <Input id="scheduledDate" type="date" {...register('scheduledDate')} className={errors.scheduledDate ? "border-red-500" : ""} />
                                        {errors.scheduledDate && <p className="text-red-500 text-xs">{errors.scheduledDate.message}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="scheduledTime">予定時間 <span className="text-red-500">*</span></Label>
                                        <Input id="scheduledTime" type="time" {...register('scheduledTime')} className={errors.scheduledTime ? "border-red-500" : ""} />
                                        {errors.scheduledTime && <p className="text-red-500 text-xs">{errors.scheduledTime.message}</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="picName">発注担当者様名</Label>
                                    <Input id="picName" {...register('picName')} className={errors.picName ? "border-red-500" : ""} />
                                    {errors.picName && <p className="text-red-500 text-xs">{errors.picName.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="contact">連絡先</Label>
                                    <Input id="contact" placeholder="090-0000-0000" {...register('contact')} className={errors.contact ? "border-red-500" : ""} />
                                    {errors.contact && <p className="text-red-500 text-xs">{errors.contact.message}</p>}
                                </div>
                            </div>

                            {/* 車両・タイヤ情報 */}
                            <div className="space-y-4 pt-4">
                                <h3 className="text-lg font-medium border-b pb-2">車両・タイヤ情報</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="carName">車名</Label>
                                        <Input id="carName" {...register('carName')} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="regNo">登録ナンバー (下4桁) <span className="text-red-500">*</span></Label>
                                        <Input id="regNo" placeholder="1234" {...register('regNo')} className={errors.regNo ? "border-red-500" : ""} />
                                        {errors.regNo && <p className="text-red-500 text-xs">{errors.regNo.message}</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="status">入庫状況</Label>
                                    <select id="status" {...register('status')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                        <option value="点検">点検</option>
                                        <option value="お預かり済">お預かり済</option>
                                        <option value="お客待ち">お客待ち</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="tireNumber">タイヤ品番 <span className="text-red-500">*</span></Label>
                                        <Input id="tireNumber" {...register('tireNumber')} className={errors.tireNumber ? "border-red-500" : ""} />
                                        {errors.tireNumber && <p className="text-red-500 text-xs">{errors.tireNumber.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="tireSize">タイヤサイズ <span className="text-red-500">*</span></Label>
                                        <Input id="tireSize" placeholder="195/65R15" {...register('tireSize')} className={errors.tireSize ? "border-red-500" : ""} />
                                        {errors.tireSize && <p className="text-red-500 text-xs">{errors.tireSize.message}</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="productName">品名</Label>
                                    <Input id="productName" {...register('productName')} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="quantity">本数 <span className="text-red-500">*</span></Label>
                                        <select id="quantity" {...register('quantity')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                            <option value="1">1本</option>
                                            <option value="2">2本</option>
                                            <option value="4">4本</option>
                                            <option value="その他">その他</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="disposal">廃タイヤ処分 <span className="text-red-500">*</span></Label>
                                        <select id="disposal" {...register('disposal')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                            <option value="回収有り：廃タイヤラベル在庫有り">回収有り：廃タイヤラベル在庫有り</option>
                                            <option value="回収有り：廃タイヤラベル未手配(TMP手配）">回収有り：廃タイヤラベル未手配(TMP手配）</option>
                                            <option value="回収なし">回収なし</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sensor">空気圧センサー/パッキン交換</Label>
                                        <select id="sensor" {...register('sensor')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                            <option value="有">有</option>
                                            <option value="無">無</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="arrangement">タイヤ手配状況</Label>
                                    <select id="arrangement" {...register('arrangement')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                        <option value="手配済み">手配済み</option>
                                        <option value="TMP手配">TMP手配</option>
                                        <option value="委託在庫使用">委託在庫使用</option>
                                    </select>
                                </div>
                            </div>

                            {/* その他 */}
                            <div className="space-y-4 pt-4">
                                <h3 className="text-lg font-medium border-b pb-2">その他</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="orderNo">受注No (リマーク1 / 8桁以内)</Label>
                                    <Input id="orderNo" {...register('orderNo')} />
                                    {errors.orderNo && <p className="text-red-500 text-xs">{errors.orderNo.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="comment">任意コメント (リマーク2 / 10桁以内)</Label>
                                    <Input id="comment" {...register('comment')} />
                                    {errors.comment && <p className="text-red-500 text-xs">{errors.comment.message}</p>}
                                </div>
                            </div>

                            {/* 特記事項 */}
                            <div className="space-y-4 pt-4">
                                <h3 className="text-lg font-medium border-b pb-2">特記事項</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="specialNotes">特記事項</Label>
                                    <Textarea id="specialNotes" placeholder="特記事項があればご記入ください" {...register('specialNotes')} />
                                </div>
                            </div>

                            <div className="pt-6">
                                <Button type="submit" className="w-full text-lg h-12" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 送信中...
                                        </>
                                    ) : (
                                        '注文を送信する'
                                    )}
                                </Button>
                            </div>

                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
