/**
 * Al Ahmadiya Youth Center Survey - Main Application Logic
 * Fixed Global Variable Collision
 */

const app = {
    // تم وضع الرابط داخل كائن app نفسه لمنع التعارض
    apiUrl: 'https://markzshabab.studusa05.workers.dev',
    state: {
        votes: {},
        mediaBlob: null,
        mediaType: null
    },
    mediaRecorder: null,
    stream: null,
    recordTimer: null,

    nextScreen(screenId) {
        const current = document.querySelector('.active-screen');
        const next = document.getElementById(screenId);
        
        if (!next || current === next) return;

        gsap.to(current, { 
            opacity: 0, 
            y: -20, 
            duration: 0.4, 
            onComplete: () => {
                current.classList.remove('active-screen');
                current.classList.add('hidden-screen');
                current.style.display = 'none';
                
                next.classList.remove('hidden-screen');
                next.classList.add('active-screen');
                next.style.display = 'block';
                gsap.fromTo(next, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 });
            }
        });
    },

    recordVote(question, answer) {
        this.state.votes[question] = answer;
        const currentQ = document.getElementById(`${question}-container`);
        const nextNum = parseInt(question.replace('q', '')) + 1;
        const nextQ = document.getElementById(`q${nextNum}-container`);

        gsap.to(currentQ, { 
            opacity: 0, 
            x: -50, 
            duration: 0.3, 
            onComplete: () => {
                currentQ.classList.remove('active-q');
                currentQ.classList.add('hidden-q');
                if (nextQ) {
                    nextQ.classList.remove('hidden-q');
                    nextQ.classList.add('active-q');
                    gsap.fromTo(nextQ, { opacity: 0, x: 50 }, { opacity: 1, x: 0, duration: 0.3 });
                } else {
                    this.nextScreen('s-media');
                }
            }
        });
    },

    async startVideo() { this.initMedia(true, false); },
    async startAudio() { this.initMedia(false, true); },
    
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
            if (timerDisplay) timerDisplay.innerText = timeLeft + 's';
            
            this.recordTimer = setInterval(() => {
                timeLeft--;
                if (timerDisplay) timerDisplay.innerText = timeLeft + 's';
                if (timeLeft <= 0) this.stopRecording();
            }, 1000);

        } catch (err) { 
            console.error(err);
            alert('يرجى إعطاء الصلاحية للكاميرا أو الميكروفون للتسجيل.'); 
        }
    },

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            clearInterval(this.recordTimer);
        }
    },

    async submitSurvey() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.stopRecording();
            return; 
        }

        const formData = new FormData();
        formData.append('votes', JSON.stringify(this.state.votes));
        if (this.state.mediaBlob) {
            formData.append('media', this.state.mediaBlob);
            formData.append('type', this.state.mediaType);
        }

        try {
            // نستخدم الرابط الخاص بكائن app هنا
            const res = await fetch(`${this.apiUrl}/submit`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (data.success) {
                this.nextScreen('s-thankyou');
                if (typeof animations !== 'undefined') {
                    animations.playSuccess();
                }
            } else {
                throw new Error(data.error || 'Submission failed');
            }
        } catch (e) {
            console.error("Submission failed:", e);
            alert("حدث خطأ أثناء إرسال الاستبيان، يرجى المحاولة مرة أخرى.");
        }
    },

    viewStats() {
        this.nextScreen('s-stats');
        if (typeof initCharts === 'function') {
            initCharts();
        }
    }
};

window.app = app;