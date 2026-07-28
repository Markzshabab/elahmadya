const WORKER_URL = 'https://markzshabab.studusa05.workers.dev';

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById('gallery-grid');
    const loader = document.getElementById('loading-spinner');
    
    // Lazy loading مع حماية
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
            // محاولة تحميل الميديا من نقاط مختلفة
            let data = [];
            
            // النقطة الأولى
            try {
                const res1 = await fetch(`${WORKER_URL}/api/media`);
                if (res1.ok) {
                    data = await res1.json();
                    data = data.media || [];
                }
            } catch (e) {
                console.log('Endpoint 1 failed, trying alternative...');
            }
            
            // النقطة البديلة إذا فشلت الأولى
            if (!data || data.length === 0) {
                try {
                    const res2 = await fetch(`${WORKER_URL}/gallery/approved`);
                    if (res2.ok) {
                        data = await res2.json();
                        if (!Array.isArray(data)) data = [];
                    }
                } catch (e) {
                    console.log('All endpoints failed');
                }
            }

            if (!data || data.length === 0) {
                if (grid) grid.innerHTML = `
                    <div style="text-align:center; grid-column: 1/-1; padding: 40px;">
                        <i class="fas fa-video-slash fa-4x" style="color: var(--text-light); margin-bottom: 20px;"></i>
                        <p style="color: var(--text-light); font-size: 1.1rem;">لا توجد مشاركات مسجلة ومقبولة حالياً</p>
                        <p style="color: var(--text-light); opacity: 0.7; margin-top: 10px; font-size: 0.9rem;">كن أول من يشارك برأيه!</p>
                    </div>
                `;
                return;
            }

            if (grid) grid.innerHTML = '';

            data.forEach((item, index) => {
                const card = document.createElement('div');
                card.className = 'media-card';
                
                const date = item.timestamp ? 
                    new Date(item.timestamp).toLocaleDateString('ar-EG', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    }) : 'غير محدد';
                
                const mediaId = item.id || item.key || `media-${index}`;
                const mediaUrl = item.mediaUrl || item.url || '';

                if (item.mediaType === 'video' || mediaUrl.includes('.mp4') || mediaUrl.includes('.webm')) {
                    // فيديو مع حماية كاملة
                    card.innerHTML = `
                        <div class="video-container" id="video-container-${index}">
                            <!-- طبقة الحماية -->
                            <div class="video-protection-overlay" 
                                 oncontextmenu="return false;"
                                 onselectstart="return false;"
                                 ondragstart="return false;">
                            </div>
                            
                            <!-- العلامة المائية -->
                            <div class="watermark">© مركز الأحمدية للشباب</div>
                            <div class="corner-watermark">
                                <i class="fas fa-shield-alt"></i> محمي
                            </div>
                            
                            <!-- الفيديو -->
                            <video id="video-${index}"
                                   preload="metadata"
                                   data-src="${mediaUrl}"
                                   poster="../Assets/center-logo.jpg"
                                   playsinline
                                   disablePictureInPicture
                                   controlsList="nodownload noremoteplayback noplaybackrate"
                                   oncontextmenu="return false;"
                                   onselectstart="return false;">
                                <source src="${mediaUrl}" type="video/mp4">
                                متصفحك لا يدعم تشغيل الفيديو
                            </video>
                            
                            <!-- زر التشغيل الكبير -->
                            <button class="play-btn-large" id="play-btn-${index}" onclick="togglePlay(${index})">
                                <i class="fas fa-play"></i>
                            </button>
                            
                            <!-- شريط التقدم -->
                            <div class="progress-bar" id="progress-${index}" onclick="seekVideo(event, ${index})">
                                <div class="progress-fill" id="progress-fill-${index}"></div>
                            </div>
                            
                            <!-- عرض الوقت -->
                            <span class="time-display" id="time-${index}">0:00 / 0:00</span>
                            
                            <!-- أزرار التحكم -->
                            <div class="video-controls">
                                <button class="control-btn" onclick="seekBackward(${index})" title="تراجع 10 ثواني">
                                    <i class="fas fa-backward"></i>
                                </button>
                                <button class="control-btn" onclick="togglePlay(${index})" id="ctrl-play-${index}" title="تشغيل/إيقاف">
                                    <i class="fas fa-play"></i>
                                </button>
                                <button class="control-btn" onclick="seekForward(${index})" title="تقدم 10 ثواني">
                                    <i class="fas fa-forward"></i>
                                </button>
                                <button class="control-btn" onclick="toggleMute(${index})" id="mute-btn-${index}" title="كتم/تشغيل الصوت">
                                    <i class="fas fa-volume-up"></i>
                                </button>
                            </div>
                        </div>
                        <div class="media-meta">
                            <i class="fas fa-video"></i> فيديو مسجل
                            <span style="float: left;"><i class="fas fa-calendar-alt"></i> ${date}</span>
                        </div>
                    `;
                    
                    grid.appendChild(card);
                    
                    // إعداد أحداث الفيديو بعد الإضافة للـ DOM
                    setTimeout(() => setupVideoProtection(index), 100);
                    
                } else {
                    // صوتي - حماية أقل
                    card.innerHTML = `
                        <div style="text-align:center; padding: 20px 0; color: var(--primary);">
                            <i class="fas fa-microphone-alt fa-3x"></i>
                            <p style="margin-top: 10px; color: var(--text-light);">رسالة صوتية</p>
                        </div>
                        <audio id="audio-${index}"
                               controls 
                               preload="none" 
                               data-src="${mediaUrl}"
                               controlsList="nodownload"
                               oncontextmenu="return false;">
                            <source src="${mediaUrl}" type="audio/mpeg">
                        </audio>
                        <div class="media-meta">
                            <i class="fas fa-microphone"></i> رسالة صوتية
                            <span style="float: left;"><i class="fas fa-calendar-alt"></i> ${date}</span>
                        </div>
                    `;
                    
                    grid.appendChild(card);
                    const audioEl = card.querySelector('audio');
                    if (audioEl) mediaObserver.observe(audioEl);
                }
            });
            
        } catch (error) {
            console.error('Gallery Error:', error);
            if (grid) grid.innerHTML = `
                <div style="text-align:center; grid-column: 1/-1; padding: 40px;">
                    <i class="fas fa-exclamation-triangle fa-4x" style="color: #f4c430; margin-bottom: 20px;"></i>
                    <p style="color: var(--text-light);">حدث خطأ أثناء تحميل المعرض</p>
                    <button onclick="loadGallery()" class="btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-redo"></i> إعادة المحاولة
                    </button>
                </div>
            `;
        } finally {
            if (loader) loader.style.display = 'none';
        }
    }

    loadGallery();
});

// ==================== دوال التحكم بالفيديوهات ====================

window.videoStates = {};

function setupVideoProtection(index) {
    const video = document.getElementById(`video-${index}`);
    if (!video) return;

    window.videoStates[index] = {
        isPlaying: false,
        isMuted: false,
        duration: 0
    };

    // منع حفظ الفيديو
    video.addEventListener('contextmenu', e => {
        e.preventDefault();
        showWarning();
        return false;
    });

    // تحديث شريط التقدم
    video.addEventListener('timeupdate', () => {
        if (video.duration) {
            const progress = (video.currentTime / video.duration) * 100;
            const fill = document.getElementById(`progress-fill-${index}`);
            if (fill) fill.style.width = `${progress}%`;
            
            // تحديث الوقت
            const timeDisplay = document.getElementById(`time-${index}`);
            if (timeDisplay) {
                timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
            }
        }
    });

    // عند انتهاء الفيديو
    video.addEventListener('ended', () => {
        const playBtn = document.getElementById(`play-btn-${index}`);
        const ctrlBtn = document.getElementById(`ctrl-play-${index}`);
        if (playBtn) playBtn.classList.remove('hidden');
        if (ctrlBtn) ctrlBtn.innerHTML = '<i class="fas fa-redo"></i>';
        window.videoStates[index].isPlaying = false;
    });

    // تحديث مدة الفيديو عند التحميل
    video.addEventListener('loadedmetadata', () => {
        window.videoStates[index].duration = video.duration;
        const timeDisplay = document.getElementById(`time-${index}`);
        if (timeDisplay) {
            timeDisplay.textContent = `0:00 / ${formatTime(video.duration)}`;
        }
    });

    // كشف محاولة تسجيل الشاشة (محدود)
    video.addEventListener('webkitbeginfullscreen', detectScreenCapture);
    video.addEventListener('beginfullscreen', detectScreenCapture);
}

function togglePlay(index) {
    const video = document.getElementById(`video-${index}`);
    const playBtn = document.getElementById(`play-btn-${index}`);
    const ctrlBtn = document.getElementById(`ctrl-play-${index}`);
    
    if (!video) return;

    if (video.paused) {
        video.play().then(() => {
            if (playBtn) playBtn.classList.add('hidden');
            if (ctrlBtn) ctrlBtn.innerHTML = '<i class="fas fa-pause"></i>';
            window.videoStates[index].isPlaying = true;
            
            // تشغيل عشوائي للعلامة المائية لمنع السكرين شوت
            randomizeWatermark(index);
        }).catch(e => console.log('Playback error:', e));
    } else {
        video.pause();
        if (playBtn) playBtn.classList.remove('hidden');
        if (ctrlBtn) ctrlBtn.innerHTML = '<i class="fas fa-play"></i>';
        window.videoStates[index].isPlaying = false;
    }
}

function seekVideo(event, index) {
    const video = document.getElementById(`video-${index}`);
    const progressBar = event.currentTarget;
    if (!video || !progressBar) return;
    
    const rect = progressBar.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    video.currentTime = pos * video.duration;
}

function seekBackward(index) {
    const video = document.getElementById(`video-${index}`);
    if (video) video.currentTime = Math.max(0, video.currentTime - 10);
}

function seekForward(index) {
    const video = document.getElementById(`video-${index}`);
    if (video) video.currentTime = Math.min(video.duration, video.currentTime + 10);
}

function toggleMute(index) {
    const video = document.getElementById(`video-${index}`);
    const muteBtn = document.getElementById(`mute-btn-${index}`);
    if (!video) return;
    
    video.muted = !video.muted;
    window.videoStates[index].isMuted = video.muted;
    
    if (muteBtn) {
        muteBtn.innerHTML = video.muted ? 
            '<i class="fas fa-volume-mute"></i>' : 
            '<i class="fas fa-volume-up"></i>';
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function randomizeWatermark(index) {
    // تغيير موضع العلامة المائية بشكل عشوائي لتعطيل السكرين شوت المتكرر
    const watermark = document.querySelector(`#video-container-${index} .watermark`);
    if (watermark && Math.random() > 0.7) {
        const positions = [
            'translate(-50%, -50%) rotate(-25deg)',
            'translate(-30%, -70%) rotate(-15deg)',
            'translate(-70%, -30%) rotate(-35deg)',
            'translate(-50%, -30%) rotate(25deg)'
        ];
        watermark.style.transform = positions[Math.floor(Math.random() * positions.length)];
        
        // تغيير الشفافية
        watermark.style.opacity = (0.08 + Math.random() * 0.12).toString();
    }
    
    // استمرار التغيير أثناء التشغيل
    if (window.videoStates[index] && window.videoStates[index].isPlaying) {
        setTimeout(() => randomizeWatermark(index), 2000 + Math.random() * 3000);
    }
}

function detectScreenCapture() {
    console.warn('Fullscreen mode detected - screen capture may be attempted');
    showWarning();
}

function showWarning() {
    const toast = document.getElementById('warningToast');
    if (toast) {
        toast.style.display = 'flex';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
}
