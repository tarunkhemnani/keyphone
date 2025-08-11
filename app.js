// app.js
// Improved keypad: standalone detection, safe-area handling, tel fallback, PWA basics

const phoneNumberEl = document.getElementById('phoneNumber');
const keys = document.querySelectorAll('.key');
const callBtn = document.getElementById('callBtn');
const backspaceBtn = document.getElementById('backspace');
const zeroKey = document.getElementById('zeroKey');

const telFallback = document.getElementById('telFallback');
const fallbackNumber = document.getElementById('fallbackNumber');
const copyNumberBtn = document.getElementById('copyNumber');
const closeFallbackBtn = document.getElementById('closeFallback');

let value = '';
const LONGPRESS_MS = 600;
let longPressTimer = null;

function sanitizeForTel(s){
  // keep digits, +, star, and hash
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

// append char
function appendChar(ch){
  value += ch;
  updateDisplay();
  // quick subtle animation
  phoneNumberEl.animate([{transform:'scale(1.02)'},{transform:'scale(1)'}],{duration:120,fill:'forwards'});
}

// backspace
backspaceBtn.addEventListener('click', () => {
  if(!value) return;
  value = value.slice(0,-1);
  updateDisplay();
});

// button clicks
keys.forEach(btn=>{
  const val = btn.dataset.value;
  btn.addEventListener('click', (e) => {
    // If zero key used longpress handled flag exists, skip the synthetic click.
    if(btn.id === 'zeroKey' && btn.dataset.handled === 'true'){
      delete btn.dataset.handled;
      return;
    }
    appendChar(val);
  });

  // accessible keyboard activation
  btn.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      appendChar(btn.dataset.value);
    }
  });
});

// long press on 0 => '+'
zeroKey.addEventListener('touchstart', startLongPress, {passive:true});
zeroKey.addEventListener('mousedown', startLongPress);

zeroKey.addEventListener('touchend', cancelLongPress);
zeroKey.addEventListener('mouseup', cancelLongPress);
zeroKey.addEventListener('mouseleave', cancelLongPress);
zeroKey.addEventListener('touchcancel', cancelLongPress);

function startLongPress(e){
  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    appendChar('+');
    zeroKey.dataset.handled = 'true';
  }, LONGPRESS_MS);
}

function cancelLongPress(e){
  if(longPressTimer){
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  // Let click handler decide whether to consume based on dataset.handled
}

// keyboard support
document.addEventListener('keydown', (e)=>{
  if(e.key >= '0' && e.key <= '9'){ appendChar(e.key); }
  else if(e.key === '*' || e.key === '#'){ appendChar(e.key); }
  else if(e.key === '+'){ appendChar('+'); }
  else if(e.key === 'Backspace'){ value = value.slice(0,-1); updateDisplay(); }
  else if(e.key === 'Enter'){
    tryCall();
  }
});

// call fallback handler
function tryCall(){
  const sanitized = sanitizeForTel(value);
  if(!sanitized) return;
  // Normal behavior: use tel: link; in standalone iOS sometimes restricted — provide fallback
  const telHref = 'tel:' + sanitized;

  // Attempt to navigate — most browsers handle tel: fine.
  // If running in iOS standalone and tel fails, provide fallback dialog
  const isIosStandalone = ('standalone' in navigator) && navigator.standalone;
  // If not iOS standalone, allow link default so anchor works.
  if(isIosStandalone){
    // Some iOS versions block tel: in standalone — try to open then show fallback
    window.location.href = telHref;
    // If after a short delay app didn't leave the page, show fallback
    setTimeout(()=>{
      // If still in page, show fallback so user can copy the number
      showTelFallback(sanitized);
    }, 600);
  } else {
    // not standalone: use location change to tel:
    window.location.href = telHref;
  }
}

// call button click that uses tryCall with fallback
callBtn.addEventListener('click', (e)=>{
  const sanitized = sanitizeForTel(value);
  if(!sanitized){
    e.preventDefault();
    return;
  }
  // Prevent default to run our fallback logic
  e.preventDefault();
  tryCall();
});

// fallback dialog utilities
function showTelFallback(number){
  fallbackNumber.textContent = number;
  telFallback.classList.remove('hidden');
}
copyNumberBtn.addEventListener('click', async ()=>{
  try {
    await navigator.clipboard.writeText(fallbackNumber.textContent);
    copyNumberBtn.textContent = 'Copied';
    setTimeout(()=> copyNumberBtn.textContent = 'Copy', 1200);
  } catch(err){
    copyNumberBtn.textContent = 'Failed';
  }
});
closeFallbackBtn.addEventListener('click', ()=> {
  telFallback.classList.add('hidden');
});

// register service worker (makes the app installable / work offline)
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('/service-worker.js').catch(err=>{
      console.warn('SW register failed', err);
    });
  });
}

// small helper: prevent overscroll bounce on iOS when in standalone
document.addEventListener('touchmove', function(e){
  // allow scroll only inside tel fallback content if open
  if(telFallback && !telFallback.classList.contains('hidden')){
    // allow
  } else {
    e.preventDefault();
  }
}, {passive:false});

// init
updateDisplay();
