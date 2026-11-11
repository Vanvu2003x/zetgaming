import {escapeHtml as e,money,date,statuses} from './data.mjs';

const actionNames={
  'order.created':'Tạo đơn','order.payment_confirmed':'Xác nhận nhận tiền','order.credentials_viewed':'Xem thông tin nạp',
  'order.admin_started':'Admin nhận xử lý','order.admin_completed':'Admin hoàn thành đơn','order.note_added':'Thêm ghi chú nội bộ',
  'order.issue_reported':'Báo lỗi đơn','order.issue_resolved':'Xác nhận kết quả đối soát','order.retry_requested':'Cho phép xử lý lại',
  'order.cancelled':'Hủy đơn','order.refund_requested':'Lập yêu cầu hoàn tiền','order.refund_paid':'Xác nhận hoàn tiền',
  'order.late_payment_recorded':'Ghi nhận tiền vào sau hủy','order.approved':'Phân đơn (luồng cũ)','order.claimed':'Nhận đơn (luồng cũ)',
  'order.completed':'Báo hoàn thành (luồng cũ)','order.settled':'Quyết toán (luồng cũ)',
};
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
  if (order.status === 'awaiting_payment') return '<section class="order-management quick-order-actions"><h3>Thao tác</h3><button type="button" class="button danger" data-direct-operation="cancel">Hủy đơn</button></section>';
  const items=available(order);
  const refund=order.refund ? `<div class="detail-note"><strong>${order.refund.state==='paid'?'Đã hoàn tiền':'Chờ hoàn chuyển khoản'} · ${money(order.refund.amount_cents)}</strong><p>${order.refund.method==='wallet'?'Hoàn vào ví ZetGaming':'Hoàn qua ngân hàng'}${order.refund.reference?' · Mã giao dịch: '+e(order.refund.reference):''}</p></div>`:'';
  const controls=items.length ? `<details class="order-management"><summary>Xử lý đơn</summary><label>Thao tác<select data-order-operation>${items.map(key=>`<option value="${key}">${operations[key][0]}</option>`).join('')}</select></label><p class="detail-note" data-operation-help></p><label data-outcome-field>Kết quả kiểm tra<select data-operation-outcome></select></label><label data-reason-field>Lý do<textarea data-operation-reason rows="3" maxlength="1000" placeholder="Ghi rõ lý do và kết quả kiểm tra; không nhập mật khẩu hoặc OTP."></textarea></label><label data-reference-field>Mã giao dịch ngân hàng<input data-operation-reference maxlength="120" autocomplete="off" placeholder="Mã giao dịch thực tế từ ngân hàng"></label><button type="button" class="button primary" data-operation-submit>Thực hiện</button></details>`:'';
  const notes=`<details class="order-management"><summary>Ghi chú nội bộ <span class="muted">· ${order.notes.length} ghi chú</span></summary><p class="muted">Không ghi mật khẩu, OTP hoặc thông tin ngân hàng nhạy cảm.</p><label class="sr-only" for="orderNote">Nội dung ghi chú</label><textarea id="orderNote" data-order-note rows="3" maxlength="2000" placeholder="Nhập ghi chú…"></textarea><button type="button" class="button" data-note-submit>Thêm ghi chú</button><div class="order-notes">${order.notes.length?order.notes.map(note=>`<article><p>${e(note.body)}</p><small>${e(note.actor)} · ${date(note.created_at)}</small></article>`).join(''):'<p class="muted">Chưa có ghi chú.</p>'}</div></details>`;
  const history=`<details class="order-management"><summary>Lịch sử thao tác <span class="muted">· ${order.events.length} gần nhất</span></summary><ol class="order-timeline">${order.events.map(event=>`<li><strong>${e(actionNames[event.action]||event.action)}</strong><small>${e(event.actor)} · ${date(event.created_at)}</small>${event.metadata?.reason?`<p>${e(event.metadata.reason)}</p>`:''}${event.metadata?.from_status && event.metadata?.to_status?`<p>${e(statuses[event.metadata.from_status]||event.metadata.from_status)} → ${e(statuses[event.metadata.to_status]||event.metadata.to_status)}</p>`:''}${event.metadata?.amount_cents?`<p>${money(event.metadata.amount_cents)}</p>`:''}${event.metadata?.reference?`<p>Mã giao dịch: ${e(event.metadata.reference)}</p>`:''}</li>`).join('')}</ol></details>`;
  return refund+controls+notes+history;
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
  target.querySelector('[data-note-submit]')?.addEventListener('click',()=>save('notes',{body:target.querySelector('[data-order-note]').value.trim()}));
  target.querySelector('[data-operation-submit]')?.addEventListener('click',()=>{
    const action=operation.value;let body={confirmed:true};
    if(action!=='confirm-refund')body.reason=target.querySelector('[data-operation-reason]').value.trim();
    if(['report-issue','resolve-issue'].includes(action))body.outcome=target.querySelector('[data-operation-outcome]').value;
    if(['confirm-refund','record-late-payment'].includes(action))body.reference=target.querySelector('[data-operation-reference]').value.trim();
    void save(action,body);
  });
}
