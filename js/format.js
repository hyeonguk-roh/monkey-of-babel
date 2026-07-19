const SUFFIXES = ['K', 'M', 'B', 'T'];

// 950 -> "950", 1500 -> "1.5K", 2400000 -> "2.4M"
export function formatNumber(value) {
    const n = Math.floor(value);
    if (n < 1000) return n.toString();

    let scaled = n;
    let suffixIndex = -1;
    while (scaled >= 1000 && suffixIndex < SUFFIXES.length - 1) {
        scaled /= 1000;
        suffixIndex += 1;
    }
    return scaled.toFixed(1) + SUFFIXES[suffixIndex];
}

// 0.03 -> "3.0%"
export function formatPercent(fraction) {
    return (fraction * 100).toFixed(1) + '%';
}

// 90 -> "1m 30s", 7384 -> "2h 3m"
export function formatDuration(totalSeconds) {
    const seconds = Math.floor(totalSeconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}
