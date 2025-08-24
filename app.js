// app.js - keypad + transparent overlay + standalone detection + calibration
(() => {
  const displayEl = document.getElementById('display');
  const keysGrid = document.getElementById('keysGrid');
  const callBtn = document.getElementById('callBtn');
  const appEl = document.getElementById('app');
  const calUI = document.getElementById('calibrationUI');

  let digits = '';
  let longPressTimer = null;
  let longPressActive = false;
  const LONG_PRESS_MS = 600;

  // Calibration state (persisted)
  const STORAGE_KEY = 'overlay-calibration-v1';
  let calibration = { x: 0, y: 0 };

  function loadCalibration() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        calibration = JSON.parse(raw);
        setCalibrationVars();
      }
    } catch (e) { /* ignore */ }
  }
  function saveCalibration() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration)); } catch (e) {}
  }
  function setCalibrationVars() {
    document.documentElement.style.setProperty('--overlay-offset-x', calibration.x + 'px');
    document.documentElement.style.setProperty('--overlay-offset-y', calibration.y + 'px');
  }

  // Standalone detection (adds .standalone & .is-pwa)
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

  // keypad UI helpers
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
  function clearDigits() {
    digits = '';
    updateDisplay();
  }
  function doVibrate() {
    if (navigator.vibrate) {
      try { navigator.vibrate(8); } catch (e) {}
    }
  }

  // Map taps on invisible nav items to events (user can customize)
  const navItems = document.querySelectorAll('.bottom-nav .nav-item');
  navItems.forEach((el, idx) => {
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      // default behavior: log — replace with actual behavior if you want
      console.log('nav tap', idx, el.className);
      // optionally give visual feedback
      el.classList.add('pressed');
      setTimeout(()=>el.classList.remove('pressed'), 160);
    });
  });

  // Key pointer handlers
  keysGrid.querySelectorAll('.key').forEach(key => {
    const value = key.dataset.value;

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

  // call button
  callBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (!digits || digits.length === 0) {
      // small feedback pulse if no digits
      callBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 220 });
      return;
    }
    const sanitized = digits.replace(/[^\d+#*]/g, '');
    window.location.href = 'tel:' + sanitized;
  });

  // keyboard support & delete
  window.addEventListener('keydown', (ev) => {
    // Calibration toggle: press 'c' to toggle calibration mode (desktop only)
    if (ev.key === 'c' || ev.key === 'C') {
      toggleCalibration();
      return;
    }

    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown' || ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      if (calibrationMode) {
        ev.preventDefault();
        adjustCalibration(ev.key);
        return;
      }
    }

    if (ev.key >= '0' && ev.key <= '9') appendChar(ev.key);
    else if (ev.key === '+') appendChar('+');
    else if (ev.key === '*' || ev.key === '#') appendChar(ev.key);
    else if (ev.key === 'Backspace') { digits = digits.slice(0, -1); updateDisplay(); }
    else if (ev.key === 'Enter' && calibrationMode) {
      // save and exit calibration
      exitCalibration(true);
    } else if (ev.key === 'Escape' && calibrationMode) {
      exitCalibration(false);
    }
  });

  // Expose API
  window.__phoneKeypad = {
    append: (ch) => { appendChar(ch); },
    clear: clearDigits,
    getDigits: () => digits,
    isStandalone: () => appEl.classList.contains('standalone'),
    calibration: () => ({...calibration})
  };

  // Calibration helpers (toggle with 'c' key on desktop or call window functions)
  let calibrationMode = false;
  function toggleCalibration() {
    calibrationMode = !calibrationMode;
    if (calibrationMode) enterCalibration();
    else exitCalibration(true);
  }
  function enterCalibration() {
    calUI.classList.add('show');
    calUI.setAttribute('aria-hidden', 'false');
    calibrationMode = true;
    // show current offsets
    calUI.textContent = `Calibration: x=${calibration.x}px y=${calibration.y}px — Arrow keys to nudge. Enter to save, Esc to cancel.`;
  }
  function exitCalibration(save) {
    calibrationMode = false;
    calUI.classList.remove('show');
    calUI.setAttribute('aria-hidden', 'true');
    if (save) saveCalibration();
    else { loadCalibration(); setCalibrationVars(); } // revert
  }
  function adjustCalibration(arrowKey) {
    const step = 2; // px per press (small)
    if (arrowKey === 'ArrowUp') calibration.y = calibration.y - step;
    if (arrowKey === 'ArrowDown') calibration.y = calibration.y + step;
    if (arrowKey === 'ArrowLeft') calibration.x = calibration.x - step;
    if (arrowKey === 'ArrowRight') calibration.x = calibration.x + step;
    setCalibrationVars();
    calUI.textContent = `Calibration: x=${calibration.x}px y=${calibration.y}px — Arrow keys to nudge. Enter to save, Esc to cancel.`;
  }

  // initialize
  loadCalibration();
  detectStandalone();
  updateDisplay();

  // Helpful: tap anywhere on background to focus (mobile)
  document.addEventListener('click', (ev) => {
    // allow normal clicks to flow to buttons; this just ensures focus on body for keyboard
    try { document.activeElement.blur(); } catch (e) {}
  });

})();
