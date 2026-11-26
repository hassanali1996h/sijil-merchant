const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {mkdtempSync,writeFileSync,rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const script = path.join(__dirname,'check-merchant-package.cjs');
function run(config) {
  const dir=mkdtempSync(path.join(tmpdir(),'sijil-package-'));
  const file=path.join(dir,'app.json');
  if(config!==null) writeFileSync(file,config);
  const result=spawnSync(process.execPath,[script],{env:{...process.env,SIJIL_APP_CONFIG:file},encoding:'utf8'});
  rmSync(dir,{recursive:true,force:true});
  return result;
}
test('accepts exact merchant package',()=>assert.equal(run(JSON.stringify({expo:{android:{package:'com.debtledgeriq.sijil.merchant'}}})).status,0));
test('rejects mismatched merchant package',()=>assert.equal(run(JSON.stringify({expo:{android:{package:'com.debtledgeriq.sijil'}}})).status,1));
test('rejects absent package',()=>assert.equal(run(JSON.stringify({expo:{android:{}}})).status,1));
test('rejects missing config',()=>assert.equal(run(null).status,1));
test('rejects invalid JSON',()=>assert.equal(run('{').status,1));
