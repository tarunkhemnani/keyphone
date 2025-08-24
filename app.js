// app.js — merged behavior:
//  - visualViewport / viewport-sync (from your working app.js)
//  - transparent screenshot overlay keypad + calibration + keypad logic
(() => {
  const API_BASE = ""; // not used here but kept for parity with your code
  const displayEl = document.getElementById('display');
  const keysGrid = document.getElementById('keysGrid');
  const callBtn = document.getElementById('callBtn');
  const appEl = document.getElementById('app');
  const calUI = document.getElementById('calibrationUI');
  const calText = document.getElementById('calText');

  let digits = '';
  let longPressTimer = null;
  let longPressActive = false;
  const LONG_PRESS_MS = 600;

  /* ---------- Viewport sync: match visualViewport and pin heights to avoid sliding/gaps ---------- */
  (function setupViewportSync() {
    function updateViewportHeight() {
      try {
        const vv = window.visualViewport;
        const base = vv ? Math.round(vv.height) : window.innerHeight;
        const overfill = 8; // small overfill to avoid rounding gaps
        const used = Math.max(100, base + overfill);
        document.documentElement.style.setProperty('--app-viewport-height', used + 'px');
        // also set explicit sizes on app / body to keep painting consistent
        const ls = document.querySelector('.lockscreen');
        if (ls) ls.style.height = used + 'px';
        document.body.style.height = used + 'px';
      } catch (err) {
        console.warn('viewport sync failed', err);
      }
    }

    window.addEventListener('load', updateViewportHeight, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight, { passive: true });
      window.visualViewport.addEventListener('scroll', updateViewportHeight, { passive: true });
    }
    window.addEventListener('resize', updateViewportHeight, { passive: true });
    window.addEventListener('orientationchange', updateViewportHeight, { passive: true });

    updateViewportHeight();

    // catch iOS toolbar animation frames with a few repeats
    let t = 0;
    const id = setInterval(() => {
      updateViewportHeight();
      t += 1;
      if (t > 20) clearInterval(id);
    }, 120);
  })();

  /* ---------- Calibration (persisted) ---------- */
  const STORAGE_KEY = 'overlay-calibration-screenshot-v1';
  let calibration = { x: 0, y: 0 };
  function loadCalibration() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        calibration = JSON.parse(raw);
        setCalibrationVars();
      }
    } catch (e){}
  }
  function saveCalibration() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration)); } catch(e){}
  }
  function setCalibrationVars() {
    document.documentElement.style.setProperty('--overlay-offset-x', (calibration.x || 0) + 'px');
    document.documentElement.style.setProperty('--overlay-offset-y', (calibration.y || 0) + 'px');
  }

  /* ---------- Standalone detection (adds class if PWA) ---------- */
  function detectStandalone() {
    const isIOSStandalone = window.navigator.standalone === true;
    const isDisplayModeStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (isIOSStandalone || isDisplayModeStandalone) {
      appEl.classList.add('standalone');
      document.documentElement.classList.add('is-pwa');
    } else {
      appEl.classList.remove('standalone');
      document.documentElement.classList.remove('is-pwa');
    }
  }
  detectStandalone();
  if (window.matchMedia) {
    try {
      const mq = window.matchMedia('(display-mode: standalone)');
      if (mq && mq.addEventListener) mq.addEventListener('change', detectStandalone);
      else if (mq && mq.addListener) mq.addListener(detectStandalone);
    } catch (e) {}
  }

  /* ---------- keypad helpers ---------- */
  function updateDisplay() {
    if (digits.length === 0) {
      displayEl.style.opacity = '0';
      displayEl.textContent = '';
    } else {
      displayEl.style.opacity = '1';
      displayEl.textContent = digits;
    }
  }
  function appendChar(ch) {
    if (digits.length >= 50) return;
    digits += ch;
    updateDisplay();
  }
  function clearDigits() { digits = ''; updateDisplay(); }
  function doVibrate() { if (navigator.vibrate) try { navigator.vibrate(8); } catch(e){} }

  // attach handlers to keys in the overlay (transparent buttons)
  keysGrid.querySelectorAll('.key').forEach(key => {
    const value = key.dataset.value;
    // pointer handlers
    key.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      try { key.setPointerCapture(ev.pointerId); } catch (e) {}
      key.classList.add('pressed');
      doVibrate();
      longPressActive = false;
      if (value === '0') {
        longPressTimer = setTimeout(() => {
          longPressActive = true;
          appendChar('+');
        }, LONG_PRESS_MS);
      }
    });
    key.addEventListener('pointerup', (ev) => {
      ev.preventDefault();
      try { key.releasePointerCapture(ev.pointerId); } catch (e) {}
      key.classList.remove('pressed');
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      if (!longPressActive) appendChar(value);
      longPressActive = false;
    });
    key.addEventListener('pointerleave', (ev) => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      key.classList.remove('pressed');
      longPressActive = false;
    });

    // keyboard accessibility
    key.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); key.classList.add('pressed'); }
    });
    key.addEventListener('keyup', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); key.classList.remove('pressed'); appendChar(value); }
    });
  });

  // call button behavior (invisible overlay)
  callBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (!digits || digits.length === 0) {
      callBtn.animate([{ transform: 'scale(1)' },{ transform: 'scale(0.96)' },{ transform: 'scale(1)' }], { duration: 220 });
      return;
    }
    const sanitized = digits.replace(/[^\d+#*]/g, '');
    window.location.href = 'tel:' + sanitized;
  });

  // keyboard support & delete
  window.addEventListener('keydown', (ev) => {
    // calibration toggle (desktop)
    if (ev.key === 'c' || ev.key === 'C') {
      if (!calibrationMode) enterCalibration(); else exitCalibration(true);
      return;
    }
    if (calibrationMode) {
      if (ev.key === 'ArrowUp') { ev.preventDefault(); adjustCalibration('up'); }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); adjustCalibration('down'); }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); adjustCalibration('left'); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); adjustCalibration('right'); }
      if (ev.key === 'Enter') { ev.preventDefault(); exitCalibration(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); exitCalibration(false); }
      return;
    }

    if (ev.key >= '0' && ev.key <= '9') appendChar(ev.key);
    else if (ev.key === '+') appendChar('+');
    else if (ev.key === '*' || ev.key === '#') appendChar(ev.key);
    else if (ev.key === 'Backspace') { digits = digits.slice(0, -1); updateDisplay(); }
  });

  // --- simple bottom nav feedback (transparent overlay buttons) ---
  document.querySelectorAll('.bottom-nav .nav-item').forEach((el, idx) => {
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      el.classList.add('pressed');
      setTimeout(()=>el.classList.remove('pressed'), 160);
      // you can hook navigation behavior here
      console.log('nav tap', idx);
    });
  });

  // ---------- Calibration mode ----------
  let calibrationMode = false;
  function enterCalibration() {
    calibrationMode = true;
    calUI.classList.add('show');
    calText.textContent = `Calibration: x=${calibration.x}px y=${calibration.y}px — arrow keys to nudge. Enter save, Esc cancel.`;
    calUI.setAttribute('aria-hidden', 'false');
  }
  function exitCalibration(save) {
    calibrationMode = false;
    calUI.classList.remove('show');
    calUI.setAttribute('aria-hidden', 'true');
    if (save) saveCalibration();
    else { loadCalibration(); setCalibrationVars(); }
  }
  function adjustCalibration(dir) {
    const step = 2;
    if (dir === 'up') calibration.y -= step;
    if (dir === 'down') calibration.y += step;
    if (dir === 'left') calibration.x -= step;
    if (dir === 'right') calibration.x += step;
    setCalibrationVars();
    calText.textContent = `Calibration: x=${calibration.x}px y=${calibration.y}px — arrow keys to nudge. Enter save, Esc cancel.`;
  }

  // init
  loadCalibration();
  detectStandalone();
  updateDisplay();

  // tidy focus behaviour
  document.addEventListener('click', () => { try { document.activeElement.blur(); } catch(e){} });

  // expose API
  window.__phoneKeypad = {
    append: (ch) => { appendChar(ch); },
    clear: clearDigits,
    getDigits: () => digits,
    isStandalone: () => appEl.classList.contains('standalone'),
    calibration: () => ({...calibration})
  };
})();
