'use client';

import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Info, ChevronDown, ChevronUp, X } from 'lucide-react';
import { validationLogger, type ValidationLog, type ValidationSeverity } from '@/lib/order-validation-logger';

export function DataValidationPanel() {
    const [logs, setLogs] = useState<ValidationLog[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Load logs on mount
        const loadLogs = () => {
            const allLogs = validationLogger.getLogs();
            setLogs(allLogs);
        };

        loadLogs();

        // Refresh logs every 5 seconds
        const interval = setInterval(loadLogs, 5000);

        return () => clearInterval(interval);
    }, []);

    const counts = validationLogger.getCountBySeverity();
    const hasWarnings = counts.warning > 0 || counts.error > 0;

    if (!isVisible || !hasWarnings) {
        return null;
    }

    const getSeverityIcon = (severity: ValidationSeverity) => {
        if (severity === 'error') return <AlertTriangle className="h-4 w-4 text-red-500" />;
        if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
        return <Info className="h-4 w-4 text-blue-500" />;
    };

    const getSeverityColor = (severity: ValidationSeverity) => {
        if (severity === 'error') return 'bg-red-50 border-red-200';
        if (severity === 'warning') return 'bg-yellow-50 border-yellow-200';
        return 'bg-blue-50 border-blue-200';
    };

    return (
        <Card className="mb-4 border-yellow-300 bg-yellow-50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <CardTitle className="text-base">データバリデーション警告</CardTitle>
                        {counts.error > 0 && (
                            <Badge variant="destructive" className="ml-2">
                                {counts.error}件のエラー
                            </Badge>
                        )}
                        {counts.warning > 0 && (
                            <Badge variant="outline" className="ml-2 border-yellow-600 text-yellow-600">
                                {counts.warning}件の警告
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? (
                                <>
                                    <ChevronUp className="h-4 w-4 mr-1" />
                                    閉じる
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="h-4 w-4 mr-1" />
                                    詳細
                                </>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsVisible(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="pt-0">
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {logs
                            .filter(log => log.severity === 'error' || log.severity === 'warning')
                            .slice(-20) // Show last 20 issues
                            .reverse()
                            .map((log, index) => (
                                <Alert key={index} className={getSeverityColor(log.severity)}>
                                    <div className="flex items-start gap-2">
                                        {getSeverityIcon(log.severity)}
                                        <div className="flex-1 min-w-0">
                                            <AlertTitle className="text-sm font-medium mb-1">
                                                {log.orderName} (ID: {log.orderId})
                                            </AlertTitle>
                                            <AlertDescription className="text-xs">
                                                {log.reason}
                                                {log.field && ` [フィールド: ${log.field}]`}
                                                {log.value !== undefined && (
                                                    <code className="ml-1 px-1 py-0.5 bg-gray-200 rounded text-xs">
                                                        {String(log.value)}
                                                    </code>
                                                )}
                                            </AlertDescription>
                                        </div>
                                    </div>
                                </Alert>
                            ))}
                    </div>

                    <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
                        <span>
                            {logs.length > 20 ? `最新20件を表示（全${logs.length}件）` : `全${logs.length}件`}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                validationLogger.clear();
                                setLogs([]);
                            }}
                        >
                            ログをクリア
                        </Button>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
