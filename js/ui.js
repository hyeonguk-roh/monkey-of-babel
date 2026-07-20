import { CONFIG } from './config.js';
import { formatNumber, formatPercent, formatClock, clampFraction } from './format.js';
import { getTrainingCost, getUpgradeCost } from './simulation.js';
import { canPublish } from './prestige.js';
import { getAllQuotes, isDiscovered, getDiscoveredCount, getQuoteIcon } from './library.js';
import {
    getAllMonkeys,
    isOwned,
    getOwnedCount,
    isRosterComplete,
    getProdigyMoneyMultiplier,
    getMaxProdigyBonus,
    getRarityIcon,
} from './prodigy.js';
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

// Grabs every element the game touches, once, at startup.
export function cacheDom() {
    dom.fameCount = document.getElementById('fameCount');

    dom.offlineBanner = document.getElementById('offlineBanner');
    dom.offlineBannerText = document.getElementById('offlineBannerText');
    dom.dismissOfflineBtn = document.getElementById('dismissOfflineBtn');

    dom.monkeyPool = document.getElementById('monkeyPool');
    dom.buyHabitatBtn = document.getElementById('buyHabitatBtn');
    dom.buyHabitatRing = document.getElementById('buyHabitatRing');

    dom.typewriterGrid = document.getElementById('typewriterGrid');
    dom.assignOneBtn = document.getElementById('assignOneBtn');
    dom.recallOneBtn = document.getElementById('recallOneBtn');
    dom.fillTypewritersBtn = document.getElementById('fillTypewritersBtn');
    dom.clearTypewritersBtn = document.getElementById('clearTypewritersBtn');
    dom.buyTypewriterBtn = document.getElementById('buyTypewriterBtn');
    dom.buyTypewriterRing = document.getElementById('buyTypewriterRing');

    dom.pageView = document.getElementById('pageView');
    dom.pageStack = document.getElementById('pageStack');

    dom.trainTiles = {
        typingSpeed: {
            level: document.getElementById('typingSpeedLevel'),
            btn: document.getElementById('trainTypingSpeedBtn'),
            ring: document.getElementById('trainTypingSpeedRing'),
        },
        wordChance: {
            level: document.getElementById('wordChanceLevel'),
            btn: document.getElementById('trainWordChanceBtn'),
            ring: document.getElementById('trainWordChanceRing'),
        },
        sentenceChance: {
            level: document.getElementById('sentenceChanceLevel'),
            btn: document.getElementById('trainSentenceChanceBtn'),
            ring: document.getElementById('trainSentenceChanceRing'),
        },
    };
    dom.inkPile = document.getElementById('inkPile');
    dom.coinPile = document.getElementById('coinPile');

    dom.shelfGrid = document.getElementById('shelfGrid');
    dom.publishBtn = document.getElementById('publishBtn');

    dom.libraryPanel = document.getElementById('libraryPanel');
    dom.libraryList = document.getElementById('libraryList');
    dom.libraryRows = buildLibraryRows(dom.libraryList);
    dom.libraryWallList = document.getElementById('libraryWallList');

    dom.prodigyPanel = document.getElementById('prodigyPanel');
    dom.prodigyBonusDial = document.getElementById('prodigyBonusDial');
    dom.prodigyList = document.getElementById('prodigyList');
    dom.prodigyRows = buildProdigyRows(dom.prodigyList);
    dom.prodigyTokenRow = document.getElementById('prodigyTokenRow');
    dom.prodigyPullBtn = document.getElementById('prodigyPullBtn');
    dom.prodigyPullHint = document.getElementById('prodigyPullHint');

    dom.storePanel = document.getElementById('storePanel');
    dom.storeStatusVal = document.getElementById('storeStatusVal');
    dom.earningsBoostIcon = document.getElementById('earningsBoostIcon');
    dom.earningsBoostDial = document.getElementById('earningsBoostDial');
    dom.watchEarningsBoostAdBtn = document.getElementById('watchEarningsBoostAdBtn');
    dom.instantPageIcon = document.getElementById('instantPageIcon');
    dom.instantPageDial = document.getElementById('instantPageDial');
    dom.watchInstantPageAdBtn = document.getElementById('watchInstantPageAdBtn');

    dom.timeSkipRow = document.getElementById('timeSkipRow');
    dom.timeSkipButtons = buildTimeSkipButtons(dom.timeSkipRow);

    dom.cosmeticsList = document.getElementById('cosmeticsList');
    dom.cosmeticRows = buildCosmeticRows(dom.cosmeticsList);

    return dom;
}

function buildTimeSkipButtons(timeSkipRow) {
    return getTimeSkipOptions().map((option, i) => {
        const btn = document.createElement('button');
        btn.className = 'key key--wide';
        // Duration and price both scale with tier index across these fixed
        // presets, so one pip count stands in for both.
        btn.title = `Skip ${option.label} (${option.mockPrice})`;
        btn.textContent = `⏭️ ${'●'.repeat(i + 1)}`;
        timeSkipRow.appendChild(btn);
        return btn;
    });
}

function buildCosmeticRows(cosmeticsList) {
    return getAllCosmetics().map(() => {
        const row = document.createElement('div');
        row.className = 'library-row clickable';
        cosmeticsList.appendChild(row);
        return row;
    });
}

function buildProdigyRows(prodigyList) {
    return getAllMonkeys().map(() => {
        const row = document.createElement('div');
        row.className = 'library-row';
        prodigyList.appendChild(row);
        return row;
    });
}

function buildLibraryRows(libraryList) {
    return getAllQuotes().map(() => {
        const row = document.createElement('div');
        row.className = 'library-row';
        libraryList.appendChild(row);
        return row;
    });
}

function setDial(el, fraction, title) {
    el.style.setProperty('--pct', clampFraction(fraction, 1) * 100);
    if (title !== undefined) el.title = title;
}

// A buy key's affordability ring fills toward 100% as budget approaches
// cost — the picture alone answers "can I press it, and roughly when."
function renderAffordability(btnEl, ringEl, cost, budget, costLabel) {
    if (cost === null) {
        btnEl.disabled = true;
        ringEl.style.setProperty('--pct', 100);
        btnEl.title = 'Maxed';
        return;
    }
    const fraction = clampFraction(budget, cost);
    ringEl.style.setProperty('--pct', fraction * 100);
    btnEl.disabled = fraction < 1;
    btnEl.title = `${costLabel} (${formatNumber(cost)})`;
}

export function showOfflineSummary(summary) {
    const parts = [`⏱️${formatClock(summary.simulatedSeconds)}${summary.capped ? '🔺' : ''}`];
    if (summary.pagesEarned > 0) parts.push(`📄+${formatNumber(summary.pagesEarned)}`);
    if (summary.monkeysArrived > 0) parts.push(`🐒+${formatNumber(summary.monkeysArrived)}`);

    dom.offlineBannerText.textContent = parts.join('  ');
    dom.offlineBannerText.title =
        `Away for ${formatClock(summary.simulatedSeconds)}${summary.capped ? ' (capped)' : ''} — `
        + `+${formatNumber(summary.moneyEarned)} money, +${formatNumber(summary.intelligenceEarned)} intelligence, `
        + `+${formatNumber(summary.pagesEarned)} pages, +${formatNumber(summary.monkeysArrived)} monkeys arrived`;
    dom.offlineBanner.hidden = false;
}

// Progressive disclosure: a brand-new player sees only the core loop
// (typewriters, the page, training, coins, the shelf). The Library, Prodigy
// Roster, and Store stay hidden until they'd actually mean something —
// Library/Prodigy unlock from the permanent data that makes them non-empty,
// Store unlocks on the first real spend decision (see state.everPurchased).
// Once shown, none of these hide again (all three conditions are monotonic
// across a prestige reset).
function renderPanelVisibility(state) {
    const libraryUnlocked = state.library.discovered.length > 0 || state.libraryWall.length > 0;
    const prodigyUnlocked = state.prodigy.owned.length > 0 || state.prodigyTokens > 0;
    const storeUnlocked = state.everPurchased;

    dom.libraryPanel.hidden = !libraryUnlocked;
    dom.prodigyPanel.hidden = !prodigyUnlocked;
    dom.storePanel.hidden = !storeUnlocked;

    return { libraryUnlocked, prodigyUnlocked, storeUnlocked };
}

export function render(state) {
    renderTopbar(state);
    renderMonkeysAndTypewriters(state);
    renderPage(state);
    renderTraining(state);
    renderPile(dom.inkPile, state.currencies.intelligence, ['💧', '🧴', '📖']);
    renderPile(dom.coinPile, state.currencies.money, ['🟤', '⚪', '🟡']);
    renderShelf(state);

    const { libraryUnlocked, prodigyUnlocked, storeUnlocked } = renderPanelVisibility(state);
    if (libraryUnlocked) {
        renderLibrary(state);
        renderLibraryWall(state);
    }
    if (prodigyUnlocked) renderProdigy(state);
    if (storeUnlocked) renderStore(state);

    document.documentElement.dataset.theme = getActiveCosmetic(state);
}

function renderTopbar(state) {
    const capped = Math.min(state.fame, 10);
    dom.fameCount.textContent = '🏆'.repeat(capped) + (state.fame > 10 ? '➕' : '') || '🏆○';
    dom.fameCount.title = `${state.fame} fame`;
}

// --- Monkeys & typewriters: waiting pool + grid, diffed on transition only
// so the "walk in" animation plays once per new arrival instead of
// restarting every frame. ---

let monkeySlotEls = [];
let monkeyFilledPrev = [];
let typewriterSlotEls = [];
let typewriterOccupiedPrev = [];

function ensureSlots(container, cache, prevCache, capacity, baseClass) {
    if (cache.length === capacity) return;
    container.innerHTML = '';
    cache.length = 0;
    prevCache.length = 0;
    for (let i = 0; i < capacity; i++) {
        const slot = document.createElement('div');
        slot.className = baseClass;
        container.appendChild(slot);
        cache.push(slot);
        prevCache.push(false);
    }
}

function renderMonkeysAndTypewriters(state) {
    ensureSlots(dom.monkeyPool, monkeySlotEls, monkeyFilledPrev, state.habitat.capacity, 'monkey-slot');
    const idleCount = Math.floor(state.habitat.count);
    for (let i = 0; i < state.habitat.capacity; i++) {
        const filled = i < idleCount;
        if (filled === monkeyFilledPrev[i]) continue;
        const slot = monkeySlotEls[i];
        slot.classList.toggle('monkey-slot-idle', filled);
        slot.textContent = filled ? '🐒' : '';
        slot.classList.toggle('just-arrived', filled);
        monkeyFilledPrev[i] = filled;
    }
    dom.monkeyPool.title = `${idleCount} / ${state.habitat.capacity} monkeys waiting`;

    ensureSlots(dom.typewriterGrid, typewriterSlotEls, typewriterOccupiedPrev, state.typewriters.capacity, 'typewriter-slot');
    for (let i = 0; i < state.typewriters.capacity; i++) {
        const occupied = i < state.typewriters.seatedCount;
        if (occupied === typewriterOccupiedPrev[i]) continue;
        const slot = typewriterSlotEls[i];
        slot.classList.toggle('typewriter-slot-occupied', occupied);
        slot.textContent = occupied ? '🐒' : '⌨️';
        slot.classList.toggle('just-seated', occupied);
        typewriterOccupiedPrev[i] = occupied;
    }
    dom.typewriterGrid.title = `${state.typewriters.seatedCount} / ${state.typewriters.capacity} monkeys typing`;

    const typewritersFull = state.typewriters.seatedCount >= state.typewriters.capacity;
    const hasIdleMonkey = idleCount >= 1;
    dom.assignOneBtn.disabled = typewritersFull || !hasIdleMonkey;
    dom.fillTypewritersBtn.disabled = typewritersFull || !hasIdleMonkey;
    dom.recallOneBtn.disabled = state.typewriters.seatedCount === 0;
    dom.clearTypewritersBtn.disabled = state.typewriters.seatedCount === 0;

    renderAffordability(dom.buyHabitatBtn, dom.buyHabitatRing, getUpgradeCost(state, 'habitat'), state.currencies.money, 'Add a monkey slot');
    renderAffordability(dom.buyTypewriterBtn, dom.buyTypewriterRing, getUpgradeCost(state, 'typewriters'), state.currencies.money, 'Add a typewriter');
}

// --- The page: appends only newly-typed segments each render, and plays a
// fly-out transition on whatever's accumulated when a page completes. ---

let renderedSegmentCount = 0;
let lastPageCompletions = -1;

function renderPage(state) {
    if (lastPageCompletions === -1) lastPageCompletions = state.page.completions;

    if (state.page.completions !== lastPageCompletions) {
        lastPageCompletions = state.page.completions;
        renderedSegmentCount = state.page.segments.length; // the reset already happened in state
        dom.pageView.classList.add('flying');
        setTimeout(() => {
            dom.pageView.classList.remove('flying');
            dom.pageView.innerHTML = '';
        }, 400);
        renderPageStack(state);
        return;
    }

    const segments = state.page.segments;
    for (let i = renderedSegmentCount; i < segments.length; i++) {
        const seg = segments[i];
        const el = document.createElement(seg.type === 'rare' ? 'div' : 'span');
        el.className = `segment-${seg.type}`;
        el.textContent = seg.text;
        if (seg.type === 'rare') {
            el.title = seg.text.trim() + (seg.payout ? ` — +${formatNumber(seg.payout)} money` : '');
        }
        dom.pageView.appendChild(el);
    }
    renderedSegmentCount = segments.length;

    renderPageStack(state);
}

function renderPageStack(state) {
    const total = CONFIG.run.pagesPerBook;
    if (dom.pageStack.childElementCount !== total) {
        dom.pageStack.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const icon = document.createElement('span');
            dom.pageStack.appendChild(icon);
        }
    }
    const filled = state.shelf.pagesInBook;
    for (let i = 0; i < total; i++) {
        dom.pageStack.children[i].textContent = i < filled ? '📄' : '⬜';
    }
    dom.pageStack.title = `${filled} / ${total} pages toward this book`;
}

// --- Training: a row of level pips (a literal countable purchase count,
// not a percentage) plus a buy key with an affordability ring. ---

function renderLevelPips(container, level, levels) {
    if (container.childElementCount !== levels) {
        container.innerHTML = '';
        for (let i = 0; i < levels; i++) {
            const pip = document.createElement('span');
            pip.className = 'level-pip';
            pip.textContent = '●';
            container.appendChild(pip);
        }
    }
    for (let i = 0; i < levels; i++) {
        container.children[i].classList.toggle('filled', i < level);
    }
    container.title = `Level ${level} / ${levels}`;
}

function renderTraining(state) {
    for (const [key, tile] of Object.entries(dom.trainTiles)) {
        const settings = CONFIG.training[key];
        const training = state.training[key];
        renderLevelPips(tile.level, training.level, settings.levels);
        renderAffordability(tile.btn, tile.ring, getTrainingCost(state, key), state.currencies.intelligence, 'Train');
    }
}

// --- Coin / ink piles: quantities as denominated objects. ---

function decompose(amount) {
    const n = Math.max(0, Math.floor(amount));
    return [n % 10, Math.floor(n / 10) % 10, Math.floor(n / 100)];
}

function renderPile(container, amount, icons) {
    const [ones, tens, hundreds] = decompose(amount);
    container.innerHTML = '';
    let idx = 0;
    const groups = [[hundreds, icons[2]], [tens, icons[1]], [ones, icons[0]]];
    for (const [count, icon] of groups) {
        for (let i = 0; i < count; i++) {
            const item = document.createElement('span');
            item.className = 'pile-item';
            item.textContent = icon;
            item.style.transform = `rotate(${((idx % 5) - 2) * 4}deg)`;
            container.appendChild(item);
            idx += 1;
        }
    }
    container.title = formatNumber(amount);
}

// --- Shelf: a fixed grid of book slots, diffed on transition. ---

let bookSlotEls = [];
let bookFilledPrev = [];

function renderShelf(state) {
    ensureSlots(dom.shelfGrid, bookSlotEls, bookFilledPrev, CONFIG.run.booksPerShelf, 'book-slot');
    for (let i = 0; i < CONFIG.run.booksPerShelf; i++) {
        const filled = i < state.shelf.booksCompleted;
        if (filled === bookFilledPrev[i]) continue;
        const slot = bookSlotEls[i];
        slot.classList.toggle('book-slot-filled', filled);
        slot.textContent = filled ? '📕' : '';
        slot.classList.toggle('just-completed', filled);
        bookFilledPrev[i] = filled;
    }
    dom.shelfGrid.title = `${state.shelf.booksCompleted} / ${CONFIG.run.booksPerShelf} books`;
    dom.publishBtn.disabled = !canPublish(state);
}

function renderLibrary(state) {
    const quotes = getAllQuotes();
    dom.libraryRows.forEach((row, i) => {
        const quote = quotes[i];
        if (isDiscovered(state, quote.text)) {
            row.className = 'library-row library-row-found';
            row.textContent = `📖 ${quote.icon}`;
            row.title = quote.text;
        } else if (state.fame >= quote.fameRequired) {
            row.className = 'library-row library-row-unknown';
            row.textContent = '❓';
            row.title = 'Not yet found';
        } else {
            row.className = 'library-row library-row-locked';
            row.textContent = '🔒';
            row.title = `Requires ${quote.fameRequired} fame (currently ${state.fame})`;
        }
    });
    dom.libraryList.title = `${getDiscoveredCount(state)} / ${quotes.length} quotes found`;
}

function renderLibraryWall(state) {
    const wall = state.libraryWall;
    if (dom.libraryWallList.childElementCount !== wall.length) {
        dom.libraryWallList.innerHTML = '';
        wall.forEach((entry, i) => {
            const badge = document.createElement('div');
            badge.className = 'library-row library-row-found';
            badge.textContent = '📚';
            badge.title = `Shelf ${i + 1} — published ${new Date(entry.publishedAt).toLocaleDateString()}`;
            dom.libraryWallList.appendChild(badge);
        });
    }
}

// Transient status messages — held here rather than in game state since
// they're purely a UI concern, not something to save/load. Same reasoning
// for both: the game loop's next render() would otherwise overwrite them
// within ~16ms.
let storeStatusMessage = null;
let storeStatusTooltip = '';
let storeStatusExpiresAt = 0;

export function showStoreMessage(message, tooltip = '') {
    storeStatusMessage = message;
    storeStatusTooltip = tooltip;
    storeStatusExpiresAt = performance.now() + 4000;
}

let prodigyStatusMessage = null;
let prodigyStatusExpiresAt = 0;

export function showProdigyPullResult(message) {
    prodigyStatusMessage = message;
    prodigyStatusExpiresAt = performance.now() + 4000;
}

function renderProdigy(state) {
    const monkeys = getAllMonkeys();
    const complete = isRosterComplete(state);

    const prodigyBonus = getProdigyMoneyMultiplier(state) - 1;
    setDial(dom.prodigyBonusDial, clampFraction(prodigyBonus, getMaxProdigyBonus()),
        `+${formatPercent(prodigyBonus)} money, permanent (max +${formatPercent(getMaxProdigyBonus())})`);

    const pullCost = CONFIG.prodigy.pullCost;
    if (dom.prodigyTokenRow.childElementCount !== pullCost) {
        dom.prodigyTokenRow.innerHTML = '';
        for (let i = 0; i < pullCost; i++) {
            const token = document.createElement('span');
            dom.prodigyTokenRow.appendChild(token);
        }
    }
    for (let i = 0; i < pullCost; i++) {
        const child = dom.prodigyTokenRow.children[i];
        child.textContent = '🍌';
        child.classList.toggle('dim', i >= state.prodigyTokens);
    }
    dom.prodigyTokenRow.title = `${state.prodigyTokens} tokens (${pullCost} per pull)`;

    if (complete) {
        dom.prodigyPullBtn.textContent = '✅';
        dom.prodigyPullBtn.title = 'Roster complete';
        dom.prodigyPullBtn.disabled = true;
    } else {
        dom.prodigyPullBtn.textContent = '🎰';
        dom.prodigyPullBtn.title = `Pull (${pullCost} tokens)`;
        dom.prodigyPullBtn.disabled = state.prodigyTokens < pullCost;
    }

    if (prodigyStatusMessage && performance.now() < prodigyStatusExpiresAt) {
        dom.prodigyPullHint.textContent = prodigyStatusMessage;
    } else if (complete) {
        dom.prodigyPullHint.textContent = '🐒✅';
    } else {
        dom.prodigyPullHint.textContent = '💎➡️🍌';
    }

    dom.prodigyRows.forEach((row, i) => {
        const monkey = monkeys[i];
        if (isOwned(state, monkey.id)) {
            row.className = `library-row library-row-found prodigy-rarity-${monkey.rarity}`;
            row.textContent = `${monkey.icon} ${getRarityIcon(monkey.rarity)} 📈`;
            row.title = `${monkey.name} (${monkey.rarity}) — +${formatPercent(monkey.moneyBonus)} money`;
        } else {
            row.className = 'library-row library-row-unknown';
            row.textContent = `❓ ${getRarityIcon(monkey.rarity)}`;
            row.title = `Not yet found (${monkey.rarity})`;
        }
    });
}

function renderAdStatus(iconEl, dialEl, ready, fraction, tooltip) {
    iconEl.hidden = !ready;
    dialEl.hidden = ready;
    if (!ready) setDial(dialEl, fraction, tooltip);
}

function renderStore(state) {
    const messageShowing = storeStatusMessage && performance.now() < storeStatusExpiresAt;
    dom.storeStatusVal.textContent = messageShowing ? storeStatusMessage : '';
    dom.storeStatusVal.title = messageShowing ? storeStatusTooltip : '';

    const boostActive = isEarningsBoostActive(state);
    const boostReady = canWatchEarningsBoostAd(state);
    if (boostActive) {
        const remaining = Math.max(0, (state.monetization.earningsBoostExpiresAt - Date.now()) / 1000);
        renderAdStatus(dom.earningsBoostIcon, dom.earningsBoostDial,
            false, clampFraction(remaining, CONFIG.monetization.earningsBoost.durationSeconds), `Active — ${formatClock(remaining)} left`);
    } else {
        const remaining = Math.max(0, (state.monetization.adCooldowns.earningsBoost - Date.now()) / 1000);
        renderAdStatus(dom.earningsBoostIcon, dom.earningsBoostDial,
            boostReady, 1 - clampFraction(remaining, CONFIG.monetization.earningsBoost.adCooldownSeconds), `Next ad available in ${formatClock(remaining)}`);
    }
    dom.watchEarningsBoostAdBtn.disabled = !boostReady;

    const instantPageReady = canWatchInstantPageAd(state);
    const instantRemaining = Math.max(0, (state.monetization.adCooldowns.instantPage - Date.now()) / 1000);
    renderAdStatus(dom.instantPageIcon, dom.instantPageDial,
        instantPageReady, 1 - clampFraction(instantRemaining, CONFIG.monetization.instantPage.adCooldownSeconds),
        `Next ad available in ${formatClock(instantRemaining)}`);
    dom.watchInstantPageAdBtn.disabled = !instantPageReady || state.typewriters.seatedCount === 0;

    const cosmetics = getAllCosmetics();
    const activeCosmetic = getActiveCosmetic(state);
    dom.cosmeticRows.forEach((row, i) => {
        const cosmetic = cosmetics[i];
        const owned = isCosmeticOwned(state, cosmetic.id);
        const active = activeCosmetic === cosmetic.id;

        if (active) {
            row.className = 'library-row clickable library-row-found';
            row.textContent = `✅ ${cosmetic.icon}`;
            row.title = `${cosmetic.name} (equipped)`;
        } else if (owned) {
            row.className = 'library-row clickable library-row-unknown';
            row.textContent = `⭕ ${cosmetic.icon}`;
            row.title = `${cosmetic.name} — owned, click to equip`;
        } else {
            row.className = 'library-row clickable library-row-locked';
            row.textContent = `🔒 ${cosmetic.icon}`;
            row.title = `${cosmetic.name} — ${cosmetic.mockPrice}, click to buy`;
        }
    });
}
