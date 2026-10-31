// Erklärungen hinter dem (i) auf der ganzen Kontoseite (Profil, Sicherheit):
// Statt Sätzen unter jedem Feld steht ein kleines (i); sein Text liegt
// verborgen im Markup (<p class="pfx-tiptext" id="…" hidden>) und erscheint
// in einer einzigen Blase beim Drüberfahren, beim Fokus oder beim Antippen.
//
//   <button type="button" class="pfx-i" data-tip="meinTipp" aria-label="Mehr">i</button>
//   <p class="pfx-tiptext" id="meinTipp" hidden>Erklärung …</p>

const bubble = document.createElement('div');
bubble.className = 'pfx-bubble';
bubble.setAttribute('role', 'tooltip');
bubble.hidden = true;
document.body.appendChild(bubble);

let tipFor: HTMLElement | null = null;
const hideTip = () => { bubble.hidden = true; tipFor = null; };
const showTip = (btn: HTMLElement) => {
  const src = btn.dataset.tip ? document.getElementById(btn.dataset.tip) : null;
  if (!src) return;
  tipFor = btn;
  bubble.textContent = src.textContent || '';
  bubble.hidden = false;
  const r = btn.getBoundingClientRect();
  const w = bubble.offsetWidth, h = bubble.offsetHeight;
  const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
  const below = r.bottom + 8 + h < innerHeight;
  bubble.style.left = left + 'px';
  bubble.style.top = (below ? r.bottom + 8 : r.top - h - 8) + 'px';
};

document.querySelectorAll<HTMLElement>('.pfx-i[data-tip]').forEach((btn) => {
  btn.addEventListener('mouseenter', () => showTip(btn));
  btn.addEventListener('mouseleave', hideTip);
  btn.addEventListener('focus', () => showTip(btn));
  btn.addEventListener('blur', hideTip);
  // Antippen (Handy): zeigen bzw. wieder schließen; im <label> nicht das Feld umschalten
  btn.addEventListener('click', (e) => { e.preventDefault(); if (tipFor === btn && !bubble.hidden) hideTip(); else showTip(btn); });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
document.addEventListener('scroll', hideTip, true);
