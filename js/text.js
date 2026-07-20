// Procedurally generates the text a monkey "typed" onto the live page: real
// English words assembled into sentences via random templates, or gibberish
// for the untrained case. Purely presentational — simulation.js decides
// (via wordChance/sentenceChance rolls) which kind of token happened; this
// module only supplies the string shown for that outcome.

const NOUNS = [
    'monkey', 'typewriter', 'banana', 'ribbon', 'page', 'ink', 'jungle', 'letter',
    'quill', 'shelf', 'editor', 'library', 'branch', 'key', 'paper', 'story',
    'author', 'ladder', 'critic', 'manuscript',
];

const VERBS = [
    'types', 'writes', 'scribbles', 'presses', 'taps', 'edits', 'reads', 'copies',
    'invents', 'discovers', 'chases', 'climbs', 'drafts', 'revises', 'imagines',
];

const ADJECTIVES = [
    'clever', 'restless', 'ancient', 'curious', 'stubborn', 'brilliant', 'wandering',
    'quiet', 'furious', 'gentle', 'peculiar', 'infinite', 'rusty', 'golden', 'sleepy',
];

const ADVERBS = [
    'quickly', 'carefully', 'loudly', 'quietly', 'eagerly', 'endlessly', 'suddenly',
    'cleverly', 'patiently', 'wildly',
];

const ALL_WORDS = [...NOUNS, ...VERBS, ...ADJECTIVES, ...ADVERBS];

// Rare finds: real (public-domain) Shakespeare lines — the payoff of the
// game's whole premise, that infinite monkeys eventually produce the real
// thing. fameRequired gates which quotes can even be drawn — higher-fame
// tiers stay out of the pool until you've prestiged enough, giving the
// Library a reason to keep unlocking across many runs, not just one. Add
// more here any time (keep at least one at fameRequired: 0 so the pool is
// never empty); nothing else needs to change.
//
// icon is a per-quote emoji so a found row in the (iconography-only)
// Library is still distinguishable from every other found row, even though
// the quote text itself isn't displayed there; text stays as the row's
// hover tooltip and as what actually lands in the feed/state.
export const RARE_QUOTES = [
    { text: 'To be, or not to be, that is the question.', icon: '💀', fameRequired: 0 },
    { text: "All the world's a stage, and all the men and women merely players.", icon: '🎭', fameRequired: 0 },
    { text: "Though this be madness, yet there is method in't.", icon: '🤪', fameRequired: 0 },
    { text: 'The lady doth protest too much, methinks.', icon: '🗣️', fameRequired: 0 },
    { text: 'Some are born great, some achieve greatness, and some have greatness thrust upon them.', icon: '👑', fameRequired: 5 },
    { text: "What's in a name? That which we call a rose by any other name would smell as sweet.", icon: '🌹', fameRequired: 5 },
    { text: 'We know what we are, but know not what we may be.', icon: '🌀', fameRequired: 5 },
    { text: 'Brevity is the soul of wit.', icon: '⏱️', fameRequired: 15 },
    { text: 'Better three hours too soon than a minute too late.', icon: '⏰', fameRequired: 15 },
    { text: 'The course of true love never did run smooth.', icon: '💔', fameRequired: 15 },
    { text: 'This above all: to thine own self be true.', icon: '🪞', fameRequired: 40 },
    { text: 'Cowards die many times before their deaths; the valiant never taste of death but once.', icon: '⚔️', fameRequired: 40 },
];

// Each returns a full sentence, given random pick functions for each part
// of speech. Multiple shapes keep the feed from feeling repetitive.
const SENTENCE_TEMPLATES = [
    () => `The ${pick(ADJECTIVES)} ${pick(NOUNS)} ${pick(VERBS)} ${pick(ADVERBS)}.`,
    () => {
        const subject = pick(NOUNS);
        return `${capitalize(article(subject))} ${subject} ${pick(VERBS)} the ${pick(ADJECTIVES)} ${pick(NOUNS)}.`;
    },
    () => {
        const adjective = pick(ADJECTIVES);
        return `${capitalize(pick(NOUNS))} ${pick(VERBS)} ${article(adjective)} ${adjective} ${pick(NOUNS)}.`;
    },
];

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function article(word) {
    return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

// Consonant-heavy on purpose — this is what an untrained monkey's keystrokes
// look like before wordChance ever fires, so it needs to read as clearly
// NOT a word (unlike ALL_WORDS above, which are all real). 1-4 letters,
// same rough shape as a real word so it slots into the page the same way.
const GIBBERISH_LETTERS = 'qwxzjkbvpfgmrsthld';

export function generateGibberish() {
    const length = 1 + Math.floor(Math.random() * 4);
    let token = '';
    for (let i = 0; i < length; i++) {
        token += GIBBERISH_LETTERS[Math.floor(Math.random() * GIBBERISH_LETTERS.length)];
    }
    return token;
}

export function generateWord() {
    return pick(ALL_WORDS);
}

export function generateSentence() {
    return pick(SENTENCE_TEMPLATES)();
}

// Only draws from quotes unlocked at the given fame level. There's always
// at least the fameRequired: 0 tier, so this never has an empty pool.
export function generateRareFind(fame) {
    const eligible = RARE_QUOTES.filter(quote => quote.fameRequired <= fame);
    return pick(eligible).text;
}
