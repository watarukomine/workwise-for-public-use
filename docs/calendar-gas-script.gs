/**
 * @OnlyCurrentDoc
 *
 * The above comment directs App Scripts to limit the scope of OAuth token
 * to only the current document.
 */

function doPost(e) {
  try {
    // Use e.parameter to get arguments when content-type is x-www-form-urlencoded
    const args = e.parameter;
    Logger.log("Received parameters: " + JSON.stringify(args));

    const { operation, calendarId, eventId, title, description, startTime, endTime } = args;

    if (!calendarId) {
      throw new Error("カレンダーIDが指定されていません。");
    }

    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      throw new Error(`指定されたカレンダーIDが見つかりません: ${calendarId}`);
    }

    let event;
    let result = { status: "success", message: "" };

    switch (operation) {
      case "create":
        if (!title || !startTime || !endTime) {
          throw new Error("作成に必要な情報（タイトル、開始時刻、終了時刻）が不足しています。");
        }
        event = calendar.createEvent(
          title,
          new Date(startTime),
          new Date(endTime),
          { description: description || '' }
        );
        result.message = "イベントが正常に作成されました。";
        result.eventId = event.getId();
        Logger.log("Event created: " + event.getId() + " in calendar " + calendarId);
        break;

      case "update":
        if (!eventId) throw new Error("イベントIDが指定されていません。");
        event = calendar.getEventById(eventId);
        if (!event) throw new Error(`指定されたイベントIDが見つかりません: ${eventId}`);
        
        if (title) event.setTitle(title);
        if (startTime && endTime) event.setTime(new Date(startTime), new Date(endTime));
        if (description) event.setDescription(description);
        
        result.message = "イベントが正常に更新されました。";
        result.eventId = eventId;
        Logger.log("Event updated: " + eventId);
        break;

      case "delete":
        if (!eventId) throw new Error("イベントIDが指定されていません。");
        event = calendar.getEventById(eventId);
        if (event) {
          event.deleteEvent();
          result.message = "イベントが正常に削除されました。";
          Logger.log("Event deleted: " + eventId);
        } else {
          result.message = "指定されたイベントは既に存在しないか、見つかりませんでした。";
          Logger.log("Event not found for deletion: " + eventId);
        }
        result.eventId = eventId;
        break;

      default:
        throw new Error(`不明な操作です: ${operation}`);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Error occurred: " + err.stack);
    const errorResult = {
      status: "error",
      message: err.message,
      error: true // for client-side check
    };
    return ContentService
      .createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
