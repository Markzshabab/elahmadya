// =========================================================
// CLOUDFLARE WORKER — Updated for Elahmadya Survey
// Compatible with new frontend (app.js, charts.js)
// =========================================================

// Allow requests from your domains
const ALLOWED_ORIGINS = [
  "https://markzshabab.github.io",
  "https://elahmadya.pages.dev",
  "http://localhost:*",
  "https://localhost:*",
  "*", // Development - remove in production
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*");
  return {
    "Access-Control-Allow-Origin": allowed ? "*" : origin,
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

/* ---------------- Firebase REST helpers ---------------- */
async function fbGet(env, path) {
  try {
    const res = await fetch(`${env.FIREBASE_DB_URL}/${path}.json?auth=${env.FIREBASE_SECRET}`);
    return res.json();
  } catch (e) {
    return null;
  }
}

async function fbSet(env, path, value) {
  await fetch(`${env.FIREBASE_DB_URL}/${path}.json?auth=${env.FIREBASE_SECRET}`, {
    method: "PUT",
    body: JSON.stringify(value),
  });
}

async function fbPush(env, path, value) {
  try {
    const res = await fetch(`${env.FIREBASE_DB_URL}/${path}.json?auth=${env.FIREBASE_SECRET}`, {
      method: "POST",
      body: JSON.stringify(value),
    });
    return res.json();
  } catch (e) {
    return { name: `push_${Date.now()}` };
  }
}

async function fbUpdate(env, path, value) {
  await fetch(`${env.FIREBASE_DB_URL}/${path}.json?auth=${env.FIREBASE_SECRET}`, {
    method: "PATCH",
    body: JSON.stringify(value),
  });
}

async function rateLimit(env, key, limit, windowSeconds) {
  try {
    if (!env.RATE_LIMIT_KV) return true;
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
    return true;
  }
}

/**
 * Convert frontend vote values to backend format
 * Frontend: { q1: 'Very Satisfied' | 'Not Satisfied', q2: 'Yes' | 'No', q3: 'New Youth' | 'Current Management' }
 * Backend: { q1: 'satisfied' | 'not_satisfied', q2: 'youth' | 'current', q3: 'new_youth' | 'current_mgmt' }
 */
function convertVoteValues(votes) {
  const mapping = {
    q1: {
      'Very Satisfied': 'satisfied',
      'Not Satisfied': 'not_satisfied',
      'راضي جداً': 'satisfied',
      'غير راضي': 'not_satisfied',
    },
    q2: {
      'Yes': 'youth',
      'No': 'current',
      'نعم، أؤيد': 'youth',
      'لا أؤيد': 'current',
    },
    q3: {
      'New Youth': 'new_youth',
      'Current Management': 'current_mgmt',
      'شباب جديد': 'new_youth',
      'الإدارة الحالية': 'current_mgmt',
    },
  };

  const converted = {};
  for (const [key, value] of Object.entries(votes)) {
    if (mapping[key] && mapping[key][value]) {
      converted[key] = mapping[key][value];
    } else {
      converted[key] = value; // Keep original if no mapping
    }
  }
  return converted;
}

/* ============================================================
   ROUTE: POST /submit (Main submission endpoint for app.js)
   ============================================================ */
async function handleSubmit(request, env, origin) {
  const ip = getClientIP(request);
  const ipHash = await sha256Hex(ip + (env.IP_SALT || "default_salt"));
  
  // Rate limiting
  const withinLimit = await rateLimit(env, `submit:${ipHash}`, 5, 300);
  if (!withinLimit) {
    return json({ 
      success: false, 
      error: "طلبات كثيرة جدًا، حاول بعد قليل" 
    }, 429, origin);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return json({ success: false, error: "بيانات غير صالحة" }, 400, origin);
  }

  // Extract data from form
  const votesStr = formData.get("votes");
  const fingerprint = formData.get("fingerprint");
  const mediaFile = formData.get("media");
  const mediaType = formData.get("type");

  // Parse votes
  let votes = {};
  try {
    votes = JSON.parse(votesStr);
  } catch (e) {
    return json({ success: false, error: "بيانات التصويت غير صالحة" }, 400, origin);
  }

  // Convert vote values to backend format
  const convertedVotes = convertVoteValues(votes);

  // Validate required fields
  if (!convertedVotes.q1 || !convertedVotes.q2 || !convertedVotes.q3) {
    return json({ success: false, error: "يرجى الإجابة على جميع الأسئلة" }, 400, origin);
  }

  // Check ban list
  const banned = await fbGet(env, `banned_ips/${ipHash}`);
  if (banned) {
    return json({ 
      success: false, 
      error: "عذراً، تم حظر عنوان IP الخاص بك من المشاركة." 
    }, 403, origin);
  }

  // Check duplicate by IP hash
  const existingByIP = await fbGet(env, `votes_index/${ipHash}`);
  if (existingByIP) {
    return json({ 
      success: false, 
      error: "عذراً، تم حظر عنوان IP الخاص بك من المشاركة.",
      has_voted: true,
      banned: true 
    }, 409, origin);
  }

  // Check duplicate by fingerprint (if provided)
  if (fingerprint) {
    const fpHash = await sha256Hex(fingerprint);
    const existingByFP = await fbGet(env, `fingerprints/${fpHash}`);
    if (existingByFP) {
      return json({ 
        success: false, 
        error: "عذراً، تم حظر عنوان IP الخاص بك من المشاركة.",
        has_voted: true 
      }, 409, origin);
    }
    
    // Store fingerprint
    await fbSet(env, `fingerprints/${fpHash}`, { 
      ipHash, 
      ts: Date.now(),
      votes: convertedVotes 
    });
  }

  // Save the vote
  const ts = Date.now();
  const uaSummary = summarizeUserAgent(request.headers.get("User-Agent") || "");
  
  const voteRecord = {
    ...convertedVotes,
    ipHash,
    ipLast4: getIPLast4(ip),
    uaSummary,
    fingerprint: fingerprint ? await sha256Hex(fingerprint) : null,
    ts,
    source: "web_app",
    immutable: true
  };

  const pushed = await fbPush(env, "votes", voteRecord);
  
  // Index by IP hash for duplicate check
  await fbSet(env, `votes_index/${ipHash}`, { 
    voteId: pushed.name, 
    ts,
    fingerprint: fingerprint ? await sha256Hex(fingerprint) : null
  });

  // Update statistics
  await incrementStats(env, convertedVotes);

  // Handle media upload if present
  let mediaResult = null;
  if (mediaFile && mediaFile.size > 0) {
    mediaResult = await handleMediaUpload(env, mediaFile, mediaType, ipHash, pushed.name);
  }

  // Log the action
  await fbPush(env, "logs", { 
    action: "vote_submitted", 
    ipHash, 
    hasMedia: !!mediaFile,
    ts 
  });

  return json({ 
    success: true, 
    message: "تم تسجيل تصويتك بنجاح!",
    voteId: pushed.name,
    mediaUploaded: !!mediaResult
  }, 200, origin);
}

async function incrementStats(env, { q1, q2, q3 }) {
  try {
    const summary = (await fbGet(env, "statistics/summary")) || {};
    
    // Total count
    summary.total = (summary.total || 0) + 1;

    // Q1 stats (Satisfaction)
    summary.q1 = summary.q1 || {};
    summary.q1.satisfied = (summary.q1.satisfied || 0) + (q1 === 'satisfied' ? 1 : 0);
    summary.q1.not_satisfied = (summary.q1.not_satisfied || 0) + (q1 === 'not_satisfied' ? 1 : 0);

    // Q2 stats (Youth support)
    summary.q2 = summary.q2 || {};
    summary.q2.youth = (summary.q2.youth || 0) + (q2 === 'youth' ? 1 : 0);
    summary.q2.current = (summary.q2.current || 0) + (q2 === 'current' ? 1 : 0);

    // Q3 stats (Choice)
    summary.q3 = summary.q3 || {};
    summary.q3.new_youth = (summary.q3.new_youth || 0) + (q3 === 'new_youth' ? 1 : 0);
    summary.q3.current_mgmt = (summary.q3.current_mgmt || 0) + (q3 === 'current_mgmt' ? 1 : 0);

    // Daily stats
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const dayStats = (await fbGet(env, `statistics/daily/${todayKey}`)) || { count: 0 };
    dayStats.count++;
    await fbSet(env, `statistics/daily/${todayKey}`, dayStats);

    summary.today = dayStats.count;
    
    // Media counts
    summary.mediaSubmitted = summary.mediaSubmitted || 0;
    summary.mediaApproved = summary.mediaApproved || 0;

    await fbSet(env, "statistics/summary", summary);
  } catch (e) {
    console.error("Error incrementing stats:", e);
  }
}

async function handleMediaUpload(env, file, type, ipHash, voteId) {
  try {
    if (!env.R2_BUCKET) {
      return { success: false, error: "خدمة التخزين غير متاحة" };
    }

    const MAX_BYTES = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_BYTES) {
      return { success: false, error: "حجم الملف أكبر من 100 ميجابايت" };
    }

    const mediaType = type === "audio" ? "voice" : "video";
    const key = `pending/${mediaType}-${Date.now()}-${crypto.randomUUID()}.webm`;
    
    await env.R2_BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "video/webm" },
    });

    const mediaRecord = {
      type: mediaType,
      r2Key: key,
      status: "pending",
      ipHash,
      voteId,
      ts: Date.now(),
    };

    const pushed = await fbPush(env, "media", mediaRecord);

    // Auto-approve for now (TODO: add moderation)
    await moderateMedia(env, pushed.name, key, mediaType);

    return { success: true, mediaId: pushed.name };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function moderateMedia(env, mediaId, pendingKey, type) {
  // Auto-approve for now
  try {
    if (env.R2_BUCKET) {
      const newKey = pendingKey.replace("pending/", "approved/");
      const obj = await env.R2_BUCKET.get(pendingKey);
      if (obj) {
        await env.R2_BUCKET.put(newKey, await obj.arrayBuffer());
        await env.R2_BUCKET.delete(pendingKey);
      }
      await fbUpdate(env, `media/${mediaId}`, { status: "approved", r2Key: newKey });

      // Update stats
      const summary = (await fbGet(env, "statistics/summary")) || {};
      summary.mediaSubmitted = (summary.mediaSubmitted || 0) + 1;
      summary.mediaApproved = (summary.mediaApproved || 0) + 1;
      await fbSet(env, "statistics/summary", summary);
    }
  } catch (e) {
    console.error("Moderation error:", e);
  }
}

/* ============================================================
   ROUTE: POST /check-status (Check if device has voted)
   ============================================================ */
async function handleCheckStatus(request, env, origin) {
  try {
    const body = await request.json();
    const fingerprint = body.fingerprint;
    const ip = getClientIP(request);
    const ipHash = await sha256Hex(ip + (env.IP_SALT || "default_salt"));

    let hasVoted = false;
    let banned = false;

    // Check IP ban/vote
    const ipRecord = await fbGet(env, `votes_index/${ipHash}`);
    if (ipRecord) {
      hasVoted = true;
    }

    // Check IP ban list
    const bannedRecord = await fbGet(env, `banned_ips/${ipHash}`);
    if (bannedRecord) {
      banned = true;
      hasVoted = true;
    }

    // Check fingerprint if provided
    if (fingerprint && !hasVoted) {
      const fpHash = await sha256Hex(fingerprint);
      const fpRecord = await fbGet(env, `fingerprints/${fpHash}`);
      if (fpRecord) {
        hasVoted = true;
      }
    }

    return json({
      has_voted: hasVoted,
      banned: banned,
      can_vote: !hasVoted && !banned
    }, 200, origin);
  } catch (e) {
    return json({
      has_voted: false,
      banned: false,
      can_vote: true,
      error: e.message
    }, 200, origin);
  }
}

/* ============================================================
   ROUTE: GET /stats (Public stats - compatible with charts.js)
   Returns data in format expected by frontend charts
   ============================================================ */
async function handleGetStats(request, env, origin) {
  try {
    const summary = await fbGet(env, "statistics/summary") || {};

    // Format data for charts.js
    // Q1: Satisfaction
    const q1_satisfied = summary.q1?.satisfied || 0;
    const q1_not = summary.q1?.not_satisfied || 0;

    // Q2: Youth support
    const q2_yes = summary.q2?.youth || 0;
    const q2_no = summary.q2?.current || 0;

    // Q3: Choice
    const q3_new = summary.q3?.new_youth || 0;
    const q3_current = summary.q3?.current_mgmt || 0;

    // Media counts
    const video_count = summary.mediaApproved || 0;
    const audio_count = 0; // Combined with video for simplicity

    return json({
      q1_satisfied,
      q1_not,
      q2_yes,
      q2_no,
      q3_new,
      q3_current,
      video_count,
      audio_count,
      total_votes: summary.total || 0,
      success: true
    }, 200, origin);
  } catch (e) {
    // Return empty stats on error
    return json({
      q1_satisfied: 0,
      q1_not: 0,
      q2_yes: 0,
      q2_no: 0,
      q3_new: 0,
      q3_current: 0,
      video_count: 0,
      audio_count: 0,
      total_votes: 0,
      success: true,
      error: e.message
    }, 200, origin);
  }
}

/* ============================================================
   ROUTE: GET /api/media?status=approved
   ============================================================ */
async function handleGetMedia(request, env, origin) {
  try {
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
    return json({ items, success: true }, 200, origin);
  } catch (e) {
    return json({ items: [], success: true, error: e.message }, 200, origin);
  }
}

/* ============================================================
   ADMIN ROUTES
   ============================================================ */

async function getCurrentAdminPassword(env) {
  const now = new Date();
  const cairoNow = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  let hours = cairoNow.getHours() % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  const mm = String(cairoNow.getMinutes()).padStart(2, "0");
  return `${hh}${mm}`;
}

async function handleAdminLogin(request, env, origin) {
  const ip = getClientIP(request);
  const withinLimit = await rateLimit(env, `admin_login:${ip}`, 8, 60);
  if (!withinLimit) {
    return json({ success: false, message: "محاولات كثيرة جدًا، حاول بعد دقيقة" }, 429, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ success: false, message: "بيانات غير صالحة" }, 400, origin);
  }

  const { password } = body;
  const current = await getCurrentAdminPassword(env);
  
  // Also accept previous minute's password
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const prevDate = new Date(now.getTime() - 60000);
  let ph = prevDate.getHours() % 12;
  if (ph === 0) ph = 12;
  const prev = `${String(ph).padStart(2, "0")}${String(prevDate.getMinutes()).padStart(2, "0")}`;

  if (password === current || password === prev) {
    if (!env.RATE_LIMIT_KV) {
      return json({ success: false, message: "خدمة KV غير متاحة" }, 503, origin);
    }
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

async function handleAdminAction(request, env, action, origin) {
  if (!(await requireAdmin(request, env))) {
    return json({ success: false, message: "غير مصرح" }, 401, origin);
  }

  switch (action) {
    case "ban":
    case "unban": {
      const { ipHash, reason } = await request.json();
      if (action === "ban") {
        await fbSet(env, `banned_ips/${ipHash}`, { reason: reason || "حظر يدوي", ts: Date.now() });
        await fbPush(env, "logs", { action: "ip_banned", ipHash, ts: Date.now() });
        return json({ success: true, message: "تم حظر عنوان IP" }, 200, origin);
      } else {
        await fbSet(env, `banned_ips/${ipHash}`, null);
        await fbPush(env, "logs", { action: "ip_unbanned", ipHash, ts: Date.now() });
        return json({ success: true, message: "تم إلغاء الحظر" }, 200, origin);
      }
    }

    case "delete_vote": {
      const { voteId } = await request.json();
      const vote = await fbGet(env, `votes/${voteId}`);
      if (!vote) return json({ success: false, message: "الصوت غير موجود" }, 404, origin);

      await fbSet(env, `votes/${voteId}`, null);
      await fbSet(env, `votes_index/${vote.ipHash}`, null);

      // Update stats
      const summary = (await fbGet(env, "statistics/summary")) || {};
      summary.total = Math.max(0, (summary.total || 1) - 1);
      if (summary.q1 && vote.q1) summary.q1[vote.q1] = Math.max(0, (summary.q1[vote.q1] || 1) - 1);
      if (summary.q2 && vote.q2) summary.q2[vote.q2] = Math.max(0, (summary.q2[vote.q2] || 1) - 1);
      if (summary.q3 && vote.q3) summary.q3[vote.q3] = Math.max(0, (summary.q3[vote.q3] || 1) - 1);
      await fbSet(env, "statistics/summary", summary);

      await fbPush(env, "logs", { action: "vote_deleted", voteId, ts: Date.now() });
      return json({ success: true, message: "تم حذف الصوت" }, 200, origin);
    }

    case "approve_media":
    case "reject_media":
    case "delete_media": {
      const { mediaId, r2Key } = await request.json();
      
      if (action === "delete_media") {
        if (r2Key && env.R2_BUCKET) await env.R2_BUCKET.delete(r2Key);
        await fbSet(env, `media/${mediaId}`, null);
        return json({ success: true, message: "تم حذف المشاركة" }, 200, origin);
      }

      const newPrefix = action === "approve_media" ? "approved/" : "rejected/";
      const newKey = r2Key.replace(/^pending\//, newPrefix).replace(/^rejected\//, newPrefix).replace(/^approved\//, newPrefix);
      
      if (newKey !== r2Key && env.R2_BUCKET) {
        const obj = await env.R2_BUCKET.get(r2Key);
        if (obj) {
          await env.R2_BUCKET.put(newKey, await obj.arrayBuffer());
          await env.R2_BUCKET.delete(r2Key);
        }
      }
      
      await fbUpdate(env, `media/${mediaId}`, { 
        status: action === "approve_media" ? "approved" : "rejected", 
        r2Key: newKey 
      });
      
      return json({ 
        success: true, 
        message: action === "approve_media" ? "تم اعتماد المشاركة" : "تم رفض المشاركة" 
      }, 200, origin);
    }

    default:
      return json({ success: false, message: "إجراء غير معروف" }, 400, origin);
  }
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
      // ===== Main App Endpoints (compatible with app.js & charts.js) =====
      
      // Submit vote (used by app.js)
      if (url.pathname === "/submit" && request.method === "POST") {
        return await handleSubmit(request, env, origin);
      }

      // Check device status (used by app.js)
      if (url.pathname === "/check-status" && request.method === "POST") {
        return await handleCheckStatus(request, env, origin);
      }

      // Get public stats (used by charts.js)
      if (url.pathname === "/stats" && request.method === "GET") {
        return await handleGetStats(request, env, origin);
      }

      // Get approved media (used by gallery)
      if (url.pathname === "/media" && request.method === "GET") {
        return await handleGetMedia(request, env, origin);
      }

      // ===== API Endpoints (backward compatible) =====
      
      if (url.pathname === "/api/vote" && request.method === "POST") {
        return await handleSubmit(request, env, origin);
      }

      if (url.pathname === "/api/stats" && request.method === "GET") {
        return await handleGetStats(request, env, origin);
      }

      if (url.pathname === "/api/media" && request.method === "GET") {
        return await handleGetMedia(request, env, origin);
      }

      // ===== Admin Endpoints =====
      
      if (url.pathname === "/api/admin/login" && request.method === "POST") {
        return await handleAdminLogin(request, env, origin);
      }

      if (url.pathname === "/api/admin/password" && request.method === "GET") {
        if (!(await requireAdmin(request, env))) {
          return json({ success: false }, 401, origin);
        }
        return json({ password: await getCurrentAdminPassword(env) }, 200, origin);
      }

      // Admin actions
      const adminActions = [
        "/api/admin/ban",
        "/api/admin/unban", 
        "/api/admin/delete_vote",
        "/api/admin/approve_media",
        "/api/admin/reject_media",
        "/api/admin/delete_media"
      ];

      if (adminActions.includes(url.pathname) && request.method === "POST") {
        const action = url.pathname.split("/").pop();
        return await handleAdminAction(request, env, action, origin);
      }

      // Default response
      return json({ 
        success: false, 
        message: "Endpoint not found",
        available_endpoints: [
          "POST /submit - Submit vote",
          "POST /check-status - Check device status",
          "GET /stats - Get statistics",
          "GET /media - Get approved media"
        ]
      }, 404, origin);

    } catch (err) {
      console.error("Worker error:", err);
      return json({ 
        success: false, 
        message: "خطأ في الخادم",
        error: String(err)
      }, 500, origin);
    }
  },
};
