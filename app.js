// Clean keypad behavior: no status UI, no visible delete button.
// Double-tap number = delete last digit.
// Long-press number = clear all.
// Zero long-press = '+'

const phoneNumberEl = document.getElementById('phoneNumber');
const keys = document.querySelectorAll('.key');
const callBtn = document.getElementById('callBtn');
const zeroKey = document.getElementById('zeroKey');

let value = '';
const LONGPRESS_MS = 600;
let zeroLongTimer = null;
let displayLongTimer = null;
let lastTap = 0;

function sanitizeForTel(s){
  return s.replace(/[^\d+#*+]/g, '');
}
function updateDisplay(){
  // minimise flicker: update textContent then trigger a short pulse
  phoneNumberEl.textContent = value;
  // pulse animation: add class then remove
  phoneNumberEl.classList.add('pulse');
  window.setTimeout(()=> phoneNumberEl.classList.remove('pulse'), 160);

  const sanitized = sanitizeForTel(value);
  if(sanitized.length){
    callBtn.classList.remove('disabled');
    callBtn.setAttribute('href', 'tel:' + sanitized);
    callBtn.setAttribute('aria-disabled','false');
  } else {
    callBtn.classList.add('disabled');
    callBtn.setAttribute('href', '#');
    callBtn.setAttribute('aria-disabled','true');
  }
}

function appendChar(ch){
  value += ch;
  updateDisplay();
}

// key press visuals + behavior
keys.forEach(btn=>{
  const val = btn.dataset.value;

  // visual pressed class
  const press = (el) => {
    el.classList.add('pressed');
    setTimeout(()=> el.classList.remove('pressed'), 120);
  };

  btn.addEventListener('click', (e)=>{
    // if zero had long-press handled flag, skip synthetic click
    if(btn.id === 'zeroKey' && btn.dataset.handled === 'true'){
      delete btn.dataset.handled;
      return;
    }
    press(btn);
    appendChar(val);
  });

  // long-press on 0 -> +
  if(btn.id === 'zeroKey'){
    btn.addEventListener('touchstart', (e)=>{
      zeroLongTimer = setTimeout(()=>{
        btn.dataset.handled = 'true';
        press(btn);
        appendChar('+');
      }, LONGPRESS_MS);
    }, {passive:true});
    btn.addEventListener('mousedown', (e)=>{
      zeroLongTimer = setTimeout(()=>{
        btn.dataset.handled = 'true';
        press(btn);
        appendChar('+');
      }, LONGPRESS_MS);
    });
    const clearZeroTimer = ()=> { if(zeroLongTimer){ clearTimeout(zeroLongTimer); zeroLongTimer = null; } };
    btn.addEventListener('touchend', clearZeroTimer);
    btn.addEventListener('mouseup', clearZeroTimer);
    btn.addEventListener('mouseleave', clearZeroTimer);
    btn.addEventListener('touchcancel', clearZeroTimer);
  }
});

// delete gestures on the display (double-tap & long-press)
phoneNumberEl.addEventListener('touchstart', (e)=>{
  // start long-press timer to clear all
  displayLongTimer = setTimeout(()=>{
    value = '';
    updateDisplay();
  }, LONGPRESS_MS);
}, {passive:true});
phoneNumberEl.addEventListener('touchend', (e)=>{
  if(displayLongTimer){ clearTimeout(displayLongTimer); displayLongTimer = null; }
  // detect double-tap for backspace
  const now = Date.now();
  if(now - lastTap < 300){
    // double-tap -> delete last digit
    value = value.slice(0,-1);
    updateDisplay();
    lastTap = 0;
  } else {
    lastTap = now;
  }
});

// also allow mouse double-click to delete and long mousedown to clear
phoneNumberEl.addEventListener('mousedown', (e)=>{
  displayLongTimer = setTimeout(()=>{
    value = '';
    updateDisplay();
  }, LONGPRESS_MS);
});
phoneNumberEl.addEventListener('mouseup', (e)=>{
  if(displayLongTimer){ clearTimeout(displayLongTimer); displayLongTimer = null; }
});
phoneNumberEl.addEventListener('dblclick', (e)=>{
  value = value.slice(0,-1);
  updateDisplay();
});

// keyboard support for desktop/testing
document.addEventListener('keydown', (e)=>{
  if(e.key >= '0' && e.key <= '9'){ appendChar(e.key); }
  else if(e.key === '*' || e.key === '#'){ appendChar(e.key); }
  else if(e.key === '+'){ appendChar('+'); }
  else if(e.key === 'Backspace'){ value = value.slice(0,-1); updateDisplay(); }
  else if(e.key === 'Enter'){
    const sanitized = sanitizeForTel(value);
    if(sanitized.length) window.location.href = 'tel:' + sanitized;
  }
});

// call button behavior (use tel: href but do not break UI)
callBtn.addEventListener('click', (e)=>{
  const sanitized = sanitizeForTel(value);
  if(!sanitized){
    e.preventDefault();
    return;
  }
  // navigate to tel: (iOS standalone may block; this keeps behavior simple)
  // default anchor is prevented so that single handler works across contexts
  e.preventDefault();
  window.location.href = 'tel:' + sanitized;
});

// init
updateDisplay();
