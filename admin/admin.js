const WORKER_URL = 'https://markzshabab.studusa05.workers.dev';

const admin = {
    token: sessionStorage.getItem('admin_token') || null,
    surveyData: [],

    login() {
        const pass = document.getElementById('admin-pass')?.value;
        if (!pass) return alert('يرجى إدخال كلمة المرور.');
        this.token = pass; sessionStorage.setItem('admin_token', this.token);
        this.fetchData();
    },
    logout() { sessionStorage.removeItem('admin_token'); location.reload(); },

    async fetchData() {
        try {
            const res = await fetch(`${WORKER_URL}/admin/submissions`, { headers: { 'Authorization': `Bearer ${this.token}` } });
            if (res.status === 401) { alert('كلمة المرور غير صحيحة.'); sessionStorage.removeItem('admin_token'); return; }
            document.getElementById('login-screen').style.display = 'none'; document.getElementById('dashboard-screen').style.display = 'block';
            const data = await res.json();
            this.surveyData = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            this.renderTable(this.surveyData);
        } catch (error) { alert("حدث خطأ أثناء جلب البيانات."); }
    },

    renderTable(data) {
        const tbody = document.getElementById('table-body');
        if (!tbody) return; tbody.innerHTML = '';
        
        data.sort((a, b) => b.timestamp - a.timestamp).forEach(item => {
            const date = new Date(item.timestamp).toLocaleString('ar-EG');
            const ipAddress = item.ip || 'غير معروف';
            let mediaHtml = 'لا يوجد';
            let statusText = item.status === 'approved' ? 'مقبول' : (item.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة');
            let statusColor = item.status === 'approved' ? '#2ecc71' : (item.status === 'rejected' ? '#e74c3c' : '#f39c12');

            if (item.mediaUrl) {
                if (item.mediaType === 'video') mediaHtml = `<video src="${item.mediaUrl}" controls preload="metadata" style="max-width:140px; border-radius:8px;"></video>`;
                else mediaHtml = `<audio src="${item.mediaUrl}" controls preload="metadata" style="width:150px;"></audio>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${date}</td>
                <td><code style="background:rgba(0,242,254,0.1); padding:3px 6px; border-radius:6px; color:var(--primary);">${ipAddress}</code></td>
                <td>${item.votes?.q1 || '-'}</td>
                <td>${item.votes?.q2 || '-'}</td>
                <td>${mediaHtml} <br> <span style="font-size:0.8rem; color:${statusColor}; font-weight:bold;">${item.mediaUrl ? statusText : ''}</span></td>
                <td style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center;">
                    ${item.status === 'pending' && item.mediaUrl ? `
                        <button class="btn-primary action-btn" style="background:#2ecc71; padding:5px 10px; width:auto; margin:0;" onclick="admin.updateStatus('${item.id}', 'approved')" title="قبول ونشر في المعرض">قبول</button>
                        <button class="btn-danger action-btn" style="background:#f39c12; padding:5px 10px; width:auto; margin:0;" onclick="admin.updateStatus('${item.id}', 'rejected')" title="رفض وعدم النشر">رفض</button>
                    ` : ''}
                    <button class="btn-danger action-btn" style="padding:5px 10px; width:auto; margin:0;" onclick="admin.deleteEntry('${item.id}')" title="حذف التصويت"><i class="fas fa-trash"></i></button>
                    ${ipAddress !== 'غير معروف' ? `<button class="btn-danger action-btn" style="background:#e74c3c; padding:5px 10px; width:auto; margin:0;" onclick="admin.blockIp('${ipAddress}')" title="حظر هذا الـ IP"><i class="fas fa-ban"></i> حظر</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    async updateStatus(id, newStatus) {
        if (!confirm(`هل أنت متأكد من ${newStatus === 'approved' ? 'قبول ونشر' : 'رفض'} هذا التسجيل؟`)) return;
        try { await fetch(`${WORKER_URL}/admin/update-status`, { method: 'POST', headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) }); this.fetchData(); } catch (e) { alert("فشلت عملية التحديث."); }
    },
    async deleteEntry(id) {
        if (!confirm("هل أنت متأكد من حذف هذا التصويت نهائياً؟")) return;
        try { await fetch(`${WORKER_URL}/admin/delete`, { method: 'POST', headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); this.fetchData(); } catch (e) { alert("فشلت عملية الحذف."); }
    },
    async blockIp(ip) {
        if (!confirm(`حظر عنوان IP: (${ip})؟ لن يتمكن من التصويت مرة أخرى.`)) return;
        try { await fetch(`${WORKER_URL}/admin/block-ip`, { method: 'POST', headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) }); alert(`تم حظر ${ip}`); } catch (e) { alert("فشل الحظر."); }
    },
    searchTable() {
        const query = document.getElementById('search-box').value.toLowerCase();
        const filtered = this.surveyData.filter(item => JSON.stringify(item).toLowerCase().includes(query));
        this.renderTable(filtered);
    },
    exportCSV() {
        if (!this.surveyData.length) return alert('لا توجد بيانات للتصدير.');
        const flatData = this.surveyData.map(item => ({ ID: item.id, Date: new Date(item.timestamp).toLocaleString('ar-EG'), IP: item.ip || 'Unknown', Q1: item.votes?.q1 || '', Q2: item.votes?.q2 || '', Q3: item.votes?.q3 || '', MediaURL: item.mediaUrl || 'None', Status: item.status }));
        const headers = Object.keys(flatData[0]);
        const csvContent = "\uFEFF" + [ headers.join(','), ...flatData.map(row => headers.map(h => `"${row[h]}"`).join(',')) ].join('\n');
        const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })); link.download = `survey_${Date.now()}.csv`; link.click();
    }
};
window.admin = admin; if (admin.token) admin.fetchData();