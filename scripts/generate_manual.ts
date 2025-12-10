
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

// Define the content from user_manual.md directly or read it
// Here we read it assuming it's in the root
const MANUAL_PATH = path.join(process.cwd(), 'user_manual.md');
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'user_manual.pdf');
const FONT_PATH = path.join(process.cwd(), 'public', 'fonts', 'ipaexg.ttf');
const LOGO_PATH = path.join(process.cwd(), 'public', 'icons', 'icon-192x192.png');

async function generatePDF() {
    console.log('Generating PDF...');

    if (!fs.existsSync(MANUAL_PATH)) {
        console.error('user_manual.md not found!');
        process.exit(1);
    }

    const content = fs.readFileSync(MANUAL_PATH, 'utf-8');
    const doc = new jsPDF();

    // Add Japanese Font
    if (fs.existsSync(FONT_PATH)) {
        const fontBytes = fs.readFileSync(FONT_PATH);
        const fontBase64 = fontBytes.toString('base64');
        doc.addFileToVFS('ipaexg.ttf', fontBase64);
        doc.addFont('ipaexg.ttf', 'IPAexGothic', 'normal');
        doc.setFont('IPAexGothic');
        console.log('Font loaded.');
    } else {
        console.warn('Font file not found at:', FONT_PATH);
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = margin;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.getHeight();

    function checkPageBreak(heightNeeded: number) {
        if (y + heightNeeded > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    }

    // --- Cover Page ---
    // Logo
    if (fs.existsSync(LOGO_PATH)) {
        const logoData = fs.readFileSync(LOGO_PATH);
        const logoBase64 = logoData.toString('base64');
        const imgWidth = 50;
        const imgHeight = 50;
        const x = (pageWidth - imgWidth) / 2;
        doc.addImage(logoData, 'PNG', x, 60, imgWidth, imgHeight); // Use Buffer directly if supported or base64
    }

    doc.setFontSize(24);
    doc.text('WorkWise', pageWidth / 2, 130, { align: 'center' });

    doc.setFontSize(16);
    doc.text('ユーザー操作マニュアル', pageWidth / 2, 150, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('TOYOTA MOBILITY PARTS KANAGAWA BRANCH', pageWidth / 2, 250, { align: 'center' });
    doc.setTextColor(0);

    doc.addPage();
    y = margin;

    // --- Parsing Markdown Content ---
    const lines = content.split('\n');
    let inCover = true; // Skip initial HTML block

    for (const line of lines) {
        // Skip the HTML cover block in markdown
        if (line.trim().startsWith('<div') || line.trim().startsWith('</div>') || line.trim().startsWith('<img') || line.trim().startsWith('<h1') || line.trim().startsWith('<p')) {
            continue;
        }
        if (line.includes('# WorkWise ユーザー操作マニュアル')) {
            inCover = false;
            // Don't print main title again as we have cover
            continue;
        }

        if (inCover) continue;

        if (line.trim() === '') {
            y += lineHeight / 2;
            continue;
        }

        // Headers
        if (line.startsWith('## ')) {
            checkPageBreak(15);
            y += 5;
            doc.setFontSize(14);
            doc.setFont('IPAexGothic', 'normal'); // Use normal as we don't have bold font file
            doc.text(line.replace('## ', ''), margin, y);
            y += 10;
            doc.setFontSize(10);
            doc.setFont('IPAexGothic', 'normal');
        } else if (line.startsWith('### ')) {
            checkPageBreak(10);
            y += 3;
            doc.setFontSize(12);
            doc.text(line.replace('### ', ''), margin, y);
            y += 8;
            doc.setFontSize(10);
        }
        // Lists
        else if (line.trim().startsWith('- ')) {
            checkPageBreak(7);
            const text = '• ' + line.trim().replace('- ', '').replace(/\*\*/g, '');
            const splitText = doc.splitTextToSize(text, pageWidth - margin * 2 - 5);
            doc.text(splitText, margin + 5, y);
            y += splitText.length * lineHeight;
        }
        else if (line.trim().startsWith('1. ') || line.trim().startsWith('2. ') || line.trim().startsWith('3. ') || line.trim().startsWith('4. ')) {
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
            const text = line.replace('> ', '').replace('[!NOTE]', 'NOTE:').replace(/\*\*/g, '');
            const splitText = doc.splitTextToSize(text, pageWidth - margin * 2 - 10);
            doc.text(splitText, margin + 10, y);
            y += splitText.length * lineHeight;
            doc.setTextColor(0);
        }
        // Normal Text
        else {
            checkPageBreak(7);
            const text = line.replace(/\*\*/g, ''); // Remove bold markers
            const splitText = doc.splitTextToSize(text, pageWidth - margin * 2);
            doc.text(splitText, margin, y);
            y += splitText.length * lineHeight;
        }
    }

    const pdfBytes = doc.output('arraybuffer');
    fs.writeFileSync(OUTPUT_PATH, Buffer.from(pdfBytes));
    console.log(`PDF saved to ${OUTPUT_PATH}`);
}

generatePDF().catch(console.error);
