import { AudioEngine, hueFromPitch, noteName } from "./audio.js";
import { VoiceVisual } from "./visual.js";

const canvas = document.getElementById("stage");
const overlay = document.getElementById("overlay");
const bar = document.getElementById("bar");
const message = document.getElementById("message");
const toast = document.getElementById("toast");
const noteEl = document.getElementById("note");
const fill = document.getElementById("fill");
const sensitivity = document.getElementById("sensitivity");
const lookBtn = document.getElementById("look");
const tempoBtn = document.getElementById("tempo");

const LOOKS = [
  ["bloom", "Bloom"],
  ["lasers", "Lasers"],
  ["confetti", "Confetti"],
  ["room", "Room"],
  ["bars", "Bars"],
  ["crowd", "Club"],
  ["pixel", "Pixel"],
  ["dancer", "Dancer"],
];

const params = new URLSearchParams(location.search);
const displayMode = params.get("display") === "1";
const channel = new BroadcastChannel("singing-voice");

const visual = new VoiceVisual(canvas);
const audio = new AudioEngine();

let mode = "idle";
let projector = null;
let last = performance.now();
let hideTimer = 0;
let mirrorBusy = false;
let displayUntil = 0;

const savedSensitivity = localStorage.getItem("sing-sensitivity");
if (savedSensitivity) {
  sensitivity.value = savedSensitivity;
  audio.sensitivity = Number(savedSensitivity);
}

if (displayMode) {
  document.body.classList.add("display");
  fill.hidden = false;
  requestFullscreen().then((ok) => {
    if (ok) fill.hidden = true;
  });
  fill.addEventListener("click", async () => {
    if (await requestFullscreen()) fill.hidden = true;
  });
} else if (location.protocol === "file:") {
  showMessage("Open this page from a local server so the microphone can be used. In this folder, run: python3 -m http.server 8765");
}

document.getElementById("listen").addEventListener("click", async () => {
  try {
    await audio.start();
    mode = "live";
    beginSession();
    await wake();
  } catch (error) {
    showMessage("The microphone could not be opened. Allow microphone access for this page, or use Preview.");
  }
});

document.getElementById("preview").addEventListener("click", async () => {
  mode = "preview";
  beginSession();
  await wake();
});

document.getElementById("fullscreen").addEventListener("click", () => requestFullscreen());
document.getElementById("projector").addEventListener("click", () => openProjector());
lookBtn.addEventListener("click", () => {
  applyLook(LOOKS[(lookIndex(visual.look) + 1) % LOOKS.length][0], true);
});

channel.onmessage = (event) => {
  const data = event.data;
  if (!data) return;
  if (data.hello === "display") {
    if (!displayMode) displayUntil = performance.now() + 2500;
    return;
  }
  if (displayMode && data.bitmap) {
    paintMirror(data.bitmap);
    return;
  }
  if (!displayMode && data.look) applyLook(data.look, false);
};

if (displayMode) {
  const hello = () => channel.postMessage({ hello: "display" });
  hello();
  setInterval(hello, 1000);
}

const savedLook = localStorage.getItem("sing-look");
if (savedLook) applyLook(savedLook, false);

const savedTempo = localStorage.getItem("sing-beat");
setTempo(savedTempo == null ? true : savedTempo === "1");
tempoBtn.addEventListener("click", () => setTempo(tempoBtn.getAttribute("aria-pressed") !== "true"));

sensitivity.addEventListener("input", () => {
  audio.sensitivity = Number(sensitivity.value);
  localStorage.setItem("sing-sensitivity", sensitivity.value);
});

window.addEventListener("resize", () => visual.resize());
document.addEventListener("fullscreenchange", () => {
  visual.resize();
  if (displayMode && document.fullscreenElement) fill.hidden = true;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "f" || event.key === "F") requestFullscreen();
  if (!(event.target instanceof HTMLInputElement)) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      applyLook(LOOKS[(lookIndex(visual.look) + 1) % LOOKS.length][0], true);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      applyLook(LOOKS[(lookIndex(visual.look) - 1 + LOOKS.length) % LOOKS.length][0], true);
    } else if (event.key >= "1" && event.key <= String(LOOKS.length)) {
      applyLook(LOOKS[Number(event.key) - 1][0], true);
    }
  }
  if (displayMode) return;
  if (event.key === "p" || event.key === "P") openProjector();
  if (event.key === "h" || event.key === "H") document.body.classList.toggle("ui-hidden");
});

window.addEventListener("pointermove", () => {
  if (mode === "idle" || displayMode) return;
  document.body.classList.remove("ui-hidden");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => document.body.classList.add("ui-hidden"), 3500);
});

function beginSession() {
  overlay.hidden = true;
  bar.hidden = false;
  message.hidden = true;
  armHide();
}

function armHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => document.body.classList.add("ui-hidden"), 3500);
}

function showMessage(text) {
  message.hidden = false;
  message.textContent = text;
}

function showToast(text) {
  toast.hidden = false;
  toast.textContent = text;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 5200);
}

async function requestFullscreen() {
  const node = document.fullscreenElement ? null : document.documentElement;
  try {
    if (node) await node.requestFullscreen();
    else await document.exitFullscreen();
    return true;
  } catch (error) {
    return false;
  }
}

async function openProjector() {
  let left = 0;
  let top = 0;
  let width = screen.availWidth;
  let height = screen.availHeight;
  let foundExternal = false;

  if ("getScreenDetails" in window) {
    try {
      const details = await window.getScreenDetails();
      const external = details.screens.find((item) => !item.isPrimary);
      if (external) {
        foundExternal = true;
        left = external.availLeft;
        top = external.availTop;
        width = external.availWidth;
        height = external.availHeight;
      }
    } catch (error) {
      showToast("Allow this page to use your screens, then press MoGo 4 again.");
      return;
    }
  }

  if (projector && !projector.closed) {
    projector.focus();
    try {
      projector.moveTo(left, top);
      projector.resizeTo(width, height);
    } catch (error) {
      /* The browser may refuse to move a window it did not just open. */
    }
    return;
  }

  const url = new URL(location.href);
  url.searchParams.set("display", "1");
  projector = window.open(
    url.toString(),
    "singing-projector",
    `popup=yes,left=${left},top=${top},width=${Math.floor(width)},height=${Math.floor(height)}`
  );

  if (!projector) {
    showToast("The browser blocked the projector window. Allow popups for this page and try again.");
    return;
  }

  if (!foundExternal) {
    showToast("Drag the new window onto the MoGo 4, then click it once so it fills that screen.");
  }
}

async function wake() {
  try {
    await navigator.wakeLock.request("screen");
  } catch (error) {
    /* Wake lock is optional. The picture still runs. */
  }
}

function previewFrame(now) {
  const bpm = 112;
  const beatPhase = (now % (60000 / bpm)) / (60000 / bpm);
  const beatIndex = Math.floor(now / (60000 / bpm));
  const kick = Math.exp(-beatPhase * 5.5);
  const breath = 0.5 + 0.5 * Math.sin(now * 0.0022);
  const amp = Math.min(1, 0.14 + 0.62 * kick + 0.18 * breath);
  const pitch = 196 * Math.pow(2, 0.15 + 0.95 * (0.5 + 0.5 * Math.sin(now * 0.00027)));
  const bins = [];
  for (let i = 0; i < 64; i++) {
    const harmonic = Math.exp(-i / 16);
    const wobble = 0.45 + 0.55 * Math.sin(now * 0.0034 + i * 0.37);
    const pulse = i < 8 ? kick : 0.35;
    bins.push(Math.min(1, harmonic * wobble * (0.25 + amp) * (0.55 + pulse)));
  }
  return {
    amp,
    pitch,
    hue: hueFromPitch(pitch),
    centroid: 0.22 + 0.25 * (0.5 + 0.5 * Math.sin(now * 0.001)),
    bins,
    bpm,
    beatPhase,
    beatIndex,
    tempoConfidence: 1,
  };
}

function loop(now) {
  const dt = Math.min(40, now - last);
  last = now;

  if (!displayMode && mode === "live") {
    const sample = audio.sample(now);
    if (sample) publish(sample);
  } else if (!displayMode && mode === "preview") {
    publish(previewFrame(now));
  }

  if (!displayMode) {
    visual.tick(dt);
    mirror();
  }
  requestAnimationFrame(loop);
}

function setTempo(on) {
  visual.followTempo = on;
  tempoBtn.setAttribute("aria-pressed", on ? "true" : "false");
  tempoBtn.title = on ? "Dancers are locked to the tempo" : "Dancers move freely. Click to lock to the tempo";
  localStorage.setItem("sing-beat", on ? "1" : "0");
}

function mirror() {
  const watching = (projector && !projector.closed) || performance.now() < displayUntil;
  if (!watching || mirrorBusy) return;
  mirrorBusy = true;
  createImageBitmap(canvas)
    .then((bitmap) => {
      mirrorBusy = false;
      const stillWatching = (projector && !projector.closed) || performance.now() < displayUntil;
      if (!stillWatching) {
        bitmap.close();
        return;
      }
      channel.postMessage({ bitmap }, [bitmap]);
    })
    .catch(() => {
      mirrorBusy = false;
    });
}

function paintMirror(bitmap) {
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
  const dw = bitmap.width * scale;
  const dh = bitmap.height * scale;
  ctx.drawImage(bitmap, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  bitmap.close();
}

function lookIndex(name) {
  const index = LOOKS.findIndex((item) => item[0] === name);
  return index < 0 ? 0 : index;
}

function applyLook(name, broadcast) {
  const known = LOOKS.some((item) => item[0] === name);
  const next = known ? name : "bloom";
  if (visual.look === next) return;
  visual.setLook(next);
  lookBtn.textContent = LOOKS[lookIndex(next)][1];
  localStorage.setItem("sing-look", next);
  if (broadcast) channel.postMessage({ look: next });
}

function publish(sample) {
  sample.look = visual.look;
  visual.push(sample);
  const note = noteName(sample.pitch);
  const tempo = visual.followTempo && sample.tempoConfidence > 0.35 && sample.bpm ? String(Math.round(sample.bpm)) : "";
  noteEl.textContent = [note, tempo].filter(Boolean).join(" · ");
  noteEl.title = tempo ? `${tempo} beats per minute` : "";
}

requestAnimationFrame(loop);
