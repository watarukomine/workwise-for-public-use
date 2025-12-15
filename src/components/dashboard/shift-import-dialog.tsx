'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '../../hooks/use-toast';
import { read, utils } from 'xlsx';
import { format, parse, isValid } from 'date-fns';
import { saveDailyAttendanceBatch, getMonthlyAttendance } from '../../services/attendance-service';
import { syncOrdersFromGasToFirestore } from '../../services/order-service';
import { Loader2, Upload } from 'lucide-react';
import { useSelectedStaff } from '../../contexts/selected-staff-context';
import type { WithId, Staff } from '../../lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { initializeFirebase } from '../../firebase';

interface ParsedShift {
    date: Date;
    staffNames: string[];
}

export function ShiftImportDialog({ onUpload }: { onUpload: (date: Date, staffIds: string[], staffName?: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedShift[]>([]);
    const [date, setDate] = useState<Date>(new Date());
    const [treatBlankAsAttendance, setTreatBlankAsAttendance] = useState(false);
    const [mergeMode, setMergeMode] = useState(true); // Default to true for safety
    const [fileStaffNames, setFileStaffNames] = useState<string[]>([]);

    // Removed authStatus logic as we use API Key only for REST fallback

    // Default month to current month
    const [targetMonth, setTargetMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
    const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
    const { toast } = useToast();
    const { allStaff } = useSelectedStaff();

    const processFile = async (data: ArrayBuffer, inverted: boolean, month: string) => {
        try {
            const workbook = read(data);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData: any[][] = utils.sheet_to_json(sheet, { header: 1 });

            if (jsonData.length === 0) throw new Error('シートが空です。');

            const shifts: ParsedShift[] = [];
            const dateMap: { colIndex: number; date: Date }[] = [];
            const selectedDate = new Date(month);

            // Capture all staff names found in the file
            const foundStaffNames = new Set<string>();

            // Helper to parse specific Japanese date format "D日" using selected month
            const parseJapaneseDay = (val: any): Date | null => {
                if (typeof val !== 'string') return null;
                const match = val.trim().match(/^(\d+)日$/);
                if (match) {
                    const day = parseInt(match[1]);
                    // Create date with selected Year/Month
                    if (!isNaN(selectedDate.getTime()) && day > 0 && day <= 31) {
                        return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                    }
                }
                return null;
            };

            const parseDateComplex = (cell: any) => {
                const jpDate = parseJapaneseDay(cell);
                if (jpDate) return jpDate;
                return parseCellToDate(cell);
            }

            // 1. Find Header Row
            let headerRowIndex = -1;
            // Increase scan header range slightly
            for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
                const row = jsonData[i];
                let dateCount = 0;
                row.forEach((cell: any) => {
                    if (parseDateComplex(cell)) dateCount++;
                });
                if (dateCount > 0) {
                    headerRowIndex = i;
                    break;
                }
            }

            if (headerRowIndex === -1) {
                setParsedData([]);
                setFileStaffNames([]);
                return;
            }

            const headerRow = jsonData[headerRowIndex];
            headerRow.forEach((cell: any, index: number) => {
                const d = parseDateComplex(cell);
                if (d) {
                    dateMap.push({ colIndex: index, date: d });
                }
            });

            // 2. Iterate Staff Rows
            for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                const staffNameCell = row[0];
                if (!staffNameCell || typeof staffNameCell !== 'string') continue;

                // Use slightly stricter trim to avoid empty rows
                if (staffNameCell.trim() === '') continue;

                const cleanName = staffNameCell.trim().replace(/\s+/g, '');
                foundStaffNames.add(staffNameCell.trim()); // Store original or slightly trimmed name

                dateMap.forEach(({ colIndex, date }) => {
                    const cellValue = row[colIndex];

                    const hasValue = cellValue !== undefined && cellValue !== null && String(cellValue).trim() !== '';
                    const isAttendance = inverted ? !hasValue : hasValue;

                    if (isAttendance) {
                        let existing = shifts.find((s: any) => s.date.getTime() === date.getTime());
                        if (!existing) {
                            existing = { date, staffNames: [] };
                            shifts.push(existing);
                        }
                        existing.staffNames.push(cleanName);
                    }
                });
            }

            shifts.sort((a, b) => a.date.getTime() - b.date.getTime());
            setParsedData(shifts);
            setFileStaffNames(Array.from(foundStaffNames));

        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: '読み込みエラー', description: e.message });
            setParsedData([]);
            setFileStaffNames([]);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            setFileData(null);
            setParsedData([]);
            return;
        }

        setIsLoading(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            setFileData(arrayBuffer);
            await processFile(arrayBuffer, treatBlankAsAttendance, targetMonth);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'ファイル読み込みエラー', description: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleInvert = (checked: boolean) => {
        setTreatBlankAsAttendance(checked);
        if (fileData) {
            processFile(fileData, checked, targetMonth);
        }
    };

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setTargetMonth(val);
        if (fileData) {
            processFile(fileData, treatBlankAsAttendance, val);
        }
    }

    const parseCellToDate = (cell: any): Date | null => {
        // Excel serial date?
        if (typeof cell === 'number' && cell > 40000) {
            // Excel base date roughly 1900-01-01. 
            // JS = (cell - 25569) * 86400 * 1000
            const jsDate = new Date((cell - 25569) * 86400 * 1000);
            // Set to current year if ambiguous? Excel serial is absolute.
            return jsDate;
        }
        if (typeof cell === 'string') {
            // Try "MM/DD", "M/D", "YYYY/MM/DD"
            // If no year, assume current year or next year?
            // Let's try parsing purely.
            const currentYear = new Date().getFullYear();
            let parsed = new Date(cell);
            if (isValid(parsed) && parsed.getFullYear() < 1950) {
                // Likely missing year "12/1" -> 1901 or 2001 depending on browser
                parsed.setFullYear(currentYear);
            }
            if (!isValid(parsed)) {
                // Try manual parse "12/1"
                const parts = cell.match(/(\d+)\/(\d+)/);
                if (parts) {
                    parsed = new Date(currentYear, parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
            }

            if (isValid(parsed)) return parsed;
        }
        return null;
    };

    const handleImport = async () => {
        if (parsedData.length === 0) return;
        setIsLoading(true);

        try {
            let successCount = 0;
            // Map staff names to IDs
            // Build map once
            const nameToId = new Map<string, string>();
            // Also keep a normalized map for fuzzy matching
            const normalizedNameToId = new Map<string, string>();

            allStaff.forEach(s => {
                const clean = s.name.replace(/\s+/g, '');
                nameToId.set(clean, s.id);
                // Normalized: Remove parens and specific chars
                const normalized = clean.replace(/[（(].*?[)）]/g, '');
                normalizedNameToId.set(normalized, s.id);
            });

            console.log('Available Staff Names:', Array.from(nameToId.keys()));

            // Gather all updates
            const batchRecords: { date: Date; staffIds: string[] }[] = [];

            parsedData.forEach((shift) => {
                const staffIds: string[] = [];
                shift.staffNames.forEach(name => {
                    // 1. Exact try
                    if (nameToId.has(name)) {
                        staffIds.push(nameToId.get(name)!);
                        return;
                    }
                    // 2. Normalized try (remove parens)
                    const norm = name.replace(/[（(].*?[)）]/g, '');
                    if (normalizedNameToId.has(norm)) {
                        staffIds.push(normalizedNameToId.get(norm)!);
                        return;
                    }
                    // 3. Partial/StartsWith match (Surname only -> Fullname)
                    // Search for system names that start with the Excel name
                    const candidates = allStaff.filter(s => {
                        const cleanSystemName = s.name.replace(/\s+/g, '');
                        return cleanSystemName.startsWith(name) || cleanSystemName.startsWith(norm);
                    });

                    if (candidates.length === 1) {
                        staffIds.push(candidates[0].id);
                        return;
                    }
                    console.warn(`Unmatched staff name: ${name}`);
                });

                if (staffIds.length > 0) {
                    batchRecords.push({ date: shift.date, staffIds });
                }
            });

            if (batchRecords.length === 0) {
                toast({
                    variant: 'destructive',
                    title: '取り込み失敗',
                    description: 'スタッフ名のマッチングに失敗し、保存対象がありませんでした。'
                });
            } else {
                // If Merge Mode is ON, we need to fetch current data first and merge
                let finalBatchRecords = batchRecords;

                if (mergeMode) {
                    try {
                        // Extract year/month from the target date of the first record (assuming all are roughly same month)
                        // Or utilize targetMonth state which is "YYYY-MM"
                        const [yStr, mStr] = targetMonth.split('-');
                        const year = parseInt(yStr);
                        const month = parseInt(mStr);

                        // Fetch current attendance
                        const currentData = await getMonthlyAttendance(year, month);

                        // Set of staff IDs found in the file (to calculate who is NOT in file)
                        const fileStaffIds = new Set<string>();
                        parsedData.forEach(shift => {
                            shift.staffNames.forEach(name => {
                                // Re-resolve to ID (inefficient to redo, but safer or we can collect from batchRecords)
                                // Actually batchRecords is better source, but batchRecords is by DATE.
                                // We need ALL staff IDs present in the file across ALL dates?
                                // "Update only staff in file" usually means:
                                // If Staff A is in the file (even if absent), we update Staff A.
                                // If Staff B is NOT in the file at all, we keep Staff B's current data.
                                // So we need a set of "Staff IDs processed in this file".
                                // Let's collect from nameToId match we did earlier.
                            });
                        });

                        // Let's gather all IDs appearing in the import file (based on the names we matched)
                        const participatingStaffIds = new Set<string>();

                        // Use the captured 'fileStaffNames' which includes everyone in the file rows
                        fileStaffNames.forEach(name => {
                            const clean = name.replace(/\s+/g, '');
                            if (nameToId.has(clean)) participatingStaffIds.add(nameToId.get(clean)!);
                            const norm = name.replace(/[（(].*?[)）]/g, '');
                            if (normalizedNameToId.has(norm)) participatingStaffIds.add(normalizedNameToId.get(norm)!);
                        });

                        // Now merge
                        finalBatchRecords = batchRecords.map(record => {
                            const dateKey = format(record.date, 'yyyy-MM-dd');
                            const currentIds = currentData[dateKey] || [];
                            // IDs to keep: Current IDs that are NOT in the participating set
                            const idsToKeep = currentIds.filter((id: string) => !participatingStaffIds.has(id));
                            // IDs from file: record.staffIds
                            // New list = Kept + File
                            return {
                                date: record.date,
                                staffIds: Array.from(new Set([...idsToKeep, ...record.staffIds]))
                            };
                        });

                        // Also we must handle dates that are in the file but have NO ONE present?
                        // `batchRecords` only contains dates where SOMEONE is present?
                        // No, logic above pushes to `batchRecords` from `parsedData`.
                        // `parsedData` handles generic "Shift" object.
                        // If `parsedData` has a date, it means it was a column in Excel.
                        // We should process ALL dates in `parsedData` to ensure overwrites happen even if empty?
                        // `batchRecords` construction above iterates `parsedData`.
                        // If file says "Staff A: Absent", then Staff A is NOT in `record.staffIds`.
                        // Merge logic: Keep Staff B, Add Staff A (absent=empty). Result: Staff B. Correct.

                    } catch (e) {
                        console.error("Merge failed", e);
                        toast({ variant: 'destructive', title: 'マージ失敗', description: '現在のデータの取得に失敗しました。上書きモードで試してください。' });
                        return; // Stop
                    }
                }

                // Execute batch
                await saveDailyAttendanceBatch(finalBatchRecords);

                // Trigger Order Sync to Firestore to ensure Dashboard is fast and up-to-date
                try {
                    toast({ title: 'シフト取込完了', description: '続けて案件データの同期を実行しています...' });
                    const syncResult = await syncOrdersFromGasToFirestore();
                    if (syncResult.success) {
                        toast({ title: '同期完了', description: `シフトと案件データ(${syncResult.count}件)の同期が完了しました。` });
                    } else {
                        toast({ variant: 'destructive', title: '案件同期エラー', description: `シフトは保存されましたが、案件同期に失敗しました: ${syncResult.error}` });
                    }
                } catch (syncError: any) {
                    console.error("Auto-sync failed:", syncError);
                    toast({ variant: 'destructive', title: '案件同期エラー', description: `シフトは保存されましたが、案件同期に失敗しました: ${syncError.message}` });
                }

                setIsOpen(false);
                setParsedData([]);
                // For batch upload, we might not need specific args for onUpload if it just triggers a refresh.
                // However, the signature requires (date, staffIds).
                // We'll pass the first record's data to trigger the refresh, or we might need to adjust the prop type.
                // For now, let's just trigger it with the first date found to ensure refresh happens.
                if (batchRecords.length > 0) {
                    onUpload(batchRecords[0].date, batchRecords[0].staffIds);
                }
            }
            // Cleanup states
            setParsedData([]);
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: '保存エラー', description: e.message });
        } finally {
            setIsLoading(false);
        }
    };


    const handleTestConnection = async () => {
        try {
            await saveDailyAttendanceBatch([{ date: new Date('2025-01-01'), staffIds: [] }]);
            toast({ title: '接続テスト成功', description: 'Firestoreへの書き込みに成功しました。' });
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: '接続テスト失敗', description: e.message });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    シフト取込
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>シフト表（Excel）の取り込み</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                    Excelのシフト表をアップロードして、出勤データを取り込みます。<br />
                    「空欄＝出勤」のルールにも対応しています。
                </DialogDescription>

                <div className="grid gap-4 py-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="target-month">対象年月</Label>
                        <Input
                            id="target-month"
                            type="month"
                            value={targetMonth}
                            onChange={handleMonthChange}
                        />
                        <p className="text-xs text-muted-foreground">「1日」などの日付形式の場合、この年月が適用されます。</p>
                    </div>

                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="shift-file">Excelファイル</Label>
                        <Input id="shift-file" type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="invert-mode"
                            checked={treatBlankAsAttendance}
                            onCheckedChange={handleToggleInvert}
                        />
                        <Label htmlFor="invert-mode">空欄を出勤として扱う</Label>
                    </div>
                    <p className="text-sm text-muted-foreground ml-12">
                        ※ ONにすると、空欄を「出勤」、文字（シ、有、振、特など）が入っているセルを「欠席」として取り込みます。
                    </p>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="merge-mode"
                            checked={mergeMode}
                            onCheckedChange={setMergeMode}
                        />
                        <Label htmlFor="merge-mode">ファイルに含まれるスタッフのみ更新 (他は維持)</Label>
                    </div>

                    {parsedData.length > 0 && (
                        <div className="border rounded-md p-2 bg-muted/50">
                            <p className="text-sm font-medium mb-2">プレビュー ({parsedData.length}日分)</p>
                            <ScrollArea className="h-[200px]">
                                <div className="space-y-1">
                                    {parsedData.map((d, i) => (
                                        <div key={i} className="text-sm flex justify-between px-2 py-1 border-b last:border-0">
                                            <span className="font-mono">{format(d.date, 'yyyy/MM/dd')}</span>
                                            <span className="text-muted-foreground">{d.staffNames.length}名: {d.staffNames.slice(0, 3).join(', ')}{d.staffNames.length > 3 ? '...' : ''}</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" size="sm" onClick={handleTestConnection} className="mr-auto text-xs">
                        接続テスト
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>キャンセル</Button>
                    <div className="flex flex-col gap-2">
                        <Button onClick={handleImport} disabled={isLoading || parsedData.length === 0}>
                            {isLoading ? 'インポート中...' : 'インポート実行'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
