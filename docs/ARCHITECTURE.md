# WorkWise システムアーキテクチャ

本ドキュメントでは、WorkWiseのシステム全体構成図とデータフローの仕組みを記載します。

## 1. 全体構成図 (Architecture Diagram)

WorkWiseは、フロントエンド(Next.js)の軽量さと、バックエンドとしてのGoogle Spreadsheetの手軽さを両立したサーバーレス・アーキテクチャを採用しています。

```mermaid
graph TD
    %% ユーザー環境
    subgraph Client ["Client (Browser & Mobile)"]
        UI[Next.js Frontend<br/>UI / Components]
        Context[React Context<br/>State Management]
        UI --> Context
    end

    %% Firebase (リアルタイム同期 & 認証)
    subgraph Firebase ["Firebase Services"]
        Auth[Firebase Auth<br/>認証]
        RTDB[Firebase Realtime Database<br/>Signal同期]
        Firestore[Cloud Firestore<br/>プロフィール・設定の保存]
    end

    %% GAS (APIエンドポイント)
    subgraph GAS ["Google Apps Script (GAS)"]
        doGet[GET API<br/>データ取得 / フィルタリング]
        doPost[POST API<br/>データ更新・作成]
        SignalTrigger[Webhook Trigger<br/>Firebaseへ更新通知]
        doPost --> SignalTrigger
    end

    %% Google Spreadsheet (データベース)
    subgraph Spreadsheets ["Google Spreadsheets (DB)"]
        DB_Order[(受注管理シート)]
        DB_Staff[(スタッフマスタ)]
        DB_Customer[(販売店情報)]
        DB_Action[(行動予定)]
    end

    %% 通信フロー
    Client -- 1. Auth/Login --> Auth
    Client -- 2. Polling / Fetch --> doGet
    Client -- 3. Create / Update Task --> doPost
    
    %% GASとスプレッドシートの通信
    doGet -- データの読み取り --> Spreadsheets
    doPost -- 行の追加・書き換え --> Spreadsheets
    
    %% リアルタイム連携
    SignalTrigger -- 4. "Data Updated" Signal --> RTDB
    RTDB -. 5. WebSocket Listener .-> Context
    
    %% 自動再取得
    Context -. 6. 背景での自動再取得 .-> doGet
```

## 2. 各コンポーネントの役割

### 2.1 Next.js フロントエンド (Vercel/Firebase Hosting)
* ユーザーが直接操作する画面・UIを提供します。
* **Server Actions**: GASへのフェッチ処理などをバックエンド側でラップし、CORSの回避や通信の安定化を図ります。
* **Signal Listener**: Firebase Realtime Databaseを利用し、他のユーザー（または自分）がスケジュールを更新した際の「通知（Signal）」を常時待機しています。

### 2.2 Google Apps Script (GAS)
* データベース（スプレッドシート）とアプリケーションの橋渡しをする「バックエンドAPI」です。
* **doGet**: `maxRows` や `filter` を使って、取得するデータを限定（最適化）してフロントエンドへ返却します。
* **doPost**: チップの移動やステータス変更があった際、スプレッドシートの特定行を検索し、ピンポイントでセルの値を書き換えます。

### 2.3 Google Spreadsheets
* 全ての実データ（受注、マスターデータ、設定）を保持する**メインデータベース**です。
* 一般的なRDBとは異なり、スプレッドシート固有の問題（行全体の背景色取得による著しい処理落ちなど）が発生しやすいため、GAS側の検索・取得ロジックには強い最適化が施されています。

### 2.4 Firebase Realtime Database
* スプレッドシートは「データが更新されたからといって直接ブラウザに教えてくれる機能」を持っていないため、それを補完します。
* GASで更新（doPost）が完了した直後に、GASからFirebaseに対して「更新がありました」というフラグを飛ばします。フロントエンドはこれを受信し、必要なタイミングで画面を裏側で再読込します。
