import { CONFIG } from './config.js';

// One seated monkey: how much of the current page it has typed so far.
export function createWorker() {
    return {
        charAccumulator: 0,
        pageChars: 0,
        pageWords: 0,
        pageSentences: 0,
    };
}

export function createInitialState() {
    return {
        // Persists across prestige resets — see prestige.js. Everything
        // else below starts fresh on every publish.
        fame: 0,
        // Also persists across prestige — quotes found stay found forever,
        // regardless of how many times you publish.
        library: {
            discovered: [], // quote text strings
        },
        // Also persists across prestige — the roster and any unspent
        // tokens survive publishing, same reasoning as the Library.
        prodigy: {
            owned: [], // monkey id strings
        },
        prodigyTokens: 0,
        // Also persists across prestige — a purchased skin stays purchased,
        // same reasoning as the Library and Prodigy roster.
        cosmetics: {
            owned: ['default'],
            active: 'default',
        },
        // Resets with the rest of the run — a temporary boost or ad
        // cooldown isn't worth preserving across a prestige reset.
        monetization: {
            earningsBoostExpiresAt: 0,
            adCooldowns: {
                earningsBoost: 0,
                instantPage: 0,
            },
        },
        habitat: {
            count: CONFIG.habitat.startingCount,
            capacity: CONFIG.habitat.capacity,
        },
        typewriters: {
            capacity: CONFIG.typewriters.capacity,
            workers: [],
        },
        currencies: {
            money: 0,
            intelligence: 0,
        },
        pagesCompleted: 0,
        // Current values, grown by spending intelligence in the Training panel.
        // Starting points come from CONFIG.typing so there's one source of truth.
        training: {
            typingSpeed: { level: 0, value: CONFIG.typing.charsPerSecondPerMonkey },
            wordChance: { level: 0, value: CONFIG.typing.wordChance },
            sentenceChance: { level: 0, value: CONFIG.typing.sentenceChance },
        },
        // How many times each capacity upgrade has been bought with money.
        upgrades: {
            typewriters: { level: 0 },
            habitat: { level: 0 },
        },
        // Recent-events ticker: newest first, capped at CONFIG.feed.maxItems.
        feed: {
            items: [],
            nextId: 1,
            cooldownSeconds: 0,
        },
        // Gates the rare-find roll itself (separate from the feed's display
        // throttle above) — see the rare-find gate in simulation.js.
        rareFind: {
            cooldownSeconds: 0,
        },
    };
}
