# متابعة إطلاق سِجل وسِجلي — 2026-11-25 (Baghdad)

## إجراء منفذ على Supabase staging
- المشروع: `dnbcgrcfwusswfvcdlzs`، الحالة ACTIVE_HEALTHY.
- كشف تدقيق Security Advisor أن 16 دالة `SECURITY DEFINER` متاحة لدور `anon`.
- طُبّق SQL الموجود أصلاً بالمستودع في `supabase/migrations/20261123014500_restrict_anon_security_definer_execute.sql` مباشرةً على قاعدة **staging** عبر SQL؛ يسحب `EXECUTE` من `PUBLIC, anon` للدوال `SECURITY DEFINER` باستثناء trigger functions.
- فحص `pg_proc` و`has_function_privilege` بعد التطبيق: كل الدوال غير المحفّزة `SECURITY DEFINER` في `public` التي جرى جردها تعطي `anon_exec=false`؛ احتُفظ بصلاحية `authenticated` للدوال التشغيلية.
- تبقّى تنبيه واحد متعلق بدالة trigger `handle_new_auth_user` في Advisor؛ لا يُعد إثباتاً لقابلية استدعائها عبر REST، ويلزم فحصه قبل أي تغيير. بقيت تحذيرات authenticated SECURITY DEFINER، وتتطلب مراجعة تفويض داخل كل دالة واختبارات RLS، لا سحب الصلاحيات عشوائياً.
- **ملاحظة drift مهمة**: تنفيذ SQL مباشرة لم يسجل migration جديدة في `supabase_migrations`؛ يجب تسوية سجل migrations بعناية قبل `db push` لاحقاً، وعدم إعادة تطبيق ترحيلات غير مفحوصة أو افتراض تطابق قاعدة staging مع الإنتاج.
- لم تُختبر دورة OTP/الشراء/الموافقة end-to-end، ولا تُعتبر staging بيئة إنتاج حقيقية.

## حالة البناء والنشر
- Remote Desktop Commander الجهاز `36hassan` **offline** عند الفحص، لذا لم يكن ممكناً تنفيذ EAS/التزامن المحلي/إعداد المفاتيح.
- آخر فحص EAS production محلي سابق كشف غياب أسماء `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`؛ لا نضع مفتاح secret في Expo public.
- Repository merchant GitHub main يحتوي تحديثات أحدث من النسخة المحلية: أحدث commit مرصود `e4581e778f55d48f927c77bf910447932c470d28`. الإصلاح المحلي السابق `b47924c` لم يُدفع إلى main لأن push رُفض بوجود تغييرات upstream. يجب pull/rebase بعد عودة الجهاز وتجنب force push.
- Repository customer latest observed `7ea26b097f0ee435066f781d34f7932ae50006a6`. يوجد تعارض هوية الحزمة بين `com.debtledgeriq.sijili` (الوثائق) و `com.debtledgeriq.sijili.customer` (app.json)؛ تحقق من Play Console قبل أي تغيير لهوية الحزمة.
- لم يُبن AAB جديد ولم يُرفع أي إصدار إلى Play Console في هذه الجولة. لا لقطات شاشة فعلية حديثة أو إثبات اتصال متجر بالمختبرين.

## الجولة التالية
1. عند اتصال اللابتوب: `git fetch` ثم دمج التحديثات الآمن و`git status`، التحقق من صحة الاختبارات.
2. تمييز مشروع staging عن الإنتاج وتحديد بيئة backend المقصودة، إعداد مفاتيح EAS العامة الصحيحة والتأكد من إعداد RevenueCat والخادم، اختبار OTP/RLS والاشتراكات.
3. بناء AAB حقيقي للتاجر ثم اختبار داخلي/مغلق بعد الجاهزية، وتجهيز لقطات شاشة حقيقية.
4. استكمال تطبيق العميل، حسم package ID من Google Play Console ثم البناء والرفع مع قائمة المختبرين القائمة عند توافر الوصول الصحيح.

**السلامة:** لا إعلان بإطلاق أو دفع أو رفع لم يحدث؛ يجب إعادة فحص حالة الأدوات وحساب النشر قبل أي إجراء خارجي.
