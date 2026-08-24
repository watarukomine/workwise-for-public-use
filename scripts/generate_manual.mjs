import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const MANUALS = [
    {
        id: 'user_manual',
        input: 'user_manual.md',
        output: 'user_manual.pdf',
        title: 'WorkWise',
        subtitle: 'ユーザー操作マニュアル'
    },
    {
        id: 'specifications',
        input: 'specifications.md',
        output: 'specifications.pdf',
        title: 'WorkWise',
        subtitle: 'システム仕様書'
    },
    {
        id: 'field_staff_manual',
        input: 'FIELD_STAFF_MANUAL.md',
        output: 'FIELD_STAFF_MANUAL.pdf',
        title: 'WorkWise',
        subtitle: '現場スタッフ操作マニュアル'
    },
    {
        id: 'security_rules',
        input: 'security_rules.md',
        output: 'security_rules.pdf',
        title: 'WorkWise',
        subtitle: 'セキュリティルール仕様書'
    }
];

const FONT_PATH = path.join(rootDir, 'public', 'fonts', 'ipaexg.ttf');
const LOGO_PATH = path.join(rootDir, 'public', 'icons', 'icon-192x192.png');

async function generatePDFForManual(config) {
    console.log(`Generating PDF for ${config.input}...`);
    const manualPath = path.join(rootDir, config.input);
    const outputPath = path.join(rootDir, 'public', config.output);

    if (!fs.existsSync(manualPath)) {
        console.warn(`${config.input} not found! Skipping.`);
        return;
    }

    const content = fs.readFileSync(manualPath, 'utf-8');
    const doc = new jsPDF();

    // Add Japanese Font
    if (fs.existsSync(FONT_PATH)) {
        const fontBytes = fs.readFileSync(FONT_PATH);
        const fontBase64 = fontBytes.toString('base64');
        doc.addFileToVFS('ipaexg.ttf', fontBase64);
        doc.addFont('ipaexg.ttf', 'IPAexGothic', 'normal');
        doc.setFont('IPAexGothic');
    } else {
        console.warn('Font file not found at:', FONT_PATH);
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = margin;
    const lineHeight = 6.5;
    const pageHeight = doc.internal.pageSize.getHeight();

    function checkPageBreak(heightNeeded) {
        if (y + heightNeeded > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    }

    // --- Cover Page ---
    if (fs.existsSync(LOGO_PATH)) {
        const logoData = fs.readFileSync(LOGO_PATH);
        const imgWidth = 50;
        const imgHeight = 50;
        const x = (pageWidth - imgWidth) / 2;
        doc.addImage(logoData, 'PNG', x, 60, imgWidth, imgHeight);
    }

    doc.setFontSize(24);
    doc.text(config.title, pageWidth / 2, 130, { align: 'center' });

    doc.setFontSize(16);
    doc.text(config.subtitle, pageWidth / 2, 150, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('TOYOTA MOBILITY PARTS KANAGAWA BRANCH', pageWidth / 2, 250, { align: 'center' });
    doc.setTextColor(0);

    doc.addPage();
    y = margin;

    // --- Parsing Markdown Content ---
    const lines = content.split('\n');
    let inCover = true;

    for (const line of lines) {
        if (line.trim().startsWith('<div') || line.trim().startsWith('</div>') || line.trim().startsWith('<img') || line.trim().startsWith('<h1') || line.trim().startsWith('<p')) {
            continue;
        }

        if (line.includes(`# ${config.title}`) || line.includes(`# ${config.subtitle}`)) {
            inCover = false;
            continue;
        }

        if (inCover && (line.trim() === '' || line.trim().startsWith('<!--'))) continue;

        if (inCover && line.trim() !== '') {
            inCover = false;
        }

        if (line.trim() === '') {
            y += lineHeight / 2;
            continue;
        }

        // Headers
        if (line.startsWith('## ')) {
            checkPageBreak(15);
            y += 5;
            doc.setFontSize(14);
            doc.setFont('IPAexGothic', 'normal');
            doc.text(line.replace('## ', ''), margin, y);
            y += 9;
            doc.setFontSize(9.5);
            doc.setFont('IPAexGothic', 'normal');
        } else if (line.startsWith('### ')) {
            checkPageBreak(10);
            y += 3;
            doc.setFontSize(11.5);
            doc.text(line.replace('### ', ''), margin, y);
            y += 7;
            doc.setFontSize(9.5);
        } else if (line.startsWith('#### ')) {
            checkPageBreak(8);
            y += 2;
            doc.setFontSize(10.5);
            doc.text(line.replace('#### ', ''), margin, y);
            y += 6;
            doc.setFontSize(9.5);
        }
        // Table row
        else if (line.trim().startsWith('|')) {
            if (line.includes('---')) continue;
            checkPageBreak(7);
            const cleanRow = line.split('|').filter(c => c.trim() !== '').map(c => c.trim().replace(/<br\s*\/?>/gi, ' ')).join('  |  ');
            const splitText = doc.splitTextToSize(cleanRow, pageWidth - margin * 2);
            doc.text(splitText, margin, y);
            y += splitText.length * lineHeight;
        }
        // Lists
        else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            checkPageBreak(7);
            const text = '• ' + line.trim().replace(/^[-*] /, '').replace(/\*\*/g, '');
            const splitText = doc.splitTextToSize(text, pageWidth - margin * 2 - 5);
            doc.text(splitText, margin + 5, y);
            y += splitText.length * lineHeight;
        }
        else if (line.trim().match(/^\d+\. /)) {
            checkPageBreak(7);
            const text = line.trim().replace(/\*\*/g, '');
            const splitText = doc.splitTextToSize(text, pageWidth - margin * 2 - 5);
            doc.text(splitText, margin + 5, y);
            y += splitText.length * lineHeight;
        }
        // Blockquotes (Notes)
        else if (line.trim().startsWith('> ')) {
            checkPageBreak(7);
            doc.setTextColor(80);
            const text = line.replace('> ', '').replace('[!NOTE]', 'NOTE:').replace('[!TIP]', 'TIP:').replace('[!IMPORTANT]', 'IMPORTANT:').replace(/\*\*/g, '');
            const splitText = doc.splitTextToSize(text, pageWidth - margin * 2 - 10);
            doc.text(splitText, margin + 10, y);
            y += splitText.length * lineHeight;
            doc.setTextColor(0);
        }
        // Horizontal Rule
        else if (line.trim() === '---') {
            checkPageBreak(10);
            doc.setDrawColor(200);
            doc.line(margin, y + 2, pageWidth - margin, y + 2);
            y += 8;
        }
        // Normal Text
        else {
            checkPageBreak(7);
            const text = line.replace(/\*\*/g, '');
            const splitText = doc.splitTextToSize(text, pageWidth - margin * 2);
            doc.text(splitText, margin, y);
            y += splitText.length * lineHeight;
        }
    }

    const pdfBytes = doc.output('arraybuffer');
    fs.writeFileSync(outputPath, Buffer.from(pdfBytes));
    console.log(`PDF saved to ${outputPath}`);
}

async function main() {
    for (const manual of MANUALS) {
        await generatePDFForManual(manual);
    }
}

main().catch(console.error);
