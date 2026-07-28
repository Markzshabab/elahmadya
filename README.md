# استبيان مركز شباب الأحمدية

استبيان عام لأهالي قرية الأحمدية حول مستقبل مركز الشباب — نتائج فورية وشفافة.

## المميزات

- تصويت آمن (صوت واحد فقط لكل شخص)
- مشاركة عبر واتساب مدمجة
- تسجيل فيديو / صوت (30 ثانية)
- نتائج مباشرة مع رسوم بيانية
- لوحة تحكم للإدارة
- PWA — يمكن تثبيته كتطبيق
- تصميم متجاوب (جوال + سطح المكتب)

## النشر على GitHub Pages

1. أنشئ مستودع جديد على GitHub
2. ارفع جميع ملفات المشروع (بدون مجلد `.git`)
3. فعّل GitHub Pages من Settings > Pages > Deploy from branch (main, / (root))
4. الموقع سيكون متاحًا على: `https://YOUR_USERNAME.github.io/elahmadya/`

## نشر Cloudflare Worker

1. أنشئ مشروع على Cloudflare Workers
2. انسخ محتوى `worker.js` كملف `index.js` في المشروع
3. أضف المتغيرات البيئية (Environment Variables) في Cloudflare Dashboard:
   - `FIREBASE_DB_URL` — رابط قاعدة بيانات Firebase
   - `FIREBASE_SECRET` — Firebase Database Secret
   - `TURNSTILE_SECRET` — Cloudflare Turnstile Secret Key
   - `IP_SALT` — أي نص عشوائي لتشفير IPs
   - `R2_PUBLIC_BASE_URL` — (اختياري) رابط العام لـ R2 bucket
4. اربط KV namespace باسم `RATE_LIMIT_KV`
5. اربط R2 bucket باسم `R2_BUCKET` (اختياري)

## الإعدادات المطلوبة

### في `app.js` و `admin.js`
- غيّر `CONFIG.API_BASE` إلى رابط الوركر الخاص بك

### في `worker.js`
- أضف دومين GitHub Pages الخاص بك في `ALLOWED_ORIGINS`

---

تم التطوير بواسطة صفحة **[الأحمدية بلدنا](https://www.facebook.com/profile.php?id=100036184718999)** على فيسبوك
