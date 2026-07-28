/**
 * ==================== معرض الرسائل المسجلة - Gallery Script ====================
 * 
 * R2 Storage Configuration:
 * Base URL: https://pub-3fb0b86037554ed0b842bc258e8a3051.r2.dev
 * Media Path: /media/{id}
 * Categories: media (approved), pending, submissions
 * 
 * Worker API: https://markzshabab.studusa05.workers.dev
 */

// ==================== Configuration ====================

const CONFIG = {
    // R2 Storage URLs
    R2_BASE_URL: 'https://pub-3fb0b86037554ed0b842bc258e8a3051.r2.dev',
    R2_MEDIA_PATH: '/media',
    
    // Worker API (fallback)
    WORKER_URL: 'https://markzshabab.studusa05.workers.dev',
    
    // API Endpoints
    ENDPOINTS: {
        media: '/api/media',
        gallery: '/gallery/approved'
    }
};

// ==================== State Management ====================

let allMediaItems = [];
let currentFilter = 'all';
let videoStates = {};

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
    lightboxInfo: null
};

// ==================== Initialization ====================

document.addEventListener("DOMContentLoaded", () => {
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
        
        // Try multiple endpoints for reliability
        // 1. Try direct R2/Firebase integration first
        data = await fetchFromFirebase();
        
        // 2. Fallback to Worker API
        if (!data || data.length === 0) {
            console.log('Firebase failed, trying Worker API...');
            data = await fetchFromWorker();
        }
        
        // 3. Use sample data as last resort (for demo)
        if (!data || data.length === 0) {
            console.log('Using sample data...');
            data = getSampleData();
        }

        if (!data || data.length === 0) {
            showEmptyState();
            return;
        }

        allMediaItems = data;
        
        // Update stats
        updateStats(data);
        
        // Render gallery
        renderGallery(data);
        
    } catch (error) {
        console.error('Gallery Error:', error);
        showErrorState();
    } finally {
        if (elements.loader) {
            elements.loader.style.display = 'none';
        }
    }
}

// ==================== Data Fetching Functions ====================

/**
 * جلب البيانات من Firebase Realtime Database
 * المسار: survey/submissions/{submissionId}
 * الحالة: status === 'approved'
 */
async function fetchFromFirebase() {
    try {
        // استيراد Firebase ديناميكياً (ES Module)
        const { getDatabase, ref, onValue, get } = await import('../firebase.js');
        
        return new Promise((resolve) => {
            try {
                const db = getDatabase();
                const submissionsRef = ref(db, 'survey/submissions');
                
                // جلب البيانات مرة واحدة
                get(submissionsRef).then((snapshot) => {
                    const data = snapshot.val();
                    const approvedMedia = [];
                    
                    if (data) {
                        Object.keys(data).forEach(key => {
                            const submission = data[key];
                            
                            // فقط العناصر المقبولة التي تحتوي على ميديا
                            if (submission.status === 'approved' && 
                                (submission.mediaType === 'video' || submission.mediaType === 'audio') &&
                                submission.mediaId) {
                                
                                approvedMedia.push({
                                    id: submission.mediaId,
                                    title: submission.title || `مشاركة ${approvedMedia.length + 1}`,
                                    description: submission.description || `رسالة ${submission.mediaType === 'video' ? 'فيديو' : 'صوتية'} من ${submission.authorName || 'مشارك'}`,
                                    mediaType: submission.mediaType,
                                    category: 'approved',
                                    timestamp: submission.timestamp || submission.createdAt || new Date().toISOString(),
                                    author: submission.authorName || 'مجهول',
                                    views: submission.views || Math.floor(Math.random() * 200) + 50,
                                    submissionId: key
                                });
                            }
                        });
                    }
                    
                    console.log(`✅ Firebase: تم جلب ${approvedMedia.length} عنصر`);
                    resolve(approvedMedia);
                    
                }).catch((error) => {
                    console.error('❌ Firebase get error:', error);
                    resolve([]);
                });
                
            } catch (error) {
                console.error('❌ Firebase init error:', error);
                resolve([]);
            }
        });
        
    } catch (error) {
        console.log('⚠️ Firebase module not available:', error.message);
        return [];
    }
}

/**
 * جلب البيانات من Cloud Worker API
 * Endpoints:
 * - /api/media → يرجع { media: [...] }
 * - /gallery/approved → يرجع [...]
 */
async function fetchFromWorker() {
    const endpoints = [
        `${CONFIG.WORKER_URL}/api/media`,
        `${CONFIG.WORKER_URL}/gallery/approved`,
        `${CONFIG.WORKER_URL}/media/approved`,
        `${CONFIG.WORKER_URL}/gallery`
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`🔄 محاولة Worker: ${endpoint}`);
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                let mediaArray = [];
                
                // دعم هيكلة متعددة للرد
                if (result.media && Array.isArray(result.media)) {
                    mediaArray = result.media;
                } else if (Array.isArray(result)) {
                    mediaArray = result;
                } else if (result.data && Array.isArray(result.data)) {
                    mediaArray = result.data;
                } else if (result.approved && Array.isArray(result.approved)) {
                    mediaArray = result.approged;
                }
                
                // تطبيع البيانات
                const normalizedData = mediaArray.map(item => ({
                    id: item.id || item.mediaId || item.key || item.uuid || generateTempId(),
                    title: item.title || item.name || `مشاركة ${item.mediaType === 'video' ? 'فيديو' : 'صوتية'}`,
                    description: item.description || item.desc || item.message || '',
                    mediaType: item.mediaType || item.type || (item.url?.includes('.mp4') ? 'video' : 'audio'),
                    category: item.category || item.status || 'approved',
                    timestamp: item.timestamp || item.createdAt || item.created_at || new Date().toISOString(),
                    author: item.author || item.authorName || item.name || item.submittedBy || 'مجهول',
                    views: item.views || item.viewCount || Math.floor(Math.random() * 150) + 30,
                    url: item.url || item.mediaUrl || null
                }));
                
                console.log(`✅ Worker (${endpoint}): تم جلب ${normalizedData.length} عنصر`);
                return normalizedData;
            }
            
        } catch (error) {
            console.warn(`⚠️ فشل Endpoint: ${endpoint}`, error.message);
            continue;
        }
    }

    return [];
}

/**
 * بيانات تجريبية (Fallback فقط)
 * تستخدم فقط إذا فشلت جميع مصادر البيانات
 */
function getSampleData() {
    console.log('⚠️ استخدام البيانات التجريبية - تأكد من ربط Firebase أو Worker');
    
    // هذه البيانات للعرض فقط - يجب استبدالها بالبيانات الحقيقية
    return [
        {
            id: '00af534d-3dc8-4e6f-af53-64a8a1ebf262',
            title: 'رسالة مميزة من الأهالي',
            description: 'رأي أحد أهالي قرية الأحمدية حول مركز الشباب وتأثيره الإيجابي على المجتمع المحلي',
            mediaType: 'video',
            category: 'approved',
            timestamp: new Date('2026-07-28T14:30:00Z').toISOString(),
            author: 'أحمد محمد',
            views: 145
        },
        {
            id: 'sample-video-2',
            title: 'شهادة من الشباب',
            description: 'تجربة أحد الشباب مع مركز الأحمدية وكيف ساعدهم في تطوير مهاراتهم',
            mediaType: 'video',
            category: 'approved',
            timestamp: new Date('2026-07-27T16:20:00Z').toISOString(),
            author: 'سارة أحمد',
            views: 89
        },
        {
            id: 'sample-audio-1',
            title: 'رسالة صوتية للأهالي',
            description: 'اقتراحات وتطلعات لمستقبل المركز من وجهة نظر أحد الآباء',
            mediaType: 'audio',
            category: 'approved',
            timestamp: new Date('2026-07-26T10:15:00Z').toISOString(),
            author: 'محمد علي',
            views: 67
        },
        {
            id: 'sample-video-3',
            title: 'وقفة مع مدير المركز',
            description: 'حوار حول خطط التطوير المستقبلية ورؤية المركز للسنوات القادمة',
            mediaType: 'video',
            category: 'approved',
            timestamp: new Date('2026-07-25T09:45:00Z').toISOString(),
            author: 'خالد إبراهيم',
            views: 203
        },
        {
            id: 'sample-audio-2',
            title: 'صوت الأمل',
            description: 'تطلعات شباب القرية للمستقبل ودور المركز في تحقيق أحلامهم',
            mediaType: 'audio',
            category: 'approved',
            timestamp: new Date('2026-07-24T13:30:00Z').toISOString(),
            author: 'فاطمة حسن',
            views: 112
        },
        {
            id: 'sample-video-4',
            title: 'من القلب إلى القلب',
            description: 'رسالة عاطفية من أمهات القرية عن أهمية وجود مثل هذا المركز',
            mediaType: 'video',
            category: 'approved',
            timestamp: new Date('2026-07-23T18:00:00Z').toISOString(),
            author: 'نورا سعيد',
            views: 178
        }
    ];
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
    const mediaUrl = getMediaUrl(item.id);

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
                       onselectstart="return false;">
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

        // Setup video after adding to DOM
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
                       oncontextmenu="return false;">
                    <source src="${mediaUrl}" type="audio/mpeg">
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

        // Setup audio lazy loading
        const audioEl = card.querySelector('audio');
        if (audioEl) {
            mediaObserver.observe(audioEl);
        }
    }

    // Add click handler for lightbox
    card.addEventListener('click', () => openLightbox(item));
    card.style.cursor = 'pointer';

    return card;
}

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

    // Update active button state
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filterType) {
            btn.classList.add('active');
        }
    });

    // Re-render with filter
    renderGallery(allMediaItems);
};

// ==================== Video Control Functions ====================

function setupVideoProtection(index) {
    const video = document.getElementById(`video-${index}`);
    if (!video) return;

    // Initialize state
    videoStates[index] = {
        isPlaying: false,
        isMuted: false,
        duration: 0
    };

    // Prevent context menu
    video.addEventListener('contextmenu', e => {
        e.preventDefault();
        showWarning();
        return false;
    });

    // Update progress bar
    video.addEventListener('timeupdate', () => {
        if (video.duration) {
            const progress = (video.currentTime / video.duration) * 100;
            const fill = document.getElementById(`progress-fill-${index}`);
            if (fill) fill.style.width = `${progress}%`;

            // Update time display
            const timeDisplay = document.getElementById(`time-${index}`);
            if (timeDisplay) {
                timeDisplay.textContent = `${formatVideoTime(video.currentTime)} / ${formatVideoTime(video.duration)}`;
            }
        }
    });

    // Video ended
    video.addEventListener('ended', () => {
        const playBtn = document.getElementById(`play-btn-${index}`);
        const ctrlBtn = document.getElementById(`ctrl-play-${index}`);
        const container = document.getElementById(`video-container-${index}`);
        
        if (playBtn) playBtn.classList.remove('hidden');
        if (ctrlBtn) ctrlBtn.innerHTML = '<i class="fas fa-redo"></i>';
        if (container) container.classList.remove('playing');
        
        videoStates[index].isPlaying = false;
    });

    // Metadata loaded
    video.addEventListener('loadedmetadata', () => {
        videoStates[index].duration = video.duration;
        const timeDisplay = document.getElementById(`time-${index}`);
        if (timeDisplay) {
            timeDisplay.textContent = `0:00 / ${formatVideoTime(video.duration)}`;
        }
    });

    // Detect fullscreen (screen capture attempt)
    video.addEventListener('webkitbeginfullscreen', detectScreenCapture);
    video.addEventListener('beginfullscreen', detectScreenCapture);
    
    // Playing state for controls visibility
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
        }).catch(e => console.log('Playback error:', e));
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

// ==================== Screen Capture Detection ====================

function detectScreenCapture() {
    console.warn('Fullscreen mode detected - screen capture may be attempted');
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
    const mediaUrl = getMediaUrl(item.id);
    
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
                       style="width:100%; height:100%; object-fit:contain;">
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
        
        // Stop any playing media
        const video = elements.lightboxMedia?.querySelector('video');
        const audio = elements.lightboxMedia?.querySelector('audio');
        if (video) video.pause();
        if (audio) audio.pause();
    }
};

// Close lightbox with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.lightbox?.classList.contains('active')) {
        closeLightbox();
    }
});

// ==================== State Display Functions ====================

function showEmptyState() {
    if (!elements.grid) return;
    
    elements.grid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-video-slash"></i>
            <h3>لا توجد مشاركات مسجلة ومقبولة حالياً</h3>
            <p>كن أول من يشارك برأيه حول مركز الشباب!</p>
        </div>
    `;
}

function showErrorState() {
    if (!elements.grid) return;
    
    elements.grid.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>حدث خطأ أثناء تحميل المعرض</h3>
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
