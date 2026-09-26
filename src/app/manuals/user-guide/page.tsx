'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    Download,
    LayoutDashboard,
    Maximize2,
    Pin,
    Building2,
    Users,
    Smartphone,
    Layers,
    SlidersHorizontal,
    Sparkles,
    Calendar,
    Clock,
    FileText,
    MoveRight,
    CheckCircle2,
    HelpCircle,
    Info,
    CalendarCheck,
    BookmarkCheck
} from 'lucide-react';

export default function UserGuidePage() {
    return (
        <div className="container mx-auto py-8 px-4 max-w-5xl space-y-10">
            {/* ナビゲーションバー */}
            <div className="flex items-center justify-between">
                <Button asChild variant="ghost" className="pl-0 gap-2">
                    <Link href="/manuals">
                        <ArrowLeft className="h-4 w-4" />
                        マニュアル一覧に戻る
                    </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-2">
                    <a href="/user_manual.pdf" target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                        PDFで保存
                    </a>
                </Button>
            </div>

            {/* 表紙・タイトルセクション */}
            <div className="border-b pb-6 space-y-3">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <LayoutDashboard className="h-4 w-4" />
                    管理者・配車担当向け 総合操作ガイド
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                    WorkWise ユーザー総合操作マニュアル
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    本マニュアルは、管理者や配車担当者の皆様がWorkWiseを使って、<strong>「注文の受付・登録」から「未割当タスクの確認」「タイムラインへの配車（ドラッグ＆ドロップ）」「突発応援時の1日限定拠点変更」まで、最初から順番に迷わず操作できるように解説した完全版ガイド</strong>です。
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="secondary" className="text-xs font-normal">🖥️ PC・タブレット対応</Badge>
                    <Badge variant="secondary" className="text-xs font-normal">⏱️ 終了予定時刻・所要時間連動</Badge>
                    <Badge variant="secondary" className="text-xs font-normal">📏 1時間縦目盛り線 (10:00〜17:00)</Badge>
                    <Badge variant="secondary" className="text-xs font-normal">🏢 1日限定の拠点（母店）変更機能</Badge>
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
                    <a href="#section-1" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">1.</span> ダッシュボードの全体画面と見方
                    </a>
                    <a href="#section-2" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">2.</span> 受注フォームからの注文登録手順
                    </a>
                    <a href="#section-3" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">3.</span> 未割当プールと動的チップ幅の確認
                    </a>
                    <a href="#section-4" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">4.</span> タイムラインへの配車（ドラッグ＆ドロップ）
                    </a>
                    <a href="#section-5" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">5.</span> 突発応援時の「1日限定」拠点変更
                    </a>
                    <a href="#section-6" className="p-1.5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <span className="font-bold text-foreground">6.</span> その他の便利機能（固定ヘッダー・全幅表示）
                    </a>
                </CardContent>
            </Card>

            {/* 第1章: ダッシュボード全体画面と見方 */}
            <section id="section-1" className="space-y-4 pt-2">
                <div className="flex items-center gap-2 border-l-4 border-blue-600 pl-3">
                    <h2 className="text-xl sm:text-2xl font-bold">1. ダッシュボードの全体画面と見方</h2>
                </div>
                <Card className="shadow-xs border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">配車管理の中心となるダッシュボード画面</CardTitle>
                        <CardDescription>
                            ログイン後に表示されるメイン画面です。当日のスケジュール、スタッフの配置、未割当の注文が一目で確認できます。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
                            <img
                                src="/images/manual/pc-1-dashboard-overview.png"
                                alt="ダッシュボード全体画面"
                                className="w-full h-auto object-cover"
                            />
                            <div className="p-2.5 text-xs text-muted-foreground text-center bg-slate-100 dark:bg-slate-800 border-t">
                                【PC-1】ダッシュボード全体画面（上部バー・未割当プール・タイムライン）
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-3 pt-2">
                            <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 space-y-1">
                                <div className="font-bold text-blue-900 text-xs flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                                    ① 日付操作バー
                                </div>
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    左右の矢印やカレンダーボタンで日付を自由に切り替えます。「今日」を押すと瞬時に当日に戻ります。
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-1">
                                <div className="font-bold text-indigo-900 text-xs flex items-center gap-1">
                                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                                    ② 本日の受注タスク（未割当）
                                </div>
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    まだスタッフに割り当てられていない注文がチップとして並びます。青色のチップをドラッグして配車します。
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100 space-y-1">
                                <div className="font-bold text-emerald-900 text-xs flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5 text-emerald-600" />
                                    ③ タイムライン
                                </div>
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    スタッフごとの1日のスケジュール（9:00〜19:00）を表示します。10:00〜17:00には縦目盛り線が引かれています。
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 第2章: 受注フォームからの注文登録手順 */}
            <section id="section-2" className="space-y-4 pt-4">
                <div className="flex items-center gap-2 border-l-4 border-blue-600 pl-3">
                    <h2 className="text-xl sm:text-2xl font-bold">2. 受注フォームからの注文登録手順</h2>
                </div>
                <Card className="shadow-xs border-slate-200">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Badge className="bg-blue-600 text-white text-xs">新機能</Badge>
                            <CardTitle className="text-lg">タイヤ作業 ご注文フォーム (`/order-form`)</CardTitle>
                        </div>
                        <CardDescription>
                            販売店様からの依頼や電話受付の注文を入力します。ダッシュボード上部の「フォームを開く」ボタンからワンクリックで開けます。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
                            <img
                                src="/images/manual/pc-3-order-form.png"
                                alt="タイヤ作業 ご注文フォーム画面"
                                className="w-full h-auto object-cover"
                            />
                            <div className="p-2.5 text-xs text-muted-foreground text-center bg-slate-100 dark:bg-slate-800 border-t">
                                【PC-3】受注フォーム画面（予定開始時間と予定終了時間の入力欄）
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 space-y-3">
                            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                入力の手順とポイント
                            </h4>
                            <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                <li>
                                    <strong>ユーザーコード（5桁）</strong>：販売店コードを入力すると、店舗名が自動補完されます。
                                </li>
                                <li>
                                    <strong>作業区分・フォーム入力者</strong>：該当する作業区分（販売店店舗内作業など）と入力者名を選択・入力します。
                                </li>
                                <li>
                                    <strong>作業予定日・予定開始時間</strong>：作業予定の日付と、開始予定時刻（例: <code>13:30</code>）を入力します。
                                </li>
                                <li>
                                    <strong className="text-blue-600 dark:text-blue-400">★ 予定終了時間（任意 / 新機能）</strong>：
                                    作業の終了予定時刻（例: <code>15:00</code>）を入力します。
                                    <div className="mt-1 p-2 bg-blue-50 dark:bg-blue-950/40 rounded border border-blue-200 text-xs text-blue-900 dark:text-blue-300">
                                        💡 <strong>自動計算の仕組み</strong>:
                                        開始「13:30」・終了「15:00」と入力すると、システムが自動的に<strong>「所要時間90分」</strong>と判定し、タイムラインにも正確な90分の幅でチップが作られます。<br />
                                        ※終了予定時間を空欄のまま送信した場合は、従来通り自動的に「1時間（60分）枠」として登録されます。
                                    </div>
                                </li>
                                <li>
                                    <strong>車両・タイヤ情報</strong>：車名、登録ナンバー（下4桁）、タイヤサイズ・本数を入力し、「送信」ボタンを押します。
                                </li>
                            </ol>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 第3章: 未割当プールと動的チップ幅の確認 */}
            <section id="section-3" className="space-y-4 pt-4">
                <div className="flex items-center gap-2 border-l-4 border-blue-600 pl-3">
                    <h2 className="text-xl sm:text-2xl font-bold">3. 未割当プールと動的チップ幅の確認</h2>
                </div>
                <Card className="shadow-xs border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">所要時間に連動した「未割当タスクチップ」</CardTitle>
                        <CardDescription>
                            フォームから送信された注文は、即座にダッシュボード左上の「本日の受注タスク」エリアに青いチップとして届きます。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
                            <img
                                src="/images/manual/pc-4-unassigned-pool.png"
                                alt="未割当タスクプール"
                                className="w-full h-auto object-cover"
                            />
                            <div className="p-2.5 text-xs text-muted-foreground text-center bg-slate-100 dark:bg-slate-800 border-t">
                                【PC-4】未割当タスクプール（90分枠と60分枠のチップ幅の違いが視覚的に一目で分かります）
                            </div>
                        </div>

                        <div className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                            <p>
                                • <strong>チップの幅（長さ）</strong>：終了予定時刻から算出された所要時間に応じて、チップ自体の横幅が自動的に伸縮します（上記画像では、左の90分枠が、右の60分枠よりも横長に表示されています）。
                            </p>
                            <p>
                                • <strong>時間帯の明記</strong>：チップ上に「13:30-15:00」のように開始〜終了の予定時刻が明確に印字されるため、配車前に作業時間枠を確認できます。
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 第4章: タイムラインへの配車（ドラッグ＆ドロップ） */}
            <section id="section-4" className="space-y-4 pt-4">
                <div className="flex items-center gap-2 border-l-4 border-blue-600 pl-3">
                    <h2 className="text-xl sm:text-2xl font-bold">4. タイムラインへの配車（ドラッグ＆ドロップ）</h2>
                </div>
                <Card className="shadow-xs border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">直感的なマウスドラッグによる配車操作</CardTitle>
                        <CardDescription>
                            未割当プールにあるチップを、担当させたいスタッフの行へドラッグ＆ドロップするだけで配車が完了します。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
                            <img
                                src="/images/manual/pc-5-timeline-assigned-chips.png"
                                alt="タイムラインへのチップ配置状態"
                                className="w-full h-auto object-cover"
                            />
                            <div className="p-2.5 text-xs text-muted-foreground text-center bg-slate-100 dark:bg-slate-800 border-t">
                                【PC-5】タイムラインへのチップ配置状態（移動時間チップの自動生成と正確な時間枠配置）
                            </div>
                        </div>

                        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                            <div className="flex items-start gap-2">
                                <div className="p-1 rounded bg-blue-100 text-blue-700 font-bold shrink-0 text-xs">STEP 1</div>
                                <p>
                                    未割当プールのチップをクリックしたまま、担当スタッフの行の希望時間（例: 13:30）へドラッグします。
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="p-1 rounded bg-blue-100 text-blue-700 font-bold shrink-0 text-xs">STEP 2</div>
                                <p>
                                    ドロップすると、作業チップの手前に<strong>自動的に「移動（30分）」チップが生成</strong>され、作業チップも<strong>フォームで指定した正確な枠（例: 13:30〜15:00の90分枠）</strong>でタイムラインに配置されます。
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="p-1 rounded bg-blue-100 text-blue-700 font-bold shrink-0 text-xs">STEP 3</div>
                                <p>
                                    配置した瞬間、バックエンドデータベース（Firestore）およびバックアップ用スプレッドシート（受注管理WW3）へ<strong>きれいに1行のみ自動同期</strong>され、重複なく保存されます。
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 第5章: 突発応援時の「1日限定」拠点変更 */}
            <section id="section-5" className="space-y-4 pt-4">
                <div className="flex items-center gap-2 border-l-4 border-blue-600 pl-3">
                    <h2 className="text-xl sm:text-2xl font-bold">5. 突発応援時の「1日限定」拠点変更</h2>
                </div>
                <Card className="shadow-xs border-slate-200">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-600 text-white text-xs">新仕様</Badge>
                            <CardTitle className="text-lg">スタッフ名横の「拠点」プルダウン即時切替</CardTitle>
                        </div>
                        <CardDescription>
                            「急遽、本日だけ厚木店のスタッフを横浜店に応援に行かせたい」といった突発的な他店舗常駐・応援にその場で対応できます。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
                            <img
                                src="/images/manual/pc-2-timeline-store-dropdown.png"
                                alt="タイムライン拠点列とプルダウンメニュー"
                                className="w-full h-auto object-cover"
                            />
                            <div className="p-2.5 text-xs text-muted-foreground text-center bg-slate-100 dark:bg-slate-800 border-t">
                                【PC-2】タイムラインの拠点列（プルダウンで各店舗を即時選択可能）
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 space-y-3">
                            <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-300 flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-emerald-600" />
                                1日限定オーバーライドの安心設計
                            </h4>
                            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                <li>
                                    • <strong>基本母店は保護</strong>：スタッフマスタに登録されている本来の母店（厚木店など）は書き換わりません。
                                </li>
                                <li>
                                    • <strong>その日限定で保持</strong>：表示中の日付（例: 9月5日）でプルダウンを「横浜店」に変更すると、9月5日限定で横浜店として保存され、スタッフ行の背景色も横浜店カラーに即座に切り替わります。
                                </li>
                                <li>
                                    • <strong>日付が変われば自動復帰</strong>：翌日（9月6日）に日付を切り替えると、自動的に本来の母店（厚木店）に戻って表示されます。再び9月5日に戻れば、設定した「横浜店」がそのまま保持されています。
                                </li>
                                <li>
                                    • <strong>応援履歴が蓄積</strong>：過去の応援実績がすべてデータベースに蓄積されるため、「この日誰がどこの店舗に応援に行っていたか」が過去を振り返った際にも完全に再現され、将来の応援回数集計にも活用できます。
                                </li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 第6章: その他の便利機能 */}
            <section id="section-6" className="space-y-4 pt-4">
                <div className="flex items-center gap-2 border-l-4 border-blue-600 pl-3">
                    <h2 className="text-xl sm:text-2xl font-bold">6. その他の便利機能</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    {/* ヘッダー常時固定 */}
                    <Card className="shadow-xs border-slate-200">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Pin className="h-4 w-4 text-purple-600" />
                                <CardTitle className="text-base">ヘッダー行常時固定（Sticky追従）</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                スタッフ数が多い場合でも、縦スクロール時に「スタッフ名・拠点・9:00〜19:00目盛り・ステータス」のヘッダーが画面上辺にピタッと吸着固定されます。下方のスタッフでも時間帯を見失いません。
                            </p>
                            <div className="rounded-lg overflow-hidden border shadow-xs">
                                <img
                                    src="/images/manual/timeline-header-sticky.png"
                                    alt="タイムラインヘッダー固定"
                                    className="w-full h-auto object-cover"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* 大画面全幅拡大 */}
                    <Card className="shadow-xs border-slate-200">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Maximize2 className="h-4 w-4 text-blue-600" />
                                <CardTitle className="text-base">大画面モニターでの全幅拡大</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                ワイドモニターや高解像度ディスプレイでも右端に不自然な余白が出ず、画面幅いっぱいにタイムラインが均等拡大されます。事務所の大画面テレビ等での常時監視にも最適です。
                            </p>
                            <div className="rounded-lg overflow-hidden border shadow-xs">
                                <img
                                    src="/images/manual/timeline-responsive-fullscreen.png"
                                    alt="全幅拡大表示"
                                    className="w-full h-auto object-cover"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    );
}
