const app = {
    apiUrl: 'https://markzshabab.studusa05.workers.dev',
    state: { votes: {}, mediaBlob: null, mediaType: null },
    mediaRecorder: null, stream: null, recordTimer: null,
    
    // مفتاح تخزين البصمة
    FINGERPRINT_KEY: 'elahmadya_device_fp',
    VOTE_STATUS_KEY: 'elahmadya_vote_status',

    // ==================== نظام البصمة ====================
    
    /**
     * إنشاء بصمة فريدة للجهاز
     * تستخدم معلومات متعددة لإنشاء معرف فريد
     */
    async generateFingerprint() {
        try {
            const components = [];
            
            // 1. معلومات الشاشة
            components.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}`);
            
            // 2. المنطقة الزمنية
            components.push(`timezone:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
            
            // 3. اللغة
            components.push(`lang:${navigator.language}`);
            
            // 4. النظام الأساسي
            components.push(`platform:${navigator.platform}`);
            
            // 5. User Agent (جزء منه)
            const ua = navigator.userAgent.substring(0, 100);
            components.push(`ua:${ua}`);
            
            // 6. عدد المعالجات
            components.push(`cores:${navigator.hardwareConcurrency || 'unknown'}`);
            
            // 7. ذاكرة الجهاز (إن وجدت)
            components.push(`memory:${navigator.deviceMemory || 'unknown'}`);
            
            // 8. Canvas fingerprint
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillText('Fingerprint', 2, 2);
                components.push(`canvas:${canvas.toDataURL()}`);
            } catch (e) {
                components.push('canvas:error');
            }
            
            // 9. WebGL Vendor
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl');
                if (gl) {
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    components.push(`webgl:${debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown'}`);
                }
            } catch (e) {
                components.push('webgl:error');
            }
            
            // تحويل المعلومات إلى hash بسيط
            const fingerprintString = components.join('|');
            const hash = await this.simpleHash(fingerprintString);
            
            return `fp_${hash}_${Date.now()}`;
            
        } catch (error) {
            console.error('Error generating fingerprint:', error);
            // fallback إلى معرف عشوائي إذا فشل كل شيء
            return `fp_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    },
    
    /**
     * دالة hash بسيطة للنصوص
     */
    async simpleHash(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    },
    
    /**
     * الحصول على البصمة الحالية أو إنشاء واحدة جديدة
     */
    async getOrCreateFingerprint() {
        let fp = localStorage.getItem(this.FINGERPRINT_KEY);
        
        if (!fp) {
            fp = await this.generateFingerprint();
            localStorage.setItem(this.FINGERPRINT_KEY, fp);
        }
        
        return fp;
    },
    
    /**
     * التحقق مما إذا كان الجهاز قد صوت بالفعل
     */
    hasVoted() {
        const status = localStorage.getItem(this.VOTE_STATUS_KEY);
        return status === 'voted';
    },
    
    /**
     * تسجيل أن الجهاز قد صوت
     */
    markAsVoted() {
        localStorage.setItem(this.VOTE_STATUS_KEY, 'voted');
        localStorage.setItem(`${this.VOTE_STATUS_KEY}_time`, new Date().toISOString());
    },
    
    /**
     * التحقق الأولي عند تحميل الصفحة
     */
    async initializeApp() {
        const fp = await this.getOrCreateFingerprint();
        
        if (this.hasVoted()) {
            // الجهاز سبق وأن صوت - عرض شاشة "لقد صوتت"
            this.showAlreadyVotedScreen();
        } else {
            // التحقق من الخادم أيضاً (IP ban check)
            await this.checkServerStatus(fp);
        }
    },
    
    /**
     * التحقق من حالة الجهاز في الخادم
     */
    async checkServerStatus(fingerprint) {
        try {
            // استخدام نقطة الإحصائيات للتحقق من حالة IP (بدلاً من check-status غير الموجودة)
            const res = await fetch(`${this.apiUrl}/api/stats`);
            if (res.ok) {
                const data = await res.json();
                // يمكن إضافة تحقق إضافي هنا إذا أعاد الـ Worker معلومات عن حالة المستخدم
            }
        } catch (error) {
            console.log('Could not verify server status, allowing vote');
        }
    },
    
    /**
     * عرض شاشة "لقد سبق وأن تصويت"
     */
    showAlreadyVotedScreen(isBanned = false) {
        // إخفاء جميع الشاشات الأخرى
        document.querySelectorAll('section').forEach(s => {
            s.classList.remove('active-screen');
            s.classList.add('hidden-screen');
            s.style.display = 'none';
        });
        
        // إظهار شاشة "سبق التصويت"
        const alreadyVotedScreen = document.getElementById('s-already-voted');
        if (alreadyVotedScreen) {
            alreadyVotedScreen.classList.remove('hidden-screen');
            alreadyVotedScreen.classList.add('active-screen');
            alreadyVotedScreen.style.display = 'block';
            
            // تحديث الرسالة حسب السبب
            const messageEl = document.getElementById('already-voted-message');
            if (messageEl) {
                if (isBanned) {
                    messageEl.innerHTML = `
                        <i class="fas fa-ban" style="font-size: 3rem; color: var(--danger); margin-bottom: 15px;"></i>
                        <h2>عذراً، تم حظر جهازك</h2>
                        <p>لا يمكنك المشاركة في الاستبيان من هذا الجهاز.</p>
                        <p class="subtitle">لكن يمكنك مشاهدة النتائج والمعرض!</p>
                    `;
                } else {
                    messageEl.innerHTML = `
                        <i class="fas fa-check-double" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                        <h2>شكراً! لقد سبق وأن تصويت</h2>
                        <p>تم تسجيل مشاركتك مسبقاً من هذا الجهاز.</p>
                        <p class="subtitle">يمكنك الآن مشاهدة النتائج والمشاركات!</p>
                    `;
                }
            }
        }
        
        // تعطيل أزرار التصويت في شريط التنقل
        const voteNavBtn = document.querySelector('.nav-item[data-screen="s-survey"]');
        if (voteNavBtn) {
            voteNavBtn.style.opacity = '0.5';
            voteNavBtn.style.pointerEvents = 'none';
            voteNavBtn.setAttribute('title', 'لقد سبق وأن تصويت');
        }
    },

    // ==================== التنقل بين الشاشات ====================
    
    nextScreen(screenId) {
        const current = document.querySelector('.active-screen');
        const next = document.getElementById(screenId);
        if (!next || current === next) return;

        gsap.to(current, { opacity: 0, y: -20, duration: 0.4, onComplete: () => {
            current.classList.remove('active-screen');
            current.classList.add('hidden-screen');
            current.style.display = 'none';
            next.classList.remove('hidden-screen');
            next.classList.add('active-screen');
            next.style.display = 'block';
            gsap.fromTo(next, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 });
        }});
    },

    recordVote(question, answer) {
        // التحقق من البصمة قبل التصويت
        if (this.hasVoted()) {
            alert('عذراً، لقد سبق وأن تصويت من هذا الجهاز!');
            this.showAlreadyVotedScreen();
            return;
        }
        
        this.state.votes[question] = answer;
        const currentQ = document.getElementById(`${question}-container`);
        const nextNum = parseInt(question.replace('q', '')) + 1;
        const nextQ = document.getElementById(`q${nextNum}-container`);

        gsap.to(currentQ, { opacity: 0, x: -50, duration: 0.3, onComplete: () => {
            currentQ.classList.remove('active-q');
            currentQ.classList.add('hidden-q');
            if (nextQ) {
                nextQ.classList.remove('hidden-q');
                nextQ.classList.add('active-q');
                gsap.fromTo(nextQ, { opacity: 0, x: 50 }, { opacity: 1, x: 0, duration: 0.3 });
            } else {
                this.nextScreen('s-media');
            }
        }});
    },

    async startVideo() { 
        // التحقق من البصمة
        if (this.hasVoted()) {
            alert('عذراً، لقد سبق وأن صوتت من هذا الجهاز!');
            return;
        }
        this.initMedia(true, false); 
    },
    
    async startAudio() { 
        // التحقق من البصمة
        if (this.hasVoted()) {
            alert('عذراً، لقد سبق وأن صوتت من هذا الجهاز!');
            return;
        }
        this.initMedia(false, true); 
    },
    
    async initMedia(video, audio) {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ video, audio });
            document.getElementById('media-controls').classList.add('hidden');
            document.getElementById('recording-ui').classList.remove('hidden');
            if (video) {
                const vid = document.getElementById('vid-preview');
                vid.srcObject = this.stream;
                vid.classList.remove('hidden');
            }
            let chunks = [];
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.mediaRecorder.ondataavailable = e => chunks.push(e.data);
            this.mediaRecorder.onstop = () => {
                this.state.mediaBlob = new Blob(chunks, { type: video ? 'video/mp4' : 'audio/webm' });
                this.state.mediaType = video ? 'video' : 'audio';
                this.submitSurvey();
            };
            this.mediaRecorder.start();
            let timeLeft = 30;
            const timerDisplay = document.getElementById('time-left');
            if (timerDisplay) timerDisplay.innerText = timeLeft + 'ث';
            this.recordTimer = setInterval(() => {
                timeLeft--;
                if (timerDisplay) timerDisplay.innerText = timeLeft + 'ث';
                if (timeLeft <= 0) this.stopRecording();
            }, 1000);
        } catch (err) { 
            alert('يرجى إعطاء الصلاحية للكاميرا أو الميكروفون للتسجيل.'); 
        }
    },

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            if (this.stream) this.stream.getTracks().forEach(track => track.stop());
            clearInterval(this.recordTimer);
        }
    },

    async submitSurvey() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.stopRecording();
            return; 
        }
        
        // التحقق النهائي من البصمة قبل الإرسال
        if (this.hasVoted()) {
            alert('عذراً، لقد سبق وأن صوتت من هذا الجهاز!');
            this.showAlreadyVotedScreen();
            return;
        }
        
        const formData = new FormData();
        formData.append('votes', JSON.stringify(this.state.votes));
        
        // إضافة البصمة
        const fingerprint = await this.getOrCreateFingerprint();
        formData.append('fingerprint', fingerprint);
        
        if (this.state.mediaBlob) {
            formData.append('media', this.state.mediaBlob);
            formData.append('type', this.state.mediaType);
        }
        
        try {
            const res = await fetch(`${this.apiUrl}/api/vote`, { 
                method: 'POST', 
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });
            const data = await res.json();
            
            if (data.success) {
                // تسجيل أن الجهاز قد صوت
                this.markAsVoted();
                
                this.nextScreen('s-thankyou');
                if (typeof animations !== 'undefined') animations.playSuccess();
                
                // تحديث واجهة المستخدم بعد التصويت
                setTimeout(() => {
                    this.showAlreadyVotedScreen();
                }, 3000);
                
            } else {
                // إذا كان الخطأ بسبب تكرار التصويت
                if (data.error && (data.error.includes('حظر') || data.error.includes('تكرار') || data.error.includes('مرة'))) {
                    this.markAsVoted();
                    this.showAlreadyVotedScreen(true);
                } else {
                    throw new Error(data.error || 'Submission failed');
                }
            }
        } catch (e) {
            if (e.message.includes('حظر') || e.message.includes('تكرار')) {
                this.markAsVoted();
                this.showAlreadyVotedScreen(true);
            } else {
                alert("حدث خطأ أثناء إرسال الاستبيان، يرجى المحاولة مرة أخرى.");
            }
        }
    },

    viewStats() {
        this.nextScreen('s-stats');
        if (typeof initCharts === 'function') initCharts();
        this.updateNavState('s-stats');
    },

    // دالة التنقل لشريط التنقل السفلي
    navigateTo(screenId, navElement) {
        // تحديث حالة شريط التنقل
        this.updateNavState(screenId);
        
        // إذا كان المستخدم قد صوت وحاول الدخول لصفحة التصويت
        if (screenId === 's-survey' && this.hasVoted()) {
            alert('لقد سبق وأن تصويت!\nيمكنك مشاهدة النتائج والمعرد فقط.');
            this.viewStats();
            return;
        }
        
        // إذا كنا على نفس الشاشة، لا تفعل شيئاً
        const currentScreen = document.querySelector('.active-screen');
        if (currentScreen && currentScreen.id === screenId) return;

        // الانتقال للشاشة المطلوبة
        if (screenId === 's-survey') {
            // إعادة تعيين الأسئلة عند الدخول لشاشة التصويت
            document.querySelectorAll('.question-block').forEach((q, index) => {
                q.classList.remove('active-q', 'hidden-q');
                q.style.display = index === 0 ? 'block' : 'none';
                if (index === 0) q.classList.add('active-q');
                else q.classList.add('hidden-q');
            });
            this.state.votes = {};
        }
        
        this.nextScreen(screenId);
        
        // تحميل الرسوم البيانية إذا كانت شاشة النتائج
        if (screenId === 's-stats' && typeof initCharts === 'function') {
            setTimeout(() => initCharts(), 300);
        }
    },

    // تحديث حالة الأيقونة النشطة في شريط التنقل
    updateNavState(screenId) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.screen === screenId) {
                item.classList.add('active');
            }
        });
    },

    // ==================== مشاركة واتساب ====================
    
    /**
     * مشاركة الاستبيان عبر واتساب
     */
    shareOnWhatsApp() {
        const message = `*السلام عليكم* 🤝\n\nلأن رأيك يهمنا ولكي نرتقي بقريتنا الأحمدية يرجى الإجابة على هذا الاستبيان ومشاركته مع غيرك\n\n🔗 https://markzshabab.github.io/elahmadya\n\n🙏 شارك الرابط مع أهالي القرية`;
        
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
        
        // فتح واتساب في نافذة/تبويب جديد
        window.open(whatsappUrl, '_blank');
    }
};

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    app.initializeApp();
});

window.app = app;
