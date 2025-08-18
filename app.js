/* app.js
   Dynamic behavior:
   - pointer-friendly press: key brightens while pressed
   - keyboard appends digits to display area
   - long-press on 0 inserts '+'
   - call button opens tel: link when digits present
   - vibration on press (if supported)
*/

(() => {
  const displayEl = document.getElementById('display');
  const keysGrid = document.getElementById('keysGrid');
  const callBtn = document.getElementById('callBtn');
  let digits = '';
  let longPressTimer = null;
  let longPressActive = false;
  const LONG_PRESS_MS = 600;

  // utility: update display visibility + text
  function updateDisplay() {
    if (digits.length === 0) {
      displayEl.style.opacity = '0';
      displayEl.textContent = '';
    } else {
      displayEl.style.opacity = '1';
      displayEl.textContent = digits;
    }
  }

  // utility: add a character
  function appendChar(ch) {
    // limit length for visual sanity (optional)
    if (digits.length >= 24) return;
    digits += ch;
    updateDisplay();
  }

  // clear digits (called after call, or via long inactivity)
  function clearDigits() {
    digits = '';
    updateDisplay();
  }

  // enable soft vibration if available
  function doVibrate() {
    if (navigator.vibrate) {
      try { navigator.vibrate(8); } catch (e) {}
    }
  }

  // pointer handlers (works for mouse & touch)
  keysGrid.querySelectorAll('.key').forEach(key => {
    const value = key.dataset.value;

    // pointerdown (start press)
    key.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      key.setPointerCapture(ev.pointerId);
      key.classList.add('pressed');
      doVibrate();
      longPressActive = false;

      // handle long-press for 0 => '+'
      if (value === '0') {
        longPressTimer = setTimeout(() => {
          longPressActive = true;
          appendChar('+');
        }, LONG_PRESS_MS);
      }
    });

    // pointerup (end press)
    key.addEventListener('pointerup', (ev) => {
      ev.preventDefault();
      try { key.releasePointerCapture(ev.pointerId); } catch (e) {}
      key.classList.remove('pressed');

      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      // if longPressActive handled it, don't append the original 0
      if (!longPressActive) {
        appendChar(value);
      }
      longPressActive = false;
    });

    // pointercancel / leave
    key.addEventListener('pointerleave', (ev) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      key.classList.remove('pressed');
      longPressActive = false;
    });

    // keyboard support (Enter/Space)
    key.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        key.classList.add('pressed');
      }
    });
    key.addEventListener('keyup', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        key.classList.remove('pressed');
        appendChar(value);
      }
    });
  });

  // call button behavior
  callBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (!digits || digits.length === 0) {
      // no digits: flash button instead
      callBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 220 });
      return;
    }
    // sanitize dial string: keep digits, +, *, #
    const sanitized = digits.replace(/[^\d+#*]/g, '');
    // trigger call
    window.location.href = 'tel:' + sanitized;
    // optionally clear after a brief timeout
    setTimeout(clearDigits, 500);
  });

  // keyboard numeric input support
  window.addEventListener('keydown', (ev) => {
    if (ev.key >= '0' && ev.key <= '9') {
      appendChar(ev.key);
    } else if (ev.key === '+' ) {
      appendChar('+');
    } else if (ev.key === '*' || ev.key === '#') {
      appendChar(ev.key);
    } else if (ev.key === 'Backspace') {
      digits = digits.slice(0, -1);
      updateDisplay();
    }
  });

  // clear after inactivity (10s)
  let inactivityTimer = null;
  function resetInactivity() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      clearDigits();
    }, 10000);
  }
  // reset timer whenever digits change or user interacts
  ['pointerdown','keydown','click'].forEach(evt => window.addEventListener(evt, resetInactivity));
  const originalAppend = appendChar;
  // override append to also reset inactivity
  appendChar = (ch) => { digits += ch; updateDisplay(); resetInactivity(); };

  // initial display update
  updateDisplay();

  // expose for debugging (optional)
  window.__phoneKeypad = {
    append: (ch) => { appendChar(ch); },
    clear: clearDigits,
    getDigits: () => digits
  };
})();


