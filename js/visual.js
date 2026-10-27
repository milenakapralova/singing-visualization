function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerpHue(a, b, t) {
  const d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

function hsla(hue, alpha, light = 64) {
  return `hsla(${hue}, 82%, ${light}%, ${alpha})`;
}

const SKINS = ["#f4d7c4", "#e4b48f", "#c68642", "#8d5524", "#5c4033", "#3f2a22"];
const SHIRTS = ["#243e66", "#8f2d38", "#1f4d3c", "#2b2b2b", "#efeae2", "#c65a32", "#3c4d86", "#6e3b55"];
const PANTS = ["#1c2030", "#2c3344", "#3a322c", "#151515", "#243044"];
const HAIR = ["#1a120e", "#3a2415", "#6a4524", "#c6a56a", "#222222", "#7a3424"];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export class VoiceVisual {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.bins = new Float32Array(64);
    this.targetBins = new Float32Array(64);
    this.amp = 0.05;
    this.targetAmp = 0.05;
    this.hue = 22;
    this.targetHue = 22;
    this.pitch = 0;
    this.centroid = 0.2;
    this.petals = 5;
    this.spin = 0;
    this.t = 0;
    this.stale = 1000;
    this.prevAmp = 0;
    this.ripples = [];
    this.particles = [];
    this.confetti = [];
    this.look = "bloom";
    this.burst = false;
    this.flash = 0;
    this.crowd = [];
    this.beatAt = -10000;
    this.kickEnv = 0;
    this.bpm = 108;
    this.beatPhase = 0;
    this.beatIndex = 0;
    this.tempoConfidence = 0;
    this.followTempo = true;
    this.groove = 0;
    this.pixelSheets = ["hips", "skip", "slide", "snap", "balancing"].map((name) => {
      const image = new Image();
      image.src = `assets/pixel/${name}.png`;
      return image;
    });
    this.dancerSheet = new Image();
    this.dancerSheet.src = "assets/dancer.png";
    this.resize();
  }

  setLook(name) {
    if (this.look === name) return;
    this.look = name;
    this.confetti.length = 0;
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.seed();
  }

  seed() {
    const reach = Math.min(this.w, this.h) * 0.46;
    const count = clamp(Math.floor((this.w * this.h) / 4200), 160, 460);
    this.particles = Array.from({ length: count }, () => ({
      ang: Math.random() * Math.PI * 2,
      base: reach * (0.18 + Math.random() * 0.95),
      rad: reach * (0.2 + Math.random() * 0.8),
      size: Math.random() < 0.14 ? 2 + Math.random() * 2.4 : 0.5 + Math.random() * 1.5,
      speed: (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 1.3),
      tw: Math.random() * Math.PI * 2,
      spark: Math.random() < 0.2,
      hueOff: (Math.random() - 0.5) * 36,
    }));
    this.seedCrowd();
    this.seedSprites();
  }

  seedCrowd() {
    const count = clamp(Math.round(this.w / 280), 4, 6);
    const s = Math.min(this.h / 58, this.w / count / 12);
    this.crowd = [];
    for (let i = 0; i < count; i++) {
      const back = i % 2 === 1;
      this.crowd.push({
        x: (i + 0.5) / count,
        y: back ? 0.9 : 0.96,
        s: s * (back ? 0.86 : 1),
        style: i % 5,
        lead: i % 2 === 0 ? 1 : -1,
        energy: 0.92 + (i % 3) * 0.06,
        alpha: 1,
        skin: pick(SKINS),
        shirt: pick(SHIRTS),
        pants: pick(PANTS),
        hair: pick(HAIR),
        hairStyle: i % 5,
        dress: i % 3 === 2,
        shoulder: 0.96 + (i % 2) * 0.1,
        lag: (i % 3) * 0.045,
        parity: i % 2,
        pulse: 0.00142 + (i % 4) * 0.00011,
        phase: i * 0.17,
        step: i,
        hip: 0,
        hipV: 0,
        hipDrop: 0,
        hipDropV: 0,
        chest: 0,
        chestV: 0,
        chestLift: 0,
        chestLiftV: 0,
        head: 0,
        headV: 0,
        armL: 0,
        armLV: 0,
        armR: 0,
        armRV: 0,
        liftL: 0,
        liftLV: 0,
        liftR: 0,
        liftRV: 0,
      });
    }
  }

  seedSprites() {
    const pixelCount = clamp(Math.round(this.w / 240), 4, 6);
    this.sprites = [];
    for (let i = 0; i < pixelCount; i++) {
      const back = i % 2 === 1;
      this.sprites.push({
        x: (i + 0.5) / pixelCount,
        y: back ? 0.82 : 0.9,
        dance: i % this.pixelSheets.length,
        lag: (i % 5) * 0.17,
        pulse: 0.00105 + (i % 4) * 0.00008,
        phase: i * 0.2,
        hold: 0,
        flip: i % 2 === 1,
        scale: back ? 0.82 : 1,
      });
    }
    const dancerCount = clamp(Math.round(this.w / 520), 2, 4);
    this.dancers = [];
    for (let i = 0; i < dancerCount; i++) {
      const back = i % 2 === 1;
      this.dancers.push({
        x: (i + 0.5) / dancerCount,
        y: back ? 0.9 : 0.98,
        lag: i * 0.31,
        pulse: 0.00042 + i * 0.00003,
        phase: i * 0.23,
        hold: 0,
        flip: i % 2 === 1,
        scale: back ? 0.78 : 1,
      });
    }
  }

  push(frame) {
    this.stale = 0;
    this.targetAmp = frame.amp;
    this.targetHue = frame.hue;
    this.pitch = frame.pitch;
    this.centroid = frame.centroid;
    if (frame.bpm) this.bpm = frame.bpm;
    if (typeof frame.beatPhase === "number") this.beatPhase = frame.beatPhase;
    if (typeof frame.beatIndex === "number") this.beatIndex = frame.beatIndex;
    this.tempoConfidence = frame.tempoConfidence || 0;
    for (let i = 0; i < 64; i++) this.targetBins[i] = frame.bins[i];
  }

  tick(dt) {
    this.t += dt;
    this.dt = dt;
    this.stale += dt;
    const voiced = this.stale < 500;

    if (!voiced) {
      this.targetAmp = 0.045 + 0.03 * Math.sin(this.t * 0.0011);
      this.targetHue = 22 + 12 * Math.sin(this.t * 0.00018);
      for (let i = 0; i < 64; i++) {
        const idle = Math.exp(-i / 22) * (0.08 + 0.05 * Math.sin(this.t * 0.002 + i * 0.4));
        this.targetBins[i] = idle;
      }
    }

    this.amp += (this.targetAmp - this.amp) * 0.18;
    this.hue = lerpHue(this.hue, this.targetHue, 0.08);
    for (let i = 0; i < 64; i++) {
      this.bins[i] += (this.targetBins[i] - this.bins[i]) * 0.28;
    }

    let petals = 5;
    if (voiced && this.pitch > 0) {
      const midi = Math.round(69 + 12 * Math.log2(this.pitch / 440));
      petals = 3 + ((midi % 12) + 12) % 6;
    }
    this.petals += (petals - this.petals) * 0.035;
    const lively = this.look === "bloom" ? 1 : 2.1;
    this.spin += dt * (0.00012 + this.amp * 0.00085 + this.centroid * 0.0002) * lively;

    if (voiced && this.amp - this.prevAmp > 0.11 && this.amp > 0.28) {
      this.spawnRipple();
      this.burst = true;
      this.beatAt = this.t;
    }
    const kick = (this.bins[0] + this.bins[1] + this.bins[2]) / 3;
    if (kick > 0.42 && kick > this.kickEnv + 0.14 && this.t - this.beatAt > 220) {
      this.beatAt = this.t;
    }
    this.kickEnv += (kick - this.kickEnv) * 0.22;
    const audible = this.amp > 0.12;
    this.groove += ((audible ? 1 : 0) - this.groove) * (audible ? 0.35 : 0.045);
    if (this.stale > 500) {
      this.beatPhase += dt / (60000 / (this.bpm || 108));
      while (this.beatPhase >= 1) {
        this.beatPhase -= 1;
        this.beatIndex += 1;
      }
    }
    this.prevAmp = this.amp;
    this.draw();
  }

  spawnRipple() {
    this.ripples.push({ r: 24 + this.amp * 50, a: 0.5, hue: this.hue });
    if (this.ripples.length > 12) this.ripples.shift();
  }

  draw() {
    if (this.look === "lasers") this.drawLasers();
    else if (this.look === "confetti") this.drawConfetti();
    else if (this.look === "room") this.drawRoom();
    else if (this.look === "bars") this.drawBars();
    else if (this.look === "crowd") this.drawCrowd();
    else if (this.look === "pixel") this.drawPixel();
    else if (this.look === "dancer") this.drawDancer();
    else this.drawBloom();
    this.burst = false;
  }

  fade(amount) {
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.fillStyle = `rgba(0, 0, 0, ${amount})`;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  drawBloom() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const amp = this.amp;
    const reach = Math.min(w, h);

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(0, 0, 0, ${0.24 - amp * 0.12})`;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "lighter";
    this.drawRipples(ctx, cx, cy);
    this.drawParticles(ctx, cx, cy, reach, amp);
    this.drawRing(ctx, cx, cy, reach * (0.16 + amp * 0.05), this.spin, this.petals, 1, amp);
    this.drawRing(
      ctx,
      cx,
      cy,
      reach * (0.09 + amp * 0.03),
      -this.spin * 1.35,
      this.petals + 2,
      0.55,
      amp
    );
    this.drawCore(ctx, cx, cy, reach, amp);

    ctx.globalCompositeOperation = "source-over";
    const vignette = ctx.createRadialGradient(cx, cy, reach * 0.2, cx, cy, reach * 0.72);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.38)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  drawRipples(ctx, cx, cy) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const ripple = this.ripples[i];
      ripple.r += (0.2 + this.amp * 0.45) * this.dt;
      ripple.a *= 0.972;
      if (ripple.a < 0.015) {
        this.ripples.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(cx, cy, ripple.r, 0, Math.PI * 2);
      ctx.strokeStyle = hsla(ripple.hue, ripple.a * 0.7, 70);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  drawParticles(ctx, cx, cy, reach, amp) {
    const sparkle = 0.35 + this.centroid * 1.4;
    for (const p of this.particles) {
      p.ang += p.speed * (0.00013 + amp * 0.00075) * sparkle * this.dt;
      if (p.spark) {
        p.rad += (0.022 + amp * 0.15) * this.dt;
        if (p.rad > reach * 0.62) {
          p.rad = reach * (0.05 + Math.random() * 0.08);
          p.ang = Math.random() * Math.PI * 2;
        }
      } else {
        const target = p.base * (0.82 + amp * 0.55);
        p.rad += (target - p.rad) * 0.04;
      }
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * 0.004 + p.tw));
      const alpha = (0.05 + amp * 0.55) * tw * (p.spark ? 1 : 0.7);
      const x = cx + Math.cos(p.ang) * p.rad;
      const y = cy + Math.sin(p.ang) * p.rad;
      ctx.fillStyle = hsla(this.hue + p.hueOff, alpha, p.spark ? 78 : 66);
      ctx.beginPath();
      ctx.arc(x, y, p.size * (0.7 + amp), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRing(ctx, cx, cy, base, spin, petals, gain, amp) {
    const steps = 220;
    const radii = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const u = i / steps;
      const fold = u < 0.5 ? u * 2 : (1 - u) * 2;
      const idx = Math.min(63, Math.floor(fold * 64));
      const mag = this.bins[idx] * gain;
      const ang = u * Math.PI * 2 + spin;
      const petal = 1 + 0.16 * Math.sin(ang * petals);
      radii[i] = base * petal + mag * (reachSpread(this.w, this.h) + amp * 150) + amp * 28;
    }
    for (let pass = 0; pass < 3; pass++) {
      const prev = Float32Array.from(radii);
      for (let i = 0; i < steps; i++) {
        const a = prev[(i - 1 + steps) % steps];
        const b = prev[i];
        const c = prev[(i + 1) % steps];
        radii[i] = a * 0.25 + b * 0.5 + c * 0.25;
      }
    }
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = (i % steps) / steps;
      const r = radii[i % steps];
      const ang = u * Math.PI * 2 + spin;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.strokeStyle = hsla(this.hue, 0.16 + amp * 0.18, 60);
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.strokeStyle = hsla(this.hue + 18, 0.35 + amp * 0.4, 68);
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.strokeStyle = hsla(this.hue + 36, 0.55 + amp * 0.45, 84);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawCore(ctx, cx, cy, reach, amp) {
    const radius = reach * (0.04 + amp * 0.1);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 3.1);
    glow.addColorStop(0, hsla(this.hue + 10, 0.42 + amp * 0.5, 86));
    glow.addColorStop(0.28, hsla(this.hue, 0.16 + amp * 0.2, 62));
    glow.addColorStop(1, hsla(this.hue, 0, 60));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 3.1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLasers() {
    this.fade(0.14 + (1 - this.amp) * 0.14);
    const ctx = this.ctx;
    const cx = this.w * 0.5;
    const cy = this.h * 0.5;
    const maxLen = Math.hypot(this.w, this.h) * 0.64;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const rays = 40;
    for (let i = 0; i < rays; i++) {
      const bin = this.bins[Math.min(63, Math.floor((i / rays) * 48))];
      const dir = i % 2 === 0 ? 2.1 : -1.25;
      const ang = this.spin * dir + (i / rays) * Math.PI * 2;
      const len = maxLen * (0.1 + bin * 0.9) * (0.35 + this.amp * 1.05);
      const wide = i % 5 === 0;
      ctx.strokeStyle = hsla(this.hue + i * 12, (wide ? 0.62 : 0.32) * (0.4 + bin), wide ? 74 : 64);
      ctx.lineWidth = (wide ? 5 : 1.25) * (0.55 + this.amp);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
      ctx.stroke();
    }
    this.drawCore(ctx, cx, cy, Math.min(this.w, this.h) * 0.42, Math.min(this.amp, 0.75));
  }

  drawConfetti() {
    this.fade(0.26);
    const power = 0.5 + this.amp * 1.3;
    const trickle = this.amp > 0.1 ? 1 + Math.floor(this.amp * 8) : 0;
    if (trickle) this.spawnConfetti(trickle, power);
    if (this.burst) this.spawnConfetti(48 + Math.floor(this.amp * 36), power + 0.6);
    if (this.confetti.length === 0) this.spawnConfetti(8, 0.45);

    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    const dt = this.dt || 16;
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const piece = this.confetti[i];
      piece.age += dt;
      piece.vy += 0.00045 * dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.rot += piece.spin * dt;
      if (piece.age > piece.life || piece.y > this.h + 40) {
        this.confetti.splice(i, 1);
        continue;
      }
      const alpha = (1 - piece.age / piece.life) * (0.55 + this.amp * 0.45);
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rot);
      ctx.fillStyle = hsla(piece.hue, alpha, 70);
      if (piece.rect) ctx.fillRect(-piece.size, -piece.size * 0.42, piece.size * 2, piece.size * 0.84);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, piece.size * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  spawnConfetti(count, power) {
    const cx = this.w * 0.5;
    const cy = this.h * 0.4;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = (0.06 + Math.random() * 0.5) * power;
      this.confetti.push({
        x: cx + (Math.random() - 0.5) * 50,
        y: cy + (Math.random() - 0.5) * 24,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 0.28 * power,
        size: 4 + Math.random() * (7 + power * 8),
        hue: Math.random() < 0.3 ? this.hue : Math.random() * 360,
        life: 800 + Math.random() * 1300,
        age: 0,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.012,
        rect: Math.random() < 0.7,
      });
    }
    if (this.confetti.length > 420) this.confetti.splice(0, this.confetti.length - 420);
  }

  drawRoom() {
    const ctx = this.ctx;
    if (this.burst) this.flash = 1;
    const decay = Math.pow(0.9, (this.dt || 16) / 16.67);
    this.flash *= decay;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `hsla(${this.hue}, 94%, ${14 + this.amp * 26}%, ${0.16 + this.amp * 0.62})`;
    ctx.fillRect(0, 0, this.w, this.h);
    if (this.flash > 0.03) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flash * 0.22})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    ctx.globalCompositeOperation = "lighter";
    const cx = this.w * 0.5;
    const cy = this.h * 0.5;
    for (let i = 0; i < 4; i++) {
      const ang = this.spin * (0.55 + i * 0.17) + i * 1.6;
      const orbit = Math.min(this.w, this.h) * (0.08 + i * 0.07 + this.amp * 0.12);
      const x = cx + Math.cos(ang) * orbit;
      const y = cy + Math.sin(ang * 0.85) * orbit * 0.62;
      const radius = Math.min(this.w, this.h) * (0.16 + this.bins[i * 10] * 0.34 + this.amp * 0.2);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, hsla(this.hue + i * 36, 0.55 + this.amp * 0.4, 80));
      glow.addColorStop(1, hsla(this.hue + i * 36, 0, 60));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBars() {
    this.fade(0.34);
    const ctx = this.ctx;
    const n = 32;
    const margin = this.w * 0.05;
    const gap = Math.max(4, this.w * 0.005);
    const bw = (this.w - margin * 2 - gap * (n - 1)) / n;
    const mid = this.h * 0.5;
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 18;
    ctx.shadowColor = hsla(this.hue, 0.85, 60);
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(i - (n - 1) / 2);
      const src = Math.min(63, Math.floor((dist / (n / 2)) * 28));
      const bin = this.bins[src];
      const shaped = Math.pow(Math.max(bin, 0.02), 0.6) * (0.22 + this.amp * 1.65);
      const mag = Math.max(0.07, shaped);
      const bh = Math.min(this.h * 0.47, mag * this.h * 0.5);
      const x = margin + i * (bw + gap);
      ctx.fillStyle = hsla(this.hue + dist * 5, 0.4 + mag * 0.6, 60 + bin * 20);
      const y = mid - bh;
      const height = bh * 2;
      const radius = Math.min(10, bw / 2);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, bw, height, radius);
      else ctx.rect(x, y, bw, height);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  drawStage() {
    const ctx = this.ctx;
    const motion = this.groove;
    if (motion > 0.02) this.crowdHue = this.hue;
    else if (this.crowdHue == null) this.crowdHue = this.hue;
    const hue = this.crowdHue;
    this.fade(1);
    ctx.globalCompositeOperation = "source-over";
    const wash = ctx.createLinearGradient(0, this.h * 0.42, 0, this.h);
    wash.addColorStop(0, "rgba(0, 0, 0, 0)");
    wash.addColorStop(1, hsla(hue, 0.08 + motion * this.amp * 0.28, 32));
    ctx.fillStyle = wash;
    ctx.fillRect(0, this.h * 0.45, this.w, this.h * 0.55);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      const x = this.w * (0.16 + i * 0.23);
      const beam = ctx.createLinearGradient(x, 0, x, this.h * 0.92);
      beam.addColorStop(0, hsla(hue + i * 18, 0.035 + motion * this.amp * 0.14, 70));
      beam.addColorStop(1, hsla(hue, 0, 50));
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - 14, 0);
      ctx.lineTo(x + 14, 0);
      ctx.lineTo(x + this.w * 0.07, this.h);
      ctx.lineTo(x - this.w * 0.07, this.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  clipFrame(person, frames, beatsPerLoop) {
    if (this.groove < 0.008) return person.hold || 0;
    let frame;
    if (this.followTempo && this.tempoConfidence > 0.35) {
      const cycle = (this.beatIndex + this.beatPhase) / beatsPerLoop + person.lag;
      frame = Math.floor((cycle - Math.floor(cycle)) * frames) % frames;
    } else {
      person.phase = (person.phase + (this.dt || 16) * person.pulse * (0.6 + this.amp * 1.1)) % 1;
      frame = Math.floor(person.phase * frames) % frames;
    }
    person.hold = frame;
    return frame;
  }

  drawSprite(ctx, image, sx, sy, sw, sh, x, y, dw, dh, flip) {
    ctx.save();
    if (flip) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(image, sx, sy, sw, sh, -dw / 2, 0, dw, dh);
    } else {
      ctx.drawImage(image, sx, sy, sw, sh, x - dw / 2, y, dw, dh);
    }
    ctx.restore();
  }

  drawPixel() {
    this.drawStage();
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    const unit = Math.max(4, Math.round((this.h * 0.4) / 53));
    const ordered = this.sprites.slice().sort((a, b) => a.y - b.y);
    for (const person of ordered) {
      const sheet = this.pixelSheets[person.dance];
      if (!sheet.complete || !sheet.naturalWidth) continue;
      const frames = 8;
      const fw = sheet.naturalWidth / frames;
      const fh = sheet.naturalHeight;
      const frame = this.clipFrame(person, frames, 1);
      const dw = fw * unit * person.scale;
      const dh = fh * unit * person.scale;
      const x = clamp(person.x * this.w, dw * 0.5, this.w - dw * 0.5);
      this.drawSprite(ctx, sheet, frame * fw, 0, fw, fh, x, person.y * this.h - dh, dw, dh, person.flip);
    }
    ctx.imageSmoothingEnabled = true;
  }

  drawDancer() {
    this.drawStage();
    const sheet = this.dancerSheet;
    if (!sheet.complete || !sheet.naturalWidth) return;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    const ordered = this.dancers.slice().sort((a, b) => a.y - b.y);
    for (const person of ordered) {
      const frame = this.clipFrame(person, 64, 4);
      const dh = this.h * 0.84 * person.scale;
      const x = clamp(person.x * this.w, dh * 0.28, this.w - dh * 0.28);
      this.drawSprite(
        ctx,
        sheet,
        (frame % 8) * 512,
        Math.floor(frame / 8) * 512,
        512,
        512,
        x,
        person.y * this.h - dh,
        dh,
        dh,
        person.flip
      );
    }
  }

  drawCrowd() {
    const ctx = this.ctx;
    const motion = this.groove;
    if (motion > 0.02) this.crowdHue = this.hue;
    else if (this.crowdHue == null) this.crowdHue = this.hue;
    const hue = this.crowdHue;
    this.fade(1);
    ctx.globalCompositeOperation = "source-over";
    const wash = ctx.createLinearGradient(0, this.h * 0.42, 0, this.h);
    wash.addColorStop(0, "rgba(0, 0, 0, 0)");
    wash.addColorStop(1, hsla(hue, 0.08 + motion * this.amp * 0.28, 32));
    ctx.fillStyle = wash;
    ctx.fillRect(0, this.h * 0.45, this.w, this.h * 0.55);

    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      const x = this.w * (0.16 + i * 0.23);
      const beam = ctx.createLinearGradient(x, 0, x, this.h * 0.92);
      beam.addColorStop(0, hsla(hue + i * 18, 0.035 + motion * this.amp * 0.14, 70));
      beam.addColorStop(1, hsla(hue, 0, 50));
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - 14, 0);
      ctx.lineTo(x + 14, 0);
      ctx.lineTo(x + this.w * 0.07, this.h);
      ctx.lineTo(x - this.w * 0.07, this.h);
      ctx.closePath();
      ctx.fill();
    }

    this.relaxCrowd(this.dt || 16);
    ctx.globalCompositeOperation = "source-over";
    const ordered = this.crowd.slice().sort((a, b) => a.y - b.y);
    for (const person of ordered) {
      this.drawPerson(ctx, person, motion);
    }
  }

  relaxCrowd(dt) {
    const motion = this.groove;
    const follow = this.followTempo && this.tempoConfidence > 0.35;
    const sec = Math.min(dt * 0.001, 0.05);
    for (const person of this.crowd) {
      if (motion < 0.008) {
        this.restPerson(person);
        continue;
      }
      if (follow) {
        let phase = this.beatPhase + person.lag;
        let step = this.beatIndex;
        if (phase >= 1) {
          phase -= 1;
          step += 1;
        }
        person.phase = phase;
        person.step = step + person.parity;
      } else {
        person.phase += dt * person.pulse * (0.62 + this.amp * 1.15);
        if (person.phase >= 1) {
          person.step += Math.floor(person.phase);
          person.phase -= Math.floor(person.phase);
        }
      }
      const target = this.grooveTarget(person, motion);
      this.spring(person, "hip", target.hip, sec, 12, 0.82);
      this.spring(person, "hipDrop", target.hipDrop, sec, 14, 0.86);
      this.spring(person, "chest", target.chest, sec, 7.2, 0.74);
      this.spring(person, "chestLift", target.chestLift, sec, 6.4, 0.78);
      this.spring(person, "head", target.head, sec, 5, 0.84);
      this.spring(person, "armL", target.armL, sec, 4.6, 0.7);
      this.spring(person, "armR", target.armR, sec, 4.6, 0.7);
      this.spring(person, "liftL", target.liftL, sec, 9, 0.84);
      this.spring(person, "liftR", target.liftR, sec, 9, 0.84);
    }
  }

  restPerson(person) {
    person.hip = person.hipDrop = person.chest = person.chestLift = person.head = 0;
    person.armL = person.armR = person.liftL = person.liftR = 0;
    person.hipV = person.hipDropV = person.chestV = person.chestLiftV = person.headV = 0;
    person.armLV = person.armRV = person.liftLV = person.liftRV = 0;
  }

  spring(person, key, target, sec, freq, damp) {
    const vKey = `${key}V`;
    const velocity = person[vKey];
    const accel = (target - person[key]) * freq * freq - 2 * damp * freq * velocity;
    person[vKey] = velocity + accel * sec;
    person[key] += person[vKey] * sec;
  }

  grooveTarget(person, motion) {
    const m = motion * person.energy;
    const phase = person.phase;
    const style = person.style;
    const side = ((((person.step % 2) + 2) % 2 === 0 ? 1 : -1) * person.lead);
    const hold = style === 1 ? 0.78 : style === 3 ? 0.42 : 0.64;
    let weight = side;
    if (phase >= hold) weight = side * (1 - 2 * smooth((phase - hold) / (1 - hold)));
    const settled = phase < hold ? 1 : 1 - (phase - hold) / (1 - hold);
    const circle = settled * Math.sin(phase * Math.PI * 2 + person.lag * 6);
    const pose = {
      hip: (weight * 3.2 + circle * 0.55) * m,
      hipDrop: (0.85 + (1 - Math.abs(weight)) * 1.35) * m,
      chest: -weight * 1.35 * m,
      chestLift: 0,
      head: -weight * 0.45 * m,
      armL: (0.1 + Math.max(0, -weight) * 0.32) * m,
      armR: (0.1 + Math.max(0, weight) * 0.32) * m,
      liftL: Math.max(0, weight) * 0.38 * m,
      liftR: Math.max(0, -weight) * 0.38 * m,
    };
    if (style === 1) {
      pose.hip = (weight * 1.1 + circle * 2.2) * m;
      pose.chest = -weight * 0.28 * m;
      pose.armL = (0.5 + circle * 0.12) * m;
      pose.liftL = 0.06 * m;
      pose.liftR = 0.06 * m;
    } else if (style === 2) {
      pose.chest = (-weight * 1.7 + (phase < hold ? 0 : (phase - hold) * 3.2)) * m;
      pose.chestLift = Math.sin(phase * Math.PI) * 1.5 * m;
      pose.hip = weight * 2.5 * m;
      pose.armL = (0.22 + pose.armL) * 0.85;
      pose.armR = (0.22 + pose.armR) * 0.85;
    } else if (style === 3) {
      const down = phase < 0.2 ? 1 - phase / 0.2 : 0;
      pose.hip = weight * 1.45 * m;
      pose.hipDrop = (0.7 + down * 2.1) * m;
      pose.armL = (0.18 + down * 0.28) * m;
      pose.armR = pose.armL;
    } else if (style === 4) {
      const phrase = ((person.step % 8) + 8) % 8;
      pose.hip = (weight * 2.7 + circle * 0.7) * m;
      if (phrase < 2) pose.armR = (0.42 + Math.max(0, weight) * 0.2) * m;
      else if (phrase < 4) pose.armL = (0.42 + Math.max(0, -weight) * 0.2) * m;
      else if (phrase < 6) {
        pose.armL = 0.78 * m;
        pose.armR = 0.62 * m;
      } else pose.hip *= 1.12;
    }
    return pose;
  }

  drawPerson(ctx, person, motion) {
    const s = person.s;
    const pose = person;
    const ground = person.y * this.h;
    const x = clamp(person.x, 0.08, 0.92) * this.w;
    const feetY = ground;
    const hipX = x + pose.hip * s;
    const hipY = feetY - 22 * s + pose.hipDrop * s;
    const shoulderX = hipX + pose.chest * s;
    const shoulderY = hipY - 13.6 * s - pose.chestLift * s;
    const headR = 3.2 * s;
    const headX = shoulderX + pose.head * s;
    const headY = shoulderY - 6.6 * s;
    const reach = 5.4 * s * person.shoulder;
    const stance = 5.4 * s;
    const leftFoot = { x: x - stance - pose.hip * 0.15 * s, y: feetY - pose.liftL * 13 * s };
    const rightFoot = { x: x + stance - pose.hip * 0.15 * s, y: feetY - pose.liftR * 13 * s };

    ctx.save();
    ctx.globalAlpha = person.alpha;
    if (person.hairStyle === 2 || person.hairStyle === 3) this.drawHair(ctx, headX, headY, headR, person, true);
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(x, ground + s * 0.4, 9 * s, 1.8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    const legColor = person.dress ? shade(person.skin, -8) : person.pants;
    this.drawLimb(ctx, hipX - 1.7 * s, hipY, leftFoot.x, leftFoot.y, 2.15 * s, legColor, true);
    this.drawLimb(ctx, hipX + 1.7 * s, hipY, rightFoot.x, rightFoot.y, 2.15 * s, legColor, true);

    ctx.fillStyle = person.shirt;
    ctx.strokeStyle = shade(person.shirt, -48);
    ctx.lineWidth = Math.max(0.8, s * 0.28);
    ctx.lineJoin = "round";
    const tilt = pose.chest * 0.55 * s;
    const waistY = shoulderY + (hipY - shoulderY) * 0.58;
    ctx.beginPath();
    ctx.moveTo(shoulderX - reach, shoulderY + 0.5 * s - tilt);
    ctx.quadraticCurveTo(shoulderX, shoulderY - 1.1 * s, shoulderX + reach, shoulderY + 0.55 * s + tilt);
    ctx.quadraticCurveTo(shoulderX + reach * 0.42, waistY, hipX + reach * 0.78, hipY);
    ctx.quadraticCurveTo(hipX, hipY + 1.6 * s, hipX - reach * 0.78, hipY);
    ctx.quadraticCurveTo(shoulderX - reach * 0.42, waistY, shoulderX - reach, shoulderY + 0.5 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (person.dress) {
      const hem = hipY + 7.5 * s;
      ctx.fillStyle = person.shirt;
      ctx.beginPath();
      ctx.moveTo(hipX - reach * 0.78, hipY);
      ctx.lineTo(hipX + reach * 0.78, hipY);
      ctx.lineTo(hipX + reach * 0.95, hem);
      ctx.quadraticCurveTo(hipX, hem + 1.6 * s, hipX - reach * 0.95, hem);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = person.skin;
    ctx.fillRect(headX - 1.15 * s, shoulderY - 0.2 * s, 2.3 * s, 3.4 * s);
    this.drawArm(ctx, shoulderX - reach * 0.82, shoulderY + 1.4 * s, -1, pose.armL, s, person.skin);
    this.drawArm(ctx, shoulderX + reach * 0.82, shoulderY + 1.4 * s, 1, pose.armR, s, person.skin);
    ctx.fillStyle = person.skin;
    ctx.strokeStyle = shade(person.skin, -36);
    ctx.lineWidth = Math.max(0.7, s * 0.22);
    ctx.beginPath();
    ctx.ellipse(headX, headY, headR * 0.9, headR, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = shade(person.skin, -16);
    ctx.beginPath();
    ctx.ellipse(headX - headR * 0.92, headY + headR * 0.08, headR * 0.18, headR * 0.28, 0, 0, Math.PI * 2);
    ctx.ellipse(headX + headR * 0.92, headY + headR * 0.08, headR * 0.18, headR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    this.drawHair(ctx, headX, headY, headR, person, false);

    if (s > 2) {
      ctx.fillStyle = "rgba(42, 26, 20, 0.8)";
      ctx.beginPath();
      ctx.ellipse(headX - headR * 0.32, headY + headR * 0.02, headR * 0.08, headR * 0.1, 0, 0, Math.PI * 2);
      ctx.ellipse(headX + headR * 0.32, headY + headR * 0.02, headR * 0.08, headR * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawArm(ctx, sx, sy, side, raise, s, skin) {
    const up = Math.min(1.15, Math.max(0, raise));
    const ex = sx + side * (2.4 + up * 2.4) * s;
    const ey = sy + (6.4 - up * 9.2) * s;
    const hx = ex + side * (0.4 + up * 2.1) * s;
    const hy = ey + (6.6 - up * 13.4) * s;
    ctx.fillStyle = skin;
    ctx.strokeStyle = shade(skin, -36);
    ctx.lineWidth = Math.max(0.7, s * 0.2);
    ctx.lineJoin = "round";
    this.fillBone(ctx, sx, sy, ex, ey, 1.35 * s, 1.15 * s);
    this.fillBone(ctx, ex, ey, hx, hy, 1.15 * s, 0.85 * s);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(hx, hy, 1.05 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLimb(ctx, x1, y1, x2, y2, width, color, shoe) {
    const dist = Math.hypot(x2 - x1, y2 - y1) || 1;
    const slack = Math.max(0, width * 10.2 - dist);
    const out = x2 >= x1 ? 1 : -1;
    const kneeX = (x1 + x2) / 2 + out * slack * 0.62;
    const kneeY = (y1 + y2) / 2 + slack * 0.7;
    ctx.fillStyle = color;
    ctx.strokeStyle = shade(color, -42);
    ctx.lineWidth = Math.max(0.6, width * 0.16);
    ctx.lineJoin = "round";
    this.fillBone(ctx, x1, y1, kneeX, kneeY, width, width * 0.78);
    this.fillBone(ctx, kneeX, kneeY, x2, y2, width * 0.78, width * 0.5);
    if (shoe) {
      ctx.fillStyle = "#161616";
      ctx.beginPath();
      ctx.ellipse(x2, y2, width * 1.05, width * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x2, y2, width * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  fillBone(ctx, x1, y1, x2, y2, w1, w2) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const px = Math.sin(angle);
    const py = -Math.cos(angle);
    ctx.beginPath();
    ctx.moveTo(x1 + px * w1, y1 + py * w1);
    ctx.lineTo(x2 + px * w2, y2 + py * w2);
    ctx.lineTo(x2 - px * w2, y2 - py * w2);
    ctx.lineTo(x1 - px * w1, y1 - py * w1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawHair(ctx, x, y, r, person, behind) {
    ctx.fillStyle = person.hair;
    const style = person.hairStyle;
    if (behind && style === 3) {
      ctx.beginPath();
      ctx.arc(x, y - r * 0.15, r * 1.55, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (behind && style === 2) {
      ctx.beginPath();
      ctx.ellipse(x - r * 0.7, y + r * 1.2, r * 0.34, r * 1.25, 0.18, 0, Math.PI * 2);
      ctx.ellipse(x + r * 0.7, y + r * 1.2, r * 0.34, r * 1.25, -0.18, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (behind) return;
    if (style === 0 || style === 1) {
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.2, r * (style === 1 ? 1.12 : 1.02), r * 0.72, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      if (style === 1) {
        ctx.beginPath();
        ctx.ellipse(x - r * 0.85, y + r * 0.35, r * 0.38, r * 0.7, 0.2, 0, Math.PI * 2);
        ctx.ellipse(x + r * 0.85, y + r * 0.35, r * 0.38, r * 0.7, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === 4) {
      ctx.beginPath();
      ctx.arc(x, y - r * 1.05, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.35, r * 1.02, r * 0.55, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (style === 2 || style === 3) {
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.45, r * 1.05, r * 0.48, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  }
}

function reachSpread(w, h) {
  return Math.min(w, h) * 0.16;
}

function smooth(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift) => clamp(((value >> shift) & 255) + amount, 0, 255);
  const mixed = (channel(16) << 16) + (channel(8) << 8) + channel(0);
  return `#${mixed.toString(16).padStart(6, "0")}`;
}
