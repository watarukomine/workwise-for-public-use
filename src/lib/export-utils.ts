import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

/**
 * データをExcelファイルとしてエクスポートします
 * @param data エクスポートするデータ配列（オブジェクトの配列）
 * @param fileName 保存するファイル名
 * @param sheetName シート名
 */
export const exportToExcel = <T extends object>(data: T[], fileName: string, sheetName: string = 'Sheet1') => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

/**
 * データをPDFファイルとしてエクスポートします
 * @param title PDFのタイトル
 * @param headers テーブルのヘッダー配列
 * @param data テーブルのデータ配列（2次元配列）
 * @param fileName 保存するファイル名
 */
export const exportToPDF = async (title: string, headers: string[], data: any[][], fileName: string) => {
    const doc = new jsPDF();
    const fontName = 'IPAexGothic';

    try {
        console.log('Starting font load for IPAexGothic...');
        const fontResponse = await fetch('/fonts/ipaexg.ttf');
        if (fontResponse.ok) {
            const fontBuffer = await fontResponse.arrayBuffer();
            const fontUint8Array = new Uint8Array(fontBuffer);
            let fontBinary = '';
            for (let i = 0; i < fontUint8Array.length; i++) {
                fontBinary += String.fromCharCode(fontUint8Array[i]);
            }
            const fontBase64 = btoa(fontBinary);

            console.log('IPAexGothic loaded. Registering...');
            doc.addFileToVFS('ipaexg.ttf', fontBase64);
            doc.addFont('ipaexg.ttf', fontName, 'normal');
            doc.setFont(fontName);
            console.log('IPAexGothic registered successfully.');
        } else {
            console.error('Failed to load font: response not ok', fontResponse.status);
        }
    } catch (error) {
        console.error('Failed to load Japanese font, using default:', error);
    }

    doc.setFont(fontName);
    doc.text(title, 14, 22);

    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 30,
        styles: { font: fontName, fontStyle: 'normal' },
        headStyles: { font: fontName, fontStyle: 'normal' },
        bodyStyles: { font: fontName, fontStyle: 'normal' },
    });

    doc.save(`${fileName}.pdf`);
};

import html2canvas from 'html2canvas';

/**
 * ダッシュボードの指定された要素を画像化してPDFエクスポートします
 * @param title PDFタイトル
 * @param elementIds 画像化するDOM要素のID配列
 * @param fileName ファイル名
 */
export const exportDashboardToPDF = async (title: string, elementIds: string[], fileName: string) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pdfWidth - (margin * 2);

    let yOffset = margin + 10; // Title space

    // Add Title
    // Note: Standard fonts don't support Japanese. 
    // Ideally we'd use the VFS font logic from exportToPDF, but for simplicity we'll assume the user
    // is okay with the charts themselves containing the Japanese text (as images).
    // To support Japanese title, we need the font loading logic again.
    // For now, let's try to reuse the logic if possible or just rely on images.
    // We will skip adding a text title if we can't guarantee font support, 
    // OR we can rely on the font loading logic if we duplicate it or refactor.
    // Let's assume we can use the same font loading if we copy it, but to keep it DRY we should separate it.
    // However, for this specific request, the user sees charts. 
    // Let's just create the PDF.

    // Load font for title support (copying logic for robustness)
    const fontName = 'IPAexGothic';
    try {
        const fontResponse = await fetch('/fonts/ipaexg.ttf');
        if (fontResponse.ok) {
            const fontBuffer = await fontResponse.arrayBuffer();
            const fontUint8Array = new Uint8Array(fontBuffer);
            let fontBinary = '';
            for (let i = 0; i < fontUint8Array.length; i++) {
                fontBinary += String.fromCharCode(fontUint8Array[i]);
            }
            const fontBase64 = btoa(fontBinary);
            doc.addFileToVFS('ipaexg.ttf', fontBase64);
            doc.addFont('ipaexg.ttf', fontName, 'normal');
            doc.setFont(fontName);
        }
    } catch (e) {
        console.warn('Font load failed', e);
    }

    doc.setFontSize(16);
    doc.text(title, margin, margin + 5);

    for (const id of elementIds) {
        const element = document.getElementById(id);
        if (!element) continue;

        try {
            const canvas = await html2canvas(element, {
                scale: 2, // Higher scale for better quality
                useCORS: true,
                logging: false
            });

            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const imgRatio = imgProps.width / imgProps.height;

            // Calculate dimensions to fit width
            const printWidth = contentWidth;
            const printHeight = printWidth / imgRatio;

            // Check if we need a new page
            if (yOffset + printHeight > pdfHeight - margin) {
                doc.addPage();
                yOffset = margin;
            }

            doc.addImage(imgData, 'PNG', margin, yOffset, printWidth, printHeight);
            yOffset += printHeight + 10; // Add padding between charts

        } catch (error) {
            console.error(`Error capturing element ${id}:`, error);
        }
    }

    doc.save(`${fileName}.pdf`);
};
