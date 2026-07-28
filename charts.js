// =========================================================
// LIVE STATISTICS — Chart.js pie/doughnut/bar wired to Firebase
// =========================================================
import { db, ref, onValue } from "./firebase-config.js";

const CHART_COLORS = ["#16C79A", "#E8B854", "#FF5470", "#4C6EF5"];

function baseOptions(extra = {}) {
  return {
    responsive: true,
    plugins: {
      legend: { labels: { color: "#EDEFF5", font: { family: "Cairo" } } },
    },
    ...extra,
  };
}

let charts = {};

function upsertChart(id, type, labels, data) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (charts[id]) {
    charts[id].data.labels = labels;
    charts[id].data.datasets[0].data = data;
    charts[id].update();
    return;
  }
  charts[id] = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{ data, backgroundColor: CHART_COLORS, borderWidth: 0 }],
    },
    options: baseOptions(),
  });
}

function animateCounter(el, target) {
  if (!el) return;
  const start = Number(el.textContent.replace(/,/g, "")) || 0;
  const duration = 700;
  const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / duration);
    const val = Math.round(start + (target - start) * p);
    el.textContent = val.toLocaleString("ar-EG");
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initLiveStats() {
  const statsRef = ref(db, "statistics/summary");
  onValue(statsRef, (snap) => {
    const s = snap.val();
    if (!s) return;

    animateCounter(document.getElementById("cTotalVotes"), s.total || 0);
    animateCounter(document.getElementById("cToday"), s.today || 0);
    animateCounter(document.getElementById("cWeek"), s.week || 0);
    animateCounter(document.getElementById("cVideos"), s.mediaSubmitted || 0);
    animateCounter(document.getElementById("cApproved"), s.mediaApproved || 0);
    animateCounter(document.getElementById("cRejected"), s.mediaRejected || 0);

    if (s.q1) upsertChart("chartQ1", "doughnut", ["راضٍ جدًا", "غير راضٍ"], [s.q1.satisfied || 0, s.q1.not_satisfied || 0]);
    if (s.q2) upsertChart("chartQ2", "pie", ["قيادة شبابية", "الإدارة الحالية"], [s.q2.youth || 0, s.q2.current || 0]);
    if (s.q3) upsertChart("chartQ3", "bar", ["الشباب الجديد", "الإدارة الحالية"], [s.q3.new_youth || 0, s.q3.current_mgmt || 0]);
  });
}

document.addEventListener("DOMContentLoaded", initLiveStats);
