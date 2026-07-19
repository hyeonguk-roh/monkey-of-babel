import { CONFIG } from './config.js';

// --- Rewarded ads (MOCKED) ---
//
// No real ad network is wired up. Each "watch ad" function below grants its
// reward immediately with no actual ad shown — swap the body for a real ad
// SDK call (e.g. `await adSdk.showRewarded()`, then grant on success) when
// one exists. The reward-granting logic doesn't need to change.

export function isEarningsBoostActive(state) {
    return Date.now() < state.monetization.earningsBoostExpiresAt;
}

// 2x while active, 1x otherwise — one factor among several in
// simulation.js's getMoneyMultiplier.
export function getEarningsBoostMultiplier(state) {
    return isEarningsBoostActive(state) ? CONFIG.monetization.earningsBoost.multiplier : 1;
}

export function canWatchEarningsBoostAd(state) {
    return Date.now() >= state.monetization.adCooldowns.earningsBoost;
}

// MOCK: no ad actually plays. Replace with a real rewarded-ad call.
export function watchEarningsBoostAd(state) {
    if (!canWatchEarningsBoostAd(state)) return false;

    const settings = CONFIG.monetization.earningsBoost;
    state.monetization.earningsBoostExpiresAt = Date.now() + settings.durationSeconds * 1000;
    state.monetization.adCooldowns.earningsBoost = Date.now() + settings.adCooldownSeconds * 1000;
    return true;
}

export function canWatchInstantPageAd(state) {
    return Date.now() >= state.monetization.adCooldowns.instantPage;
}

// Called by simulation.js's triggerInstantPage after it actually grants the
// reward — this module only owns the ad cooldown, not the page/money math.
export function recordInstantPageAdWatched(state) {
    state.monetization.adCooldowns.instantPage = Date.now() + CONFIG.monetization.instantPage.adCooldownSeconds * 1000;
}

// --- Time skips (MOCKED premium purchase) ---
// No IAP call here either — see main.js, which just calls tick() directly
// with the skip's duration once "purchased." Reuses the same expected-value
// fast path offline catch-up already uses, so the math is the same math
// already verified for that.

export function getTimeSkipOptions() {
    return CONFIG.monetization.timeSkips;
}

// --- Cosmetics (MOCKED premium purchase) ---

export function getAllCosmetics() {
    return CONFIG.monetization.cosmetics;
}

export function isCosmeticOwned(state, id) {
    return state.cosmetics.owned.includes(id);
}

export function getActiveCosmetic(state) {
    return state.cosmetics.active;
}

// MOCK: grants ownership immediately, no real charge. Replace with a real
// payment processor call (Stripe, platform IAP, etc.) when one exists.
export function purchaseCosmetic(state, id) {
    if (isCosmeticOwned(state, id)) return false;
    if (!CONFIG.monetization.cosmetics.some(cosmetic => cosmetic.id === id)) return false;

    state.cosmetics.owned.push(id);
    return true;
}

export function setActiveCosmetic(state, id) {
    if (!isCosmeticOwned(state, id)) return false;
    state.cosmetics.active = id;
    return true;
}
