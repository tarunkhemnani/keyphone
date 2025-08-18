/* app.js remains unchanged – dynamic behavior for touches is intact. */
(() => {
  const displayEl = document.getElementById('display');
  const keysGrid = document.getElementById('keysGrid');
  const callBtn = document.getElementById('callBtn');
  let digits = '';
  let longPressTimer = null;
  let longPressActive = false;
  const LONG_PRESS_MS = 600;

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
    if (digits.length >= 24) return;
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

  callBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (!digits || digits.length === 0) {
      callBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 220 });
      return;
    }
    const sanitized = digits.replace(/[^\d+#*]/g, '');
    window.location.href = 'tel:' + sanitized;
    setTimeout(clearDigits, 500);
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.key >= '0' && ev.key <= '9') appendChar(ev.key);
    else if (ev.key === '+') appendChar('+');
    else if (ev.key === '*' || ev.key === '#') appendChar(ev.key);
    else if (ev.key === 'Backspace') { digits = digits.slice(0, -1); updateDisplay(); }
  });

  let inactivityTimer = null;
  function resetInactivity() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => { clearDigits(); }, 10000);
  }
  ['pointerdown','keydown','click'].forEach(evt => window.addEventListener(evt, resetInactivity));

  const originalAppend = appendChar;
  appendChar = (ch) => { digits += ch; updateDisplay(); resetInactivity(); };

  updateDisplay();

  window.__phoneKeypad = { append: (ch) => { appendChar(ch); }, clear: clearDigits, getDigits: () => digits };
})();
