const fs = require('fs');
const path = require('path');

const csvPath = '/Users/tmpmarketingsectionofkanagawa/.gemini/antigravity/brain/70b96ca0-6413-46fe-9407-c2dfcd135d2e/.system_generated/steps/1224/content.md';
const content = fs.readFileSync(csvPath, 'utf-8');

const lines = content.split('\n');
const startLineIdx = lines.findIndex(line => line.startsWith('No,ユーザーコード') || line.includes('緯度,経度'));

console.log('Start Line Index:', startLineIdx);

const dataLines = lines.slice(startLineIdx + 1).filter(l => l.trim().length > 0);

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

const customers = [];

dataLines.forEach((line, idx) => {
  const parts = parseCSVLine(line);
  if (parts.length < 8) return;

  const rawCode = parts[1] || '';
  const userCode = rawCode ? String(rawCode).trim().padStart(5, '0') : '';
  const mainStore = parts[3] || '';
  const storeName = parts[6] || parts[5] || '';
  const equipment = parts[8] || '-';
  const address = parts[9] || '';
  const latLngStr = parts[10] || '';
  const phone = parts[11] || '';
  const hours = parts[12] || '';

  if (!storeName || storeName === '店舗名') return;

  let lat = undefined;
  let lng = undefined;
  if (latLngStr.includes(',')) {
    const [la, ln] = latLngStr.split(',');
    const parsedLat = parseFloat(la);
    const parsedLng = parseFloat(ln);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      lat = parsedLat;
      lng = parsedLng;
    }
  }

  customers.push({
    id: userCode ? `cust-${userCode}` : `cust-idx-${idx}`,
    userCode,
    storeName,
    name: storeName,
    address: address.replace(/^​/, ''),
    mainStore,
    equipment,
    phone,
    hours,
    latitude: lat,
    longitude: lng,
    'ユーザーコード': userCode,
    '店舗': storeName,
    '店舗名': storeName,
    '住所': address.replace(/^​/, ''),
    '母店': mainStore,
    '緯度': lat,
    '経度': lng
  });
});

console.log('Parsed Customers Total:', customers.length);

const targetPath = path.join(process.cwd(), 'src/data/customer-master.json');
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, JSON.stringify(customers, null, 2), 'utf-8');
console.log('Successfully saved to:', targetPath);
