// =========================================================
// APP CONFIG — point this at your deployed Cloudflare Worker
// =========================================================
const CONFIG = {
  API_BASE: "https://ahmadiya-survey-worker.YOUR_SUBDOMAIN.workers.dev",
  TURNSTILE_SITE_KEY: "0x4AAAAAAD_b8KTI0Np47kkI",
  MAX_RECORD_SECONDS: 30,
  MAX_FILE_BYTES: 100 * 1024 * 1024,
};

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

let soundEnabled = true;
let audioCtx = null;

function unlockAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
}

/* ============================================================
   TOAST
   ============================================================ */
function toast(msg, ms = 3200) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), ms);
}

/* ============================================================
   INTRO SEQUENCE
   ============================================================ */
function playChime() {
  if (!soundEnabled || !audioCtx || audioCtx.state !== "running") return; // no gesture yet — skip silently, no console warning
  try {
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.65);
  } catch (e) { /* audio not available */ }
}

let introSkipped = false;

async function runIntro() {
  const skip = () => {
    introSkipped = true; // stop the background sequence below from re-running finishIntro()
    finishIntro();
  };
  $("#skipIntro").addEventListener("click", skip);

  const cards = $$(".info-card");
  const seenIntro = sessionStorage.getItem("ahmadiya_intro_seen");
  if (seenIntro) { finishIntro(); return; }

  for (let i = 0; i < cards.length; i++) {
    if (introSkipped) return;
    playChime();
    cards[i].classList.add("show");
    await wait(2600);
    if (introSkipped) return;
    cards[i].classList.remove("show");
    await wait(500);
  }
  if (introSkipped) return;

  const scene = $("#logoScene");
  scene.classList.add("show");
  playChime();
  await wait(3200);
  if (introSkipped) return;

  sessionStorage.setItem("ahmadiya_intro_seen", "1");
  finishIntro();
}

let introFinished = false;

function finishIntro() {
  if (introFinished) return; // guard against double-invocation (e.g. skip + natural completion)
  introFinished = true;

  const intro = $("#intro");
  // Move focus off any element inside #intro (e.g. the Skip button) before
  // hiding it with aria-hidden, otherwise assistive tech gets a focused-but-hidden element.
  if (intro.contains(document.activeElement)) document.activeElement.blur();

  intro.style.transition = "opacity .6s ease";
  intro.style.opacity = "0";
  setTimeout(() => {
    intro.hidden = true;
    intro.setAttribute("aria-hidden", "true");
    $("#app").hidden = false;
    initApp();
    $("#app").setAttribute("tabindex", "-1");
    $("#app").focus({ preventScroll: true });
  }, 620);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================================================
   NAVIGATION (bottom tab bar + views)
   ============================================================ */
function initNav() {
  $$(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

const VIEW_TITLES = {
  survey: "استبيان مركز شباب الأحمدية | التصويت",
  media: "استبيان مركز شباب الأحمدية | سجّل مشاركتك",
  wall: "استبيان مركز شباب الأحمدية | مشاركات الأهالي",
  stats: "استبيان مركز شباب الأحمدية | النتائج المباشرة",
};

function switchView(name) {
  $$(".view").forEach((v) => v.classList.remove("active"));
  $(`#view-${name}`).classList.add("active");
  $$(".tab-btn").forEach((b) => {
    const active = b.dataset.view === name;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.title = VIEW_TITLES[name] || document.title;
  if (name === "wall") loadMediaWall();
}

/* ============================================================
   VOTING — one vote per person, NEVER editable after submit
   ============================================================ */
function initVoting() {
  const form = $("#surveyForm");
  const votedBefore = localStorage.getItem("ahmadiya_voted") === "1";
  if (votedBefore) lockVoteForm(localStorage.getItem("ahmadiya_ip_last4") || "****");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (localStorage.getItem("ahmadiya_voted") === "1") {
      toast("لقد قمت بالتصويت من قبل — لا يمكن التصويت مرة أخرى");
      return;
    }

    const fd = new FormData(form);
    const q1 = fd.get("q1"), q2 = fd.get("q2"), q3 = fd.get("q3");
    if (!q1 || !q2 || !q3) { toast("من فضلك أجب عن جميع الأسئلة"); return; }

    const turnstileToken = window.turnstile
      ? window.turnstile.getResponse()
      : null;

    const submitBtn = $("#submitVoteBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';

    try {
      // The Worker is the ONLY place the real IP is read and hashed.
      // The client never sees or sends its own IP — it is read server-side
      // from the request headers, so it cannot be spoofed from the browser.
      const res = await fetch(`${CONFIG.API_BASE}/api/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q1, q2, q3, turnstileToken }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast(data.message || "تعذّر إرسال التصويت، حاول مرة أخرى");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال التصويت';
        return;
      }

      localStorage.setItem("ahmadiya_voted", "1");
      localStorage.setItem("ahmadiya_ip_last4", data.ipLast4 || "****");
      lockVoteForm(data.ipLast4 || "****");
      toast("تم تسجيل تصويتك بنجاح، شكرًا لمشاركتك");
      confettiBurst();
    } catch (err) {
      toast("حدث خطأ في الاتصال، حاول مرة أخرى");
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال التصويت';
    }
  });
}

function lockVoteForm(ipLast4) {
  const form = $("#surveyForm");
  $$("input", form).forEach((i) => (i.disabled = true));
  form.querySelector("#submitVoteBtn").hidden = true;
  const notice = $("#alreadyVotedNotice");
  notice.hidden = false;
  $("#ipMasked").textContent = `**.**.**.${ipLast4}`;
}

function confettiBurst() {
  if (window.confetti) {
    window.confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 } });
  }
}

/* ============================================================
   MEDIA CAPTURE — video OR voice note, camera/mic only, 30s max
   ============================================================ */
let mediaStream = null;
let recorder = null;
let recordedChunks = [];
let recordTimer = null;
let recordSeconds = 0;
let currentMode = "video"; // "video" | "voice"

function initMediaCapture() {
  $$(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });
  $("#startRec").addEventListener("click", startRecording);
  $("#stopRec").addEventListener("click", stopRecording);
  $("#retakeRec").addEventListener("click", resetCapture);
}

function setMode(mode) {
  currentMode = mode;
  $$(".mode-btn").forEach((b) => {
    const active = b.dataset.mode === mode;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
  $("#cameraPreview").hidden = mode !== "video";
  $("#voiceStage").hidden = mode !== "voice";
  resetCapture();
}

async function startRecording() {
  try {
    const constraints = currentMode === "video"
      ? { video: { facingMode: "user" }, audio: true }
      : { audio: true };
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

    if (currentMode === "video") {
      $("#cameraPreview").srcObject = mediaStream;
    } else {
      $("#voiceOrb").classList.add("recording");
    }

    recordedChunks = [];
    const mimeType = currentMode === "video" ? "video/webm;codecs=vp9,opus" : "audio/webm;codecs=opus";
    recorder = new MediaRecorder(mediaStream, { mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined });
    recorder.ondataavailable = (e) => e.data.size && recordedChunks.push(e.data);
    recorder.onstop = onRecordingStopped;
    recorder.start();

    recordSeconds = 0;
    $("#recTimer").textContent = "00:00";
    recordTimer = setInterval(() => {
      recordSeconds++;
      const m = String(Math.floor(recordSeconds / 60)).padStart(2, "0");
      const s = String(recordSeconds % 60).padStart(2, "0");
      $("#recTimer").textContent = `${m}:${s}`;
      if (recordSeconds >= CONFIG.MAX_RECORD_SECONDS) stopRecording();
    }, 1000);

    $("#startRec").hidden = true;
    $("#stopRec").hidden = false;
  } catch (err) {
    toast("تعذّر الوصول إلى الكاميرا/الميكروفون. يرجى منح الإذن اللازم");
  }
}

function stopRecording() {
  clearInterval(recordTimer);
  if (recorder && recorder.state !== "inactive") recorder.stop();
  if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
  $("#stopRec").hidden = true;
  $("#retakeRec").hidden = false;
}

async function onRecordingStopped() {
  const mime = currentMode === "video" ? "video/webm" : "audio/webm";
  const blob = new Blob(recordedChunks, { type: mime });

  if (blob.size > CONFIG.MAX_FILE_BYTES) {
    toast("حجم الملف أكبر من الحد المسموح (100 ميجابايت)");
    return;
  }

  toast("جاري رفع المشاركة للمراجعة...");
  try {
    const fd = new FormData();
    fd.append("file", blob, currentMode === "video" ? "clip.webm" : "voice.webm");
    fd.append("type", currentMode);

    const res = await fetch(`${CONFIG.API_BASE}/api/upload-media`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (data.success) {
      toast("تم استلام مشاركتك وستظهر بعد المراجعة");
    } else {
      toast(data.message || "تعذّر رفع الملف");
    }
  } catch (err) {
    toast("تعذّر الاتصال بالخادم لرفع الملف");
  }
}

function resetCapture() {
  clearInterval(recordTimer);
  recordSeconds = 0;
  $("#recTimer").textContent = "00:00";
  $("#startRec").hidden = false;
  $("#stopRec").hidden = true;
  $("#retakeRec").hidden = true;
  $("#voiceOrb")?.classList.remove("recording");
}

/* ============================================================
   MEDIA WALL — approved videos + voice notes autoplay in sequence
   ============================================================ */
let wallQueue = [];
let wallIndex = 0;

async function loadMediaWall() {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/media?status=approved`);
    const data = await res.json();
    wallQueue = data.items || [];
  } catch (e) {
    wallQueue = [];
  }

  const wall = $("#mediaWall");
  const empty = $("#wallEmpty");
  wall.innerHTML = "";
  if (!wallQueue.length) {
    wall.appendChild(empty);
    return;
  }

  wallQueue.forEach((item, idx) => {
    const el = document.createElement("div");
    el.className = "media-item";
    el.dataset.index = idx;
    if (item.type === "video") {
      el.innerHTML = `<video muted playsinline preload="metadata" src="${item.url}"></video>`;
    } else {
      el.innerHTML = `<div class="audio-cover"><i class="fa-solid fa-waveform"></i><audio preload="metadata" src="${item.url}"></audio></div>`;
    }
    wall.appendChild(el);
  });

  wallIndex = 0;
  playWallItem(0);
}

function playWallItem(idx) {
  if (!wallQueue.length) return;
  idx = idx % wallQueue.length;
  const items = $$(".media-item");
  items.forEach((it) => {
    const media = it.querySelector("video,audio");
    if (media) { media.pause(); media.currentTime = 0; }
  });
  const target = items[idx];
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", inline: "start" });
  const media = target.querySelector("video,audio");
  if (!media) return;
  media.play().catch(() => {});
  media.onended = () => playWallItem(idx + 1);
}

/* ============================================================
   PWA INSTALL — real standalone app install, not a homescreen shortcut
   ============================================================ */
let deferredInstallPrompt = null;

function initInstallBanner() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  if (isStandalone) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!sessionStorage.getItem("ahmadiya_install_dismissed")) {
      $("#installBanner").hidden = false;
    }
  });

  $("#installBtn").addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === "accepted") toast("تم تثبيت التطبيق بنجاح");
    $("#installBanner").hidden = true;
  });

  $("#dismissInstall").addEventListener("click", () => {
    $("#installBanner").hidden = true;
    sessionStorage.setItem("ahmadiya_install_dismissed", "1");
  });
}

/* ============================================================
   SERVICE WORKER
   ============================================================ */
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

/* ============================================================
   SOUND TOGGLE
   ============================================================ */
function initSoundToggle() {
  $("#soundToggle").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    $("#soundToggle").innerHTML = soundEnabled
      ? '<i class="fa-solid fa-volume-high"></i>'
      : '<i class="fa-solid fa-volume-xmark"></i>';
  });
}

/* ============================================================
   TURNSTILE RENDER
   ============================================================ */
function renderTurnstile() {
  const box = $("#turnstileWidget");
  if (!box || !window.turnstile || CONFIG.TURNSTILE_SITE_KEY.startsWith("REPLACE")) return;
  if (box.dataset.rendered === "1") return; // avoid "already been rendered" error on double init
  box.dataset.rendered = "1";
  window.turnstile.render(box, { sitekey: CONFIG.TURNSTILE_SITE_KEY });
}

/* ============================================================
   WHATSAPP SHARE
   ============================================================ */
function initWhatsappShare() {
  const btn = $("#shareWhatsapp");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const url = location.href.split("#")[0];
    const message =
      `📢 صوتك يهم! شارك رأيك في استبيان مستقبل مركز شباب الأحمدية — ` +
      `دقيقة واحدة بس وتصويتك آمن وسري.\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  });
}

/* ============================================================
   INIT
   ============================================================ */
function initApp() {
  initNav();
  initVoting();
  initMediaCapture();
  initInstallBanner();
  initSoundToggle();
  initWhatsappShare();
  registerServiceWorker();
  renderTurnstile();
}

document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });
document.addEventListener("DOMContentLoaded", runIntro);
