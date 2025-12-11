'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { read, utils } from 'xlsx';
import { format, parse, isValid } from 'date-fns';
import { saveDailyAttendance } from '@/services/attendance-service';
import { Loader2, Upload } from 'lucide-react';
import { useSelectedStaff } from '@/contexts/selected-staff-context';
import type { WithId, Staff } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

interface ParsedShift {
    date: Date;
    staffNames: string[];
}

export function ShiftImportDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedShift[]>([]);
    const [treatBlankAsAttendance, setTreatBlankAsAttendance] = useState(false);
    const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
    const { toast } = useToast();
    const { allStaff } = useSelectedStaff();

    const processFile = async (data: ArrayBuffer, inverted: boolean) => {
        try {
            const workbook = read(data);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData: any[][] = utils.sheet_to_json(sheet, { header: 1 });

            if (jsonData.length === 0) throw new Error('シートが空です。');

            const shifts: ParsedShift[] = [];
            const dateMap: { colIndex: number; date: Date }[] = [];

            // 1. Find Header Row
            let headerRowIndex = -1;
            for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
                const row = jsonData[i];
                let dateCount = 0;
                row.forEach((cell: any) => {
                    if (parseCellToDate(cell)) dateCount++;
                });
                if (dateCount > 3) {
                    headerRowIndex = i;
                    break;
                }
            }

            if (headerRowIndex === -1) {
                setParsedData([]);
                return; // fail silently or throw?
            }

            const headerRow = jsonData[headerRowIndex];
            headerRow.forEach((cell: any, index: number) => {
                const d = parseCellToDate(cell);
                if (d) {
                    dateMap.push({ colIndex: index, date: d });
                }
            });

            // 2. Iterate Staff Rows
            for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                const staffNameCell = row[0];
                if (!staffNameCell || typeof staffNameCell !== 'string') continue;

                const cleanName = staffNameCell.trim().replace(/\s+/g, '');

                dateMap.forEach(({ colIndex, date }) => {
                    const cellValue = row[colIndex];

                    // Logic:
                    // Default (inverted=false): Cell has value => Attendance.
                    // Inverted (inverted=true): Cell is empty/undefined => Attendance. Cell has value => Holiday.

                    const hasValue = cellValue !== undefined && cellValue !== null && String(cellValue).trim() !== '';
                    const isAttendance = inverted ? !hasValue : hasValue;

                    if (isAttendance) {
                        let existing = shifts.find(s => s.date.getTime() === date.getTime());
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

        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: '読み込みエラー', description: e.message });
            setParsedData([]);
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
            await processFile(arrayBuffer, treatBlankAsAttendance);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'ファイル読み込みエラー', description: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleInvert = (checked: boolean) => {
        setTreatBlankAsAttendance(checked);
        if (fileData) {
            processFile(fileData, checked);
        }
    };

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
            allStaff.forEach(s => {
                nameToId.set(s.name.replace(/\s+/g, ''), s.id);
            });

            await Promise.all(parsedData.map(async (shift) => {
                const staffIds = shift.staffNames.map(name => nameToId.get(name)).filter(id => id !== undefined) as string[];
                if (staffIds.length > 0) {
                    await saveDailyAttendance(shift.date, staffIds);
                    successCount++;
                }
            }));

            toast({ title: 'インポート完了', description: `${successCount}日分のシフトを取り込みました。` });
            setIsOpen(false);
            setParsedData([]);
        } catch (e: any) {
            toast({ variant: 'destructive', title: '保存エラー', description: e.message });
        } finally {
            setIsLoading(false);
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
                    <DialogDescription>
                        Excelファイルを選択してください。1行目を日付、A列をスタッフ名として認識します。
                        セルに入力がある場合を「出勤」とみなします。
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="shift-file">Excelファイル</Label>
                        <Input id="shift-file" type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="invert-import"
                            checked={treatBlankAsAttendance}
                            onCheckedChange={(checked: boolean | 'indeterminate') => handleToggleInvert(checked === true)}
                        />
                        <Label htmlFor="invert-import" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            空白セルを出勤として扱う（文字入力＝休み）
                        </Label>
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
                    <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>キャンセル</Button>
                    <Button type="button" onClick={handleImport} disabled={parsedData.length === 0 || isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        インポート実行
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
