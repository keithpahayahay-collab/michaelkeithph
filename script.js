/* ---------- starfield + shooting stars + supernova + black hole game ---------- */
const canvas = document.getElementById("stars");
const ctx = canvas.getContext("2d");

const STRENGTH = 0.12;   // how far the stars move with the cursor (higher = more)
const EASING = 0.06;     // how smoothly they follow (lower = smoother)
const DRIFT = 0.015;     // slow constant drift, set to 0 to turn off

// shooting star settings
const SHOT_MIN_DELAY = 1500;  // fastest gap between shooting stars (ms)
const SHOT_MAX_DELAY = 4500;  // slowest gap (ms)

// supernova settings (tap / click)
const NOVA_PARTICLES = 70;
const NOVA_SPEED = 360;
const NOVA_RING_SPEED = 320;

// long press settings
const LONG_PRESS = 450;       // how long to hold empty space to start the game (ms)
const MOVE_TOLERANCE = 12;    // finger/mouse wiggle allowed during the hold (px)

// ship settings
const SHIP_PIXEL = 4;         // size of each ship pixel (bigger = bigger ship)
const SHIP_EASE = 2.2;        // how quickly the ship glides in at the start
const FOLLOW_EASE = 11;       // how tightly the ship follows you (higher = snappier)
const TOUCH_OFFSET = 70;      // ship floats this far above your finger on phones (px)
const SHIP_HIT = 9;           // ship hitbox radius (smaller = more forgiving)
const SMOKE_RATE = 55;        // smoke puffs per second from each thruster

// ---- GAME DIFFICULTY (tweak these to make it easier or harder) ----
const START_INTERVAL = 1.3;   // seconds between asteroids at the start
const MIN_INTERVAL = 0.22;    // fastest gap between asteroids late in a run
const INTERVAL_TAU = 28;      // lower = gets crowded faster
const START_SPEED = 90;       // asteroid speed at the start
const SPEED_GAIN = 270;       // extra speed added as the run goes on
const SPEED_TAU = 40;         // lower = speeds up faster
const AIM_BASE = 0.1;         // 0 = random drifting, 1 = aimed at you (start)
const AIM_GAIN = 0.75;        // how much more they aim at you over time
const GOAL_SECONDS = 60;      // the score bar fills up at this time

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let w = 0;
let h = 0;
let stars = [];
const shooters = [];
const blasts = [];
const smoke = [];
const rocks = [];
let ship = null;
let smokeAcc = 0;
let nextShot = 800;
let lastTime = 0;

const target = { x: 0, y: 0 };
const offset = { x: 0, y: 0 };
const pointer = { x: 0, y: 0, touch: false };

// game state: off | suck | arrive | play | over | restore
let gameState = "off";
let gameTime = 0;
let nextRock = 1;
let best = loadBest();

const smooth = (x) => x * x * (3 - 2 * x);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// elements
const textItems = Array.from(document.querySelectorAll("h1, .section .link-box"));
const hud = document.getElementById("hud");
const hudTime = document.getElementById("hud-time");
const hudBest = document.getElementById("hud-best");
const hudFill = document.getElementById("hud-fill");
const goEl = document.getElementById("gameover");
const goTime = document.getElementById("go-time");
const goBest = document.getElementById("go-best");
const btnAgain = document.getElementById("btn-again");
const btnExit = document.getElementById("btn-exit");
const quitBtn = document.getElementById("btn-quit");

// ship sprite, nose points up (# = pixel)
const SHIP = [
  "....#....",
  "...###...",
  "...#.#...",
  "..#####..",
  "..#####..",
  ".#######.",
  "##.###.##",
  "#..###..#",
  "#..#.#..#"
];

/* ---------- helpers ---------- */
function loadBest() {
  try {
    return parseFloat(localStorage.getItem("kk_best")) || 0;
  } catch (e) {
    return 0;
  }
}

function saveBest() {
  try {
    localStorage.setItem("kk_best", String(best));
  } catch (e) {}
}

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
}

function wrap(value, max) {
  return ((value % max) + max) % max;
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const count = Math.min(500, Math.floor((w * h) / 3500));
  stars = Array.from({ length: count }, () => {
    const z = 0.2 + Math.random() * 0.8; // depth: small = far, big = close
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      z,
      size: z > 0.8 ? 3 : z > 0.5 ? 2 : 1,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.5
    };
  });
}

/* ---------- shooting stars ---------- */
function spawnShooter() {
  const fromRight = Math.random() < 0.5;
  const angle = (25 + Math.random() * 20) * Math.PI / 180; // downward slant
  shooters.push({
    x: fromRight ? w * (0.4 + Math.random() * 0.6) : w * Math.random() * 0.6,
    y: -10 + Math.random() * h * 0.3,
    dirx: (fromRight ? -1 : 1) * Math.cos(angle),
    diry: Math.sin(angle),
    speed: 500 + Math.random() * 400,
    len: 12 + Math.floor(Math.random() * 8),
    size: 2
  });
}

/* ---------- supernova ---------- */
function explode(x, y) {
  const particles = [];
  for (let i = 0; i < NOVA_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * NOVA_SPEED;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() < 0.25 ? 3 : 2,
      life: 0.7 + Math.random() * 0.8
    });
  }
  blasts.push({ x, y, age: 0, particles });
}

/* ---------- black hole ---------- */
const HOLE_R = 26;
const hole = { scale: 0, goal: 0 };
const holeDisk = Array.from({ length: 140 }, () => ({
  a: Math.random() * Math.PI * 2,
  r: 1.2 + Math.random() * 2.4,
  s: 0.6 + Math.random() * 0.8,
  size: Math.random() < 0.25 ? 3 : 2
}));

function drawHole(dt) {
  hole.scale += (hole.goal - hole.scale) * (1 - Math.exp(-3 * dt));
  if (hole.scale < 0.01) return;

  const R = HOLE_R * hole.scale;
  const cx = w / 2;
  const cy = h / 2;
  const boost = gameState === "suck" ? 3 : 1;
  const fade = Math.min(1, hole.scale * 1.5);

  // swirling pixel disk
  ctx.fillStyle = "#fff";
  for (const p of holeDisk) {
    p.a += dt * 2.4 * p.s * boost / Math.pow(p.r, 1.3);
    const px = cx + Math.cos(p.a) * p.r * R;
    const py = cy + Math.sin(p.a) * p.r * R * 0.4;
    ctx.globalAlpha = fade * (0.9 - ((p.r - 1.2) / 2.4) * 0.6);
    ctx.fillRect(Math.round(px), Math.round(py), p.size, p.size);
  }

  // the black center
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // pixel ring around it
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = fade;
  const dots = 36;
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * (R + 1)), Math.round(cy + Math.sin(a) * (R + 1)), 2, 2);
  }
  ctx.globalAlpha = 1;
}

/* ---------- text sucked in / spat out ---------- */
function suckText() {
  const cx = w / 2;
  const cy = h / 2;
  textItems.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2);
    const dy = cy - (r.top + r.height / 2);
    const spin = i % 2 ? -540 : 540;
    el.style.transition =
      "transform 1.25s cubic-bezier(.55,.05,.85,.4) " + i * 0.12 + "s, " +
      "opacity 1.1s ease-in " + (i * 0.12 + 0.15) + "s";
    el.style.transform = "translate(" + dx + "px, " + dy + "px) rotate(" + spin + "deg) scale(0)";
    el.style.opacity = "0";
  });
}

function restoreText() {
  textItems.forEach((el, i) => {
    el.style.transition =
      "transform 1s cubic-bezier(.15,.75,.25,1) " + i * 0.1 + "s, " +
      "opacity .8s ease-out " + i * 0.1 + "s";
    el.style.transform = "";
    el.style.opacity = "";
  });
}

/* ---------- spaceship ---------- */
function followTarget() {
  return {
    x: clamp(pointer.x, 12, w - 12),
    y: clamp(pointer.y - (pointer.touch ? TOUCH_OFFSET : 0), 12, h - 12)
  };
}

function startShip(px, py) {
  // start off-screen on the opposite side of the screen from the pointer
  let dx = px - w / 2;
  let dy = py - h / 2;
  let len = Math.hypot(dx, dy);
  if (len < 1) {
    const a = Math.random() * Math.PI * 2;
    dx = Math.cos(a);
    dy = Math.sin(a);
    len = 1;
  }
  const R = Math.hypot(w, h) / 2 + 60;
  const sx = w / 2 - (dx / len) * R;
  const sy = h / 2 - (dy / len) * R;

  ship = {
    x: sx,
    y: sy,
    angle: Math.atan2(py - sy, px - sx) + Math.PI / 2,
    alpha: 0,
    scale: 0.5,
    age: 0,
    speed: 0,
    state: "in"
  };
}

function turnShip(want, rate, dt) {
  const diff = Math.atan2(Math.sin(want - ship.angle), Math.cos(want - ship.angle));
  ship.angle += diff * (1 - Math.exp(-rate * dt));
}

function updateShip(dt) {
  if (!ship || dt <= 0) return;
  ship.age += dt;
  const prevX = ship.x;
  const prevY = ship.y;
  const f = followTarget();

  if (ship.state === "in") {
    // glide in from off-screen, slowing down smoothly
    const k = 1 - Math.exp(-SHIP_EASE * dt);
    ship.x += (f.x - ship.x) * k;
    ship.y += (f.y - ship.y) * k;

    const dx = f.x - ship.x;
    const dy = f.y - ship.y;
    const dist = Math.hypot(dx, dy);
    turnShip(dist > 80 ? Math.atan2(dy, dx) + Math.PI / 2 : 0, 6, dt);

    const appear = smooth(Math.min(1, ship.age / 0.7));
    ship.alpha = appear;
    ship.scale = 0.5 + 0.5 * appear;

    if (gameState === "arrive" && (dist < 30 || ship.age > 2.6)) {
      ship.state = "play";
      ship.alpha = 1;
      ship.scale = 1;
      startRun();
    }
  } else {
    // follow the pointer and lean into the movement
    const k = 1 - Math.exp(-FOLLOW_EASE * dt);
    ship.x += (f.x - ship.x) * k;
    ship.y += (f.y - ship.y) * k;
    const vx = (ship.x - prevX) / dt;
    turnShip(clamp(vx / 700, -0.45, 0.45), 10, dt);
  }

  ship.speed = Math.hypot(ship.x - prevX, ship.y - prevY) / dt;

  // thruster smoke
  const a = ship.angle;
  const hx = Math.sin(a);
  const hy = -Math.cos(a);
  const energy = Math.min(1, 0.35 + ship.speed / 500);
  smokeAcc += dt * SMOKE_RATE * energy;

  while (smokeAcc >= 1) {
    smokeAcc -= 1;
    if (smoke.length > 450) continue;
    for (const side of [-1, 1]) {
      const lx = side * SHIP_PIXEL * ship.scale;
      const ly = 4.5 * SHIP_PIXEL * ship.scale;
      const back = 40 + Math.random() * 60;
      smoke.push({
        x: ship.x + lx * Math.cos(a) - ly * Math.sin(a),
        y: ship.y + lx * Math.sin(a) + ly * Math.cos(a),
        vx: -hx * back + (Math.random() - 0.5) * 40,
        vy: -hy * back + (Math.random() - 0.5) * 40,
        age: 0,
        life: 0.6 + Math.random() * 0.7,
        size: 2 + Math.random() * 2
      });
    }
  }
}

function drawShip() {
  if (!ship || ship.alpha <= 0) return;
  const S = SHIP_PIXEL;

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  ctx.scale(ship.scale, ship.scale);
  ctx.fillStyle = "#fff";

  // flickering thruster flames
  ctx.globalAlpha = ship.alpha * 0.8;
  for (const side of [-1, 1]) {
    const len = S * (1.2 + Math.random() * 1.5);
    ctx.fillRect(side * S - S / 2, 4.5 * S, S, len);
  }

  // body
  ctx.globalAlpha = ship.alpha;
  for (let r = 0; r < SHIP.length; r++) {
    for (let c = 0; c < SHIP[r].length; c++) {
      if (SHIP[r][c] === "#") {
        ctx.fillRect((c - 4.5) * S, (r - 4.5) * S, S + 0.5, S + 0.5);
      }
    }
  }

  ctx.restore();
}

/* ---------- game logic ---------- */
function spawnInterval(t) {
  return MIN_INTERVAL + (START_INTERVAL - MIN_INTERVAL) * Math.exp(-t / INTERVAL_TAU);
}

function difficulty(t) {
  return 1 - Math.exp(-t / SPEED_TAU);
}

function spawnRock() {
  if (rocks.length > 60) return;

  const d = difficulty(gameTime);
  const sizeScale = clamp(Math.min(w, h) / 500, 0.7, 1.3);
  const speedScale = clamp(Math.hypot(w, h) / 1100, 0.6, 1.4);
  const big = Math.random() < 0.15 + 0.4 * d;
  const r = (big ? 28 + Math.random() * 20 : 9 + Math.random() * 7) * sizeScale;
  const m = r + 30;

  // start just outside a random edge
  let x;
  let y;
  switch (Math.floor(Math.random() * 4)) {
    case 0: x = Math.random() * w; y = -m; break;
    case 1: x = w + m; y = Math.random() * h; break;
    case 2: x = Math.random() * w; y = h + m; break;
    default: x = -m; y = Math.random() * h;
  }

  // aim: random at first, more and more toward the ship later
  const sx = ship ? ship.x : w / 2;
  const sy = ship ? ship.y : h / 2;
  const aim = AIM_BASE + AIM_GAIN * d;
  const rx = Math.random() * w;
  const ry = Math.random() * h;
  const dx = rx + (sx - rx) * aim - x;
  const dy = ry + (sy - ry) * aim - y;
  const len = Math.hypot(dx, dy) || 1;

  const speed = (START_SPEED + SPEED_GAIN * d) * speedScale * (0.8 + Math.random() * 0.5) * (big ? 0.75 : 1);

  // jagged rock shape + a few black craters
  const n = 9;
  const verts = Array.from({ length: n }, () => 0.72 + Math.random() * 0.28);
  const craterCount = big ? 3 : r > 12 * sizeScale ? 1 : 0;
  const craters = Array.from({ length: craterCount }, () => ({
    x: (Math.random() - 0.5) * r * 0.8,
    y: (Math.random() - 0.5) * r * 0.8,
    s: Math.max(2, Math.round(r * 0.18))
  }));

  rocks.push({
    x,
    y,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    r,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 2,
    verts,
    craters,
    alpha: 1,
    fading: false,
    age: 0
  });
}

function clearRocks() {
  for (const k of rocks) k.fading = true;
}

function updateHud() {
  hudTime.textContent = fmt(gameTime);
  hudFill.style.transform = "scaleX(" + Math.min(1, gameTime / GOAL_SECONDS) + ")";
  hudFill.classList.toggle("full", gameTime >= GOAL_SECONDS);
}

function updateGame(dt) {
  if (gameState === "play") {
    gameTime += dt;
    nextRock -= dt;
    while (nextRock <= 0) {
      spawnRock();
      nextRock += spawnInterval(gameTime);
    }
    updateHud();
  }

  for (let i = rocks.length - 1; i >= 0; i--) {
    const k = rocks[i];
    k.age += dt;
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    k.rot += k.vrot * dt;

    if (k.fading) {
      k.alpha -= dt / 0.4;
      if (k.alpha <= 0) {
        rocks.splice(i, 1);
        continue;
      }
    }
    if (k.age > 1 && (k.x < -200 || k.x > w + 200 || k.y < -200 || k.y > h + 200)) {
      rocks.splice(i, 1);
    }
  }

  // collisions
  if (gameState === "play" && ship && ship.state === "play") {
    for (const k of rocks) {
      if (k.fading) continue;
      if (Math.hypot(k.x - ship.x, k.y - ship.y) < k.r * 0.85 + SHIP_HIT) {
        crash();
        break;
      }
    }
  }
}

function drawRocks() {
  for (const k of rocks) {
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.rot);
    ctx.globalAlpha = Math.max(0, k.alpha);

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    for (let i = 0; i < k.verts.length; i++) {
      const a = (i / k.verts.length) * Math.PI * 2;
      const rr = k.r * k.verts[i];
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#000";
    for (const c of k.craters) {
      ctx.fillRect(c.x - c.s / 2, c.y - c.s / 2, c.s, c.s);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* ---------- game flow ---------- */
function beginGame() {
  gameState = "suck";
  ship = null;
  document.body.classList.add("game-active");
  hole.goal = 1;
  suckText();
  setTimeout(() => {
    if (gameState === "suck") beginArrival();
  }, 1700);
}

function beginArrival() {
  gameState = "arrive";
  document.body.classList.add("game-playing");
  gameTime = 0;
  hudBest.textContent = best > 0 ? "best " + fmt(best) : "best --";
  updateHud();
  hud.classList.add("show");
  quitBtn.classList.add("show");
  startShip(pointer.x, pointer.y);
}

function startRun() {
  gameState = "play";
  gameTime = 0;
  nextRock = 1;
}

function crash() {
  explode(ship.x, ship.y);
  explode(ship.x, ship.y);
  ship = null;
  gameState = "over";
  document.body.classList.remove("game-playing");

  const finalTime = gameTime;
  const isBest = finalTime > best;
  if (isBest) {
    best = finalTime;
    saveBest();
  }
  setTimeout(() => showGameOver(finalTime, isBest), 800);
}

function showGameOver(t, isBest) {
  if (gameState !== "over") return;
  goTime.textContent = fmt(t);
  goBest.textContent = isBest ? "new best!" : "best " + fmt(best);
  goEl.classList.add("show");
  goEl.setAttribute("aria-hidden", "false");
}

function hideGameOver() {
  goEl.classList.remove("show");
  goEl.setAttribute("aria-hidden", "true");
}

function playAgain() {
  if (gameState !== "over") return;
  hideGameOver();
  clearRocks();
  beginArrival();
}

function exitGame() {
  // works from the game over screen or mid-game
  if (gameState !== "over" && gameState !== "arrive" && gameState !== "play") return;

  if (ship) {
    explode(ship.x, ship.y);
    ship = null;
  }
  document.body.classList.remove("game-playing");
  hideGameOver();
  hud.classList.remove("show");
  quitBtn.classList.remove("show");
  hole.goal = 0;
  clearRocks();
  restoreText();
  gameState = "restore";
  setTimeout(() => {
    textItems.forEach((el) => { el.style.transition = ""; });
    document.body.classList.remove("game-active");
    gameState = "off";
  }, 1800);
}

/* ---------- main draw loop ---------- */
function draw(time) {
  const t = time / 1000;
  const dt = Math.min(0.05, (time - lastTime) / 1000 || 0);
  lastTime = time;

  offset.x += (target.x - offset.x) * EASING;
  offset.y += (target.y - offset.y) * EASING;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  // background stars
  for (const s of stars) {
    const x = wrap(s.x + offset.x * s.z + t * DRIFT * 60 * s.z, w);
    const y = wrap(s.y + offset.y * s.z, h);
    const twinkle = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);

    ctx.globalAlpha = (0.35 + 0.65 * s.z) * twinkle;
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.round(x), Math.round(y), s.size, s.size);
  }

  // black hole
  drawHole(dt);

  // shooting stars
  if (!reduceMotion) {
    if (time >= nextShot) {
      spawnShooter();
      nextShot = time + SHOT_MIN_DELAY + Math.random() * (SHOT_MAX_DELAY - SHOT_MIN_DELAY);
    }

    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      s.x += s.dirx * s.speed * dt;
      s.y += s.diry * s.speed * dt;

      for (let k = 0; k < s.len; k++) {
        const px = s.x - s.dirx * k * 5;
        const py = s.y - s.diry * k * 5;
        ctx.globalAlpha = 1 - k / s.len;
        ctx.fillStyle = "#fff";
        ctx.fillRect(Math.round(px), Math.round(py), s.size, s.size);
      }

      if (s.x < -80 || s.x > w + 80 || s.y > h + 80) {
        shooters.splice(i, 1);
      }
    }
  }

  // supernova explosions
  ctx.fillStyle = "#fff";
  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i];
    b.age += dt;

    if (b.age < 0.25) {
      const r = (b.age / 0.25) * 40;
      ctx.globalAlpha = 1 - b.age / 0.25;
      ctx.fillRect(Math.round(b.x - r), Math.round(b.y - r), Math.round(r * 2), Math.round(r * 2));
    }

    if (b.age < 0.9) {
      const r = b.age * NOVA_RING_SPEED;
      const dots = 48;
      ctx.globalAlpha = 1 - b.age / 0.9;
      for (let j = 0; j < dots; j++) {
        const a = (j / dots) * Math.PI * 2;
        ctx.fillRect(Math.round(b.x + Math.cos(a) * r), Math.round(b.y + Math.sin(a) * r), 2, 2);
      }
    }

    const friction = Math.pow(0.05, dt);
    for (const p of b.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= friction;
      p.vy *= friction;

      const alpha = 1 - b.age / p.life;
      if (alpha > 0) {
        ctx.globalAlpha = alpha;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
    }

    if (b.age > 1.6) {
      blasts.splice(i, 1);
    }
  }

  // game: asteroids, then ship + smoke
  updateGame(dt);
  drawRocks();
  updateShip(dt);

  ctx.fillStyle = "#fff";
  const drag = Math.pow(0.2, dt);
  for (let i = smoke.length - 1; i >= 0; i--) {
    const p = smoke[i];
    p.age += dt;
    if (p.age >= p.life) {
      smoke.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy *= drag;

    const k = p.age / p.life;
    const size = Math.round(p.size + k * 3);
    ctx.globalAlpha = 0.55 * (1 - k);
    ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
  }

  drawShip();

  ctx.globalAlpha = 1;
  requestAnimationFrame(draw);
}

function setTarget(clientX, clientY) {
  // stars move opposite to the cursor; change the minus signs to plus to flip it
  target.x = -(clientX - w / 2) * STRENGTH;
  target.y = -(clientY - h / 2) * STRENGTH;
}

/* ---------- input: tap/click = supernova, long press on empty space = start game ---------- */
let press = null;
let holdTimer = null;
let suppressClick = false;

function endPress(e, cancelled) {
  clearTimeout(holdTimer);
  if (!press) return;
  const p = press;
  press = null;

  if (p.fired) {
    // don't open a link if the long press started on one
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 150);
  } else if (!p.cancelled && !cancelled && gameState === "off") {
    explode(e.clientX, e.clientY); // short tap or click
  }
}

window.addEventListener("resize", resize);

if (!reduceMotion) {
  window.addEventListener("mousemove", (e) => setTarget(e.clientX, e.clientY));
  window.addEventListener("touchmove", (e) => {
    const touch = e.touches[0];
    setTarget(touch.clientX, touch.clientY);
  }, { passive: true });

  // while playing, stop the page from scrolling under your finger
  window.addEventListener("touchmove", (e) => {
    if (gameState !== "off" && e.cancelable) e.preventDefault();
  }, { passive: false });

  window.addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest("#btn-quit")) return; // exit button

    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.touch = e.pointerType === "touch";

    if (e.target.closest && e.target.closest("#gameover")) return; // game over buttons
    if (gameState !== "off") return;
    if (e.button !== 0) return;      // left click / touch only
    if (press) endPress(e, true);    // safety: finish any stuck press

    // holding on a link never starts the game, so links always work
    const onLink = e.target.closest && e.target.closest(".section .link-box");

    press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, fired: false, cancelled: false };

    if (!onLink) {
      holdTimer = setTimeout(() => {
        if (press && !press.cancelled && gameState === "off") {
          press.fired = true;
          beginGame();
        }
      }, LONG_PRESS);
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (gameState !== "off") {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.touch = e.pointerType === "touch";
    }

    if (!press || e.pointerId !== press.id) return;
    const moved = Math.hypot(e.clientX - press.x0, e.clientY - press.y0);
    if (!press.fired && moved > MOVE_TOLERANCE) {
      press.cancelled = true; // it's a swipe, not a hold
      clearTimeout(holdTimer);
    }
  });

  window.addEventListener("pointerup", (e) => {
    if (press && e.pointerId === press.id) endPress(e, false);
  });

  window.addEventListener("pointercancel", (e) => {
    if (press && e.pointerId === press.id) endPress(e, true);
  });

  // stop the phone's long-press menu (and right-click menu while playing)
  window.addEventListener("contextmenu", (e) => {
    if (press || gameState === "arrive" || gameState === "play") e.preventDefault();
  });

  // swallow the click that follows a long press so links don't open
  window.addEventListener("click", (e) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  btnAgain.addEventListener("click", playAgain);
  btnExit.addEventListener("click", exitGame);
  quitBtn.addEventListener("click", exitGame);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") exitGame();
  });
}

resize();
pointer.x = w / 2;
pointer.y = h * 0.7;
requestAnimationFrame(draw);

/* ---------- typing animation ---------- */
const TEXT = "kkeithmichael";
const START_DELAY = 400;   // wait before typing starts (ms)
const TYPE_SPEED = 140;    // base time per letter (ms)

const typedEl = document.getElementById("typed");
const cursorEl = document.getElementById("cursor");

if (reduceMotion) {
  typedEl.textContent = TEXT;
  cursorEl.classList.remove("solid");
} else {
  let i = 0;

  function typeNext() {
    if (i <= TEXT.length) {
      typedEl.textContent = TEXT.slice(0, i);
      i++;
      setTimeout(typeNext, TYPE_SPEED + Math.random() * 80);
    } else {
      cursorEl.classList.remove("solid"); // start blinking
    }
  }

  setTimeout(typeNext, START_DELAY);
}