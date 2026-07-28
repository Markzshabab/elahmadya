/**
 * لوحة تحكم الإدارة - El Ahmadiya Survey Admin
 * يدعم: عرض التصويتات، مراجعة الميديا، حظر IP
 */

const WORKER_URL = 'https://markzshabab.studusa05.workers.dev';

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
        
        this.showToast('جاري التحقق...');
        this.fetchData();
    },

    logout() {
        sessionStorage.removeItem('admin_token');
        this.token = null;
        this.allData = [];
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard-screen').style.display = 'none';
    },

    // ==================== جلب البيانات ====================
    
    async fetchData() {
        try {
            const tbody = document.getElementById('table-body');
            if (tbody) tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p style="margin-top: 10px;">جاري تحميل البيانات...</p>
                    </td>
                </tr>
            `;

            console.log('Fetching from:', `${WORKER_URL}/admin/submissions`);
            
            const res = await fetch(`${WORKER_URL}/admin/submissions`, {
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

            // Handle response format (array or object)
            let submissionsArray = Array.isArray(data) ? data : Object.values(data);
            
            // If it's an object with nested data, extract it
            if (!Array.isArray(data) && typeof data === 'object') {
                if (data.submissions) submissionsArray = data.submissions;
                else if (data.data) submissionsArray = data.data;
            }

            this.allData = submissionsArray.map((item, index) => ({
                ...item,
                index: index + 1
            }));

            // Show dashboard
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard-screen').style.display = 'block';

            // Update stats and render
            this.updateStats();
            this.applyFilter();
            this.updateFilterCounts();

            this.showToast(`تم تحميل ${this.allData.length} تصويت`);

        } catch (error) {
            console.error('Fetch error:', error);
            this.showToast('حدث خطأ في تحميل البيانات: ' + error.message, 'error');
            
            const tbody = document.getElementById('table-body');
            if (tbody) tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>فشل تحميل البيانات</p>
                        <button onclick="admin.fetchData()" class="btn-primary" style="margin-top: 15px;">
                            <i class="fas fa-redo"></i> إعادة المحاولة
                        </button>
                    </td>
                </tr>
            `;
        }
    },

    // ==================== تحديث الإحصائيات ====================
    
    updateStats() {
        const total = this.allData.length;
        const pending = this.allData.filter(s => s.status === 'pending').length;
        const approved = this.allData.filter(s => s.status === 'approved').length;

        document.getElementById('total-votes').textContent = total;
        document.getElementById('pending-count').textContent = pending;
        document.getElementById('approved-count').textContent = approved;
    },

    updateFilterCounts() {
        const counts = {
            all: this.allData.length,
            pending: this.allData.filter(s => s.status === 'pending').length,
            approved: this.allData.filter(s => s.status === 'approved').length,
            rejected: this.allData.filter(s => s.status === 'rejected').length,
            'has-media': this.allData.filter(s => s.mediaUrl || s.mediaType).length
        };

        document.querySelectorAll('.filter-btn').forEach(btn => {
            const filterType = btn.classList.contains('all') ? 'all' :
                               btn.classList.contains('pending') ? 'pending' :
                               btn.classList.contains('approved') ? 'approved' :
                               btn.classList.contains('rejected') ? 'rejected' : 'has-media';
            
            if (counts[filterType] !== undefined) {
                btn.textContent = btn.textContent.split('(')[0].trim() + ` (${counts[filterType]})`;
            }
        });
    },

    // ==================== الفلترة والبحث ====================
    
    filterBy(filter, btnElement) {
        this.currentFilter = filter;
        
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');

        this.applyFilter();
    },

    applyFilter() {
        let filtered = [...this.allData];

        // Apply status filter
        switch (this.currentFilter) {
            case 'pending':
                filtered = filtered.filter(s => s.status === 'pending');
                break;
            case 'approved':
                filtered = filtered.filter(s => s.status === 'approved');
                break;
            case 'rejected':
                filtered = filtered.filter(s => s.status === 'rejected');
                break;
            case 'has-media':
                filtered = filtered.filter(s => s.mediaUrl || s.mediaType);
                break;
        }

        // Apply search
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

    // ==================== عرض الجدول ====================
    
    renderTable(data) {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>لا توجد بيانات للعرض</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Sort by date (newest first)
        data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        tbody.innerHTML = '';

        data.forEach((item, idx) => {
            const date = item.timestampISO ? 
                new Date(item.timestampISO).toLocaleString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : '-';

            const ipDisplay = item.ip || item.clientIP || 'غير معروف';
            const ipHash = item.ipHash || '-';
            
            // Vote badges
            const q1Badge = this.getVoteBadge(item.votes?.q1);
            const q2Badge = this.getVoteBadge(item.votes?.q2);
            const q3Badge = this.getVoteBadge(item.votes?.q3);

            // Media preview
            const mediaHtml = this.renderMediaPreview(item);

            // Status badge
            const statusHtml = this.getStatusBadge(item.status);

            // Action buttons
            const actionHtml = this.renderActionButtons(item);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.index || idx + 1}</td>
                <td style="white-space: nowrap;">${date}</td>
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
        if (!value) return '<span class="vote-badge">-</span>';
        
        const isPositive = ['satisfied', 'yes', 'youth'].includes(value);
        const labels = {
            satisfied: 'راضي ✅',
            not_satisfied: 'غير راضي ❌',
            yes: 'أؤيد ✅',
            no: 'لا أؤيد ❌',
            youth: 'شباب جديد 🆕',
            current: 'الحالية 🏛️'
        };
        
        return `<span class="vote-badge ${isPositive ? 'positive' : 'negative'}">${labels[value] || value}</span>`;
    },

    renderMediaPreview(item) {
        if (!item.mediaUrl && !item.mediaType) {
            return '<span class="no-media">-</span>';
        }

        const typeIcon = item.mediaType === 'video' ? 'fa-video' : 'fa-microphone';
        const typeName = item.mediaType === 'video' ? 'فيديو' : 'صوتي';

        return `
            <div class="media-preview" onclick='admin.openMediaModal("${item.id}")'>
                ${item.mediaUrl && !item.mediaUrl.startsWith('#') ? 
                    (item.mediaType === 'video' ?
                        `<video src="${item.mediaUrl}" preload="metadata" muted></video>` :
                        `<audio src="${item.mediaUrl}" controls></audio>`
                    ) : `
                        <div style="padding: 15px; text-align: center; color: #f4c430;">
                            <i class="fas ${typeIcon} fa-2x"></i>
                            <p style="margin-top: 8px; font-size: 12px;">${typeName}</p>
                            <p style="font-size: 10px; color: #888;">(معاينة غير متوفرة)</p>
                        </div>
                    `}
            </div>
        `;
    },

    getStatusBadge(status) {
        const config = {
            pending: { label: '⏳ قيد المراجعة', class: 'status-pending' },
            approved: { label: '✅ مقبول', class: 'status-approved' },
            rejected: { label: '❌ مرفوض', class: 'status-rejected' }
        };
        
        const s = config[status] || config.pending;
        return `<span class="status-badge ${s.class}">${s.label}</span>`;
    },

    renderActionButtons(item) {
        const id = JSON.stringify(item.id);
        const ip = JSON.stringify(item.ip || item.clientIP || '');
        
        let buttons = '';
        
        // Approve/Reject buttons for pending items with media
        if (item.status === 'pending' && item.mediaUrl) {
            buttons += `
                <button class="action-btn approve" onclick='admin.updateStatus(${id}, "approved")' title="قبول ونشر">
                    <i class="fas fa-check"></i> قبول
                </button>
                <button class="action-btn reject" onclick='admin.updateStatus(${id}, "rejected")' title="رفض">
                    <i class="fas fa-times"></i> رفض
                </button>
            `;
        }
        
        // Delete button
        buttons += `
            <button class="action-btn delete" onclick='admin.deleteEntry(${id})' title="حذف">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        // Block IP button
        if (item.ip || item.clientIP) {
            buttons += `
                <button class="action-btn block" onclick='admin.blockIp(${ip})' title="حظر هذا IP">
                    <i class="fas fa-ban"></i>
                </button>
            `;
        }
        
        return `<div class="action-buttons">${buttons}</div>`;
    },

    // ==================== Modal للميديا ====================
    
    openMediaModal(submissionId) {
        const item = this.allData.find(s => s.id === submissionId);
        if (!item) return;

        const modal = document.getElementById('media-modal');
        const container = document.getElementById('modal-media-container');
        const info = document.getElementById('modal-info');

        if (item.mediaUrl && !item.mediaUrl.startsWith('#')) {
            const mediaEl = item.mediaType === 'video' ?
                `<video src="${item.mediaUrl}" controls autoplay></video>` :
                `<audio src="${item.mediaUrl}" controls autoplay style="width:100%;"></audio>`;
            
            container.innerHTML = mediaEl;
        } else {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #f4c430;">
                    <i class="fas ${item.mediaType === 'video' ? 'fa-video' : 'fa-microphone'} fa-4x"></i>
                    <p style="margin-top: 15px;">معاينة المحتوى غير متوفرة</p>
                </div>
            `;
        }

        info.innerHTML = `
            <p><strong>نوع:</strong> ${item.mediaType === 'video' ? 'فيديو' : 'صوتي'}</p>
            <p><strong>التاريخ:</strong> ${new Date(item.timestampISO).toLocaleString('ar-EG')}</p>
            <p><strong>IP:</strong> ${item.ip || item.clientIP || '-'}</p>
            <p><strong>الحالة:</strong> ${item.status}</p>
        `;

        modal.classList.add('active');
    },

    // ==================== إجراءات الأدمن ====================
    
    async updateStatus(id, newStatus) {
        const actionText = newStatus === 'approved' ? 'قبول ونشر' : 'رفض';
        
        if (!confirm(`هل أنت متأكد من ${actionText} هذا المحتوى؟`)) return;

        try {
            this.showToast(`جاري ${actionText}...`);
            
            const res = await fetch(`${WORKER_URL}/admin/update-status`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, status: newStatus })
            });

            const result = await res.json();

            if (result.success) {
                this.showToast(result.message || `تم ${actionText} بنجاح!`);
                await this.fetchData(); // Refresh data
            } else {
                this.showToast(result.error || 'فشلت العملية', 'error');
            }
        } catch (e) {
            this.showToast('خطأ: ' + e.message, 'error');
        }
    },

    async deleteEntry(id) {
        if (!confirm('هل أنت متأكد من حذف هذا التصويت نهائياً؟\n⚠️ لا يمكن التراجع عن هذا الإجراء!')) return;

        try {
            this.showToast('جاري الحذف...');

            const res = await fetch(`${WORKER_URL}/admin/delete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id })
            });

            const result = await res.json();

            if (result.success) {
                this.showToast('✅ تم الحذف بنجاح!');
                await this.fetchData();
            } else {
                this.showToast(result.error || 'فشل الحذف', 'error');
            }
        } catch (e) {
            this.showToast('خطأ: ' + e.message, 'error');
        }
    },

    async blockIp(ip) {
        if (!confirm(`⚠️ حظر عنوان IP:\n\n${ip}\n\nلن يتمكن هذا المستخدم من التصويت أو المشاركة مرة أخرى!\n\nهل متأكد؟`)) return;

        try {
            this.showToast('جاري حظر IP...');

            const res = await fetch(`${WORKER_URL}/admin/block-ip`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ip })
            });

            const result = await res.json();

            if (result.success) {
                this.showToast(`🚫 تم حظر IP: ${ip}`);
                await this.fetchData();
            } else {
                this.showToast(result.error || 'فشل الحظر', 'error');
            }
        } catch (e) {
            this.showToast('خطأ: ' + e.message, 'error');
        }
    },

    // ==================== تصدير CSV ====================
    
    exportCSV() {
        if (!this.filteredData.length) return this.showToast('لا توجد بيانات للتصدير', 'error');

        const flatData = this.filteredData.map(item => ({
            '#': item.index,
            'التاريخ': new Date(item.timestampISO || item.timestamp).toLocaleString('ar-EG'),
            'IP': item.ip || item.clientIP || '',
            'IP_Hash': item.ipHash || '',
            'Q1_رضا': item.votes?.q1 || '',
            'Q2_تأييد': item.votes?.q2 || '',
            'Q3_اختيار': item.votes?.q3 || '',
            'نوع_المحتوى': item.mediaType || '',
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
        link.download = `elahmadya-survey-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        this.showToast('✅ تم تصدير الملف بنجاح!');
    },

    // ==================== Toast Notifications ====================
    
    showToast(message, type = '') {
        const toast = document.getElementById('toast');
        if (!toast) return alert(message);

        toast.textContent = message;
        toast.className = 'toast ' + type;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 4000);
    }
};

// ==================== Global Functions ====================

function closeModal(event) {
    if (!event || event.target.id === 'media-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('media-modal').classList.remove('active');
        
        // Stop any playing media
        const video = document.querySelector('#modal-media-container video');
        const audio = document.querySelector('#modal-media-container audio');
        if (video) video.pause();
        if (audio) audio.pause();
    }
}

// Auto-login if token exists
window.admin = admin;
if (admin.token) {
    admin.fetchData();
}
