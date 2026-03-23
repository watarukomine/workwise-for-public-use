
'use client';
import { useState } from 'react';
import { optimizeRoute } from '@/ai/flows/optimize-route-for-efficiency';

export default function AiDebugPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testOptimize = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await optimizeRoute({
        startLocation: { id: 's1', name: 'Start', address: 'A1', latitude: 35.681236, longitude: 139.767125, type: 'staff' },
        endLocation: { id: 'e1', name: 'End', address: 'A2', latitude: 35.658581, longitude: 139.745433, type: 'customer' },
        waypoints: [],
        optimizeFor: 'time',
        avoidHighways: false,
      });
      setResult(res);
    } catch (e: any) {
      console.error(e);
      setError({
        message: e.message,
        name: e.name,
        stack: e.stack,
        digest: e.digest,
        details: e.details,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">AI Route Optimization Debug (STILL INVESTIGATING)</h1>
      <button 
        onClick={testOptimize} 
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Testing...' : 'Test optimizeRoute (Server Action)'}
      </button>

      {error && (
        <div className="p-4 bg-red-100 text-red-800 border border-red-300 rounded whitespace-pre-wrap font-mono text-sm">
          <h2 className="font-bold mb-2">Error!</h2>
          <p>Name: {error.name}</p>
          <p>Message: {error.message}</p>
          <p>Digest: {error.digest}</p>
          <div className="mt-2 text-xs opacity-70">
            Stack: {error.stack}
          </div>
        </div>
      )}

      {result && (
        <div className="p-4 bg-green-100 text-green-800 border border-green-300 rounded">
          <h2 className="font-bold mb-2">Success!</h2>
          <pre className="text-sm font-mono">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
