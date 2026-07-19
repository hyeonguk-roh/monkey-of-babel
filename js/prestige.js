import { CONFIG } from './config.js';
import { createInitialState } from './state.js';

// How much fame publishing right now would earn. Square-root scaling gives
// diminishing returns, so there's no benefit to grinding pages forever
// before publishing — the decision to prestige is about fame *rate*, not
// just total pages banked.
export function getFameGain(state) {
    return Math.floor(Math.sqrt(state.pagesCompleted / CONFIG.prestige.pagesPerFame));
}

export function canPublish(state) {
    return getFameGain(state) >= 1;
}

// Packages every page written so far into a manuscript, sells it for fame,
// and starts a new run. Fame, the Library, the Prodigy roster (plus any
// unspent tokens), and owned cosmetics survive — money, monkeys, training,
// upgrades, and any active ad boost/cooldown all reset, same as a fresh game.
export function publishManuscript(state) {
    if (!canPublish(state)) return false;

    const fameGained = getFameGain(state);
    const fame = state.fame + fameGained;
    const library = state.library;
    const prodigy = state.prodigy;
    const prodigyTokens = state.prodigyTokens;
    const cosmetics = state.cosmetics;

    Object.assign(state, createInitialState());
    state.fame = fame;
    state.library = library;
    state.prodigy = prodigy;
    state.prodigyTokens = prodigyTokens;
    state.cosmetics = cosmetics;

    return fameGained;
}

// +X% money per fame point, applied to every source of income. Grows only
// through publishing, never through money itself, so it can't compound.
export function getFameMoneyMultiplier(state) {
    return 1 + state.fame * CONFIG.prestige.moneyBonusPerFame;
}
