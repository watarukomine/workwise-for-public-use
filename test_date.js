const parseSafeDate = (dateString, isTimeOnly = false, baseDateString = null) => {
    if (!dateString) return "";
    try {
        if (isTimeOnly) {
            if (typeof dateString === 'string' && (dateString.match(/^\d{1,2}:\d{2}$/) || dateString.match(/^\d{1,2}:\d{2}:\d{2}$/))) {
                const parts = dateString.split(':');
                const h = parseInt(parts[0], 10) || 0;
                const m = parseInt(parts[1], 10) || 0;
                const s = parts[2] ? parseInt(parts[2], 10) : 0;
                if (baseDateString) {
                    const d = new Date(baseDateString);
                    if (!isNaN(d.getTime())) {
                        d.setHours(h, m, s, 0);
                        return d;
                    }
                }
                const dToday = new Date();
                dToday.setHours(h, m, s, 0);
                return dToday;
            }
        }
        if (typeof dateString === 'string' && dateString.includes('-')) {
            if (dateString.length === 10) return dateString;
        }
        const d = new Date(dateString);
        if (!isNaN(d.getTime())) return d;
        return dateString;
    } catch (e) {
        return dateString;
    }
};

console.log("Empty:", parseSafeDate(""));
console.log("Time format without base:", parseSafeDate("09:00", true));
console.log("Time format with base yyyy/MM/dd:", parseSafeDate("14:02", true, "2026/02/26"));
console.log("Time format with base yyyy-MM-dd:", parseSafeDate("13:55", true, "2026-02-26"));
console.log("Full timestamp:", parseSafeDate("2026-02-26T14:02:00.000Z", true, "2026/02/26"));
