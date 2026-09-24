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
        id: 'field_staff_manual',
        input: 'FIELD_STAFF_MANUAL.md',
        output: 'FIELD_STAFF_MANUAL.pdf',
        title: 'WorkWise',
        subtitle: '現場スタッフ操作マニュアル'
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
    let inCodeBlock = false;

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

        // Code blocks / Mermaid diagrams
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (inCodeBlock) {
            continue; // Skip code / diagram lines in PDF
        }

        if (line.trim() === '') {
            y += lineHeight / 2;
            continue;
        }

        // Image: ![alt](url)
        const imgMatch = line.trim().match(/^!\[(.*?)\]\((.*?)\)/);
        if (imgMatch) {
            const altText = imgMatch[1];
            let rawPath = imgMatch[2];
            let imgFullPath = rawPath.startsWith('/')
                ? path.join(rootDir, 'public', rawPath)
                : path.join(rootDir, rawPath);

            if (fs.existsSync(imgFullPath)) {
                try {
                    const imgData = fs.readFileSync(imgFullPath);
                    const ext = path.extname(imgFullPath).toLowerCase();
                    const format = (ext === '.jpg' || ext === '.jpeg') ? 'JPEG' : 'PNG';

                    let imgProps = null;
                    try {
                        imgProps = doc.getImageProperties(imgData);
                    } catch {
                        imgProps = null;
                    }

                    const maxW = pageWidth - margin * 2;
                    let targetW = Math.min(maxW, 110);
                    let targetH = 65;
                    if (imgProps && imgProps.width && imgProps.height) {
                        const ratio = imgProps.height / imgProps.width;
                        targetH = targetW * ratio;
                        if (targetH > 85) {
                            targetH = 85;
                            targetW = targetH / ratio;
                        }
                    }

                    checkPageBreak(targetH + 15);
                    const imgX = margin + (maxW - targetW) / 2;
                    doc.addImage(imgData, format, imgX, y, targetW, targetH);
                    y += targetH + 3;

                    if (altText) {
                        doc.setFontSize(8);
                        doc.setTextColor(110);
                        doc.text(`【図】${altText}`, pageWidth / 2, y, { align: 'center' });
                        doc.setTextColor(0);
                        doc.setFontSize(9.5);
                        y += 6;
                    }
                    continue;
                } catch (imgErr) {
                    console.warn(`Failed to embed image ${imgFullPath}:`, imgErr);
                }
            }
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
