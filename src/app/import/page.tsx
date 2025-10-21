import { DataImporter } from "@/components/import/data-importer";

export default function ImportPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data Importer</h1>
        <p className="text-muted-foreground">
          Import data from CSV files into Firestore.
        </p>
      </div>
      <DataImporter />
    </div>
  );
}
