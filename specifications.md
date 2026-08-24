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
- **認証**: Firebase Authentication (Email/Password) + Firestore Users プロファイル
- **地図・位置情報**: Google Maps JavaScript API, Google Places Autocomplete, Geocoding API, Routes API
- **AI / 最適化基盤**: Genkit, Google Gemini API
- **帳票・エクスポート**: jsPDF, jspdf-autotable, xlsx (ExcelJS / SheetJS), ics (iCalendar)

---

## 3. データベース設計 (Firestore コレクション仕様)

| コレクション名 | 用途 | 主要フィールド |
| :--- | :--- | :--- |
| **`orders`** | 受注・案件情報 | `id`, `displayId`, `orderNo`, `customerName`, `assignedStaffId`, `scheduledDate`, `startTime`, `endTime`, `status`, `tireSize`, `tireCount`, `address`, `latitude`, `longitude`, `memo`, `emergencyReply`, `updatedAt` |
| **`users`** (`staff`) | スタッフ・ユーザー情報 | `id`, `name`, `email`, `role` (admin/staff), `branch` (母店), `color`, `phone`, `isActive`, `createdAt` |
| **`customers`** | 販売店・顧客マスタ | `id`, `customerCode`, `name`, `mainBranch`, `address`, `phone`, `contactPerson`, `latitude`, `longitude`, `updatedAt` |
| **`workSchedules`** | シフトスケジュール | `id`, `staffId`, `date`, `shiftType`, `startTime`, `endTime`, `note` |
| **`daily_attendance`** | 日次勤怠・打刻データ | `id` (`YYYY-MM-DD_staffId`), `staffId`, `date`, `clockInTime`, `clockOutTime`, `status`, `lastAction`, `latitude`, `longitude` |
| **`employeeActions`** | 現場行動ログ・履歴 | `id`, `staffId`, `orderId`, `actionType` (出勤/移動/到着/開始/完了/退勤), `timestamp`, `latitude`, `longitude` |
| **`counters`** | 自動採番カウンター | `id` (`orders`), `currentCount`, `prefix`, `lastUpdated` |

---

## 4. 主要機能詳細

### 4.1. 認証と権限管理 (RBAC)
- **管理者 (Admin)**:
  - ダッシュボード（配車・タイムライン）、受注管理（全件編集）、スタッフ管理、販売店情報、データ一括インポート、分析レポート、ルート最適化への完全アクセス。
- **現場スタッフ (Staff)**:
  - チェックイン画面（出勤・退勤・作業進捗報告・緊急連絡）、個人スケジュール確認。

### 4.2. ダッシュボード (スケジュール・配車管理)
- **インタラクティブ・ガントチャート**: スタッフごとの当日スケジュールをタイムライン表示。
- **ドラッグ＆ドロップ割当**: 未割当オーダーをスタッフのタイムラインへ直感的に配置。
- **自動同期 & 競合防止**: Firestoreのリアルタイム更新により、他ユーザーによる変更を画面リロード不要で即座に反映。
- **緊急通知と対応**: 現場からの緊急連絡を画面最上部にバナー通知。管理者からの即時返信・解除機能を搭載。

### 4.3. 受注管理 & 新規受注フォーム
- **インライン直接編集**: 受注一覧テーブル上でセルをクリックして各項目の直接編集・即時保存が可能。
- **新規受注フォーム (`/order-form`)**:
  - 顧客マスタとの自動補完連携（店舗名選択で住所・電話番号を自動入力）。
  - カウンターサービスによる自動ID採番。

### 4.4. データ一括インポート (`/import`)
- CSV / Excel ファイルから `orders`, `users`, `customers` への一括取り込み。
- 日本語ヘッダーの自動マッピング。
- 住所からの緯度経度自動取得（ジオコーディング機能）。
- マージ（追加/更新）モードおよび全件上書きモードのサポート。

### 4.5. 分析レポート & エクスポート
- 日別推移、スタッフ稼働状況、店舗別シェア、曜日・時間帯別傾向、移動効率、タイヤサイズ別作業時間の分析。
- **マルチシートExcel出力 (`.xlsx`)** & **A4用紙自動最適化PDF出力 (`.pdf`)**。

### 4.6. ルート最適化
- Google Maps APIを活用した最短巡回ルートおよび移動時間の算出・スケジュール反映。

---

## 5. 動作環境・セキュリティ

- **通信**: HTTPS (TLS 1.3) による全通信の暗号化。
- **データベースセキュリティ**: Firestore Security Rules による厳格なアクセス制御（認証必須・ロール別操作制御）。
- **バックアップ**: Firestore 自動エクスポートおよび管理画面からのCSVエクスポートに対応。
