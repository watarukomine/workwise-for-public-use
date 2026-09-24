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
    Sparkles
} from 'lucide-react';

export default function UserGuidePage() {
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
                    <a href="/user_manual.pdf" target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                        PDFで保存
                    </a>
                </Button>
            </div>

            {/* タイトルセクション */}
            <div className="border-b pb-6">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
                    <LayoutDashboard className="h-4 w-4" />
                    管理者・配車担当向け操作ガイド
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                    WorkWise ユーザー操作ガイド (最新機能まとめ)
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-2">
                    ダッシュボード（タイムライン配車）、拠点管理、スタッフ設定の最新改善について、スクリーンショット付きで解説します。
                </p>
            </div>

            {/* 1. 拠点（母店）列の新設＆即時変更 */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-blue-600 text-white">新機能</Badge>
                        <CardTitle className="text-xl">タイムライン画面：「拠点（母店）」列の新設と即時変更</CardTitle>
                    </div>
                    <CardDescription>
                        タイムライン上で各スタッフの母店を一目で把握でき、急な応援や常駐先変更もその場で切り替え可能になりました。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        <p>
                            • <strong>スタッフ名横に「拠点」プルダウン列（幅95px）を新設</strong>：タイムライン上でスタッフが所属する母店（横浜店、横須賀店、東名川崎店、相模原店、厚木店、綾瀬店、小田原店）を確認できます。
                        </p>
                        <p>
                            • <strong>プルダウン即時変更</strong>：プルダウンから別の店舗を選択した瞬間、Firestoreデータベースが即座に更新され、行の背景色（店舗カラー）も切り替わります。スタッフ管理画面とも完全自動同期します。
                        </p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 space-y-2">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-blue-500" />
                            画面イメージ：スタッフ名横の拠点列と9:00〜19:00の時間軸
                        </div>
                        <div className="relative w-full overflow-hidden rounded-lg border shadow-sm">
                            <img
                                src="/images/manual/timeline-scale-and-line.png"
                                alt="タイムラインの拠点列と時間軸"
                                className="w-full h-auto object-cover"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. スクロール時のヘッダー常時固定 */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-purple-600 text-white">操作性向上</Badge>
                        <CardTitle className="text-xl">縦スクロール時のヘッダー行常時固定（Sticky追従）</CardTitle>
                    </div>
                    <CardDescription>
                        スタッフ数が多い場合でも、上部の時間目盛りやヘッダーが常に画面上部に固定されます。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        <p>
                            • タイムラインを下にスクロールしても、<strong>「スタッフ・拠点・9:00〜19:00時間目盛り・ステータス」</strong>のヘッダー行が上辺にピッタリ吸着して追従します。
                        </p>
                        <p>
                            • 下方のスタッフのスケジュールを確認する際にも、何時の時間帯を見ているかがいつでも一目で把握できます。
                        </p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 space-y-2">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Pin className="h-4 w-4 text-purple-500" />
                            画面イメージ：スクロールしても固定表示されるヘッダー
                        </div>
                        <div className="relative w-full overflow-hidden rounded-lg border shadow-sm">
                            <img
                                src="/images/manual/timeline-header-sticky.png"
                                alt="タイムラインヘッダーの固定表示"
                                className="w-full h-auto object-cover"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 3. 大画面での全幅拡大 */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-600 text-white">表示改善</Badge>
                        <CardTitle className="text-xl">大画面ディスプレイでの全幅フレキシブル拡大</CardTitle>
                    </div>
                    <CardDescription>
                        ワイドモニターでも右端に余白や隙間ができず、画面幅いっぱいにタイムラインが拡大します。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        <p>
                            • ディスプレイの解像度やウィンドウ幅に合わせて、<strong>時間目盛り（9:00〜19:00）、タスクチップの長さ、右端のステータスカラム</strong>が均等・自動的に全幅拡大されます。
                        </p>
                        <p>
                            • 左端の「9:00」、右端の「19:00」の数字の見切れを解消し、ステータスカラム境界線の縦線の段差ズレも綺麗に補正されています。
                        </p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 space-y-2">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Maximize2 className="h-4 w-4 text-emerald-500" />
                            画面イメージ：大画面に全幅拡大されたタイムライン
                        </div>
                        <div className="relative w-full overflow-hidden rounded-lg border shadow-sm">
                            <img
                                src="/images/manual/timeline-responsive-fullscreen.png"
                                alt="タイムライン全幅拡大表示"
                                className="w-full h-auto object-cover"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 4. スタッフ管理の即時保存＆フィルター改善 */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-amber-600 text-white">設定改善</Badge>
                        <CardTitle className="text-xl">スタッフ管理（/staff）の即時自動保存＆連携強化</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    <p>
                        • <strong>チェック時の即時自動保存</strong>：スタッフ管理画面でタイムライン表示対象のチェックボックスをクリックした際、「選択を適用」ボタンを押さなくても、ブラウザのローカルストレージへ即時自動保存されます。
                    </p>
                    <p>
                        • <strong>管理者フィルター除外の防止</strong>：Demoアカウントや管理者ロール（<code>admin</code>）のスタッフにチェックを入れた場合、ダッシュボードの「管理・コントローラーを表示」スイッチがOFFであっても、<strong>手動選択したスタッフは最優先でタイムラインに確実に表示</strong>されます。
                    </p>
                </CardContent>
            </Card>

            {/* 5. 現場スタッフ側の新機能との連動 */}
            <Card className="shadow-sm border-blue-200 bg-blue-50/20">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-base sm:text-lg">現場機能との自動連動（管理者のメリット）</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    <p>
                        • <strong>作業時間の正確な自動集計</strong>：現場スタッフが作業開始を省略して直接「作業完了」を押した場合や、終了直前に連打した場合でも、システムが現場到着時刻から正確に所要時間を自動逆算するため、<strong>分析画面（/admin/analytics）やスプレッドシートの集計精度が大幅に向上</strong>しました。
                    </p>
                    <p>
                        • <strong>同店舗複数台作業の自動按分</strong>：同店舗で2台まとめて作業完了した場合、総作業時間が台数で等分されてFirestoreおよびスプレッドシートに均等入力されます。
                    </p>
                    <p>
                        • <strong>打刻修正時のステータス保護</strong>：スタッフが後から打刻時刻を修正した場合でも、完了済みステータスやスタッフの現在位置が乱れることなく安全に反映されます。
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
