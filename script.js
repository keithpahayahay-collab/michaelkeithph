const canvas = document.getElementById("stars");
const ctx = canvas.getContext("2d");

const STRENGTH = 0.12;   // how far the stars move with the cursor (higher = more)
const EASING = 0.06;     // how smoothly they follow (lower = smoother)
const DRIFT = 0.015;     // slow constant drift, set to 0 to turn off

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let w = 0;
let h = 0;
let stars = [];

const target = { x: 0, y: 0 };
const offset = { x: 0, y: 0 };

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

function wrap(value, max) {
  return ((value % max) + max) % max;
}

function draw(time) {
  const t = time / 1000;

  offset.x += (target.x - offset.x) * EASING;
  offset.y += (target.y - offset.y) * EASING;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  for (const s of stars) {
    const x = wrap(s.x + offset.x * s.z + t * DRIFT * 60 * s.z, w);
    const y = wrap(s.y + offset.y * s.z, h);
    const twinkle = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);

    ctx.globalAlpha = (0.35 + 0.65 * s.z) * twinkle;
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.round(x), Math.round(y), s.size, s.size);
  }
  ctx.globalAlpha = 1;

  requestAnimationFrame(draw);
}

function setTarget(clientX, clientY) {
  // stars move opposite to the cursor; change the minus signs to plus to flip it
  target.x = -(clientX - w / 2) * STRENGTH;
  target.y = -(clientY - h / 2) * STRENGTH;
}

window.addEventListener("resize", resize);

if (!reduceMotion) {
  window.addEventListener("mousemove", (e) => setTarget(e.clientX, e.clientY));
  window.addEventListener("touchmove", (e) => {
    const touch = e.touches[0];
    setTarget(touch.clientX, touch.clientY);
  }, { passive: true });
}

resize();
requestAnimationFrame(draw);