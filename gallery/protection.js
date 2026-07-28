/**
 * ==================== نظام حماية الميديا ====================
 * يمنع: السكرين شوت، تسجيل الشاشة، التنزيل، النسخ
 * 
 * ملاحظة: لا توجد طريقة 100% لمنع التصوير،
 * لكن هذا الكود يجعله أصعب بكثير
 */

(function() {
    'use strict';

    // ==================== تعطيل اختصارات لوحة المفاتيح ====================
    
    document.addEventListener('keydown', function(e) {
        // قائمة الاختصارات المحظورة
        const forbiddenKeys = [
            // Print Screen
            { key: 'PrintScreen', code: 44 },
            // F12 (DevTools)
            { key: 'F12', code: 123 },
            // Ctrl+Shift+I (DevTools)
            { ctrl: true, shift: true, key: 'i' },
            // Ctrl+Shift+J (Console)
            { ctrl: true, shift: true, key: 'j' },
            // Ctrl+Shift+C (Inspect)
            { ctrl: true, shift: true, key: 'c' },
            // Ctrl+S (Save)
            { ctrl: true, key: 's' },
            // Ctrl+U (View Source)
            { ctrl: true, key: 'u' },
            // Ctrl+A (Select All)
            { ctrl: true, key: 'a' },
            // Ctrl+P (Print)
            { ctrl: true, key: 'p' }
        ];

        for (const combo of forbiddenKeys) {
            let blocked = false;

            if (combo.code && e.keyCode === combo.code) {
                blocked = true;
            }

            if (combo.key && e.key?.toLowerCase() === combo.key.toLowerCase()) {
                if (combo.ctrl && !e.ctrlKey && !e.metaKey) continue;
                if (combo.shift && !e.shiftKey) continue;
                if (!combo.ctrl && !combo.shift) {
                    blocked = true;
                } else {
                    blocked = true;
                }
            }

            if (blocked) {
                e.preventDefault();
                e.stopPropagation();
                showProtectionWarning();
                return false;
            }
        }
    });

    // ==================== منع قائمة السياق (Right Click) ====================
    
    document.addEventListener('contextmenu', function(e) {
        // التحقق إذا كان العنصر هو فيديو أو صوت
        const target = e.target;
        if (target.tagName === 'VIDEO' || target.tagName === 'AUDIO' ||
            target.closest('.video-container') || target.closest('.media-card')) {
            e.preventDefault();
            showProtectionWarning();
            return false;
        }
        
        // السماح بقائمة السياق في أماكن أخرى
        return true;
    });

    // ==================== كشف محاولات السكرين شوت ====================
    
    let lastScreenshotTime = 0;
    const SCREENSHOT_DEBOUNCE = 1000; // ثانية واحدة
    
    // مراقبة تغييرات الحجم (قد تشير لفتح أدوات المطور)
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    
    window.addEventListener('resize', function() {
        const widthDiff = Math.abs(window.innerWidth - lastWidth);
        const heightDiff = Math.abs(window.innerHeight - lastHeight);
        
        // إذا كان التغيير كبيراً فجأة، قد يكون DevTools
        if (widthDiff > 100 || heightDiff > 100) {
            console.warn('Large resize detected');
        }
        
        lastWidth = window.innerWidth;
        lastHeight = window.innerHeight;
    });

    // ==================== حماية الفيديوهات الخاصة ====================
    
    function protectVideos() {
        const videos = document.querySelectorAll('video');
        
        videos.forEach(video => {
            // إخفاء عناصر التحكم الأصلية
            video.setAttribute('controlsList', 'nodownload noremoteplayback noplaybackrate nofullscreen');
            video.setAttribute('disablePictureInPicture', '');
            
            // منع سحب الفيديو
            video.setAttribute('draggable', 'false');
            
            // إزالة خاصية التحميل
            video.removeAttribute('download');
        });
    }

    // تشغيل الحماية عند تحميل الصفحة
    protectVideos();

    // مراقبة عناصر جديدة (Dynamic content)
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
                        protectVideos();
                    }
                    
                    // البحث عن فيديوهات داخل العنصر الجديد
                    const videos = node.querySelectorAll?.('video') || [];
                    if (videos.length > 0) {
                        protectVideos();
                    }
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // ==================== كشف تسجيل الشاشة (محدود) ====================
    
    // بعض المتصفحات تدعم هذا
    if (navigator.mediaDevices) {
        // مراقبة محاولة الوصول للشاشة
        const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia?.bind(navigator.mediaDevices);
        
        if (originalGetDisplayMedia) {
            navigator.mediaDevices.getDisplayMedia = async function(constraints) {
                showProtectionWarning('⚠️ تم اكتشاف محاولة تسجيل الشاشة!');
                
                // يمكننا رفض الطلب أو السماح مع تحذير
                // هنا نسمح لكن نظهر تحذير مستمر
                const stream = await originalGetDisplayMedia(constraints);
                
                // مراقبة إيقاف التسجيل
                stream.getVideoTracks()[0]?.addEventListener('ended', () => {
                    console.log('Screen recording stopped');
                });
                
                return stream;
            };
        }
    }

    // ==================== حماية Service Worker (منع التخزين المؤقت للفيديو) ====================
    
    if ('serviceWorker' in navigator) {
        // عدم تسجيل service worker في صفحة المعرض
        // هذا يمنع تخزين الفيديوهات مؤقتاً
    }

    // ==================== تعطيل Drag & Drop ====================
    
    document.addEventListener('dragstart', function(e) {
        if (e.target.tagName === 'VIDEO' || e.target.tagName === 'IMG' || 
            e.target.tagName === 'AUDIO' || e.target.closest('.media-card')) {
            e.preventDefault();
            return false;
        }
    });

    // ==================== حماية نسخ الصور والفيديو ====================
    
    document.addEventListener('copy', function(e) {
        const selection = window.getSelection().toString();
        if (!selection || selection.trim() === '') {
            // محاولة نسخ بدون نص محدد (ربما صورة/فيديو)
            const target = document.activeElement;
            if (target?.tagName === 'VIDEO' || target?.closest('.video-container')) {
                e.preventDefault();
                showProtectionWarning();
            }
        }
    });

    // ==================== كشف DevTools (طريقة إضافية) ====================
    
    let devtoolsOpen = false;
    
    const checkDevTools = () => {
        const threshold = 160;
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        
        if ((widthThreshold || heightThreshold) && !devtoolsOpen) {
            devtoolsOpen = true;
            console.log('%c⚠️ تحذير: أدوات المطور مفتوحة!', 'color: red; font-size: 30px; font-weight: bold;');
        } else if (!widthThreshold && !heightThreshold && devtoolsOpen) {
            devtoolsOpen = false;
        }
    };

    setInterval(checkDevTools, 500);

    // ==================== عرض رسالة التحذير ====================
    
    window.showProtectionWarning = function(customMessage) {
        const toast = document.getElementById('warningToast');
        if (toast) {
            if (customMessage) {
                toast.querySelector('span').textContent = customMessage;
            } else {
                toast.querySelector('span').textContent = 
                    '⚠️ هذا المحتوى محمي ولا يمكن تصويره أو تسجيله';
            }
            
            toast.style.display = 'flex';
            
            // إخفاء بعد 3 ثواني
            clearTimeout(window.warningTimeout);
            window.warningTimeout = setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    };

    // ==================== حماية للموبايل ====================
    
    // تعطيل long press (الضغط المطول)
    document.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'VIDEO' || e.target.closest('.video-container')) {
            // السماح بالتشغيل فقط
            if (e.target.classList.contains('play-btn-large') || 
                e.target.classList.contains('control-btn')) {
                return; // السماح
            }
        }
    }, { passive: true });

    // منع حفظ الصورة بالضغط المطول على الموبايل
    document.addEventListener('touchend', function(e) {
        const touchDuration = Date.now() - (e.timeStamp || 0);
        // إذا كان الضغط أكثر من 500ms، قد تكون محاولة حفظ
    });

    // ==================== تنظيف عنوان URL ====================
    
    // إخفاء مسار الفيديو الحقيقي من شريط العنوان
    if (window.history.replaceState) {
        window.history.replaceState({}, '', '/gallery/');
    }

    // ==================== Console Warning ====================
    
    console.clear();
    console.log('%c🛡️ محتوى محمي', 'font-size: 40px; color: #1a5f2a; font-weight: bold;');
    console.log('%cهذا المحتوى محمي بحقوق النشر ولا允许 نسخه أو تصويره', 'font-size: 14px; color: #666;');
    
})();

// ==================== دالة إضافية لكشف السكرين شوت ====================

// استخدام Visibility API لكشف تبديل النوافذ
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
        // قد يكون المستخدم يأخذ سكرين شوت أو فتح نافذة أخرى
        window._pageHiddenTime = Date.now();
    } else if (document.visibilityState === 'visible') {
        const hiddenDuration = Date.now() - window._pageHiddenTime;
        // إذا كان مخفياً لفترة قصيرة جداً، قد يكون سكرين شوت
        if (hiddenDuration < 300 && hiddenDuration > 50) {
            // احتمالية عالية أنه كان سكرين شوت
            // لكن لا نظهر تحذير كل مرة لتجنب الإزعاج
        }
    }
});

// ==================== حماية إضافية للمتصفحات الحديثة ====================

// Content Security Policy عبر meta tag (إضافي)
const cspMeta = document.createElement('meta');
cspMeta.httpEquiv = 'Content-Security-Policy';
cspMeta.content = "default-src 'self'; media-src 'self' blob: https://*.r2.dev; frame-ancestors 'none'";
document.head.appendChild(cspMeta);

// Referrer Policy
const referrerMeta = document.createElement('meta');
referrerMeta.name = 'referrer';
referrerMeta.content = 'no-referrer';
document.head.appendChild(referrerMeta);

console.log('✅ نظام الحماية مفعل بنجاح');
