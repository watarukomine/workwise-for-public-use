'use client';

import React from 'react';
import Link from 'next/link';
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
    ShieldAlert,
    HelpCircle,
    Compass,
    LogOut,
    LogIn,
    Share2,
    CalendarCheck,
    BookmarkCheck
} from 'lucide-react';

export default function FieldStaffManualPage() {
    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl space-y-10">
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
                        PDF版をダウンロード
                    </a>
                </Button>
            </div>

            {/* 表紙・タイトルセクション */}
            <div className="border-b pb-6 space-y-3">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <Smartphone className="h-4 w-4" />
                    現場スタッフ向け操作ガイド (完全版)
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                    WorkWise 現場スタッフ操作マニュアル
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    WorkWiseへようこそ！本マニュアルは、現場スタッフの皆様がスマートフォンを使って朝の出勤から現場での作業報告、夕方の退勤まで、<strong>最初から順番に迷わず操作できるように分かりやすく解説したガイド</strong>です。
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="secondary" className="text-xs font-normal">📱 スマートフォン対応</Badge>
                    <Badge variant="secondary" className="text-xs font-normal">⏱️ 作業開始省略OK</Badge>
                    <Badge variant="secondary" className="text-xs font-normal">🚗 同店舗複数台作業対応</Badge>
                    <Badge variant="secondary" className="text-xs font-normal">🛠️ 打刻修正モード搭載</Badge>
                </div>
            </div>

            {/* 目次クイックナビゲーション */}
            <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <BookmarkCheck className="h-4 w-4 text-blue-600" />
                        マニュアル目次
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <a href="#prep" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">1.</span> 事前準備（ログイン・ホーム画面追加）
                    </a>
                    <a href="#screens" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">2.</span> 画面の見方（予定確認・自分のタスク表示）
                    </a>
                    <a href="#flow" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">3.</span> 一日の基本業務フロー（STEP 1〜6）
                    </a>
                    <a href="#samestore" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">4.</span> 同一店舗で2台以上作業する場合
                    </a>
                    <a href="#correction" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">5.</span> 打刻を間違えた・忘れたときの修正方法
                    </a>
                    <a href="#emergency" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">6.</span> 緊急時の連絡方法
                    </a>
                    <a href="#qa" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5 sm:col-span-2">
                        <span className="font-bold text-foreground">7.</span> よくある質問と困ったときの対処法（Q&A）
                    </a>
                </CardContent>
            </Card>

            {/* 1. 事前準備 */}
            <section id="prep" className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                    <Badge className="bg-slate-800 text-white">第 1 章</Badge>
                    <h2 className="text-xl font-bold tracking-tight">事前準備（ログイン・ホーム画面追加）</h2>
                </div>

                <Card className="shadow-sm border-slate-200">
                    <CardContent className="pt-6 space-y-4 text-xs sm:text-sm">
                        <div className="space-y-3">
                            <div className="flex gap-3 items-start">
                                <span className="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">1</span>
                                <div>
                                    <p className="font-semibold text-foreground">ブラウザでURLにアクセスする</p>
                                    <p className="text-muted-foreground text-xs mt-0.5">
                                        スマートフォンのブラウザ（iPhoneならSafari、AndroidならChrome）を開き、管理者から配布されたURLにアクセスします。
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start">
                                <span className="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">2</span>
                                <div>
                                    <p className="font-semibold text-foreground">ログインする</p>
                                    <p className="text-muted-foreground text-xs mt-0.5">
                                        登録されたメールアドレスとパスワードを入力し、「ログイン」ボタンを押します。
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start">
                                <span className="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">3</span>
                                <div>
                                    <p className="font-semibold text-foreground">位置情報（GPS）の利用を許可する</p>
                                    <p className="text-muted-foreground text-xs mt-0.5">
                                        「位置情報の利用を許可しますか？」と表示されたら、必ず<strong>「許可」</strong>を選択してください。安全・正確な配車管理のため、ボタン押下時の位置情報が自動記録されます。
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ホーム画面追加のTIP */}
                        <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl space-y-1.5">
                            <div className="flex items-center gap-2 font-bold text-blue-800 dark:text-blue-300 text-xs">
                                <Share2 className="h-4 w-4" />
                                おすすめ：スマートフォンの「ホーム画面に追加」を行うと便利です！
                            </div>
                            <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                                ブラウザのメニュー（iPhoneは共有アイコン、Androidは右上の︙メニュー）から<strong>「ホーム画面に追加」</strong>を選択すると、スマホの画面に専用アイコンが配置され、通常のアプリと同じようにワンタップで起動できるようになります。
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 2. 画面の見方 */}
            <section id="screens" className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                    <Badge className="bg-slate-800 text-white">第 2 章</Badge>
                    <h2 className="text-xl font-bold tracking-tight">画面の見方（予定確認・自分のタスク表示）</h2>
                </div>

                <Card className="shadow-sm border-slate-200">
                    <CardContent className="pt-6 space-y-4 text-xs sm:text-sm">
                        <p className="text-muted-foreground leading-relaxed">
                            ログインすると、本日の業務スケジュール画面が表示されます。各案件カードには訪問先店舗名、予定時間、作業内容（タイヤサイズ・本数等）、特記事項が記載されています。
                        </p>

                        <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground flex items-center gap-1.5">
                                    <Smartphone className="h-4 w-4 text-blue-600" />
                                    「自分のタスクのみ表示」スイッチ
                                </span>
                                <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px]">おすすめ機能</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                画面上のスイッチをONにすると、<strong>他のスタッフの予定が隠れ、自分が担当する案件だけがスッキリ絞り込み表示</strong>されます。当日の予定を迷わず確認できます。
                            </p>
                            <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-lg border shadow-sm my-2">
                                <img
                                    src="/images/manual/mobile-my-tasks-view.png"
                                    alt="モバイル画面：自分のタスクのみ表示"
                                    className="w-full h-auto object-cover"
                                />
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            作業を行う案件のカードをタップすると、その案件の<strong>「チェックイン画面（ボタン操作画面）」</strong>へ移動します。
                        </p>
                    </CardContent>
                </Card>
            </section>

            {/* 3. 一日の基本業務フロー */}
            <section id="flow" className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-700 text-white">第 3 章</Badge>
                    <h2 className="text-xl font-bold tracking-tight">一日の基本業務フロー（最初から最後まで）</h2>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground">
                    日々の業務は、以下の <strong>STEP 1 〜 STEP 6</strong> の流れに沿って順番にボタンを押して報告します。
                </p>

                {/* ステップカード群 */}
                <div className="space-y-4">
                    {/* STEP 1: 朝の出勤 */}
                    <Card className="border-l-4 border-l-blue-600 shadow-sm">
                        <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Badge className="bg-blue-600 text-white">STEP 1</Badge>
                                    【朝】出勤する
                                </CardTitle>
                                <LogIn className="h-4 w-4 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-xs sm:text-sm space-y-1 text-muted-foreground">
                            <p>• 業務を開始する際、画面上部の <strong>「出勤」</strong> ボタンを一度だけ押します。</p>
                            <p>• ボタンが「出勤済」に変わり、管理者のタイムライン画面に出勤状況が即座に反映されます。</p>
                        </CardContent>
                    </Card>

                    {/* STEP 2: 現場へ出発 */}
                    <Card className="border-l-4 border-l-amber-500 shadow-sm">
                        <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Badge className="bg-amber-500 text-white">STEP 2</Badge>
                                    現場へ向けて出発する
                                </CardTitle>
                                <PlayCircle className="h-4 w-4 text-amber-500" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-xs sm:text-sm space-y-2 text-muted-foreground">
                            <p>• 向かう案件をタップしてチェックイン画面を開きます。</p>
                            <p>• 案件の依頼内容を確認したら <strong>「タスク確認」</strong> を押します（確認済みとして記録されます）。</p>
                            <p>• 車で現場へ向けて出発するタイミングで <strong>「移動開始」</strong> ボタンを押します（ステータスが「移動中」になります）。</p>
                        </CardContent>
                    </Card>

                    {/* STEP 3: 現場に到着 */}
                    <Card className="border-l-4 border-l-orange-500 shadow-sm">
                        <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Badge className="bg-orange-500 text-white">STEP 3</Badge>
                                    現場に到着する
                                </CardTitle>
                                <MapPin className="h-4 w-4 text-orange-500" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-xs sm:text-sm space-y-1 text-muted-foreground">
                            <p>• お客様先（販売店）に到着したら、車を停めて <strong>「現場到着」</strong> ボタンを押します。</p>
                            <p>• ステータスが「作業待ち」に変わり、現場への到着時刻が記録されます。</p>
                        </CardContent>
                    </Card>

                    {/* STEP 4: 作業開始 */}
                    <Card className="border-l-4 border-l-purple-600 shadow-sm">
                        <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Badge className="bg-purple-600 text-white">STEP 4</Badge>
                                    作業を開始する（★省略可能！）
                                </CardTitle>
                                <Clock className="h-4 w-4 text-purple-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-xs sm:text-sm space-y-2 text-muted-foreground">
                            <p>• 工具やタイヤの準備を終え、実際の作業に取り掛かるタイミングで <strong>「作業開始」</strong> ボタンを押します（ステータスが「作業中」になります）。</p>
                            
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-1">
                                <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    作業開始ボタンは押し忘れてもOK！（現場改善機能）
                                </p>
                                <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                                    作業開始を押し忘れて作業を始めてしまっても、<strong>作業終了後にそのまま「作業完了」を押せばOK</strong>です！現場到着から作業完了までの時間が自動で「作業所要時間」として記録されます。終了直前に「開始 ➡️ 完了」と連打しても、到着時刻から自動逆算され作業時間1分問題を防止します。
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* STEP 5: 作業完了 */}
                    <Card className="border-l-4 border-l-emerald-600 shadow-sm">
                        <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Badge className="bg-emerald-600 text-white">STEP 5</Badge>
                                    作業を完了する
                                </CardTitle>
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-xs sm:text-sm space-y-1 text-muted-foreground">
                            <p>• すべてのタイヤ作業・片付け・点検が終了したら、<strong>「作業完了」</strong> ボタンを押します。</p>
                            <p>• ステータスが「作業完了」となり、実作業時間が自動計算されてデータベースおよび日報スプレッドシートに記録されます。</p>
                        </CardContent>
                    </Card>

                    {/* STEP 6: 帰社・退勤 */}
                    <Card className="border-l-4 border-l-slate-700 shadow-sm">
                        <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Badge className="bg-slate-700 text-white">STEP 6</Badge>
                                    【夕方】帰社・退勤する
                                </CardTitle>
                                <LogOut className="h-4 w-4 text-slate-700" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-xs sm:text-sm space-y-2 text-muted-foreground">
                            <p>• 現場から母店へ戻る出発の際、<strong>「帰社」</strong> ボタンを押します。GPSから母店への推定到着時刻（ETA）が自動計算され、管理者に共有されます。</p>
                            <p>• 母店に戻り、一日のすべての業務が終了したら <strong>「退勤」</strong> ボタンを押します。ステータスが「退勤済」となり、一日の記録が完了します。</p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* 4. 同一店舗で2台以上連続で作業する場合 */}
            <section id="samestore" className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                    <Badge className="bg-blue-700 text-white">第 4 章</Badge>
                    <h2 className="text-xl font-bold tracking-tight">同一店舗で2台以上作業する場合</h2>
                </div>

                <Card className="shadow-sm border-blue-200 bg-blue-50/20">
                    <CardContent className="pt-6 space-y-4 text-xs sm:text-sm">
                        <p className="text-muted-foreground leading-relaxed">
                            同じ店舗で2台や3台の連続作業がある場合、移動がないため<strong>不要な「移動開始」「現場到着」ボタンが自動スキップ</strong>されます！
                        </p>

                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200">
                            <p className="font-bold text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5 mb-1">
                                <Car className="h-4 w-4" />
                                画面上部の進行バッジ表示
                            </p>
                            <p className="text-xs text-muted-foreground">
                                画面上部に <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold">🚗 同店舗での作業: 1台目 / 全2台 [現場到着済]</code> と表示され、同じ場所での作業であることが自動認識されます。
                            </p>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 pt-1">
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

                            <div className="space-y-3 justify-center flex flex-col text-xs">
                                <div className="p-3 rounded-lg border bg-white dark:bg-slate-900 border-slate-200">
                                    <p className="font-bold text-blue-600 mb-1">【方法A】1台ずつ順番に進める場合</p>
                                    <p className="text-muted-foreground leading-relaxed">
                                        <strong>「🚗 続けて○台目の作業へ進む」</strong> を押します。2台目の画面へ切り替わり、最初から「作業開始」または「作業完了」が押せます。
                                    </p>
                                </div>
                                <div className="p-3 rounded-lg border bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200">
                                    <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">【方法B】全台終わってからまとめて完了にする場合（✨おすすめ）</p>
                                    <p className="text-muted-foreground leading-relaxed">
                                        スマホを操作せずに2台まとめて作業を行い、全台終了後に <strong>「✨ この店舗の残り全件もまとめて作業完了にする」</strong> を押します。<br />
                                        <strong>【自動按分】</strong> 総作業時間を台数で等分（例: 計60分 ÷ 2台 = 各30分）して全データに自動記録されます！
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 5. 修正モード */}
            <section id="correction" className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                    <Badge className="bg-red-600 text-white">第 5 章</Badge>
                    <h2 className="text-xl font-bold tracking-tight">打刻を間違えた・忘れたときの修正方法（修正モード）</h2>
                </div>

                <Card className="shadow-sm border-red-200 bg-red-50/20">
                    <CardContent className="pt-6 space-y-4 text-xs sm:text-sm">
                        <p className="text-muted-foreground leading-relaxed">
                            「ボタンを押し忘れて後から記録したい」「打刻した時間を直したい」という場合も、簡単に修正できます。
                        </p>

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

                            <div className="space-y-2.5 justify-center flex flex-col text-xs">
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
            </section>

            {/* 6. 緊急時の連絡方法 */}
            <section id="emergency" className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                    <Badge className="bg-red-700 text-white">第 6 章</Badge>
                    <h2 className="text-xl font-bold tracking-tight">緊急時の連絡方法</h2>
                </div>

                <Card className="shadow-sm border-slate-200">
                    <CardContent className="pt-6 space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        <p>事故、車両トラブル、道路の激しい渋滞などが発生した場合は、緊急連絡機能を使って管理者に即座に通知できます。</p>
                        <div className="space-y-2">
                            <div className="flex gap-2 items-start">
                                <span className="font-bold text-foreground">• 送信手順:</span>
                                <span>チェックイン画面下部の「緊急連絡」欄に状況（例: 「首都高事故渋滞のため到着が約30分遅れます」）を入力し、赤色の<strong>「緊急連絡を送信」</strong>を押します。</span>
                            </div>
                            <div className="flex gap-2 items-start">
                                <span className="font-bold text-foreground">• 管理者返信:</span>
                                <span>管理者がメッセージを確認して返信すると、画面上に管理者からの返信内容が表示されます。</span>
                            </div>
                            <div className="flex gap-2 items-start">
                                <span className="font-bold text-foreground">• 解除:</span>
                                <span>トラブルが解決した場合、送信ボタン横の<strong>「解除」</strong>ボタンを押すと通常表示に戻せます。</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 7. よくある質問 (Q&A) */}
            <section id="qa" className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                    <Badge className="bg-slate-800 text-white">第 7 章</Badge>
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-blue-600" />
                        よくある質問と困ったときの対処法（Q&A）
                    </h2>
                </div>

                <div className="space-y-3">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-bold text-foreground">
                                Q. ボタンを押しても画面が切り替わらない・固まってしまった
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-xs text-muted-foreground">
                            <strong>A. ブラウザの再読み込み（リロード）を行ってください。</strong><br />
                            データはサーバーに安全に保存されているため、リロードしても消えません。電波の良い場所で再度お試しください。
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-bold text-foreground">
                                Q. ボタンがグレー（半透明）で押せない
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-xs text-muted-foreground">
                            <strong>A. 業務の流れ通りの順序でのみボタンが押せるようになっています。</strong><br />
                            （例: 移動開始を押す前は現場到着は押せません）。押し忘れて次のステップに進んでしまった場合は、画面右上の「修正モード」をONにするとすべてのボタンが押せるようになります。
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-bold text-foreground">
                                Q. 地下やトンネルなど、電波の悪い場所で作業するときは？
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-xs text-muted-foreground">
                            <strong>A. 作業終了後に電波の良い場所へ移動してから「修正モード」で実績時間を入力してください。</strong><br />
                            電波が届かない場所で無理にボタンを押す必要はありません。
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-bold text-foreground">
                                Q. ログイン画面に戻ってしまった
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-xs text-muted-foreground">
                            <strong>A. 通信切断やセッション切れの可能性があります。再度ログインしてください。</strong><br />
                            パスワードを忘れた場合は、管理者へパスワード再設定を依頼してください。
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* フッター */}
            <div className="text-center text-xs text-muted-foreground pt-4 pb-8 border-t">
                <p>トヨタモビリティパーツ株式会社 神奈川支社 営業総括室</p>
                <p className="mt-1 font-semibold text-slate-700 dark:text-slate-300">今日も一日、ご安全に！</p>
            </div>
        </div>
    );
}
