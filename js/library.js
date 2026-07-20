import { RARE_QUOTES } from './text.js';

export function getAllQuotes() {
    return RARE_QUOTES;
}

// The feed only stores a rare find's text (see simulation.js), so this
// looks its icon back up for iconography-only display there.
export function getQuoteIcon(text) {
    const quote = RARE_QUOTES.find(q => q.text === text);
    return quote ? quote.icon : '💎';
}

export function isDiscovered(state, text) {
    return state.library.discovered.includes(text);
}

export function recordDiscovery(state, text) {
    if (!state.library.discovered.includes(text)) {
        state.library.discovered.push(text);
    }
}

export function getDiscoveredCount(state) {
    return state.library.discovered.length;
}
