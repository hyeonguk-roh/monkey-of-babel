import { CONFIG } from './config.js';

const STORAGE_KEY = CONFIG.save.storageKey;

// Best-effort: localStorage can throw (private browsing, full quota), and
// that should never be the reason the game stops working.
export function saveState(state) {
    const payload = {
        version: CONFIG.save.version,
        savedAt: Date.now(),
        state,
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
        // ignore — saving is a nice-to-have, not a requirement to keep playing
    }
}

// Returns { state, savedAt }, or null if there's nothing usable to load.
export function loadState() {
    let raw;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
        return null;
    }
    if (!raw) return null;

    try {
        const payload = JSON.parse(raw);
        if (payload.version !== CONFIG.save.version) return null;
        return { state: payload.state, savedAt: payload.savedAt };
    } catch (err) {
        return null;
    }
}
