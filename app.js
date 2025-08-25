// app.js — visible keypad overlay, all keys active, viewport-sync, calibration + long-press 0 -> +
// Preloads replacement background (numpad.png) so the swap on first typed digit does not glitch.
(() => {
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
  const RELEASE_FADE_MS = 300; // <-- changed from 600 to 300 ms
  const STORAGE_KEY = 'overlay-calibration-screenshot-v3';
  let calibration = { x: 0, y: 0 };

  // Background image filenames
  const ORIGINAL_BG = "url('screenshot.png')";
  const FIRST_TYPED_BG = "url('numpad.png')";

  // Preload flags and object
  let _numpadPreloaded = false;
  let _numpadImage = null;

  function preloadReplacementImage() {
    try {
      _numpadImage = new Image();
      _numpadImage.onload = () => {
        _numpadPreloaded = true;
        console.log('numpad.png preloaded');
      };
      _numpadImage.onerror = (err) => {
        _numpadPreloaded = false;
        console.warn('numpad.png preload failed', err);
        _numpadImage = null;
      };
      _numpadImage.src = 'numpad.png';
    } catch (e) {
      console.warn('preload replacement image failed', e);
      _numpadPreloaded = false;
      _numpadImage = null;
    }
  }

  /* ---------- Viewport sync ---------- */
  (function setupViewportSync() {
    function updateViewportHeight() {
      try {
        const vv = window.visualViewport;
        const base = vv ? Math.round(vv.height) : window.innerHeight;
        const overfill = 8;
        const used = Math.max(100, base + overfill);
        document.documentElement.style.setProperty('--app-viewport-height', used + 'px');
        const ls = document.querySelector('.lockscreen');
        if (ls) ls.style.height = used + 'px';
        document.body.style.height = used + 'px';
      } catch (err) { console.warn('viewport sync failed', err); }
    }
    window.addEventListener('load', updateViewportHeight, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight, { passive: true });
      window.visualViewport.addEventListener('scroll', updateViewportHeight, { passive: true });
    }
    window.addEventListener('resize', updateViewportHeight, { passive: true });
    window.addEventListener('orientationchange', updateViewportHeight, { passive: true });
    updateViewportHeight();
    let t = 0;
    const id = setInterval(() => { updateViewportHeight(); t++; if (t > 20) clearInterval(id); }, 120);
  })();

  /* ---------- Calibration persistence ---------- */
  function loadCalibration() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        calibration = JSON.parse(raw);
        setCalibrationVars();
      }
    } catch (e) {}
  }
  function saveCalibration() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration)); } catch(e) {}
  }
  function setCalibrationVars() {
    document.documentElement.style.setProperty('--overlay-offset-x', (calibration.x || 0) + 'px');
    document.documentElement.style.setProperty('--overlay-offset-y', (calibration.y || 0) + 'px');
  }

  /* ---------- Standalone / PWA detection ---------- */
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

  /* ---------- Keypad helpers ---------- */
  function updateDisplay() {
    if (!displayEl) return;
    if (digits.length === 0) {
      displayEl.style.opacity = '0';
      displayEl.textContent = '';
    } else {
      displayEl.style.opacity = '1';
      displayEl.textContent = digits;
    }
  }

  // Called when the very first character is appended — flips the background
  function onFirstCharTyped() {
    try {
      appEl.style.backgroundImage = FIRST_TYPED_BG;
    } catch (e) { console.warn(e); }
  }

  function appendChar(ch) {
    if (digits.length >= 50) return;
    const wasEmpty = digits.length === 0;
    digits += ch;
    updateDisplay();
    if (wasEmpty) {
      onFirstCharTyped();
    }
  }

  function clearDigits() {
    digits = '';
    updateDisplay();
    try {
      appEl.style.backgroundImage = ORIGINAL_BG;
    } catch(e){}
  }

  function doVibrate() { if (navigator.vibrate) try { navigator.vibrate(8); } catch(e){} }

  /* ---------- Press visual helpers (immediate press, slow release) ---------- */
  function applyImmediatePressVisual(keyEl) {
    // make the pressed appearance immediate by disabling transition before adding class
    try {
      keyEl.style.transition = 'none';
      // force reflow to ensure the transition:none is applied immediately
      void keyEl.offsetWidth;
      keyEl.classList.add('pressed');
      // also ensure digit/letters color is instant — handled by CSS because transition is none
    } catch (e) { /* ignore */ }
  }

  function applyReleaseFadeAndRemovePress(keyEl) {
    try {
      // set release transition so removing 'pressed' will animate back slowly
      const release = `background-color ${RELEASE_FADE_MS}ms linear, color ${RELEASE_FADE_MS}ms linear`;
      // apply the transition inline
      keyEl.style.transition = release;

      // remove the pressed class (this triggers the fade back)
      keyEl.classList.remove('pressed');

      // after the release transition finishes, clean up the inline transition style
      const onTransitionEnd = (ev) => {
        // wait for either background-color or color to end (some browsers report 'background-color', some 'color')
        if (ev.propertyName === 'background-color' || ev.propertyName === 'color' || ev.propertyName === 'backgroundColor') {
          keyEl.style.transition = '';
          keyEl.removeEventListener('transitionend', onTransitionEnd);
        }
      };
      keyEl.addEventListener('transitionend', onTransitionEnd);
    } catch (e) { /* ignore */ }
  }

  /* ---------- Attach events to all keys (1..9,0,*,#) ---------- */
  function setupKeys() {
    if (!keysGrid) return;
    keysGrid.querySelectorAll('.key').forEach(key => {
      const value = key.dataset.value;

      // Pointer interactions
      key.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        try { key.setPointerCapture(ev.pointerId); } catch(e){ }
        // immediate visual press (no transition)
        applyImmediatePressVisual(key);
        doVibrate();
        longPressActive = false;

        // long-press 0 -> +
        if (value === '0') {
          longPressTimer = setTimeout(() => {
            longPressActive = true;
            appendChar('+');
          }, LONG_PRESS_MS);
        }
      });

      key.addEventListener('pointerup', (ev) => {
        ev.preventDefault();
        try { key.releasePointerCapture(ev.pointerId); } catch(e){}
        // fade back slowly and then append char (if not long-press)
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }

        // If long-press already appended +, don't append the base value again
        if (!longPressActive) {
          // fade back and then append (append immediately so display updates with the press)
          applyReleaseFadeAndRemovePress(key);
          appendChar(value);
        } else {
          // long-press handled: just fade back
          applyReleaseFadeAndRemovePress(key);
        }
        longPressActive = false;
      });

      key.addEventListener('pointerleave', (ev) => {
        // if pointer leaves, cancel long press and fade back
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        applyReleaseFadeAndRemovePress(key);
        longPressActive = false;
      });

      // Keyboard accessibility: keydown should show immediate press (no transition)
      key.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          applyImmediatePressVisual(key);
        }
      });

      // keyup triggers release fade and action
      key.addEventListener('keyup', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          applyReleaseFadeAndRemovePress(key);
          appendChar(value);
        }
      });
    });
  }

  /* ---------- Call button ---------- */
  if (callBtn) {
    callBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (!digits || digits.length === 0) {
        callBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 220 });
        return;
      }
      const sanitized = digits.replace(/[^\d+#*]/g, '');
      window.location.href = 'tel:' + sanitized;
    });
  }

  /* ---------- Keyboard events + calibration toggle ---------- */
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

  window.addEventListener('keydown', (ev) => {
    // toggle calibration with 'c'
    if (ev.key === 'c' || ev.key === 'C') {
      if (!calibrationMode) enterCalibration(); else exitCalibration(true);
      return;
    }

    if (calibrationMode) {
      if (ev.key === 'ArrowUp') { ev.preventDefault(); adjustCalibration('up'); }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); adjustCalibration('down'); }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); adjustCalibration('left'); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); adjustCalibration('right'); }
      if (ev.key === 'Enter') { ev.preventDefault(); saveCalibration(); exitCalibration(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); exitCalibration(false); }
      return;
    }

    // general keypad typing (global keyboard, not the focused button)
    if (ev.key >= '0' && ev.key <= '9') appendChar(ev.key);
    else if (ev.key === '+' || ev.key === '*' || ev.key === '#') appendChar(ev.key);
    else if (ev.key === 'Backspace') { digits = digits.slice(0, -1); updateDisplay(); if (digits.length === 0) { try { appEl.style.backgroundImage = ORIGINAL_BG; } catch(e){} } }
  });

  // bottom nav taps (transparent overlay)
  document.querySelectorAll('.bottom-nav .nav-item').forEach((el, idx) => {
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      el.classList.add('pressed');
      setTimeout(()=>el.classList.remove('pressed'), 160);
      console.log('nav tap', idx);
    });
  });

  // init
  preloadReplacementImage();   // <-- start fetching the replacement image immediately
  loadCalibration();
  detectStandalone();
  setupKeys();
  updateDisplay();

  document.addEventListener('click', () => { try { document.activeElement.blur(); } catch(e){} });

  // API
  window.__phoneKeypad = {
    append: (ch) => { appendChar(ch); },
    clear: clearDigits,
    getDigits: () => digits,
    isStandalone: () => appEl.classList.contains('standalone'),
    calibration: () => ({...calibration}),
    // expose preload state for debugging if desired
    __numpadPreloaded: () => _numpadPreloaded
  };
})();
