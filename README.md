# استبيان مركز شباب الأحمدية — Al Ahmadiya Youth Center Public Survey

PWA عام لأهالي قرية الأحمدية للتصويت على استبيان مركز الشباب، مع مشاركات فيديو/فويس نوت تخضع للمراجعة، ولوحة نتائج مباشرة، ولوحة تحكم إدارية محمية بكلمة مرور متغيرة كل دقيقة.

## بنية المشروع

```
ahmadiya-survey/
├── index.html              الصفحة الرئيسية (PWA)
├── style.css                التصميم الكامل
├── app.js                    منطق الواجهة (تصويت، تسجيل، تنقّل)
├── animations.js             حركات GSAP + جزيئات الخلفية
├── charts.js                 رسوم Chart.js المتصلة بـ Firebase
├── firebase-config.js        تهيئة Firebase (استبدل القيم بمشروعك)
├── manifest.json             بيانات تثبيت PWA
├── service-worker.js         التخزين المؤقت + دعم عدم الاتصال
├── admin.html / admin.js     لوحة تحكم الإدارة
├── cloudflare/
│   ├── worker.js              كود Cloudflare Worker الكامل
│   └── wrangler.toml          إعدادات النشر
├── firebase/
│   └── database.rules.json    قواعد أمان قاعدة البيانات
├── assets/icons/               أيقونات PWA
└── docs/                       أدلة النشر التفصيلية
```

## لماذا التصويت غير قابل للتعديل؟

كل صوت يُخزَّن باستخدام `ipHash` (تجزيء IP + مفتاح سري) كمفتاح فريد في `votes_index`. الـ Worker يرفض أي طلب تصويت ثانٍ من نفس `ipHash` بكود الحالة 409، ولا يوجد أي مسار API عام للتعديل أو الحذف — الحذف ممكن فقط من لوحة الإدارة، ويُستخدم فقط في حالة تصويت مزوّر مؤكد (ويُسجَّل في `logs`). المستخدم يرى فقط آخر 4 أرقام من IP الخاص به كتأكيد، ولا يُخزَّن ولا يُعرض IP كامل في أي مكان بالواجهة.

## البدء السريع

1. اقرأ `docs/DEPLOY_FIREBASE.md` وأنشئ مشروع Firebase.
2. اقرأ `docs/DEPLOY_WORKER.md` وانشر الـ Worker على Cloudflare.
3. حدّث `CONFIG.API_BASE` في `app.js` و `admin.js` برابط الـ Worker.
4. حدّث `ALLOWED_ORIGIN` في `cloudflare/worker.js` برابط GitHub Pages الخاص بك.
5. اقرأ `docs/DEPLOY_GITHUB_PAGES.md` لرفع الموقع.
6. استبدل الأيقونات في `assets/icons/` بشعار المركز الحقيقي (المقاسات نفسها).

## ملاحظة أمنية مهمة

كلمة مرور الإدارة (HHMM بتوقيت مصر) هي **حماية إضافية بسيطة**، وليست بديلاً عن مصادقة حقيقية. للاستخدام الفعلي في الإنتاج، يُنصح بشدة بإضافة Firebase Authentication (بريد/كلمة مرور) كطبقة حماية أساسية، واستخدام كلمة المرور المتغيرة كطبقة ثانية فقط (2FA)، كما هو موضح في `docs/DEPLOY_WORKER.md`.
