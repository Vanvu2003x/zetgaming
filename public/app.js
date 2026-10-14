import { navPath } from '/navigation.js';
const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
async function api(path, body, headers = {}) {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra. Vui lòng thử lại.');
  return data;
}

const loginForm = $('#loginForm');
loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('[type=submit]');
  const message = $('#loginMsg');
  button.disabled = true;
  message.textContent = 'Đang đăng nhập…';
  try {
    await api('/api/auth/login', { email: loginForm.elements.email.value, password: loginForm.elements.password.value });
    location.assign(loginForm.elements.next.value || '/tai-khoan');
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
});
$('#passwordToggle')?.addEventListener('click', () => {
  const input = $('#password');
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  $('#passwordToggle').textContent = visible ? 'Ẩn' : 'Hiện';
  $('#passwordToggle').setAttribute('aria-label', visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
  $('#passwordToggle').setAttribute('aria-pressed', String(visible));
});

const orderForm = $('#orderForm');
const updatePackage = () => {
  const selected = orderForm?.querySelector('[name=package_id]:checked');
  if (!selected) return;
  $('#orderTotal').textContent = money(Number(selected.dataset.price));
  $('#selectedPackageName').textContent = selected.dataset.name;
};
orderForm?.addEventListener('change', updatePackage);
orderForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const selected = orderForm.querySelector('[name=package_id]:checked');
  if (!selected) return;
  const button = $('#createOrderBtn');
  const message = $('#orderMsg');
  button.disabled = true;
  message.textContent = 'Đang tạo đơn…';
  const target = $('#target');
  try {
    const result = await api('/api/orders', { package_id: selected.value, target: { [target.name]: target.value.trim() }, payment_method: $('#payment').value }, { 'idempotency-key': orderForm.elements.idempotency_key.value });
    location.assign('/lich-su/' + encodeURIComponent(result.code));
  } catch (error) {
    if (error.message === 'Vui lòng đăng nhập') {
      location.assign('/dang-nhap?next=' + encodeURIComponent(orderForm.elements.return_to.value));
    } else {
      message.textContent = error.message;
      button.disabled = false;
    }
  }
});
window.addEventListener('pageshow', () => document.querySelectorAll('form button[type=submit]').forEach(button => { button.disabled = false; }));

const catalogSearch = $('#catalogSearch');
catalogSearch?.addEventListener('input', () => {
  const query = catalogSearch.value.trim().toLocaleLowerCase('vi');
  let count = 0;
  document.querySelectorAll('[data-catalog-card]').forEach(card => {
    card.hidden = !card.dataset.search.includes(query);
    if (!card.hidden) count++;
  });
  $('#catalogCount').textContent = count;
  $('#catalogEmpty').hidden = count > 0;
});

const mobileTabs = [...document.querySelectorAll('[data-mobile-tab]')];
const mobileNav = $('.mobile-bottom-nav');
const shape = $('#mobileBottomShapePath');
let notchCenter = 177.5;
let notchAnimation;
const getNotchCenter = (tab) => {
  if (!mobileNav || !tab) return notchCenter;
  const navBox = mobileNav.getBoundingClientRect();
  if (!navBox.width) return notchCenter;
  const tabBox = tab.getBoundingClientRect();
  const center = (tabBox.left + tabBox.width / 2 - navBox.left) / navBox.width * 355;
  const edgeInset = 14 / navBox.width * 355;
  const index = mobileTabs.indexOf(tab);
  return index === 0 ? center + edgeInset : index === mobileTabs.length - 1 ? center - edgeInset : center;
};
const drawNotch = (center) => { notchCenter = center; shape?.setAttribute('d', navPath(center)); };
const moveNotch = (tab, animate = false) => {
  const target = getNotchCenter(tab);
  cancelAnimationFrame(notchAnimation);
  if (!animate || reducedMotion.matches) { drawNotch(target); return; }
  const start = notchCenter;
  const startedAt = performance.now();
  const frame = (now) => {
    const progress = Math.min(1, (now - startedAt) / 650);
    const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    drawNotch(start + (target - start) * eased);
    if (progress < 1) notchAnimation = requestAnimationFrame(frame);
  };
  notchAnimation = requestAnimationFrame(frame);
};
const activeTab = $('.mobile-bottom-link.is-active');
if (mobileNav && getComputedStyle(mobileNav).display !== 'none') {
  let previous;
  try { previous = sessionStorage.getItem('zet-nav-center'); sessionStorage.removeItem('zet-nav-center'); } catch {}
  if (previous !== null && previous !== undefined && Number(previous) > 0 && Number(previous) < 355) {
    drawNotch(Number(previous));
    moveNotch(activeTab, true);
  } else moveNotch(activeTab);
}
mobileTabs.forEach(tab => tab.addEventListener('click', (event) => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  try { sessionStorage.setItem('zet-nav-center', String(notchCenter)); } catch {}
}));
window.addEventListener('resize', () => { if (mobileNav && getComputedStyle(mobileNav).display !== 'none') moveNotch(activeTab); });

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: .06 });
  document.querySelectorAll('[data-reveal]').forEach(element => { element.classList.add('reveal-ready'); observer.observe(element); });
}
document.addEventListener('error', (event) => {
  if (event.target instanceof HTMLImageElement && !event.target.dataset.fallback) {
    event.target.dataset.fallback = 'true';
    event.target.src = '/zetgaming-fire-bg.png';
  }
}, true);
