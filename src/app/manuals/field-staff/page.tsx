'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    Download,
    CheckCircle2,
    Clock,
    MapPin,
    PlayCircle,
    Building,
    RotateCcw,
    AlertTriangle,
    Car,
    Smartphone,
    Info,
    Sparkles,
    ShieldAlert
} from 'lucide-react';

export default function FieldStaffManualPage() {
    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl space-y-8">
            {/* ナビゲーションバー */}
            <div className="flex items-center justify-between">
                <Button asChild variant="ghost" className="pl-0 gap-2">
                    <Link href="/manuals">
                        <ArrowLeft className="h-4 w-4" />
                        マニュアル一覧に戻る
                    </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-2">
                    <a href="/FIELD_STAFF_MANUAL.pdf" target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                        PDFで保存
                    </a>
                </Button>
            </div>

            {/* タイトルセクション */}
            <div className="border-b pb-6">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
                    <Smartphone className="h-4 w-4" />
                    現場スタッフ向け操作ガイド
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                    WorkWise 現場スタッフ操作マニュアル
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-2">
                    スマートフォンの画面からボタンを押すだけで、現場の進捗が管理者にリアルタイム共有されます。<br />
                    新機能（現場到着からの直接完了、同店舗複数台作業、打刻修正モード等）の使い方を解説します。
                </p>
            </div>

            {/* 1. 業務開始 */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-blue-600 text-white">STEP 1</Badge>
                        <CardTitle className="text-xl">業務開始（ログイン・出勤・予定確認）</CardTitle>
                    </div>
                    <CardDescription>
                        業務を始める前の基本操作と、当日の担当案件の確認方法です。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <div className="flex gap-3 items-start">
                            <span className="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">1</span>
                            <div>
                                <p className="font-semibold text-sm">ログイン</p>
                                <p className="text-xs text-muted-foreground">配布されたURLにアクセスし、登録メールアドレスとパスワードでログインします。</p>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start">
                            <span className="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">2</span>
                            <div>
                                <p className="font-semibold text-sm">「出勤」ボタンを押す</p>
                                <p className="text-xs text-muted-foreground">画面上部の「出勤」をタップします。管理者側のタイムラインに出勤状況が即時反映されます。</p>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start">
                            <span className="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">3</span>
                            <div>
                                <p className="font-semibold text-sm flex items-center gap-1.5">
                                    今日の予定を確認（★新機能：「自分のタスクのみ表示」）
                                    <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">新機能</Badge>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    モバイル画面で「自分のタスクのみ表示」スイッチをONにすると、<strong>自分が担当する案件だけが素早く絞り込み表示</strong>されます。
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                            <Smartphone className="h-4 w-4 text-blue-500" />
                            画面イメージ：「自分のタスクのみ表示」スイッチ
                        </div>
                        <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-lg border shadow-sm">
                            <img
                                src="/images/manual/mobile-my-tasks-view.png"
                                alt="モバイル画面：自分のタスクのみ表示"
                                className="w-full h-auto object-cover"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. 現場へ向かう・作業する */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-600 text-white">STEP 2</Badge>
                        <CardTitle className="text-xl">現場へ向かう・作業する（基本フロー）</CardTitle>
                    </div>
                    <CardDescription>
                        案件ごとの進捗に合わせてボタンを押します。「作業開始」の省略も可能です！
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2.5 rounded-lg border bg-blue-50/50 border-blue-200">
                            <PlayCircle className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                            <span className="font-bold block">① 移動開始</span>
                            <span className="text-[10px] text-muted-foreground">現場へ向けて出発時</span>
                        </div>
                        <div className="p-2.5 rounded-lg border bg-amber-50/50 border-amber-200">
                            <MapPin className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                            <span className="font-bold block">② 現場到着</span>
                            <span className="text-[10px] text-muted-foreground">販売店に到着した時</span>
                        </div>
                        <div className="p-2.5 rounded-lg border bg-purple-50/50 border-purple-200">
                            <Clock className="h-5 w-5 mx-auto mb-1 text-purple-600" />
                            <span className="font-bold block">③ 作業開始</span>
                            <span className="text-[10px] text-muted-foreground text-emerald-600 font-semibold">（省略可能！）</span>
                        </div>
                        <div className="p-2.5 rounded-lg border bg-emerald-50/50 border-emerald-200">
                            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                            <span className="font-bold block">④ 作業完了</span>
                            <span className="text-[10px] text-muted-foreground">作業・片付け終了時</span>
                        </div>
                    </div>

                    {/* 重要改善アラート */}
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                            <Sparkles className="h-4 w-4" />
                            現場改善：現場到着から直接「作業完了」を押してもOK！
                        </div>
                        <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                            作業開始ボタンを押し忘れて作業を始めてしまった場合でも、<strong>そのまま作業終了後に「作業完了」ボタンを押せばOK</strong>です！<br />
                            現場到着時刻から作業完了時刻までの時間が、自動的に<strong>「作業所要時間」</strong>として計算され記録されます。<br />
                            （※終了直前に慌てて「開始 ➡️ 完了」を連打した場合でも、自動的に到着時刻から所要時間を逆算し、作業時間1分問題を防止します。）
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* 3. 同店舗・複数台連続作業 */}
            <Card className="shadow-sm border-blue-200 bg-blue-50/20">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-blue-700 text-white">★新機能</Badge>
                        <CardTitle className="text-xl">同店舗で2台以上連続で作業する場合</CardTitle>
                    </div>
                    <CardDescription>
                        同じ店舗での作業は、不要な移動・到着打刻が完全スキップされます！
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                            <Car className="h-4 w-4 text-blue-600" />
                            画面上部の進行バッジ
                        </div>
                        <p className="text-muted-foreground">
                            画面上部に <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold">🚗 同店舗での作業: 1台目 / 全2台 [現場到着済]</code> のように何台目かが表示されます。2台目以降は「移動開始」「現場到着」を押す必要がありません。
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                1台目完了時の選択画面：
                            </p>
                            <div className="relative w-full max-w-xs mx-auto overflow-hidden rounded-lg border shadow-sm">
                                <img
                                    src="/images/manual/checkin-same-store-dialog.jpg"
                                    alt="同店舗の次の作業を選択ダイアログ"
                                    className="w-full h-auto object-cover"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 text-xs justify-center flex flex-col">
                            <div className="p-3 rounded-lg border bg-white dark:bg-slate-900 border-slate-200">
                                <p className="font-bold text-blue-600 mb-1">パターンA：1台ずつ進める場合</p>
                                <p className="text-muted-foreground leading-relaxed">
                                    <strong>「🚗 続けて○台目の作業へ進む」</strong> をタップします。次の車両の画面に切り替わり、最初から「作業開始」または「作業完了」が押せます。
                                </p>
                            </div>
                            <div className="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200">
                                <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">パターンB：まとめて作業完了にする場合（✨おすすめ）</p>
                                <p className="text-muted-foreground leading-relaxed">
                                    スマホを操作せずに2台まとめて作業を行い、全台終了後に <strong>「✨ この店舗の残り全件もまとめて作業完了にする」</strong> をタップします。<br />
                                    <strong>【均等按分】</strong> 総作業時間を台数で等分（例: 60分 ÷ 2台 = 各30分）して全データに自動記録されます！
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 4. 修正モード */}
            <Card className="shadow-sm border-red-200 bg-red-50/20">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-red-600 text-white">打刻修正</Badge>
                        <CardTitle className="text-xl">打刻時間の修正（修正モードの大幅進化）</CardTitle>
                    </div>
                    <CardDescription>
                        作業完了後であっても、すべてのボタンの打刻時刻を自由に修正できます！
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="relative w-full max-w-xs mx-auto overflow-hidden rounded-lg border shadow-sm">
                                <img
                                    src="/images/manual/checkin-correction-mode.jpg"
                                    alt="修正モード画面（全ボタン活性化）"
                                    className="w-full h-auto object-cover"
                                />
                            </div>
                            <p className="text-[11px] text-center text-muted-foreground">
                                修正モード時は全ボタンが濃い赤枠で押せる状態になります
                            </p>
                        </div>

                        <div className="space-y-3 text-xs justify-center flex flex-col">
                            <div className="flex gap-2.5 items-start">
                                <span className="flex-none flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">1</span>
                                <div>
                                    <p className="font-bold text-foreground">修正モードをONにする</p>
                                    <p className="text-muted-foreground">画面右上の「修正」スイッチをONにします。</p>
                                </div>
                            </div>
                            <div className="flex gap-2.5 items-start">
                                <span className="flex-none flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">2</span>
                                <div>
                                    <p className="font-bold text-foreground">修正したいボタンをタップ</p>
                                    <p className="text-muted-foreground">完了済みのタスクでも「現場到着」「作業開始」など全ボタンが押せます。</p>
                                </div>
                            </div>
                            <div className="flex gap-2.5 items-start">
                                <span className="flex-none flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">3</span>
                                <div>
                                    <p className="font-bold text-foreground">既存時刻が自動入力される</p>
                                    <p className="text-muted-foreground">すでに記録されている時刻が初期値として入るため、「5分ずらす」等の微調整が簡単です。</p>
                                </div>
                            </div>
                            <div className="flex gap-2.5 items-start">
                                <span className="flex-none flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">4</span>
                                <div>
                                    <p className="font-bold text-foreground">安全仕様（ステータス保護）</p>
                                    <p className="text-muted-foreground">完了済みタスクの過去時刻を直しても、タスクが「作業中」に戻ることはなく、作業時間のみが正しく再計算されます。</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 5. 緊急連絡と退勤 */}
            <div className="grid sm:grid-cols-2 gap-4">
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-red-500" />
                            <CardTitle className="text-base">緊急時の連絡</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2 text-muted-foreground">
                        <p>事故・車両故障・渋滞などのトラブル時は、画面下の「緊急連絡」欄に状況を入力し、<strong>「緊急連絡を送信」</strong>を押します。</p>
                        <p>管理者の画面に赤い通知バナーが表示され、管理者からの返信も画面上に届きます。状況解決後は「解除」を押せます。</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-blue-500" />
                            <CardTitle className="text-base">帰社・退勤</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2 text-muted-foreground">
                        <p>現場から母店へ戻る際は<strong>「帰社」</strong>を押します。GPSから母店への推定到着時刻（ETA）が自動計算されます。</p>
                        <p>一日の業務終了時は<strong>「退勤」</strong>ボタンを押してください。ステータスが「退勤済」となり記録が完了します。</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
