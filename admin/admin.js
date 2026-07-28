/**
 * Al Ahmadiya Youth Center Survey - Admin Dashboard Logic
 * Added IP Display, Delete Submission, and Block IP functionality
 */

const WORKER_URL = 'https://markzshabab.studusa05.workers.dev';

const admin = {
    token: sessionStorage.getItem('admin_token') || null,
    surveyData: [],

    login() {
        const passInput = document.getElementById('admin-pass');
        const pass = passInput ? passInput.value : '';
        if (!pass) return alert('يرجى إدخال كلمة المرور.');

        this.token = pass; 
        sessionStorage.setItem('admin_token', this.token);
        this.fetchData();
    },

    logout() {
        sessionStorage.removeItem('admin_token');
        location.reload();
    },

    async fetchData() {
        try {
            const res = await fetch(`${WORKER_URL}/admin/submissions`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (res.status === 401) {
                alert('كلمة المرور غير صحيحة.');
                sessionStorage.removeItem('admin_token');
                return;
            }

            const loginScreen = document.getElementById('login-screen');
            const dashScreen = document.getElementById('dashboard-screen');
            if (loginScreen) loginScreen.style.display = 'none';
            if (dashScreen) dashScreen.style.display = 'block';

            const data = await res.json();
            this.surveyData = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            this.renderTable(this.surveyData);

        } catch (error) {
            console.error("Error fetching admin data:", error);
            alert("حدث خطأ أثناء جلب البيانات.");
        }
    },

    renderTable(data) {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        data.sort((a, b) => b.timestamp - a.timestamp).forEach(item => {
            const date = new Date(item.timestamp).toLocaleString('ar-EG');
            const ipAddress = item.ip || 'غير معروف';
            let mediaHtml = 'لا يوجد';

            if (item.mediaUrl) {
                if (item.mediaType === 'video') {
                    mediaHtml = `<video src="${item.mediaUrl}" class="media-preview" controls preload="metadata" style="max-width:100px;"></video>`;
                } else {
                    mediaHtml = `<audio src="${item.mediaUrl}" controls preload="metadata" style="width:120px;"></audio>`;
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${date}</td>
                <td><code style="background:rgba(0,242,254,0.1); padding:3px 6px; border-radius:6px; color:var(--primary);">${ipAddress}</code></td>
                <td>${item.votes?.q1 || '-'}</td>
                <td>${item.votes?.q2 || '-'}</td>
                <td>${mediaHtml}</td>
                <td>
                    <button class="btn-danger action-btn" onclick="admin.deleteEntry('${item.id}')" title="حذف التصويت"><i class="fas fa-trash"></i> حذف</button>
                    ${ipAddress !== 'غير معروف' ? `<button class="btn-danger action-btn" style="background:#e74c3c; margin-right:5px;" onclick="admin.blockIp('${ipAddress}')" title="حظر هذا الـ IP"><i class="fas fa-ban"></i> حظر IP</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    async deleteEntry(id) {
        if (!confirm("هل أنت متأكد من حذف هذا التصويت نهائياً؟")) return;

        try {
            await fetch(`${WORKER_URL}/admin/delete`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ id })
            });
            this.fetchData();
        } catch (e) {
            alert("فشلت عملية الحذف.");
        }
    },

    async blockIp(ip) {
        if (!confirm(`هل أنت متأكد من حظر عنوان الـ IP التالي: (${ip})؟ لن يتمكن من التصويت مرة أخرى.`)) return;

        try {
            const res = await fetch(`${WORKER_URL}/admin/block-ip`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ ip })
            });
            const data = await res.json();
            if (data.success) {
                alert(`تم حظر الـ IP بنجاح: ${ip}`);
            }
        } catch (e) {
            alert("فشلت عملية حظر الـ IP.");
        }
    },

    searchTable() {
        const query = document.getElementById('search-box').value.toLowerCase();
        const filtered = this.surveyData.filter(item => 
            JSON.stringify(item).toLowerCase().includes(query)
        );
        this.renderTable(filtered);
    },

    exportCSV() {
        if (!this.surveyData.length) return alert('لا توجد بيانات للتصدير.');

        const flatData = this.surveyData.map(item => ({
            ID: item.id,
            Date: new Date(item.timestamp).toLocaleString('ar-EG'),
            IP: item.ip || 'Unknown',
            Q1: item.votes?.q1 || '',
            Q2: item.votes?.q2 || '',
            Q3: item.votes?.q3 || '',
            MediaURL: item.mediaUrl || 'None'
        }));

        const headers = Object.keys(flatData[0]);
        const csvContent = "\uFEFF" + [
            headers.join(','),
            ...flatData.map(row => headers.map(h => `"${row[h]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `survey_export_${Date.now()}.csv`;
        link.click();
    }
};

window.admin = admin;

if (admin.token) {
    admin.fetchData();
}