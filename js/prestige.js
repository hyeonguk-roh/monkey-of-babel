import { CONFIG } from './config.js';
import { createInitialState } from './state.js';

// A run is done when its one shelf is full — every book slot filled. No
// formula, no partial credit: "can I publish" is answered by the shelf grid
// being full, the same way it's drawn on screen.
export function canPublish(state) {
    return state.shelf.booksCompleted >= CONFIG.run.booksPerShelf;
}

// Photographs the finished shelf onto the permanent Library wall, sells it
// for +1 fame, and starts a new run. Fame, the Library (rare quotes), the
// Library wall (shelf thumbnails), the Prodigy roster (plus any unspent
// tokens), owned cosmetics, and everPurchased (progressive-disclosure
// unlock) survive — money, monkeys, training, upgrades, and the current
// page/shelf all reset, same as a fresh game.
export function publishManuscript(state) {
    if (!canPublish(state)) return false;

    const fame = state.fame + 1;
    const library = state.library;
    const libraryWall = state.libraryWall;
    const prodigy = state.prodigy;
    const prodigyTokens = state.prodigyTokens;
    const cosmetics = state.cosmetics;
    const everPurchased = state.everPurchased;

    libraryWall.push({ publishedAt: Date.now() });

    Object.assign(state, createInitialState());
    state.fame = fame;
    state.library = library;
    state.libraryWall = libraryWall;
    state.prodigy = prodigy;
    state.prodigyTokens = prodigyTokens;
    state.cosmetics = cosmetics;
    state.everPurchased = everPurchased;

    return 1;
}

// +X% money per fame point (per shelf ever published), applied to every
// source of income. Grows only through publishing, never through money
// itself, so it can't compound within a run.
export function getFameMoneyMultiplier(state) {
    return 1 + state.fame * CONFIG.prestige.moneyBonusPerFame;
}
