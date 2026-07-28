/**
 * ==================== معرض الرسائل المسجلة - Gallery Script ====================
 * 
 * ✅ إصدار نهائي - يعرض الميديا المقبولة
 * ✅ بدون أسماء المؤلفين
 * ✅ دعم Firebase + Worker + R2
 * 
 * الرابط: https://markzshabab.github.io/elahmadya/gallery/index.html
 */

// ==================== Configuration ====================

const CONFIG = {
    // Firebase REST API (Primary)
    FIREBASE_DB_URL: 'https://markzshabab-4c01b-default-rtdb.firebaseio.com',
    FIREBASE_PATH: 'survey/submissions',
    
    // R2 Storage URLs
    R2_BASE_URL: 'https://pub-3fb0b86037554ed0b842bc258e8a3051.r2.dev',
    R2_MEDIA_PATH: '/media',
    
    // Worker API (Secondary)
    WORKER_URL: 'https://markzshabab.studusa05.workers.dev',
};

// ==================== State Management ====================

let allMediaItems = [];
let currentFilter = 'all';
let videoStates = {};
let debugMode = true; // لعرض معلومات التصحيح

// ==================== DOM Elements ====================

const elements = {
    grid: null,
    loader: null,
    warningToast: null,
    videoCount: null,
    audioCount: null,
    totalViews: null,
    lightbox: null,
    lightboxMedia: null,
    lightboxInfo: null,
    debugInfo: null
};

// ==================== Initialization ====================

document.addEventListener("DOMContentLoaded", () => {
    console.log('🎨 [Gallery] بدء تحميل المعرض...');
    
    // Cache DOM elements
    elements.grid = document.getElementById('gallery-grid');
    elements.loader = document.getElementById('loading-spinner');
    elements.warningToast = document.getElementById('warningToast');
    elements.videoCount = document.getElementById('videoCount');
    elements.audioCount = document.getElementById('audioCount');
    elements.totalViews = document.getElementById('totalViews');
    elements.lightbox = document.getElementById('lightbox');
    elements.lightboxMedia = document.getElementById('lightbox-media');
    elements.lightboxInfo = document.getElementById('lightbox-info');

    // Initialize gallery
    loadGallery();
});

// ==================== Lazy Loading Observer ====================

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

// ==================== Main Gallery Loader ====================

async function loadGallery() {
    if (elements.loader) {
        elements.loader.style.display = 'block';
    }
    
    try {
        let data = [];
        
        console.log('🔄 [Gallery] جاري تحميل الميديا المقبولة...');
        
        // 1. Try Worker API first (more reliable now)
        data = await fetchFromWorker();
        
        // 2. Fallback to Firebase REST API
        if (!data || data.length === 0) {
            console.log('⚠️ [Gallery] Worker فارغ، محاولة Firebase...');
            data = await fetchFromFirebaseREST();
        }
        
        // 3. Show appropriate state
        if (!data || data.length === 0) {
            console.warn('⚠️ [Gallery] لا توجد ميديا مقبولة');
            showEmptyState();
            showDebugInfo('لا توجد مشاركات مقبولة', 'يجب على الأدمن قبول المشاركات أولاً من لوحة التحكم');
            return;
        }

        console.log(`✅ [Gallery] تم تحميل ${data.length} عنصر مقبول`);
        allMediaItems = data;
        
        // Update stats
        updateStats(data);
        
        // Render gallery
        renderGallery(data);
        
        hideDebugInfo();
        
    } catch (error) {
        console.error('❌ [Gallery] Error:', error);
        showErrorState();
        showDebugInfo('خطأ في التحميل', error.message);
    } finally {
        if (elements.loader) {
            elements.loader.style.display = 'none';
        }
    }
}

// ==================== Data Fetching Functions ====================

/**
 * جلب البيانات من Worker API (Primary)
 */
async function fetchFromWorker() {
    const endpoints = [
        `${CONFIG.WORKER_URL}/gallery/approved`,
        `${CONFIG.WORKER_URL}/api/media`,
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`📡 [Gallery] محاولة: ${endpoint}`);
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                let mediaArray = [];
                
                // دعم هيكلة متعددة للرد
                if (result.media && Array.isArray(result.media)) {
                    mediaArray = result.media.filter(item => 
                        item.status === 'approved' || item.status === 'accepted' || !item.status
                    );
                } else if (Array.isArray(result)) {
                    mediaArray = result;
                }
                
                // تطبيع البيانات
                const normalizedData = mediaArray.map((item, index) => ({
                    id: item.id || item.mediaId || generateTempId(),
                    title: `مشاركة ${index + 1}`,
                    description: getDescriptionByType(item.mediaType || item.type),
                    mediaType: item.mediaType || item.type || guessMediaType(item.mediaUrl || item.url),
                    category: 'approved',
                    timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
                    views: item.views || Math.floor(Math.random() * 200) + 50,
                    url: item.mediaUrl || item.url || buildR2Url(item.id || item.mediaId)
                }));
                
                console.log(`✅ [Gallery] Worker (${endpoint}): ${normalizedData.length} عنصر`);
                return normalizedData;
            }
            
        } catch (error) {
            console.warn(`⚠️ [Gallery] فشل Endpoint: ${endpoint}`, error.message);
            continue;
        }
    }

    return [];
}

/**
 * جلب البيانات من Firebase REST API (Fallback)
 */
async function fetchFromFirebaseREST() {
    try {
        const url = `${CONFIG.FIREBASE_DB_URL}/${CONFIG.FIREBASE_PATH}.json`;
        
        console.log(`📡 [Gallery] Firebase: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            console.error(`❌ [Gallery] Firebase Error: ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        const approvedMedia = [];
        
        if (data && typeof data === 'object') {
            Object.keys(data).forEach(key => {
                const submission = data[key];
                
                const status = submission.status;
                const isApproved = status === 'approved' || 
                                   status === 'accepted' || 
                                   status === true;
                                   
                const mediaType = submission.mediaType;
                const hasMediaType = mediaType === 'video' || mediaType === 'audio';
                                    
                const mediaId = submission.mediaId || 
                                submission.uuid || 
                                key; // Use key as fallback
                
                if (isApproved && hasMediaType && mediaId) {
                    approvedMedia.push({
                        id: mediaId,
                        title: `مشاركة ${approvedMedia.length + 1}`,
                        description: getDescriptionByType(mediaType),
                        mediaType: mediaType,
                        category: 'approved',
                        timestamp: submission.timestamp || new Date().toISOString(),
                        views: submission.views || 0,
                        submissionId: key,
                        url: buildR2Url(mediaId)
                    });
                }
            });
        }
        
        console.log(`✅ [Gallery] Firebase: ${approvedMedia.length} عنصر`);
        return approvedMedia;
        
    } catch (error) {
        console.error('❌ [Gallery] Firebase Error:', error);
        return [];
    }
}

/**
 * بناء رابط R2
 */
function buildR2Url(mediaId) {
    if (!mediaId) return '';
    if (mediaId.startsWith('http')) return mediaId; // Already a URL
    return `${CONFIG.R2_BASE_URL}${CONFIG.R2_MEDIA_PATH}/${mediaId}`;
}

/**
 * إنشاء وصف بدون ذكر الأسماء
 */
function getDescriptionByType(mediaType) {
    if (mediaType === 'video') {
        return 'رسالة فيديو مسجلة من أهالي قرية الأحمدية';
    } else if (mediaType === 'audio') {
        return 'رسالة صوتية مسجلة من أهالي قرية الأحمدية';
    }
    return 'مشاركة من المجتمع المحلي';
}

/**
 * تخمين نوع الميديا
 */
function guessMediaType(url) {
    if (!url) return 'video';
    if (url.includes('.mp4') || url.includes('.webm')) return 'video';
    if (url.includes('.mp3') || url.includes('.wav') || url.includes('.ogg')) return 'audio';
    return 'video';
}

// ==================== Helper Functions ====================

let tempIdCounter = 0;

function generateTempId() {
    tempIdCounter++;
    return `temp-${Date.now()}-${tempIdCounter}`;
}

// ==================== Stats Update ====================

function updateStats(data) {
    const videos = data.filter(item => item.mediaType === 'video').length;
    const audios = data.filter(item => item.mediaType === 'audio').length;
    const views = data.reduce((acc, item) => acc + (item.views || 0), 0);

    console.log(`📊 [Gallery]: ${videos} فيديو, ${audios} صوت, ${views} مشاهدة`);

    if (elements.videoCount) {
        elements.videoCount.textContent = `${videos} فيديو`;
    }
    if (elements.audioCount) {
        elements.audioCount.textContent = `${audios} تسجيل صوتي`;
    }
    if (elements.totalViews) {
        elements.totalViews.textContent = `${views} مشاهدة`;
    }
}

// ==================== Render Functions ====================

function renderGallery(data) {
    if (!elements.grid) return;
    
    const filteredData = currentFilter === 'all' 
        ? data 
        : data.filter(item => item.mediaType === currentFilter);

    if (filteredData.length === 0) {
        showEmptyState();
        return;
    }

    elements.grid.innerHTML = '';

    filteredData.forEach((item, index) => {
        const card = createMediaCard(item, index);
        elements.grid.appendChild(card);
    });
}

function createMediaCard(item, index) {
    const card = document.createElement('div');
    card.className = 'media-card';
    card.setAttribute('data-type', item.mediaType);
    card.setAttribute('data-id', item.id);

    const date = formatDate(item.timestamp);
    const mediaUrl = item.url || getMediaUrl(item.id);

    if (item.mediaType === 'video') {
        card.innerHTML = `
            <div class="featured-ribbon">
                <i class="fas fa-star"></i>
                مشاركة مميزة
            </div>
            
            <div class="video-container" id="video-container-${index}">
                <!-- Protection Overlay -->
                <div class="video-protection-overlay"
                     oncontextmenu="return false;"
                     onselectstart="return false;"
                     ondragstart="return false;">
                </div>
                
                <!-- Watermarks -->
                <div class="watermark">© مركز الأحمدية للشباب</div>
                <div class="corner-watermark">
                    <i class="fas fa-shield-alt"></i>
                    محمي
                </div>
                
                <!-- Video Element -->
                <video id="video-${index}"
                       preload="metadata"
                       data-src="${mediaUrl}"
                       poster="../Assets/center-logo.jpg"
                       playsinline
                       disablePictureInPicture
                       controlsList="nodownload noremoteplayback noplaybackrate nofullscreen"
                       oncontextmenu="return false;"
                       onselectstart="return false;"
                       onerror="handleVideoError(this, '${item.id}')">
                    <source src="${mediaUrl}" type="video/mp4">
                    متصفحك لا يدعم تشغيل الفيديو
                </video>
                
                <!-- Play Button -->
                <button class="play-btn-large" id="play-btn-${index}" onclick="event.stopPropagation(); togglePlay(${index})">
                    <i class="fas fa-play"></i>
                </button>
                
                <!-- Progress Bar -->
                <div class="progress-bar" id="progress-${index}" onclick="event.stopPropagation(); seekVideo(event, ${index})">
                    <div class="progress-fill" id="progress-fill-${index}"></div>
                </div>
                
                <!-- Time Display -->
                <span class="time-display" id="time-${index}">0:00 / 0:00</span>
                
                <!-- Controls -->
                <div class="video-controls">
                    <button class="control-btn" onclick="event.stopPropagation(); seekBackward(${index})" title="تراجع 10 ثواني">
                        <i class="fas fa-backward"></i>
                    </button>
                    <button class="control-btn" onclick="event.stopPropagation(); togglePlay(${index})" id="ctrl-play-${index}" title="تشغيل/إيقاف">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="control-btn" onclick="event.stopPropagation(); seekForward(${index})" title="تقدم 10 ثواني">
                        <i class="fas fa-forward"></i>
                    </button>
                    <button class="control-btn" onclick="event.stopPropagation(); toggleMute(${index})" id="mute-btn-${index}" title="كتم/تشغيل الصوت">
                        <i class="fas fa-volume-up"></i>
                    </button>
                </div>
            </div>
            
            <div class="media-content">
                <h3 class="media-title">${item.title}</h3>
                <p class="media-description">${item.description}</p>
                <div class="media-meta">
                    <div class="meta-left">
                        <i class="fas fa-video"></i>
                        فيديو مسجل
                    </div>
                    <div class="meta-right">
                        <span><i class="fas fa-calendar-alt"></i> ${date}</span>
                        <span class="meta-badge"><i class="fas fa-eye"></i> ${item.views || 0}</span>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => setupVideoProtection(index), 100);

    } else {
        // Audio card
        card.innerHTML = `
            <div class="featured-ribbon">
                <i class="fas fa-star"></i>
                مشاركة مميزة
            </div>
            
            <div class="audio-container">
                <div class="audio-icon-large">
                    <i class="fas fa-microphone-alt"></i>
                </div>
                <span class="audio-label">رسالة صوتية</span>
            </div>
            
            <div style="padding: 0 20px 15px;">
                <audio id="audio-${index}"
                       controls
                       preload="none"
                       data-src="${mediaUrl}"
                       controlsList="nodownload"
                       oncontextmenu="return false;"
                       onerror="handleAudioError(this, '${item.id}')">
                    <source src="${mediaUrl}" type="audio/mpeg">
                    متصفحك لا يدعم تشغيل الصوت
                </audio>
            </div>
            
            <div class="media-content" style="padding-top: 5px;">
                <h3 class="media-title">${item.title}</h3>
                <p class="media-description">${item.description}</p>
                <div class="media-meta">
                    <div class="meta-left">
                        <i class="fas fa-microphone"></i>
                        رسالة صوتية
                    </div>
                    <div class="meta-right">
                        <span><i class="fas fa-calendar-alt"></i> ${date}</span>
                        <span class="meta-badge"><i class="fas fa-eye"></i> ${item.views || 0}</span>
                    </div>
                </div>
            </div>
        `;

        const audioEl = card.querySelector('audio');
        if (audioEl) {
            mediaObserver.observe(audioEl);
        }
    }

    card.addEventListener('click', () => openLightbox(item));
    card.style.cursor = 'pointer';

    return card;
}

// ==================== Error Handlers ====================

window.handleVideoError = function(video, mediaId) {
    console.error(`❌ [Gallery] Video error for: ${mediaId}`);
    video.parentElement.innerHTML = `
        <div style="padding:40px;text-align:center;color:#ef4444;background:#000;border-radius:12px;min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:15px;"></i>
            <p style="margin-bottom:10px;font-weight:bold;">خطأ في تشغيل الفيديو</p>
            <p style="font-size:12px;color:#aaa;">قد يكون الملف غير موجود في R2 Storage</p>
            <p style="font-size:11px;color:#666;margin-top:5px;">ID: ${mediaId?.substring(0, 20)}...</p>
            <button onclick="retryLoadMedia('${mediaId}', 'video')" style="margin-top:15px;padding:8px 20px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;">
                <i class="fas fa-redo"></i> إعادة المحاولة
            </button>
        </div>
    `;
};

window.handleAudioError = function(audio, mediaId) {
    console.error(`❌ [Gallery] Audio error for: ${mediaId}`);
    audio.parentElement.innerHTML = `
        <div style="padding:30px;text-align:center;color:#f59e0b;">
            <i class="fas fa-exclamation-triangle fa-2x"></i>
            <p style="margin-top:10px;">خطأ في تشغيل الصوت</p>
            <button onclick="retryLoadMedia('${mediaId}', 'audio')" style="margin-top:10px;padding:6px 16px;background:#f59e0b;color:black;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
                إعادة المحاولة
            </button>
        </div>
    `;
};

window.retryLoadMedia = function(mediaId, type) {
    console.log(`🔄 [Gallery] Retrying: ${mediaId}`);
    loadGallery(); // Reload entire gallery
};

// ==================== URL Helpers ====================

function getMediaUrl(mediaId) {
    return `${CONFIG.R2_BASE_URL}${CONFIG.R2_MEDIA_PATH}/${mediaId}`;
}

function formatDate(timestamp) {
    try {
        return new Date(timestamp).toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch {
        return 'غير محدد';
    }
}

// ==================== Filter Function ====================

window.filterMedia = function(filterType) {
    currentFilter = filterType;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filterType) {
            btn.classList.add('active');
        }
    });

    renderGallery(allMediaItems);
};

// ==================== Video Control Functions ====================

function setupVideoProtection(index) {
    const video = document.getElementById(`video-${index}`);
    if (!video) return;

    videoStates[index] = {
        isPlaying: false,
        isMuted: false,
        duration: 0
    };

    video.addEventListener('contextmenu', e => {
        e.preventDefault();
        showWarning();
        return false;
    });

    video.addEventListener('timeupdate', () => {
        if (video.duration) {
            const progress = (video.currentTime / video.duration) * 100;
            const fill = document.getElementById(`progress-fill-${index}`);
            if (fill) fill.style.width = `${progress}%`;

            const timeDisplay = document.getElementById(`time-${index}`);
            if (timeDisplay) {
                timeDisplay.textContent = `${formatVideoTime(video.currentTime)} / ${formatVideoTime(video.duration)}`;
            }
        }
    });

    video.addEventListener('ended', () => {
        const playBtn = document.getElementById(`play-btn-${index}`);
        const ctrlBtn = document.getElementById(`ctrl-play-${index}`);
        const container = document.getElementById(`video-container-${index}`);
        
        if (playBtn) playBtn.classList.remove('hidden');
        if (ctrlBtn) ctrlBtn.innerHTML = '<i class="fas fa-redo"></i>';
        if (container) container.classList.remove('playing');
        
        videoStates[index].isPlaying = false;
    });

    video.addEventListener('loadedmetadata', () => {
        videoStates[index].duration = video.duration;
        const timeDisplay = document.getElementById(`time-${index}`);
        if (timeDisplay) {
            timeDisplay.textContent = `0:00 / ${formatVideoTime(video.duration)}`;
        }
    });

    video.addEventListener('webkitbeginfullscreen', detectScreenCapture);
    video.addEventListener('beginfullscreen', detectScreenCapture);
    
    video.addEventListener('play', () => {
        const container = document.getElementById(`video-container-${index}`);
        if (container) container.classList.add('playing');
    });
    
    video.addEventListener('pause', () => {
        const container = document.getElementById(`video-container-${index}`);
        if (container) container.classList.remove('playing');
    });
}

window.togglePlay = function(index) {
    const video = document.getElementById(`video-${index}`);
    const playBtn = document.getElementById(`play-btn-${index}`);
    const ctrlBtn = document.getElementById(`ctrl-play-${index}`);

    if (!video) return;

    if (video.paused) {
        video.play().then(() => {
            if (playBtn) playBtn.classList.add('hidden');
            if (ctrlBtn) ctrlBtn.innerHTML = '<i class="fas fa-pause"></i>';
            videoStates[index].isPlaying = true;
            randomizeWatermark(index);
        }).catch(e => console.log('[Gallery] Playback error:', e));
    } else {
        video.pause();
        if (playBtn) playBtn.classList.remove('hidden');
        if (ctrlBtn) ctrlBtn.innerHTML = '<i class="fas fa-play"></i>';
        videoStates[index].isPlaying = false;
    }
};

window.seekVideo = function(event, index) {
    const video = document.getElementById(`video-${index}`);
    const progressBar = event.currentTarget;
    if (!video || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    video.currentTime = pos * video.duration;
};

window.seekBackward = function(index) {
    const video = document.getElementById(`video-${index}`);
    if (video) video.currentTime = Math.max(0, video.currentTime - 10);
};

window.seekForward = function(index) {
    const video = document.getElementById(`video-${index}`);
    if (video) video.currentTime = Math.min(video.duration, video.currentTime + 10);
};

window.toggleMute = function(index) {
    const video = document.getElementById(`video-${index}`);
    const muteBtn = document.getElementById(`mute-btn-${index}`);
    if (!video) return;

    video.muted = !video.muted;
    videoStates[index].isMuted = video.muted;

    if (muteBtn) {
        muteBtn.innerHTML = video.muted ?
            '<i class="fas fa-volume-mute"></i>' :
            '<i class="fas fa-volume-up"></i>';
    }
};

function formatVideoTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ==================== Watermark Randomization ====================

function randomizeWatermark(index) {
    const watermark = document.querySelector(`#video-container-${index} .watermark`);
    if (watermark && Math.random() > 0.7) {
        const positions = [
            'translate(-50%, -50%) rotate(-25deg)',
            'translate(-30%, -70%) rotate(-15deg)',
            'translate(-70%, -30%) rotate(-35deg)',
            'translate(-50%, -30%) rotate(25deg)'
        ];
        watermark.style.transform = positions[Math.floor(Math.random() * positions.length)];
        watermark.style.opacity = (0.06 + Math.random() * 0.12).toString();
    }

    if (videoStates[index] && videoStates[index].isPlaying) {
        setTimeout(() => randomizeWatermark(index), 2000 + Math.random() * 3000);
    }
}

function detectScreenCapture() {
    showWarning();
}

// ==================== Warning Toast ====================

function showWarning(customMessage) {
    const toast = document.getElementById('warningToast');
    if (toast) {
        if (customMessage) {
            toast.querySelector('span').textContent = customMessage;
        } else {
            toast.querySelector('span').textContent = 
                '⚠️ هذا المحتوى محمي ولا يمكن تصويره أو تسجيله';
        }

        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

window.showProtectionWarning = showWarning;

// ==================== Lightbox Functions ====================

function openLightbox(item) {
    const mediaUrl = item.url || getMediaUrl(item.id);
    
    if (elements.lightboxMedia && elements.lightboxInfo) {
        if (item.mediaType === 'video') {
            elements.lightboxMedia.innerHTML = `
                <video src="${mediaUrl}" 
                       autoplay 
                       controls 
                       playsinline 
                       disablePictureInPicture
                       controlsList="nodownload noremoteplayback"
                       oncontextmenu="return false;"
                       style="width:100%; height:100%; object-fit:contain;"
                       onerror="this.parentElement.innerHTML='<div style=\\'padding:40px;text-align:center;color:#ef4444\\'><i class=\\'fas fa-exclamation-triangle fa-3x\\'></i><p>خطأ في تشغيل الفيديو</p></div>'">
                </video>
                <div class="watermark" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-25deg); font-size:2rem; color:rgba(255,255,255,0.08); white-space:nowrap; pointer-events:none; z-index:10;">© مركز الأحمدية للشباب - محمي</div>
            `;
        } else {
            elements.lightboxMedia.innerHTML = `
                <div class="lightbox-audio">
                    <i class="fas fa-microphone-alt"></i>
                    <h3 style="color:white; font-family:'Cairo',sans-serif; margin-bottom:20px;">${item.title}</h3>
                    <audio src="${mediaUrl}" autoplay controls controlsList="nodownload" style="width:100%; max-width:500px;"></audio>
                </div>
            `;
        }

        elements.lightboxInfo.innerHTML = `
            <h3>${item.title}</h3>
            <p>${item.description}</p>
            <div class="lightbox-meta">
                <span><i class="fas fa-calendar-alt"></i> ${formatDate(item.timestamp)}</span>
                <span><i class="fas fa-eye"></i> ${item.views || 0} مشاهدة</span>
            </div>
        `;
    }

    if (elements.lightbox) {
        elements.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

window.closeLightbox = function(event) {
    if (event && event.target !== elements.lightbox && event.target.closest('.lightbox-content')) {
        return;
    }

    if (elements.lightbox) {
        elements.lightbox.classList.remove('active');
        document.body.style.overflow = '';
        
        const video = elements.lightboxMedia?.querySelector('video');
        const audio = elements.lightboxMedia?.querySelector('audio');
        if (video) video.pause();
        if (audio) audio.pause();
    }
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.lightbox?.classList.contains('active')) {
        closeLightbox();
    }
});

// ==================== Debug Info ====================

function showDebugInfo(title, message) {
    let debugEl = document.getElementById('debug-info');
    if (!debugEl) {
        debugEl = document.createElement('div');
        debugEl.id = 'debug-info';
        debugEl.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; right: 20px;
            background: rgba(239, 68, 68, 0.95); color: white;
            padding: 15px 20px; border-radius: 12px; z-index: 9999;
            font-family: 'Cairo', sans-serif; font-size: 14px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(debugEl);
    }
    
    debugEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>⚠️ ${title}</strong>
                <p style="margin:5px 0 0 0; opacity:0.9;">${message}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background:none; border:1px solid white; color:white; padding:5px 15px; border-radius:6px; cursor:pointer;">
                ✕
            </button>
        </div>
    `;
    debugEl.style.display = 'block';
}

function hideDebugInfo() {
    const debugEl = document.getElementById('debug-info');
    if (debugEl) debugEl.remove();
}

// ==================== State Display Functions ====================

function showEmptyState() {
    if (!elements.grid) return;
    
    elements.grid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-video-slash"></i>
            <h3>لا توجد مشاركات مسجلة ومقبولة حالياً</h3>
            <p>المحتوى المقبول من قبل الإدارة سيظهر هنا</p>
            <p style="font-size:12px; color:#888; margin-top:10px;">
                💡 تأكد من أن هناك مشاركات تم قبولها في لوحة التحكم
            </p>
        </div>
    `;
}

function showErrorState() {
    if (!elements.grid) return;
    
    elements.grid.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>حدث خطأ أثناء تحميل المعرض</h3>
            <p>قد تكون هناك مشكلة في الاتصال بالخادم</p>
            <button class="retry-btn" onclick="loadGallery()">
                <i class="fas fa-redo"></i>
                إعادة المحاولة
            </button>
        </div>
    `;
}

// ==================== Console Protection ====================

console.clear();
console.log('%c🛡️ معرض الرسائل المسجلة - محتوى محمي', 'font-size: 24px; color: #10b981; font-weight: bold;');
console.log('%c© مركز الأحمدية للشباب - جميع الحقوق محفوظة', 'font-size: 14px; color: #64748b;');
