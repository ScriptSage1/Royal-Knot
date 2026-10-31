// Developer preview bar: interface links + mock stage selector.
// Not authentication — it only switches which mock view is shown. Hidden in a
// normal presentation; enable with `?dev=1` (remembered for the tab session)
// and disable with `?dev=0`.
import { STAGES } from './progress.js';

const KEY = 'rk.devPreview';

export function isDevMode() {
  const flag = new URLSearchParams(location.search).get('dev');
  try {
    if (flag === '1') sessionStorage.setItem(KEY, '1');
    if (flag === '0') sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return flag === '1';
  }
}

export function initDevbar({ stage = null, onStage = null } = {}) {
  const bar = document.getElementById('devbar');
  if (!bar) return null;
  if (!isDevMode()) { bar.remove(); return null; }
  bar.hidden = false;
  const btn = bar.querySelector('.devbar-toggle');
  const panel = bar.querySelector('.devbar-panel');
  btn.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
  });

  const select = bar.querySelector('#dev-stage');
  if (select && onStage) {
    select.innerHTML = STAGES.map((s, i) => `<option value="${i}">${i} · ${s.label}</option>`).join('');
    if (stage != null) select.value = String(stage);
    select.addEventListener('change', () => onStage(+select.value));
  }
  return {
    setStage(i) { if (select) select.value = String(i); },
  };
}
