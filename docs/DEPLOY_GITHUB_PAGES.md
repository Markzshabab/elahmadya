# دليل نشر GitHub Pages

## 1. إنشاء المستودع
```bash
git init
git add .
git commit -m "Initial commit — Al Ahmadiya Youth Center Survey"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ahmadiya-survey.git
git push -u origin main
```

## 2. تفعيل GitHub Pages
1. افتح المستودع على GitHub → Settings → Pages
2. Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)`
3. احفظ، وانتظر دقيقة، سيظهر رابط مثل:
   `https://YOUR_USERNAME.github.io/ahmadiya-survey/`

## 3. تحديث الروابط الداخلية
لأن GitHub Pages ينشر المشروع تحت مسار فرعي (`/ahmadiya-survey/`) وليس الجذر:
- تأكد أن `manifest.json` → `start_url` و `scope` يطابقان هذا المسار، أو استخدم مسارات نسبية (كما هو مطبّق بالفعل في `index.html` و `service-worker.js`)
- حدّث `ALLOWED_ORIGIN` في `cloudflare/worker.js` إلى:
  `https://YOUR_USERNAME.github.io`

## 4. HTTPS + PWA
GitHub Pages يوفر HTTPS تلقائيًا، وهو **شرط أساسي** لعمل:
- Service Worker
- `beforeinstallprompt` (تثبيت التطبيق الحقيقي، ليس اختصار شاشة فقط)
- الوصول للكاميرا/الميكروفون (`getUserMedia`)

## 5. اختبار التثبيت كتطبيق حقيقي
- على أندرويد (Chrome): يظهر بانر "تثبيت" تلقائيًا بعد التفاعل مع الموقع، ويُثبَّت كتطبيق مستقل بأيقونة في قائمة التطبيقات (وليس اختصار متصفح)
- على iOS (Safari): لا يدعم `beforeinstallprompt`، والتثبيت الحقيقي كتطبيق يتم فقط عبر "إضافة إلى الشاشة الرئيسية" من قائمة المشاركة — هذا قيد من Apple نفسها ولا يمكن تجاوزه من الموقع

## 6. تخصيص Domain (اختياري)
إذا أردت رابطًا مخصصًا مثل `survey.ahmadiya-village.com`:
1. أضف ملف `CNAME` بالجذر يحتوي على الدومين
2. أضف سجل CNAME في مزوّد الدومين يشير إلى `YOUR_USERNAME.github.io`
3. حدّث `ALLOWED_ORIGIN` في الـ Worker بالدومين الجديد
