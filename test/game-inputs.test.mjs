import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGameInputs, validateGameTarget } from '../shared/game-inputs.mjs';
import { gameCheckout } from '../storefront/game-checkout.mjs';

test('game input configuration is bounded and keeps credentials minimal',()=>{
  const config=normalizeGameInputs({guide:'Tìm UID tại hồ sơ',server_required:true,server_options:['Asia','Europe'],password_required:true},'login');
  assert.equal(config.password_required,true);
  assert.throws(()=>normalizeGameInputs({password_required:true},'uid'));
  assert.throws(()=>normalizeGameInputs({server_options:Array(31).fill('x')},'uid'));
  assert.throws(()=>normalizeGameInputs({server_options:['Asia','Asia']},'uid'));
  assert.throws(()=>validateGameTarget('login',config,{uid:'123'}));
  assert.throws(()=>validateGameTarget('login',config,{login:'player',password:'secret',server:'fake'}));
  assert.deepEqual(validateGameTarget('login',config,{login:'player',password:' secret ',additional_info:'Asia server',zalo:'0900000000',server:'Asia'}),{login:'player',password:' secret ',additional_info:'Asia server',zalo:'0900000000',server:'Asia'});
  assert.throws(()=>validateGameTarget('uid',normalizeGameInputs({},'uid'),{uid:'123',password:'unneeded'}));
});
test('checkout renders configured fields and escaped help while preserving native form names',()=>{
  const html=gameCheckout({slug:'fixture',name:'Fixture',mode:'login',image:'/fixture.png',input_config:{guide:'<script>guide</script>',server_options:['Asia','Europe'],server_required:true,password_required:true,character_required:true}},[{package_id:'p',package_name:'60',customer_cents:2000000}],null,'key');
  assert.match(html,/name="server"/);assert.match(html,/name="password"/);assert.match(html,/name="character"/);assert.match(html,/&lt;script&gt;guide&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>guide/);
});
