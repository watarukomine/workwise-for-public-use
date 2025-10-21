'use client';

import * as React from 'react';
import Papa from 'papaparse';
import { useFirebase } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

type DataType = 'customers' | 'staff' | 'schedules';
type Status = 'idle' | 'parsing' | 'importing' | 'success' | 'error';

export function DataImporter() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [dataType, setDataType] = React.useState<DataType>('customers');
  const [status, setStatus] = React.useState<Status>('idle');
  const [progress, setProgress] = React.useState(0);
  const [results, setResults] = React.useState({ success: 0, failed: 0 });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setStatus('idle');
      setProgress(0);
      setResults({ success: 0, failed: 0 });
    }
  };

  const handleImport = async () => {
    if (!file || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a file and ensure you are connected.',
      });
      return;
    }

    setStatus('parsing');
    setProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        if (data.length === 0) {
          setStatus('error');
          toast({ variant: 'destructive', title: 'Empty File', description: 'The selected CSV file is empty or invalid.' });
          return;
        }

        setStatus('importing');
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < data.length; i++) {
          const record = data[i];
          const collectionRef = collection(firestore, dataType);
          // Use a specific ID from the CSV or generate a new one
          const recordId = record.id || doc(collectionRef).id;
          const docRef = doc(collectionRef, recordId);
          
          // Simple data cleaning/transformation
          let dataToImport: any = { ...record };
          if (dataType === 'customers') {
              dataToImport.latitude = parseFloat(record.latitude) || null;
              dataToImport.longitude = parseFloat(record.longitude) || null;
          } else if (dataType === 'schedules') {
              dataToImport.startTime = new Date(record.startTime);
              dataToImport.endTime = new Date(record.endTime);
          }
          
          setDoc(docRef, dataToImport, { merge: true })
            .then(() => {
              successCount++;
            })
            .catch(async (serverError) => {
              failedCount++;
              const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'write',
                requestResourceData: dataToImport,
              });
              errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                const processedCount = successCount + failedCount;
                setProgress((processedCount / data.length) * 100);

                if (processedCount === data.length) {
                    setResults({ success: successCount, failed: failedCount });
                    setStatus(failedCount > 0 ? 'error' : 'success');

                    toast({
                        title: 'Import Complete',
                        description: `${successCount} records imported successfully. ${failedCount} failed.`,
                        variant: failedCount > 0 ? 'destructive' : 'default',
                    });
                }
            });
        }
      },
      error: (error: any) => {
        setStatus('error');
        toast({ variant: 'destructive', title: 'Parsing Error', description: error.message });
      },
    });
  };

  const isProcessing = status === 'parsing' || status === 'importing';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Data</CardTitle>
        <CardDescription>Upload a CSV file to import data into your Firestore collections.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Data Type</Label>
          <RadioGroup value={dataType} onValueChange={(value: DataType) => setDataType(value)} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="customers" id="customers" />
              <Label htmlFor="customers">Customers</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="staff" id="staff" />
              <Label htmlFor="staff">Staff</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="schedules" id="schedules" />
              <Label htmlFor="schedules">Schedules</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="csv-file">CSV File</Label>
          <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} disabled={isProcessing} />
        </div>

        <Button onClick={handleImport} disabled={!file || isProcessing} className="w-full sm:w-auto">
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {status === 'importing' ? `Importing...` : 'Import Data'}
        </Button>

        {(status === 'importing' || status === 'success' || status === 'error') && (
          <div className="space-y-2 pt-4">
            <Label>Import Progress</Label>
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">{Math.round(progress)}%</p>
          </div>
        )}

        {status === 'success' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Import Successful!</AlertTitle>
            <AlertDescription>
              {results.success} records were successfully imported.
            </AlertDescription>
          </Alert>
        )}

        {status === 'error' && results.failed > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Import Finished with Errors</AlertTitle>
            <AlertDescription>
              {results.success} records imported, {results.failed} failed. Check the console for details.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
