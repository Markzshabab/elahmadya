# 🏆 مجلس شباب قرية الأحمدي - نظام الاستبيان

نظام استبيان ويب تفاعلي كامل مع تسجيل فيديو/صوت وإحصائيات.

## 🚀 النشر على Vercel

### الطريقة 1: عبر GitHub (موصى به)

1. **ارفع الكود على GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/survey-app.git
   git push -u origin main
   ```

2. **اذهب إلى [Vercel](https://vercel.com)**
   - سجّل دخولك أو أنشئ حساب جديد
   - اضغط **"Add New Project"**
   - اختر مستودع GitHub الخاص بك

3. **إعدادات المشروع**
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (أو المجلد الذي يحتوي على المشروع)
   
4. **Environment Variables** (متغيرات البيئة)
   
   اذهب إلى **Settings → Environment Variables** وأضف:
   
   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_FIREBASE_URL` | `https://markzshabab-4c01b-default-rtdb.firebaseio.com` |
   | `NEXT_PUBLIC_WORKER_URL` | `https://markzshabab.studusa05.workers.dev` |
   | `NEXT_PUBLIC_R2_PUBLIC_URL` | `https://pub-3fb0b86037554ed0b842bc258e8a3051.r2.dev` |
   | `NEXT_PUBLIC_ADMIN_PASSWORD` | `admin123` (غيّرها لكلمة مرور قوية!) |

5. **اضغط Deploy!** 🎉

---

### الطريقة 2: عبر Vercel CLI

```bash
# تثبيت Vercel CLI
npm i -g vercel

# تسجيل الدخول
vercel login

# نشر المشروع
vercel

# للإنتاج (Production)
vercel --prod
```

---

## ⚙️ الإعدادات المهمة بعد النشر

### 1. تغيير كلمة مرور الأدمن
في Vercel Dashboard:
- Settings → Environment Variables
- غيّر `NEXT_PUBLIC_ADMIN_PASSWORD` لكلمة مرور قوية
- أعد نشر المشروع (Redeploy)

### 2. Firebase Rules (للأمان)

اذهب إلى [Firebase Console](https://console.firebase.google.com) → Realtime Database → Rules:

```json
{
  "rules": {
    "responses": {
      ".read": true,
      ".write": true
    },
    "fingerprints": {
      ".read": true,
      ".write": true
    }
  }
}
```

> **ملاحظة:** للأمان الإنتاجي، قيّد الوصول حسب احتياجاتك.

---

## 📁 هيكل المشروع

```
survey-app/
├── src/
│   ├── app/
│   │   ├── page.tsx              # الصفحة الرئيسية (9 خطوات)
│   │   ├── layout.tsx            # التخطيط العام RTL
│   │   ├── globals.css           # الأنماط الخضراء
│   │   ├── admin/page.tsx        # لوحة تحكم الأدمن
│   │   └── api/
│   │       ├── survey/submit/    # API إرسال الاستبيان
│   │       ├── media/upload/     # API رفع الوسائط
│   │       ├── stats/            # API الإحصائيات
│   │       ├── gallery/          # API المعرض
│   │       └── admin/
│   │           ├── approve/[id]/ # موافقة
│   │           └── reject/[id]/  # رفض
│   ├── lib/
│   │   ├── db.ts                 # Prisma Client (local dev)
│   │   ├── db-firebase.ts        # Firebase Client (production)
│   │   ├── fingerprint.ts        # نظام بصمة الجهاز
│   │   └── utils.ts              # أدوات مساعدة
│   ├── store/
│   │   └── survey.ts             # Zustand Store
│   └── components/ui/            # مكونات shadcn/ui
├── prisma/
│   └── schema.prisma             # قاعدة البيانات المحلية
├── vercel.json                   # إعدادات Vercel
├── .env.example                  # مثال متغيرات البيئة
├── package.json
├── next.config.ts
└── tailwind.config.ts
```

---

## 🔗 الروابط بعد النشر

| الصفحة | الرابط |
|--------|--------|
| **الاستبيان الرئيسي** | `https://your-domain.vercel.app/` |
| **لوحة تحكم الأدمن** | `https://your-domain.vercel.app/admin` |
| **المعرض** | `https://your-domain.vercel.app/gallery` |
| **الإحصائيات** | `https://your-domain.vercel.app/stats` |

---

## 🛠️ التقنيات المستخدمة

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Database:** Firebase Realtime Database (Production) / SQLite (Dev)
- **Storage:** Cloudflare R2 via Worker
- **State Management:** Zustand
- **Deployment:** Vercel

---

## ✅ قائمة التحقق قبل النشر

- [ ] تغيير كلمة مرور الأدمن
- [ ] إعداد Firebase Rules
- [ ] اختبار رفع الوسائط (R2 Worker)
- [ ] اختبار بصمة الجهاز (منع التكرار)
- [ ] اختبار لوحة الأدمن (الموافقة/الرفض)
- [ ] اختبار على الهاتف المحمول
- [ ] التأكد من عمل RTL بشكل صحيح

---

## 🐞 استكشاف الأخطاء

### مشكلة: CORS Error
**الحل:** تأكد من إضافة Headers في `vercel.json`

### مشكلة: Database Connection Error
**الحل:** يستخدم المشروع Firebase في الإنتاج، لا يحتاج SQLite

### مشكلة: Media Upload Failed
**الحل:** تأكد من أن Worker URL صحيح وR2 متاح

### مشكلة: Environment Variables لا تعمل
**الحل:** أعد بناء المشروع بعد إضافة المتغيرات في Vercel

---

## 📞 الدعم

للمساعدة أو الاستفسارات:
- راجع [وثائق Next.js](https://nextjs.org/docs)
- راجع [وثائق Vercel](https://vercel.com/docs)

---

**صُنع بـ ❤️ لمجلس شباب قرية الأحمدي**
