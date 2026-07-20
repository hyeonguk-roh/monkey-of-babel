import { CONFIG } from './config.js';
import { createInitialState } from './state.js';
import {
    tick,
    assignWorker,
    recallWorker,
    fillTypewriters,
    clearTypewriters,
    purchaseTraining,
    purchaseUpgrade,
    triggerInstantPage,
} from './simulation.js';
import {
    cacheDom,
    render,
    showOfflineSummary,
    showProdigyPullResult,
    showStoreMessage,
} from './ui.js';
import { saveState, loadState } from './save.js';
import { applyOfflineProgress } from './offline.js';
import { canPublish, publishManuscript } from './prestige.js';
import { pull, getRarityIcon } from './prodigy.js';
import { formatClock, formatNumber } from './format.js';
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

dom.buyTypewriterBtn.addEventListener('click', () => { purchaseUpgrade(state, 'typewriters'); render(state); });
dom.buyHabitatBtn.addEventListener('click', () => { purchaseUpgrade(state, 'habitat'); render(state); });

for (const key of Object.keys(dom.trainTiles)) {
    dom.trainTiles[key].btn.addEventListener('click', () => { purchaseTraining(state, key); render(state); });
}

dom.dismissOfflineBtn.addEventListener('click', () => { dom.offlineBanner.hidden = true; });

dom.publishBtn.addEventListener('click', () => {
    if (!canPublish(state)) return;
    const confirmed = window.confirm('📤? +🏆 · 💰🐒🎓🛠️➡️🚫');
    if (!confirmed) return;

    publishManuscript(state);
    render(state);
    saveState(state);
});

dom.prodigyPullBtn.addEventListener('click', () => {
    const result = pull(state);
    if (result) {
        const monkeyBadge = `${result.monkey.icon} ${getRarityIcon(result.monkey.rarity)}`;
        showProdigyPullResult(result.isDuplicate ? `🔁 ${monkeyBadge} 🍌` : `✨ ${monkeyBadge}`);
    }
    render(state);
});

dom.watchEarningsBoostAdBtn.addEventListener('click', () => {
    if (watchEarningsBoostAd(state)) {
        showStoreMessage('⚡✅', `2× earnings active for ${formatClock(CONFIG.monetization.earningsBoost.durationSeconds)}`);
    }
    render(state);
});

dom.watchInstantPageAdBtn.addEventListener('click', () => {
    const earned = triggerInstantPage(state);
    if (earned > 0) {
        showStoreMessage('⚡📄💰', `+${formatNumber(earned)} money`);
    }
    render(state);
});

dom.timeSkipButtons.forEach((btn, i) => {
    const option = getTimeSkipOptions()[i];
    btn.addEventListener('click', () => {
        tick(state, option.seconds);
        showStoreMessage(`⏭️✅ ${'●'.repeat(i + 1)}`, `Skipped ahead ${formatClock(option.seconds)}`);
        render(state);
        saveState(state);
    });
});

dom.cosmeticRows.forEach((row, i) => {
    const cosmetic = getAllCosmetics()[i];
    row.addEventListener('click', () => {
        if (!isCosmeticOwned(state, cosmetic.id)) {
            purchaseCosmetic(state, cosmetic.id);
            showStoreMessage(`🛒✅ ${cosmetic.icon}`);
        } else {
            showStoreMessage(`✅ ${cosmetic.icon}`);
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
