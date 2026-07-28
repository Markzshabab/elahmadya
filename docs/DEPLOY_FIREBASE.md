# دليل نشر Firebase

## 1. إنشاء المشروع
1. اذهب إلى https://console.firebase.google.com
2. أنشئ مشروعًا جديدًا (Add project)
3. من القائمة الجانبية اختر **Realtime Database** → Create Database → اختر أقرب موقع خادم → ابدأ في **Locked mode**

## 2. تفعيل قواعد الأمان
1. افتح تبويب **Rules** داخل Realtime Database
2. الصق محتوى `firebase/database.rules.json` كاملاً واضغط Publish
3. هذه القواعد تمنع أي كتابة مباشرة من المتصفح — كل الكتابة تتم فقط عبر Cloudflare Worker باستخدام Database Secret

## 3. الحصول على Database Secret (للـ Worker)
1. Project Settings ⚙️ → Service accounts → Database secrets
2. انسخ القيمة وضعها كـ secret في الـ Worker: `wrangler secret put FIREBASE_SECRET`

> ⚠️ Database Secrets قديمة (Legacy) لكنها أبسط للتوضيح هنا. للإنتاج الحقيقي، يُفضّل استخدام Service Account + Google OAuth2 token exchange (موضّح كخيار متقدم في `DEPLOY_WORKER.md`).

## 4. تفعيل Authentication (للوحة الإدارة فقط)
1. Authentication → Sign-in method → فعّل Email/Password
2. أنشئ حساب أدمن واحد فقط (بريد + كلمة مرور قوية)
3. هذا الحساب يُستخدم لقراءة البيانات الحساسة (الأصوات الكاملة، الفيديوهات) من لوحة التحكم عبر Firebase SDK مباشرة، بجانب كلمة المرور المتغيرة للوصول للوحة نفسها

## 5. نسخ بيانات الإعداد إلى الموقع
1. Project Settings → General → Your apps → Add app → Web (</>)
2. انسخ القيم إلى `firebase-config.js` في مكان الحقول `REPLACE_WITH_...`

## 6. هيكل قاعدة البيانات النهائي
```
/votes/{voteId}            { q1, q2, q3, ipHash, ipLast4, ts, immutable:true }
/votes_index/{ipHash}      { voteId, ts }              (يمنع التصويت المكرر)
/media/{mediaId}           { type, r2Key, status, ipHash, ts }
/statistics/summary        { total, today, week, q1{}, q2{}, q3{}, mediaSubmitted, mediaApproved, mediaRejected }
/statistics/daily/{date}   { count }
/banned_ips/{ipHash}       { reason, ts }
/settings                  (محجوز لإعدادات مستقبلية)
/logs/{logId}              { action, ipHash|voteId|mediaId, ts }
```
