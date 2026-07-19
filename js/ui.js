import { CONFIG } from './config.js';
import { formatNumber, formatPercent, formatDuration } from './format.js';
import { getTrainingPreview, getUpgradePreview } from './simulation.js';
import { getFameGain, canPublish } from './prestige.js';
import { getMilestoneMoneyMultiplier, getProgressToNextMilestone } from './milestones.js';
import { getAllQuotes, isDiscovered, getDiscoveredCount } from './library.js';
import { getAllMonkeys, isOwned, getOwnedCount, isRosterComplete, getProdigyMoneyMultiplier } from './prodigy.js';
import {
    isEarningsBoostActive,
    canWatchEarningsBoostAd,
    canWatchInstantPageAd,
    getTimeSkipOptions,
    getAllCosmetics,
    isCosmeticOwned,
    getActiveCosmetic,
} from './monetization.js';

const dom = {};

// Maps each training/upgrade key to its ×1 button's base id — ×10/×100/×Max
// are that id with "10"/"100"/"Max" appended. To sell a new training or
// upgrade, add its CONFIG entry, matching buttons in index.html, and a
// line here.
const TRAINING_BUTTON_IDS = {
    typingSpeed: 'trainTypingSpeedBtn',
    wordChance: 'trainWordChanceBtn',
    sentenceChance: 'trainSentenceChanceBtn',
};

const UPGRADE_BUTTON_IDS = {
    typewriters: 'buyTypewriterBtn',
    habitat: 'buyHabitatBtn',
};

// Tier buttons in display order, paired with the tierCount each one passes
// to getTrainingPreview/getUpgradePreview. Infinity is Max.
const TIERS = [
    ['one', 1],
    ['ten', 10],
    ['hundred', 100],
    ['max', Infinity],
];

function cacheBuyButtons(idMap) {
    const buttons = {};
    for (const [key, baseId] of Object.entries(idMap)) {
        buttons[key] = {
            one: document.getElementById(baseId),
            ten: document.getElementById(baseId + '10'),
            hundred: document.getElementById(baseId + '100'),
            max: document.getElementById(baseId + 'Max'),
        };
    }
    return buttons;
}

// Grabs every element the game touches, once, at startup.
export function cacheDom() {
    dom.habitatMeter = document.getElementById('habitatMeter');
    dom.habitatCountVal = document.getElementById('habitatCountVal');
    dom.habitatCapVal = document.getElementById('habitatCapVal');
    dom.fillHint = document.getElementById('fillHint');

    dom.typewriterMeter = document.getElementById('typewriterMeter');
    dom.typewriterCountVal = document.getElementById('typewriterCountVal');
    dom.typewriterCapVal = document.getElementById('typewriterCapVal');

    dom.pagesVal = document.getElementById('pagesVal');
    dom.intelligenceVal = document.getElementById('intelligenceVal');
    dom.moneyVal = document.getElementById('moneyVal');

    dom.assignOneBtn = document.getElementById('assignOneBtn');
    dom.recallOneBtn = document.getElementById('recallOneBtn');
    dom.fillTypewritersBtn = document.getElementById('fillTypewritersBtn');
    dom.clearTypewritersBtn = document.getElementById('clearTypewritersBtn');

    dom.typingSpeedVal = document.getElementById('typingSpeedVal');
    dom.wordChanceVal = document.getElementById('wordChanceVal');
    dom.sentenceChanceVal = document.getElementById('sentenceChanceVal');

    dom.trainButtons = cacheBuyButtons(TRAINING_BUTTON_IDS);
    dom.upgradeButtons = cacheBuyButtons(UPGRADE_BUTTON_IDS);

    dom.milestoneMultiplierVal = document.getElementById('milestoneMultiplierVal');
    dom.typewriterMilestoneHint = document.getElementById('typewriterMilestoneHint');
    dom.trainMilestoneHints = {};
    for (const key of Object.keys(TRAINING_BUTTON_IDS)) {
        dom.trainMilestoneHints[key] = document.getElementById(key + 'MilestoneHint');
    }

    dom.offlineBanner = document.getElementById('offlineBanner');
    dom.offlineBannerText = document.getElementById('offlineBannerText');
    dom.dismissOfflineBtn = document.getElementById('dismissOfflineBtn');

    dom.feedList = document.getElementById('feedList');
    dom.feedRows = buildFeedRows(dom.feedList);

    dom.fameVal = document.getElementById('fameVal');
    dom.fameBonusVal = document.getElementById('fameBonusVal');
    dom.fameGainVal = document.getElementById('fameGainVal');
    dom.publishBtn = document.getElementById('publishBtn');
    dom.publishHint = document.getElementById('publishHint');

    dom.libraryProgressVal = document.getElementById('libraryProgressVal');
    dom.libraryList = document.getElementById('libraryList');
    dom.libraryRows = buildLibraryRows(dom.libraryList);

    dom.prodigyTokensVal = document.getElementById('prodigyTokensVal');
    dom.prodigyBonusVal = document.getElementById('prodigyBonusVal');
    dom.prodigyProgressVal = document.getElementById('prodigyProgressVal');
    dom.prodigyPullBtn = document.getElementById('prodigyPullBtn');
    dom.prodigyPullHint = document.getElementById('prodigyPullHint');
    dom.prodigyList = document.getElementById('prodigyList');
    dom.prodigyRows = buildProdigyRows(dom.prodigyList);

    dom.storeStatusVal = document.getElementById('storeStatusVal');
    dom.earningsBoostStatusVal = document.getElementById('earningsBoostStatusVal');
    dom.watchEarningsBoostAdBtn = document.getElementById('watchEarningsBoostAdBtn');
    dom.instantPageStatusVal = document.getElementById('instantPageStatusVal');
    dom.watchInstantPageAdBtn = document.getElementById('watchInstantPageAdBtn');

    dom.timeSkipRow = document.getElementById('timeSkipRow');
    dom.timeSkipButtons = buildTimeSkipButtons(dom.timeSkipRow);

    dom.cosmeticsList = document.getElementById('cosmeticsList');
    dom.cosmeticRows = buildCosmeticRows(dom.cosmeticsList);

    return dom;
}

// One button per configured time-skip tier, built once.
function buildTimeSkipButtons(timeSkipRow) {
    return getTimeSkipOptions().map(option => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = `Skip ${option.label} (${option.mockPrice})`;
        timeSkipRow.appendChild(btn);
        return btn;
    });
}

// One clickable row per cosmetic theme, built once.
function buildCosmeticRows(cosmeticsList) {
    return getAllCosmetics().map(() => {
        const row = document.createElement('div');
        row.className = 'library-row clickable';
        cosmeticsList.appendChild(row);
        return row;
    });
}

// One fixed row per monkey in the roster, built once — same reasoning as
// the Library's rows.
function buildProdigyRows(prodigyList) {
    return getAllMonkeys().map(() => {
        const row = document.createElement('div');
        row.className = 'library-row';
        prodigyList.appendChild(row);
        return row;
    });
}

// One fixed row per quote in the game, built once — the Library is a
// collection, not a ticker, so unlike the feed it's fine for this to just
// be as tall as the quote count requires.
function buildLibraryRows(libraryList) {
    return getAllQuotes().map(() => {
        const row = document.createElement('div');
        row.className = 'library-row';
        libraryList.appendChild(row);
        return row;
    });
}

// Builds a fixed number of row slots up front — the feed only ever updates
// their text/class, so the panel never grows, shrinks, or scrolls.
function buildFeedRows(feedList) {
    const rows = [];
    for (let i = 0; i < CONFIG.feed.maxItems; i++) {
        const row = document.createElement('div');
        row.className = 'feed-row feed-row-empty';
        row.textContent = '—';
        feedList.appendChild(row);
        rows.push(row);
    }
    return rows;
}

// Shows the "while you were away" banner. Call once at startup if
// applyOfflineProgress() returned a summary.
export function showOfflineSummary(summary) {
    const duration = formatDuration(summary.simulatedSeconds);
    const capNote = summary.capped ? ` (capped at ${formatDuration(CONFIG.offline.maxSeconds)})` : '';

    const parts = [];
    if (summary.pagesEarned > 0 || summary.moneyEarned > 0 || summary.intelligenceEarned > 0) {
        parts.push(`your monkeys typed ${formatNumber(summary.pagesEarned)} pages, earning `
            + `${formatNumber(summary.moneyEarned)} money and ${formatNumber(summary.intelligenceEarned)} intelligence`);
    }
    if (summary.monkeysArrived > 0) {
        parts.push(`${formatNumber(summary.monkeysArrived)} new monkeys wandered into the habitat`);
    }
    const body = parts.length > 0 ? parts.join(', and ') : 'nothing much happened';

    dom.offlineBannerText.textContent = `Welcome back! While you were away for ${duration}${capNote}, ${body}.`;
    dom.offlineBanner.hidden = false;
}

export function render(state) {
    const workingCount = state.typewriters.workers.length;
    const totalPopulation = state.habitat.count + workingCount;
    const habitatFull = totalPopulation >= state.habitat.capacity - 0.001;
    const hasIdleMonkey = Math.floor(state.habitat.count) >= 1;
    const typewritersFull = workingCount >= state.typewriters.capacity;

    dom.habitatMeter.style.width = (state.habitat.count / state.habitat.capacity) * 100 + '%';
    dom.habitatCountVal.textContent = Math.floor(state.habitat.count);
    dom.habitatCapVal.textContent = state.habitat.capacity;
    dom.fillHint.textContent = habitatFull ? 'The habitat is full' : 'Filling';

    dom.typewriterMeter.style.width = (workingCount / state.typewriters.capacity) * 100 + '%';
    dom.typewriterCountVal.textContent = workingCount;
    dom.typewriterCapVal.textContent = state.typewriters.capacity;

    dom.pagesVal.textContent = formatNumber(state.pagesCompleted);
    dom.intelligenceVal.textContent = formatNumber(state.currencies.intelligence);
    dom.moneyVal.textContent = formatNumber(state.currencies.money);

    dom.assignOneBtn.disabled = typewritersFull || !hasIdleMonkey;
    dom.fillTypewritersBtn.disabled = typewritersFull || !hasIdleMonkey;
    dom.recallOneBtn.disabled = workingCount === 0;
    dom.clearTypewritersBtn.disabled = workingCount === 0;

    renderTrainingRow(state, 'typingSpeed', dom.typingSpeedVal, value => value.toFixed(1) + ' chars/sec');
    renderTrainingRow(state, 'wordChance', dom.wordChanceVal, formatPercent);
    renderTrainingRow(state, 'sentenceChance', dom.sentenceChanceVal, formatPercent);

    renderUpgradeRow(state, 'typewriters');
    renderUpgradeRow(state, 'habitat');

    renderFeed(state);
    renderPrestige(state);
    renderMilestones(state);
    renderLibrary(state);
    renderProdigy(state);
    renderStore(state);

    document.documentElement.dataset.theme = getActiveCosmetic(state);
}

// Same transient-message pattern as the Prodigy panel's pull result — the
// game loop's next render() would otherwise overwrite it within ~16ms.
let storeStatusMessage = null;
let storeStatusExpiresAt = 0;

export function showStoreMessage(message) {
    storeStatusMessage = message;
    storeStatusExpiresAt = performance.now() + 4000;
}

function renderStore(state) {
    dom.storeStatusVal.textContent =
        (storeStatusMessage && performance.now() < storeStatusExpiresAt) ? storeStatusMessage : '';

    if (isEarningsBoostActive(state)) {
        const remaining = Math.max(0, (state.monetization.earningsBoostExpiresAt - Date.now()) / 1000);
        dom.earningsBoostStatusVal.textContent = `Active — ${formatDuration(remaining)} left`;
    } else if (canWatchEarningsBoostAd(state)) {
        dom.earningsBoostStatusVal.textContent = 'Ready';
    } else {
        const remaining = Math.max(0, (state.monetization.adCooldowns.earningsBoost - Date.now()) / 1000);
        dom.earningsBoostStatusVal.textContent = `Next ad in ${formatDuration(remaining)}`;
    }
    dom.watchEarningsBoostAdBtn.disabled = !canWatchEarningsBoostAd(state);

    const instantPageReady = canWatchInstantPageAd(state);
    if (instantPageReady) {
        dom.instantPageStatusVal.textContent = 'Ready';
    } else {
        const remaining = Math.max(0, (state.monetization.adCooldowns.instantPage - Date.now()) / 1000);
        dom.instantPageStatusVal.textContent = `Next ad in ${formatDuration(remaining)}`;
    }
    dom.watchInstantPageAdBtn.disabled = !instantPageReady || state.typewriters.workers.length === 0;

    const cosmetics = getAllCosmetics();
    const activeCosmetic = getActiveCosmetic(state);
    dom.cosmeticRows.forEach((row, i) => {
        const cosmetic = cosmetics[i];
        const owned = isCosmeticOwned(state, cosmetic.id);
        const active = activeCosmetic === cosmetic.id;

        if (active) {
            row.className = 'library-row clickable library-row-found';
            row.textContent = `✓ ${cosmetic.name} (equipped)`;
        } else if (owned) {
            row.className = 'library-row clickable library-row-unknown';
            row.textContent = `${cosmetic.name} — owned, click to equip`;
        } else {
            row.className = 'library-row clickable library-row-locked';
            row.textContent = `${cosmetic.name} — ${cosmetic.mockPrice}, click to buy`;
        }
    });
}

// A pull result needs to stay on screen for a moment — otherwise the game
// loop's next render() call (within ~16ms) would overwrite it before
// anyone could read it. Held here rather than in game state since it's
// purely a transient UI concern, not something to save/load.
let prodigyStatusMessage = null;
let prodigyStatusExpiresAt = 0;

export function showProdigyPullResult(message) {
    prodigyStatusMessage = message;
    prodigyStatusExpiresAt = performance.now() + 4000;
}

function renderProdigy(state) {
    const monkeys = getAllMonkeys();
    const complete = isRosterComplete(state);

    dom.prodigyTokensVal.textContent = formatNumber(state.prodigyTokens);
    dom.prodigyBonusVal.textContent = formatPercent(getProdigyMoneyMultiplier(state) - 1);
    dom.prodigyProgressVal.textContent = `${formatNumber(getOwnedCount(state))} / ${formatNumber(monkeys.length)}`;

    if (complete) {
        dom.prodigyPullBtn.textContent = 'Roster complete';
        dom.prodigyPullBtn.disabled = true;
    } else {
        dom.prodigyPullBtn.textContent = `Pull (${formatNumber(CONFIG.prodigy.pullCost)} 🍌)`;
        dom.prodigyPullBtn.disabled = state.prodigyTokens < CONFIG.prodigy.pullCost;
    }

    if (prodigyStatusMessage && performance.now() < prodigyStatusExpiresAt) {
        dom.prodigyPullHint.textContent = prodigyStatusMessage;
    } else if (complete) {
        dom.prodigyPullHint.textContent = 'Every prodigy monkey has found its way to the typewriters.';
    } else {
        dom.prodigyPullHint.textContent = 'Rare finds have a chance to also drop a token.';
    }

    dom.prodigyRows.forEach((row, i) => {
        const monkey = monkeys[i];
        if (isOwned(state, monkey.id)) {
            row.className = `library-row library-row-found prodigy-rarity-${monkey.rarity}`;
            row.textContent = `🐒 ${monkey.name} (${capitalize(monkey.rarity)}) — +${formatPercent(monkey.moneyBonus)} money`;
        } else {
            row.className = 'library-row library-row-unknown';
            row.textContent = `??? (${capitalize(monkey.rarity)}) — not yet found`;
        }
    });
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function renderLibrary(state) {
    const quotes = getAllQuotes();
    dom.libraryProgressVal.textContent = `${formatNumber(getDiscoveredCount(state))} / ${formatNumber(quotes.length)}`;

    dom.libraryRows.forEach((row, i) => {
        const quote = quotes[i];

        if (isDiscovered(state, quote.text)) {
            row.className = 'library-row library-row-found';
            row.textContent = `📖 "${quote.text}"`;
        } else if (state.fame >= quote.fameRequired) {
            row.className = 'library-row library-row-unknown';
            row.textContent = '??? — not yet found';
        } else {
            row.className = 'library-row library-row-locked';
            row.textContent = `🔒 requires ${formatNumber(quote.fameRequired)} fame`;
        }
    });
}

function renderMilestones(state) {
    dom.milestoneMultiplierVal.textContent = formatNumber(getMilestoneMoneyMultiplier(state));

    const typewriterProgress = getProgressToNextMilestone(state.typewriters.capacity, CONFIG.milestones.typewriters.every);
    dom.typewriterMilestoneHint.textContent =
        `${formatNumber(typewriterProgress)} more typewriter${typewriterProgress === 1 ? '' : 's'} for the next ×2 milestone.`;

    for (const [key, hintEl] of Object.entries(dom.trainMilestoneHints)) {
        const progress = getProgressToNextMilestone(state.training[key].level, CONFIG.milestones.training.every);
        hintEl.textContent = `${formatNumber(progress)} more level${progress === 1 ? '' : 's'} for the next ×2 milestone.`;
    }
}

function renderPrestige(state) {
    const fameGain = getFameGain(state);
    const eligible = canPublish(state);

    dom.fameVal.textContent = formatNumber(state.fame);
    dom.fameBonusVal.textContent = formatPercent(state.fame * CONFIG.prestige.moneyBonusPerFame);
    dom.fameGainVal.textContent = formatNumber(fameGain);
    dom.publishBtn.disabled = !eligible;

    if (eligible) {
        dom.publishHint.textContent = 'Money, monkeys, training, and upgrades all reset on publish — fame is the only thing that carries over.';
    } else {
        const pagesNeeded = Math.max(0, Math.ceil(CONFIG.prestige.pagesPerFame - state.pagesCompleted));
        dom.publishHint.textContent = `Write ${formatNumber(pagesNeeded)} more page${pagesNeeded === 1 ? '' : 's'} to publish your first manuscript.`;
    }
}

function renderFeed(state) {
    const items = state.feed.items;

    dom.feedRows.forEach((row, i) => {
        const item = items[i];
        if (!item) {
            row.className = 'feed-row feed-row-empty';
            row.textContent = '—';
            return;
        }

        if (item.type === 'rare') {
            row.className = 'feed-row feed-row-rare';
            const tokenNote = item.tokenDropped ? ' 🍌 +1 token!' : '';
            row.textContent = `💎 "${item.text}" — +${formatNumber(item.payout)} money!${tokenNote}`;
            return;
        }

        const icon = item.type === 'sentence' ? '✨' : '🐒';
        row.className = 'feed-row' + (item.type === 'sentence' ? ' feed-row-sentence' : '');
        row.textContent = `${icon} "${item.text}"`;
    });
}

function renderTrainingRow(state, key, valueEl, formatValue) {
    valueEl.textContent = formatValue(state.training[key].value);

    const buttons = dom.trainButtons[key];
    const budget = state.currencies.intelligence;
    for (const [slot, tierCount] of TIERS) {
        renderBuyButton(buttons[slot], getTrainingPreview(state, key, tierCount), '🧠', budget);
    }
}

function renderUpgradeRow(state, key) {
    const buttons = dom.upgradeButtons[key];
    const budget = state.currencies.money;
    for (const [slot, tierCount] of TIERS) {
        renderBuyButton(buttons[slot], getUpgradePreview(state, key, tierCount), '💰', budget);
    }
}

// preview is { count, cost, maxed } from getTrainingPreview/getUpgradePreview.
// For the fixed tiers (×1/×10/×100), count is the tier's nominal size (or
// less, only when the value cap makes more impossible) — NOT reduced by
// affordability, so the label always names what a full purchase would be,
// and the button is disabled unless the whole batch is affordable. Max is
// the one tier where count IS the affordable amount, since "buy as many as
// I can" is its entire purpose — with the same disabled check, that falls
// out naturally: cost is never more than budget for Max, so budget < cost
// never fires there, but count === 0 (nothing affordable) still does.
function renderBuyButton(buttonEl, preview, icon, budget) {
    if (preview.maxed) {
        buttonEl.textContent = 'MAX';
        buttonEl.disabled = true;
        return;
    }

    buttonEl.textContent = `×${preview.count} (${formatNumber(preview.cost)} ${icon})`;
    buttonEl.disabled = preview.count === 0 || budget < preview.cost;
}
