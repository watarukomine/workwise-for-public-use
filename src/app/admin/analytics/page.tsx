import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '分析ダッシュボード | WorkWise',
    description: '管理者用分析ダッシュボード',
};

export default function AnalyticsPage() {
    return (
        <div className="container mx-auto py-8">
            <AnalyticsDashboard />
        </div>
    );
}
