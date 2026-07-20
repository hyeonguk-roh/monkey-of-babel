const SUFFIXES = ['K', 'M', 'B', 'T'];

// 950 -> "950", 1500 -> "1.5K", 2400000 -> "2.4M". Used only in title
// tooltips now — the visible UI shows quantities as literal countable
// objects (coin/ink piles, grids, level pips) instead of formatted digits.
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

// 0.03 -> "3.0%". Also tooltip-only.
export function formatPercent(fraction) {
    return (fraction * 100).toFixed(1) + '%';
}

// Numeric clock display, tooltip-only: 90 -> "1:30", 7384 -> "2:03:04"
export function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const pad = n => n.toString().padStart(2, '0');

    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

// Fraction clamped to [0, 1] — drives every dial and affordability ring's
// conic-gradient fill.
export function clampFraction(value, max) {
    if (max <= 0) return 0;
    return Math.max(0, Math.min(1, value / max));
}
