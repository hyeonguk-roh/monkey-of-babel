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
import { playClack, playPageComplete, playCoin, playChime } from './sound.js';

const dom = {};

// Grabs every element the game touches, once, at startup.
export function cacheDom() {
    dom.fameCount = document.getElementById('fameCount');
    dom.muteBtn = document.getElementById('muteBtn');

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

    dom.pagePanel = document.getElementById('pagePanel');
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

// A floating emoji that arcs from one element's screen position to
// another's, via a CSS keyframe animation driven by custom properties (so
// one generic animation covers every source/destination pair). Used for
// coins flying page->pile (a payout) and pile->button (a spend), and pages
// flying page->stack. Purely decorative — appended to <body> as position:
// fixed and removed once its animation finishes.
function spawnFlight({ fromRect, toRect, emoji, count = 1, duration = 400 }) {
    for (let i = 0; i < count; i++) {
        const el = document.createElement('span');
        el.className = 'fly-sprite';
        el.textContent = emoji;

        const jitterX = count > 1 ? (Math.random() * 2 - 1) * 20 : 0;
        const x0 = fromRect.left + fromRect.width / 2;
        const y0 = fromRect.top + fromRect.height / 2;
        const x1 = toRect.left + toRect.width / 2 + jitterX;
        const y1 = toRect.top + toRect.height / 2;
        const mx = (x0 + x1) / 2;
        const my = Math.min(y0, y1) - 50;

        el.style.setProperty('--x0', `${x0}px`);
        el.style.setProperty('--y0', `${y0}px`);
        el.style.setProperty('--xm', `${mx}px`);
        el.style.setProperty('--ym', `${my}px`);
        el.style.setProperty('--x1', `${x1}px`);
        el.style.setProperty('--y1', `${y1}px`);

        const delay = i * 50;
        el.style.animationDelay = `${delay}ms`;
        el.style.animationDuration = `${duration}ms`;

        document.body.appendChild(el);
        setTimeout(() => el.remove(), duration + delay + 60);
    }
}

// Coins spent on a purchase visibly leave the pile — flies from the coin
// pile to whatever button was just pressed, and holds the pile's displayed
// total at its pre-spend value until the coins land (see syncDisplayedMoney).
export function animateSpend(targetEl) {
    const pileRect = dom.coinPile.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    spawnFlight({ fromRect: pileRect, toRect: targetRect, emoji: '🟡', count: 2, duration: 320 });
    moneyFlightUntil = Math.max(moneyFlightUntil, performance.now() + 320);
}

// A buy key's affordability ring fills toward 100% as budget approaches
// cost — the picture alone answers "can I press it, and roughly when." The
// moment it first reaches 100%, the key pulses once — the idle-game
// heartbeat pointing at the next satisfying click.
const affordabilityPrev = new WeakMap();

function renderAffordability(btnEl, ringEl, cost, budget, costLabel) {
    if (cost === null) {
        btnEl.disabled = true;
        ringEl.style.setProperty('--pct', 100);
        btnEl.title = 'Maxed';
        affordabilityPrev.set(btnEl, true);
        return;
    }
    const fraction = clampFraction(budget, cost);
    ringEl.style.setProperty('--pct', fraction * 100);
    const affordable = fraction >= 1;
    btnEl.disabled = !affordable;
    btnEl.title = `${costLabel} (${formatNumber(cost)})`;

    if (affordable && affordabilityPrev.get(btnEl) === false) {
        btnEl.classList.add('pulse');
        btnEl.addEventListener('animationend', () => btnEl.classList.remove('pulse'), { once: true });
    }
    affordabilityPrev.set(btnEl, affordable);
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

// Buffered display value for the coin pile — state.currencies.money changes
// the instant a payout or purchase happens, but the pile should only visibly
// change once the flying coin sprites finish their trip (see spawnFlight /
// animateSpend). Snaps to the true value immediately whenever no flight is
// in progress, so it never drifts out of sync for longer than one flight.
let displayedMoney = null;
let moneyFlightUntil = 0;

function syncDisplayedMoney(state) {
    if (displayedMoney === null || performance.now() >= moneyFlightUntil) {
        displayedMoney = state.currencies.money;
    }
    return displayedMoney;
}

export function render(state) {
    renderTopbar(state);
    renderMonkeysAndTypewriters(state);
    renderPage(state);
    renderTraining(state);
    renderPile(dom.inkPile, state.currencies.intelligence, ['💧', '🧴', '📖']);
    renderPile(dom.coinPile, syncDisplayedMoney(state), ['🟤', '⚪', '🟡']);
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
// fly-out transition on whatever's accumulated when a page completes. A
// persistent blinking caret is kept as the last child at all times — even
// on the empty page at run start, where it alone signals "waiting for
// monkeys." ---

let caretEl = null;
function ensureCaret() {
    if (!caretEl) {
        caretEl = document.createElement('span');
        caretEl.className = 'page-caret';
        caretEl.textContent = '▌';
    }
    return caretEl;
}

let renderedSegmentCount = 0;
let lastPageCompletions = -1;

function renderPage(state) {
    if (lastPageCompletions === -1) lastPageCompletions = state.page.completions;

    if (state.page.completions !== lastPageCompletions) {
        lastPageCompletions = state.page.completions;
        renderedSegmentCount = state.page.segments.length; // the reset already happened in state

        const pageRect = dom.pageView.getBoundingClientRect();
        const moneyDelta = state.currencies.money - displayedMoney;
        if (moneyDelta > 0) {
            spawnFlight({ fromRect: pageRect, toRect: dom.coinPile.getBoundingClientRect(), emoji: '🟡', count: 3 });
            moneyFlightUntil = Math.max(moneyFlightUntil, performance.now() + 420);
            playCoin();
        }
        spawnFlight({ fromRect: pageRect, toRect: dom.pageStack.getBoundingClientRect(), emoji: '📄', count: 1 });
        playPageComplete();

        dom.pageView.classList.add('flying');
        setTimeout(() => {
            dom.pageView.classList.remove('flying');
            dom.pageView.innerHTML = '';
            dom.pageView.appendChild(ensureCaret());
            renderPageStack(state);
        }, 400);
        return;
    }

    const segments = state.page.segments;
    for (let i = renderedSegmentCount; i < segments.length; i++) {
        const seg = segments[i];
        const el = document.createElement(seg.type === 'rare' ? 'div' : 'span');
        el.className = `segment-${seg.type}`;
        el.textContent = seg.text;
        dom.pageView.appendChild(el);

        if (seg.type === 'rare') {
            el.title = seg.text.trim() + (seg.payout ? ` — +${formatNumber(seg.payout)} money` : '');
            makeRareFindAMoment(el, state);
        } else {
            playClack();
        }
    }
    renderedSegmentCount = segments.length;
    dom.pageView.appendChild(ensureCaret());

    renderPageStack(state);
}

// Rares are the game's one dopamine spike — a shimmer sweep across the
// gold line, a small panel shake, the chime (distinct from the coin clink),
// and a bigger coin burst instead of a normal quiet payout.
function makeRareFindAMoment(el, state) {
    el.classList.add('shimmer');
    el.addEventListener('animationend', () => el.classList.remove('shimmer'), { once: true });

    dom.pagePanel.classList.add('shake');
    dom.pagePanel.addEventListener('animationend', () => dom.pagePanel.classList.remove('shake'), { once: true });

    playChime();

    const moneyDelta = state.currencies.money - displayedMoney;
    if (moneyDelta > 0) {
        spawnFlight({ fromRect: el.getBoundingClientRect(), toRect: dom.coinPile.getBoundingClientRect(), emoji: '🟡', count: 6 });
        moneyFlightUntil = Math.max(moneyFlightUntil, performance.now() + 480);
    }
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
// not a percentage) plus a buy key with an affordability ring. A newly
// filled pip gets a little pop when a level is bought. ---

const pipLevelPrev = new WeakMap();

function renderLevelPips(container, level, levels) {
    if (container.childElementCount !== levels) {
        container.innerHTML = '';
        for (let i = 0; i < levels; i++) {
            const pip = document.createElement('span');
            pip.className = 'level-pip';
            pip.textContent = '●';
            container.appendChild(pip);
        }
        pipLevelPrev.set(container, 0);
    }
    for (let i = 0; i < levels; i++) {
        container.children[i].classList.toggle('filled', i < level);
    }

    const prevLevel = pipLevelPrev.get(container) ?? 0;
    if (level > prevLevel) {
        const newest = container.children[level - 1];
        if (newest) {
            newest.classList.add('pop');
            newest.addEventListener('animationend', () => newest.classList.remove('pop'), { once: true });
        }
    }
    pipLevelPrev.set(container, level);

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

// --- Coin / ink piles: quantities as denominated objects, diffed against
// the previous denomination counts so only the changed items are added or
// removed each render — the prerequisite for both the landing-bounce below
// and the coin-fly animations above (an innerHTML rebuild every frame would
// make either impossible). ---
//
// The hundreds digit is otherwise unbounded — intelligence in particular
// has no spend sink once every training stat hits its level cap, so it
// free-accumulates for the rest of a run and can reach into the hundreds of
// thousands. Rendering one sprite per hundred at that scale means thousands
// of persistent DOM nodes in a single flex-wrap panel; harmless per se, but
// every getBoundingClientRect() call elsewhere (the fly animations, on
// every payout/spend/rare find) forces a synchronous layout of that whole
// subtree, which is what actually reads as stutter. Capping how many
// hundred-sprites are ever drawn, with a compact "+N" badge for the rest,
// keeps the "physical pile" feel at normal scale without the DOM blowing up
// at the extremes.
const MAX_HUNDREDS_SPRITES = 20;

function decompose(amount) {
    const n = Math.max(0, Math.floor(amount));
    return [n % 10, Math.floor(n / 10) % 10, Math.floor(n / 100)];
}

const pileGroups = new Map(); // container -> { hundreds, tens, ones: <group element> }
const pileBuckets = new Map(); // container -> { hundreds, tens, ones: <element[]> }
const pileOverflowEls = new Map(); // container -> overflow badge element

function ensurePile(container) {
    if (pileGroups.has(container)) return pileGroups.get(container);

    container.innerHTML = '';
    const groups = {};
    for (const bucket of ['hundreds', 'tens', 'ones']) {
        // display: contents (see style.css) lets these wrapper groups sit in
        // the DOM as a stable append point per denomination while still
        // laying out their children directly in the parent's flex-wrap pile.
        const group = document.createElement('div');
        group.className = 'pile-group';
        container.appendChild(group);
        groups[bucket] = group;
    }
    pileGroups.set(container, groups);
    pileBuckets.set(container, { hundreds: [], tens: [], ones: [] });
    return groups;
}

function diffPileBucket(group, els, targetCount, icon, rotationBase) {
    while (els.length < targetCount) {
        const item = document.createElement('span');
        item.className = 'pile-item pile-item-landing';
        item.textContent = icon;
        const idx = rotationBase + els.length;
        item.style.setProperty('--rot', `${((idx % 5) - 2) * 4}deg`);
        group.appendChild(item);
        els.push(item);
        item.addEventListener('animationend', () => item.classList.remove('pile-item-landing'), { once: true });
    }
    while (els.length > targetCount) {
        els.pop().remove();
    }
}

function renderOverflowBadge(container, overflowAmount) {
    let badge = pileOverflowEls.get(container);
    if (overflowAmount <= 0) {
        if (badge) {
            badge.remove();
            pileOverflowEls.delete(container);
        }
        return;
    }
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'pile-overflow';
        container.appendChild(badge);
        pileOverflowEls.set(container, badge);
    }
    badge.textContent = `+${formatNumber(overflowAmount)}`;
}

function renderPile(container, amount, icons) {
    const [ones, tens, hundredsRaw] = decompose(amount);
    const hundreds = Math.min(hundredsRaw, MAX_HUNDREDS_SPRITES);
    const groups = ensurePile(container);
    const buckets = pileBuckets.get(container);

    diffPileBucket(groups.hundreds, buckets.hundreds, hundreds, icons[2], 0);
    diffPileBucket(groups.tens, buckets.tens, tens, icons[1], buckets.hundreds.length);
    diffPileBucket(groups.ones, buckets.ones, ones, icons[0], buckets.hundreds.length + buckets.tens.length);
    renderOverflowBadge(container, (hundredsRaw - hundreds) * 100);

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
