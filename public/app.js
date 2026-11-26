import { navPath } from '/navigation.js?v=6';
import { bindAuthFit } from '/auth-fit.mjs';
import { matchesCatalog, compareGameNames } from '/catalog-model.mjs';
const $ = (selector) => document.querySelector(selector);
const money = (cents) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(cents || 0) / 100);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const hideFailedHomeImage = image => {
  if (image instanceof HTMLImageElement && image.hasAttribute('data-home-image')) image.hidden = true;
};
document.addEventListener('error', event => hideFailedHomeImage(event.target), true);
function bindHomeImageFallbacks() {
  document.querySelectorAll('img[data-home-image]').forEach(image => {
    if (image.complete && image.naturalWidth === 0) hideFailedHomeImage(image);
  });
}
async function api(path, body, headers = {}) {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra. Vui lòng thử lại.');
  return data;
}

let releaseAuthFit = () => {};
function bindForms() {
  releaseAuthFit();
  releaseAuthFit = bindAuthFit();
  document.querySelectorAll('[data-payment-refresh]').forEach(button => button.addEventListener('click', () => location.reload()));
  document.querySelectorAll('[data-copy-payment]').forEach(button => button.addEventListener('click', async () => {
    const message = document.querySelector('.transfer-feedback') || document.querySelector('.order-feedback');
    try {
      await navigator.clipboard.writeText(button.dataset.copyPayment);
      if (message) message.textContent = 'Đã sao chép.';
    } catch {
      if (message) message.textContent = 'Chưa sao chép được. Bạn có thể chọn và sao chép thông tin bên trên.';
    }
  }));
  document.querySelector('[data-open-guide]')?.addEventListener('click', event => {
    const guide = $('#uidGuide');
    if (!guide) return;
    event.preventDefault();
    if (guide instanceof HTMLDetailsElement) guide.open = true;
    guide.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'center' });
    guide.querySelector('summary')?.focus({ preventScroll: true });
  });
  document.querySelectorAll('a.google-signin').forEach(link => {
    link.addEventListener('click', event => {
      const consent = link.closest('form')?.elements.namedItem('terms');
      if (consent && !consent.checked) {
        event.preventDefault();
        consent.focus();
        consent.reportValidity();
      }
    });
  });
  const loginForm = $('#loginForm');
  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector('[type=submit]');
    const message = $('#loginMsg');
    button.disabled = true;
    message.textContent = 'Đang đăng nhập…';
    try {
      await api('/api/auth/login', { email: loginForm.elements.email.value, password: loginForm.elements.password.value, remember: loginForm.elements.remember.checked });
      await visitPage(loginForm.elements.next.value || '/tai-khoan');
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });
  const togglePassword = (button, input) => {
    if (!input) return;
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Ẩn' : 'Hiện';
    button.setAttribute('aria-label', visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    button.setAttribute('aria-pressed', String(visible));
  };
  $('#passwordToggle')?.addEventListener('click', (event) => togglePassword(event.currentTarget, $('#password')));
  document.querySelectorAll('[data-password-toggle]').forEach(button => button.addEventListener('click', () => togglePassword(button, document.getElementById(button.dataset.passwordToggle))));

  const registerForm = $('#registerForm');
  registerForm?.addEventListener('submit', (event) => {
    const password = registerForm.elements.password;
    const confirmation = registerForm.elements.password_confirm;
    const message = registerForm.querySelector('[role=alert]');
    if (password.value !== confirmation.value) {
      event.preventDefault();
      message.textContent = 'Mật khẩu nhập lại không khớp.';
      confirmation.focus();
    }
  });

  const orderForm = $('#orderForm');
  const savedInputTarget = () => {
    const target = {};
    for (const name of ['uid', 'login', 'password', 'additional_info', 'zalo', 'note', 'server', 'region', 'character']) {
      const field = orderForm?.elements.namedItem(name);
      if (field?.value) target[name] = field.value;
    }
    const custom = {};
    orderForm?.querySelectorAll('[name^="custom_"]').forEach(field => { custom[field.name.slice(7)] = field.value; });
    if (Object.keys(custom).length) target.custom = custom;
    return target;
  };
  const fillSavedInput = target => {
    for (const [name, value] of Object.entries(target || {})) {
      if (name === 'custom') continue;
      const field = orderForm?.elements.namedItem(name);
      if (field) { field.value = value || ''; field.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    for (const [index, value] of Object.entries(target?.custom || {})) {
      const field = orderForm?.elements.namedItem(`custom_${index}`);
      if (field) field.value = value || '';
    }
    $('#target')?.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const savedSlug = orderForm?.dataset.gameSlug;
  $('#saveInput')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    if (!orderForm.reportValidity()) return;
    button.disabled = true;
    try { await api(`/api/saved-inputs/${encodeURIComponent(savedSlug)}`, { target: savedInputTarget() }); button.textContent = 'Đã lưu'; setTimeout(() => { button.textContent = 'Lưu thông tin'; button.disabled = false; }, 1800); }
    catch (error) { button.disabled = false; window.alert(error.message); }
  });
  $('#useSavedInput')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try { const response = await fetch(`/api/saved-inputs/${encodeURIComponent(savedSlug)}`, { credentials: 'same-origin' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Chưa có thông tin được lưu.'); fillSavedInput(data.target); button.textContent = 'Đã điền thông tin'; setTimeout(() => { button.textContent = 'Dùng thông tin đã lưu'; button.disabled = false; }, 1800); }
    catch (error) { button.disabled = false; window.alert(error.message); }
  });
  if (orderForm && !orderForm.querySelector('[name="coupon_code"]')) {
    const orderPanel = orderForm.querySelector('.order-submit-panel');
    if (orderPanel) {
      const coupon = document.createElement('div');
      coupon.className = 'checkout-coupon-field';
      coupon.innerHTML = '<label for="couponCode">Mã coupon hoàn tiền <span>(nếu có)</span></label><div><input id="couponCode" name="coupon_code" maxlength="80" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Nhập mã coupon"><small data-coupon-message>Coupon chỉ dùng một lần.</small></div><p class="coupon-warning" data-coupon-warning role="status" aria-live="polite"></p>';
      const total = orderPanel.querySelector('.order-total');
      orderPanel.insertBefore(coupon, total || orderPanel.querySelector('#createOrderBtn'));
    }
  }
  const couponInput = $('#couponCode');
  const couponMessage = document.querySelector('[data-coupon-message]');
  const couponWarning = document.querySelector('[data-coupon-warning]');
  let couponRequest;
  const refreshCouponWarning = (couponCents = Number(couponInput?.dataset.amountCents || 0)) => {
    const selected = orderForm?.querySelector('[name=package_id]:checked');
    const grossCents = Number(selected?.dataset.price || 0);
    if (!couponWarning || !couponCents || !grossCents) return;
    const unusedCents = Math.max(0, couponCents - grossCents);
    couponWarning.textContent = unusedCents > 0
      ? `Coupon trị giá ${money(couponCents)} lớn hơn đơn ${money(grossCents)}. Nếu sử dụng, phần dư ${money(unusedCents)} sẽ không được hoàn lại.`
      : `Coupon sẽ trừ ${money(couponCents)} vào đơn này.`;
    couponWarning.classList.toggle('is-over', unusedCents > 0);
    couponWarning.hidden = false;
  };
  couponInput?.addEventListener('input', () => {
    couponInput.value = couponInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    delete couponInput.dataset.amountCents;
    if (couponWarning) { couponWarning.hidden = true; couponWarning.textContent = ''; }
    if (couponMessage) couponMessage.textContent = 'Đang kiểm tra mã…';
    couponRequest?.abort();
    const code = couponInput.value.trim();
    if (!code) { if (couponMessage) couponMessage.textContent = 'Coupon chỉ dùng một lần.'; return; }
    couponRequest = new AbortController();
    fetch(`/api/coupons/preview?code=${encodeURIComponent(code)}`, { credentials: 'same-origin', signal: couponRequest.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Mã coupon không hợp lệ'); return data; })
      .then(data => { couponInput.dataset.amountCents = String(data.amount_cents); if (couponMessage) couponMessage.textContent = 'Mã coupon hợp lệ.'; refreshCouponWarning(data.amount_cents); })
      .catch(error => { if (error.name === 'AbortError') return; if (couponMessage) couponMessage.textContent = error.message; if (couponWarning) { couponWarning.hidden = false; couponWarning.classList.add('is-error'); couponWarning.textContent = error.message; } });
  });
  const updatePackage = () => {
    const selected = orderForm?.querySelector('[name=package_id]:checked');
    if (!selected) return;
    const total = money(Number(selected.dataset.price));
    $('#orderTotal').textContent = total;
    const submitAmount = $('#orderSubmitAmount');
    if (submitAmount) submitAmount.textContent = total;
    $('#selectedPackageName').textContent = selected.dataset.name;
  };
  const targetInput = $('#target');
  const targetValue = $('#orderTargetValue');
  targetInput?.addEventListener('input', () => { if (targetValue) targetValue.textContent = targetInput.value.trim() || 'Chưa nhập'; });
  orderForm?.addEventListener('change', () => { updatePackage(); refreshCouponWarning(); });
  orderForm?.querySelectorAll('[data-payment-choice]').forEach(choice => choice.addEventListener('change', () => {
    if (choice.checked) $('#payment').value = choice.dataset.paymentChoice;
  }));
  // Checkout uses the native POST/303 flow so the receipt gets a fresh document.
  const logoutForm = $('form[action="/dang-xuat"]');
  logoutForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(logoutForm.action, { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '' } });
      if (!response.ok) throw new Error('Không đăng xuất được');
      await visitPage('/da-dang-xuat');
    } catch { logoutForm.submit(); }
  });

  document.querySelectorAll('.account-page a[href="/nap-so-du"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const existing = document.querySelector('#walletTopupDialog');
    if (existing) { existing.showModal?.(); existing.querySelector('input[name="amount_vnd"]')?.focus(); return; }
    const dialog = document.createElement('dialog');
    dialog.id = 'walletTopupDialog';
    dialog.className = 'wallet-topup-dialog';
    dialog.innerHTML = `<div class="wallet-dialog-glow" aria-hidden="true"></div><button class="wallet-dialog-close" type="button" aria-label="Đóng">×</button><div class="wallet-dialog-kicker">ZETGAMING WALLET</div><h2>Nạp tiền vào tài khoản</h2><p class="wallet-dialog-lead">Chọn số tiền và thanh toán qua VietQR trong vài giây.</p><form action="/nap-so-du" method="post"><input type="hidden" name="_csrf" value="${document.querySelector('meta[name="csrf-token"]')?.content || ''}"><div class="wallet-presets" role="group" aria-label="Số tiền gợi ý"><button type="button" data-wallet-amount="50000">50.000đ</button><button type="button" data-wallet-amount="100000">100.000đ</button><button type="button" data-wallet-amount="200000">200.000đ</button><button type="button" data-wallet-amount="500000">500.000đ</button></div><label for="walletDialogAmount">Số tiền muốn nạp</label><div class="wallet-amount-input"><input id="walletDialogAmount" name="amount_vnd" type="number" min="10000" max="50000000" step="1000" placeholder="Nhập số tiền" required><span>VNĐ</span></div><div class="wallet-dialog-total"><span>Bạn sẽ thanh toán</span><strong data-wallet-total>0đ</strong></div><input type="hidden" name="idempotency_key" value="wallet-${Date.now()}-${Math.random().toString(36).slice(2)}"><button class="action-button wide wallet-dialog-submit" type="submit">Tạo mã QR thanh toán <span aria-hidden="true">↗</span></button></form><small class="wallet-dialog-note">Hệ thống sẽ giữ nguyên số tiền và nội dung chuyển khoản để đối soát tự động.</small></div>`;
    document.body.append(dialog);
    const form = dialog.querySelector('form');
    const input = dialog.querySelector('input[name="amount_vnd"]');
    const total = dialog.querySelector('[data-wallet-total]');
    const update = value => { const amount = Number(value || 0); total.textContent = amount ? new Intl.NumberFormat('vi-VN').format(amount) + 'đ' : '0đ'; dialog.querySelectorAll('[data-wallet-amount]').forEach(button => button.classList.toggle('is-selected', Number(button.dataset.walletAmount) === amount)); };
    input.addEventListener('input', () => update(input.value));
    dialog.querySelectorAll('[data-wallet-amount]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.walletAmount; update(input.value); input.focus(); }));
    dialog.querySelector('.wallet-dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.showModal();
    input.focus();
  }));
}
bindForms();
window.addEventListener('pageshow', () => document.querySelectorAll('form button[type=submit]').forEach(button => { button.disabled = false; }));

function bindCatalogSearch() {
  const catalogSearch = $('#catalogSearch');
  const filters = [...document.querySelectorAll('[data-category-filter]')];
  const grid = $('.directory-grid');
  if (!catalogSearch || !grid) return;
  const sort = $('#catalogSort');
  let activeCategory = new URL(location.href).searchParams.get('category') || '';
  const updateCatalog = () => {
    const query = catalogSearch.value.trim();
    let count = 0;
    const cards = [...grid.querySelectorAll('[data-catalog-card]')];
    cards.sort((a,b) => compareGameNames({name:a.dataset.name}, {name:b.dataset.name}, sort.value)).forEach(card => {
      card.hidden = !matchesCatalog({name:card.dataset.name,category_id:card.dataset.category}, query, activeCategory);
      if (!card.hidden) count++;
      grid.append(card);
    });
    $('#catalogCount').textContent = count;
    $('#catalogEmpty').hidden = count > 0;
    const url = new URL(location.href);
    for (const [key,value] of [['q',query],['category',activeCategory],['sort',sort.value === 'a-z' ? '' : sort.value]]) {
      if (value) url.searchParams.set(key,value); else url.searchParams.delete(key);
    }
    history.replaceState(history.state, '', url);
    catalogSearch.form.elements.category.value = activeCategory;
    filters.forEach(filter => {
      const active = filter.dataset.categoryFilter === activeCategory;
      filter.classList.toggle('is-active', active);
      if (active) filter.setAttribute('aria-current','true'); else filter.removeAttribute('aria-current');
      const destination = new URL(url);
      if (filter.dataset.categoryFilter) destination.searchParams.set('category',filter.dataset.categoryFilter); else destination.searchParams.delete('category');
      filter.href = destination.pathname + destination.search;
    });
  };
  catalogSearch.addEventListener('input', updateCatalog);
  sort.addEventListener('change', updateCatalog);
  filters.forEach(filter => filter.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    activeCategory = filter.dataset.categoryFilter;
    updateCatalog();
  }));
  updateCatalog();
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
    : ['/tai-khoan', '/dang-nhap', '/dang-ky', '/quen-mat-khau', '/dat-lai-mat-khau'].includes(path) ? '/tai-khoan' : '/';
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
function syncMobileNav() {
  if (!mobileNav || getComputedStyle(mobileNav).display === 'none') return;
  cancelAnimationFrame(notchAnimation);
  activeTab = tabForPath(location.pathname);
  mobileTabs.forEach(tab => {
    tab.classList.toggle('is-active', tab === activeTab);
    if (tab === activeTab) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
    tab.querySelector('.mobile-tab-icon')?.style.removeProperty('transform');
  });
  drawNotch(getNotchCenter(activeTab));
}
syncMobileNav();
window.addEventListener('resize', syncMobileNav);
window.addEventListener('pageshow', syncMobileNav);
if (mobileNav && 'ResizeObserver' in window) {
  new ResizeObserver(syncMobileNav).observe(mobileNav);
}

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
    const response = await fetch(url, { credentials: 'same-origin', headers: { accept: 'text/html' }, signal: AbortSignal.any([routeController.signal, AbortSignal.timeout(12000)]) });
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
    document.querySelector('meta[name="csrf-token"]').content = page.querySelector('meta[name="csrf-token"]')?.content || '';
    document.body.dataset.page = page.body.dataset.page;
    document.body.dataset.authenticated = page.body.dataset.authenticated;
    // Auth hides the persistent nav. Re-measure after the destination reveals it.
    syncMobileNav();
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
    bindHomeImageFallbacks();
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
const storefrontRoute = /^\/(?:$|nap-game(?:\/[a-z0-9-]+)?\/?$|lich-su(?:\/[a-zA-Z0-9-]+)?\/?$|tin-tuc(?:\/[a-z0-9-]+)?\/?$|tai-khoan\/?$|dang-nhap\/?$|dang-ky\/?$|quen-mat-khau\/?$|dat-lai-mat-khau\/?$)/;
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest?.('a[href]');
  if (!link || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || !storefrontRoute.test(url.pathname)) return;
  if (/^\/lich-su\/[a-zA-Z0-9-]+$/.test(url.pathname)) return;
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
  if (event.target instanceof HTMLImageElement && !event.target.hasAttribute('data-home-image') && !event.target.dataset.fallback) {
    event.target.dataset.fallback = 'true';
    event.target.src = '/zetgaming-fire-bg.png';
  }
}, true);
bindHomeImageFallbacks();
