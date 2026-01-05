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
                <h1 className="text-3xl font-bold tracking-tight mb-2">エラーとトラブルシューティング一覧</h1>
                <p className="text-muted-foreground">
                    WorkWiseアプリケーションで発生する可能性のあるエラーメッセージ、その原因、および対処方法をまとめています。
                </p>
            </div>

            <div className="space-y-8">
                {/* 通信・システムエラー */}
                <Card>
                    <CardHeader>
                        <CardTitle>通信・システムエラー</CardTitle>
                        <CardDescription>
                            Google Apps Script (GAS) や Firebase (Firestore) との通信に関連するエラーです。
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
                                    <TableCell className="font-medium">GAS URLが設定されていません。</TableCell>
                                    <TableCell>環境変数 `NEXT_PUBLIC_GAS_API_URL` または `NEXT_PUBLIC_ORDER_GAS_API_URL` が設定されていません。</TableCell>
                                    <TableCell>システム管理者に連絡し、環境変数の設定を確認してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">GASへのアクセス権限がありません。</TableCell>
                                    <TableCell>GASのデプロイ設定で、アクセス権限が正しく設定されていません。</TableCell>
                                    <TableCell>GASのデプロイ設定を開き、「アクセスできるユーザー」を「全員（Anyone）」に変更して再デプロイしてください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">GASへのリクエストに失敗しました。<br /><span className="text-xs text-muted-foreground">Status: ...</span></TableCell>
                                    <TableCell>ネットワークの問題、またはGAS側で予期しないエラーが発生しています。</TableCell>
                                    <TableCell>ネットワーク接続を確認し、しばらく待ってから再試行してください。解消しない場合はGASの実行ログを確認してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">GASスクリプトエラー: ...</TableCell>
                                    <TableCell>GASの処理中にエラーが発生しました（例：スプレッドシートが見つからない、不正なデータ形式など）。</TableCell>
                                    <TableCell>システム管理者に連絡し、GASの実行ログから詳細なエラー原因を特定してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Sync Orders Error: ...</TableCell>
                                    <TableCell>スプレッドシートからFirestoreへのデータ同期中にエラーが発生しました。</TableCell>
                                    <TableCell>手動で同期ボタン（もしあれば）を押すか、ページをリロードしてください。GASのURL設定やネットワークを確認してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Failed to get orders for ...</TableCell>
                                    <TableCell>Firestoreからのデータ取得に失敗しました。</TableCell>
                                    <TableCell>ネットワーク接続を確認してください。Firebaseのセキュリティルールやクォータ制限の可能性があります。</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* 操作・入力エラー */}
                <Card>
                    <CardHeader>
                        <CardTitle>操作・入力エラー</CardTitle>
                        <CardDescription>
                            日々の業務操作（スケジュールの変更、勤怠打刻など）で発生するエラーです。
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
                                    <TableCell className="font-medium">担当スタッフが見つかりません。</TableCell>
                                    <TableCell>操作対象のスタッフデータがシステム上に存在しない、またはIDが一致しません。</TableCell>
                                    <TableCell>スタッフ一覧画面で該当スタッフが登録されているか確認してください。ブラウザをリロードして最新のデータを取得してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">更新エラー: シートの更新に失敗しました</TableCell>
                                    <TableCell>スケジュール変更時にGAS（スプレッドシート）への書き込みに失敗しました。</TableCell>
                                    <TableCell>変更は保存されていません。再試行してください。頻発する場合はGASの稼働状況を確認してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">割当エラー: タスクの割り当てに失敗しました</TableCell>
                                    <TableCell>ドラッグ＆ドロップによるタスク割り当て処理が失敗しました。</TableCell>
                                    <TableCell>画面をリロードして最新の状態にしてから、再度操作を行ってください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">エラー: 無効な時間形式です。</TableCell>
                                    <TableCell>新規予定作成や編集ダイアログで、時間の入力形式が正しくありません。</TableCell>
                                    <TableCell>「HH:MM」（例: 09:30）の形式で入力してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">エラー: 出勤/退勤処理に失敗しました。</TableCell>
                                    <TableCell>ボタンを押した際の打刻処理に失敗しました。</TableCell>
                                    <TableCell>ネットワーク接続を確認し、再試行してください。</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* インポート・データ処理エラー */}
                <Card>
                    <CardHeader>
                        <CardTitle>インポート・データ処理エラー</CardTitle>
                        <CardDescription>
                            Excelファイルのインポート機能などで発生するエラーです。
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
                                    <TableCell className="font-medium">シートが空です。</TableCell>
                                    <TableCell>アップロードされたExcelファイルにデータが含まれていません。</TableCell>
                                    <TableCell>正しいファイルを選択しているか、ファイルの中身が空でないか確認してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">読み込みエラー: ...</TableCell>
                                    <TableCell>Excelファイルの形式が不正であるか、解析できないデータが含まれています。</TableCell>
                                    <TableCell>ファイルが破損していないか、パスワード保護されていないか確認してください。`.xlsx` 形式を推奨します。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">取り込み失敗: スタッフ名のマッチングに失敗し...</TableCell>
                                    <TableCell>Excel内のスタッフ名とシステム上のスタッフ名が一致しませんでした。</TableCell>
                                    <TableCell>Excelのスタッフ名とシステム登録名（漢字、スペースの有無など）が一致しているか確認してください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">マージ失敗: 現在のデータの取得に失敗しました。</TableCell>
                                    <TableCell>「ファイルに含まれるスタッフのみ更新」モードでの処理中にエラーが発生しました。</TableCell>
                                    <TableCell>ネットワークを確認するか、「ファイルに含まれるスタッフのみ更新」のチェックを外して（上書きモードで）試してください。</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* その他 */}
                <Card>
                    <CardHeader>
                        <CardTitle>その他</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30%]">現象・メッセージ</TableHead>
                                    <TableHead className="w-[70%]">対処方法</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">画面が真っ白になる / 読み込みが終わらない</TableCell>
                                    <TableCell>ブラウザのキャッシュクリアを試すか、シークレットウィンドウでアクセスしてください。解消しない場合は開発者に問い合わせてください。</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">「接続テスト失敗」</TableCell>
                                    <TableCell>シフトインポート画面の「接続テスト」で失敗する場合、Firebaseへの書き込み権限がない可能性があります。管理者に確認してください。</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
