/**
 * Utility for downloading CSV import templates.
 */

export const downloadCSVTemplate = (type: 'orders' | 'customers' | 'staff') => {
  let headers: string[] = [];
  let sampleRow: string[] = [];
  let filename = '';

  if (type === 'orders') {
    headers = [
      '受注ID', 'SystemID', '顧客コード', 'お取引先名', '主管店舗', '作業内容', 
      '作業予定日', '予定時間', 'ご担当者様', '注文番号', '任意コメント', 
      '車名', '登録ナンバー', '受注ステータス', 'タイヤ品番', 'タイヤサイズ', 
      '品名', '本数', '空気圧センサーパッキン交換', 'タイヤ手配状況', 
      '廃タイヤ処分', '連絡者名', '特記事項', 'フォーム入力者'
    ];
    sampleRow = [
      '1', '20260624_05155_abc', '05155', '津久井店', '相模原', '販売店店舗内作業',
      '2026/06/24', '10:00', '担当者名', '12345678', 'コメント',
      'プリウス', '湘南500あ1234', '入庫待ち', 'T1000', '195/65R15',
      'エコピア', '4', '無', '定期便で配送手配済',
      '回収有り：廃タイヤラベル在庫有り', '連絡者名', '特記事項など', 'フォーム入力者名'
    ];
    filename = '受注データ_テンプレート.csv';
  } else if (type === 'customers') {
    headers = ['ユーザーコード', '店舗', '住所', '電話番号', '機材有無', '母店'];
    sampleRow = ['05155', '津久井店', '相模原市緑区太井１４１', '042-784-XXXX', '○', '相模原'];
    filename = '販売店情報_テンプレート.csv';
  } else if (type === 'staff') {
    headers = ['name', 'email', 'role', 'area', '母店', 'color'];
    sampleRow = ['山田 太郎', 'yamada@example.com', 'staff', '県央', '厚木', '#EF4444'];
    filename = 'スタッフ登録_テンプレート.csv';
  }

  const csvContent = [headers, sampleRow].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
