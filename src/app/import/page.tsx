
import { CustomerImporter } from '@/components/import/customer-importer';
import { StaffImporter } from '@/components/import/staff-importer';
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

      <StaffImporter />

      <Separator />

      <CustomerImporter />
      
    </div>
  );
}
