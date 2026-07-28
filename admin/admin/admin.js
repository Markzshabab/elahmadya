/**
 * لوحة تحكم الإدارة - El Ahmadiya Survey Admin
 * ✅ يدعم الآن: Firebase Direct + Worker Fallback
 * ✅ جلب البيانات والميديا بشكل موثوق
 */

const CONFIG = {
    // Firebase Configuration
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyAB6GT-198Ns1W8a722ACFeouK6RvUDuwc",
        authDomain: "markzshabab-4c01b.firebaseapp.com",
        databaseURL: "https://markzshabab-4c01b-default-rtdb.firebaseio.com",
        projectId: "markzshabab-4c01b",
    },
    
    // R2 Storage
    R2_BASE_URL: 'https://pub-3fb0b86037554ed0b842bc258e8a3051.r2.dev',
    
    // Worker API (Fallback)
    WORKER_URL: 'https://markzshabab.studusa05.workers.dev',
};

const admin = {
    token: sessionStorage.getItem('admin_token') || null,
    allData: [],
    filteredData: [],
    currentFilter: 'all',
    db: null,

    // ==================== تسجيل الدخول ====================
    
    login() {
        const pass = document.getElementById('admin-pass')?.value;
        if (!pass) return this.showToast('يرجى إدخال كلمة المرور', 'error');
        
        this.token = pass;
        sessionStorage.setItem('admin_token', this.token);
        
        this.showToast('جاري التحميل...');
        this.initializeFirebase();
    },

    logout() {
        sessionStorage.removeItem('admin_token');
        this.token = null;
        this.allData = [];
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard-screen').style.display = 'none';
    },

    // ==================== تهيئة Firebase ====================
    
    async initializeFirebase() {
        try {
            const tbody = document.getElementById('table-body');
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="loading-spinner">
                        <i class="fas fa-spinner fa-spin fa-2x"></i>
                        <p style="margin-top: 15px; color: #f4c430;">جاري الاتصال بقاعدة البيانات...</p>
                    </td>
                </tr>
            `;

            // تحميل Firebase ديناميكياً
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
            const { getDatabase, ref, onValue, get, set, update, remove } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');

            // تهيئة Firebase
            const app = initializeApp(CONFIG.FIREBASE_CONFIG);
            this.db = getDatabase(app);
            
            console.log('✅ Firebase initialized successfully');
            
            // جلب البيانات
            await this.fetchFromFirebase();
            
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            this.showToast('خطأ في الاتصال بـ Firebase، جرب Worker...', 'error');
            // Fallback to Worker
            await this.fetchFromWorker();
        }
    },

    // ==================== جلب البيانات من Firebase (المصدر الرئيسي) ====================
    
    async fetchFromFirebase() {
        try {
            if (!this.db) throw new Error('Firebase not initialized');
            
            const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
            
            const submissionsRef = ref(this.db, 'survey/submissions');
            const snapshot = await get(submissionsRef);
            
            const data = snapshot.val();
            let submissionsArray = [];
            
            if (data) {
                Object.keys(data).forEach(key => {
                    const submission = data[key];
                    submissionsArray.push({
                        id: key,
                        ...submission,
                        // تأكد من وجود mediaUrl من R2
                        mediaUrl: submission.mediaUrl || 
                                  (submission.mediaId ? `${CONFIG.R2_BASE_URL}/media/${submission.mediaId}` : null)
                    });
                });
                
                console.log(`✅ Firebase: تم جلب ${submissionsArray.length} تسجيل`);
            }
            
            this.allData = submissionsArray.map((item, index) => ({
                ...item,
                index: index + 1
            }));

            // Show dashboard
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard-screen').style.display = 'block';

            // Update UI
            this.updateStats();
            this.applyFilter();
            this.updateFilterCounts();

            const mediaCount = this.allData.filter(s => s.mediaUrl || s.mediaType).length;
            this.showToast(`تم تحميل ${this.allData.length} تصويت (${mediaCount} بمحتوى)`);

        } catch (error) {
            console.error('❌ Firebase fetch error:', error);
            throw error; // سيتم التقاطه واستدعاء Worker كـ fallback
        }
    },

    // ==================== جلب البيانات من Worker (Fallback) ====================
    
    async fetchFromWorker() {
        try {
            const tbody = document.getElementById('table-body');
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="loading-spinner">
                        <i class="fas fa-spinner fa-spin fa-2x"></i>
                        <p style="margin-top: 15px; color: #f4c430;">جاري التحميل من الخادم الاحتياطي...</p>
                    </td>
                </tr>
            `;
            
            console.log('Fetching from:', `${CONFIG.WORKER_URL}/admin/submissions`);
            
            const res = await fetch(`${CONFIG.WORKER_URL}/admin/submissions`, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Response status:', res.status);

            if (res.status === 401) {
                this.showToast('كلمة المرور غير صحيحة', 'error');
                sessionStorage.removeItem('admin_token');
                this.token = null;
                return;
            }

            const data = await res.json();
            console.log('Received data:', data);

            // Handle response format
            let submissionsArray = Array.isArray(data) ? data : Object.values(data);
            
            // Add R2 URLs to media items
            submissionsArray = submissionsArray.map(item => ({
                ...item,
                mediaUrl: item.mediaUrl || 
                          (item.mediaId ? `${CONFIG.R2_BASE_URL}/media/${item.mediaId}` : null)
            }));
            
            this.allData = submissionsArray.map((item, index) => ({
                ...item,
                index: index + 1
            }));

            // Show dashboard
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard-screen').style.display = 'block';

            // Update UI
            this.updateStats();
            this.applyFilter();
            this.updateFilterCounts();

            const mediaCount = this.allData.filter(s => s.mediaUrl).length;
            this.showToast(`تم تحميل ${this.allData.length} تصويت (${mediaCount} بمحتوى)`);

        } catch (error) {
            console.error('❌ Worker fetch error:', error);
            this.showErrorState(error.message);
        }
    },
    
    // ==================== Main Fetch Data (tries both sources) ====================
    
    async fetchData() {
        try {
            // Try Firebase first
            await this.initializeFirebase();
        } catch (firebaseError) {
            console.warn('⚠️ Firebase failed, trying Worker:', firebaseError.message);
            try {
                // Fallback to Worker
                await this.fetchFromWorker();
            } catch (workerError) {
                console.error('❌ Both sources failed:', workerError);
                this.showErrorState('فشل تحميل البيانات من جميع المصادر');
            }
        }
    },

    showErrorState(message) {
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-3x" style="color: #ef4444;"></i>
                    <p style="margin-top: 15px;">${message || 'فشل تحميل البيانات'}</p>
                    <button onclick="admin.fetchData()" class="btn-primary" style="margin-top: 20px;">
                        <i class="fas fa-redo"></i> إعادة المحاولة
                    </button>
                </td>
            </tr>
        `;
    },

    // ==================== الإحصائيات ====================
    
    updateStats() {
        const total = this.allData.length;
        const pending = this.allData.filter(s => s.status === 'pending').length;
        const approved = this.allData.filter(s => s.status === 'approved' || s.status === 'accepted').length;
        const withMedia = this.allData.filter(s => s.mediaUrl || s.mediaType).length;

        document.getElementById('total-votes').textContent = total;
        document.getElementById('pending-count').textContent = pending;
        document.getElementById('approved-count').textContent = approved;
        document.getElementById('blocked-count').textContent = withMedia;
    },

    updateFilterCounts() {
        const counts = {
            all: this.allData.length,
            pending: this.allData.filter(s => s.status === 'pending').length,
            approved: this.allData.filter(s => s.status === 'approved' || s.status === 'accepted').length,
            rejected: this.allData.filter(s => s.status === 'rejected' || s.status === 'rejected').length,
            'has-media': this.allData.filter(s => s.mediaUrl || s.mediaType).length
        };

        document.querySelectorAll('.filter-btn').forEach(btn => {
            const filterType = btn.className.match(/(all|pending|approved|rejected|has-media)/)?.[0];
            if (filterType && counts[filterType] !== undefined) {
                const text = btn.textContent.split('(')[0].trim();
                btn.textContent = `${text} (${counts[filterType]})`;
            }
        });
    },

    // ==================== الفلترة والبحث ====================
    
    filterBy(filter, btnElement) {
        this.currentFilter = filter;
        
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');

        this.applyFilter();
    },

    applyFilter() {
        let filtered = [...this.allData];

        switch (this.currentFilter) {
            case 'pending':
                filtered = filtered.filter(s => s.status === 'pending');
                break;
            case 'approved':
                filtered = filtered.filter(s => s.status === 'approved' || s.status === 'accepted');
                break;
            case 'rejected':
                filtered = filtered.filter(s => s.status === 'rejected' || s.status === 'rejected');
                break;
            case 'has-media':
                filtered = filtered.filter(s => s.mediaUrl || s.mediaType);
                break;
        }

        const searchQuery = document.getElementById('search-box')?.value?.toLowerCase() || '';
        if (searchQuery) {
            filtered = filtered.filter(item =>
                JSON.stringify(item).toLowerCase().includes(searchQuery)
            );
        }

        this.filteredData = filtered;
        this.renderTable(filtered);
    },

    searchTable() {
        this.applyFilter();
    },

    // ==================== عرض الجدول مع الميديا ====================
    
    renderTable(data) {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state">
                        <i class="fas fa-inbox fa-3x"></i>
                        <p style="margin-top: 15px;">لا توجد بيانات</p>
                    </td>
                </tr>
            `;
            return;
        }

        data.sort((a, b) => (b.timestamp || b.timestampISO || 0) - (a.timestamp || a.timestampISO || 0));
        tbody.innerHTML = '';

        data.forEach((item, idx) => {
            const date = item.timestampISO ? 
                new Date(item.timestampISO).toLocaleString('ar-EG') : 
                item.timestamp ? new Date(item.timestamp).toLocaleString('ar-EG') : '-';

            const ipDisplay = item.ip || item.clientIP || 'غير معروف';
            const ipHash = item.ipHash ? item.ipHash.substring(0, 12) + '...' : '-';
            
            const q1Badge = this.getVoteBadge(item.votes?.q1);
            const q2Badge = this.getVoteBadge(item.votes?.q2);
            const q3Badge = this.getVoteBadge(item.votes?.q3);

            // 🎬🎤 الميديا - يعمل من Firebase و R2!
            const mediaHtml = this.renderPlayableMedia(item);

            const statusHtml = this.getStatusBadge(item.status);
            const actionHtml = this.renderActionButtons(item);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.index || idx + 1}</strong></td>
                <td style="white-space: nowrap; font-size: 13px;">${date}</td>
                <td><span class="ip-badge">${ipDisplay}</span></td>
                <td><span class="ip-hash">${ipHash}</span></td>
                <td>${q1Badge}</td>
                <td>${q2Badge}</td>
                <td>${q3Badge}</td>
                <td>${mediaHtml}</td>
                <td>${statusHtml}</td>
                <td>${actionHtml}</td>
            `;

            tbody.appendChild(tr);
        });
    },

    getVoteBadge(value) {
        if (!value) return '<span style="color:#666">-</span>';
        
        const isPositive = ['satisfied', 'yes', 'youth', 'Very Satisfied', 'Yes', 'New Youth'].includes(value);
        const labels = {
            satisfied: '✅ راضي',
            not_satisfied: '❌ غير راضي',
            yes: '✅ أؤيد',
            no: '❌ لا أؤيد',
            youth: '🆕 شباب جديد',
            current: '🏛️ الحالية',
            'Very Satisfied': '✅ راضي جداً',
            'Not Satisfied': '❌ غير راضي',
            'Yes': '✅ نعم',
            'No': '❌ لا',
            'New Youth': '🆕 شباب جدد',
            'Current Management': '🏛️ الإدارة الحالية'
        };
        
        return `<span class="vote-badge ${isPositive ? 'positive' : 'negative'}">${labels[value] || value}</span>`;
    },

    // 🎬🎤 تشغيل الميديا الفعلي من R2!
    renderPlayableMedia(item) {
        if (!item.mediaUrl && !item.mediaType && !item.mediaId) {
            return '<span class="no-media" style="color:#555;font-style:italic;">-</span>';
        }

        // رابط الميديا - من R2 مباشرة!
        const mediaSrc = item.mediaUrl || 
                         (item.mediaId ? `${CONFIG.R2_BASE_URL}/media/${item.mediaId}` : null);
        
        if (!mediaSrc) {
            return '<span class="no-media" style="color:#555;font-style:italic;">-</span>';
        }

        const mediaType = item.mediaType || 
                          (mediaSrc.includes('.mp4') || mediaSrc.includes('.webm') ? 'video' : 'audio');
        
        const typeIcon = mediaType === 'video' ? 'fa-video' : 'fa-microphone';
        const typeName = mediaType === 'video' ? 'فيديو' : 'صوتي';
        const typeColor = mediaType === 'video' ? '#8b5cf6' : '#06b6d4';

        return `
            <div class="media-container" onclick='admin.openMediaModal("${item.id || item.mediaId}", "${mediaType}")'>
                ${mediaType === 'video' ? `
                    <!-- مشغل فيديو مصغر -->
                    <div class="video-thumbnail">
                        <video src="${mediaSrc}" 
                               preload="metadata" 
                               muted
                               style="max-width:160px; max-height:90px; border-radius:8px; cursor:pointer;"
                               @loadedmetadata="this.style.opacity=1"
                               onerror="this.parentElement.innerHTML='<div class=\\'media-fallback\\' style=\\'padding:15px;text-align:center;color:${typeColor}\\'><i class=\\'fas ${typeIcon} fa-2x\\'></i><p style=\\'font-size:11px;margin-top:5px\\'>${typeName}</p></div>'">
                            <div class="play-overlay">
                                <i class="fas fa-play-circle"></i>
                            </div>
                        </video>
                    </div>
                ` : `
                    <!-- مشغل صوتي -->
                    <audio src="${mediaSrc}" 
                           preload="metadata" 
                           controls
                           style="width:150px;height:36px;"
                           onerror="this.outerHTML='<div style=\\'padding:8px;color:${typeColor};font-size:12px\\'><i class=\\'fas ${typeIcon}\\'></i> ${typeName}</div>'">
                    </audio>
                `}
                
                <div class="media-info">
                    <i class="fas ${typeIcon}" style="color:${typeColor}"></i>
                    <span>${typeName}</span>
                </div>
            </div>

            <style>
                .media-container { cursor: pointer; text-align: center; }
                .media-container:hover .play-overlay { opacity: 1; }
                .play-overlay {
                    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                    background:rgba(0,0,0,0.7);color:white;border-radius:50%;
                    width:35px;height:35px;display:flex;align-items:center;
                    justify-content:center;font-size:18px;opacity:0;transition:0.2s;
                }
                .video-thumbnail { position:relative;display:inline-block;border-radius:8px;overflow:hidden; }
                .media-info { font-size:11px;margin-top:4px;color:#888; }
                .media-info i { margin-right:4px; }
            </style>
        `;
    },

    getStatusBadge(status) {
        const config = {
            pending: { label: '⏳ قيد المراجعة', class: 'status-pending' },
            approved: { label: '✅ مقبول', class: 'status-approved' },
            accepted: { label: '✅ مقبول', class: 'status-approved' },
            rejected: { label: '❌ مرفوض', class: 'status-rejected' }
        };
        
        const s = config[status] || config.pending;
        return `<span class="status-badge ${s.class}">${s.label}</span>`;
    },

    renderActionButtons(item) {
        const id = JSON.stringify(item.id);
        const ip = JSON.stringify(item.ip || item.clientIP || '');
        
        let buttons = '';
        
        // أزرار القبول/رفض للمحتوى قيد المراجعة
        if ((item.status === 'pending') && (item.mediaUrl || item.mediaType)) {
            buttons += `
                <button class="action-btn approve" onclick='event.stopPropagation(); admin.updateStatus(${id}, "accepted")' title="✅ قبول ونشر">
                    <i class="fas fa-check"></i> قبول
                </button>
                <button class="action-btn reject" onclick='event.stopPropagation(); admin.updateStatus(${id}, "rejected")' title="❌ رفض">
                    <i class="fas fa-times"></i> رفض
                </button>
            `;
        } else if (item.mediaUrl || item.mediaType) {
            buttons += `
                <button class="action-btn approve" onclick='event.stopPropagation(); admin.updateStatus(${id}, "approved")' title="تغيير الحالة">
                    <i class="fas fa-edit"></i>
                </button>
            `;
        }
        
        // زر الحذف
        buttons += `
            <button class="action-btn delete" onclick='event.stopPropagation(); admin.deleteEntry(${id})' title="🗑️ حذف">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        // زر حظر IP
        if (item.ip || item.clientIP) {
            buttons += `
                <button class="action-btn block" onclick='event.stopPropagation(); admin.blockIp(${ip})' title="🚫 حظر IP">
                    <i class="fas fa-ban"></i>
                </button>
            `;
        }
        
        return `<div class="action-buttons" onclick="event.stopPropagation()">${buttons}</div>`;
    },

    // ==================== Modal كبير لتشغيل الميديو ====================
    
    openMediaModal(submissionId, mediaType) {
        const item = this.allData.find(s => s.id === submissionId || s.mediaId === submissionId);
        if (!item) return;

        const modal = document.getElementById('media-modal');
        const container = document.getElementById('modal-media-container');
        const info = document.getElementById('modal-info');

        // رابط الميديا من R2 - يعمل 100%!
        const mediaSrc = item.mediaUrl || 
                         (item.mediaId ? `${CONFIG.R2_BASE_URL}/media/${item.mediaId}` : 
                          `${CONFIG.WORKER_URL}/api/media/${submissionId}`);
        
        const isVideo = mediaType === 'video';
        const typeLabel = isVideo ? 'فيديو' : 'تسجيل صوتي';
        const typeColor = isVideo ? '#8b5cf6' : '#06b6d4';
        const typeIcon = isVideo ? 'fa-video' : 'fa-microphone';

        container.innerHTML = isVideo ? `
            <!-- مشغل فيديو كامل -->
            <div style="background:#000;border-radius:16px;overflow:hidden;">
                <video src="${mediaSrc}" 
                       controls 
                       autoplay
                       playsinline
                       style="width:100%;max-height:70vh;display:block;"
                       onerror="handleMediaError(this, '${typeLabel}')">
                    متصفحك لا يدعم تشغيل الفيديو
                </video>
            </div>
        ` : `
            <!-- مشغل صوتي كامل مع تصميم جميل -->
            <div style="background:linear-gradient(135deg,${typeColor}22,transparent);border-radius:16px;padding:30px;text-align:center;">
                <i class="fas ${typeIcon} fa-4x" style="color:${typeColor};margin-bottom:20px;"></i>
                <h3 style="color:white;margin-bottom:20px;">🎤 ${typeLabel} مسجل</h3>
                <audio src="${mediaSrc}" 
                       controls 
                       autoplay
                       style="width:100%;height:50px;"
                       onerror="handleMediaError(this, '${typeLabel}')">
                    متصفحك لا يدعم تشغيل الصوت
                </audio>
            </div>
        `;

        info.innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:15px;justify-content:center;margin-top:15px;">
                <div style="background:rgba(255,255,255,0.05);padding:10px 20px;border-radius:10px;">
                    <i class="fas ${typeIcon}" style="color:${typeColor}"></i>
                    <strong> النوع:</strong> ${typeLabel}
                </div>
                <div style="background:rgba(255,255,255,0.05);padding:10px 20px;border-radius:10px;">
                    <i class="fas fa-calendar" style="color:#f4c430"></i>
                    <strong> التاريخ:</strong> ${new Date(item.timestampISO || item.timestamp).toLocaleString('ar-EG')}
                </div>
                <div style="background:rgba(255,255,255,0.05);padding:10px 20px;border-radius:10px;">
                    <i class="fas fa-network-wired" style="color:#60a5fa"></i>
                    <strong> IP:</strong> ${item.ip || item.clientIP || '-'}
                </div>
                <div style="background:rgba(255,255,255,0.05);padding:10px 20px;border-radius:10px;">
                    <i class="fas fa-id-card" style="color:#a78bfa"></i>
                    <strong> ID:</strong> ${(submissionId || '').substring(0, 12)}...
                </div>
            </div>
            
            <div style="margin-top:20px;text-align:center;">
                <span class="status-badge ${item.status === 'pending' ? 'status-pending' : (item.status === 'approved' || item.status === 'accepted') ? 'status-approved' : 'status-rejected'}">
                    الحالة: ${item.status === 'pending' ? '⏳ قيد المراجعة' : (item.status === 'approved' || item.status === 'accepted') ? '✅ مقبول' : '❌ مرفوض'}
                </span>
            </div>
            
            ${item.status === 'pending' ? `
                <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;">
                    <button class="btn-primary" onclick='admin.updateStatus("${submissionId}", "accepted"); closeModal();' 
                            style="padding:12px 30px;font-size:16px;">
                        <i class="fas fa-check-circle"></i> ✅ قبول ونشر
                    </button>
                    <button class="btn-danger" onclick='admin.updateStatus("${submissionId}", "rejected"); closeModal();'
                            style="padding:12px 30px;font-size:16px;background:#dc2626;">
                        <i class="fas fa-times-circle"></i> ❌ رفض
                    </button>
                </div>
            ` : ''}
        `;

        modal.classList.add('active');
    },

    // ==================== إجراءات الأدمن (Firebase + Worker) ====================
    
    async updateStatus(id, newStatus) {
        const statusText = newStatus === 'accepted' || newStatus === 'approved' ? 'قبول ونشر' : 'رفض';
        
        if (!confirm(`هل أنت متأكد من ${statusText}؟`)) return;

        try {
            this.showToast(`جاري ${statusText}...`);
            
            // Try Firebase first
            if (this.db) {
                try {
                    const { ref, update } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
                    const submissionRef = ref(this.db, `survey/submissions/${id}`);
                    await update(submissionRef, { 
                        status: newStatus === 'accepted' ? 'approved' : newStatus,
                        updatedAt: new Date().toISOString()
                    });
                    
                    this.showToast(`✅ تم ${statusText} بنجاح! (Firebase)`);
                    setTimeout(() => this.fetchData(), 500);
                    return;
                } catch (firebaseError) {
                    console.warn('⚠️ Firebase update failed, trying Worker:', firebaseError);
                }
            }
            
            // Fallback to Worker
            const res = await fetch(`${CONFIG.WORKER_URL}/admin/update-status`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, status: newStatus === 'accepted' ? 'approved' : newStatus })
            });

            const result = await res.json();

            if (result.success) {
                this.showToast(`✅ تم ${statusText} بنجاح! (Worker)`);
                setTimeout(() => this.fetchData(), 500);
            } else {
                this.showToast(result.error || 'فشل العملية', 'error');
            }
        } catch (e) {
            this.showToast('خطأ: ' + e.message, 'error');
        }
    },

    async deleteEntry(id) {
        if (!confirm('⚠️ هل أنت متأكد من حذف هذا التصويت والمحتوى نهائياً؟\n\nلا يمكن التراجع!')) return;

        try {
            this.showToast('جاري الحذف...');
            
            // Try Firebase first
            if (this.db) {
                try {
                    const { ref, remove } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
                    const submissionRef = ref(this.db, `survey/submissions/${id}`);
                    await remove(submissionRef);
                    
                    this.showToast('🗑️ تم الحذف بنجاح! (Firebase)');
                    setTimeout(() => this.fetchData(), 500);
                    return;
                } catch (firebaseError) {
                    console.warn('⚠️ Firebase delete failed, trying Worker:', firebaseError);
                }
            }
            
            // Fallback to Worker
            const res = await fetch(`${CONFIG.WORKER_URL}/admin/delete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id })
            });

            const result = await res.json();

            if (result.success) {
                this.showToast('🗑️ تم الحذف بنجاح!');
                setTimeout(() => this.fetchData(), 500);
            } else {
                this.showToast(result.error || 'فشل الحذف', 'error');
            }
        } catch (e) {
            this.showToast('خطأ: ' + e.message, 'error');
        }
    },

    async blockIp(ip) {
        if (!confirm(`🚫 حظر IP:\n\n${ip}\n\nلن يتمكن هذا المستخدم من المشاركة مجدداً!`)) return;

        try {
            this.showToast('جاري الحظر...');

            const res = await fetch(`${CONFIG.WORKER_URL}/admin/block-ip`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ip })
            });

            const result = await res.json();

            if (result.success) {
                this.showToast(`🚫 تم حظر: ${ip}`);
                setTimeout(() => this.fetchData(), 500);
            } else {
                this.showToast(result.error || 'فشل الحظر', 'error');
            }
        } catch (e) {
            this.showToast('خطأ: ' + e.message, 'error');
        }
    },

    // ==================== تصدير CSV ====================
    
    exportCSV() {
        if (!this.filteredData.length) return this.showToast('لا توجد بيانات', 'error');

        const flatData = this.filteredData.map(item => ({
            '#': item.index,
            'التاريخ': new Date(item.timestampISO || item.timestamp).toLocaleString('ar-EG'),
            'IP': item.ip || item.clientIP || '',
            'Q1_رضا': item.votes?.q1 || '',
            'Q2_تأييد': item.votes?.q2 || '',
            'Q3_اختيار': item.votes?.q3 || '',
            'نوع_المحتوى': item.mediaType || '',
            'حجم_المحتوى': item.mediaSize ? `${(item.mediaSize/1024).toFixed(1)}KB` : '',
            'الحالة': item.status || ''
        }));

        const headers = Object.keys(flatData[0]);
        const csvContent = "\uFEFF" + [
            headers.join(','),
            ...flatData.map(row => headers.map(h => `"${row[h]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `elahmadya-admin-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        this.showToast('✅ تم التصدير!');
    },

    // ==================== Toast ====================
    
    showToast(message, type = '') {
        const toast = document.getElementById('toast');
        if (!toast) return alert(message);

        toast.textContent = message;
        toast.className = 'toast ' + type;
        toast.style.display = 'block';

        setTimeout(() => toast.style.display = 'none', 4000);
    }
};

// ==================== Global Functions ====================

function handleMediaError(element, type) {
    element.parentElement.innerHTML = `
        <div style="padding:40px;text-align:center;color:#ef4444;">
            <i class="fas fa-exclamation-triangle fa-3x"></i>
            <p style="margin-top:15px;">خطأ في تشغيل ${type}</p>
            <p style="font-size:12px;color:#888;margin-top:5px;">قد يكون الملف تالف أو غير مدعوم</p>
        </div>
    `;
}

function closeModal(event) {
    if (!event || event.target.id === 'media-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('media-modal').classList.remove('active');
        
        // Stop all media
        document.querySelectorAll('#modal-media-container video, #modal-media-container audio').forEach(el => {
            el.pause();
            el.src = '';
        });
    }
}

// Auto-login
window.admin = admin;
if (admin.token) admin.fetchData();
