
const fs=require('fs');const path=require('path');const root=process.cwd();
const file=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const tests=[
['existing Play package retained',()=>require('assert').strictEqual(JSON.parse(file('apps/merchant/app.json')).expo.android.package,'com.debtledgeriq.sijil.merchant')],
['both deep link schemes supported',()=>{const s=JSON.parse(file('apps/merchant/app.json')).expo.scheme;require('assert').deepStrictEqual(s,['debtledger-merchant','debtledger-customer'])}],
['role switch protected by session',()=>{const s=file('apps/merchant/app/roles.tsx');for(const k of ["supabase.auth.getSession()","'/client/home'","'/home'"])require('assert').ok(s.includes(k),k)}],
['customer ledger restricted to account links',()=>{const s=file('apps/merchant/app/client/home.tsx');for(const k of [".eq('customer_user_id', userData.user.id)",".in('customer_link_id', activeLinkIds)"])require('assert').ok(s.includes(k),k)}],
['customer role does not charge',()=>{const s=file('apps/merchant/app/client/home.tsx');require('assert').ok(!s.includes('react-native-purchases'));require('assert').ok(!s.includes("'/subscription'"))}],
['merchant still uses entitlement checks',()=>require('assert').ok(file('apps/merchant/app/home.tsx').includes('getMerchantAccessState'))],
['email and Google preserve invited customers',()=>{const ui=file('apps/merchant/app/sign-in.tsx');const auth=file('apps/merchant/src/lib/auth.ts');const legacy=file('apps/merchant/app/phone.tsx');for(const token of ["pathname: '/invite'",'sendEmailCode','signInWithGoogle'])require('assert').ok(ui.includes(token),token);require('assert').ok(auth.includes("provider: 'google'"));require('assert').ok(legacy.includes("pathname: '/sign-in'"))}],
['merchant invites by verified email',()=>{const s=file('apps/merchant/app/add-customer.tsx');require('assert').ok(s.includes("supabase.rpc('add_customer_email'"));require('assert').ok(!s.includes('normalizeIraqiPhone'))}],
['no demo sign-in bypass',()=>{const s=file('apps/merchant/app/sign-in.tsx');require('assert').ok(!s.includes('onPreviewContinue'));require('assert').ok(s.includes('isSupabaseConfigured'))}],
['client invite returns to client',()=>require('assert').ok(file('apps/merchant/app/invite.tsx').includes("router.replace('/client/home')"))],
['invitations target consolidated app',()=>require('assert').ok(file('apps/merchant/src/lib/invitations.ts').includes('debtledger-merchant://invite'))],
['languages include role translations',()=>{for(const lang of ['ar','ckb']){const v=JSON.parse(file('packages/shared/src/locales/'+lang+'.json'));for(const k of ['chooseRole','customer','merchant','customerFree','changeRole'])require('assert').ok(v.merged[k],lang+': '+k)}}],
];
for(const [name,run] of tests){run();console.log('PASS '+name)}console.log('PASS '+tests.length+' unified static regression checks');

