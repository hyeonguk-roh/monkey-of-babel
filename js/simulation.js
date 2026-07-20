import { CONFIG } from './config.js';
import { generateWord, generateSentence, generateGibberish, generateRareFind } from './text.js';
import { getFameMoneyMultiplier } from './prestige.js';
import { recordDiscovery } from './library.js';
import { getProdigyMoneyMultiplier, maybeAwardToken, awardExpectedTokens } from './prodigy.js';
import { getEarningsBoostMultiplier, canWatchInstantPageAd, recordInstantPageAdWatched } from './monetization.js';

// Every source of money income goes through this: fame (permanent, across
// prestiges), the prodigy roster (permanent, bounded by roster size), and a
// temporary rewarded-ad boost (2x while active, 1x otherwise) all stack
// multiplicatively.
export function getMoneyMultiplier(state) {
    return getFameMoneyMultiplier(state)
        * getProdigyMoneyMultiplier(state)
        * getEarningsBoostMultiplier(state);
}

// Advance the world by dt seconds: let idle monkeys wander into the
// waiting pool, and let seated monkeys type onto the one shared page.
//
// Short ticks (live gameplay, ~1/60s at a time) simulate every individual
// token — that's cheap at that scale and gives correct per-token randomness,
// which is what makes the page's gibberish/word mix an honest readout of
// wordChance/sentenceChance rather than a smoothed average. Long ticks
// (offline catch-up, time skips) switch to an expected-value approximation
// instead — see advancePageExpected for why that's mathematically
// equivalent in aggregate, just without materializing the actual text.
export function tick(state, dt) {
    fillHabitat(state, dt);

    if (dt > CONFIG.performance.fastPathThresholdSeconds) {
        advancePageExpected(state, dt);
    } else {
        advancePageExact(state, dt);
    }
}

function fillHabitat(state, dt) {
    const room = Math.max(0, state.habitat.capacity - state.typewriters.seatedCount - state.habitat.count);
    state.habitat.count += Math.min(CONFIG.habitat.fillRatePerSecond * dt, room);
}

// Rough average rendered length (including the trailing space) of each kind
// of token — used only to convert a token count into an expected glyph
// count for the fast paths below (offline catch-up, time skips, the instant
// page ad). The live/exact path never needs this: it generates the actual
// string and measures its real length. Drifts a little if text.js's word
// lists change length, but only pacing approximations depend on it.
const GIBBERISH_AVG_GLYPHS = 3.5;
const WORD_AVG_GLYPHS = 7;
const SENTENCE_AVG_GLYPHS = 36;

function avgGlyphsPerToken(state) {
    const wc = state.training.wordChance.value;
    const sc = state.training.sentenceChance.value;
    const pSentence = wc * sc;
    const pWord = wc * (1 - sc);
    const pGibberish = 1 - wc;
    return pGibberish * GIBBERISH_AVG_GLYPHS + pWord * WORD_AVG_GLYPHS + pSentence * SENTENCE_AVG_GLYPHS;
}

// One token event: rolls word chance, then (only if that hits) sentence
// chance, and appends the resulting text as a styled segment to the shared
// page. This is the whole "quality of the gibberish IS the stat readout"
// mechanic — untrained monkeys (wordChance 0) never roll past the gibberish
// branch at all.
function rollToken(state) {
    if (Math.random() < state.training.wordChance.value) {
        if (Math.random() < state.training.sentenceChance.value) {
            return { text: generateSentence(), type: 'sentence' };
        }
        return { text: generateWord(), type: 'word' };
    }
    return { text: generateGibberish(), type: 'gibberish' };
}

function appendSegment(state, segment) {
    const page = state.page;
    const text = segment.text + ' ';
    page.segments.push({ text, type: segment.type, payout: segment.payout });
    page.length += text.length;

    // Rare segments are paid out directly (awardRareFind) rather than
    // through the word/sentence tallies, so they don't double-count here.
    if (segment.type === 'word' || segment.type === 'sentence') page.words += 1;
    if (segment.type === 'sentence') page.sentences += 1;
}

function advancePageExact(state, dt) {
    const seated = state.typewriters.seatedCount;
    let sentenceCompletedThisTick = false;

    if (seated > 0) {
        const tokensPerSecond = seated * state.training.typingSpeed.value;
        state.page.tokenAccumulator += tokensPerSecond * dt;

        while (state.page.tokenAccumulator >= 1) {
            state.page.tokenAccumulator -= 1;
            const segment = rollToken(state);
            appendSegment(state, segment);
            state.currencies.intelligence += CONFIG.typing.intelligencePerToken;

            if (segment.type === 'sentence') sentenceCompletedThisTick = true;
            if (state.page.length >= CONFIG.run.pageLengthGlyphs) completePage(state);
        }
    }

    // Cooldown is real time, not token count — decrementing it once per
    // tick (by dt) keeps the throttle independent of how many monkeys are
    // seated. Doing it inside the loop above would drain it once per token,
    // emptying it N times faster with N tokens typed in parallel.
    advanceRareFindGate(state, dt, sentenceCompletedThisTick);
}

// Gates the rare-find ROLL itself behind its own cooldown, independent of
// how many sentences complete in a tick. This is what keeps rares rare at
// any scale: the cooldown only resets on a successful roll, so the max
// possible rate is a hard 1 per cooldownSeconds no matter how many sentences
// land per tick. On a hit, the full quote is spliced into the live page as
// its own gold segment — this is the "gold line mid-page" moment.
function advanceRareFindGate(state, dt, sentenceCompletedThisTick) {
    const rareFind = state.rareFind;
    rareFind.cooldownSeconds = Math.max(0, rareFind.cooldownSeconds - dt);
    if (rareFind.cooldownSeconds > 0 || !sentenceCompletedThisTick) return;

    if (Math.random() < CONFIG.economy.rareFind.chance) {
        const text = generateRareFind(state.fame);
        recordDiscovery(state, text);
        const payout = awardRareFind(state);
        maybeAwardToken(state);
        appendSegment(state, { text, type: 'rare', payout });
        rareFind.cooldownSeconds = CONFIG.economy.rareFind.cooldownSeconds;
        if (state.page.length >= CONFIG.run.pageLengthGlyphs) completePage(state);
    }
}

function awardRareFind(state) {
    const settings = CONFIG.economy.rareFind;
    const basePayout = CONFIG.economy.moneyPerSentence * settings.multiplier * state.typewriters.capacity;
    const payout = Math.round(basePayout * getMoneyMultiplier(state));
    state.currencies.money += payout;
    return payout;
}

// Advances book/shelf progress by exactly one page, capping at a full
// shelf — once booksCompleted reaches CONFIG.run.booksPerShelf, further
// pages (typed while waiting to hit Publish) simply don't add more book
// slots, since the shelf grid is already full.
function advanceShelf(state) {
    if (state.shelf.booksCompleted >= CONFIG.run.booksPerShelf) return;

    state.shelf.pagesInBook += 1;
    if (state.shelf.pagesInBook >= CONFIG.run.pagesPerBook) {
        state.shelf.pagesInBook = 0;
        state.shelf.booksCompleted += 1;
    }
}

function completePage(state) {
    const page = state.page;
    const money = Math.round(
        (page.words * CONFIG.economy.moneyPerWord + page.sentences * CONFIG.economy.moneyPerSentence)
        * getMoneyMultiplier(state)
    );
    state.currencies.money += money;
    advanceShelf(state);

    page.segments = [];
    page.length = 0;
    page.words = 0;
    page.sentences = 0;
    page.completions += 1;
    // tokenAccumulator is untouched — leftover fractional typing progress
    // shouldn't be lost just because the page flipped.
}

// Rewarded-ad trigger: instantly grants one page's worth of expected value
// (money + intelligence, at the current training levels) and advances the
// shelf by one page — without touching the live in-progress page, so
// watching an ad doesn't interrupt the page you're mid-way through reading.
// Returns the money granted, or 0 if the ad isn't available (on cooldown) or
// no one's typing.
export function triggerInstantPage(state) {
    if (!canWatchInstantPageAd(state)) return 0;
    if (state.typewriters.seatedCount === 0) return 0;

    const wc = state.training.wordChance.value;
    const sc = state.training.sentenceChance.value;
    const expectedTokens = CONFIG.run.pageLengthGlyphs / avgGlyphsPerToken(state);
    const expectedWordEvents = expectedTokens * wc;
    const expectedSentenceEvents = expectedWordEvents * sc;

    const money = Math.round(
        (expectedWordEvents * CONFIG.economy.moneyPerWord + expectedSentenceEvents * CONFIG.economy.moneyPerSentence)
        * getMoneyMultiplier(state)
    );
    state.currencies.money += money;
    state.currencies.intelligence += Math.round(expectedTokens * CONFIG.typing.intelligencePerToken);
    advanceShelf(state);

    recordInstantPageAdWatched(state);
    return money;
}

// Expected-value fast path for long ticks (offline catch-up, time skips).
// Instead of looping per token, computes aggregate totals directly — money/
// intelligence are exactly linear in tokens typed regardless of how they're
// distributed across pages, so summing the *expected* counts over the whole
// batch gives the same total as simulating each token individually, modulo
// a less-than-one-page rounding remainder that's negligible at this scale.
// It does NOT reconstruct the actual page text (that would mean generating
// thousands of tokens just to throw them away) — the live page is simply
// cleared, carrying over only its approximate fractional length.
function advancePageExpected(state, dt) {
    const seated = state.typewriters.seatedCount;
    if (seated === 0) {
        awardExpectedRareFinds(state, dt, false);
        return;
    }

    const tokensPerSecond = seated * state.training.typingSpeed.value;
    const totalTokens = tokensPerSecond * dt;

    state.currencies.intelligence += totalTokens * CONFIG.typing.intelligencePerToken;

    const wc = state.training.wordChance.value;
    const sc = state.training.sentenceChance.value;
    const totalWordEvents = totalTokens * wc;
    const totalSentenceEvents = totalWordEvents * sc;

    const money = Math.round(
        (totalWordEvents * CONFIG.economy.moneyPerWord + totalSentenceEvents * CONFIG.economy.moneyPerSentence)
        * getMoneyMultiplier(state)
    );
    state.currencies.money += money;

    const totalGlyphs = totalTokens * avgGlyphsPerToken(state);
    const pagesCompleted = Math.floor((state.page.length + totalGlyphs) / CONFIG.run.pageLengthGlyphs);

    state.page.segments = [];
    state.page.length = (state.page.length + totalGlyphs) % CONFIG.run.pageLengthGlyphs;
    state.page.words = 0;
    state.page.sentences = 0;
    for (let i = 0; i < pagesCompleted; i++) advanceShelf(state);
    if (pagesCompleted > 0) state.page.completions += 1;

    awardExpectedRareFinds(state, dt, true);
}

// Same cooldown-gated rule as advanceRareFindGate, batched: at most one rare
// per cooldownSeconds, so a dt-second window can award at most
// floor(dt / cooldownSeconds) of them. Every rare still gets a quote drawn
// and recorded in the Library; it just isn't spliced into the (already
// cleared) live page text.
function awardExpectedRareFinds(state, dt, typingHappened) {
    const settings = CONFIG.economy.rareFind;
    const raresCount = typingHappened ? Math.floor(dt / settings.cooldownSeconds) : 0;

    if (raresCount === 0) {
        state.rareFind.cooldownSeconds = Math.max(0, state.rareFind.cooldownSeconds - dt);
        return;
    }

    for (let i = 0; i < raresCount; i++) {
        awardRareFind(state);
        recordDiscovery(state, generateRareFind(state.fame));
    }

    state.rareFind.cooldownSeconds = settings.cooldownSeconds - (dt % settings.cooldownSeconds);
    awardExpectedTokens(state, raresCount);
}

// Player actions — each returns false (and does nothing) if it isn't
// currently possible, so callers can just re-render either way.

export function assignWorker(state) {
    if (state.typewriters.seatedCount >= state.typewriters.capacity) return false;
    if (Math.floor(state.habitat.count) < 1) return false;

    state.habitat.count -= 1;
    state.typewriters.seatedCount += 1;
    return true;
}

export function recallWorker(state) {
    if (state.typewriters.seatedCount === 0) return false;

    state.typewriters.seatedCount -= 1;
    state.habitat.count = Math.min(state.habitat.capacity, state.habitat.count + 1);
    return true;
}

export function fillTypewriters(state) {
    while (assignWorker(state)) { /* keep going until full or out of monkeys */ }
}

export function clearTypewriters(state) {
    while (recallWorker(state)) { /* keep going until every typewriter is empty */ }
}

// --- Training: spend intelligence to level up a stat ---
// --- Upgrades: spend money to reveal one more grid slot ---
//
// Both are small, bounded, single-step purchases now (no more ×1/×10/×100
// bulk tiers — with capacity/levels capped this low, buying more than one
// at a time stopped being meaningful). cost of the Nth purchase = round
// (baseCost * costGrowth ^ N).

function scaledCost(settings, level) {
    return Math.round(settings.baseCost * Math.pow(settings.costGrowth, level));
}

// null means maxed — no further purchase is possible.
export function getTrainingCost(state, key) {
    const settings = CONFIG.training[key];
    const level = state.training[key].level;
    return level >= settings.levels ? null : scaledCost(settings, level);
}

export function purchaseTraining(state, key) {
    const cost = getTrainingCost(state, key);
    if (cost === null || state.currencies.intelligence < cost) return false;

    const settings = CONFIG.training[key];
    state.currencies.intelligence -= cost;
    state.training[key].level += 1;
    state.training[key].value = settings.base + state.training[key].level * settings.perLevel;
    state.everPurchased = true;
    return true;
}

// Where each upgrade's capacity actually lives in state, and its bounds. To
// sell a new capacity upgrade, add a CONFIG.upgrades entry, a maxCapacity/
// startingCapacity pair, and a matching one here.
const CAPACITY_TARGETS = {
    typewriters: {
        get: (state) => state.typewriters.capacity,
        set: (state, value) => { state.typewriters.capacity = value; },
        max: CONFIG.typewriters.maxCapacity,
        starting: CONFIG.typewriters.startingCapacity,
    },
    habitat: {
        get: (state) => state.habitat.capacity,
        set: (state, value) => { state.habitat.capacity = value; },
        max: CONFIG.habitat.maxCapacity,
        starting: CONFIG.habitat.startingCapacity,
    },
};

// null means maxed — the grid is already at its full size.
export function getUpgradeCost(state, key) {
    const target = CAPACITY_TARGETS[key];
    const capacity = target.get(state);
    if (capacity >= target.max) return null;
    return scaledCost(CONFIG.upgrades[key], capacity - target.starting);
}

export function purchaseUpgrade(state, key) {
    const cost = getUpgradeCost(state, key);
    if (cost === null || state.currencies.money < cost) return false;

    const target = CAPACITY_TARGETS[key];
    state.currencies.money -= cost;
    target.set(state, target.get(state) + 1);
    state.everPurchased = true;
    return true;
}
