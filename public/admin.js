const meta = document.querySelector('meta[name="admin-csrf"]');
const csrf = meta?.content || document.querySelector('meta[name="csrf-token"]')?.content || '';
const save = async card => {
  const fields = Object.fromEntries([...card.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.type === 'checkbox' ? input.checked : input.value]));
  const status = card.querySelector('[data-save-status]');
  status.textContent = 'Đang lưu...';
  const response = await fetch(`/api/admin/packages/${card.dataset.packageId}`, { method:'PATCH', headers:{'Content-Type':'application/json','X-CSRF-Token':csrf}, body:JSON.stringify(fields) });
  const result = await response.json().catch(() => ({}));
  status.textContent = response.ok ? 'Đã lưu' : (result.error || 'Không thể lưu');
  status.dataset.state = response.ok ? 'ok' : 'error';
};
document.querySelectorAll('[data-save-package]').forEach(button => button.addEventListener('click', () => save(button.closest('[data-package-id]'))));
document.querySelectorAll('[data-field="image"]').forEach(input => input.addEventListener('input', () => { const image = input.closest('[data-package-id]').querySelector('.admin-package-preview img'); if (input.value.trim()) image.src = input.value.trim(); }));
