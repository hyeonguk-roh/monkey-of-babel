import { CONFIG } from './config.js';
import { tick } from './simulation.js';

// Fast-forwards state by however long the player was away, capped so a
// stale save can't hang the page simulating days of ticks. Mutates state
// in place (via the normal tick()) and returns a summary for the "welcome
// back" banner, or null if there's nothing worth reporting.
export function applyOfflineProgress(state, savedAt) {
    const elapsedSeconds = Math.max(0, (Date.now() - savedAt) / 1000);
    if (elapsedSeconds <= 0) return null;

    const simulatedSeconds = Math.min(elapsedSeconds, CONFIG.offline.maxSeconds);

    const before = {
        money: state.currencies.money,
        intelligence: state.currencies.intelligence,
        pageCompletions: state.page.completions,
        habitatCount: Math.floor(state.habitat.count),
    };

    tick(state, simulatedSeconds);

    if (elapsedSeconds < CONFIG.offline.minSecondsToReport) return null;

    return {
        simulatedSeconds,
        capped: elapsedSeconds > simulatedSeconds,
        moneyEarned: state.currencies.money - before.money,
        intelligenceEarned: state.currencies.intelligence - before.intelligence,
        pagesEarned: state.page.completions - before.pageCompletions,
        monkeysArrived: Math.floor(state.habitat.count) - before.habitatCount,
    };
}
