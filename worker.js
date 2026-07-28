// =========================================================
// CLOUDFLARE WORKER — Updated for CORS flexibility + safety
// =========================================================

// Allow requests from your GitHub Pages site (update to your actual domain)
// In development, you can use "*" to allow all origins
const ALLOWED_ORIGINS = [
  "https://elahmadya.pages.dev",
  // Add your GitHub Pages URL here, e.g.:
  // "https://YOUR_USERNAME.github.io",
];

function corsHeaders(origin) {
  // If origin is in allowed list, reflect it. Otherwise use a safe default.
  const allowed = ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*");
  return {
    "Access-Control-Allow-Origin": allowed ? (ALLOWED_ORIGINS.includes("*") ? "*" : origin) : "null",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function sha256Hex(input) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIP(request) {
  return request.headers.get("CF-Connecting-IP") || "0.0.0.0";
}

function getIPLast4(ip) {
  const parts = ip.includes(":") ? ip.split(":") : ip.split(".");
  return parts[parts.length - 1].padStart(4, "0").slice(-4);
}

/**
 * Reduces a raw User-Agent string to a short, non-identifying summary
 * (device family + browser) purely to help the admin tell voters apart
 * in the dashboard — never stored or shown as raw UA.
 */
function summarizeUserAgent(ua) {
  if (!ua) return "غير معروف";
  const device = /iPhone/i.test(ua) ? "iPhone"
    : /iPad/i.test(ua) ? "iPad"
    : /Android/i.test(ua) ? "أندرويد"
    : /Macintosh/i.test(ua) ? "ماك"
    : /Windows/i.test(ua) ? "ويندوز"
    : "جهاز غير معروف";
  const browser = /EdgA|Edge|Edg\//i.test(ua) ? "Edge"
    : /CriOS|Chrome/i.test(ua) ? "Chrome"
    : /FxiOS|Firefox/i.test(ua) ? "Firefox"
    : /Version\/.*Safari/i.test(ua) ? "Safari"
    : "متصفح آخر";
  return `${device} · ${browser}`;
}

/**
 * Suspicious traffic detection — only active on Cloudflare Pro+/Enterprise
 * where cf.botManagement and CF-Threat-Score are available.
 * On Free plan, this function returns false (allows all traffic).
 */
function isSuspiciousTraffic(request) {
  try {
    const cf = request.cf || {};
    // Only check if botManagement is available (Pro+/Enterprise)
    if (cf.botManagement && cf.botManagement.score !== undefined) {
      if (cf.botManagement.score < 30) return true;
    }
    // Tor detection (available on all plans)
    if (cf.asOrganization && ["T1", "TOR"].includes(cf.asOrganization)) return true;
    // Threat score (may not exist on Free plan)
    const threatScore = request.headers.get("CF-Threat-Score");
    if (threatScore && Number(threatScore) > 10) return true;
  } catch (e) {
    // If anything fails, don't block the request
  }
  return false;
}

async function verifyTurnstile(token, ip, env) {
  if (!token || !env.TURNSTILE_SECRET) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${env.TURNSTILE_SECRET}&response=${token}&remoteip=${ip}`,
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    return false;
  }
}

async function rateLimit(env, key, limit, windowSeconds) {
  try {
    if (!env.RATE_LIMIT_KV) return true; // if KV not bound, allow all
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
  } catch (e) {
    return true; // if rate limiting fails, don't block
  }
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
  return res.json();
}
async function fbUpdate(env, path, value) {
  await fetch(`${env.FIREBASE_DB_URL}/${path}.json?auth=${env.FIREBASE_SECRET}`, {
    method: "PATCH",
    body: JSON.stringify(value),
  });
}

/* ============================================================
   ROUTE: POST /api/vote
   ============================================================ */
async function handleVote(request, env, origin) {
  const ip = getClientIP(request);
  const ipHash = await sha256Hex(ip + env.IP_SALT);
  const ipLast4 = getIPLast4(ip);

  if (isSuspiciousTraffic(request)) {
    return json({ success: false, message: "تم رفض الطلب لأسباب أمنية (VPN/Proxy/Tor)" }, 403, origin);
  }
  const withinLimit = await rateLimit(env, `vote:${ipHash}`, 3, 60);
  if (!withinLimit) return json({ success: false, message: "طلبات كثيرة جدًا، حاول بعد قليل" }, 429, origin);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ success: false, message: "بيانات غير صالحة" }, 400, origin);
  }
  const { q1, q2, q3, turnstileToken } = body;

  const validQ1 = ["satisfied", "not_satisfied"];
  const validQ2 = ["youth", "current"];
  const validQ3 = ["new_youth", "current_mgmt"];
  if (!validQ1.includes(q1) || !validQ2.includes(q2) || !validQ3.includes(q3)) {
    return json({ success: false, message: "بيانات غير صالحة" }, 400, origin);
  }

  const turnstileOK = await verifyTurnstile(turnstileToken, ip, env);
  if (!turnstileOK) return json({ success: false, message: "فشل التحقق الأمني (Turnstile)" }, 403, origin);

  // Ban check
  const banned = await fbGet(env, `banned_ips/${ipHash}`);
  if (banned) return json({ success: false, message: "لا يمكن التصويت من هذا الجهاز" }, 403, origin);

  // Duplicate check
  const existing = await fbGet(env, `votes_index/${ipHash}`);
  if (existing) {
    return json({ success: false, message: "لقد قمت بالتصويت من قبل، لا يمكن التصويت مرة أخرى", ipLast4 }, 409, origin);
  }

  const ts = Date.now();
  const uaSummary = summarizeUserAgent(request.headers.get("User-Agent") || "");
  const voteRecord = { q1, q2, q3, ipHash, ipLast4, uaSummary, ts, immutable: true };

  const pushed = await fbPush(env, "votes", voteRecord);
  await fbSet(env, `votes_index/${ipHash}`, { voteId: pushed.name, ts });
  await incrementStats(env, { q1, q2, q3 });
  await fbPush(env, "logs", { action: "vote_cast", ipHash, ts });

  return json({ success: true, ipLast4 }, 200, origin);
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
   ============================================================ */
async function handleUploadMedia(request, env, origin) {
  const ip = getClientIP(request);
  const ipHash = await sha256Hex(ip + env.IP_SALT);

  const withinLimit = await rateLimit(env, `media:${ipHash}`, 2, 300);
  if (!withinLimit) return json({ success: false, message: "لقد قمت برفع الحد الأقصى من المشاركات" }, 429, origin);

  const banned = await fbGet(env, `banned_ips/${ipHash}`);
  if (banned) return json({ success: false, message: "غير مسموح بالرفع من هذا الجهاز" }, 403, origin);

  const form = await request.formData();
  const file = form.get("file");
  const type = form.get("type") === "voice" ? "voice" : "video";
  if (!file) return json({ success: false, message: "لم يتم إرسال أي ملف" }, 400, origin);

  const MAX_BYTES = 100 * 1024 * 1024;
  if (file.size > MAX_BYTES) return json({ success: false, message: "حجم الملف أكبر من 100 ميجابايت" }, 400, origin);

  if (!env.R2_BUCKET) return json({ success: false, message: "خدمة التخزين غير متاحة حاليًا" }, 503, origin);

  const key = `pending/${type}-${Date.now()}-${crypto.randomUUID()}.webm`;
  await env.R2_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "video/webm" },
  });

  const mediaRecord = {
    type, r2Key: key, status: "pending",
    ipHash, ts: Date.now(),
  };
  const pushed = await fbPush(env, "media", mediaRecord);

  await moderateMedia(env, pushed.name, key, type);

  const summary = (await fbGet(env, "statistics/summary")) || {};
  summary.mediaSubmitted = (summary.mediaSubmitted || 0) + 1;
  await fbSet(env, "statistics/summary", summary);

  return json({ success: true, message: "تم استلام الملف وهو الآن قيد المراجعة" }, 200, origin);
}

async function moderateMedia(env, mediaId, pendingKey, type) {
  // TODO: replace with real moderation model
  const verdict = { safe: null };

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
}

/* ============================================================
   ROUTE: GET /api/media?status=approved
   ============================================================ */
async function handleGetMedia(request, env, origin) {
  const approved = (await fbGet(env, "media")) || {};
  const items = Object.entries(approved)
    .map(([id, m]) => ({ id, ...m }))
    .filter((m) => m.status === "approved")
    .sort((a, b) => b.ts - a.ts)
    .map((m) => ({
      id: m.id,
      type: m.type,
      url: `${env.R2_PUBLIC_BASE_URL || ""}/${m.r2Key}`,
    }));
  return json({ items }, 200, origin);
}

/* ============================================================
   ADMIN PASSWORD — rotates every minute, HHMM 12h format
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

async function handleAdminLogin(request, env, origin) {
  const ip = getClientIP(request);
  const withinLimit = await rateLimit(env, `admin_login:${ip}`, 8, 60);
  if (!withinLimit) return json({ success: false, message: "محاولات كثيرة جدًا، حاول بعد دقيقة" }, 429, origin);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ success: false, message: "بيانات غير صالحة" }, 400, origin);
  }
  const { password } = body;

  const current = await getCurrentAdminPassword(env);
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const prevDate = new Date(now.getTime() - 60000);
  let ph = prevDate.getHours() % 12; if (ph === 0) ph = 12;
  const prev = `${String(ph).padStart(2, "0")}${String(prevDate.getMinutes()).padStart(2, "0")}`;

  if (password === current || password === prev) {
    if (!env.RATE_LIMIT_KV) return json({ success: false, message: "خدمة KV غير متاحة" }, 503, origin);
    const sessionToken = crypto.randomUUID();
    await env.RATE_LIMIT_KV.put(`admin_session:${sessionToken}`, "1", { expirationTtl: 3600 });
    return json({ success: true, token: sessionToken }, 200, origin);
  }
  return json({ success: false, message: "كلمة مرور غير صحيحة" }, 401, origin);
}

async function requireAdmin(request, env) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token || !env.RATE_LIMIT_KV) return false;
  const valid = await env.RATE_LIMIT_KV.get(`admin_session:${token}`);
  return !!valid;
}

/* ============================================================
   ADMIN ACTIONS
   ============================================================ */
async function handleAdminMediaAction(request, env, action, origin) {
  if (!(await requireAdmin(request, env))) return json({ success: false, message: "غير مصرح" }, 401, origin);
  const { mediaId, r2Key } = await request.json();

  if (action === "approve" || action === "reject") {
    const newPrefix = action === "approve" ? "approved/" : "rejected/";
    const newKey = r2Key.replace(/^pending\//, newPrefix).replace(/^rejected\//, newPrefix).replace(/^approved\//, newPrefix);
    if (newKey !== r2Key && env.R2_BUCKET) {
      const obj = await env.R2_BUCKET.get(r2Key);
      if (obj) {
        await env.R2_BUCKET.put(newKey, await obj.arrayBuffer());
        await env.R2_BUCKET.delete(r2Key);
      }
    }
    await fbUpdate(env, `media/${mediaId}`, { status: action === "approve" ? "approved" : "rejected", r2Key: newKey });
    await fbPush(env, "logs", { action: `media_${action}`, mediaId, ts: Date.now() });
    return json({ success: true, message: action === "approve" ? "تم اعتماد المشاركة" : "تم رفض المشاركة" }, 200, origin);
  }

  if (action === "delete") {
    if (r2Key && env.R2_BUCKET) await env.R2_BUCKET.delete(r2Key);
    await fbSet(env, `media/${mediaId}`, null);
    await fbPush(env, "logs", { action: "media_delete", mediaId, ts: Date.now() });
    return json({ success: true, message: "تم حذف المشاركة" }, 200, origin);
  }
  return json({ success: false, message: "إجراء غير معروف" }, 400, origin);
}

async function handleAdminVoteDelete(request, env, origin) {
  if (!(await requireAdmin(request, env))) return json({ success: false, message: "غير مصرح" }, 401, origin);
  const { voteId } = await request.json();
  const vote = await fbGet(env, `votes/${voteId}`);
  if (!vote) return json({ success: false, message: "الصوت غير موجود" }, 404, origin);

  await fbSet(env, `votes/${voteId}`, null);
  await fbSet(env, `votes_index/${vote.ipHash}`, null);

  const summary = (await fbGet(env, "statistics/summary")) || {};
  summary.total = Math.max(0, (summary.total || 1) - 1);
  if (summary.q1) summary.q1[vote.q1] = Math.max(0, (summary.q1[vote.q1] || 1) - 1);
  if (summary.q2) summary.q2[vote.q2] = Math.max(0, (summary.q2[vote.q2] || 1) - 1);
  if (summary.q3) summary.q3[vote.q3] = Math.max(0, (summary.q3[vote.q3] || 1) - 1);
  await fbSet(env, "statistics/summary", summary);

  await fbPush(env, "logs", { action: "vote_delete_fraud", voteId, ts: Date.now() });
  return json({ success: true, message: "تم حذف الصوت المزوّر ورُصدت الإحصائيات" }, 200, origin);
}

/**
 * ROUTE: POST /api/admin/vote/reset
 * Lets a specific voter vote again (e.g. they made a mistake, or asked
 * to change their answer). Unlike the fraud-delete action, the original
 * vote is archived (not erased) for audit history, and the ipHash lock
 * is cleared so a fresh vote can be submitted.
 */
async function handleAdminVoteReset(request, env, origin) {
  if (!(await requireAdmin(request, env))) return json({ success: false, message: "غير مصرح" }, 401, origin);
  const { voteId } = await request.json();
  const vote = await fbGet(env, `votes/${voteId}`);
  if (!vote) return json({ success: false, message: "الصوت غير موجود" }, 404, origin);

  // Archive the original vote for history instead of deleting it outright
  await fbSet(env, `votes_history/${voteId}`, { ...vote, resetAt: Date.now() });
  await fbSet(env, `votes/${voteId}`, null);
  await fbSet(env, `votes_index/${vote.ipHash}`, null);

  const summary = (await fbGet(env, "statistics/summary")) || {};
  summary.total = Math.max(0, (summary.total || 1) - 1);
  if (summary.q1) summary.q1[vote.q1] = Math.max(0, (summary.q1[vote.q1] || 1) - 1);
  if (summary.q2) summary.q2[vote.q2] = Math.max(0, (summary.q2[vote.q2] || 1) - 1);
  if (summary.q3) summary.q3[vote.q3] = Math.max(0, (summary.q3[vote.q3] || 1) - 1);
  await fbSet(env, "statistics/summary", summary);

  await fbPush(env, "logs", { action: "vote_reset_allow_revote", voteId, ipHash: vote.ipHash, ts: Date.now() });
  return json({ success: true, message: "تمت إعادة تعيين الصوت — يمكن لهذا الشخص التصويت من جديد" }, 200, origin);
}

async function handleAdminBan(request, env, ban, origin) {
  if (!(await requireAdmin(request, env))) return json({ success: false, message: "غير مصرح" }, 401, origin);
  const { ipHash, reason } = await request.json();
  if (ban) {
    await fbSet(env, `banned_ips/${ipHash}`, { reason: reason || "حظر يدوي", ts: Date.now() });
    await fbPush(env, "logs", { action: "ip_banned", ipHash, ts: Date.now() });
    return json({ success: true, message: "تم حظر عنوان IP" }, 200, origin);
  } else {
    await fbSet(env, `banned_ips/${ipHash}`, null);
    await fbPush(env, "logs", { action: "ip_unbanned", ipHash, ts: Date.now() });
    return json({ success: true, message: "تم إلغاء الحظر" }, 200, origin);
  }
}

/* ============================================================
   ROUTE: GET /api/stats (public, read-only)
   ============================================================ */
async function handleGetStats(request, env, origin) {
  const summary = await fbGet(env, "statistics/summary") || {};
  return json({ success: true, data: summary }, 200, origin);
}

/* ============================================================
   ENTRYPOINT
   ============================================================ */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    try {
      if (url.pathname === "/api/vote" && request.method === "POST") return await handleVote(request, env, origin);
      if (url.pathname === "/api/upload-media" && request.method === "POST") return await handleUploadMedia(request, env, origin);
      if (url.pathname === "/api/media" && request.method === "GET") return await handleGetMedia(request, env, origin);
      if (url.pathname === "/api/stats" && request.method === "GET") return await handleGetStats(request, env, origin);
      if (url.pathname === "/api/admin/login" && request.method === "POST") return await handleAdminLogin(request, env, origin);
      if (url.pathname === "/api/admin/password" && request.method === "GET") {
        if (!(await requireAdmin(request, env))) return json({ success: false }, 401, origin);
        return json({ password: await getCurrentAdminPassword(env) }, 200, origin);
      }
      if (url.pathname === "/api/admin/media/approve" && request.method === "POST") return await handleAdminMediaAction(request, env, "approve", origin);
      if (url.pathname === "/api/admin/media/reject" && request.method === "POST") return await handleAdminMediaAction(request, env, "reject", origin);
      if (url.pathname === "/api/admin/media/delete" && request.method === "POST") return await handleAdminMediaAction(request, env, "delete", origin);
      if (url.pathname === "/api/admin/vote/delete" && request.method === "POST") return await handleAdminVoteDelete(request, env, origin);
      if (url.pathname === "/api/admin/vote/reset" && request.method === "POST") return await handleAdminVoteReset(request, env, origin);
      if (url.pathname === "/api/admin/ban" && request.method === "POST") return await handleAdminBan(request, env, true, origin);
      if (url.pathname === "/api/admin/unban" && request.method === "POST") return await handleAdminBan(request, env, false, origin);
      return json({ success: false, message: "Not found" }, 404, origin);
    } catch (err) {
      return json({ success: false, message: "خطأ في الخادم", error: String(err) }, 500, origin);
    }
  },
};
