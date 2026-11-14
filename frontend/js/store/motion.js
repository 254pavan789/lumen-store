/**
 * Motion helpers. Everything checks prefers-reduced-motion and only animates
 * transform / opacity.
 */
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => mq.matches;

const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

export function bump(el) {
  if (!el || reducedMotion()) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function visibleCartTarget() {
  const candidates = [document.querySelector('.tabbar [data-tab="cart"]'), document.getElementById('cart-btn')];
  return candidates.find((el) => el && el.offsetParent !== null && el.getBoundingClientRect().width > 0);
}

/**
 * Product image "flies" into the cart. X and Y use different easings so the
 * path arcs like a thrown object instead of sliding in a straight line.
 */
export function flyToCart(sourceEl) {
  const target = visibleCartTarget();
  if (!sourceEl || !target) return Promise.resolve();
  if (reducedMotion()) {
    bump(target);
    return Promise.resolve();
  }
  const from = sourceEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = Math.min(from.width, 160);

  const outer = document.createElement('div');
  outer.className = 'fly';
  outer.style.cssText = `left:${from.left + (from.width - size) / 2}px;top:${from.top + (from.height - size) / 2}px;width:${size}px;height:${size}px;border-radius:24px;overflow:visible;box-shadow:none;background:none`;
  const inner = document.createElement('div');
  inner.style.cssText = `width:100%;height:100%;border-radius:24px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,.25)`;
  const art = sourceEl.querySelector('svg.art');
  inner.innerHTML = art ? art.outerHTML : '';
  outer.appendChild(inner);
  document.body.appendChild(outer);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const duration = 680;

  const x = outer.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration, easing: EASE_IN_OUT, fill: 'forwards' });
  inner.animate(
    [
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: `translateY(${Math.min(dy, 0) - 60}px) scale(0.62)`, opacity: 1, offset: 0.35 },
      { transform: `translateY(${dy}px) scale(0.12)`, opacity: 0.4 },
    ],
    { duration, easing: EASE_OUT, fill: 'forwards' }
  );
  return x.finished
    .catch(() => {})
    .then(() => {
      outer.remove();
      bump(target);
    });
}

/** Animate a number from its current text value to `to`. */
export function countUp(el, to, format = (n) => String(Math.round(n)), duration = 650) {
  if (!el) return;
  const from = Number(el.dataset.value || 0);
  el.dataset.value = to;
  if (reducedMotion() || from === to) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** One celebratory confetti burst (order placed). */
export function confetti() {
  if (reducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#4f46e5', '#7c3aed', '#c026d3', '#0ea5e9', '#22c55e', '#f59e0b', '#f43f5e'];
  const pieces = Array.from({ length: 150 }, (_, i) => {
    const fromLeft = i % 2 === 0;
    return {
      x: fromLeft ? -10 : innerWidth + 10,
      y: innerHeight * (0.55 + Math.random() * 0.25),
      vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 9),
      vy: -(10 + Math.random() * 10),
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: colors[i % colors.length],
    };
  });
  const start = performance.now();
  const frame = (now) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    pieces.forEach((p) => {
      p.vy += 0.38;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 2600);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2);
      ctx.restore();
    });
    if (elapsed < 2600) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** Stagger children in once (first paint of a grid). Capped so long lists don't drag. */
export function staggerIn(container, selector = ':scope > *', step = 35, max = 12) {
  if (!container || reducedMotion()) return;
  [...container.querySelectorAll(selector)].slice(0, max).forEach((el, i) => {
    el.animate(
      [
        { opacity: 0, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 460, delay: i * step, easing: EASE_OUT, fill: 'backwards' }
    );
  });
}

// ---------------------------------------------------------------- Motion (motion.dev) helpers
/** The vendored Motion library (window.Motion) or null - every caller has a fallback. */
export const M = () => (window.Motion && window.Motion.animate ? window.Motion : null);

function animateIn(el) {
  const m = M();
  if (m) {
    m.animate(el, { opacity: [0, 1], y: [28, 0] }, { duration: 0.7, ease: [0.23, 1, 0.32, 1] });
  } else {
    el.animate([{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: EASE_OUT });
  }
}

/**
 * Run once when `el` scrolls into view. Without a callback the element itself
 * fades/rises in (it is hidden until then). Reduced motion: shown immediately.
 */
export function reveal(el, cb) {
  if (!el) return;
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    if (cb) cb();
    return;
  }
  if (!cb) el.classList.add('reveal-pending');
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      io.disconnect();
      if (!cb) {
        el.classList.remove('reveal-pending');
        animateIn(el);
      } else cb();
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.04 }
  );
  io.observe(el);
}

/** Slide a pill indicator under the active tab with a spring (carries velocity if interrupted). */
export function moveIndicator(ind, target, instant = false) {
  if (!ind || !target) return;
  const x = target.offsetLeft;
  const width = target.offsetWidth;
  const m = M();
  if (m && !instant && !reducedMotion()) {
    m.animate(ind, { x, width }, { type: 'spring', bounce: 0.18, duration: 0.45 });
  } else if (m) {
    m.animate(ind, { x, width }, { duration: 0 });
  } else {
    ind.style.transform = `translateX(${x}px)`;
    ind.style.width = `${width}px`;
  }
}

/**
 * Drag-to-dismiss for bottom sheets: 1:1 tracking from the grab point, rubber-band
 * above the top, momentum projection on release, spring back or close.
 */
export function sheetDrag(sheet, handle, onClose) {
  let startY = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let dragging = false;
  const rubber = (d) => (d * 0.55 * 120) / (120 + 0.55 * Math.abs(d));
  const project = (v, rate = 0.99) => ((v / 1000) * rate) / (1 - rate);

  const move = (e) => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    const now = performance.now();
    velocity = ((e.clientY - lastY) / Math.max(1, now - lastT)) * 1000;
    lastY = e.clientY;
    lastT = now;
    sheet.style.transform = `translateY(${dy < 0 ? -rubber(-dy) : dy}px)`;
  };
  const up = (e) => {
    if (!dragging) return;
    dragging = false;
    handle.releasePointerCapture?.(e.pointerId);
    sheet.style.transition = '';
    const dy = Math.max(0, e.clientY - startY);
    const projected = dy + project(velocity);
    const h = sheet.getBoundingClientRect().height;
    if (projected > h * 0.4 || velocity > 900) {
      onClose(velocity);
    } else {
      // spring back from where the finger let go (CSS transition starts from the inline value)
      sheet.style.transition = 'transform 380ms cubic-bezier(0.32, 0.72, 0, 1)';
      sheet.style.transform = '';
      setTimeout(() => (sheet.style.transition = ''), 400);
    }
  };
  handle.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || e.target.closest('button, a, input, select, textarea')) return;
    dragging = true;
    startY = e.clientY;
    lastY = e.clientY;
    lastT = performance.now();
    velocity = 0;
    sheet.style.transition = 'none';
    handle.setPointerCapture?.(e.pointerId);
  });
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
}
