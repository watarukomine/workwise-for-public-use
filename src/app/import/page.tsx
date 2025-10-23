
import { GasImporter } from '@/components/import/gas-importer';

export default function ImportPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">GASデータインポーター</h1>
        <p className="text-muted-foreground">
          公開されたGoogle Apps ScriptのウェブアプリURLからデータをインポートします。
        </p>
      </div>
      <GasImporter />
    </div>
  );
}
