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

    try {
        const fontResponse = await fetch('/fonts/NotoSansJP-Regular.ttf');
        if (fontResponse.ok) {
            const fontBuffer = await fontResponse.arrayBuffer();
            const fontUint8Array = new Uint8Array(fontBuffer);
            let fontBinary = '';
            for (let i = 0; i < fontUint8Array.length; i++) {
                fontBinary += String.fromCharCode(fontUint8Array[i]);
            }
            const fontBase64 = btoa(fontBinary);

            doc.addFileToVFS('NotoSansJP.ttf', fontBase64);
            doc.addFont('NotoSansJP.ttf', 'NotoSansJP', 'normal');
            doc.setFont('NotoSansJP');
        } else {
            console.error('Failed to load font: response not ok');
        }
    } catch (error) {
        console.error('Failed to load Japanese font, using default:', error);
    }

    doc.text(title, 14, 22);

    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 30,
        styles: { font: 'NotoSansJP' },
    });

    doc.save(`${fileName}.pdf`);
};

/**
 * 日本語対応のPDFエクスポート（VFS使用）
 * ※実際の日本語フォントデータ(.ttf)をBase64化してVFSに登録する必要がありますが、
 * アプリ容量が増えるため、今回は簡易的に画像としてチャートを埋め込むか、
 * Excel出力を推奨する運用とします。
 * 
 * この関数はプレースホルダーです。
 */
export const exportToPDFWithChart = (chartId: string, fileName: string) => {
    // チャートのDOM要素を取得して画像化し、PDFに貼り付ける実装などが考えられます
    // 今後の拡張用
};
