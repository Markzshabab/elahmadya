import { db, ref, onValue } from "./firebase-config.js";

const API_BASE = "https://ahmadiya-survey-worker.YOUR_SUBDOMAIN.workers.dev";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let adminToken = sessionStorage.getItem("admin_token") || null;

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

/* ---------------- LOGIN ---------------- */
$("#adminLoginBtn").addEventListener("click", async () => {
  const password = $("#adminPasswordInput").value.trim();
  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.success) {
      adminToken = data.token;
      sessionStorage.setItem("admin_token", adminToken);
      showAdminApp();
    } else {
      $("#loginError").textContent = data.message || "كلمة مرور غير صحيحة";
    }
  } catch (e) {
    $("#loginError").textContent = "تعذّر الاتصال بالخادم";
  }
});

$("#logoutBtn")?.addEventListener("click", () => {
  sessionStorage.removeItem("admin_token");
  location.reload();
});

function showAdminApp() {
  $("#loginScreen").hidden = true;
  $("#adminApp").hidden = false;
  initTabs();
  loadModerationQueue();
  loadVotes();
  loadBans();
  loadSystemHealth();
  wireExports();
  wireBan();
}

if (adminToken) showAdminApp();

/* ---------------- TABS ---------------- */
function initTabs() {
  $$(".admin-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".admin-tabs button").forEach((b) => b.classList.remove("active"));
      $$(".admin-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $(`#panel-${btn.dataset.panel}`).classList.add("active");
    });
  });
}

function authHeaders() {
  return { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" };
}

/* ---------------- MODERATION ---------------- */
function loadModerationQueue() {
  onValue(ref(db, "media"), (snap) => {
    const data = snap.val() || {};
    const tbody = $("#moderationTableBody");
    tbody.innerHTML = "";
    Object.entries(data)
      .sort((a, b) => b[1].ts - a[1].ts)
      .forEach(([id, m]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${m.type === "video" ? "فيديو" : "فويس نوت"}</td>
          <td><span class="pill pill-${m.status}">${statusLabel(m.status)}</span></td>
          <td>${new Date(m.ts).toLocaleString("ar-EG")}</td>
          <td>${m.r2Key ? `<code>${m.r2Key}</code>` : "-"}</td>
          <td class="row-actions">
            <button class="btn-ghost" data-action="approve" data-id="${id}" data-key="${m.r2Key}">اعتماد</button>
            <button class="btn-ghost" data-action="reject" data-id="${id}" data-key="${m.r2Key}">رفض</button>
            <button class="btn-ghost" data-action="delete" data-id="${id}" data-key="${m.r2Key}">حذف</button>
          </td>`;
        tbody.appendChild(tr);
      });

    tbody.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => moderationAction(btn.dataset.action, btn.dataset.id, btn.dataset.key));
    });
  });
}

function statusLabel(s) {
  return { pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض" }[s] || s;
}

async function moderationAction(action, mediaId, r2Key) {
  const res = await fetch(`${API_BASE}/api/admin/media/${action}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mediaId, r2Key }),
  });
  const data = await res.json();
  toast(data.message || (data.success ? "تم التنفيذ" : "فشل التنفيذ"));
}

/* ---------------- VOTES ---------------- */
function loadVotes() {
  onValue(ref(db, "votes"), (snap) => {
    const data = snap.val() || {};
    renderVotes(data);
    $("#voteSearch").oninput = (e) => {
      const q = e.target.value.trim();
      const filtered = Object.fromEntries(Object.entries(data).filter(([, v]) => v.ipLast4.includes(q)));
      renderVotes(filtered);
    };
  });
}

function renderVotes(data) {
  const tbody = $("#votesTableBody");
  tbody.innerHTML = "";
  Object.entries(data)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, 300)
    .forEach(([id, v]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${q1Label(v.q1)}</td><td>${q2Label(v.q2)}</td><td>${q3Label(v.q3)}</td>
        <td>**.**.**.${v.ipLast4}</td>
        <td>${new Date(v.ts).toLocaleString("ar-EG")}</td>
        <td><button class="btn-ghost" data-vote-del="${id}">حذف (تزوير مؤكد)</button></td>`;
      tbody.appendChild(tr);
    });
  tbody.querySelectorAll("[data-vote-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("حذف هذا الصوت نهائيًا؟ يُستخدم فقط في حالة تصويت مزوّر مؤكد.")) return;
      const res = await fetch(`${API_BASE}/api/admin/vote/delete`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ voteId: btn.dataset.voteDel }),
      });
      const data = await res.json();
      toast(data.message || "تم الحذف");
    });
  });
}
const q1Label = (v) => ({ satisfied: "راضٍ جدًا", not_satisfied: "غير راضٍ" }[v] || v);
const q2Label = (v) => ({ youth: "قيادة شبابية", current: "الإدارة الحالية" }[v] || v);
const q3Label = (v) => ({ new_youth: "الشباب الجديد", current_mgmt: "الإدارة الحالية" }[v] || v);

/* ---------------- BANS ---------------- */
function loadBans() {
  onValue(ref(db, "banned_ips"), (snap) => {
    const data = snap.val() || {};
    const tbody = $("#bansTableBody");
    tbody.innerHTML = "";
    Object.entries(data).forEach(([hash, b]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><code>${hash.slice(0, 12)}...</code></td><td>${b.reason || "-"}</td><td>${new Date(b.ts).toLocaleString("ar-EG")}</td>
        <td><button class="btn-ghost" data-unban="${hash}">إلغاء الحظر</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("[data-unban]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await fetch(`${API_BASE}/api/admin/unban`, {
          method: "POST", headers: authHeaders(), body: JSON.stringify({ ipHash: btn.dataset.unban }),
        });
        toast((await res.json()).message || "تم إلغاء الحظر");
      });
    });
  });
}

function wireBan() {
  $("#banBtn").addEventListener("click", async () => {
    const ipHash = $("#banIpHashInput").value.trim();
    if (!ipHash) return;
    const res = await fetch(`${API_BASE}/api/admin/ban`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ ipHash, reason: "حظر يدوي من الإدارة" }),
    });
    toast((await res.json()).message || "تم الحظر");
    $("#banIpHashInput").value = "";
  });
}

/* ---------------- EXPORTS ---------------- */
function wireExports() {
  $("#exportVotesCsv").addEventListener("click", () => exportData("votes", "csv"));
  $("#exportVotesJson").addEventListener("click", () => exportData("votes", "json"));
  $("#exportMediaJson").addEventListener("click", () => exportData("media", "json"));
}

async function exportData(node, format) {
  onValue(ref(db, node), (snap) => {
    const data = snap.val() || {};
    const rows = Object.entries(data).map(([id, v]) => ({ id, ...v }));
    let blob, filename;
    if (format === "json") {
      blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      filename = `${node}.json`;
    } else {
      const headers = Object.keys(rows[0] || {});
      const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
      blob = new Blob([csv], { type: "text/csv" });
      filename = `${node}.csv`;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }, { onlyOnce: true });
}

/* ---------------- SYSTEM HEALTH ---------------- */
function loadSystemHealth() {
  onValue(ref(db, "statistics/summary"), (snap) => {
    const s = snap.val() || {};
    $("#systemHealth").innerHTML = `
      <div class="counter-card"><span class="counter-num">${s.total || 0}</span><span class="counter-label">إجمالي الأصوات</span></div>
      <div class="counter-card"><span class="counter-num">${s.mediaSubmitted || 0}</span><span class="counter-label">مشاركات مُرسلة</span></div>
      <div class="counter-card"><span class="counter-num">${s.mediaApproved || 0}</span><span class="counter-label">معتمدة</span></div>
      <div class="counter-card"><span class="counter-num">${s.mediaRejected || 0}</span><span class="counter-label">مرفوضة</span></div>`;
  });
}
