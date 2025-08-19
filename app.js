// app.js - keypad behavior + standalone detection (unchanged core behavior)
(() => {
  const displayEl = document.getElementById('display');
  const keysGrid = document.getElementById('keysGrid');
  const callBtn = document.getElementById('callBtn');
  const appEl = document.getElementById('app');
  let digits = '';
  let longPressTimer = null;
  let longPressActive = false;
  const LONG_PRESS_MS = 600;

  /* Standalone detection */
  function detectStandalone() {
    const isIOSStandalone = window.navigator.standalone === true;
    const isDisplayModeStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (isIOSStandalone || isDisplayModeStandalone) {
      appEl.classList.add('standalone');
    } else {
      appEl.classList.remove('standalone');
    }
  }
  detectStandalone();
  if (window.matchMedia) {
    try {
      const mq = window.matchMedia('(display-mode: standalone)');
      if (mq && mq.addEventListener) mq.addEventListener('change', detectStandalone);
      else if (mq && mq.addListener) mq.addListener(detectStandalone);
    } catch (e) { /* ignore */ }
  }

  /* UI helpers */
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

  /* Key pointer handlers */
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

    key.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); key.classList.add('pressed'); }
    });
    key.addEventListener('keyup', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); key.classList.remove('pressed'); appendChar(value); }
    });
  });

  /* Call button */
  callBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (!digits || digits.length === 0) {
      callBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 220 });
      return;
    }
    const sanitized = digits.replace(/[^\d+#*]/g, '');
    window.location.href = 'tel:' + sanitized;
  });

  /* Keyboard support & delete */
  window.addEventListener('keydown', (ev) => {
    if (ev.key >= '0' && ev.key <= '9') appendChar(ev.key);
    else if (ev.key === '+') appendChar('+');
    else if (ev.key === '*' || ev.key === '#') appendChar(ev.key);
    else if (ev.key === 'Backspace') { digits = digits.slice(0, -1); updateDisplay(); }
  });

  window.__phoneKeypad = {
    append: (ch) => { appendChar(ch); },
    clear: clearDigits,
    getDigits: () => digits,
    isStandalone: () => appEl.classList.contains('standalone')
  };

  updateDisplay();
})();
