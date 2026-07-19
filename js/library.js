import { RARE_QUOTES } from './text.js';

export function getAllQuotes() {
    return RARE_QUOTES;
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
