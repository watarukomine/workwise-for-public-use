# WorkWise 複数支社（マルチオフィス）展開セットアップガイド

本アプリケーション（WorkWise）は、同一のソースコード（Gitリポジトリ）を使用しながら、支社ごとに異なるデータベース（Firebase）およびスプレッドシート（GAS）に接続して同時に独立稼働させることができます。

新しい支社（例：愛知支社）を立ち上げる場合、または既存の支社（例：神奈川支社）のプロジェクト設定を新しく変更する場合は、以下の手順に従って設定を行ってください。

---

## 1. データベース（Firebase）の新規作成と準備

各支社ごとに、個別のFirebaseプロジェクトをセットアップします。

1. **Firebase プロジェクトの作成**
   - [Firebase Console](https://console.firebase.google.com/) にアクセスし、「プロジェクトを追加」から新しいプロジェクトを作成します（例: `workwise-aichi`, `workwise-kanagawa-v2` など）。
2. **Web アプリの登録**
   - プロジェクトの概要ページで「Web (</>)」アイコンをクリックし、アプリを登録します。
   - 登録後に表示される `firebaseConfig` のオブジェクト内容をメモします（後述の環境変数設定で使用します）。
3. **Cloud Firestore の有効化**
   - Firebase メニューの「Build」 > 「Firestore Database」を開き、「データベースの作成」を実行します。
   - セキュリティルールには、リポジトリルートにある `firestore.rules` の内容を適用します。
4. **インデックスの作成**
   - アプリケーションが正常に動作するために、Firestoreの複合インデックスが必要です。リポジトリルートにある `firestore.indexes.json` を参考にインデックスを作成するか、ローカルから Firebase CLI を使ってデプロイしてください。

---

## 2. スプレッドシートおよび GAS (Google Apps Script) の準備

各支社が使用するスプレッドシートを用意し、API経由でデータを読み書きできるようにします。

1. **スプレッドシートの複製**
   - 既存のスプレッドシート（スタッフ情報、販売店情報、受注情報）をコピーして、新規支社用のスプレッドシートを作成します。
2. **Google Apps Script (GAS) の設定とデプロイ**
   - 各スプレッドシートに紐づくGASプロジェクトを用意します。
   - GASコードをデプロイし、**「ウェブアプリ」**として公開します。
     - 実行ユーザー: **「自分」**
     - アクセスできるユーザー: **「全員」**
   - デプロイ後に発行される **「ウェブアプリのURL」** をメモします（`NEXT_PUBLIC_..._GAS_URL` として使用します）。

---

## 3. 環境変数（`.env`）の設定

アプリケーションをホスティング環境（Vercel, Firebase App Hosting など）にデプロイする際、管理画面の環境変数設定に、先ほど準備した値を設定します。

### 設定する環境変数一覧

| 環境変数名 | 説明 | 取得元 / 設定例 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web アプリの API キー | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Web アプリの認証ドメイン | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase プロジェクトの ID | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase のストレージバケット名 | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase の送信者 ID | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web アプリのアプリ ID | `appId` |
| `NEXT_PUBLIC_STAFF_GAS_URL` | スタッフ情報GASのAPI URL | GASのデプロイURL |
| `NEXT_PUBLIC_CUSTOMER_GAS_URL` | 販売店情報GASのAPI URL | GASのデプロイURL |
| `NEXT_PUBLIC_ORDER_GAS_URL` | 受注情報GASのAPI URL | GASのデプロイURL |
| `NEXT_PUBLIC_STAFF_SHEET_URL` | スタッフスプレッドシートの閲覧URL | スプレッドシートのブラウザURL |
| `NEXT_PUBLIC_CUSTOMER_SHEET_URL` | 販売店スプレッドシートの閲覧URL | スプレッドシートのブラウザURL |
| `NEXT_PUBLIC_ORDER_SHEET_URL` | 受注スプレッドシートの閲覧URL | スプレッドシートのブラウザURL |

---

## 4. デプロイと動作確認

1. **ブランチのプッシュ**
   - ソースコードはすべての支社で共通（`main` などのメインブランチ）を使用します。
2. **ホスティングサービスでのデプロイ**
   - 新規支社用に個別のVercelプロジェクトまたはFirebase Hostingターゲットを作成し、共通のGitHubリポジトリを連携します。
   - **必ずそれぞれのプロジェクト設定で、上記の環境変数をその支社用の値に設定してください。**
3. **アクセス確認**
   - デプロイされたURLにアクセスし、該当支社用のデータベースとスプレッドシートにデータが正しく読み書きされることを確認します。
