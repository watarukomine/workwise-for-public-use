const GAS_URL = 'https://script.google.com/macros/s/AKfycbwYhwK50z_vFldzSxVuTA31vTZhyOPzZ43iFzqJApNf7j79Dbx5TyB9-tSgRlAjuLTc/exec';

async function triggerCleanup() {
  console.log('📡 Calling NEW GAS URL cleanupColumnA:', GAS_URL);
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cleanupColumnA' })
    });
    const text = await res.text();
    console.log('Response status:', res.status);
    console.log('Response body:', text);
  } catch (e) {
    console.error('Error:', e);
  }
}

triggerCleanup();
