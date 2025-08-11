// app.js
// Functional keypad behavior: clicks, long-press 0 -> +, keyboard input, call button

const phoneNumberEl = document.getElementById('phoneNumber');
const keys = document.querySelectorAll('.key');
const callBtn = document.getElementById('callBtn');
const backspaceBtn = document.getElementById('backspace');
const zeroKey = document.getElementById('zeroKey');

let value = '';
const LONGPRESS_MS = 600; // hold 0 to get '+'
let longPressTimer = null;

// sanitize for tel: (allow digits, +, *, #)
function sanitizeForTel(s){
  // keep digits, +, star, and pound/hash
  return s.replace(/[^\d+#*+]/g, '');
}
function updateDisplay(){
  phoneNumberEl.textContent = value;
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

// add digit/char
function appendChar(ch){
  value += ch;
  updateDisplay();
  // slight visual feedback
  phoneNumberEl.animate([{transform:'scale(1.02)'},{transform:'scale(1)'}],{duration:120,fill:'forwards'});
}

// remove last char
backspaceBtn.addEventListener('click', () => {
  if (!value) return;
  value = value.slice(0, -1);
  updateDisplay();
});

// handle keypad buttons
keys.forEach(btn=>{
  const val = btn.dataset.value;
  // click/tap
  btn.addEventListener('click', (e) => {
    // ignore longpress aftermath if any
    appendChar(val);
  });

  // support keyboard "Enter" / space when focused
  btn.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      appendChar(val);
    }
  });
});

// long-press on 0 for '+'
zeroKey.addEventListener('touchstart', startLongPress);
zeroKey.addEventListener('mousedown', startLongPress);

zeroKey.addEventListener('touchend', cancelLongPress);
zeroKey.addEventListener('mouseup', cancelLongPress);
zeroKey.addEventListener('mouseleave', cancelLongPress);
zeroKey.addEventListener('touchcancel', cancelLongPress);

function startLongPress(e){
  // if triggered by click, let normal click append '0' after we decide not longpress
  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    appendChar('+');
    // prevent synthetic click causing '0' after a long press on some devices:
    zeroKey.dataset.handled = 'true';
  }, LONGPRESS_MS);
}

function cancelLongPress(e){
  if(longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  // If we set handled by longpress, prevent the immediate click from also appending 0.
  const handled = zeroKey.dataset.handled === 'true';
  if(handled){
    // small delay then clear the flag
    setTimeout(()=>{ delete zeroKey.dataset.handled; }, 50);
    // stop propagation of the click event that may follow
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

// keyboard support: digits, *, #, + via Shift+ = or plus key
document.addEventListener('keydown', (e)=>{
  // allow numbers & some symbols
  if(e.key >= '0' && e.key <= '9'){
    appendChar(e.key);
  } else if(e.key === '*' || e.key === '#'){
    appendChar(e.key);
  } else if(e.key === '+' ){
    appendChar('+');
  } else if(e.key === 'Backspace'){
    value = value.slice(0,-1);
    updateDisplay();
  } else if(e.key === 'Enter'){
    // if number exists, follow tel: link
    const sanitized = sanitizeForTel(value);
    if(sanitized.length){
      window.location.href = 'tel:' + sanitized;
    }
  }
});

// small UX: click callBtn also tries to call but only when not disabled
callBtn.addEventListener('click', (e)=>{
  const sanitized = sanitizeForTel(value);
  if(!sanitized.length){
    e.preventDefault();
  } else {
    // let link proceed (tel:), nothing else needed
  }
});

// initialize empty
updateDisplay();
