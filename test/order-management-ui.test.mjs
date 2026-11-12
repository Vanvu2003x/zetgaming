import test from 'node:test';
import assert from 'node:assert/strict';
import {orderManagement} from '../admin/public/order-management.mjs';
import {orderPage} from '../storefront/account-pages.mjs';

const order={code:'GPFIXTURE123',status:'cancelled',price_cents:2000000,payment_method:'wallet',paid_at:new Date().toISOString(),game_name:'Fixture',package_name:'60 crystals',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),notes:[{body:'<script>private</script>',actor:'admin@fixture.invalid',created_at:new Date().toISOString()}],events:[{action:'order.cancelled',actor:'admin@fixture.invalid',created_at:new Date().toISOString(),metadata:{reason:'<img src=x onerror=alert(1)>',from_status:'pending_admin',to_status:'cancelled'}}]};
test('admin order details stay compact without exposing the operation history',()=>{
  const html=orderManagement(order);
  assert.doesNotMatch(html,/private|<script>|<img src=x|data-order-note|Lịch sử thao tác|order-timeline/);
  assert.doesNotMatch(html,/onerror=alert/);
  assert.doesNotMatch(html,/value="refund"|value="retry"|value="resolve-issue"/);
  const pending=orderManagement({...order,status:'pending_admin'});
  assert.match(pending,/data-quick-operation="start"/);
  const processing=orderManagement({...order,status:'processing',can_complete:true});
  assert.match(processing,/data-quick-operation="complete"/);
});
test('customer order pages explain issue/refund states without exposing internal notes or offering QR again',()=>{
  for(const status of ['failed','needs_review','refund_pending','refunded','cancelled']){
    const html=orderPage({...order,status});assert.match(html,/order-cancelled-note/);assert.doesNotMatch(html,/private|admin@fixture.invalid|Quét mã để thanh toán/);
  }
});
