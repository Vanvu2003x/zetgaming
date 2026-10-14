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

function bindForms() {
  const loginForm = $('#loginForm');
  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector('[type=submit]');
    const message = $('#loginMsg');
    button.disabled = true;
    message.textContent = 'Đang đăng nhập…';
    try {
      await api('/api/auth/login', { email: loginForm.elements.email.value, password: loginForm.elements.password.value });
      await visitPage(loginForm.elements.next.value || '/tai-khoan');
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
    const total = money(Number(selected.dataset.price));
    $('#orderTotal').textContent = total;
    const submitAmount = $('#orderSubmitAmount');
    if (submitAmount) submitAmount.textContent = total;
    $('#selectedPackageName').textContent = selected.dataset.name;
  };
  orderForm?.addEventListener('change', updatePackage);
  orderForm?.querySelectorAll('[data-payment-choice]').forEach(choice => choice.addEventListener('change', () => {
    if (choice.checked) $('#payment').value = choice.dataset.paymentChoice;
  }));
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
      await visitPage('/lich-su/' + encodeURIComponent(result.code));
    } catch (error) {
      if (error.message === 'Vui lòng đăng nhập') {
        await visitPage('/dang-nhap?next=' + encodeURIComponent(orderForm.elements.return_to.value));
      } else {
        message.textContent = error.message;
        button.disabled = false;
      }
    }
  });
  const logoutForm = $('form[action="/dang-xuat"]');
  logoutForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(logoutForm.action, { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Không đăng xuất được');
      await visitPage('/');
    } catch { logoutForm.submit(); }
  });
}
bindForms();
window.addEventListener('pageshow', () => document.querySelectorAll('form button[type=submit]').forEach(button => { button.disabled = false; }));

function bindCatalogSearch() {
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
}
bindCatalogSearch();

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
let activeTab = $('.mobile-bottom-link.is-active');
const tabForPath = (path) => {
  const href = path.startsWith('/nap-game') ? '/nap-game'
    : path.startsWith('/lich-su') ? '/lich-su'
    : path.startsWith('/tin-tuc') ? '/tin-tuc'
    : path === '/tai-khoan' || path === '/dang-nhap' ? '/tai-khoan' : '/';
  return mobileTabs.find(tab => tab.getAttribute('href') === href);
};
const moveNavTo = (tab) => {
  if (!tab || tab === activeTab || !mobileNav) return;
  const visible = getComputedStyle(mobileNav).display !== 'none';
  const previousOrb = activeTab?.querySelector('.mobile-tab-icon');
  const previousBox = previousOrb?.getBoundingClientRect();
  const previousX = previousBox ? previousBox.left + previousBox.width / 2 : null;
  const from = notchCenter;
  cancelAnimationFrame(notchAnimation);
  previousOrb?.style.removeProperty('transform');
  mobileNav.classList.add('has-interacted');
  activeTab?.classList.remove('is-active');
  activeTab?.removeAttribute('aria-current');
  tab.classList.add('is-active');
  tab.setAttribute('aria-current', 'page');
  activeTab = tab;
  if (!visible) return;
  const orb = tab.querySelector('.mobile-tab-icon');
  const targetBox = orb.getBoundingClientRect();
  const distance = previousX === null ? 0 : previousX - (targetBox.left + targetBox.width / 2);
  const target = getNotchCenter(tab);
  if (reducedMotion.matches) { drawNotch(target); return; }
  const startedAt = performance.now();
  const frame = (now) => {
    const progress = Math.min(1, (now - startedAt) / 1200);
    const eased = 1 - (1 - progress) ** 4;
    drawNotch(from + (target - from) * eased);
    orb.style.transform = `translate(calc(-50% + ${distance * (1 - eased)}px), 0)`;
    if (progress < 1) notchAnimation = requestAnimationFrame(frame);
    else orb.style.removeProperty('transform');
  };
  notchAnimation = requestAnimationFrame(frame);
};
if (mobileNav && getComputedStyle(mobileNav).display !== 'none') drawNotch(getNotchCenter(activeTab));
window.addEventListener('resize', () => {
  if (!mobileNav || getComputedStyle(mobileNav).display === 'none') return;
  cancelAnimationFrame(notchAnimation);
  activeTab?.querySelector('.mobile-tab-icon')?.style.removeProperty('transform');
  drawNotch(getNotchCenter(activeTab));
});

function revealPage() {
  if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: .06 });
  document.querySelectorAll('[data-reveal]').forEach(element => { element.classList.add('reveal-ready'); observer.observe(element); });
}
revealPage();

let routeController;
let routeSequence = 0;
async function visitPage(destination, { push = true, scrollY = 0 } = {}) {
  const url = new URL(destination, location.href);
  if (url.origin !== location.origin) { location.assign('/tai-khoan'); return; }
  const sequence = ++routeSequence;
  routeController?.abort();
  routeController = new AbortController();
  $('#mainContent')?.classList.remove('route-leave');
  moveNavTo(tabForPath(url.pathname));
  try {
    const response = await fetch(url, { credentials: 'same-origin', headers: { accept: 'text/html' }, signal: routeController.signal });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Không tải được trang');
    const finalUrl = new URL(response.url);
    if (finalUrl.origin !== location.origin) throw new Error('Đường dẫn không hợp lệ');
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    const nextMain = page.querySelector('#mainContent');
    const nextHeader = page.querySelector('.site-header');
    if (!nextMain || !nextHeader) throw new Error('Trang không hợp lệ');
    if (sequence !== routeSequence) return;
    moveNavTo(tabForPath(finalUrl.pathname));

    const currentMain = $('#mainContent');
    if (!reducedMotion.matches) {
      currentMain.classList.add('route-leave');
      await new Promise(resolve => setTimeout(resolve, 150));
      if (sequence !== routeSequence) return;
    }
    if (push) {
      history.replaceState({ ...history.state, scrollY: window.scrollY }, '');
      history.pushState({ scrollY: 0 }, '', finalUrl.pathname + finalUrl.search + finalUrl.hash);
    }
    currentMain.replaceWith(nextMain);
    $('.site-header').replaceWith(nextHeader);
    document.title = page.title;
    const description = page.querySelector('meta[name=description]')?.content;
    if (description) document.querySelector('meta[name=description]').content = description;
    document.body.dataset.page = page.body.dataset.page;
    document.body.dataset.authenticated = page.body.dataset.authenticated;
    window.scrollTo({ top: scrollY, behavior: 'instant' });
    if (!reducedMotion.matches) {
      nextMain.classList.add('route-enter');
      const finishEntry = (event) => {
        if (event.target !== nextMain) return;
        nextMain.classList.remove('route-enter');
        nextMain.removeEventListener('animationend', finishEntry);
      };
      nextMain.addEventListener('animationend', finishEntry);
    }
    bindForms();
    bindCatalogSearch();
    revealPage();
  } catch (error) {
    if (sequence !== routeSequence) return;
    if (push) location.assign(url.href);
    else location.reload();
  }
}

mobileTabs.forEach(tab => tab.addEventListener('click', (event) => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  if (tab.href === location.href) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  void visitPage(tab.href);
}));
const storefrontRoute = /^\/(?:$|nap-game(?:\/[a-z0-9-]+)?\/?$|lich-su(?:\/[a-zA-Z0-9-]+)?\/?$|tin-tuc(?:\/[a-z0-9-]+)?\/?$|tai-khoan\/?$|dang-nhap\/?$)/;
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest?.('a[href]');
  if (!link || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || !storefrontRoute.test(url.pathname)) return;
  if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
  event.preventDefault();
  if (url.href === location.href) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  void visitPage(url.href);
});
document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== 'get') return;
  const url = new URL(form.action);
  if (url.origin !== location.origin || !storefrontRoute.test(url.pathname)) return;
  event.preventDefault();
  url.search = new URLSearchParams(new FormData(form)).toString();
  void visitPage(url.href);
});
history.scrollRestoration = 'manual';
window.addEventListener('popstate', (event) => {
  void visitPage(location.href, { push: false, scrollY: event.state?.scrollY || 0 });
});

document.addEventListener('error', (event) => {
  if (event.target instanceof HTMLImageElement && !event.target.dataset.fallback) {
    event.target.dataset.fallback = 'true';
    event.target.src = '/zetgaming-fire-bg.png';
  }
}, true);
