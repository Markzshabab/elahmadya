const CHARTS_API_URL = 'https://markzshabab.studusa05.workers.dev';
let q1Chart, q2Chart, q3Chart;

// ألوان جديدة متناسقة مع شعار مركز الحمادية
const CHART_COLORS = {
    // الأخضر الرئيسي وتدرجاته
    primaryGreen: '#1a5f2a',
    lightGreen: '#2d8a3e',
    brightGreen: '#3daa52',
    paleGreen: '#e8f5e9',
    
    // الذهبي المميز
    gold: '#f4c430',
    lightGold: '#f7d970',
    
    // الأحمر للتنبيه
    red: '#c41e3a',
    lightRed: '#e74c3c'
};

// دالة لحساب النسبة المئوية
function calculatePercentage(value, total) {
    if (total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
}

// دالة إنشاء plugin لعرض النسب المئوية داخل الرسم البياني
const percentagePlugin = {
    id: 'percentageLabel',
    afterDatasetsDraw(chart, args, options) {
        const { ctx } = chart;
        
        chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            
            if (chart.config.type === 'pie' || chart.config.type === 'doughnut') {
                meta.data.forEach((element, index) => {
                    const data = dataset.data[index];
                    const total = dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = calculatePercentage(data, total);
                    
                    if (data > 0 && percentage > 0) {
                        const { x, y } = element.tooltipPosition();
                        
                        ctx.save();
                        ctx.font = `bold ${options.fontSize || 14}px Cairo, sans-serif`;
                        ctx.fillStyle = options.textColor || '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        
                        // خلفية للنص
                        const text = `${percentage}%`;
                        const textWidth = ctx.measureText(text).width;
                        const padding = 6;
                        
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        ctx.beginPath();
                        ctx.roundRect(
                            x - textWidth/2 - padding, 
                            y - (options.fontSize || 14)/2 - padding, 
                            textWidth + padding * 2, 
                            (options.fontSize || 14) + padding * 2,
                            6
                        );
                        ctx.fill();
                        
                        // النص نفسه
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(text, x, y + 1);
                        ctx.restore();
                    }
                });
            }
        });
    }
};

// تسجيل الـ plugin
Chart.register(percentagePlugin);

async function initCharts() {
    // تحديث ألوان Chart.js الافتراضية
    Chart.defaults.color = '#1f2937';
    Chart.defaults.font.family = 'Cairo, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.font.weight = '600';
    
    try {
        const res = await fetch(`${CHARTS_API_URL}/stats`);
        const data = await res.json();
        
        // ألوان السؤال الأول (الرضا) - أخضر وذهبي
        const q1Colors = [CHART_COLORS.brightGreen, CHART_COLORS.gold];
        
        // ألوان السؤال الثاني (التأييد) - أخضر فاتح وأحمر
        const q2Colors = [CHART_COLORS.lightGreen, CHART_COLORS.red];
        
        // ألوان السؤال الثالث (الاختيار) - ذهبي وأخضر داكن
        const q3Colors = [CHART_COLORS.gold, CHART_COLORS.primaryGreen];

        const ctx1 = document.getElementById('q1Chart');
        if (ctx1) {
            if (q1Chart) q1Chart.destroy();
            const q1Total = (data.q1_satisfied || 0) + (data.q1_not || 0);
            q1Chart = new Chart(ctx1, { 
                type: 'pie', 
                data: { 
                    labels: ['راضي جداً', 'غير راضي'], 
                    datasets: [{ 
                        data: [data.q1_satisfied || 0, data.q1_not || 0], 
                        backgroundColor: q1Colors,
                        borderColor: '#ffffff',
                        borderWidth: 3,
                        hoverOffset: 10
                    }] 
                }, 
                options: { 
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { 
                        percentageLabel: {
                            fontSize: 15,
                            textColor: '#ffffff'
                        },
                        title: { 
                            display: true, 
                            text: 'مدى الرضا عن الإدارة الحالية',
                            font: { size: 14, weight: '700' },
                            padding: { bottom: 20 },
                            color: CHART_COLORS.primaryGreen
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 15,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                font: { size: 11 },
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const percentage = calculatePercentage(value, q1Total);
                                        return {
                                            text: `${label} (${value} - ${percentage}%)`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            hidden: false,
                                            index: i,
                                            pointStyle: 'circle'
                                        };
                                    });
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.parsed;
                                    const percentage = calculatePercentage(value, q1Total);
                                    return `${context.label}: ${value} صوت (${percentage}%)`;
                                }
                            }
                        }
                    }
                } 
            });
        }

        const ctx2 = document.getElementById('q2Chart');
        if (ctx2) {
            if (q2Chart) q2Chart.destroy();
            const q2Total = (data.q2_yes || 0) + (data.q2_no || 0);
            q2Chart = new Chart(ctx2, { 
                type: 'doughnut', 
                data: { 
                    labels: ['نعم، أؤيد', 'لا أؤيد'], 
                    datasets: [{ 
                        data: [data.q2_yes || 0, data.q2_no || 0], 
                        backgroundColor: q2Colors,
                        borderColor: '#ffffff',
                        borderWidth: 3,
                        hoverOffset: 10
                    }] 
                }, 
                options: { 
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '55%',
                    plugins: { 
                        percentageLabel: {
                            fontSize: 15,
                            textColor: '#ffffff'
                        },
                        title: { 
                            display: true, 
                            text: 'تأييد قيادة الشباب للمركز',
                            font: { size: 14, weight: '700' },
                            padding: { bottom: 20 },
                            color: CHART_COLORS.primaryGreen
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 15,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                font: { size: 11 },
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const percentage = calculatePercentage(value, q2Total);
                                        return {
                                            text: `${label} (${value} - ${percentage}%)`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            hidden: false,
                                            index: i,
                                            pointStyle: 'circle'
                                        };
                                    });
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.parsed;
                                    const percentage = calculatePercentage(value, q2Total);
                                    return `${context.label}: ${value} صوت (${percentage}%)`;
                                }
                            }
                        }
                    }
                } 
            });
        }

        const ctx3 = document.getElementById('q3Chart');
        if (ctx3) {
            if (q3Chart) q3Chart.destroy();
            const q3Total = (data.q3_new || 0) + (data.q3_current || 0);
            q3Chart = new Chart(ctx3, { 
                type: 'bar', 
                data: { 
                    labels: ['شباب جديد', 'الإدارة الحالية'], 
                    datasets: [{ 
                        label: 'الأصوات', 
                        data: [data.q3_new || 0, data.q3_current || 0], 
                        backgroundColor: [CHART_COLORS.gold, CHART_COLORS.primaryGreen],
                        borderColor: [CHART_COLORS.lightGold, CHART_COLORS.lightGreen],
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false
                    }] 
                }, 
                options: { 
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { 
                        title: { 
                            display: true, 
                            text: 'اختيار الانتخابات القادمة',
                            font: { size: 14, weight: '700' },
                            padding: { bottom: 20 },
                            color: CHART_COLORS.primaryGreen
                        },
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.parsed.y;
                                    const percentage = calculatePercentage(value, q3Total);
                                    return `${context.dataset.label}: ${value} (${percentage}%)`;
                                }
                            }
                        },
                        // إضافة datalabels-like functionality
                        datalabels: {
                            display: true
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                font: { weight: '600' },
                                callback: function(value) {
                                    return value;
                                }
                            },
                            grid: {
                                color: 'rgba(29, 95, 42, 0.08)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                font: { weight: '600' }
                            }
                        }
                    }
                } 
            });

            // إضافة النسب المئوية فوق الأعمدة يدوياً
            const renderPercentageAboveBars = () => {
                const chartInstance = q3Chart;
                const ctx = chartInstance.ctx;
                
                ctx.font = 'bold 12px Cairo, sans-serif';
                ctx.textAlign = 'center';
                
                const dataset = chartInstance.data.datasets[0];
                dataset.data.forEach((value, index) => {
                    if (value > 0) {
                        const meta = chartInstance.getDatasetMeta(0);
                        const bar = meta.data[index];
                        if (bar) {
                            const percentage = calculatePercentage(value, q3Total);
                            const x = bar.x;
                            const y = bar.y - 8;
                            
                            ctx.fillStyle = CHART_COLORS.primaryGreen;
                            ctx.fillText(`${percentage}%`, x, y);
                        }
                    }
                });
            };

            // استدعاء بعد الرسم
            q3Chart.options.plugins.afterDatasetsDraw = [renderPercentageAboveBars];
        }

        // تحديث العدادات مع أنيميون
        if (typeof gsap !== 'undefined') {
            const vidEl = document.getElementById('vid-count');
            const audEl = document.getElementById('aud-count');
            if (vidEl) gsap.to(vidEl, { innerHTML: data.video_count || 0, roundProps: "innerHTML", duration: 1.5 });
            if (audEl) gsap.to(audEl, { innerHTML: data.audio_count || 0, roundProps: "innerHTML", duration: 1.5 });
        }
    } catch (error) { 
        console.error("Error fetching stats:", error); 
    }
}
window.initCharts = initCharts;
