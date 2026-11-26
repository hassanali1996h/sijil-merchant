# ملف تجهيز Google Play Console — سِجل

آخر مراجعة: 22 نوفمبر 2026. **حزمة جاهزة للنقل إلى حقول المتجر بعد اختبار الإصدار، وليست إفادة بأن النشر اكتمل.**

## هوية التطبيق
- الاسم الظاهر في إعداد Expo: **سِجل**
- Android package المؤكد: `com.debtledgeriq.sijil.merchant` — يجب الاحتفاظ به في كل تحديث لحزمة سِجل الموجودة.
- نوع التطبيق: تطبيق جوّال؛ اللغة العربية الأساسية؛ واجهة سورانية داخلية (لا تضف لغة متجر لم يتم تحريرها واختبارها).
- تصنيف مقترح للفحص: Finance أو Business وفق التصنيف المتاح الفعلي في Play Console؛ لا تختَر تصنيف القروض الشخصية لأن التطبيق دفتر سجلات لا يُصدر قروضاً.
- سوق أولي: العراق؛ تحقّق من إتاحة البلد داخل Console قبل نشر أي إصدار.

## Store Listing — نصوص معدّة للنسخ
**App name:** سِجل

**Short description:** سِجل: نظّم ديون المحل وطلبات التسديد بموافقة العميل.

**Full description:**

سِجل يساعد أصحاب المحلات على تنظيم حسابات العملاء في مكان واحد.

• دخول العميل وصاحب المحل عبر البريد الإلكتروني أو Google، وربط العملاء بالدعوات إلى بريدهم الموثّق.
• تحديد سقف الدين لكل عميل ومراجعة الرصيد وسجل العمليات.
• إنشاء طلبات الدين والتسديد ومتابعة حالتها.
• لا تدخل العملية ضمن الرصيد المؤكد حتى يوافق عليها العميل؛ ويمكنه الاعتراض.
• عرض العمليات المعلقة والمؤكدة وكشوف الحساب.
• دعم العربية والكردية السورانية.

يحصل صاحب المحل على 30 يوماً مجاناً دون بطاقة دفع ودون اشتراك تلقائي. بعد انتهاء الفترة يمكنه اختيار اشتراك عند توفره داخل Google Play، وتبقى البيانات السابقة متاحة للقراءة عند عدم التجديد.

سِجل أداة لتنظيم حسابات المحل والعميل، وليس جهة إقراض أو تحصيل، ولا يضمن سداد الديون ولا يحل محل المشورة القانونية.

لا تستخدم لقطات أو وصفاً يزعم أن OTP أو الإشعارات أو الشراء تعمل بالإنتاج قبل اختبارها على إصدار Android المرفوع.

## روابط App content
- Privacy policy: https://hassanali1996h.github.io/sijil-merchant/privacy.html
- Account deletion web link: https://hassanali1996h.github.io/sijil-merchant/delete-account.html
- Support: https://hassanali1996h.github.io/sijil-merchant/support.html
- Terms: https://hassanali1996h.github.io/sijil-merchant/terms.html
- المواقع الأربعة فُحصت روابط الخصوصية والحذف فقط عبر HTTP 200 يوم 22 نوفمبر 2026؛ تحقّق أيضاً من محتوى الصفحة وظهورها داخل التطبيق.
- جهة التواصل الموجودة في مصدر الصفحات: `appsijil@gmail.com` — يلزم التأكد أنها مراقبة وتستقبل الرسائل.
- الاسم القانوني للناشر/مسؤول البيانات وفترات الاحتفاظ النهائية بحاجة إلى التحقق؛ لا تقدّم إقرارات قانونية متعارضة مع الواقع.

## App content / Data safety — ورقة تدقيق وليست إجابات مفترضة
- **Does the app collect data? YES** عند تفعيل Supabase: البريد الإلكتروني/معرّف حساب Google للتحقق، معرّف حساب، الاسم/لغة الواجهة، ومعاملات الديون والتسديدات والوصف ومبالغها وتواريخها وحالة الموافقة، وبيانات المحلات المرتبطة.
- **Data types to investigate and declare precisely:** Personal info (email, name, user IDs; legacy phone only if retained for existing users)، Financial info/Other financial info (مبالغ الديون والرصيد، وربما purchase history في تطبيق صاحب المحل)، App activity (إن تم تخزينه)، Device or other IDs (معرف تثبيت التاجر/رمز الإشعارات)، App info/performance (فقط إذا SDK فعلي يرسل سجلات أو diagnostics). راجع تصنيف كل حقل وفق الأسئلة الفعلية.
- **Purposes:** app functionality, account management, fraud prevention/security, notifications; purchases/subscription management في تطبيق التاجر فقط.
- **Data sharing:** مراجعة Supabase, Expo Push, Google OAuth, custom email SMTP provider, RevenueCat and Google Play Billing وفق عقودهم؛ لا تضع "No sharing" قبل التحقق من كونهم service providers ومعالجة كل SDK.
- **Encrypted in transit:** تحقّق من HTTPS/TLS في كل اتصال فعلي، وليس من مصدر JavaScript فقط.
- **Can users request deletion?** توجد وظيفة طلب الحذف داخل إعدادات الكود ورابط ويب؛ يجب إجراء اختبار طلب وحذف فعلي في مشروع اختبار منفصل، مع تحديد ما يبقى من سجلات مشتركة وأساس الاحتفاظ.
- **Advertising:** لا توجد SDK إعلانات ظاهرة في package.json الذي راجعناه؛ تحقق من Android merged manifest وAAB قبل اختيار "No ads".
- **Financial features declaration:** التطبيق يتتبع ديون المحلات، فلا تجب خطأ بأن التطبيق لا يخص بيانات مالية. اختر التصنيف المطابق حرفياً من خيارات Google بعد مراجعة طبيعة الخدمة؛ لا تعرضه على أنه مُقرض أو مقدم قروض نقدية.
- **Target audience:** صُمم للاستخدام التجاري أو لإدارة حسابات الكبار؛ راجع إعداد جمهور Google والأسئلة العمرية، ولا تستهدف الأطفال دون تحقق.
- **Permissions:** الإشعارات؛ افحص الصلاحيات الفعلية من Android Manifest الناتج. لا تضف صلاحيات الرسائل SMS أو جهات الاتصال أو الملفات دون ضرورة وتبرير.
- **App access:** تسجيل الدخول بالبريد الإلكتروني الموثّق أو Google؛ يلزم توفير حسابَي مراجعة حقيقيين وآلية وصول تعمل خلال المراجعة دون تعطيل الأمان.

## متطلب مسار الاختبار قبل Production

- افحص نوع حساب المطور وتاريخ إنشائه في Play Console. إذا كان حساباً شخصياً أُنشئ بعد 13 نوفمبر 2023، فيلزم إكمال اختبار مغلق مع 12 مختبراً على الأقل ظلوا منضمين باستمرار 14 يوماً، ثم طلب صلاحية Production والإجابة عن أسئلة Google. لا يكفي Internal testing لهذا الشرط.
- إذا كان الحساب من نوع آخر أو أقدم، راجع متطلبات لوحة التحكم الخاصة بالحساب قبل تحديد المسار؛ لا تفترض أن شرط الاختبار ينطبق أو لا ينطبق دون التحقق.
- لا يبدأ احتساب الأيام قبل انضمام المختبرين فعلياً إلى الاختبار المغلق. خطط لذلك بعد رفع نسخة اختبار مناسبة، واحتفظ بملخص التغذية الراجعة والإصلاحات لتقديمه عند طلب صلاحية Production.

## البناء والنشر
1. تحقق من خصائص الإصدار: `eas.json`، إعداد Production environment، توقيع Google Play App Signing، وAndroid package.
2. Google Play يتطلب Android 16 / target API **36** للتطبيقات الجديدة/التحديثات الحالية منذ 31 أغسطس 2026 بحسب سياسة Google؛ أثبت targetSdkVersion من الـ AAB قبل التقديم.
3. ابنِ AAB موقعاً فعلياً في EAS، تأكد من رقم versionCode غير مستخدم، وافحص الـ permissions وحالة crash.
4. ارفع أولاً إلى Internal testing مع حسابات اختبار، وليس Production مباشرة.
5. اختبر على الهاتف: Google OAuth ورمز/رابط البريد، الربط بين دورَي التطبيق الموحد، الطلب والاعتراض، حدود الدين، تقييد الوصول، انقطاع الإنترنت والحذف.
6. إعداد منتجات Google Play Billing الثلاثة، ربط RevenueCat وmerchant_pro، اختبار الشراء/الإلغاء/الاستعادة قبل إتاحة Production. أسعار 2,500 و12,500 و20,000 د.ع أهداف تجارية، ويُعرض السعر الفعلي من المتجر.
7. اكمل App content: Privacy policy, Data safety, Financial features, Content rating, Target audience, Ads, App access, Government/other declarations إذا ظهرت، ثم Full store listing وصور حقيقية وشعار وصورة Feature Graphic.
8. عند جاهزية الاختبارات وإصلاح العوائق، أرسل إلى المسار الملائم للمراجعة، وراجع نتائج Play Console بدلاً من افتراض القبول.

## فجوات مؤكدة من مستودع المصدر بتاريخ 22 نوفمبر 2026
- ملف EAS كان يحوي preview/preview-connected فقط؛ لا يوجد ملف Production AAB مثبت أنه بُني ورُفع.
- عنوان Play Console الحقيقي وإجابات App content الحالية لم تُقرأ؛ جلسة المتصفح المفتوحة تظهر Google account لا يدخل إلى حساب مطور التطبيقات.
- OTP provider وحسابات المراجع والمشتريات الحقيقية والاختبارات على أجهزة فعلية ليست مثبتة النجاح.
- الاسم القانوني، صورة العلامة التجارية، لقطة الشاشة التجارية، والصلاحيات النهائية تحتاج مراجعة.

## مصادر سياسات Google الرسمية
- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://support.google.com/googleplay/android-developer/answer/13849271
- https://support.google.com/googleplay/android-developer/answer/11926878
