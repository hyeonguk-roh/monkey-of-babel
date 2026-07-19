import { CONFIG } from './config.js';
import { createInitialState } from './state.js';
import {
    tick,
    assignWorker,
    recallWorker,
    fillTypewriters,
    clearTypewriters,
    purchaseTrainingMultiple,
    purchaseUpgradeMultiple,
    triggerInstantPage,
} from './simulation.js';
import { cacheDom, render, showOfflineSummary, showProdigyPullResult, showStoreMessage } from './ui.js';
import { saveState, loadState } from './save.js';
import { applyOfflineProgress } from './offline.js';
import { getFameGain, publishManuscript } from './prestige.js';
import { pull } from './prodigy.js';
import {
    watchEarningsBoostAd,
    getTimeSkipOptions,
    getAllCosmetics,
    isCosmeticOwned,
    purchaseCosmetic,
    setActiveCosmetic,
} from './monetization.js';

const saved = loadState();
const state = saved ? saved.state : createInitialState();

const dom = cacheDom();

if (saved) {
    const summary = applyOfflineProgress(state, saved.savedAt);
    if (summary) showOfflineSummary(summary);
}

dom.assignOneBtn.addEventListener('click', () => { assignWorker(state); render(state); });
dom.recallOneBtn.addEventListener('click', () => { recallWorker(state); render(state); });
dom.fillTypewritersBtn.addEventListener('click', () => { fillTypewriters(state); render(state); });
dom.clearTypewritersBtn.addEventListener('click', () => { clearTypewriters(state); render(state); });

// Same tier list ui.js renders — one entry per buy-group button.
const TIERS = [
    ['one', 1],
    ['ten', 10],
    ['hundred', 100],
    ['max', Infinity],
];

for (const [key, buttons] of Object.entries(dom.trainButtons)) {
    for (const [slot, tierCount] of TIERS) {
        buttons[slot].addEventListener('click', () => { purchaseTrainingMultiple(state, key, tierCount); render(state); });
    }
}

for (const [key, buttons] of Object.entries(dom.upgradeButtons)) {
    for (const [slot, tierCount] of TIERS) {
        buttons[slot].addEventListener('click', () => { purchaseUpgradeMultiple(state, key, tierCount); render(state); });
    }
}

dom.dismissOfflineBtn.addEventListener('click', () => { dom.offlineBanner.hidden = true; });

dom.publishBtn.addEventListener('click', () => {
    const fameGain = getFameGain(state);
    const confirmed = window.confirm(
        `Publish now? You'll gain ${fameGain} fame (permanent), but money, monkeys, `
        + `training, and upgrades will all reset.`
    );
    if (!confirmed) return;

    publishManuscript(state);
    render(state);
    saveState(state);
});

dom.prodigyPullBtn.addEventListener('click', () => {
    const result = pull(state);
    if (result) {
        showProdigyPullResult(
            result.isDuplicate
                ? `Pulled ${result.monkey.name} again — already owned, refunded some tokens.`
                : `New prodigy! ${result.monkey.name} (${result.monkey.rarity}) joined the roster.`
        );
    }
    render(state);
});

dom.watchEarningsBoostAdBtn.addEventListener('click', () => {
    if (watchEarningsBoostAd(state)) {
        showStoreMessage(`2× earnings active for ${CONFIG.monetization.earningsBoost.durationSeconds / 60} minutes!`);
    }
    render(state);
});

dom.watchInstantPageAdBtn.addEventListener('click', () => {
    const earned = triggerInstantPage(state);
    if (earned > 0) {
        showStoreMessage(`Instant page complete — +${earned} money!`);
    }
    render(state);
});

dom.timeSkipButtons.forEach((btn, i) => {
    const option = getTimeSkipOptions()[i];
    btn.addEventListener('click', () => {
        tick(state, option.seconds);
        showStoreMessage(`Skipped ahead ${option.label}!`);
        render(state);
        saveState(state);
    });
});

dom.cosmeticRows.forEach((row, i) => {
    const cosmetic = getAllCosmetics()[i];
    row.addEventListener('click', () => {
        if (!isCosmeticOwned(state, cosmetic.id)) {
            purchaseCosmetic(state, cosmetic.id);
            showStoreMessage(`Purchased ${cosmetic.name}!`);
        } else {
            showStoreMessage(`Equipped ${cosmetic.name}.`);
        }
        setActiveCosmetic(state, cosmetic.id);
        render(state);
    });
});

render(state);

let lastTime = performance.now();
function loop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    tick(state, dt);
    render(state);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Keep a save fresh enough that closing the tab never loses much progress.
setInterval(() => saveState(state), CONFIG.save.autosaveIntervalSeconds * 1000);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveState(state);
});
window.addEventListener('pagehide', () => saveState(state));
