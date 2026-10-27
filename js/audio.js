const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function hueFromPitch(pitch) {
  const midi = 69 + 12 * Math.log2(pitch / 440);
  const t = clamp((midi - 40) / 43, 0, 1);
  return 14 + t * 286;
}

export function noteName(pitch) {
  if (!pitch) return "";
  const midi = Math.round(69 + 12 * Math.log2(pitch / 440));
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return name + octave;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class AudioEngine {
  constructor() {
    this.sensitivity = 1;
    this.listening = false;
    this.amp = 0;
    this.env = 0.02;
    this.hue = 22;
    this.heldPitch = 0;
    this.heldUntil = 0;
    this.bpm = 108;
    this.phase = 0;
    this.beatIndex = 0;
    this.tempoConfidence = 0;
    this.lastTempoNow = 0;
    this.lastOnset = 0;
    this.onsetTimes = [];
    this.fluxMed = 0;
    this.prevBins = new Float32Array(64);
    this.tempoFrame = 0;
  }

  async start() {
    if (this.listening) return;
    this.ctx = new AudioContext();
    await this.ctx.resume();
    const audioConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
    } catch (error) {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.62;
    source.connect(this.analyser);
    this.time = new Float32Array(this.analyser.fftSize);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.bins = new Float32Array(64);
    this.listening = true;
  }

  sample(now) {
    if (!this.listening) return null;
    this.analyser.getFloatTimeDomainData(this.time);
    this.analyser.getByteFrequencyData(this.freq);

    let sum = 0;
    for (let i = 0; i < this.time.length; i++) sum += this.time[i] * this.time[i];
    const rms = Math.sqrt(sum / this.time.length);

    const floor = 0.012 / Math.max(0.45, this.sensitivity);
    let target = 0;
    if (rms > floor) {
      this.env = Math.max(rms, this.env * 0.996);
      target = Math.min(1, (rms / this.env) * this.sensitivity);
      target = Math.pow(target, 0.78);
    } else {
      this.env = Math.max(floor, this.env * 0.996);
    }

    if (target > this.amp) this.amp += (target - this.amp) * 0.55;
    else this.amp += (target - this.amp) * 0.07;

    for (let i = 0; i < 64; i++) {
      let peak = 0;
      const start = i * 4;
      for (let k = 0; k < 4; k++) peak = Math.max(peak, this.freq[start + k]);
      this.bins[i] = peak / 255;
    }

    let num = 0;
    let den = 0;
    for (let i = 0; i < 64; i++) {
      num += i * this.bins[i];
      den += this.bins[i];
    }
    const centroid = den > 0.02 ? num / den / 63 : 0.2;

    const pitch = this.detectPitch(this.time, this.ctx.sampleRate);
    if (pitch) {
      this.heldPitch = pitch;
      this.heldUntil = now + 320;
      this.hue = hueFromPitch(pitch);
    }
    const sungPitch = now < this.heldUntil ? this.heldPitch : 0;
    this.trackTempo(now);

    return {
      amp: this.amp,
      pitch: sungPitch,
      hue: this.hue,
      centroid,
      bins: Array.from(this.bins),
      bpm: this.bpm,
      beatPhase: this.phase,
      beatIndex: this.beatIndex,
      tempoConfidence: this.tempoConfidence,
    };
  }

  trackTempo(now) {
    const dt = Math.min(50, this.lastTempoNow ? now - this.lastTempoNow : 16);
    this.lastTempoNow = now;
    const period = 60000 / this.bpm;
    this.phase += dt / period;
    while (this.phase >= 1) {
      this.phase -= 1;
      this.beatIndex += 1;
    }

    let flux = 0;
    for (let i = 0; i < 28; i++) {
      const rise = this.bins[i] - this.prevBins[i];
      if (rise > 0) flux += rise;
      this.prevBins[i] = this.bins[i];
    }
    flux /= 28;
    this.fluxMed = this.fluxMed * 0.97 + flux * 0.03;

    const refractory = Math.max(150, period * 0.32);
    if (flux > Math.max(0.04, this.fluxMed * 1.7) && now - this.lastOnset > refractory) {
      this.lastOnset = now;
      this.onsetTimes.push(now);
      let error = this.phase > 0.5 ? this.phase - 1 : this.phase;
      const pull = Math.abs(error) < 0.2 ? 0.6 : 0.15;
      this.phase -= error * pull;
      if (this.phase < 0) this.phase += 1;
      if (this.phase >= 1) this.phase -= 1;
    }
    while (this.onsetTimes.length && now - this.onsetTimes[0] > 8000) this.onsetTimes.shift();

    this.tempoFrame += 1;
    if (this.tempoFrame % 10 === 0) this.estimateTempo();
  }

  estimateTempo() {
    const times = this.onsetTimes;
    if (times.length < 4) {
      this.tempoConfidence *= 0.92;
      return;
    }
    const minBpm = 70;
    const maxBpm = 180;
    const scores = new Float32Array(maxBpm - minBpm + 1);
    for (let i = 1; i < times.length; i++) {
      this.addInterval(scores, times[i] - times[i - 1], minBpm, 1, 0.35, 0.4);
      if (i >= 2) this.addInterval(scores, times[i] - times[i - 2], minBpm, 0.2, 0.9, 0.05);
    }
    let best = 0;
    let bestBpm = Math.round(this.bpm);
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > best) {
        best = scores[i];
        bestBpm = minBpm + i;
      }
    }
    const at = (bpm) => {
      const index = Math.round(bpm) - minBpm;
      if (index < 0 || index >= scores.length) return 0;
      return scores[index];
    };
    let chosen = bestBpm;
    if (this.tempoConfidence > 0.4 && at(this.bpm) > best * 0.82) chosen = Math.round(this.bpm);
    const ratio = chosen / this.bpm;
    const blend = ratio > 1.7 || ratio < 0.6 ? 0.08 : 0.28;
    this.bpm += (chosen - this.bpm) * blend;
    this.bpm = clamp(this.bpm, minBpm, maxBpm);
    this.tempoConfidence = clamp(best / Math.max(4, times.length * 0.45), 0, 1);
  }

  addInterval(scores, interval, minBpm, directWeight, doubleWeight, halfWeight) {
    if (interval < 160 || interval > 1700) return;
    this.vote(scores, 60000 / interval, minBpm, directWeight);
    this.vote(scores, 120000 / interval, minBpm, doubleWeight);
    this.vote(scores, 30000 / interval, minBpm, halfWeight);
  }

  vote(scores, bpm, minBpm, weight) {
    if (weight <= 0) return;
    const index = Math.round(bpm) - minBpm;
    if (index < 1 || index >= scores.length - 1) return;
    scores[index] += weight;
    scores[index - 1] += weight * 0.45;
    scores[index + 1] += weight * 0.45;
  }

  detectPitch(buf, sampleRate) {
    const step = 4;
    const n = Math.floor(buf.length / step);
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const v = buf[i * step];
      energy += v * v;
    }
    const meanEnergy = energy / n;
    if (meanEnergy < 0.00008) return 0;

    const at = (lag) => {
      let corr = 0;
      const limit = n - lag;
      for (let i = 0; i < limit; i++) corr += buf[i * step] * buf[(i + lag) * step];
      return corr / limit;
    };

    const minLag = Math.max(2, Math.floor(sampleRate / 980 / step));
    const maxLag = Math.min(n - 3, Math.floor(sampleRate / 75 / step));
    let bestLag = -1;
    let best = 0;

    for (let lag = minLag; lag <= maxLag; lag++) {
      const corr = at(lag);
      if (corr > best) {
        best = corr;
        bestLag = lag;
      }
    }
    if (bestLag < 0) return 0;

    const fundamental = bestLag;
    for (const div of [3, 2]) {
      const sub = Math.round(fundamental / div);
      if (sub < minLag) continue;
      const corr = at(sub);
      if (corr > best * 0.86) {
        bestLag = sub;
        best = corr;
      }
    }

    if (best / meanEnergy < 0.45) return 0;

    const prev = at(bestLag - 1);
    const next = at(bestLag + 1);
    const denom = prev - 2 * best + next;
    const shift = denom !== 0 ? (prev - next) / (2 * denom) : 0;
    const lag = (bestLag + shift) * step;
    const freq = sampleRate / lag;
    if (freq < 70 || freq > 1100) return 0;
    return freq;
  }
}
