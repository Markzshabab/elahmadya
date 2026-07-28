# دليل نشر Cloudflare Worker + R2 + Turnstile

## 1. تثبيت Wrangler
```bash
npm install -g wrangler
wrangler login
```

## 2. إنشاء R2 Bucket
```bash
wrangler r2 bucket create ahmadiya-survey-media
```
فعّل الوصول العام (Public Access) من لوحة Cloudflare → R2 → الباكت → Settings، أو اربط دومين مخصص مثل `media.yourdomain.com` واستخدمه في `R2_PUBLIC_BASE_URL`.

مجلدات الباكت (تُنشأ تلقائيًا كـ prefixes عند أول رفع):
```
pending/      ملفات جديدة قيد المراجعة
approved/     ملفات معتمدة تظهر في الحائط العام
rejected/     ملفات مرفوضة (تُحتفظ بها للتدقيق أو تُحذف بعد فترة)
thumbnails/   صور مصغّرة (اختياري، تحتاج لخدمة توليد thumbnails)
```

## 3. إنشاء KV Namespace (لتحديد المعدل وجلسات الأدمن)
```bash
wrangler kv:namespace create RATE_LIMIT_KV
```
انسخ الـ id الناتج إلى `wrangler.toml`.

## 4. إعداد Cloudflare Turnstile
1. Cloudflare Dashboard → Turnstile → Add site
2. انسخ **Site Key** إلى `CONFIG.TURNSTILE_SITE_KEY` في `app.js`
3. انسخ **Secret Key** كسر: `wrangler secret put TURNSTILE_SECRET`

## 5. ضبط الأسرار (Secrets)
```bash
wrangler secret put IP_SALT              # نص عشوائي طويل، مثال: openssl rand -hex 32
wrangler secret put ADMIN_PASSWORD_SALT  # نص عشوائي آخر مختلف
wrangler secret put FIREBASE_SECRET      # من DEPLOY_FIREBASE.md
```

## 6. تفعيل حماية VPN/Proxy/Tor/Datacenter
هذه الميزة تعتمد على `request.cf.botManagement` المتاح في خطط Cloudflare Pro/Business/Enterprise مع تفعيل **Bot Management**. إذا كانت خطتك Free/أساسية:
- استخدم خدمة IP intelligence خارجية (مثل IPQualityScore أو IPinfo) داخل `isSuspiciousTraffic()`
- أو فعّل **Cloudflare Turnstile "Managed Challenge"** فقط كحد أدنى للحماية (مطبّق بالفعل في هذا المشروع)

## 7. النشر
```bash
cd cloudflare
wrangler deploy
```
سيعطيك رابطًا مثل:
`https://ahmadiya-survey-worker.YOUR_SUBDOMAIN.workers.dev`

ضع هذا الرابط في:
- `app.js` → `CONFIG.API_BASE`
- `admin.js` → `API_BASE`
- `cloudflare/wrangler.toml` → لا حاجة، فقط تأكد من `ALLOWED_ORIGIN` في `worker.js` يطابق رابط GitHub Pages

## 8. تفعيل نظام مراجعة الفيديو التلقائي (Auto-Moderation)
الكود الحالي في `moderateMedia()` بداخل `worker.js` هو **إطار جاهز** يترك كل ملف في "قيد المراجعة" حتى تربطه بمحرك تصنيف حقيقي. أفضل الخيارات:
- **Cloudflare Workers AI** (`@cf/microsoft/resnet-50` للصور المستخرجة من الفيديو + نموذج تصنيف NSFW)
- **Hive Moderation API** أو **AWS Rekognition Content Moderation** (يدعمان الفيديو مباشرة)
- استخراج إطارات من الفيديو (frame sampling) بمكتبة مثل `ffmpeg.wasm` في خطوة معالجة منفصلة (Cloudflare Queue + Container) قبل تمريرها للتصنيف

⚠️ لا تعرض أي فيديو للعامة تلقائيًا دون تأكيد بشري في البداية، حتى تتأكد من دقة نموذج المراجعة الآلي — اتركه في "قيد المراجعة" ليراجعه الأدمن يدويًا من `admin.html` إلى أن تثبت كفاءة النموذج.

## 9. كلمة مرور الإدارة المتغيرة
تُحسب في `getCurrentAdminPassword()` بناءً على توقيت القاهرة (Africa/Cairo) بصيغة HHMM بنظام 12 ساعة. هذه الطبقة إضافية فقط — الأمان الحقيقي يعتمد على:
- HTTPS دائمًا (مفعّل تلقائيًا في Workers + GitHub Pages)
- Rate limiting على `/api/admin/login` (أضف هذا في worker.js لمنع تجربة كل الاحتمالات في نفس الدقيقة — 10000 احتمال فقط)
- يُفضّل إضافة Firebase Authentication كطبقة أساسية قبل عرض لوحة التحكم، كما ذُكر في `DEPLOY_FIREBASE.md`
