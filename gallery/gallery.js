/**
 * Al Ahmadiya Youth Center Survey - Public Gallery Logic
 * Lazy loads approved video and audio messages directly from R2
 */

const WORKER_URL = 'https://markzshabab.studusa05.workers.dev';

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById('gallery-grid');
    const loader = document.getElementById('loading-spinner');

    // IntersectionObserver للتحميل البطيء (Lazy Loading) لتقليل استهلاك الباندويث
    const mediaObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const mediaElement = entry.target;
                if (mediaElement.dataset.src) {
                    mediaElement.src = mediaElement.dataset.src;
                    observer.unobserve(mediaElement);
                }
            }
        });
    }, { rootMargin: "0px 0px 200px 0px" });

    async function loadGallery() {
        if (loader) loader.style.display = 'block';

        try {
            const res = await fetch(`${WORKER_URL}/gallery/approved`);
            const data = await res.json(); 

            if (!data || data.length === 0) {
                if (grid) grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">لا توجد مشاركات مسجلة ومقبولة حالياً.</p>';
                return;
            }

            if (grid) grid.innerHTML = '';

            data.forEach(item => {
                const card = document.createElement('div');
                card.className = 'media-card';
                
                const date = new Date(item.timestamp).toLocaleDateString('ar-EG');
                
                if (item.mediaType === 'video') {
                    card.innerHTML = `
                        <video controls preload="none" data-src="${item.mediaUrl}" poster="../assets/logo.png"></video>
                        <div class="media-meta"><i class="fas fa-calendar-alt"></i> ${date}</div>
                    `;
                } else {
                    card.innerHTML = `
                        <div style="text-align:center; padding: 20px 0; color: var(--primary);"><i class="fas fa-microphone-alt fa-3x"></i></div>
                        <audio controls preload="none" data-src="${item.mediaUrl}"></audio>
                        <div class="media-meta"><i class="fas fa-calendar-alt"></i> ${date}</div>
                    `;
                }
                
                grid.appendChild(card);
                
                const mediaEl = card.querySelector(item.mediaType === 'video' ? 'video' : 'audio');
                if (mediaEl) mediaObserver.observe(mediaEl);
            });

        } catch (error) {
            console.error("Error loading gallery:", error);
            if (grid) grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">حدث خطأ أثناء تحميل المعرض.</p>';
        } finally {
            if (loader) loader.style.display = 'none';
        }
    }

    loadGallery();
});