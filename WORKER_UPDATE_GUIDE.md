# 📋 دليل تحديث Worker - استبيان الحمادية

## 🔄 Endpoint الجديدة المضافة

### **1. POST /submit** (رئيسي - يستخدمه app.js)
```javascript
// البيانات المرسلة (FormData):
// - votes: JSON string { q1: 'Very Satisfied', q2: 'Yes', q3: 'New Youth' }
// - fingerprint: string (بصمة الجهاز)
// - media: File (اختياري)
// - type: 'video' | 'audio' (اختياري)

// الاستجابة:
{ success: true, voteId: "xxx", mediaUploaded: false }
// أو
{ success: false, error: "رسالة الخطأ" }
```

### **2. POST /check-status** (للتحقق من البصمة)
```javascript
// الطلب:
{ fingerprint: "fp_xxx_xxx" }

// الاستجابة:
{ has_voted: false, banned: false, can_vote: true }
```

### **3. GET /stats** (للرسوم البيانية - charts.js)
```javascript
// الاستجابة (متوافق مع charts.js):
{
  q1_satisfied: 15,      // عدد الراضين
  q1_not: 5,             // number of not satisfied
  q2_yes: 18,            // number who support youth
  q2_no: 2,              // number who don't support
  q3_new: 12,            // number who chose new youth
  q3_current: 8,         // number who chose current management
  video_count: 10,       // approved videos
  audio_count: 0,
  total_votes: 20,
  success: true
}
```

---

## 📊 تحويل قيم التصويت

| القيمة من الواجهة | القيمة في Firebase |
|-------------------|-------------------|
| `Very Satisfied` / `راضي جداً` | `satisfied` |
| `Not Satisfied` / `غير راضي` | `not_satisfied` |
| `Yes` / `نعم، أؤيد` | `youth` |
| `No` / `لا أؤيد` | `current` |
| `New Youth` / `شباب جديد` | `new_youth` |
| `Current Management` / `الإدارة الحالية` | `current_mgmt` |

---

## 🔧 خطوات التحديث

### **1. نسخ الكود الجديد**
انسخ محتويات `worker-updated.js` إلى Cloudflare Worker

### **2. التحقق من المتغيرات البيئية**
تأكد من وجود هذه المتغيرات في Worker:
- `FIREBASE_DB_URL`: رابط قاعدة بيانات Firebase
- `FIREBASE_SECRET`: مفتاح سرية Firebase
- `IP_SALT`: salt لتشفير IP (أي نص عشوائي)
- `R2_BUCKET`: (اختياري) رابط R2 bucket للملفات
- `R2_PUBLIC_BASE_URL`: (اختياري) URL عام لـ R2
- `RATE_LIMIT_KV`: (اختياري) KV namespace للحد من الطلبات
- `TURNSTILE_SECRET`: (اختياري) مفتاح Turnstile

### **3. تحديث CORS**
أضف هذه النطاقات إلى `ALLOWED_ORIGINS`:
```
https://markzshabab.github.io
https://elahmadya.pages.dev
```

### **4. اختبار Endpoints**

#### اختبار الإحصائيات:
```bash
curl https://markzshabab.studusa05.workers.dev/stats
```

#### اختبار حالة الجهاز:
```bash
curl -X POST https://markzshabab.studusa05.workers.dev/check-status \
  -H "Content-Type: application/json" \
  -d '{"fingerprint": "test_fp_123"}'
```

#### اختبار إرسال تصويت:
```bash
curl -X POST https://markzshabab.studusa05.workers.dev/submit \
  -F 'votes={"q1":"Very Satisfied","q2":"Yes","q3":"New Youth"}' \
  -F 'fingerprint=test_device_fp'
```

---

## ✅ التوافقية

| الملف | Endpoint المستخدم | متوافق؟ |
|-------|------------------|---------|
| `app.js` | `/submit`, `/check-status`, `/stats` | ✅ |
| `charts.js` | `/stats` | ✅ |
| `gallery/gallery.js` | `/media` | ✅ |
| `admin/admin.js` | `/api/admin/*` | ✅ |

---

## 🚀 ملاحظات مهمة

1. **البصمة**: يتم تخزين hash البصمة في `fingerprints/{hash}` للتحقق من تكرار التصويت
2. **IP**: يتم استخدام hash IP + salt كمعرف فريد
3. **الحدود**: 5 طلبات كل 5 دقائق لكل IP
4. **الوسائط**: تلقائياً يتم اعتمادها (يمكن تعديل `moderateMedia` لإضافة مراجعة)

---

## 📞 الدعم

إذا واجهت أي مشاكل، تأكد من:
1. صحة متغيرات البيئة
2. صلاحيات Firebase (ReadWrite)
3. إعدادات CORS الصحيحة
4. وجود KV namespace (للحد من الطلبات)
