'use client';

import * as React from 'react';
import Papa from 'papaparse';
import { getFirebase, useUser } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2, CheckCircle, AlertCircle, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { signInWithGoogle } from '@/lib/auth';

type DataType = 'customers' | 'staff' | 'schedules';
type Status = 'idle' | 'parsing' | 'importing' | 'success' | 'error';

const { firestore } = getFirebase(); // Get the singleton firestore instance

export function DataImporter() {
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [dataType, setDataType] = React.useState<DataType>('customers');
  const [status, setStatus] = React.useState<Status>('idle');
  const [progress, setProgress] = React.useState(0);
  const [results, setResults] = React.useState({ success: 0, failed: 0 });

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setStatus('idle');
      setProgress(0);
      setResults({ success: 0, failed: 0 });
    }
  };

  const handleImport = async () => {
    if (!file || !firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a file and ensure you are signed in.',
      });
      return;
    }

    setStatus('parsing');
    setProgress(0);
    setResults({ success: 0, failed: 0 });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parseResults) => {
        const data = parseResults.data as any[];
        if (data.length === 0) {
          setStatus('error');
          toast({ variant: 'destructive', title: 'Empty File', description: 'The selected CSV file is empty or invalid.' });
          return;
        }

        setStatus('importing');
        let successCount = 0;
        let failedCount = 0;
        const totalRecords = data.length;

        for (const record of data) {
           try {
            const collectionName = dataType === 'schedules' ? `staff/${record.staffId}/workSchedules` : dataType;
            const collectionRef = collection(firestore, collectionName);
            const recordId = record.id || doc(collectionRef).id;
            const docRef = doc(collectionRef, recordId);

            let dataToImport: any = { ...record };

            if (dataType === 'customers' && record.緯度 && record.経度) {
              dataToImport.latitude = parseFloat(record.緯度) || null;
              dataToImport.longitude = parseFloat(record.経度) || null;
            } else if (dataType === 'schedules') {
              dataToImport.startTime = new Date(record.startTime);
              dataToImport.endTime = new Date(record.endTime);
            }
            delete dataToImport.id; 
            
            await setDoc(docRef, dataToImport, { merge: true })
            successCount++;
          } catch (serverError) {
            failedCount++;
            const collectionName = dataType === 'schedules' ? `staff/${record.staffId}/workSchedules` : dataType;
            const collectionRef = collection(firestore, collectionName);
            const recordId = record.id || 'unknown-id';
            const docRef = doc(collectionRef, recordId);
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'write',
              requestResourceData: record,
            });
            errorEmitter.emit('permission-error', permissionError);
          } finally {
            const processedCount = successCount + failedCount;
            setProgress((processedCount / totalRecords) * 100);
          }
        }

        setResults({ success: successCount, failed: failedCount });
        setStatus(failedCount > 0 ? 'error' : 'success');
        toast({
            title: 'Import Complete',
            description: `${successCount} records imported successfully. ${failedCount} failed.`,
            variant: failedCount > 0 ? 'destructive' : 'default',
        });
      },
      error: (error: any) => {
        setStatus('error');
        toast({ variant: 'destructive', title: 'Parsing Error', description: error.message });
      },
    });
  };

  const isProcessing = status === 'parsing' || status === 'importing';

  if (isUserLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
          <CardDescription>Upload a CSV file to import data into your Firestore collections.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to import data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>You are not signed in.</AlertTitle>
              <AlertDescription>
                You must be signed in with a Google account to perform this action.
              </AlertDescription>
            </Alert>
            <Button onClick={handleSignIn} className="mt-4">
              <LogIn className="mr-2 h-4 w-4" />
              Sign In with Google
            </Button>
          </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Data</CardTitle>
        <CardDescription>Upload a CSV file to import data into your Firestore collections.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Data Type</Label>
          <RadioGroup value={dataType} onValueChange={(value: any) => setDataType(value)} className="flex gap-4">
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

        <Button onClick={handleImport} disabled={!file || isProcessing || !user} className="w-full sm:w-auto">
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {status === 'importing' ? `Importing... (${Math.round(progress)}%)` : 'Import Data'}
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
              {results.success} records imported, {results.failed} failed. Check the developer console for details.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
