// =========================================================
// AMBIENT ANIMATIONS — floating particles + GSAP micro-interactions
// Lightweight canvas particle field (no external particles.js needed
// for this effect — keeps payload small; swap in particles.js easily
// if you want denser fields).
// =========================================================

function initParticleField(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = container.clientWidth || window.innerWidth;
    canvas.height = container.clientHeight || window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const COUNT = 46;
  const particles = Array.from({ length: COUNT }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 2 + 0.6,
    vy: Math.random() * 0.4 + 0.08,
    vx: (Math.random() - 0.5) * 0.2,
    a: Math.random() * 0.5 + 0.15,
  }));

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.y -= p.vy;
      p.x += p.vx;
      if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(22,199,154,${p.a})`;
      ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  tick();
}

// Subtle GSAP hover/press feedback for premium "haptic-like" feel
function initMicroInteractions() {
  if (!window.gsap) return;
  document.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("button, .choice, .chip, .media-item");
    if (!btn) return;
    gsap.fromTo(btn, { scale: 1 }, { scale: 0.96, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut" });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initParticleField("particles-intro");
  initMicroInteractions();
});
