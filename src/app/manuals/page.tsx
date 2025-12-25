'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, FileText, Settings } from 'lucide-react';
import Link from 'next/link';

export default function ManualsPage() {
    const manuals = [
        {
            title: 'ユーザーマニュアル',
            description: 'システムの基本的な使い方や機能について解説しています。',
            href: '/user_manual.pdf',
            icon: BookOpen,
            color: 'text-blue-500',
        },
        {
            title: 'フィールドスタッフマニュアル',
            description: '現場スタッフ向けの操作手順や業務フローについてご確認いただけます。',
            href: '/FIELD_STAFF_MANUAL.pdf',
            icon: FileText,
            color: 'text-green-500',
        },
        {
            title: 'システム仕様書',
            description: 'システムの技術的な仕様や設計情報詳細です。',
            href: '/specifications.pdf',
            icon: Settings,
            color: 'text-gray-500',
        },
    ];

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight mb-2">マニュアル・ドキュメント</h1>
                <p className="text-muted-foreground">システムの利用方法や仕様に関するドキュメント一覧です。</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {manuals.map((manual) => (
                    <Card key={manual.href} className="flex flex-col hover:shadow-lg transition-shadow duration-200">
                        <CardHeader className="pb-4">
                            <div className={`mb-2 p-3 rounded-full w-fit bg-slate-100 ${manual.color}`}>
                                <manual.icon className="h-6 w-6" />
                            </div>
                            <CardTitle className="text-xl">{manual.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col">
                            <CardDescription className="flex-1 mb-6">
                                {manual.description}
                            </CardDescription>
                            <Button asChild className="w-full mt-auto" variant={'outline'}>
                                <Link href={manual.href} target="_blank" rel="noopener noreferrer">
                                    開く (PDF)
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
