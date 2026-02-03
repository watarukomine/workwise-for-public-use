/**
 * Order Validation Logger
 * 
 * Tracks orders that fail validation or parsing, preventing silent data loss.
 * Logs are stored in sessionStorage for debugging purposes.
 */

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationLog {
    orderId: string;
    orderName: string;
    severity: ValidationSeverity;
    reason: string;
    field?: string;
    value?: any;
    timestamp: Date;
    source: 'utils' | 'order-context';
}

const STORAGE_KEY = 'order_validation_logs';
const MAX_LOGS = 100; // Keep last 100 logs

class OrderValidationLogger {
    private logs: ValidationLog[] = [];

    constructor() {
        this.loadLogs();
    }

    /**
     * Log a validation issue
     */
    log(log: Omit<ValidationLog, 'timestamp'>): void {
        const fullLog: ValidationLog = {
            ...log,
            timestamp: new Date(),
        };

        this.logs.push(fullLog);

        // Keep only the last MAX_LOGS entries
        if (this.logs.length > MAX_LOGS) {
            this.logs = this.logs.slice(-MAX_LOGS);
        }

        this.saveLogs();

        // Also log to console in development
        if (process.env.NODE_ENV === 'development') {
            const prefix = log.severity === 'error' ? '❌' : log.severity === 'warning' ? '⚠️' : 'ℹ️';
            console.log(
                `${prefix} [Order Validation] ${log.orderName} (${log.orderId}): ${log.reason}`,
                log.field ? `Field: ${log.field}` : '',
                log.value !== undefined ? `Value: ${log.value}` : ''
            );
        }
    }

    /**
     * Get all logs
     */
    getLogs(): ValidationLog[] {
        return [...this.logs];
    }

    /**
     * Get logs by severity
     */
    getLogsBySeverity(severity: ValidationSeverity): ValidationLog[] {
        return this.logs.filter(log => log.severity === severity);
    }

    /**
     * Get logs for a specific order
     */
    getLogsForOrder(orderId: string): ValidationLog[] {
        return this.logs.filter(log => log.orderId === orderId);
    }

    /**
     * Clear all logs
     */
    clear(): void {
        this.logs = [];
        this.saveLogs();
    }

    /**
     * Get count by severity
     */
    getCountBySeverity(): Record<ValidationSeverity, number> {
        return {
            error: this.logs.filter(l => l.severity === 'error').length,
            warning: this.logs.filter(l => l.severity === 'warning').length,
            info: this.logs.filter(l => l.severity === 'info').length,
        };
    }

    private loadLogs(): void {
        if (typeof window === 'undefined') return;

        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.logs = parsed.map((log: any) => ({
                    ...log,
                    timestamp: new Date(log.timestamp),
                }));
            }
        } catch (e) {
            console.error('Failed to load validation logs:', e);
        }
    }

    private saveLogs(): void {
        if (typeof window === 'undefined') return;

        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
        } catch (e) {
            console.error('Failed to save validation logs:', e);
        }
    }
}

// Singleton instance
export const validationLogger = new OrderValidationLogger();

// Helper functions for common validation scenarios

export function logMissingField(
    orderId: string,
    orderName: string,
    field: string,
    source: 'utils' | 'order-context'
): void {
    validationLogger.log({
        orderId,
        orderName,
        severity: 'warning',
        reason: `必須フィールド「${field}」が見つかりません`,
        field,
        source,
    });
}

export function logInvalidDate(
    orderId: string,
    orderName: string,
    field: string,
    value: any,
    source: 'utils' | 'order-context'
): void {
    validationLogger.log({
        orderId,
        orderName,
        severity: 'warning',
        reason: '無効な日付形式',
        field,
        value,
        source,
    });
}

export function logStaffNotFound(
    orderId: string,
    orderName: string,
    staffName: string,
    source: 'utils' | 'order-context'
): void {
    validationLogger.log({
        orderId,
        orderName,
        severity: 'warning',
        reason: `スタッフマスタに「${staffName}」が見つかりません`,
        field: 'staffName',
        value: staffName,
        source,
    });
}

export function logOldDateDetected(
    orderId: string,
    orderName: string,
    field: string,
    value: any,
    source: 'utils' | 'order-context'
): void {
    validationLogger.log({
        orderId,
        orderName,
        severity: 'info',
        reason: '古い日付（1899/1900）を検出し、F列の日付と組み合わせました',
        field,
        value,
        source,
    });
}
