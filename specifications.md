<!-- markdownlint-disable MD033 MD041 -->
<div class="cover-page">
  <img src="file:///Users/tmpmarketingsectionofkanagawa/WorkWise/public/icons/icon-512x512.png" alt="WorkWise Logo" class="cover-logo" />
  <h1 class="cover-title">WorkWise</h1>
  <p class="cover-subtitle">システム仕様書 (データベース版)</p>
  <p class="cover-footer">TOYOTA MOBILITY PARTS　KANAGAWA BRANCH</p>
</div>

<div style="page-break-after: always;"></div>

# WorkWise システム仕様書 (データベース版)

## 1. システム概要

**WorkWise (ワークワイズ)** は、トヨタモビリティパーツ株式会社 神奈川支社向けに設計されたフィールドサービス管理・スケジュール最適化Webアプリケーションです。
現場スタッフへの案件（受注）の配車・割当、リアルタイムの作業進捗追跡、GPS位置情報管理、および業務パフォーマンスの高度な分析・レポーティングをワンストップで実現します。

本システムは、**Firebase Firestore データベース** を主軸とした高可用性・低遅延のリアルタイムアーキテクチャを採用しており、複数端末間での即時データ同期、オフライン耐性、直感的なインラインデータ編集、およびCSV/Excelによるデータ一括処理を提供します。
さらに、**Google Apps Script (GAS) 連携によるGoogleスプレッドシートへの10分おき自動バックアップ＆双方向同期基盤** を備えており、堅牢なデータ保全と柔軟な外部連携を両立しています。

---

## 2. システム構成・アーキテクチャ

### 2.1. フロントエンド
- **フレームワーク**: Next.js 16 (App Router) / React 18
- **開発言語**: TypeScript 5
- **スタイリング**: Tailwind CSS, CSS Modules
- **UIコンポーネント**: Radix UI (shadcn/ui ベース), Lucide React
- **ドラッグ＆ドロップ**: @dnd-kit/core
- **データ可視化 (チャート)**: Recharts
- **状態管理**: React Context API (`OrderContext`, `CustomerContext`, `SelectedStaffContext`, `UserProfileContext`)

### 2.2. バックエンド & データベース
- **プライマリデータベース**: Google Cloud Firestore (NoSQL Document Database)
  - コレクション単位のリアルタイムリスナー (`onSnapshot`) によるミリ秒単位の双方向同期。
  - バッチ書き込み (`writeBatch`) による大量データの一括コミット。
- **外部連携 & 自動バックアップ**: Google Apps Script (GAS) OAuth2 JWT自己署名認証
  - 10分おきの時間主導型トリガーによる自動同期 (`runFirestoreBackup`)。
  - スプレッドシート数式保護（ARRAYFORMULA自動展開を阻害しない一括バッチ処理）。
- **認証**: Firebase Authentication (Email/Password) + Firestore Users プロファイル
- **地図・位置情報**: Google Maps JavaScript API, Google Places Autocomplete, Geocoding API, Routes API
- **AI / 最適化基盤**: Genkit, Google Gemini API
- **帳票・エクスポート**: jsPDF, jspdf-autotable, xlsx (ExcelJS / SheetJS), ics (iCalendar)

---

## 3. データベース設計 (Firestore コレクション仕様)

| コレクション名 | 用途 | 主要フィールド |
| :--- | :--- | :--- |
| **`orders`** | 受注・案件情報 | `id`, `systemId`, `displayId`, `customerCode`, `customerName`, `storeName`, `workType`, `scheduledDate`, `scheduledTime`, `scheduledEndTime`, `status`, `tireSize`, `quantity`, `isEmergency`, `emergencyMessage`, `managerReply`, `startTravelTime`, `arrivalTimestamp`, `actualStartTime`, `actualEndTime`, `latitude`, `longitude`, `createdAt`, `updatedAt`, `_type` |
| **`users`** (`staff`) | スタッフ・ユーザー情報 | `id`, `name`, `email`, `role` (admin/staff), `branch` (母店), `color`, `phone`, `currentStatus`, `latitude`, `longitude`, `isActive`, `createdAt` |
| **`customers`** | 販売店・顧客マスタ | `id`, `customerCode`, `name`, `mainBranch`, `address`, `phone`, `contactPerson`, `latitude`, `longitude`, `updatedAt` |
| **`workSchedules`** | シフトスケジュール | `id`, `staffId`, `date`, `shiftType`, `startTime`, `endTime`, `note` |
| **`daily_attendance`** | 日次勤怠・打刻データ | `id` (`YYYY-MM-DD_staffId`), `staffId`, `date`, `clockInTime`, `clockOutTime`, `status`, `lastAction`, `latitude`, `longitude` |
| **`employeeActions`** | 現場行動ログ・履歴 | `id`, `staffId`, `orderId`, `actionType` (出勤/移動/到着/開始/完了/退勤), `timestamp`, `latitude`, `longitude` |
| **`counters`** | 自動採番カウンター | `id` (`orders`), `currentCount`, `prefix`, `lastUpdated` |

---

## 4. Googleスプレッドシート連携仕様

### 4.1. 「受注管理」シート（全46列マッピング）

| 列 | 列名 | 型 / 制御 | 内容・マッピング |
| :---: | :--- | :--- | :--- |
| **A** | 受注 No | `ARRAYFORMULA` | `=ARRAYFORMULA(IF(B2:B<>"", ROW(B2:B)-1, ""))` により全自動連番 |
| **B** | SystemID | 文字列 (一意キー) | Firestore `systemId` または `id` |
| **C** | ユーザーコード | 文字列 / 数値 | 顧客コード (`customerCode`) |
| **D** | 店舗名 | 文字列 | 販売店名 (`customerName` / `storeName`) |
| **E** | 主管店舗 | `ARRAYFORMULA` | `=ARRAYFORMULA(IF(C2:C="", "", IFERROR(VLOOKUP(C2:C, '販売店情報 のコピー'!B:D, 3, FALSE), "")))` |
| **F** | 機材有無 | `ARRAYFORMULA` | `=ARRAYFORMULA(IF(C2:C="", "", IFERROR(VLOOKUP(C2:C, '販売店情報 のコピー'!B:I, 8, FALSE), "")))` |
| **G** | 作業予定日 | 日付 (YYYY/MM/DD) | `scheduledDate` |
| **H** | 予定時間 | 時刻 (HH:mm) | `scheduledTime` |
| **I** | ご担当者様 | 文字列 | `picName` |
| **J** | キャンセル日時 | 日時 | `cancelledAt` |
| **K** | キャンセル連絡者 | 文字列 | `cancelledBy` |
| **L** | 作業 | 文字列 | 作業種別 (`workType`) |
| **M** | 受注No (ﾘﾏｰｸ1 8ｹﾀ) | 文字列 / 数値 | `orderNo` |
| **N** | 任意コメント (ﾘﾏｰｸ2 10ｹﾀ) | 文字列 | `comment` |
| **O** | 車名 | 文字列 | `carName` |
| **P** | 登録ナンバー (下４桁) | 文字列 / 数値 | `regNo` |
| **Q** | 入庫状況 | 文字列 | `status` / `receivingStatus` (デフォルト: お預かり済) |
| **R** | タイヤ品番 | 文字列 | `tireNumber` |
| **S** | タイヤサイズ | 文字列 | `tireSize` |
| **T** | 品名 | 文字列 | `productName` |
| **U** | 作業内容 | 文字列 | `workDetails` |
| **V** | 本数 | 数値 / 文字列 | `quantity` |
| **W** | 空気圧センサー パッキン交換 | 文字列 | `sensor` (有/無) |
| **X** | タイヤ手配状況 | 文字列 | `arrangement` |
| **Y** | 廃タイヤ処分 | 文字列 | `disposal` |
| **Z** | 連絡先 | 文字列 | `contact` |
| **AA** | 受注ステータス | 文字列 | `orderStatus` / `status` (未割当、割当済、作業完了など) |
| **AB** | 担当 | 文字列 | 担当スタッフ名 (`staffName`) |
| **AC** | **最終更新日時** | 日時 | 案件編集・更新時のタイムスタンプ (`updatedAt`) |
| **AD** | 特記事項 | 文字列 | `specialNotes` |
| **AE** | フォーム入力者 | 文字列 | `submitter` |
| **AF** | **フォーム入力日時** | 日時 | 新規作成時の初回タイムスタンプ (`createdAt` / 永続維持) |
| **AG** | 最終位置情報 | 緯度,経度 | 現場からのGPS座標 (`latitude,longitude`) |
| **AH** | チップ配置作業予定 | 日時 | チップ開始日時 (`chipWorkScheduled`) |
| **AI** | チップ配置作業完了予定 | 日時 | チップ終了日時 (`chipWorkCompleted`) |
| **AJ** | 出勤ボタン | 日時 | 出勤打刻タイムスタンプ (`clockInTime`) |
| **AK** | 既読確認 | 文字列 | 現場確認フラグ (`isConfirmed` -> 「既読」 / 通常は空欄) |
| **AL** | 移動開始 | 日時 | 移動開始タイムスタンプ (`startTravelTime`) |
| **AM** | 現場到着 | 日時 | 現場到着タイムスタンプ (`arrivalTimestamp`) |
| **AN** | 作業開始 | 日時 | 作業開始タイムスタンプ (`actualStartTime`) |
| **AO** | 作業完了 | 日時 | 作業完了タイムスタンプ (`actualEndTime`) |
| **AP** | 作業所要時間 | 数値 / 文字列 | 実作業時間分 (`actualDuration` / `workDuration`) |
| **AQ** | 退勤ボタン | 日時 | 退勤打刻タイムスタンプ (`clockOutTime`) |
| **AR** | **緊急フラグ** | 文字列 | 緊急連絡発生時のみ「緊急」 / 通常時は空欄 (`isEmergency`) |
| **AS** | 緊急連絡 | 文字列 | 現場からの緊急メッセージ (`emergencyMessage`) |
| **AT** | 管理者返信 | 文字列 | 管理者からの緊急返信メッセージ (`managerReply`) |

---

### 4.2. 「汎用行動予定」シート（全15列マッピング）

休憩、移動、社内作業等の汎用タスクは、「受注管理」シートから完全除外され、独立した「汎用行動予定」シートへバックアップされます。

| 列 | 列名 | 内容・マッピング |
| :---: | :--- | :--- |
| **A** | ID | タスクID (`TASK_...` / `task-...`) |
| **B** | スタッフ名 | 担当スタッフ名 (`staffName`) |
| **C** | 業務内容 | タスク種別（移動、休憩、社内作業など） |
| **D** | 詳細 | 業務詳細メモ (`taskDetails` / `description`) |
| **E** | **行き先** ★ | **汎用チップで入力された「行き先」（目的地） (`destination`)** |
| **F** | 開始日時 | 開始予定日時 (`scheduledTime`) |
| **G** | 終了日時 | 終了予定日時 (`scheduledEndTime`) |
| **H** | 作成日時 | 登録タイムスタンプ (`createdAt`) |
| **I** | 移動開始 | 実績移動開始日時 (`startTravelTime`) |
| **J** | 現場到着 | 実績現場到着日時 (`arrivalTimestamp`) |
| **K** | 作業開始 | 実績作業開始日時 (`actualStartTime`) |
| **L** | 作業完了 | 実績作業完了日時 (`actualEndTime`) |
| **M** | 最終更新日時 | 最終更新タイムスタンプ (`updatedAt`) |
| **N** | 最終位置情報 | GPS座標 (`latitude,longitude`) |
| **O** | ステータス | 割当済、作業中、完了など (`status`) |

---

## 5. 主要機能詳細

### 5.1. 認証と権限管理 (RBAC)
- **管理者 (Admin)**: ダッシュボード、受注管理、スタッフ管理、販売店情報、データ一括インポート、分析レポート、ルート最適化への完全アクセス。
- **現場スタッフ (Staff)**: チェックイン画面（出勤・退勤・作業進捗報告・緊急連絡）、個人スケジュール確認。

### 5.2. ダッシュボード (スケジュール・配車管理)
- **インタラクティブ・ガントチャート**: スタッフごとの当日スケジュールをタイムライン表示。
- **ドラッグ＆ドロップ割当**: 未割当オーダーをスタッフのタイムラインへ直感的に配置。
- **自動同期 & 競合防止**: Firestoreのリアルタイム更新により、他ユーザーによる変更を画面リロード不要で即座に反映。
- **緊急通知と対応**: 現場からの緊急連絡を画面最上部にバナー通知。管理者からの即時返信・解除機能を搭載。

### 5.3. 受注管理 & 新規受注フォーム
- **インライン直接編集**: 受注一覧テーブル上でセルをクリックして各項目の直接編集・即時保存が可能。
- **新規受注フォーム (`/order-form`)**: 顧客マスタとの自動補完連携、カウンターサービスによる自動ID採番。

### 5.4. データ一括インポート (`/import`)
- CSV / Excel ファイルから `orders`, `users`, `customers` への一括取り込み。
- 住所からの緯度経度自動取得（ジオコーディング機能）。

### 5.5. 分析レポート & エクスポート
- 日別推移、スタッフ稼働状況、店舗別シェア、曜日・時間帯別傾向、移動効率の分析。
- **マルチシートExcel出力 (`.xlsx`)** & **A4用紙自動最適化PDF出力 (`.pdf`)**。

---

## 6. 動作環境・セキュリティ

- **通信**: HTTPS (TLS 1.3) による全通信の暗号化。
- **データベースセキュリティ**: Firestore Security Rules による厳格なアクセス制御。
- **バックアップ**: サービスアカウント認証による10分おきGoogleスプレッドシート完全同期＋Firestore自動エクスポート。
