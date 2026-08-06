// src/workers/attendanceWorker.ts
// This Web Worker parses the August 2026 CSV schedule data.
// It receives a message payload: { date: string, csv: string }
// Returns an array of staff names that are available (i.e., cell is blank) for the given date.

self.addEventListener('message', (event) => {
  const { date, csv } = event.data;
  const target = new Date(date);
  const dayIdx = target.getDate() - 1; // CSV is zero-indexed by day
  const lines = csv.trim().split('\n');
  const availableNames = [];
  for (const line of lines) {
    const parts = line.split(',');
    const name = parts[1]?.trim();
    const days = parts.slice(3);
    const val = String(days[dayIdx] || '').trim();
    // If cell is empty (no character), staff is considered able to go to the site.
    if (!val) {
      if (name) availableNames.push(name);
    }
  }
  self.postMessage({ availableNames });
});
