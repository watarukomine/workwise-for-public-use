
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default function ImportPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data Importer</h1>
        <p className="text-muted-foreground">
          Import data from CSV files.
        </p>
      </div>
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>Under Construction</AlertTitle>
        <AlertDescription>
          The data import feature is currently disabled. All required data is pre-loaded within the application.
        </AlertDescription>
      </Alert>
    </div>
  );
}
