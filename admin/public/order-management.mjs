import {escapeHtml as e,money} from './data.mjs';
const operations={
  'report-issue':['Báo lỗi / cần kiểm tra','Nếu chưa rõ kết quả, chọn “Chưa rõ” để giữ đơn, tránh nạp hoặc hoàn tiền trùng.'],
  'resolve-issue':['Xác nhận kết quả đối soát','Chỉ kết luận sau khi kiểm tra thực tế với game hoặc bên cung cấp.'],
  retry:['Đưa về chờ xử lý','Chỉ dùng khi đã xác nhận chưa giao vật phẩm. Không trừ tiền khách lần nữa.'],
  cancel:['Hủy đơn','Chỉ hủy khi chưa nạp. Hủy đơn đã trả tiền không tự hoàn; tiếp tục bước hoàn tiền sau khi hủy.'],
  refund:['Hoàn toàn bộ tiền',''],
  'confirm-refund':['Xác nhận đã hoàn chuyển khoản','Bạn cần tự chuyển tiền cho khách trước, rồi nhập mã giao dịch ngân hàng. Web chỉ ghi nhận, không tự chuyển tiền.'],
  'record-late-payment':['Ghi nhận tiền vào sau hủy','Đối chiếu tiền đã vào ngân hàng cho mã đơn đã hủy. Sau khi ghi nhận, có thể lập hoàn tiền.'],
};
function available(order){
  const items=[];
  if(order.status==='pending_admin' || (order.status==='processing' && order.can_complete))items.push('report-issue');
  if(order.can_resolve)items.push('resolve-issue');
  if(order.status==='failed')items.push('retry');
  if(['awaiting_payment','pending_admin','failed'].includes(order.status))items.push('cancel');
  if(order.status==='cancelled' && order.paid_at && !order.refund)items.push('refund');
  if(order.status==='cancelled' && !order.paid_at && order.payment_method==='direct')items.push('record-late-payment');
  if(order.status==='refund_pending')items.push('confirm-refund');
  return items;
}
export function orderManagement(order){
  if (order.status === 'awaiting_payment') return '<section class="order-management quick-order-actions"><h3>Thao tác nhanh</h3><button type="button" class="button danger" data-direct-operation="cancel">Hủy đơn</button></section>';
  const items=available(order);
  const refund=order.refund ? `<div class="detail-note"><strong>${order.refund.state==='paid'?'Đã hoàn tiền':'Chờ hoàn chuyển khoản'} · ${money(order.refund.amount_cents)}</strong><p>${order.refund.method==='wallet'?'Hoàn vào ví ZetGaming':'Hoàn qua ngân hàng'}${order.refund.reference?' · Mã giao dịch: '+e(order.refund.reference):''}</p></div>`:'';
  const quick=[];
  if(order.status==='pending_admin')quick.push(['start','Nhận đơn']);
  if(order.status==='processing' && order.can_complete)quick.push(['complete','Hoàn thành đơn']);
  if(['pending_admin','failed'].includes(order.status))quick.push(['cancel','Hủy đơn']);
  const quickHtml=quick.length?`<section class="order-management quick-order-actions"><h3>Thao tác nhanh</h3><div>${quick.map(([key,label])=>`<button type="button" class="button ${key==='cancel'?'danger':'primary'}" data-quick-operation="${key}">${label}</button>`).join('')}</div></section>`:'';
  return refund+quickHtml;
}

export function bindOrderManagement(target,order,context,reopen,showError){
  const operation=target.querySelector('[data-order-operation]');
  function configure(){
    const action=operation?.value;if(!action)return;
    const field=name=>target.querySelector(`[data-${name}-field]`);
    field('outcome').hidden=!['report-issue','resolve-issue'].includes(action);
    const outcome=target.querySelector('[data-operation-outcome]');
    outcome.innerHTML=action==='resolve-issue'?'<option value="not_delivered">Đã xác nhận chưa giao vật phẩm</option><option value="delivered">Đã giao thành công</option>':`${order.status==='processing'?'<option value="unknown">Chưa rõ kết quả — cần kiểm tra</option>':''}<option value="not_delivered">Đã xác nhận chưa giao vật phẩm</option>`;
    field('reference').hidden=!['confirm-refund','record-late-payment'].includes(action);field('reason').hidden=action==='confirm-refund';
    target.querySelector('[data-operation-help]').textContent=action==='refund'?(order.payment_method==='wallet'?`Hoàn toàn bộ ${money(order.price_cents)} vào ví khách ngay khi xác nhận, chỉ thực hiện một lần.`:`Lập yêu cầu hoàn toàn bộ ${money(order.price_cents)}. Bước này chưa xác nhận tiền đã chuyển cho khách.`):operations[action][1];
    target.querySelector('[data-operation-submit]').textContent=operations[action][0];
  }
  operation?.addEventListener('change',configure);configure();
  async function save(action,body){
    if(target.dataset.saving==='true' || target.querySelector('form')?.dataset.saving==='true')return;
    target.dataset.saving='true';const prevent=event=>event.preventDefault();target.addEventListener('cancel',prevent);
    const buttons=[...target.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
    try{
      await context.api(`/api/admin/orders/${encodeURIComponent(order.code)}/${action}`,body,'POST');
      await context.refresh();target.dataset.saving='false';target.close();context.toast(action==='notes'?'Đã thêm ghi chú.':'Đã cập nhật đơn hàng.');await reopen(order.code,context);
    }catch(error){showError(error);}
    finally{target.dataset.saving='false';target.removeEventListener('cancel',prevent);buttons.forEach(b=>b.disabled=false);}
  }
  target.querySelector('[data-direct-operation="cancel"]')?.addEventListener('click',()=>save('cancel',{reason:'Admin hủy đơn khi chưa xác nhận thanh toán.',confirmed:true}));
  target.querySelectorAll('[data-quick-operation]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.quickOperation;
    const reason = action === 'cancel' ? 'Admin hủy đơn chưa nạp.' : '';
    void save(action, { confirmed: true, ...(reason ? { reason } : {}) });
  }));
  target.querySelector('[data-note-submit]')?.addEventListener('click',()=>save('notes',{body:target.querySelector('[data-order-note]').value.trim()}));
  target.querySelector('[data-operation-submit]')?.addEventListener('click',()=>{
    const action=operation.value;let body={confirmed:true};
    if(action!=='confirm-refund')body.reason=target.querySelector('[data-operation-reason]').value.trim();
    if(['report-issue','resolve-issue'].includes(action))body.outcome=target.querySelector('[data-operation-outcome]').value;
    if(['confirm-refund','record-late-payment'].includes(action))body.reference=target.querySelector('[data-operation-reference]').value.trim();
    void save(action,body);
  });
}
