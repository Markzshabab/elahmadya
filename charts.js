/**
 * Al Ahmadiya Youth Center Survey - Live Charts Integration
 * Fixed Global Variable Collision
 */

// غيرنا اسم المتغير ليكون فريداً ولن يتعارض مع أي ملف آخر
const CHARTS_API_URL = 'https://markzshabab.studusa05.workers.dev';
let q1Chart, q2Chart, q3Chart;

async function initCharts() {
    Chart.defaults.color = '#ffffff';
    Chart.defaults.font.family = 'Cairo, sans-serif';
    
    try {
        const res = await fetch(`${CHARTS_API_URL}/stats`);
        const data = await res.json();
        
        const primaryColors = ['#00f2fe', '#ff416c'];
        const secondaryColors = ['#4facfe', '#f39c12'];

        const ctx1 = document.getElementById('q1Chart');
        if (ctx1) {
            if (q1Chart) q1Chart.destroy();
            q1Chart = new Chart(ctx1, {
                type: 'pie',
                data: {
                    labels: ['راضي جداً', 'غير راضي'],
                    datasets: [{ data: [data.q1_satisfied, data.q1_not], backgroundColor: primaryColors }]
                },
                options: { 
                    responsive: true,
                    plugins: { title: { display: true, text: 'مدى الرضا عن الإدارة الحالية' } }
                }
            });
        }

        const ctx2 = document.getElementById('q2Chart');
        if (ctx2) {
            if (q2Chart) q2Chart.destroy();
            q2Chart = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['نعم', 'لا'],
                    datasets: [{ data: [data.q2_yes, data.q2_no], backgroundColor: secondaryColors }]
                },
                options: { 
                    responsive: true,
                    plugins: { title: { display: true, text: 'تأييد قيادة الشباب للمركز' } }
                }
            });
        }

        const ctx3 = document.getElementById('q3Chart');
        if (ctx3) {
            if (q3Chart) q3Chart.destroy();
            q3Chart = new Chart(ctx3, {
                type: 'bar',
                data: {
                    labels: ['شباب جديد', 'الإدارة الحالية'],
                    datasets: [{ label: 'الأصوات', data: [data.q3_new, data.q3_current], backgroundColor: primaryColors[0] }]
                },
                options: { 
                    responsive: true,
                    plugins: { title: { display: true, text: 'اختيار الانتخابات القادمة' } }
                }
            });
        }

        if (typeof gsap !== 'undefined') {
            const vidEl = document.getElementById('vid-count');
            const audEl = document.getElementById('aud-count');
            if (vidEl) gsap.to(vidEl, { innerHTML: data.video_count || 0, roundProps: "innerHTML", duration: 1.5 });
            if (audEl) gsap.to(audEl, { innerHTML: data.audio_count || 0, roundProps: "innerHTML", duration: 1.5 });
        }

    } catch (error) {
        console.error("Error fetching live stats for charts:", error);
    }
}

window.initCharts = initCharts;