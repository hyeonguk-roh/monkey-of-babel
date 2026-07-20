import { CONFIG } from './config.js';

// The roster: pull with tokens, keep forever (persists across prestige,
// same as fame and the Library). Each owned monkey adds a fixed money
// bonus. Add more here any time — the roster is capped by list length, not
// a formula, so growing it is just adding a row.
//
// icon is what's actually shown in the (iconography-only) Roster; name is
// kept for the row's hover tooltip.
export const PRODIGY_MONKEYS = [
    { id: 'nibbles', name: 'Nibbles', icon: '🍪', rarity: 'common', moneyBonus: 0.02 },
    { id: 'inkstain', name: 'Inkstain', icon: '🖋️', rarity: 'common', moneyBonus: 0.02 },
    { id: 'quillfinger', name: 'Quillfinger', icon: '🪶', rarity: 'common', moneyBonus: 0.02 },
    { id: 'pagerustle', name: 'Page Rustle', icon: '📄', rarity: 'common', moneyBonus: 0.02 },
    { id: 'sirtypewell', name: 'Sir Typewell', icon: '🎩', rarity: 'rare', moneyBonus: 0.05 },
    { id: 'ladyclatter', name: 'Lady Clatter', icon: '👒', rarity: 'rare', moneyBonus: 0.05 },
    { id: 'bardbrow', name: 'Bardbrow', icon: '🎭', rarity: 'epic', moneyBonus: 0.15 },
    { id: 'thewillfulone', name: 'The Willful One', icon: '👑', rarity: 'legendary', moneyBonus: 0.25 },
];

// A colored-dot stand-in for the rarity word (Common/Rare/Epic/Legendary)
// wherever the UI can't show text.
const RARITY_ICONS = { common: '🟢', rare: '🔵', epic: '🟣', legendary: '🟡' };
export function getRarityIcon(rarity) {
    return RARITY_ICONS[rarity];
}

const RARITY_WEIGHTS = { common: 60, rare: 30, epic: 8, legendary: 2 };

export function getAllMonkeys() {
    return PRODIGY_MONKEYS;
}

export function isOwned(state, id) {
    return state.prodigy.owned.includes(id);
}

export function getOwnedCount(state) {
    return state.prodigy.owned.length;
}

export function isRosterComplete(state) {
    return getOwnedCount(state) >= PRODIGY_MONKEYS.length;
}

// +X% money per owned monkey, summed — bounded by the fixed roster size
// (max ~+58% if every monkey is owned), never growing beyond that.
export function getProdigyMoneyMultiplier(state) {
    const bonus = state.prodigy.owned.reduce((sum, id) => {
        const monkey = PRODIGY_MONKEYS.find(m => m.id === id);
        return sum + (monkey ? monkey.moneyBonus : 0);
    }, 0);
    return 1 + bonus;
}

// The bonus fraction if every monkey were owned — the denominator for a
// "current bonus vs. max possible" meter, since (unlike fame) this bonus
// has a real, fixed ceiling.
export function getMaxProdigyBonus() {
    return PRODIGY_MONKEYS.reduce((sum, monkey) => sum + monkey.moneyBonus, 0);
}

// Called once per rare find (live and offline paths) — a chance to also
// drop a pull token.
export function maybeAwardToken(state) {
    if (Math.random() >= CONFIG.prodigy.tokenDropChance) return false;
    state.prodigyTokens += 1;
    return true;
}

// Offline fast-path equivalent: expected token count over a batch of rare
// finds, rather than rolling each one individually.
export function awardExpectedTokens(state, rareFindCount) {
    state.prodigyTokens += Math.round(rareFindCount * CONFIG.prodigy.tokenDropChance);
}

function pickRarity() {
    const total = Object.values(RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * total;
    for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
        if (roll < weight) return rarity;
        roll -= weight;
    }
    return 'common'; // unreachable in practice, just a safe fallback
}

function pickMonkey() {
    const rarity = pickRarity();
    const pool = PRODIGY_MONKEYS.filter(monkey => monkey.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
}

// Spends CONFIG.prodigy.pullCost tokens for a random monkey. A duplicate
// isn't wasted — it refunds a partial token amount instead of vanishing.
// Returns null (and does nothing) if the pull isn't possible right now:
// not enough tokens, or the roster's already complete.
export function pull(state) {
    if (isRosterComplete(state)) return null;
    if (state.prodigyTokens < CONFIG.prodigy.pullCost) return null;

    state.prodigyTokens -= CONFIG.prodigy.pullCost;
    const monkey = pickMonkey();

    if (isOwned(state, monkey.id)) {
        state.prodigyTokens += CONFIG.prodigy.duplicateRefund;
        return { monkey, isDuplicate: true };
    }

    state.prodigy.owned.push(monkey.id);
    return { monkey, isDuplicate: false };
}
