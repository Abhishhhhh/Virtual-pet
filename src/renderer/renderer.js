// renderer.js — the pet's brain: state machine, animation, and drawing.
//
// Sprite loading: if assets/sprites/<state>.png exists, it's used as a
// horizontal sprite strip (frameCount frames, each FRAME_SIZE x FRAME_SIZE,
// transparent PNG). If a file is missing, that state falls back to a
// procedurally drawn placeholder so the app is fully runnable out of the
// box. Drop in real art with the exact filenames below and nothing else
// needs to change (just update `frames` here if your sheet has a
// different frame count than the defaults).

const FRAME_SIZE = 64;
const HOUSE_SIZE = 96;

const ANIMS = {
  idle: { file: '../../assets/sprites/idle.png', frames: 4, fps: 4 },
  walk: { file: '../../assets/sprites/walk.png', frames: 6, fps: 8 },
  play: { file: '../../assets/sprites/play.png', frames: 5, fps: 8 },
  nap: { file: '../../assets/sprites/nap.png', frames: 2, fps: 1 },
};

const FOLLOW_DISTANCE = 70; // px — how close the pet is happy to sit
const IDLE_TIMEOUT = 25000; // ms of cursor inactivity before heading home
const SPEED = 3.2; // px per frame, eased toward target
const NAME_TAG_MS = 2500;

// ---------- asset loading (with graceful fallback) ----------

const sprites = {};
for (const [name, cfg] of Object.entries(ANIMS)) {
  const img = new Image();
  img.src = cfg.file;
  sprites[name] = { img, ready: false, failed: false };
  img.onload = () => { sprites[name].ready = true; };
  img.onerror = () => { sprites[name].failed = true; };
}

const houseSprite = { img: new Image(), ready: false, failed: false };
houseSprite.img.src = '../../assets/sprites/house.png';
houseSprite.img.onload = () => { houseSprite.ready = true; drawHouseOnce(); };
houseSprite.img.onerror = () => { houseSprite.failed = true; };

// ---------- placeholder art (used until you drop in your own) ----------

const PLACEHOLDER = {
  body: '#e08a4b',
  bodyDark: '#c06f38',
  belly: '#f6d9b8',
  eye: '#2a2016',
};

function drawPlaceholderPet(ctx, state, frame, facingLeft) {
  const GRID = 16;
  const CELL = FRAME_SIZE / GRID;
  const cell = (gx, gy, gw, gh, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(gx * CELL), Math.round(gy * CELL), Math.round(gw * CELL), Math.round(gh * CELL));
  };

  ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (facingLeft) { ctx.translate(FRAME_SIZE, 0); ctx.scale(-1, 1); }

  let bob = 0, legSpread = 0, tailWag = 0, squish = 0, earPerk = 0;
  if (state === 'idle') {
    bob = frame % 2;
  } else if (state === 'walk') {
    bob = frame % 2 === 0 ? 0 : -1;
    legSpread = frame % 2 === 0 ? 1 : -1;
  } else if (state === 'play') {
    bob = [0, -2, 0, -1, 0, -2][frame % 6] || 0;
    tailWag = frame % 2 === 0 ? 1 : -1;
    earPerk = 1;
  } else if (state === 'nap') {
    squish = 1;
  }

  const bodyTop = 6 + bob - squish * 2;
  const bodyH = squish ? 6 : 8;

  cell(11, bodyTop + 2 + tailWag, 2, 2, PLACEHOLDER.bodyDark); // tail
  if (!squish) {
    cell(5 + legSpread, 13, 2, 2, PLACEHOLDER.bodyDark); // back leg
    cell(9 - legSpread, 13, 2, 2, PLACEHOLDER.bodyDark); // front leg
  }
  cell(4, bodyTop, 8, bodyH, PLACEHOLDER.body); // body
  cell(5, bodyTop + bodyH - 2, 6, 2, PLACEHOLDER.belly); // belly
  cell(4, bodyTop - 2 - earPerk, 2, 2, PLACEHOLDER.bodyDark); // ear
  cell(10, bodyTop - 2 - earPerk, 2, 2, PLACEHOLDER.bodyDark); // ear
  cell(3, bodyTop - 1, 5, 4, PLACEHOLDER.body); // head

  if (squish) {
    cell(5, bodyTop + 1, 2, 1, PLACEHOLDER.eye); // closed eye
  } else {
    cell(6, bodyTop, 1, 1, PLACEHOLDER.eye); // eye
    cell(4, bodyTop + 1, 1, 1, PLACEHOLDER.eye); // nose
  }
  ctx.restore();

  if (state === 'nap') {
    ctx.fillStyle = '#8a8a8a';
    ctx.font = '10px monospace';
    ctx.fillText(frame % 2 === 0 ? 'z' : 'Z', 42, 18);
  }
}

function drawPlaceholderHouse(ctx) {
  const GRID = 16;
  const S = HOUSE_SIZE / GRID;
  const c = (gx, gy, gw, gh, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(gx * S, gy * S, gw * S, gh * S);
  };
  ctx.clearRect(0, 0, HOUSE_SIZE, HOUSE_SIZE);
  c(2, 6, 12, 2, '#8a5a3b');
  c(3, 4, 10, 2, '#8a5a3b');
  c(4, 2, 8, 2, '#8a5a3b');
  c(3, 8, 10, 6, '#d8b98a');
  c(6, 10, 4, 4, '#5a3c24');
}

// ---------- state ----------

const petCanvas = document.getElementById('pet');
const petCtx = petCanvas.getContext('2d');
const houseCanvas = document.getElementById('house');
const houseCtx = houseCanvas.getContext('2d');
const nameTag = document.getElementById('nameTag');

let screenW = window.innerWidth;
let screenH = window.innerHeight;
let house = { x: 0, y: 0 };
let petName = 'Buddy';

const pet = { x: 100, y: 100 };
let facingLeft = false;
let state = 'idle'; // idle | walk | play | nap
let frameIndex = 0;
let frameTimer = 0;

let cursor = { x: 0, y: 0 };
let lastCursor = { x: 0, y: 0 };
let lastCursorMoveTime = performance.now();

let forcedSleep = false;
let forcedPlayUntil = 0;
let nextPlayCheck = 0;
let nameTagUntil = 0;

window.petAPI.onInit((data) => {
  petName = data.name || 'Buddy';
  screenW = data.screenWidth;
  screenH = data.screenHeight;
  house.x = data.houseX;
  house.y = data.houseY;
  houseCanvas.style.left = house.x + 'px';
  houseCanvas.style.top = house.y + 'px';
  pet.x = house.x;
  pet.y = house.y - 20;
  cursor = { ...pet };
  lastCursor = { ...cursor };
  nameTag.textContent = petName;
});

window.petAPI.onCursor((point) => {
  const moved = Math.hypot(point.x - lastCursor.x, point.y - lastCursor.y) > 3;
  cursor = point;
  if (moved) {
    lastCursorMoveTime = performance.now();
    lastCursor = { ...point };
  }
});

window.petAPI.onCommand((cmd) => {
  const now = performance.now();
  if (cmd === 'call') {
    forcedSleep = false;
    lastCursorMoveTime = now;
    if (state === 'nap') state = 'idle';
    showNameTag(now);
  } else if (cmd === 'play') {
    forcedSleep = false;
    if (state === 'nap') state = 'idle';
    forcedPlayUntil = now + 3000;
  } else if (cmd === 'sleep') {
    forcedSleep = true;
    forcedPlayUntil = 0;
  }
});

window.petAPI.onRenamed((name) => {
  petName = name;
  nameTag.textContent = name;
  showNameTag(performance.now());
});

function showNameTag(now) {
  nameTagUntil = now + NAME_TAG_MS;
}

function moveToward(tx, ty) {
  const dx = tx - pet.x;
  const dy = ty - pet.y;
  const dist = Math.hypot(dx, dy) || 1;
  const speed = Math.min(SPEED, dist);
  pet.x = clamp(pet.x + (dx / dist) * speed, 0, Math.max(0, screenW - FRAME_SIZE));
  pet.y = clamp(pet.y + (dy / dist) * speed, 0, Math.max(0, screenH - FRAME_SIZE));
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function headHome() {
  const hx = house.x + HOUSE_SIZE / 2 - FRAME_SIZE / 2;
  const hy = house.y + HOUSE_SIZE / 2 - FRAME_SIZE / 2 - 12;
  const dist = Math.hypot(hx - pet.x, hy - pet.y);
  if (dist < 4) {
    state = 'nap';
  } else {
    state = 'walk';
    facingLeft = hx < pet.x;
    moveToward(hx, hy);
  }
}

function maybeTriggerPlay(now) {
  if (now < nextPlayCheck) return;
  nextPlayCheck = now + 4000 + Math.random() * 6000;
  if (Math.random() < 0.35) forcedPlayUntil = now + 2500 + Math.random() * 1500;
}

function decide(now) {
  if (forcedPlayUntil) {
    if (now < forcedPlayUntil) { state = 'play'; return; }
    forcedPlayUntil = 0;
    state = 'idle';
  }

  if (forcedSleep) { headHome(); return; }

  if (state === 'nap') {
    // Sleeping until called, sent to play, or naturally after a long rest.
    return;
  }

  const cx = pet.x + FRAME_SIZE / 2;
  const cy = pet.y + FRAME_SIZE / 2;
  const dist = Math.hypot(cursor.x - cx, cursor.y - cy);
  const cursorIdleMs = now - lastCursorMoveTime;

  if (cursorIdleMs > IDLE_TIMEOUT) { headHome(); return; }

  if (dist > FOLLOW_DISTANCE) {
    state = 'walk';
    facingLeft = cursor.x < cx;
    moveToward(cursor.x - FRAME_SIZE / 2, cursor.y - FRAME_SIZE / 2);
  } else {
    state = 'idle';
    maybeTriggerPlay(now);
  }
}

function drawPet(dt) {
  const cfg = ANIMS[state];
  frameTimer += dt;
  const frameDuration = 1000 / cfg.fps;
  if (frameTimer >= frameDuration) {
    frameTimer -= frameDuration;
    frameIndex = (frameIndex + 1) % cfg.frames;
  }

  const sprite = sprites[state];
  if (sprite.ready) {
    const frameW = sprite.img.naturalWidth / cfg.frames;
    const frameH = sprite.img.naturalHeight;
    petCtx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
    petCtx.save();
    petCtx.imageSmoothingEnabled = false;
    if (facingLeft) { petCtx.translate(FRAME_SIZE, 0); petCtx.scale(-1, 1); }
    petCtx.drawImage(sprite.img, frameIndex * frameW, 0, frameW, frameH, 0, 0, FRAME_SIZE, FRAME_SIZE);
    petCtx.restore();
  } else {
    drawPlaceholderPet(petCtx, state, frameIndex, facingLeft);
  }

  petCanvas.style.left = Math.round(pet.x) + 'px';
  petCanvas.style.top = Math.round(pet.y) + 'px';

  const now = performance.now();
  if (now < nameTagUntil) {
    nameTag.style.opacity = '1';
    nameTag.style.left = Math.round(pet.x + FRAME_SIZE / 2) + 'px';
    nameTag.style.top = Math.round(pet.y - 16) + 'px';
  } else {
    nameTag.style.opacity = '0';
  }
}

function drawHouseOnce() {
  if (houseSprite.ready) {
    houseCtx.clearRect(0, 0, HOUSE_SIZE, HOUSE_SIZE);
    houseCtx.imageSmoothingEnabled = false;
    houseCtx.drawImage(houseSprite.img, 0, 0, HOUSE_SIZE, HOUSE_SIZE);
  } else {
    drawPlaceholderHouse(houseCtx);
  }
}

let lastFrameTime = performance.now();
let lastState = null;

function tick(now) {
  const dt = now - lastFrameTime;
  lastFrameTime = now;

  decide(now);
  if (state !== lastState) { frameIndex = 0; frameTimer = 0; lastState = state; }
  drawPet(dt);

  requestAnimationFrame(tick);
}

drawHouseOnce();
requestAnimationFrame(tick);
