const GAS_URL = 'https://script.google.com/macros/s/AKfycbzbHRT6aSOzWl5XMO6znnEtOVFqsYpnuCKm3xolZWzyZGBxUo7qQm6dshn1P0kOpK5F/exec';

async function testGas() {
  console.log('📡 Testing GAS URL:', GAS_URL);

  const testPayload = {
    action: 'createOrder',
    systemId: 'test_' + Date.now(),
    displayId: '9999',
    userCode: '99999',
    customerCode: '99999',
    storeName: 'テスト店舗',
    customerName: 'テスト店舗',
    workType: 'テスト作業',
    scheduledDate: '2026/07/28',
    scheduledTime: '12:00',
    status: '未割当'
  };

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    const text = await res.text();
    console.log('Status Code:', res.status);
    console.log('Response Text:', text);
  } catch (e) {
    console.error('Fetch Error:', e);
  }
}

testGas();
