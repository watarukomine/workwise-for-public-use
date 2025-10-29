
/**
 * このGoogle Apps Scriptは、WorkWiseアプリケーションからGoogleカレンダーの予定を
 * 作成、更新、削除するためのバックエンド処理を提供します。
 *
 * 【設定方法】
 * 1. 新しいGoogle Apps Scriptプロジェクトを作成します (https://script.google.com/home)
 * 2. このファイルの内容をすべてコピーして、GASエディタに貼り付けます。
 * 3. 右上の「デプロイ」ボタン > 「新しいデプロイ」を選択します。
 * 4. 「種類の選択」で歯車アイコンをクリックし、「ウェブアプリ」を選択します。
 * 5. 説明を入力します（例: WorkWiseカレンダー連携）。
 * 6. 「次のユーザーとして実行」は「自分」のままにします。
 * 7. 「アクセスできるユーザー」を【重要】「全員」に変更します。
 * 8. 「デプロイ」ボタンをクリックします。
 * 9. 必要に応じてアクセス許可を承認します。
 * 10. 表示されたウェブアプリのURLをコピーし、WorkWiseアプリの指定された場所に設定します。
 *     (例: `src/app/actions/update-calendar-event.ts` の `DEFAULT_CALENDAR_GAS_URL`)
 */


/**
 * HTTP POSTリクエストを処理するメイン関数。
 * アプリケーションからのリクエストボディを解析し、カレンダー操作を振り分けます。
 * @param {object} e - POSTリクエストイベントオブジェクト。
 * @returns {ContentService.TextOutput} - JSON形式のレスポンス。
 */
function doPost(e) {
  // CORSプリフライトリクエストに対応
  if (e.postData.type === "application/json" && e.postData.contents === '{"preflight":true}') {
    return ContentService.createTextOutput(JSON.stringify({ status: 'preflight-ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  let response = {
    status: 'error',
    message: '不明なエラーが発生しました。',
    error: true,
  };

  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error("リクエストデータがありません。");
    }
    
    const args = JSON.parse(e.postData.contents);
    const { operation, calendarId, eventId, title, description, startTime, endTime } = args;

    if (!operation || !calendarId) {
      throw new Error("必須パラメーター（operation, calendarId）が不足しています。");
    }

    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      throw new Error(`指定されたカレンダーが見つかりません: ${calendarId}`);
    }

    switch (operation) {
      case 'create':
        if (!title || !startTime || !endTime) {
          throw new Error("予定の作成には title, startTime, endTime が必要です。");
        }
        const newEvent = calendar.createEvent(
          title,
          new Date(startTime),
          new Date(endTime),
          { description: description || '' }
        );
        response = {
          status: 'success',
          message: '予定が正常に作成されました。',
          eventId: newEvent.getId(),
          error: false,
        };
        break;

      case 'update':
        if (!eventId || !title || !startTime || !endTime) {
          throw new Error("予定の更新には eventId, title, startTime, endTime が必要です。");
        }
        const eventToUpdate = calendar.getEventById(eventId);
        if (!eventToUpdate) {
            throw new Error(`更新対象の予定が見つかりません: ${eventId}`);
        }
        eventToUpdate.setTitle(title);
        eventToUpdate.setDescription(description || '');
        eventToUpdate.setTime(new Date(startTime), new Date(endTime));
        response = {
          status: 'success',
          message: '予定が正常に更新されました。',
          eventId: eventId,
          error: false,
        };
        break;

      case 'delete':
        if (!eventId) {
          throw new Error("予定の削除には eventId が必要です。");
        }
        const eventToDelete = calendar.getEventById(eventId);
        if (eventToDelete) {
          eventToDelete.deleteEvent();
          response = {
            status: 'success',
            message: '予定が正常に削除されました。',
            error: false,
          };
        } else {
          // すでに削除されている場合も成功とみなす
          response = {
            status: 'success',
            message: '予定は既に削除されていました。',
            error: false,
          };
        }
        break;

      default:
        throw new Error(`未対応の操作です: ${operation}`);
    }
  } catch (err) {
    console.error(err);
    response = {
      status: 'error',
      message: err.toString(),
      error: true,
    };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * HTTP GETリクエストを処理する関数（疎通確認用）。
 * このURLにブラウザでアクセスすると、疎通確認メッセージが返ります。
 * @returns {ContentService.TextOutput} - JSON形式のレスポンス。
 */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      message: 'Google Calendar連携用のGASスクリプトは正常に動作しています。' 
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
