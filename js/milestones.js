import { CONFIG } from './config.js';

// How many milestones have been reached in total: floor(capacity / every)
// for typewriters, plus floor(level / every) for each training stat
// independently. Each one contributes one doubling to the money multiplier.
export function getMilestoneCount(state) {
    let count = Math.floor(state.typewriters.capacity / CONFIG.milestones.typewriters.every);

    for (const key of Object.keys(state.training)) {
        count += Math.floor(state.training[key].level / CONFIG.milestones.training.every);
    }

    return count;
}

export function getMilestoneMoneyMultiplier(state) {
    return Math.pow(2, getMilestoneCount(state));
}

// How many more typewriters/levels are needed before the next doubling —
// for "N more until ×2" progress hints. `current` sitting exactly on a
// milestone means the next one is a full `every` away, not zero.
export function getProgressToNextMilestone(current, every) {
    const remainder = current % every;
    return remainder === 0 ? every : every - remainder;
}
