// All game audio, synthesized with WebAudio — no audio files. Every sound
// is a short noise burst or oscillator blip through one shared gain node,
// so muting is a single gain change and there's nothing to preload.

const MASTER_VOLUME = 0.5;
const MUTE_STORAGE_KEY = 'monkeyOfBabelMuted';

let ctx = null;
let masterGain = null;
let muted = loadMutedPref();

function loadMutedPref() {
    try {
        return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function ensureContext() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
    masterGain.connect(ctx.destination);
    return ctx;
}

// Browsers only let an AudioContext run after a real user gesture — call
// this from the first pointerdown/keydown anywhere on the page so it's
// unlocked well before the first clack needs to play.
export function unlockAudio() {
    const context = ensureContext();
    if (context.state === 'suspended') context.resume();
}

export function isMuted() {
    return muted;
}

export function setMuted(value) {
    muted = value;
    if (masterGain) masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
    try {
        localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
    } catch {
        // best-effort; a private-browsing tab just won't remember the setting
    }
}

export function toggleMuted() {
    setMuted(!muted);
    return muted;
}

// Rate limiter shared by every clack — this is what turns "one per typed
// token" (which can be dozens per second at high capacity) into a pleasant
// patter instead of a hailstorm, regardless of how fast the room is typing.
const CLACK_MIN_INTERVAL_MS = 1000 / 8;
let lastClackTime = 0;

export function playClack() {
    const now = performance.now();
    if (now - lastClackTime < CLACK_MIN_INTERVAL_MS) return;
    lastClackTime = now;

    const context = ensureContext();
    if (context.state === 'suspended') context.resume();
    const t = context.currentTime;

    // A short burst of filtered noise reads as a mechanical key strike far
    // better than a tone would. Pitch-jittering the filter's center
    // frequency ±10% per hit is what keeps a fast patter from sounding like
    // a single sample on repeat.
    const duration = 0.03;
    const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = context.createBufferSource();
    noise.buffer = buffer;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200 * (1 + (Math.random() * 0.2 - 0.1));
    filter.Q.value = 1.2;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start(t);
    noise.stop(t + duration);
}

// A muted ding plus a quick descending "carriage return" sweep — played
// when a page completes and flies off to the shelf.
export function playPageComplete() {
    const context = ensureContext();
    if (context.state === 'suspended') context.resume();
    const t = context.currentTime;

    const ding = context.createOscillator();
    ding.type = 'sine';
    ding.frequency.setValueAtTime(1500, t);
    const dingGain = context.createGain();
    dingGain.gain.setValueAtTime(0.3, t);
    dingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    ding.connect(dingGain);
    dingGain.connect(masterGain);
    ding.start(t);
    ding.stop(t + 0.3);

    const zip = context.createOscillator();
    zip.type = 'sawtooth';
    zip.frequency.setValueAtTime(520, t + 0.06);
    zip.frequency.exponentialRampToValueAtTime(110, t + 0.2);
    const zipGain = context.createGain();
    zipGain.gain.setValueAtTime(0.1, t + 0.06);
    zipGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    zip.connect(zipGain);
    zipGain.connect(masterGain);
    zip.start(t + 0.06);
    zip.stop(t + 0.2);
}

// A little metallic clink for a coin landing in the pile.
export function playCoin() {
    const context = ensureContext();
    if (context.state === 'suspended') context.resume();
    const t = context.currentTime;

    [1900, 2500].forEach((freq, i) => {
        const start = t + i * 0.02;
        const osc = context.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + 0.12);
    });
}

// A bright ascending arpeggio for a rare find — the game's one dopamine
// spike, so it gets its own distinct sound rather than reusing the coin clink.
export function playChime() {
    const context = ensureContext();
    if (context.state === 'suspended') context.resume();
    const t = context.currentTime;

    [880, 1108, 1318, 1760].forEach((freq, i) => {
        const start = t + i * 0.09;
        const osc = context.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.22, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + 0.3);
    });
}
