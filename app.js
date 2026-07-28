// =========================================================
// APP CONFIG — point this at your deployed Cloudflare Worker
// =========================================================
const CONFIG = {
  // Cloudflare Worker URL — update this to your actual deployed worker
  API_BASE: "https://markzshabab.studusa05.workers.de",
  TURNSTILE_SITE_KEY: "0x4AAAAAAD_b8KTI0Np47kkI",
  MAX_RECORD_SECONDS: 30,
  MAX_FILE_BYTES: 100 * 1024 * 1024,
  // Site URL used for sharing
  SITE_URL: window.location.origin + window.location.pathname,
};

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

let soundEnabled = true;
let audioCtx = null;
let audioUnlocked = false;

/* ============================================================
   AUDIO — only create/resume after a real user gesture
   ============================================================ */
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  } catch (e) {
    /* audio not supported — nothing to do */
  }
}

/* ============================================================
   TOAST
   ============================================================ */
function toast(msg, ms = 3200) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), ms);
}

/* ============================================================
   INTRO SEQUENCE
   ============================================================ */
function playChime() {
  if (!soundEnabled || !audioCtx || audioCtx.state !== "running") return;
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
  const skipBtn = $("#skipIntro");
  if (!skipBtn) { initApp(); return; }

  const skip = () => {
    introSkipped = true;
    finishIntro();
  };
  skipBtn.addEventListener("click", () => {
    unlockAudio(); // unlock audio on first user gesture
    skip();
  });

  // Also unlock audio on any user interaction during intro
  const introEl = $("#intro");
  introEl.addEventListener("pointerdown", unlockAudio, { once: true });
  introEl.addEventListener("keydown", unlockAudio, { once: true });

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
  if (introFinished) return;
  introFinished = true;

  const intro = $("#intro");

  // 1. Remove focus from any element inside intro to prevent aria-hidden violation
  try {
    if (document.activeElement && intro && intro.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  } catch (e) { /* ignore */ }

  // 2. Mark as hidden for accessibility
  intro.setAttribute("aria-hidden", "true");

  // 3. Fade out intro
  intro.style.transition = "opacity .6s ease";
  intro.style.opacity = "0";

  // 4. After fade completes, show main app and initialize
  setTimeout(() => {
    try {
      intro.hidden = true;
      const app = $("#app");
      app.hidden = false;
      initApp();
      updatePageTitle("survey");
    } catch (e) {
      console.error("finishIntro error:", e);
      // Force show app even on error
      $("#intro").hidden = true;
      $("#app").hidden = false;
      initApp();
    }
  }, 620);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================================================
   PAGE TITLE — update <title> based on active view
   ============================================================ */
const PAGE_TITLES = {
  survey: "استبيان مركز شباب الأحمدية",
  media: "سجّل مشاركتك — مركز شباب الأحمدية",
  wall: "مشاركات الأهالي — مركز شباب الأحمدية",
  stats: "النتائج المباشرة — مركز شباب الأحمدية",
};

function updatePageTitle(viewName) {
  document.title = PAGE_TITLES[viewName] || PAGE_TITLES.survey;
}

/* ============================================================
   NAVIGATION (bottom tab bar + views)
   ============================================================ */
function initNav() {
  $$(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockAudio(); // unlock on any interaction
      switchView(btn.dataset.view);
    });
  });
}

function switchView(name) {
  $$(".view").forEach((v) => v.classList.remove("active"));
  $(`#view-${name}`).classList.add("active");
  $$(".tab-btn").forEach((b) => {
    const active = b.dataset.view === name;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
  updatePageTitle(name);
  if (name === "wall") loadMediaWall();
  // Scroll to top when switching views
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============================================================
   VOTING — one vote per person, NEVER editable after submit
   ============================================================ */
function initVoting() {
  const form = $("#surveyForm");
  if (!form) return;
  const votedBefore = localStorage.getItem("ahmadiya_voted") === "1";
  if (votedBefore) lockVoteForm();

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
      const res = await fetch(`${CONFIG.API_BASE}/api/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q1, q2, q3, turnstileToken }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 409) {
          // Already voted from this network before (e.g. localStorage was cleared)
          localStorage.setItem("ahmadiya_voted", "1");
          lockVoteForm();
          return;
        }
        toast(data.message || "تعذّر إرسال التصويت، حاول مرة أخرى");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال التصويت';
        return;
      }

      localStorage.setItem("ahmadiya_voted", "1");
      lockVoteForm();
      toast("تم تسجيل تصويتك بنجاح، شكرًا لمشاركتك");
      confettiBurst();
    } catch (err) {
      toast("حدث خطأ في الاتصال، حاول مرة أخرى");
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال التصويت';
    }
  });
}

function lockVoteForm() {
  const form = $("#surveyForm");
  if (!form) return;
  $$("input", form).forEach((i) => (i.disabled = true));
  const submitBtn = form.querySelector("#submitVoteBtn");
  if (submitBtn) submitBtn.hidden = true;
  form.hidden = true;

  const notice = $("#alreadyVotedNotice");
  if (notice) {
    notice.hidden = false;
    // Restart entrance + checkmark-draw animation every time it's shown
    notice.classList.remove("play");
    void notice.offsetWidth; // force reflow to restart CSS animation
    notice.classList.add("play");
  }
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
let currentMode = "video";

function initMediaCapture() {
  $$(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });
  const startRec = $("#startRec");
  const stopRec = $("#stopRec");
  const retakeRec = $("#retakeRec");
  if (startRec) startRec.addEventListener("click", startRecording);
  if (stopRec) stopRec.addEventListener("click", stopRecording);
  if (retakeRec) retakeRec.addEventListener("click", resetCapture);
}

function setMode(mode) {
  currentMode = mode;
  $$(".mode-btn").forEach((b) => {
    const active = b.dataset.mode === mode;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
  const cameraPreview = $("#cameraPreview");
  const voiceStage = $("#voiceStage");
  if (cameraPreview) cameraPreview.hidden = mode !== "video";
  if (voiceStage) voiceStage.hidden = mode !== "voice";
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
      $("#voiceOrb")?.classList.add("recording");
    }

    recordedChunks = [];
    const mimeType = currentMode === "video" ? "video/webm;codecs=vp9,opus" : "audio/webm;codecs=opus";
    recorder = new MediaRecorder(mediaStream, { mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined });
    recorder.ondataavailable = (e) => e.data.size && recordedChunks.push(e.data);
    recorder.onstop = onRecordingStopped;
    recorder.start();

    recordSeconds = 0;
    const recTimerEl = $("#recTimer");
    if (recTimerEl) recTimerEl.textContent = "00:00";
    recordTimer = setInterval(() => {
      recordSeconds++;
      const m = String(Math.floor(recordSeconds / 60)).padStart(2, "0");
      const s = String(recordSeconds % 60).padStart(2, "0");
      const recTimerEl = $("#recTimer");
      if (recTimerEl) recTimerEl.textContent = `${m}:${s}`;
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
  const stopRec = $("#stopRec");
  const retakeRec = $("#retakeRec");
  if (stopRec) stopRec.hidden = true;
  if (retakeRec) retakeRec.hidden = false;
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
  const recTimerEl = $("#recTimer");
  if (recTimerEl) recTimerEl.textContent = "00:00";
  const startRec = $("#startRec");
  const stopRec = $("#stopRec");
  const retakeRec = $("#retakeRec");
  if (startRec) startRec.hidden = false;
  if (stopRec) stopRec.hidden = true;
  if (retakeRec) retakeRec.hidden = true;
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
  if (!wall) return;
  wall.innerHTML = "";
  if (!wallQueue.length) {
    const emptyEl = empty ? empty.cloneNode(true) : null;
    if (emptyEl) {
      emptyEl.removeAttribute("hidden");
      wall.appendChild(emptyEl);
    }
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
   PWA INSTALL — real standalone app install
   ============================================================ */
let deferredInstallPrompt = null;
let installPromptUsed = false;

function detectPlatform() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isAndroid = /Android/.test(ua);
  return { isIOS, isSafari, isAndroid };
}

function showManualInstallInstructions() {
  const { isIOS, isAndroid } = detectPlatform();
  let msg;
  if (isIOS) {
    msg = "لتثبيت التطبيق: اضغط زر المشاركة ⬆️ في متصفح Safari، ثم اختر «إضافة إلى الشاشة الرئيسية»";
  } else if (isAndroid) {
    msg = "لتثبيت التطبيق: افتح قائمة المتصفح (⋮) واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»";
  } else {
    msg = "لتثبيت التطبيق: افتح قائمة المتصفح واختر «تثبيت» أو «إضافة إلى الشاشة الرئيسية»";
  }
  toast(msg, 5500);
}

function initInstallBanner() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  if (isStandalone) return;

  const banner = $("#installBanner");
  const { isIOS } = detectPlatform();

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (banner && !sessionStorage.getItem("ahmadiya_install_dismissed")) {
      banner.hidden = false;
      banner.classList.add("show");
    }
  });

  // Browsers that never fire beforeinstallprompt (iOS Safari, some in-app
  // browsers) would otherwise never show the banner at all. Show it anyway
  // after a short delay so tapping it always gives the person useful steps.
  if (isIOS && banner && !sessionStorage.getItem("ahmadiya_install_dismissed")) {
    setTimeout(() => {
      if (!banner.hidden) return;
      banner.hidden = false;
      banner.classList.add("show");
    }, 3500);
  }

  const installBtn = $("#installBtn");
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      // Always respond — never fail silently
      if (deferredInstallPrompt && !installPromptUsed) {
        installPromptUsed = true;
        try {
          deferredInstallPrompt.prompt();
          const choice = await deferredInstallPrompt.userChoice;
          if (choice.outcome === "accepted") {
            toast("تم تثبيت التطبيق بنجاح");
            if (banner) banner.hidden = true;
          } else {
            toast("تم إلغاء التثبيت — يمكنك المحاولة مرة أخرى في أي وقت");
          }
        } catch (err) {
          showManualInstallInstructions();
        } finally {
          deferredInstallPrompt = null;
        }
      } else {
        // No native prompt available on this browser/platform — guide manually
        showManualInstallInstructions();
      }
    });
  }

  const dismissInstall = $("#dismissInstall");
  if (dismissInstall) {
    dismissInstall.addEventListener("click", () => {
      if (banner) { banner.classList.remove("show"); banner.hidden = true; }
      sessionStorage.setItem("ahmadiya_install_dismissed", "1");
    });
  }
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
  const soundToggle = $("#soundToggle");
  if (!soundToggle) return;
  soundToggle.addEventListener("click", () => {
    unlockAudio();
    soundEnabled = !soundEnabled;
    soundToggle.innerHTML = soundEnabled
      ? '<i class="fa-solid fa-volume-high"></i>'
      : '<i class="fa-solid fa-volume-xmark"></i>';
  });
}

/* ============================================================
   WHATSAPP SHARE
   ============================================================ */
const WA_MESSAGE = `*السلام عليكم* 🌙

من أجل بلدنا *الأحمدية* أردنا معرفة رأيك في هذا الاستبيان 🏘️

🔗 رابط الاستبيان:
${window.location.origin + window.location.pathname}

شارك رأيك وصوتك — صوتك يهم! 🗳️`;

function initWhatsAppShare() {
  const waBtn = $("#whatsappShareBtn");
  const waModal = $("#whatsappModal");
  if (!waBtn || !waModal) return;

  waBtn.addEventListener("click", () => {
    // Set preview text
    const previewEl = $("#waPreviewText");
    if (previewEl) previewEl.innerHTML = WA_MESSAGE.replace(/\n/g, "<br>");

    // Set direct link
    const directLink = $("#waDirectLink");
    if (directLink) {
      const encodedMsg = encodeURIComponent(WA_MESSAGE);
      directLink.href = `https://wa.me/?text=${encodedMsg}`;
    }

    waModal.hidden = false;
    waModal.setAttribute("aria-hidden", "false");
  });

  // Close modal handlers
  const closeBtns = $$("[data-close-modal]", waModal);
  closeBtns.forEach((btn) => {
    btn.addEventListener("click", () => closeWaModal(waModal));
  });
  waModal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeWaModal(waModal);
  });

  // Copy message
  const copyBtn = $("#waCopyBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(WA_MESSAGE);
        toast("تم نسخ الرسالة بنجاح! الصقها في واتساب");
      } catch {
        // Fallback for older browsers
        const ta = document.createElement("textarea");
        ta.value = WA_MESSAGE;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast("تم نسخ الرسالة بنجاح! الصقها في واتساب");
      }
    });
  }

  // Native share
  const shareBtn = $("#waShareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: "استبيان مركز شباب الأحمدية",
            text: WA_MESSAGE,
            url: CONFIG.SITE_URL,
          });
        } catch (e) {
          // User cancelled or share failed — silent
        }
      } else {
        toast("متصفحك لا يدعم المشاركة المباشرة. استخدم زر النسخ أو زر واتساب المباشر.");
      }
    });
  }
}

function closeWaModal(modal) {
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

/* ============================================================
   TURNSTILE RENDER
   ============================================================ */
function renderTurnstile() {
  const box = $("#turnstileWidget");
  if (!box || !window.turnstile || CONFIG.TURNSTILE_SITE_KEY.startsWith("REPLACE")) return;
  if (box.dataset.rendered === "1") return;
  box.dataset.rendered = "1";
  window.turnstile.render(box, { sitekey: CONFIG.TURNSTILE_SITE_KEY });
}

/* ============================================================
   INIT
   ============================================================ */
function initApp() {
  try {
    initNav();
    initVoting();
    initMediaCapture();
    initInstallBanner();
    initSoundToggle();
    initWhatsAppShare();
    registerServiceWorker();
    renderTurnstile();
  } catch (e) {
    console.error("initApp error:", e);
  }
}

// Unlock audio on ANY user gesture (not just during intro)
document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });

// Safety net: force-show the app after 20 seconds no matter what
// This ensures the app is always accessible even if intro fails
setTimeout(() => {
  if (!introFinished) {
    console.warn("Safety net: forcing app to show after timeout");
    introSkipped = true;
    finishIntro();
  }
}, 20000);

document.addEventListener("DOMContentLoaded", () => {
  try {
    runIntro();
  } catch (e) {
    console.error("runIntro error:", e);
    // If intro fails entirely, show the app directly
    finishIntro();
  }
});
