'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function TroubleshootingPage() {
    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="mb-6">
                <Button asChild variant="ghost" className="pl-0 gap-2">
                    <Link href="/manuals">
                        <ArrowLeft className="h-4 w-4" />
                        マニュアル一覧に戻る
                    </Link>
                </Button>
            </div>

            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">エラーとトラブルシューティング (データベース版)</h1>
                <p className="text-muted-foreground">
                    WorkWise データベース版（Firebase Firestore）で発生する可能性のあるエラーメッセージ、その原因、および対処方法をまとめています。
                </p>
            </div>

            <div className="space-y-8">
                {/* データベース・通信エラー */}
                <Card>
                    <CardHeader>
                        <CardTitle>データベース・通信エラー</CardTitle>
                        <CardDescription>
                            Firebase (Firestore / Authentication) とのリアルタイム通信に関連するエラーです。
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30%]">エラーメッセージ / 現象</TableHead>
                                    <TableHead className="w-[30%]">考えられる原因</TableHead>
                                    <TableHead className="w-[40%]">対処方法</TableHead>
                                    </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">データ取得エラー / Failed to get orders</TableCell>
                                    <TableCell>端末のオフライン状態、またはFirestoreのセキュリティルール・認証セッション切れ。</TableCell>
                                    <TableCell>ネットワーク接続を確認し、ページをリロードしてください。改善しない場合は再ログインをお試しください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Missing or insufficient permissions (権限エラー)</TableCell>
                                    <TableCell>ログイン中のユーザーのロール（管理者/スタッフ）に必要なアクセス権が付与されていません。</TableCell>
                                    <TableCell>システム管理者に連絡し、スタッフマスタまたはFirestore上の `role` 設定（`admin`）を確認・更新してもらってください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Client is offline / ネットワーク接続エラー</TableCell>
                                    <TableCell>インターネット接続が切断されているか、電波が不安定です。</TableCell>
                                    <TableCell>電波の良好な環境に移動し、接続が復旧したことを確認した上で操作を再試行してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Quota exceeded (クォータ超過)</TableCell>
                                    <TableCell>FirebaseまたはGoogle Cloud APIの一時的なリクエスト上限に達しました。</TableCell>
                                    <TableCell>しばらく時間を置いてから再度アクセスしてください。頻発する場合は管理者にクォータ引き上げを依頼してください。</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* 操作・入力・インライン編集エラー */}
                <Card>
                    <CardHeader>
                        <CardTitle>操作・入力・インライン編集エラー</CardTitle>
                        <CardDescription>
                            スケジュールの変更、セル直接編集、勤怠打刻、新規登録フォームで発生するエラーです。
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30%]">エラーメッセージ</TableHead>
                                    <TableHead className="w-[30%]">考えられる原因</TableHead>
                                    <TableHead className="w-[40%]">対処方法</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">データの更新に失敗しました</TableCell>
                                    <TableCell>インライン編集時のネットワーク切断、または他ユーザーによる同時削除など。</TableCell>
                                    <TableCell>ページを再読み込みして最新データを表示し、再度セルを編集してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">担当スタッフが見つかりません</TableCell>
                                    <TableCell>指定されたスタッフがデータベースに存在しないか、無効化されています。</TableCell>
                                    <TableCell>スタッフ管理画面で該当スタッフが正しく登録されているか確認してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">無効な時間形式です</TableCell>
                                    <TableCell>時間入力形式が「HH:MM」の形式に合致していません。</TableCell>
                                    <TableCell>半角数字で「09:30」「14:00」のように入力してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">出勤 / 退勤打刻に失敗しました</TableCell>
                                    <TableCell>位置情報の取得拒否、または通信エラー。</TableCell>
                                    <TableCell>ブラウザの位置情報（GPS）権限を許可し、電波の良い場所で再度打刻ボタンを押してください。</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* CSV / Excel インポートエラー */}
                <Card>
                    <CardHeader>
                        <CardTitle>CSV / Excel インポートエラー</CardTitle>
                        <CardDescription>
                            データ一括インポート画面（`/import`）やシフト取り込みで発生するエラーです。
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30%]">エラーメッセージ</TableHead>
                                    <TableHead className="w-[30%]">考えられる原因</TableHead>
                                    <TableHead className="w-[40%]">対処方法</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">ファイル形式エラー / 解析できません</TableCell>
                                    <TableCell>破損したファイル、または対応外のフォーマットが指定されています。</TableCell>
                                    <TableCell>標準的な `.csv` または `.xlsx` ファイルを使用してください。文字コードは UTF-8 を推奨します。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">必須ヘッダーが見つかりません</TableCell>
                                    <TableCell>CSV/Excelの列名がテンプレートと異なっています。</TableCell>
                                    <TableCell>マニュアル画面から「CSVテンプレート」をダウンロードし、列名を合わせた上で再度アップロードしてください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">ジオコーディング失敗（位置情報取得不可）</TableCell>
                                    <TableCell>住所の表記が不正（存在しない地名や番地の欠損）です。</TableCell>
                                    <TableCell>住所が都道府県から正しく記載されているか確認してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">スタッフ名のマッチングに失敗しました</TableCell>
                                    <TableCell>インポートデータ内の氏名と登録済みスタッフマスタの表記（姓名間のスペース等）に差異があります。</TableCell>
                                    <TableCell>スタッフマスタの登録名とファイル内の氏名を一致させてください。</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* スプレッドシート連携・自動バックアップ */}
                <Card>
                    <CardHeader>
                        <CardTitle>スプレッドシート連携・自動バックアップトラブル</CardTitle>
                        <CardDescription>
                            Googleスプレッドシート（受注管理・汎用行動予定シート）への自動同期・数式に関連するエラーです。
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30%]">現象 / エラーメッセージ</TableHead>
                                    <TableHead className="w-[30%]">考えられる原因</TableHead>
                                    <TableHead className="w-[40%]">対処方法</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">受注Noや主管店舗・機材有無の数式がエラーになる（#REF!）</TableCell>
                                    <TableCell>3行目以降のセル（A列、E列、F列）に値が直接書き込まれ、2行目のARRAYFORMULA自動展開がブロックされています。</TableCell>
                                    <TableCell>3行目以降のA列・E列・F列の値を消去（クリア）してください。またはGASエディタで `repairAndCleanOrderSheet` 関数を実行してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">汎用チップ（移動・休憩等）が受注管理シートに出てくる</TableCell>
                                    <TableCell>古い同期スクリプトやタスク型判定の不一致。</TableCell>
                                    <TableCell>受注管理シート上の該当タスク行を削除してください。最新のバックアップスクリプトでは汎用行動予定シートへ自動分別されます。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">AR列の緊急フラグに「FALSE」が表示される</TableCell>
                                    <TableCell>インポートデータ由来の文字列 `"FALSE"` が反映されていたため。</TableCell>
                                    <TableCell>最新版 `Backup.gs` を実行すると、通常時のセルはすべて自動的に綺麗な空欄（ブランク）に更新されます。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Specified permissions are not sufficient (GASエラー)</TableCell>
                                    <TableCell>スクリプトからのトリガー自動作成権限（`scriptapp`）が未承認です。</TableCell>
                                    <TableCell>GASエディタ左メニューの「⏰ トリガー」から手動で10分おきトリガー（関数: `runFirestoreBackup`）を追加してください。</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* 表示・ブラウザ環境 */}
                <Card>
                    <CardHeader>
                        <CardTitle>表示・ブラウザ環境トラブル</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30%]">現象</TableHead>
                                    <TableHead className="w-[70%]">対処方法</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">画面が更新されない / 古い情報が表示される</TableCell>
                                    <TableCell>
                                        ブラウザのハード再読み込み（Ctrl + F5 または Shift + Command + R）を実行するか、キャッシュをクリアしてください。
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">地図（Google Maps）が表示されない</TableCell>
                                    <TableCell>
                                        ネットワーク制限（プロキシ等）でGoogle Mapsスクリプトがブロックされていないか確認してください。
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">PDF出力で日本語が正しく出ない</TableCell>
                                    <TableCell>
                                        フォント読み込みが完了する前に出力が行われた可能性があります。ページをリロードして安定した回線で再度PDF出力を実行してください。
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
