/** Tiny shared state + navigation helpers (kept separate to avoid circular imports). */
export const flash = {
  // one-shot data handed from one view to the next (e.g. stock adjustments after an update)
  purchaseAdjustments: null,
};

let renderToken = 0;

export function nextRenderToken() {
  renderToken += 1;
  return renderToken;
}

export function isCurrent(token) {
  return token === renderToken;
}

export function navigate(hash) {
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}
