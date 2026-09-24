'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileText, Settings, Shield, Download, Smartphone, LayoutDashboard, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { downloadCSVTemplate } from '@/lib/templates';

export default function ManualsPage() {
    return (
        <div className="container mx-auto py-8 px-4 max-w-5xl space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-extrabold tracking-tight">マニュアル・ドキュメント</h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                    WorkWiseの利用方法や最新仕様に関するドキュメント一覧です。画面上で見られるWeb版とPDF版をご用意しています。
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* 現場スタッフマニュアル */}
                <Card className="flex flex-col hover:shadow-lg transition-shadow duration-200 border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700 w-fit">
                                <Smartphone className="h-6 w-6" />
                            </div>
                            <Badge className="bg-emerald-600 text-white text-[10px]">スマホ対応</Badge>
                        </div>
                        <CardTitle className="text-xl">現場スタッフ操作マニュアル</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                        <CardDescription className="text-xs leading-relaxed">
                            出勤から現場到着・直接完了、同店舗複数台作業、修正モードなど、スマートフォンの操作手順をスクショ付きで解説しています。
                        </CardDescription>
                        <div className="space-y-2 pt-2">
                            <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" size="sm">
                                <Link href="/manuals/field-staff">
                                    <BookOpen className="h-4 w-4" />
                                    開く (スクショ付きWeb版)
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="w-full text-xs text-muted-foreground gap-1.5" size="sm">
                                <a href="/FIELD_STAFF_MANUAL.pdf" target="_blank" rel="noopener noreferrer">
                                    <Download className="h-3.5 w-3.5" />
                                    PDF版をダウンロード
                                </a>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* ユーザー・管理者マニュアル */}
                <Card className="flex flex-col hover:shadow-lg transition-shadow duration-200 border-blue-200/80 bg-gradient-to-b from-white to-blue-50/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-3 rounded-2xl bg-blue-100 text-blue-700 w-fit">
                                <LayoutDashboard className="h-6 w-6" />
                            </div>
                            <Badge className="bg-blue-600 text-white text-[10px]">管理者向け</Badge>
                        </div>
                        <CardTitle className="text-xl">ユーザー操作マニュアル</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                        <CardDescription className="text-xs leading-relaxed">
                            タイムライン配車、拠点列の変更、スクロール固定、大画面表示、スタッフ管理の即時保存など、システム全体の機能を解説しています。
                        </CardDescription>
                        <div className="space-y-2 pt-2">
                            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-1.5" size="sm">
                                <Link href="/manuals/user-guide">
                                    <BookOpen className="h-4 w-4" />
                                    開く (スクショ付きWeb版)
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="w-full text-xs text-muted-foreground gap-1.5" size="sm">
                                <a href="/user_manual.pdf" target="_blank" rel="noopener noreferrer">
                                    <Download className="h-3.5 w-3.5" />
                                    PDF版をダウンロード
                                </a>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* エラー・トラブルシューティング */}
                <Card className="flex flex-col hover:shadow-lg transition-shadow duration-200 border-red-200/80 bg-gradient-to-b from-white to-red-50/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-3 rounded-2xl bg-red-100 text-red-700 w-fit">
                                <FileText className="h-6 w-6" />
                            </div>
                            <Badge variant="outline" className="text-red-600 border-red-200 text-[10px]">困ったとき</Badge>
                        </div>
                        <CardTitle className="text-xl">エラー・トラブルシューティング</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                        <CardDescription className="text-xs leading-relaxed">
                            通信エラー、権限エラー、スプレッドシート数式エラーの意味や、現場・管理で問題が発生した際の対処方法をまとめています。
                        </CardDescription>
                        <div className="pt-2">
                            <Button asChild className="w-full" variant="outline" size="sm">
                                <Link href="/manuals/troubleshooting" className="gap-1.5">
                                    <ExternalLink className="h-4 w-4" />
                                    開く (Web版)
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* システム仕様書 */}
                <Card className="flex flex-col hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="pb-3">
                        <div className="p-3 rounded-2xl bg-slate-100 text-slate-700 w-fit mb-2">
                            <Settings className="h-6 w-6" />
                        </div>
                        <CardTitle className="text-lg">システム仕様書</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                        <CardDescription className="text-xs leading-relaxed">
                            Firestoreデータ構造、API設計、GASバックアップ同期など、システムの技術的仕様の詳細ドキュメントです。
                        </CardDescription>
                        <Button asChild className="w-full mt-auto" variant="outline" size="sm">
                            <a href="/specifications.pdf" target="_blank" rel="noopener noreferrer" className="gap-1.5">
                                <Download className="h-3.5 w-3.5" />
                                開く (PDF)
                            </a>
                        </Button>
                    </CardContent>
                </Card>

                {/* セキュリティルール仕様書 */}
                <Card className="flex flex-col hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="pb-3">
                        <div className="p-3 rounded-2xl bg-purple-100 text-purple-700 w-fit mb-2">
                            <Shield className="h-6 w-6" />
                        </div>
                        <CardTitle className="text-lg">セキュリティルール仕様書</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                        <CardDescription className="text-xs leading-relaxed">
                            データベースのロール別アクセス権限や情報セキュリティの設定に関する詳細ドキュメントです。
                        </CardDescription>
                        <Button asChild className="w-full mt-auto" variant="outline" size="sm">
                            <a href="/security_rules.pdf" target="_blank" rel="noopener noreferrer" className="gap-1.5">
                                <Download className="h-3.5 w-3.5" />
                                開く (PDF)
                            </a>
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
