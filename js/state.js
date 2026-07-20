import { CONFIG } from './config.js';

export function createInitialState() {
    return {
        // Persists across prestige resets — see prestige.js. Everything
        // else below starts fresh on every publish.
        fame: 0,
        // Also persists — quotes found stay found forever, regardless of
        // how many times you publish.
        library: { discovered: [] },
        // Also persists — one entry per shelf ever completed. This is the
        // permanent record the whole bounded-run design compensates into:
        // the run resets, this wall never does.
        libraryWall: [],
        // Also persists — the roster and any unspent tokens survive
        // publishing, same reasoning as the Library.
        prodigy: { owned: [] },
        prodigyTokens: 0,
        // Also persists — a purchased skin stays purchased.
        cosmetics: {
            owned: ['default'],
            active: 'default',
        },
        // Also persists — true the moment the player makes their first
        // training/upgrade purchase, ever. Drives progressive disclosure:
        // the Store stays hidden until there's been at least one real
        // spend decision, and once shown, it should never hide again, even
        // after a prestige reset wipes the run that triggered it.
        everPurchased: false,
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
            capacity: CONFIG.habitat.startingCapacity,
        },
        // capacity grows by exactly 1 per purchase, up to
        // CONFIG.typewriters.maxCapacity (see simulation.js's
        // purchaseTypewriter). seatedCount replaces the old array of
        // individually-tracked workers — every seated monkey now feeds the
        // one shared page below, so there's nothing per-worker left to
        // track independently.
        typewriters: {
            capacity: CONFIG.typewriters.startingCapacity,
            seatedCount: 0,
        },
        currencies: {
            money: 0,
            intelligence: 0,
        },
        // The page currently being typed, as a list of styled segments —
        // see simulation.js's typeToken. Cleared each time a page
        // completes and flies onto the shelf.
        page: {
            segments: [],       // { text, type: 'gibberish' | 'word' | 'sentence' | 'rare' }
            length: 0,           // rendered glyph count — completes at CONFIG.run.pageLengthGlyphs
            words: 0,
            sentences: 0,
            tokenAccumulator: 0, // fractional token carryover between ticks
            completions: 0,      // bumps once per page completed; the UI diffs this to trigger the fly-out animation
        },
        // Progress toward this run's one shelf: pagesInBook counts up to
        // CONFIG.run.pagesPerBook, booksCompleted up to
        // CONFIG.run.booksPerShelf. Publishing requires the shelf full.
        shelf: {
            pagesInBook: 0,
            booksCompleted: 0,
        },
        // Current values, grown by spending intelligence in Training.
        // Starting points and per-level growth come from CONFIG.training
        // so there's one source of truth.
        training: {
            typingSpeed: { level: 0, value: CONFIG.training.typingSpeed.base },
            wordChance: { level: 0, value: CONFIG.training.wordChance.base },
            sentenceChance: { level: 0, value: CONFIG.training.sentenceChance.base },
        },
        // Gates the rare-find roll — see simulation.js.
        rareFind: {
            cooldownSeconds: 0,
        },
    };
}
