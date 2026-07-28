import * as fs from 'fs';
import * as path from 'path';

const csvPath = path.join(process.cwd(), '受注管理(WW3) - 受注管理0724　09-17.csv');

if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n');
    const header = lines[0].split(',');
    console.log("CSV Header:", header);

    const systemIdIdx = header.indexOf('SystemID');
    const displayIdIdx = header.indexOf('受注 No');

    console.log(`SystemID column index: ${systemIdIdx}`);
    console.log(`受注 No column index: ${displayIdIdx}`);

    let totalRows = 0;
    let emptySystemIdRows = 0;
    let filledSystemIdRows = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        totalRows++;
        const cols = line.split(',');
        const sysId = cols[systemIdIdx] ? cols[systemIdIdx].replace(/"/g, '').trim() : '';
        if (!sysId) {
            emptySystemIdRows++;
            if (emptySystemIdRows <= 5) {
                console.log(`Row ${i+1} has EMPTY SystemID: ${line.slice(0, 80)}`);
            }
        } else {
            filledSystemIdRows++;
        }
    }

    console.log(`Total data rows: ${totalRows}`);
    console.log(`Rows with SystemID: ${filledSystemIdRows}`);
    console.log(`Rows with EMPTY SystemID: ${emptySystemIdRows}`);
} else {
    console.log("CSV file not found:", csvPath);
}
