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
export const exportToPDF = (title: string, headers: string[], data: any[][], fileName: string) => {
    const doc = new jsPDF();

    // 日本語フォント対応が必要な場合、本来はフォント追加が必要ですが、
    // クライアントサイドのみでの簡易実装としては、英数字中心のレポートにするか、
    // あるいは画像化して貼り付けるアプローチがありますが、今回は標準フォントで実装します。
    // ※日本語は文字化けする可能性があるため、実運用ではフォント読み込みが必要です。
    // ここでは一旦、基本的な英数字データが主力と仮定しつつ、注意書きなどを入れます。

    doc.text(title, 14, 22);

    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 30,
        styles: { font: 'helvetica' }, // 日本語フォントがないため、日本語は文字化けする可能性が高いことに注意
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
