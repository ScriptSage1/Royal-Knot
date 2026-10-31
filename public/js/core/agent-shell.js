// Agent shell: on narrow screens the sidebar becomes a slide-in menu with a
// backdrop, Escape to close, and `inert` while hidden so keyboard focus never
// lands on off-screen links.
const MOBILE = window.matchMedia('(max-width: 979px)');

export function initAgentShell() {
  const side = document.getElementById('ag-sidebar');
  const openBtn = document.querySelector('.ag-menu-btn');
  const closeBtn = side?.querySelector('.ag-close-btn');
  const backdrop = document.querySelector('.ag-backdrop');
  if (!side || !openBtn) return;

  const setOpen = (open, { focus = true } = {}) => {
    document.body.classList.toggle('ag-nav-open', open);
    openBtn.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
    side.inert = MOBILE.matches && !open;
    if (focus) (open ? side.querySelector('.ag-nav-sub [aria-current]') || side.querySelector('.ag-nav [aria-current]') || side.querySelector('a') : openBtn)?.focus();
  };
  const sync = () => { document.body.classList.remove('ag-nav-open'); backdrop.hidden = true; side.inert = MOBILE.matches; openBtn.setAttribute('aria-expanded', 'false'); };

  openBtn.addEventListener('click', () => setOpen(true));
  closeBtn?.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  side.addEventListener('click', (e) => { if (MOBILE.matches && e.target.closest('a')) setOpen(false, { focus: false }); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('ag-nav-open')) setOpen(false); });
  MOBILE.addEventListener('change', sync);
  sync();
}
