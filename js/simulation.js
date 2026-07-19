import { CONFIG } from './config.js';
import { createWorker } from './state.js';
import { generateWord, generateSentence, generateRareFind } from './text.js';
import { getFameMoneyMultiplier } from './prestige.js';
import { getMilestoneMoneyMultiplier } from './milestones.js';
import { recordDiscovery } from './library.js';
import { getProdigyMoneyMultiplier, maybeAwardToken, awardExpectedTokens } from './prodigy.js';
import { getEarningsBoostMultiplier, canWatchInstantPageAd, recordInstantPageAdWatched } from './monetization.js';

// Every source of money income goes through this: fame (permanent, across
// prestiges), milestones (within-run, resets with everything else), the
// prodigy roster (permanent, bounded by roster size), and a temporary
// rewarded-ad boost (2x while active, 1x otherwise) all stack
// multiplicatively.
export function getMoneyMultiplier(state) {
    return getFameMoneyMultiplier(state)
        * getMilestoneMoneyMultiplier(state)
        * getProdigyMoneyMultiplier(state)
        * getEarningsBoostMultiplier(state);
}

// Advance the world by dt seconds: refill the habitat and let seated
// monkeys type. Monkeys stay seated until the player recalls them.
//
// Short ticks (live gameplay, ~1/60s at a time) simulate every individual
// keystroke — that's cheap at that scale and gives correct per-keystroke
// randomness. Long ticks (offline catch-up, up to 12 simulated hours in one
// call) switch to an expected-value approximation instead: at trained
// speeds with many typewriters, "one iteration per keystroke" is millions
// of loop iterations and measurably hangs the page. The two paths are
// mathematically equivalent in aggregate — see advanceWorkersExpected.
export function tick(state, dt) {
    fillHabitat(state, dt);

    if (dt > CONFIG.performance.fastPathThresholdSeconds) {
        advanceWorkersExpected(state, dt);
    } else {
        advanceWorkersExact(state, dt);
    }
}

function fillHabitat(state, dt) {
    const workingCount = state.typewriters.workers.length;
    const room = Math.max(0, state.habitat.capacity - workingCount - state.habitat.count);
    state.habitat.count += Math.min(CONFIG.habitat.fillRatePerSecond * dt, room);
}

function advanceWorkersExact(state, dt) {
    const charsPerSecond = state.training.typingSpeed.value;
    let throttledTier = null; // best of 'sentence' | 'word' seen this tick
    let sentenceCompletedThisTick = false;

    for (const worker of state.typewriters.workers) {
        worker.charAccumulator += charsPerSecond * dt;

        while (worker.charAccumulator >= 1) {
            worker.charAccumulator -= 1;
            const tier = typeKeystroke(state, worker);

            if (tier === 'sentence') {
                sentenceCompletedThisTick = true;
                throttledTier = 'sentence';
            } else if (tier === 'word' && throttledTier !== 'sentence') {
                throttledTier = 'word';
            }
        }
    }

    advanceRareFindGate(state, dt, sentenceCompletedThisTick);

    // Cooldown is real time, not keystroke count — decrementing it once per
    // tick (by dt) keeps the throttle independent of worker count. Doing it
    // inside the keystroke loop above made it drain once per keystroke, so
    // it emptied N times faster with N workers typing in parallel.
    advanceFeedThrottle(state, dt, throttledTier);
}

function typeKeystroke(state, worker) {
    state.currencies.intelligence += CONFIG.typing.intelligencePerKeystroke;
    worker.pageChars += 1;

    // Mutually exclusive: a keystroke is at most one of these.
    let tier = null;

    if (Math.random() < state.training.wordChance.value) {
        worker.pageWords += 1;
        tier = 'word';

        if (Math.random() < state.training.sentenceChance.value) {
            worker.pageSentences += 1;
            tier = 'sentence';
        }
    }

    if (worker.pageChars >= CONFIG.typing.pageLengthChars) {
        completePage(state, worker);
    }

    return tier;
}

// Gates the rare-find ROLL itself behind its own cooldown, independent of
// the word/sentence display throttle above. This is what keeps rares rare
// at any scale: the cooldown only resets on a successful roll, so the max
// possible rate is a hard 1 per cooldownSeconds no matter how many
// sentences complete per tick. While cooled down, no rolls happen at all;
// once it clears, it retries every tick a sentence completes until one
// hits — at high sentence volume that resolves within a frame or two, so
// the observed rate converges to ~1 per cooldownSeconds without ever
// exceeding it. At low sentence volume (early game), the natural rarity of
// sentences completing at all keeps it well under that ceiling too.
function advanceRareFindGate(state, dt, sentenceCompletedThisTick) {
    const rareFind = state.rareFind;
    rareFind.cooldownSeconds = Math.max(0, rareFind.cooldownSeconds - dt);
    if (rareFind.cooldownSeconds > 0 || !sentenceCompletedThisTick) return;

    if (Math.random() < CONFIG.economy.rareFind.chance) {
        const text = generateRareFind(state.fame);
        recordDiscovery(state, text);
        const payout = awardRareFind(state);
        const tokenDropped = maybeAwardToken(state);
        recordFeedEvent(state, 'rare', { text, payout, tokenDropped });
        rareFind.cooldownSeconds = CONFIG.economy.rareFind.cooldownSeconds;
    }
}

function awardRareFind(state) {
    const settings = CONFIG.economy.rareFind;
    const basePayout = CONFIG.economy.moneyPerSentence * settings.multiplier * state.typewriters.capacity;
    const payout = Math.round(basePayout * getMoneyMultiplier(state));
    state.currencies.money += payout;
    return payout;
}

function completePage(state, worker) {
    const baseMoney = worker.pageWords * CONFIG.economy.moneyPerWord
        + worker.pageSentences * CONFIG.economy.moneyPerSentence;
    const money = Math.round(baseMoney * getMoneyMultiplier(state));

    state.currencies.money += money;
    state.pagesCompleted += 1;

    worker.pageChars = 0;
    worker.pageWords = 0;
    worker.pageSentences = 0;
}

// Rewarded-ad trigger: instantly completes one page for every currently
// seated monkey, at the EXPECTED word/sentence value for a full page (their
// actual in-progress partial page is left untouched, so nothing here can
// double-count once that page completes normally later). Returns the money
// granted, or 0 if the ad isn't available (on cooldown) or no one's typing.
export function triggerInstantPage(state) {
    if (!canWatchInstantPageAd(state)) return 0;

    const workingCount = state.typewriters.workers.length;
    if (workingCount === 0) return 0;

    const expectedWords = CONFIG.typing.pageLengthChars * state.training.wordChance.value;
    const expectedSentences = expectedWords * state.training.sentenceChance.value;
    const moneyPerPage = Math.round(
        (expectedWords * CONFIG.economy.moneyPerWord + expectedSentences * CONFIG.economy.moneyPerSentence)
        * getMoneyMultiplier(state)
    );

    const totalMoney = moneyPerPage * workingCount;
    state.currencies.money += totalMoney;
    state.pagesCompleted += workingCount;

    recordInstantPageAdWatched(state);
    return totalMoney;
}

// Expected-value fast path for long ticks (offline catch-up). Instead of
// looping per keystroke, computes aggregate totals directly: over dt
// seconds, workerCount * charsPerSecond * dt keystrokes happen in total,
// and money/intelligence are exactly linear in words/sentences typed
// (completePage's payout is proportional to the page's word/sentence
// counts regardless of how those are distributed across pages), so summing
// the *expected* words/sentences over the whole batch gives the same total
// payout as simulating each page individually, modulo a less-than-one-page
// rounding remainder that's negligible at this scale.
function advanceWorkersExpected(state, dt) {
    state.feed.cooldownSeconds = Math.max(0, state.feed.cooldownSeconds - dt);

    const workerCount = state.typewriters.workers.length;
    if (workerCount > 0) {
        const charsPerSecond = state.training.typingSpeed.value;
        const totalKeystrokes = workerCount * charsPerSecond * dt;

        state.currencies.intelligence += totalKeystrokes * CONFIG.typing.intelligencePerKeystroke;

        const totalWords = totalKeystrokes * state.training.wordChance.value;
        const totalSentences = totalWords * state.training.sentenceChance.value;

        const moneyFromTyping = Math.round(
            (totalWords * CONFIG.economy.moneyPerWord + totalSentences * CONFIG.economy.moneyPerSentence)
            * getMoneyMultiplier(state)
        );
        state.currencies.money += moneyFromTyping;
        state.pagesCompleted += Math.floor(totalKeystrokes / CONFIG.typing.pageLengthChars);

        // Losing each worker's in-progress partial page here is a rounding
        // error of at most one page per worker — negligible next to the
        // thousands of pages a multi-hour catch-up produces.
        for (const worker of state.typewriters.workers) {
            worker.charAccumulator = 0;
            worker.pageChars = 0;
            worker.pageWords = 0;
            worker.pageSentences = 0;
        }
    }

    awardExpectedRareFinds(state, dt, workerCount > 0);
}

// Same cooldown-gated rule as advanceRareFindGate, batched: at most one
// rare per cooldownSeconds, so a dt-second window can award at most
// floor(dt / cooldownSeconds) of them — never the "every sentence rolls
// independently" firehose the per-keystroke chance alone would produce
// across millions of offline keystrokes.
function awardExpectedRareFinds(state, dt, typingHappened) {
    const settings = CONFIG.economy.rareFind;
    const raresCount = typingHappened ? Math.floor(dt / settings.cooldownSeconds) : 0;

    if (raresCount === 0) {
        state.rareFind.cooldownSeconds = Math.max(0, state.rareFind.cooldownSeconds - dt);
        return;
    }

    // Every rare gets a quote drawn and recorded in the Library — that's
    // cheap even for the ~180 a 12-hour catch-up can produce. Only the
    // trailing few get an actual feed entry, since the rest would just be
    // evicted immediately by the feed's cap anyway.
    const feedEntries = Math.min(raresCount, CONFIG.feed.maxItems);
    for (let i = 0; i < raresCount; i++) {
        const payout = awardRareFind(state);
        const text = generateRareFind(state.fame);
        recordDiscovery(state, text);
        if (i >= raresCount - feedEntries) {
            recordFeedEvent(state, 'rare', { text, payout });
        }
    }

    state.rareFind.cooldownSeconds = settings.cooldownSeconds - (dt % settings.cooldownSeconds);
    awardExpectedTokens(state, raresCount);
}

// Ticks the feed's cooldown by dt (real/simulated time, not keystroke count),
// and logs one event once the cooldown clears — preferring a sentence over a
// plain word, since it's the rarer, more notable of the two. Rare finds
// don't go through this at all: they're logged immediately in advanceWorkers,
// unthrottled. This function only touches the throttled word/sentence slot;
// it never touches currencies itself.
function advanceFeedThrottle(state, dt, tier) {
    const feed = state.feed;
    feed.cooldownSeconds = Math.max(0, feed.cooldownSeconds - dt);
    if (feed.cooldownSeconds > 0) return;
    if (!tier) return;

    recordFeedEvent(state, tier);
    feed.cooldownSeconds = CONFIG.feed.minSecondsBetweenEvents;
}

function recordFeedEvent(state, type, options = {}) {
    const text = options.text ?? (type === 'sentence' ? generateSentence() : generateWord());
    const item = { id: state.feed.nextId, type, text };
    if (type === 'rare') {
        item.payout = options.payout;
        item.tokenDropped = options.tokenDropped ?? false;
    }

    state.feed.nextId += 1;
    state.feed.items.unshift(item);
    trimFeed(state);
}

// Rare finds are guaranteed to stay visible: when trimming back down to
// size, evict the oldest non-rare item first. Only fall back to evicting a
// rare item if the feed is somehow entirely rare finds.
function trimFeed(state) {
    const items = state.feed.items;
    while (items.length > CONFIG.feed.maxItems) {
        let evictIndex = -1;
        for (let i = items.length - 1; i >= 0; i--) {
            if (items[i].type !== 'rare') {
                evictIndex = i;
                break;
            }
        }
        items.splice(evictIndex === -1 ? items.length - 1 : evictIndex, 1);
    }
}

// Player actions — each returns false (and does nothing) if it isn't
// currently possible, so callers can just re-render either way.

export function assignWorker(state) {
    if (state.typewriters.workers.length >= state.typewriters.capacity) return false;
    if (Math.floor(state.habitat.count) < 1) return false;

    state.habitat.count -= 1;
    state.typewriters.workers.push(createWorker());
    return true;
}

export function recallWorker(state) {
    if (state.typewriters.workers.length === 0) return false;

    state.typewriters.workers.pop();
    state.habitat.count = Math.min(state.habitat.capacity, state.habitat.count + 1);
    return true;
}

export function fillTypewriters(state) {
    while (assignWorker(state)) { /* keep going until full or out of monkeys */ }
}

export function clearTypewriters(state) {
    while (recallWorker(state)) { /* keep going until every typewriter is empty */ }
}

// Shared by training and upgrades: cost of the Nth purchase.
function scaledCost(settings, level) {
    return Math.round(settings.baseCost * Math.pow(settings.costGrowth, level));
}

// --- Training: spend intelligence to make seated monkeys better typists ---

// Fixed-size tiers (×1/×10/×100): how many of the next `tierCount` levels
// are even POSSIBLE before hitting the value cap, and what the full batch
// costs. Ignores current currency entirely — the label always names its
// nominal size (or less, only when the cap itself makes more impossible),
// so ×10 never silently shrinks to "whatever you can afford" and start
// looking identical to ×Max. Purchasing is all-or-nothing against this.
function previewTrainingTier(state, key, tierCount) {
    const settings = CONFIG.training[key];
    const training = state.training[key];

    let level = training.level;
    let value = training.value;
    let total = 0;
    let count = 0;
    const maxed = value >= settings.cap;

    while (count < tierCount && value < settings.cap) {
        total += scaledCost(settings, level);
        level += 1;
        value = Math.min(settings.cap, value + settings.increment);
        count += 1;
    }

    return { count, cost: total, maxed };
}

// Max: budget-aware, the one tier that does a partial buy — as many levels
// as currently affordable, up to the value cap.
function previewTrainingMax(state, key) {
    const settings = CONFIG.training[key];
    const training = state.training[key];
    const budget = state.currencies.intelligence;

    let level = training.level;
    let value = training.value;
    let total = 0;
    let count = 0;
    const maxed = value >= settings.cap;

    while (value < settings.cap) {
        const cost = scaledCost(settings, level);
        if (total + cost > budget) break;
        total += cost;
        level += 1;
        value = Math.min(settings.cap, value + settings.increment);
        count += 1;
    }

    return { count, cost: total, maxed };
}

// tierCount: 1, 10, 100 for the fixed tiers, or Infinity for Max.
export function getTrainingPreview(state, key, tierCount) {
    return tierCount === Infinity
        ? previewTrainingMax(state, key)
        : previewTrainingTier(state, key, tierCount);
}

function applyTrainingPurchase(state, key, count, cost) {
    const settings = CONFIG.training[key];
    const training = state.training[key];

    state.currencies.intelligence -= cost;
    training.level += count;
    training.value = Math.min(settings.cap, training.value + settings.increment * count);
}

export function purchaseTrainingMultiple(state, key, tierCount) {
    if (tierCount === Infinity) {
        const { count, cost } = previewTrainingMax(state, key);
        if (count === 0) return 0;
        applyTrainingPurchase(state, key, count, cost);
        return count;
    }

    const { count, cost } = previewTrainingTier(state, key, tierCount);
    if (count === 0 || state.currencies.intelligence < cost) return 0;
    applyTrainingPurchase(state, key, count, cost);
    return count;
}

// --- Upgrades: spend money to grow capacity ---

// Where each upgrade's capacity actually lives in state. To sell a new
// capacity upgrade, add a CONFIG.upgrades entry and a matching one here.
const UPGRADE_TARGETS = {
    typewriters: {
        get: (state) => state.typewriters.capacity,
        set: (state, value) => { state.typewriters.capacity = value; },
    },
    habitat: {
        get: (state) => state.habitat.capacity,
        set: (state, value) => { state.habitat.capacity = value; },
    },
};

// Fixed-size tiers, upgrade version — same idea as previewTrainingTier, but
// upgrades have no cap so `count` is always exactly `tierCount`.
function previewUpgradeTier(state, key, tierCount) {
    const settings = CONFIG.upgrades[key];
    const upgrade = state.upgrades[key];

    let level = upgrade.level;
    let total = 0;

    for (let i = 0; i < tierCount; i++) {
        total += scaledCost(settings, level);
        level += 1;
    }

    return { count: tierCount, cost: total, maxed: false };
}

// Max: budget-aware partial buy, same as previewTrainingMax.
function previewUpgradeMax(state, key) {
    const settings = CONFIG.upgrades[key];
    const upgrade = state.upgrades[key];
    const budget = state.currencies.money;

    let level = upgrade.level;
    let total = 0;
    let count = 0;

    while (true) {
        const cost = scaledCost(settings, level);
        if (total + cost > budget) break;
        total += cost;
        level += 1;
        count += 1;
    }

    return { count, cost: total, maxed: false };
}

export function getUpgradePreview(state, key, tierCount) {
    return tierCount === Infinity
        ? previewUpgradeMax(state, key)
        : previewUpgradeTier(state, key, tierCount);
}

function applyUpgradePurchase(state, key, count, cost) {
    const settings = CONFIG.upgrades[key];
    const upgrade = state.upgrades[key];

    state.currencies.money -= cost;
    upgrade.level += count;

    const target = UPGRADE_TARGETS[key];
    target.set(state, target.get(state) + settings.increment * count);
}

export function purchaseUpgradeMultiple(state, key, tierCount) {
    if (tierCount === Infinity) {
        const { count, cost } = previewUpgradeMax(state, key);
        if (count === 0) return 0;
        applyUpgradePurchase(state, key, count, cost);
        return count;
    }

    const { count, cost } = previewUpgradeTier(state, key, tierCount);
    if (state.currencies.money < cost) return 0;
    applyUpgradePurchase(state, key, count, cost);
    return count;
}
