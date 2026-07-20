// Every tunable game value lives here. Change a number, refresh the page —
// nothing else needs to be touched to retune the game.
//
// This config was rebuilt around one constraint: everything within a run
// must be small enough to draw as countable objects (a grid of typewriters,
// a pile of coins, a shelf of books) instead of an ever-growing number. A
// run is bounded — fill one shelf — and prestige (see prestige.js) is the
// only place growth is allowed to be open-ended, via permanent fame.

export const CONFIG = {
    // The shape of one run: write pages, pages bind into books, books fill a
    // shelf. Reaching a full shelf is the run's single visible goal — no
    // number goes up forever, the shelf just fills. 12 books x 10 pages is
    // sized to read as a real bookshelf grid. Verified against pacing.mjs
    // (an always-buy-when-affordable script, faster than realistic
    // click-by-click play) at ~9.5 minutes — real casual play should land
    // in the 10-15 minute range this was tuned for.
    run: {
        pageLengthGlyphs: 400,
        pagesPerBook: 10,
        booksPerShelf: 12,
    },

    // The habitat is now just the idle-monkey waiting pool feeding the
    // typewriter grid directly — capped low enough to draw as individual
    // monkey sprites, not a fill bar.
    habitat: {
        startingCount: 1,
        startingCapacity: 4,
        maxCapacity: 16,
        fillRatePerSecond: 0.3,   // how fast new monkeys wander into the pool while there's room
    },

    // The typewriter grid: capped low enough to draw as a literal grid of
    // typewriter sprites. Buying one reveals exactly one more slot.
    typewriters: {
        startingCapacity: 2,
        maxCapacity: 12,
    },

    // What a seated monkey produces, once per token-event (see
    // simulation.js — a "token" is either a short gibberish fragment or a
    // real word/sentence, decided by training below; either way it costs
    // one time-slot at the current typing rate).
    typing: {
        intelligencePerToken: 1,
    },

    // Economy: what a finished page cashes in for. Untrained monkeys (word/
    // sentence chance both start at 0 — see training below) earn nothing
    // but intelligence until the player trains at least wordChance once;
    // that's an intentional first step, not an oversight.
    economy: {
        moneyPerWord: 1,
        moneyPerSentence: 5,

        // Rare finds: on a completed sentence, a small chance the monkey
        // accidentally typed something real (see text.js RARE_QUOTES) —
        // rendered as a gold line straight in the page. Shorter cooldown
        // and higher per-tick chance than the old open-ended game, since a
        // whole run is now only ~10-15 minutes — this still keeps rares
        // rare (see the gate in simulation.js) while making sure most runs
        // see at least one or two.
        rareFind: {
            chance: 0.05,
            cooldownSeconds: 90,
            multiplier: 6,   // payout = moneyPerSentence * multiplier * typewriter capacity
        },
    },

    // Spend intelligence to level up a stat. Each is a small, fixed number
    // of discrete levels — countable as a row of icons, not a percentage
    // dial. cost of the Nth level = round(baseCost * costGrowth ^ N).
    //
    // wordChance/sentenceChance start at 0: a fresh run's monkeys are pure
    // gibberish until trained, so the very first purchase a player makes is
    // what turns on real words at all. Both cap at 50% total, split across
    // 10 levels of +5% each. typingSpeed starts at a slow 1 token/sec and
    // caps at 5 across 8 levels — fast enough to feel earned, never an
    // unbounded number. Costs verified against pacing.mjs (see the
    // Verification section of the redesign plan) to land a full shelf
    // around 10-15 minutes of active play, not 2.
    training: {
        typingSpeed: { base: 1, perLevel: 0.5, levels: 8, baseCost: 40, costGrowth: 1.7 },
        wordChance: { base: 0, perLevel: 0.05, levels: 10, baseCost: 35, costGrowth: 1.65 },
        sentenceChance: { base: 0, perLevel: 0.05, levels: 10, baseCost: 60, costGrowth: 1.7 },
    },

    // Spend money to reveal one more typewriter/habitat slot. Same cost
    // formula as training. increment is always 1 — "buy one, it appears"
    // — up to habitat.maxCapacity / typewriters.maxCapacity above.
    upgrades: {
        typewriters: { baseCost: 70, costGrowth: 1.75 },
        habitat: { baseCost: 35, costGrowth: 1.65 },
    },

    // Prestige: photograph the finished shelf into the permanent Library
    // wall and start a new one. Fame is simply +1 per shelf — the bounded
    // run is the compensator for growth that used to live in a pages/fame
    // formula; now the exponential curve only lives across runs, via this.
    prestige: {
        moneyBonusPerFame: 0.05,   // +5% money per fame point (per shelf published), applied to every source of income
    },

    // Prodigy roster: pull with tokens for a random monkey from a fixed
    // roster (see prodigy.js). Unlike a within-run stat, the total possible
    // bonus here is capped by the roster's fixed size, not exponential per
    // level — owning everything tops out around +58% money, so there's no
    // runaway-growth risk. Tokens piggyback on the rare-find cadence above
    // (a chance each rare find also drops one) rather than a second
    // independent rare event, so they inherit the same "stays rare"
    // guarantee.
    prodigy: {
        tokenDropChance: 0.2,   // fraction of rare finds that also drop a token
        pullCost: 3,            // tokens spent per pull
        duplicateRefund: 1,     // tokens refunded when a pull rolls a monkey you already own
    },

    // Monetization — MOCKED. There's no real ad network or payment
    // processor wired up (this is a static local page with no backend or
    // publisher account), so every "watch ad" / "buy" action grants its
    // reward instantly. See monetization.js for exactly where a real ad
    // SDK or payment call would replace the mock; nothing else needs to
    // change when that happens.
    monetization: {
        earningsBoost: {
            multiplier: 2,
            durationSeconds: 5 * 60,       // shortened to match the ~10-15 min run
            adCooldownSeconds: 4 * 60,
        },
        instantPage: {
            adCooldownSeconds: 3 * 60,
        },
        timeSkips: [
            { id: 'skip5m', label: '5 Minutes', seconds: 5 * 60, mockPrice: '$0.99' },
            { id: 'skip20m', label: '20 Minutes', seconds: 20 * 60, mockPrice: '$2.99' },
            { id: 'skip1h', label: '1 Hour', seconds: 60 * 60, mockPrice: '$6.99' },
        ],
        // icon is what's actually shown in the Store (iconography-only UI);
        // name is kept for the row's hover tooltip.
        cosmetics: [
            { id: 'default', name: 'Classic Parchment', icon: '📜', mockPrice: 'Free' },
            { id: 'midnight', name: 'Midnight Ink', icon: '🌙', mockPrice: '$1.99' },
            { id: 'golden', name: 'Golden Age', icon: '✨', mockPrice: '$2.99' },
        ],
    },

    // Ticks longer than this use an expected-value approximation instead of
    // simulating every individual token. Only matters for offline catch-up
    // and time-skips; live frames are always well under this.
    performance: {
        fastPathThresholdSeconds: 60,
    },

    // How progress is saved to the browser and caught up on return.
    save: {
        storageKey: 'monkeyOfBabelSave',
        version: 10,                   // bump if the state shape ever changes in a breaking way
        autosaveIntervalSeconds: 10,
    },

    offline: {
        maxSeconds: 60 * 60,      // cap simulated catch-up — a bounded ~10-15 min run has no use for a 12-hour skip
        minSecondsToReport: 30,   // shorter gaps (page refresh) don't pop the "welcome back" banner
    },
};
