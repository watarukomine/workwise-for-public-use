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
 * レイアウト配置と1ページへの収まりを考慮して縮小します
 * @param title PDFタイトル
 * @param layoutIds 画像化するDOM要素のID配列（文字列=1行全幅、配列=その行で分割配置）
 * @param fileName ファイル名
 */
export const exportDashboardToPDF = async (title: string, layoutIds: (string | string[])[], fileName: string) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pdfWidth - (margin * 2);

    // Title area
    const titleHeight = 15;
    const contentAvailableHeight = pdfHeight - (margin * 2) - titleHeight;

    // Load font (Same logic as before)
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

    doc.setFontSize(14);
    doc.text(title, margin, margin + 5);

    // 1. Capture All Images & Calculate Dimensions
    const capturedRows: { items: { imgData: string, ratio: number }[], height: number }[] = [];
    let totalNeededHeight = 0;

    for (const row of layoutIds) {
        const itemIds = Array.isArray(row) ? row : [row];
        const rowItems = [];
        let maxRowRatio = 0;

        // Determine width per item in this row
        const itemWidth = typeof row === 'string' ? contentWidth : (contentWidth - ((itemIds.length - 1) * 5)) / itemIds.length;

        for (const id of itemIds) {
            const element = document.getElementById(id);
            if (!element) continue;

            try {
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false
                });
                const imgData = canvas.toDataURL('image/png');
                const ratio = canvas.width / canvas.height;
                rowItems.push({ imgData, ratio });
            } catch (error) {
                console.error(`Error capturing ${id}`, error);
            }
        }

        if (rowItems.length > 0) {
            // Calculate row height based on the first item's ratio (assuming uniform height in grid)
            // or taking the "tallest" requirement?
            // Usually grid items should align. Let's take the first item's height as reference or average.
            // Height = Width / Ratio
            const rowHeight = itemWidth / rowItems[0].ratio;
            capturedRows.push({ items: rowItems, height: rowHeight });
            totalNeededHeight += rowHeight + 5; // +5 padding
        }
    }

    // 2. Calculate Scale Factor
    let scale = 1;
    if (totalNeededHeight > contentAvailableHeight) {
        scale = contentAvailableHeight / totalNeededHeight;
    }

    // 3. Render
    let currentY = margin + titleHeight;

    for (const row of capturedRows) {
        const itemCount = row.items.length;
        // Recalculate width with scale
        // Padding between grid items should strictly be handled. 
        // gap = 5mm
        const gap = 5;
        const totalGap = (itemCount - 1) * gap;
        // Available width for content is also scaled? No, width is fixed to page. 
        // We only scale HEIGHT usually to fit? 
        // If we simply reduce vertical size, we squish the image. We must scale PROPORTIONALLY.
        // So we reduce the rendered WIDTH and HEIGHT by 'scale'.
        // But wait, if we reduce Width, we leave empty space on the right.
        // The user wants to FIT everything on one page.
        // If the content is too tall, we must shrink it.
        // To shrink it proportionally, we must reduce the Width too.
        // This results in centering the smaller content ?

        // Actually, 'scale' here is just a multiplier for the dimensions we draw.
        // If we draw smaller, we use less Y.
        // We probably want to center the content horizontally if we scale down.

        const rowWidth = contentWidth * scale; // Shrink total width to match height reduction ratio?
        // No, that keeps aspect ratio.

        const itemWidthUnscaled = (contentWidth - totalGap) / itemCount;
        const finalItemWidth = itemWidthUnscaled * scale;
        const finalRowHeight = row.height * scale;
        const finalGap = gap * scale;

        // Center horizontally
        let currentX = margin + (contentWidth - ((finalItemWidth * itemCount) + (finalGap * (itemCount - 1)))) / 2;

        for (const item of row.items) {
            doc.addImage(item.imgData, 'PNG', currentX, currentY, finalItemWidth, finalRowHeight);
            currentX += finalItemWidth + finalGap;
        }

        currentY += finalRowHeight + (5 * scale);
    }

    doc.save(`${fileName}.pdf`);
};
