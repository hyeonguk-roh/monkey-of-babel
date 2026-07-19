// Every tunable game value lives here. Change a number, refresh the page —
// nothing else needs to be touched to retune the game.

export const CONFIG = {
    // The habitat: idle monkeys live here and refill automatically over time.
    habitat: {
        startingCount: 0,
        capacity: 20,             // max monkeys the habitat + typewriters can hold combined
        fillRatePerSecond: 0.3,   // how fast new monkeys appear while there's room
    },

    // The typewriters: infinite monkeys, infinite typewriters, eventually Shakespeare.
    // Monkeys stay seated until you recall them — no fatigue, no auto-eject.
    typewriters: {
        capacity: 12,             // how many typewriters are available to sit a monkey at
    },

    // Typing: what a seated monkey produces, one keystroke at a time.
    // These are STARTING values only — see `training` below for how they
    // grow as intelligence is spent. Odds start low on purpose: a monkey
    // banging on a typewriter should rarely produce a real word at first.
    typing: {
        charsPerSecondPerMonkey: 2,    // typing speed per seated monkey
        intelligencePerKeystroke: 1,   // intelligence gained for every character typed
        pageLengthChars: 400,          // characters needed to finish a page
        wordChance: 0.03,              // chance a given keystroke also completes a word
        sentenceChance: 0.04,          // chance a completed word also completes a sentence
    },

    // Economy: what a finished page cashes in for.
    economy: {
        moneyPerWord: 1,
        moneyPerSentence: 5,

        // Rare finds: on a completed sentence, a small chance the monkey
        // accidentally typed something real. Payout scales with typewriter
        // capacity (a proxy for how developed your operation is) rather
        // than current money — scaling off current money would compound:
        // a long offline catch-up with word/sentence chance maxed out can
        // produce hundreds of rare finds in one go, and each one taking a
        // cut of the *already-boosted* total is exponential blowup, not a
        // bonus. This formula stays linear no matter how many land at once.
        //
        // cooldownSeconds is what actually keeps rares rare: the roll only
        // happens once the cooldown clears (see simulation.js's rare-find
        // gate), so the max possible rate is a hard 1 per cooldownSeconds
        // no matter how many sentences complete per tick. `chance` then
        // gates *that* roll — at full scale it resolves almost immediately
        // once eligible, converging to ~1 every cooldownSeconds (~15/hr at
        // the default 240s); early game, low sentence volume keeps it rarer
        // than that ceiling.
        rareFind: {
            chance: 0.01,
            cooldownSeconds: 240,
            multiplier: 50,    // payout = moneyPerSentence * multiplier * typewriter capacity
        },
    },

    // Spend intelligence here to make seated monkeys better typists.
    // cost of the Nth purchase = round(baseCost * costGrowth ^ N)
    training: {
        typingSpeed: { baseCost: 10, costGrowth: 1.22, increment: 0.5, cap: Infinity },
        wordChance: { baseCost: 15, costGrowth: 1.30, increment: 0.01, cap: 0.50 },
        sentenceChance: { baseCost: 20, costGrowth: 1.35, increment: 0.01, cap: 0.50 },
    },

    // Spend money here to grow capacity. Same cost formula as training, above.
    // Add a new entry here (and a matching one in simulation.js's UPGRADE_TARGETS)
    // to sell more things with money.
    upgrades: {
        typewriters: { baseCost: 40, costGrowth: 1.30, increment: 1 },  // +1 typewriter
        habitat: { baseCost: 20, costGrowth: 1.20, increment: 5 },      // +5 habitat capacity
    },

    // Prestige: package everything written so far into a manuscript, sell
    // it for fame, and start a new run. Fame never resets — it's a
    // permanent bonus for every run after this one.
    prestige: {
        pagesPerFame: 1000,        // fame gained = floor(sqrt(pagesCompleted / this))
        moneyBonusPerFame: 0.02,   // +2% money per fame point, applied to every source of income
    },

    // Milestones: every N typewriters bought, or every N levels of a given
    // training stat, doubles the milestone money multiplier. Unlike fame,
    // this is a WITHIN-run snowball — it's driven by state.typewriters and
    // state.training, which reset on prestige, so it naturally resets too.
    // "Almost at a milestone" is meant to be a session-extender.
    //
    // every:25/every:10 (one milestone per training STAT, i.e. 3 independent
    // tracks) measured out to money hitting $41M within 10 minutes and a
    // 65,536x multiplier by hour 2 with the ×Max buttons — it silently
    // undid the training/money pacing tuned earlier. every:50/every:40 was
    // simulation-verified instead: training still hasn't capped by hour 4
    // (matching the untuned-milestone baseline), money reaches ~$14.5M by
    // hour 4 vs. ~$659K with milestones off (a real snowball, not a
    // blowup), and fame-at-hour-4 lands at 7, same as before milestones
    // existed at all.
    milestones: {
        typewriters: { every: 50 },
        training: { every: 40 },
    },

    // Prodigy roster: pull with tokens for a random monkey from a fixed
    // roster (see prodigy.js). Unlike milestones, the total possible bonus
    // here is capped by the roster's fixed size, not exponential per level
    // — owning everything tops out around +58% money, so there's no
    // runaway-growth risk to re-verify no matter how fast tokens come in.
    // Tokens piggyback on the already-tuned rare-find cadence (a chance
    // each rare find also drops one) rather than a second independent rare
    // event, so they inherit the same "stays rare at any scale" guarantee.
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
            durationSeconds: 20 * 60,      // how long the 2x window lasts
            adCooldownSeconds: 15 * 60,    // how often this ad can be watched again
        },
        instantPage: {
            adCooldownSeconds: 10 * 60,
        },
        timeSkips: [
            { id: 'skip1h', label: '1 Hour', seconds: 60 * 60, mockPrice: '$0.99' },
            { id: 'skip4h', label: '4 Hours', seconds: 4 * 60 * 60, mockPrice: '$2.99' },
            { id: 'skip12h', label: '12 Hours', seconds: 12 * 60 * 60, mockPrice: '$6.99' },
        ],
        cosmetics: [
            { id: 'default', name: 'Classic Parchment', mockPrice: 'Free' },
            { id: 'midnight', name: 'Midnight Ink', mockPrice: '$1.99' },
            { id: 'golden', name: 'Golden Age', mockPrice: '$2.99' },
        ],
    },

    // Ticks longer than this use an expected-value approximation instead of
    // simulating every individual keystroke — see simulation.js. Only
    // matters for offline catch-up; live frames are always well under this.
    performance: {
        fastPathThresholdSeconds: 60,
    },

    // How progress is saved to the browser and caught up on return.
    save: {
        storageKey: 'monkeyOfBabelSave',
        version: 7,                    // bump if the state shape ever changes in a breaking way
        autosaveIntervalSeconds: 10,
    },

    offline: {
        maxSeconds: 12 * 60 * 60,      // cap simulated catch-up at 12 hours away
        minSecondsToReport: 30,        // shorter gaps (page refresh) don't pop the "welcome back" banner
    },

    // The "recent events" ticker: a fixed number of slots, newest first.
    // It never grows or scrolls — a new event just pushes the oldest one out.
    feed: {
        maxItems: 5,
        minSecondsBetweenEvents: 2,   // throttle so it reads as a ticker, not a flood
    },
};
