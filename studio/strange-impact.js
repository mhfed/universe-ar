import { clamp } from './runtime.js';
import { STRANGE_DIRECTIONS } from './strange-gesture.js';

export function strangeImpactProfile(power) {
  const strength = clamp(power, 0, 1);
  return {
    gain: .14 + strength * .40,
    attackHz: 145 - strength * 66,
    tailHz: 72 - strength * 37,
    duration: .18 + strength * .26,
    shake: .45 + strength * 3.65,
    shakeMs: 155 + strength * 115,
  };
}

function makeNoise(context) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .48), context.sampleRate);
  const data = buffer.getChannelData(0);
  let rumble = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    rumble = rumble * .83 + white * .17;
    data[i] = white * .27 + rumble * .73;
  }
  return buffer;
}

function playImpact(context, output, noise, profile) {
  const start = context.currentTime;
  const end = start + profile.duration;
  const body = context.createOscillator();
  const bodyGain = context.createGain();
  body.type = 'triangle';
  body.frequency.setValueAtTime(profile.attackHz, start);
  body.frequency.exponentialRampToValueAtTime(profile.tailHz, start + profile.duration * .60);
  bodyGain.gain.setValueAtTime(.001, start);
  bodyGain.gain.linearRampToValueAtTime(profile.gain, start + .013);
  bodyGain.gain.exponentialRampToValueAtTime(.001, end);
  body.connect(bodyGain);
  bodyGain.connect(output);
  body.start(start);
  body.stop(end);

  const burst = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const burstGain = context.createGain();
  burst.buffer = noise;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(profile.attackHz * 13, start);
  filter.frequency.exponentialRampToValueAtTime(profile.tailHz * 4, end);
  burstGain.gain.setValueAtTime(.001, start);
  burstGain.gain.linearRampToValueAtTime(profile.gain * .63, start + .005);
  burstGain.gain.exponentialRampToValueAtTime(.001, end);
  burst.connect(filter);
  filter.connect(burstGain);
  burstGain.connect(output);
  burst.start(start);
  burst.stop(end);
}

export function createStrangeImpact(picture) {
  const Audio = window.AudioContext || window.webkitAudioContext;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let context;
  let output;
  let compressor;
  let noise;
  let resume;
  let motion;
  let revision = 0;
  let muted = false;
  try { muted = localStorage.getItem('universe-strange-muted') === 'true'; } catch {}

  function prepareAudio(forRecording = false) {
    if ((!forRecording && muted) || !Audio) return;
    if (!context) {
      try {
        context = new Audio();
        compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.ratio.value = 6;
        compressor.attack.value = .006;
        compressor.release.value = .13;
        output = context.createGain();
        output.gain.value = muted ? 0 : .82;
        output.connect(compressor);
        compressor.connect(context.destination);
        noise = makeNoise(context);
      } catch {
        return;
      }
    }
    if (context.state !== 'running' && !resume) {
      resume = context.resume().catch(() => {}).finally(() => { resume = null; });
    }
  }

  function reset() {
    revision++;
    motion?.cancel();
    motion = null;
  }

  reducedMotion.addEventListener('change', reset);

  return {
    get available() { return Boolean(Audio); },
    get muted() { return muted; },
    setMuted(value) {
      muted = value;
      revision++;
      try { localStorage.setItem('universe-strange-muted', String(muted)); } catch {}
      if (output) output.gain.setTargetAtTime(muted ? 0 : .82, context.currentTime, .012);
      if (!muted) prepareAudio();
      return muted;
    },
    prepareAudio,
    captureAudio() {
      prepareAudio(true);
      if (!noise || !context.createMediaStreamDestination) return null;
      const destination = context.createMediaStreamDestination();
      compressor.connect(destination);
      let closed = false;
      return {
        track: destination.stream.getAudioTracks()[0],
        close() {
          if (closed) return;
          closed = true;
          compressor.disconnect(destination);
          for (const track of destination.stream.getTracks()) track.stop();
        },
      };
    },
    reset,
    hit(power, direction) {
      if (document.hidden) return;
      const profile = strangeImpactProfile(power);
      reset();
      if (!reducedMotion.matches && picture.animate) {
        const [dx, dy] = STRANGE_DIRECTIONS[direction];
        const x = (dx || (!dy ? .76 : .20)) * profile.shake;
        const y = (dy || -.37) * profile.shake;
        const overscan = profile.shake * 2 / Math.max(120, Math.min(picture.clientWidth, picture.clientHeight));
        motion = picture.animate([
          { transform: 'translate(0, 0) scale(1)', offset: 0 },
          { transform: `translate(${-x}px,${-y}px) scale(${1 + overscan})`, offset: .14 },
          { transform: `translate(${x * .54}px,${y * .54}px) scale(${1 + overscan * .6})`, offset: .36 },
          { transform: `translate(${-x * .22}px,${-y * .22}px) scale(${1 + overscan * .26})`, offset: .65 },
          { transform: 'translate(0, 0) scale(1)', offset: 1 },
        ], { duration: profile.shakeMs, easing: 'ease-out' });
      }

      if (!muted && noise) {
        if (context.state === 'running') {
          playImpact(context, output, noise, profile);
        } else if (resume) {
          const id = revision;
          const expires = performance.now() + 180;
          void resume.then(() => {
            if (id === revision && !muted && context.state === 'running' && performance.now() < expires) {
              playImpact(context, output, noise, profile);
            }
          });
        }
      }
    },
  };
}
