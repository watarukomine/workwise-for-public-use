
import { GasImporter } from '@/components/import/gas-importer';
import { ShiftImporter } from '@/components/import/shift-importer';
import { Separator } from '@/components/ui/separator';

export default function ImportPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">データインポート</h1>
        <p className="text-muted-foreground">
          各種データをインポートしてアプリケーションに反映します。
        </p>
      </div>

      <ShiftImporter />

      <Separator />

      <div className="space-y-4">
         <div>
            <h2 className="text-xl font-semibold tracking-tight">スプレッドシートデータ取得</h2>
            <p className="text-muted-foreground">
            公開されたGoogle Apps ScriptのウェブアプリURLからデータをインポートします。
            </p>
         </div>
        <GasImporter />
      </div>
    </div>
  );
}
