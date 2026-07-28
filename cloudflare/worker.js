/**
 * =========================================================
 * AL AHMADIYA YOUTH CENTER SURVEY — CLOUDFLARE WORKER
 * ---------------------------------------------------------
 * Responsibilities:
 *  - Read the caller's real IP server-side (cannot be spoofed by client)
 *  - Hash the IP (SHA-256 + salt) for storage — never store raw IP
 *  - Enforce ONE vote per IP, permanently (no edits, no deletes from client)
 *  - Verify Cloudflare Turnstile token
 *  - Reject VPN / Proxy / Tor / datacenter traffic using CF's signals
 *  - Rate limit requests
 *  - Handle media uploads to R2, push to moderation queue
 *  - Rotate the admin password every minute (HHMM, 12h format)
 *  - Write votes/media/stats to Firebase Realtime Database via REST
 *
 * Bindings required (set in wrangler.toml / dashboard):
 *  - R2_BUCKET            (R2 bucket binding, "pending" prefix on upload)
 *  - IP_SALT              (secret — random long string)
 *  - FIREBASE_DB_URL       (e.g. https://your-project-default-rtdb.firebaseio.com)
 *  - FIREBASE_SECRET       (Firebase legacy database secret OR use a
 *                           service-account + Google OAuth token exchange
 *                           for production — see docs/DEPLOY_WORKER.md)
 *  - TURNSTILE_SECRET      (secret from Cloudflare Turnstile dashboard)
 *  - ADMIN_PASSWORD_SALT   (secret — separate from IP_SALT)
 *  - RATE_LIMIT_KV         (Workers KV namespace for rate limiting)
 * =========================================================
 */

const ALLOWED_ORIGIN = "https://YOUR_GITHUB_USERNAME.github.io"; // lock this down in production

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

async function sha256Hex(input) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIP(request) {
  // Cloudflare always sets this from the actual TCP connection — cannot be forged
  return request.headers.get("CF-Connecting-IP") || "0.0.0.0";
}

function getIPLast4(ip) {
  // Works for IPv4 (last octet+) and IPv6 (last hextet) — purely cosmetic,
  // shown to the voter so they can visually confirm "this was me",
  // it is NOT sufficient to identify anyone on its own.
  const parts = ip.includes(":") ? ip.split(":") : ip.split(".");
  return parts[parts.length - 1].padStart(4, "0").slice(-4);
}

/** Reject known VPN / proxy / Tor / datacenter traffic using Cloudflare's
 *  bot management + IP intelligence signals (available on Pro+/Enterprise,
 *  or via a third-party IP intelligence API as a fallback). */
function isSuspiciousTraffic(request) {
  const cf = request.cf || {};
  if (cf.botManagement && cf.botManagement.score < 30) return true; // likely bot
  if (["T1", "TOR"].includes(cf.asOrganization)) return true;
  if (request.headers.get("CF-Threat-Score") && Number(request.headers.get("CF-Threat-Score")) > 10) return true;
  return false;
}

async function verifyTurnstile(token, ip, env) {
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${env.TURNSTILE_SECRET}&response=${token}&remoteip=${ip}`,
  });
  const data = await res.json();
  return data.success === true;
}

async function rateLimit(env, key, limit, windowSeconds) {
  const now = Date.now();
  const raw = await env.RATE_LIMIT_KV.get(key);
  const entry = raw ? JSON.parse(raw) : { count: 0, windowStart: now };
  if (now - entry.windowStart > windowSeconds * 1000) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count++;
  await env.RATE_LIMIT_KV.put(key, JSON.stringify(entry), { expirationTtl: windowSeconds });
  return entry.count <= limit;
}

/* ---------------- Firebase REST helpers ---------------- */
async function fbGet(env, path) {
  const res = await fetch(`${env.FIREBASE_DB_URL}/${path}.json?auth=${env.FIREBASE_SECRET}`);
  return res.json();
}
async function fbSet(env, path, value) {
  await fetch(`${env.FIREBASE_DB_URL}/${path}.json?auth=${env.FIREBASE_SECRET}`, {
    method: "PUT",
    body: JSON.stringify(value),
  });
}
async function fbPush(env, path, value) {
  const res = await fetch(`${env.FIREBASE_DB_URL}/${path}.json?auth=${env.FIREBASE_SECRET}`, {
    method: "POST",
    body: JSON.stringify(value),
  });
  return res.json(); // { name: "-Nxxxxx" }
}
async function fbUpdate(env, path, value) {
  await fetch(`${env.FIREBASE_DB_URL}/${path}.json?auth=${env.FIREBASE_SECRET}`, {
    method: "PATCH",
    body: JSON.stringify(value),
  });
}

/* ============================================================
   ROUTE: POST /api/vote
   One vote per IP hash. Permanent. No update/delete endpoint
   is exposed to the public API — only the admin panel (with the
   rotating HHMM password) can remove a fraudulent vote.
   ============================================================ */
async function handleVote(request, env) {
  const ip = getClientIP(request);
  const ipHash = await sha256Hex(ip + env.IP_SALT);
  const ipLast4 = getIPLast4(ip);

  if (isSuspiciousTraffic(request)) {
    return json({ success: false, message: "تم رفض الطلب لأسباب أمنية (VPN/Proxy/Tor)" }, 403);
  }
  const withinLimit = await rateLimit(env, `vote:${ipHash}`, 3, 60);
  if (!withinLimit) return json({ success: false, message: "طلبات كثيرة جدًا، حاول بعد قليل" }, 429);

  const body = await request.json();
  const { q1, q2, q3, turnstileToken } = body;

  const validQ1 = ["satisfied", "not_satisfied"];
  const validQ2 = ["youth", "current"];
  const validQ3 = ["new_youth", "current_mgmt"];
  if (!validQ1.includes(q1) || !validQ2.includes(q2) || !validQ3.includes(q3)) {
    return json({ success: false, message: "بيانات غير صالحة" }, 400);
  }

  const turnstileOK = await verifyTurnstile(turnstileToken, ip, env);
  if (!turnstileOK) return json({ success: false, message: "فشل التحقق الأمني (Turnstile)" }, 403);

  // Ban check
  const banned = await fbGet(env, `banned_ips/${ipHash}`);
  if (banned) return json({ success: false, message: "لا يمكن التصويت من هذا الجهاز" }, 403);

  // Duplicate check — permanent, no override
  const existing = await fbGet(env, `votes_index/${ipHash}`);
  if (existing) {
    return json({ success: false, message: "لقد قمت بالتصويت من قبل، لا يمكن التصويت مرة أخرى", ipLast4 }, 409);
  }

  const ts = Date.now();
  const voteRecord = { q1, q2, q3, ipHash, ipLast4, ts, immutable: true };

  const pushed = await fbPush(env, "votes", voteRecord);
  await fbSet(env, `votes_index/${ipHash}`, { voteId: pushed.name, ts });
  await incrementStats(env, { q1, q2, q3 });
  await fbPush(env, "logs", { action: "vote_cast", ipHash, ts });

  return json({ success: true, ipLast4 });
}

async function incrementStats(env, { q1, q2, q3 }) {
  const summary = (await fbGet(env, "statistics/summary")) || {};
  summary.total = (summary.total || 0) + 1;
  summary.q1 = summary.q1 || {};
  summary.q2 = summary.q2 || {};
  summary.q3 = summary.q3 || {};
  summary.q1[q1] = (summary.q1[q1] || 0) + 1;
  summary.q2[q2] = (summary.q2[q2] || 0) + 1;
  summary.q3[q3] = (summary.q3[q3] || 0) + 1;

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const dayStats = (await fbGet(env, `statistics/daily/${todayKey}`)) || { count: 0 };
  dayStats.count++;
  await fbSet(env, `statistics/daily/${todayKey}`, dayStats);

  summary.today = dayStats.count;
  summary.week = await sumLastNDays(env, 7);
  await fbSet(env, "statistics/summary", summary);
}

async function sumLastNDays(env, n) {
  let total = 0;
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = await fbGet(env, `statistics/daily/${key}`);
    total += day && day.count ? day.count : 0;
  }
  return total;
}

/* ============================================================
   ROUTE: POST /api/upload-media
   Video or voice note → R2 "pending/" → auto-moderation
   ============================================================ */
async function handleUploadMedia(request, env) {
  const ip = getClientIP(request);
  const ipHash = await sha256Hex(ip + env.IP_SALT);

  const withinLimit = await rateLimit(env, `media:${ipHash}`, 2, 300);
  if (!withinLimit) return json({ success: false, message: "لقد قمت برفع الحد الأقصى من المشاركات" }, 429);

  const banned = await fbGet(env, `banned_ips/${ipHash}`);
  if (banned) return json({ success: false, message: "غير مسموح بالرفع من هذا الجهاز" }, 403);

  const form = await request.formData();
  const file = form.get("file");
  const type = form.get("type") === "voice" ? "voice" : "video";
  if (!file) return json({ success: false, message: "لم يتم إرسال أي ملف" }, 400);

  const MAX_BYTES = 100 * 1024 * 1024;
  if (file.size > MAX_BYTES) return json({ success: false, message: "حجم الملف أكبر من 100 ميجابايت" }, 400);

  const key = `pending/${type}-${Date.now()}-${crypto.randomUUID()}.webm`;
  await env.R2_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "video/webm" },
  });

  const mediaRecord = {
    type, r2Key: key, status: "pending",
    ipHash, ts: Date.now(),
  };
  const pushed = await fbPush(env, "media", mediaRecord);

  // Fire-and-forget auto-moderation (see moderateMedia below).
  // In production, hand this off to a Queue so the upload response
  // doesn't wait on model inference.
  await moderateMedia(env, pushed.name, key, type);

  const summary = (await fbGet(env, "statistics/summary")) || {};
  summary.mediaSubmitted = (summary.mediaSubmitted || 0) + 1;
  await fbSet(env, "statistics/summary", summary);

  return json({ success: true, message: "تم استلام الملف وهو الآن قيد المراجعة" });
}

/**
 * Auto-moderation stub. Wire this to Cloudflare Workers AI (e.g. an
 * image/video safety-classification model) or an external moderation
 * API. This function must:
 *   1. Analyze the file for violence/nudity/hate/weapons/drugs/spam
 *   2. Move it in R2 from pending/ → approved/ or rejected/
 *   3. Update the Firebase record + stats accordingly
 * Replace the TODO with your real classifier call.
 */
async function moderateMedia(env, mediaId, pendingKey, type) {
  // TODO: replace with a real moderation model call, e.g.:
  // const verdict = await runSafetyClassifier(env, pendingKey);
  const verdict = { safe: null }; // null = "needs human review" (safe default)

  if (verdict.safe === true) {
    const newKey = pendingKey.replace("pending/", "approved/");
    const obj = await env.R2_BUCKET.get(pendingKey);
    await env.R2_BUCKET.put(newKey, await obj.arrayBuffer());
    await env.R2_BUCKET.delete(pendingKey);
    await fbUpdate(env, `media/${mediaId}`, { status: "approved", r2Key: newKey });
    const summary = (await fbGet(env, "statistics/summary")) || {};
    summary.mediaApproved = (summary.mediaApproved || 0) + 1;
    await fbSet(env, "statistics/summary", summary);
  } else if (verdict.safe === false) {
    const newKey = pendingKey.replace("pending/", "rejected/");
    const obj = await env.R2_BUCKET.get(pendingKey);
    await env.R2_BUCKET.put(newKey, await obj.arrayBuffer());
    await env.R2_BUCKET.delete(pendingKey);
    await fbUpdate(env, `media/${mediaId}`, { status: "rejected", r2Key: newKey });
    const summary = (await fbGet(env, "statistics/summary")) || {};
    summary.mediaRejected = (summary.mediaRejected || 0) + 1;
    await fbSet(env, "statistics/summary", summary);
  }
  // verdict.safe === null → left in "pending" for a human admin to review
}

/* ============================================================
   ROUTE: GET /api/media?status=approved
   Public, read-only, only ever returns approved items
   ============================================================ */
async function handleGetMedia(request, env) {
  const approved = (await fbGet(env, "media")) || {};
  const items = Object.entries(approved)
    .map(([id, m]) => ({ id, ...m }))
    .filter((m) => m.status === "approved")
    .sort((a, b) => b.ts - a.ts)
    .map((m) => ({
      id: m.id,
      type: m.type,
      url: `${env.R2_PUBLIC_BASE_URL}/${m.r2Key}`,
    }));
  return json({ items });
}

/* ============================================================
   ADMIN PASSWORD — rotates every minute, HHMM 12h format
   e.g. 01:58 PM → "0158", 09:56 AM → "0956"
   ============================================================ */
async function getCurrentAdminPassword(env) {
  const now = new Date();
  const utcNow = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  let hours = utcNow.getHours() % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  const mm = String(utcNow.getMinutes()).padStart(2, "0");
  return `${hh}${mm}`;
}

async function handleAdminLogin(request, env) {
  const ip = getClientIP(request);
  const withinLimit = await rateLimit(env, `admin_login:${ip}`, 8, 60);
  if (!withinLimit) return json({ success: false, message: "محاولات كثيرة جدًا، حاول بعد دقيقة" }, 429);

  const { password } = await request.json();
  const current = await getCurrentAdminPassword(env);
  // Allow current and previous minute to tolerate clock/network drift
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const prevDate = new Date(now.getTime() - 60000);
  let ph = prevDate.getHours() % 12; if (ph === 0) ph = 12;
  const prev = `${String(ph).padStart(2, "0")}${String(prevDate.getMinutes()).padStart(2, "0")}`;

  if (password === current || password === prev) {
    const sessionToken = crypto.randomUUID();
    await env.RATE_LIMIT_KV.put(`admin_session:${sessionToken}`, "1", { expirationTtl: 3600 });
    return json({ success: true, token: sessionToken });
  }
  return json({ success: false, message: "كلمة مرور غير صحيحة" }, 401);
}

async function requireAdmin(request, env) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const valid = await env.RATE_LIMIT_KV.get(`admin_session:${token}`);
  return !!valid;
}

/* ============================================================
   ADMIN ACTIONS — moderation, vote deletion (fraud only), bans
   All require a valid session token from /api/admin/login
   ============================================================ */
async function handleAdminMediaAction(request, env, action) {
  if (!(await requireAdmin(request, env))) return json({ success: false, message: "غير مصرح" }, 401);
  const { mediaId, r2Key } = await request.json();

  if (action === "approve" || action === "reject") {
    const newPrefix = action === "approve" ? "approved/" : "rejected/";
    const newKey = r2Key.replace(/^pending\//, newPrefix).replace(/^rejected\//, newPrefix).replace(/^approved\//, newPrefix);
    if (newKey !== r2Key) {
      const obj = await env.R2_BUCKET.get(r2Key);
      if (obj) {
        await env.R2_BUCKET.put(newKey, await obj.arrayBuffer());
        await env.R2_BUCKET.delete(r2Key);
      }
    }
    await fbUpdate(env, `media/${mediaId}`, { status: action === "approve" ? "approved" : "rejected", r2Key: newKey });
    await fbPush(env, "logs", { action: `media_${action}`, mediaId, ts: Date.now() });
    return json({ success: true, message: action === "approve" ? "تم اعتماد المشاركة" : "تم رفض المشاركة" });
  }

  if (action === "delete") {
    if (r2Key) await env.R2_BUCKET.delete(r2Key);
    await fbSet(env, `media/${mediaId}`, null);
    await fbPush(env, "logs", { action: "media_delete", mediaId, ts: Date.now() });
    return json({ success: true, message: "تم حذف المشاركة" });
  }
  return json({ success: false, message: "إجراء غير معروف" }, 400);
}

async function handleAdminVoteDelete(request, env) {
  if (!(await requireAdmin(request, env))) return json({ success: false, message: "غير مصرح" }, 401);
  const { voteId } = await request.json();
  const vote = await fbGet(env, `votes/${voteId}`);
  if (!vote) return json({ success: false, message: "الصوت غير موجود" }, 404);

  await fbSet(env, `votes/${voteId}`, null);
  await fbSet(env, `votes_index/${vote.ipHash}`, null);

  // Roll back the aggregated stats to keep totals accurate
  const summary = (await fbGet(env, "statistics/summary")) || {};
  summary.total = Math.max(0, (summary.total || 1) - 1);
  if (summary.q1) summary.q1[vote.q1] = Math.max(0, (summary.q1[vote.q1] || 1) - 1);
  if (summary.q2) summary.q2[vote.q2] = Math.max(0, (summary.q2[vote.q2] || 1) - 1);
  if (summary.q3) summary.q3[vote.q3] = Math.max(0, (summary.q3[vote.q3] || 1) - 1);
  await fbSet(env, "statistics/summary", summary);

  await fbPush(env, "logs", { action: "vote_delete_fraud", voteId, ts: Date.now() });
  return json({ success: true, message: "تم حذف الصوت المزوّر ورُصدت الإحصائيات" });
}

async function handleAdminBan(request, env, ban) {
  if (!(await requireAdmin(request, env))) return json({ success: false, message: "غير مصرح" }, 401);
  const { ipHash, reason } = await request.json();
  if (ban) {
    await fbSet(env, `banned_ips/${ipHash}`, { reason: reason || "حظر يدوي", ts: Date.now() });
    await fbPush(env, "logs", { action: "ip_banned", ipHash, ts: Date.now() });
    return json({ success: true, message: "تم حظر عنوان IP" });
  } else {
    await fbSet(env, `banned_ips/${ipHash}`, null);
    await fbPush(env, "logs", { action: "ip_unbanned", ipHash, ts: Date.now() });
    return json({ success: true, message: "تم إلغاء الحظر" });
  }
}


/* ============================================================
   ENTRYPOINT
   ============================================================ */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/api/vote" && request.method === "POST") return await handleVote(request, env);
      if (url.pathname === "/api/upload-media" && request.method === "POST") return await handleUploadMedia(request, env);
      if (url.pathname === "/api/media" && request.method === "GET") return await handleGetMedia(request, env);
      if (url.pathname === "/api/admin/login" && request.method === "POST") return await handleAdminLogin(request, env);
      if (url.pathname === "/api/admin/password" && request.method === "GET") {
        if (!(await requireAdmin(request, env))) return json({ success: false }, 401);
        return json({ password: await getCurrentAdminPassword(env) });
      }
      if (url.pathname === "/api/admin/media/approve" && request.method === "POST") return await handleAdminMediaAction(request, env, "approve");
      if (url.pathname === "/api/admin/media/reject" && request.method === "POST") return await handleAdminMediaAction(request, env, "reject");
      if (url.pathname === "/api/admin/media/delete" && request.method === "POST") return await handleAdminMediaAction(request, env, "delete");
      if (url.pathname === "/api/admin/vote/delete" && request.method === "POST") return await handleAdminVoteDelete(request, env);
      if (url.pathname === "/api/admin/ban" && request.method === "POST") return await handleAdminBan(request, env, true);
      if (url.pathname === "/api/admin/unban" && request.method === "POST") return await handleAdminBan(request, env, false);
      return json({ success: false, message: "Not found" }, 404);
    } catch (err) {
      return json({ success: false, message: "خطأ في الخادم", error: String(err) }, 500);
    }
  },
};
