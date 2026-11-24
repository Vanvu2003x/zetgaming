// Fit the entire auth card without turning the card into a scroll container.
export function bindAuthFit() {
  const form = document.querySelector('.auth-container .auth-form');
  if (!form) return () => {};

  const frame = document.createElement('div');
  frame.className = 'auth-fit-frame';
  form.before(frame);
  frame.append(form);
  let request;
  const fit = () => {
    cancelAnimationFrame(request);
    request = requestAnimationFrame(() => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--auth-viewport-height', `${height}px`);
      document.body.toggleAttribute('data-auth-short', height < 480);
      const available = Math.max(0, frame.clientHeight - 4);
      const natural = Math.max(form.offsetHeight, form.scrollHeight);
      form.style.setProperty('--auth-fit', String(natural ? Math.min(1, available / natural) : 1));
    });
  };
  const observer = new ResizeObserver(fit);
  observer.observe(frame);
  observer.observe(form);
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
  document.fonts?.ready.then(() => { if (frame.isConnected) fit(); });
  fit();

  return () => {
    cancelAnimationFrame(request);
    observer.disconnect();
    window.removeEventListener('resize', fit);
    window.visualViewport?.removeEventListener('resize', fit);
    document.documentElement.style.removeProperty('--auth-viewport-height');
    document.body.removeAttribute('data-auth-short');
  };
}
