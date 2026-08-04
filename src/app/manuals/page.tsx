'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, FileText, Settings, Shield, Download } from 'lucide-react';
import Link from 'next/link';
import { downloadCSVTemplate } from '@/lib/templates';

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
        {
            title: 'セキュリティルール仕様書',
            description: 'データベースのアクセス権限や情報セキュリティの設定に関する詳細ドキュメントです。',
            href: '/security_rules.pdf',
            icon: Shield,
            color: 'text-purple-500',
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

                {/* Troubleshooting Guide Link */}
                <Card className="flex flex-col hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="pb-4">
                        <div className="mb-2 p-3 rounded-full w-fit bg-slate-100 text-red-500">
                            <FileText className="h-6 w-6" />
                        </div>
                        <CardTitle className="text-xl">エラー・トラブルシューティング</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                        <CardDescription className="flex-1 mb-6">
                            エラーメッセージの意味や、問題発生時の対処方法についてまとめています。
                        </CardDescription>
                        <Button asChild className="w-full mt-auto" variant={'outline'}>
                            <Link href="/manuals/troubleshooting">
                                開く (Web)
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                {/* CSV Templates Section */}
                <Card className="flex flex-col hover:shadow-lg transition-shadow duration-200 md:col-span-2 lg:col-span-3 border-dashed border-2">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 rounded-full bg-primary/10 text-primary">
                                <Download className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">データ一括登録用 CSVテンプレート</CardTitle>
                                <CardDescription className="text-xs">各データ一括取り込み用のサンプル形式ファイルをダウンロードできます。</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-3 flex-wrap">
                            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={() => downloadCSVTemplate('customers')}>
                                <Download className="h-4 w-4 text-muted-foreground" /> 販売店情報テンプレート (.csv)
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={() => downloadCSVTemplate('staff')}>
                                <Download className="h-4 w-4 text-muted-foreground" /> スタッフ登録テンプレート (.csv)
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={() => downloadCSVTemplate('orders')}>
                                <Download className="h-4 w-4 text-muted-foreground" /> 受注データテンプレート (.csv)
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
