import { ORDER_GAS_URL } from '../src/lib/settings.ts';

async function testServerActionCall() {
  console.log('ORDER_GAS_URL from settings:', ORDER_GAS_URL);

  const payload = {
    action: 'createOrder',
    gasUrl: ORDER_GAS_URL,
    systemId: 'test_action_' + Date.now(),
    orderId: 'test_action_' + Date.now(),
    displayId: '9998',
    userCode: '88888',
    customerCode: '88888',
    storeName: '動作テスト店舗',
    customerName: '動作テスト店舗',
    workType: '動的確認作業',
    scheduledDate: '2026/07/28',
    scheduledTime: '15:00',
    status: '未割当'
  };

  try {
    const res = await fetch(ORDER_GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    console.log('Result:', result);
  } catch (e) {
    console.error('Error:', e);
  }
}

testServerActionCall();
