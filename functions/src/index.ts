import { onValueUpdated } from "firebase-functions/v2/database";
import { initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getDatabase } from "firebase-admin/database";
import { logger } from "firebase-functions";

initializeApp();

/**
 * Realtime Database の更新をトリガーに、管理者へプッシュ通知を送信する
 */
export const sendEmergencyNotification = onValueUpdated({
  ref: "/signals/emergency_active",
  region: "us-central1"
}, async (event) => {
  const data = event.data.after.val();
  
  // 緊急連絡（Emergency）が含まれているかチェック
  // 注: ここでは信号が「更新された」ことだけをトリガーにし、
  // 実際の緊急フラグが立っているデータを取得して通知します。
  
  if (!data) return;

  const db = getDatabase();
  const messaging = getMessaging();

  // 1. 管理者の FCM トークン一覧を取得
  const tokensSnapshot = await db.ref("admin_fcm_tokens").once("value");
  const tokensData = tokensSnapshot.val();

  if (!tokensData) {
    logger.log("No admin tokens found.");
    return;
  }

  const tokens: string[] = [];
  // 構造: admin_fcm_tokens -> {userId} -> {tokenObj OR deviceId: {tokenObj}}
  Object.values(tokensData).forEach((userTokens: any) => {
    if (userTokens.token) {
      // 旧フォーマット (直接 token を持っている場合)
      tokens.push(userTokens.token);
    } else if (typeof userTokens === 'object') {
      // 新フォーマット (デバイスIDの下に token を持っている場合)
      Object.values(userTokens).forEach((deviceData: any) => {
        if (deviceData.token) {
          tokens.push(deviceData.token);
        }
      });
    }
  });

  if (tokens.length === 0) {
    logger.log("No valid FCM tokens found.");
    return;
  }

  // 2. 通知を送信
  // 注: 実際のプロジェクトでは、ここでどのスタッフからの緊急連絡か等の詳細を含めるのが理想的です。
  // 今回はプロトタイプとして全管理者に一斉送信します。
  const message = {
    notification: {
      title: "【重要】緊急連絡がありました",
      body: "スタッフから緊急の報告が届いています。WorkWiseを確認してください。",
    },
    tokens: tokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    logger.log(`${response.successCount} messages were sent successfully`);
  } catch (error) {
    logger.error("Error sending notification:", error);
  }
});
