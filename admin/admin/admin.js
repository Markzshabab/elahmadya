/**
 * لوحة تحكم الإدارة - El Ahmadiya Survey Admin
 * ✅ إصدار مصحح - يستخدم Firebase REST API مباشرة
 * ✅ جلب البيانات والميديا بشكل موثوق
 * ✅ بدون اعتماد على Firebase SDK
 */

const CONFIG = {
    // Firebase REST API (Direct!)
    FIREBASE_DB_URL: 'https://markzshabab-4c01b-default-rtdb.firebaseio.com',
    FIREBASE_PATH: 'survey/submissions',
    
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

    // ==================== تسجيل الدخول ====================
    
    login() {
        const pass = document.getElementById('admin-pass')?.value;
        if (!pass) return this.showToast('يرجى إدخال كلمة المرور', 'error');
        
        this.token = pass;
        sessionStorage.setItem('admin_token', this.token);
        
        this.showToast('جاري التحميل...');
        this.fetchData();
    },

    logout() {
        sessionStorage.removeItem('admin_token');
        this.token = null;
        this.allData = [];
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard-screen').style.display = 'none';
    },

    // ==================== جلب البيانات الرئيسي ====================
    
    async fetchData() {
        try {
            this.showToast('جاري تحميل البيانات...');
            
            // Try Firebase REST API first (Primary)
            let data = await this.fetchFromFirebaseREST();
            
            // Fallback to Worker if Firebase fails
            if (!data || data.length === 0) {
                console.log('⚠️ Firebase فشل، محاولة Worker...');
                data = await this.fetchFromWorker();
            }
            
            if (data && data.length > 0) {
                this.allData = data;
                this.filteredData = [...data];
                this.renderTable(data);
                this.updateStats(data);
                this.showDashboard();
                this.showToast(`✅ تم تحميل ${data.length} تسجيل`);
            } else {
                this.showToast('⚠️ لا توجد بيانات', 'error');
                this.showEmptyTable();
            }
            
        } catch (error) {
            console.error('❌ Fetch Error:', error);
            this.showToast('خطأ في تحميل البيانات: ' + error.message, 'error');
        }
    },
    
    /**
     * جلب البيانات من Firebase باستخدام REST API مباشرة
     * الطريقة الأكثر موثوقية - لا تحتاج SDK
     */
    async fetchFromFirebaseREST() {
        try {
            const url = `${CONFIG.FIREBASE_DB_URL}/${CONFIG.FIREBASE_PATH}.json`;
            
            console.log('📡 Admin: جلب البيانات من Firebase:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) {
                console.error('❌ Firebase HTTP Error:', response.status);
                return [];
            }
            
            const data = await response.json();
            const submissions = [];
            
            if (data && typeof data === 'object') {
                Object.keys(data).forEach(key => {
                    const submission = data[key];
                    
                    submissions.push({
                        id: key,
                        submissionId: key,
                        timestamp: submission.timestamp || submission.createdAt || Date.now(),
                        timestampISO: new Date(submission.timestamp || submission.createdAt || Date.now()).toISOString(),
                        ip: submission.ip || submission.clientIP || '-',
                        ipHash: submission.ipHash || this.hashIP(submission.ip || submission.clientIP || ''),
                        fingerprint: submission.fingerprint?.substring(0, 50) || '-',
                        votes: submission.votes || {},
                        mediaUrl: this.buildMediaUrl(submission),
                        mediaType: submission.mediaType || null,
                        mediaSize: submission.mediaSize || 0,
                        status: submission.status || 'pending',
                        userAgent: submission.userAgent?.substring(0, 100) || '-',
                        reviewedAt: submission.reviewedAt || null,
                        hasPlayableMedia: !!(submission.mediaId || submission.mediaUrl || submission.uuid)
                    });
                });
            }
            
            console.log(`✅ Firebase REST: تم جلب ${submissions.length} تسجيل`);
            return submissions;
            
        } catch (error) {
            console.error('❌ Firebase REST Error:', error);
            return [];
        }
    },
    
    /**
     * بناء رابط الميديا من R2
     */
    buildMediaUrl(submission) {
        const mediaId = submission.mediaId || 
                       submission.uuid || 
                       submission.id;
        
        if (mediaId) {
            return `${CONFIG.R2_BASE_URL}/media/${mediaId}`;
        }
        
        if (submission.mediaUrl) {
            return submission.mediaUrl;
        }
        
        return null;
    },
    
    /**
     * تبسيط IP Hash
     */
    hashIP(ip) {
        if (!ip || ip === '-') return 'unknown';
        return ip.substring(0, 12) + '...';
    },
    
    /**
     * Fallback: جلب البيانات من Worker
     */
    async fetchFromWorker() {
        try {
            const response = await fetch(`${CONFIG.WORKER_URL}/admin/submissions?key=${this.token}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Worker: تم جلب ${data.length || 0} تسجيل`);
                return Array.isArray(data) ? data : [];
            }
            
            return [];
        } catch (error) {
            console.error('❌ Worker Error:', error);
            return [];
        }
    },

    showDashboard() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard-screen').style.display = 'block';
    },

    // ==================== تحديث الإحصائيات ====================
    
    updateStats(data) {
        const total = data.length;
        const pending = data.filter(s => s.status === 'pending').length;
        const approved = data.filter(s => s.status === 'approved' || s.status === 'accepted').length;
        const rejected = data.filter(s => s.status === 'rejected').length;
        const withMedia = data.filter(s => s.hasPlayableMedia).length;

        document.getElementById('total-votes').textContent = total;
        document.getElementById('pending-count').textContent = pending;
        document.getElementById('approved-count').textContent = approved;
        document.getElementById('blocked-count').textContent = rejected;

        // Update filter buttons
        this.updateFilterButtons(total, pending, approved, rejected, withMedia);
    },
    
    updateFilterButtons(total, pending, approved, rejected, withMedia) {
        const btns = document.querySelectorAll('.filter-btn');
        btns.forEach(btn => {
            if (btn.classList.contains('all')) btn.textContent = `الكل (${total})`;
            else if (btn.classList.contains('pending')) btn.textContent = `⏳ قيد المراجعة (${pending})`;
            else if (btn.classList.contains('approved')) btn.textContent = `✅ مقبولة (${approved})`;
            else if (btn.classList.contains('rejected')) btn.textContent = `❌ مرفوضة (${rejected})`;
            else if (btn.classList.contains('has-media')) btn.textContent = `🎬 بها ميديا (${withMedia})`;
        });
    },

    // ==================== عرض الجدول ====================
    
    renderTable(data) {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;
        
        if (data.length === 0) {
            this.showEmptyTable();
            return;
        }

        tbody.innerHTML = data.map((item, index) => `
            <tr data-id="${item.id}" data-status="${item.status}">
                <td>${index + 1}</td>
                <td>${new Date(item.timestampISO).toLocaleString('ar-EG')}</td>
                <td><span class="ip-badge">${item.ip}</span></td>
                <td><span class="ip-hash">${item.ipHash}</span></td>
                <td>${this.renderVoteBadge(item.votes?.q1)}</td>
                <td>${this.renderVoteBadge(item.votes?.q2)}</td>
                <td>${this.renderVoteBadge(item.votes?.q3)}</td>
                <td>${this.renderMediaPreview(item)}</td>
                <td>${this.renderStatusBadge(item.status)}</td>
                <td>${this.renderActionButtons(item)}</td>
            </tr>
        `).join('');
        
        // Add click handlers for media preview
        tbody.querySelectorAll('.media-preview-clickable').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = el.dataset.id;
                const type = el.dataset.type;
                admin.openMediaModal(id, type);
            });
        });
    },
    
    showEmptyTable() {
        const tbody = document.getElementById('table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>لا توجد بيانات حالياً</h3>
                        <p>سيظهر هنا التصويتات والمساهمات عند استقبالها</p>
                    </td>
                </tr>
            `;
        }
    },
    
    renderVoteBadge(value) {
        if (!value) return '<span class="vote-badge">-</span>';
        
        const isPositive = ['Very Satisfied', 'Yes', 'New Youth', 'satisfied', 'yes', 'youth']
                           .some(v => value.toLowerCase().includes(v.toLowerCase()));
        
        const displayValue = {
            'Very Satisfied': 'رضا تام',
            'Not Satisfied': 'غير راضٍ',
            'Yes': 'موافق',
            'No': 'غير موافق',
            'New Youth': 'شباب جدد',
            'Current Management': 'الإدارة الحالية'
        }[value] || value;
        
        return `<span class="vote-badge ${isPositive ? 'positive' : 'negative'}">${displayValue}</span>`;
    },
    
    renderMediaPreview(item) {
        if (!item.hasPlayableMedia || !item.mediaType) {
            return '<span class="no-media">لا يوجد</span>';
        }
        
        const icon = item.mediaType === 'video' ? 'fa-video' : 'fa-microphone';
        const label = item.mediaType === 'video' ? 'فيديو' : 'صوت';
        const size = item.mediaSize ? `${(item.mediaSize/1024).toFixed(0)}KB` : '';
        
        return `
            <div class="media-preview media-preview-clickable" 
                 data-id="${item.id}" 
                 data-type="${item.mediaType}"
                 title="اضغط لتشغيل">
                <i class="fas ${icon}"></i>
                <small>${label} ${size}</small>
            </div>
        `;
    },
    
    renderStatusBadge(status) {
        const statusMap = {
            'pending': { class: 'status-pending', text: '⏳ قيد المراجعة' },
            'approved': { class: 'status-approved', text: '✅ مقبول' },
            'accepted': { class: 'status-approved', text: '✅ مقبول' },
            'rejected': { class: 'status-rejected', text: '❌ مرفوض' }
        };
        
        const config = statusMap[status] || { class: 'status-pending', text: status || 'غير معروف' };
        return `<span class="status-badge ${config.class}">${config.text}</span>`;
    },
    
    renderActionButtons(item) {
        const id = JSON.stringify(item.id);
        const ip = JSON.stringify(item.ip);
        let buttons = '';
        
        // Accept Button
        if (item.status !== 'approved' && item.status !== 'accepted') {
            buttons += `
                <button class="action-btn approve" onclick='event.stopPropagation(); admin.updateStatus(${id}, "accepted")' title="✅ قبول ونشر">
                    <i class="fas fa-check"></i>
                </button>
            `;
        }
        
        // Reject Button
        if (item.status !== 'rejected') {
            buttons += `
                <button class="action-btn reject" onclick='event.stopPropagation(); admin.updateStatus(${id}, "rejected")' title="❌ رفض">
                    <i class="fas fa-times"></i>
                </button>
            `;
        }
        
        // Delete Button
        buttons += `
            <button class="action-btn delete" onclick='event.stopPropagation(); admin.deleteEntry(${id})' title="🗑️ حذف">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        // Block IP Button
        if (item.ip && item.ip !== '-') {
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
        const item = this.allData.find(s => s.id === submissionId);
        if (!item) return;

        const modal = document.getElementById('media-modal');
        const container = document.getElementById('modal-media-container');
        const info = document.getElementById('modal-info');

        // رابط الميديا من R2
        const mediaSrc = item.mediaUrl || `${CONFIG.R2_BASE_URL}/media/${submissionId}`;
        
        const isVideo = mediaType === 'video';
        const typeLabel = isVideo ? 'فيديو' : 'تسجيل صوتي';
        const typeColor = isVideo ? '#8b5cf6' : '#06b6d4';
        const typeIcon = isVideo ? 'fa-video' : 'fa-microphone';

        container.innerHTML = isVideo ? `
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
                    <strong> التاريخ:</strong> ${new Date(item.timestampISO).toLocaleString('ar-EG')}
                </div>
                <div style="background:rgba(255,255,255,0.05);padding:10px 20px;border-radius:10px;">
                    <i class="fas fa-network-wired" style="color:#60a5fa"></i>
                    <strong> IP:</strong> ${item.ip || '-'}
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

    // ==================== البحث والفلترة ====================
    
    searchTable() {
        const query = document.getElementById('search-box')?.value.toLowerCase();
        if (!query) {
            this.filteredData = [...this.allData];
        } else {
            this.filteredData = this.allData.filter(item => 
                (item.ip || '').toLowerCase().includes(query) ||
                (item.timestampISO || '').includes(query) ||
                JSON.stringify(item.votes || {}).toLowerCase().includes(query)
            );
        }
        this.renderTable(this.filteredData);
    },
    
    filterBy(filter, btn) {
        this.currentFilter = filter;
        
        // Update button states
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        
        // Filter data
        switch(filter) {
            case 'all':
                this.filteredData = [...this.allData];
                break;
            case 'pending':
                this.filteredData = this.allData.filter(s => s.status === 'pending');
                break;
            case 'approved':
                this.filteredData = this.allData.filter(s => s.status === 'approved' || s.status === 'accepted');
                break;
            case 'rejected':
                this.filteredData = this.allData.filter(s => s.status === 'rejected');
                break;
            case 'has-media':
                this.filteredData = this.allData.filter(s => s.hasPlayableMedia);
                break;
            default:
                this.filteredData = [...this.allData];
        }
        
        this.renderTable(this.filteredData);
    },

    // ==================== إجراءات الأدمن ====================
    
    async updateStatus(id, newStatus) {
        const statusText = newStatus === 'accepted' || newStatus === 'approved' ? 'قبول ونشر' : 'رفض';
        
        if (!confirm(`هل أنت متأكد من ${statusText}؟`)) return;

        try {
            this.showToast(`جاري ${statusText}...`);
            
            // Try Firebase REST API first
            try {
                const updateUrl = `${CONFIG.FIREBASE_DB_URL}/${CONFIG.FIREBASE_PATH}/${id}.json`;
                const response = await fetch(updateUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        status: newStatus === 'accepted' ? 'approved' : newStatus,
                        updatedAt: new Date().toISOString()
                    })
                });
                
                if (response.ok) {
                    this.showToast(`✅ تم ${statusText} بنجاح!`);
                    setTimeout(() => this.fetchData(), 500);
                    return;
                }
            } catch (firebaseError) {
                console.warn('⚠️ Firebase update failed, trying Worker:', firebaseError);
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
                this.showToast(`✅ تم ${statusText} بنجاح!`);
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
            
            // Try Firebase REST first
            try {
                const deleteUrl = `${CONFIG.FIREBASE_DB_URL}/${CONFIG.FIREBASE_PATH}/${id}.json`;
                const response = await fetch(deleteUrl, { method: 'DELETE' });
                
                if (response.ok) {
                    this.showToast('🗑️ تم الحذف بنجاح!');
                    setTimeout(() => this.fetchData(), 500);
                    return;
                }
            } catch (firebaseError) {
                console.warn('⚠️ Firebase delete failed, trying Worker:', firebaseError);
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

        const flatData = this.filteredData.map((item, index) => ({
            '#': index + 1,
            'التاريخ': new Date(item.timestampISO).toLocaleString('ar-EG'),
            'IP': item.ip || '',
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
            <p style="font-size:12px;color:#888;margin-top:5px;">قد يكون الملف غير موجود في R2</p>
        </div>
    `;
}

function closeModal(event) {
    if (!event || event.target.id === 'media-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('media-modal')?.classList.remove('active');
        
        // Stop all media
        document.querySelectorAll('#modal-media-container video, #modal-media-container audio').forEach(el => {
            el.pause();
            el.src = '';
        });
    }
}

// Auto-init
window.admin = admin;
if (admin.token) {
    admin.fetchData();
}
