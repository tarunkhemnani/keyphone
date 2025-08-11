// iPhone Dialer App JavaScript
class DialerApp {
  constructor() {
    this.phoneNumber = '';
    this.clearTimeout = null;
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.updateTime();
    this.setupClearOnLongPress();
    
    // Update time every minute
    setInterval(() => this.updateTime(), 60000);
  }
  
  setupEventListeners() {
    // Keypad event listeners
    const keypad = document.getElementById('keypad');
    keypad.addEventListener('click', (e) => {
      const key = e.target.closest('.key');
      if (key) {
        const digit = key.dataset.digit;
        this.handleKeyPress(digit, key);
      }
    });
    
    // Call button event listener
    const callButton = document.getElementById('callButton');
    callButton.addEventListener('click', (e) => {
      this.handleCall(callButton);
    });
    
    // Prevent context menu on long press
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }
  
  setupClearOnLongPress() {
    const display = document.getElementById('display');
    let longPressTimer = null;
    
    const startLongPress = () => {
      longPressTimer = setTimeout(() => {
        this.clearPhoneNumber();
        this.vibrate(50); // Longer vibration for clear
      }, 500);
    };
    
    const cancelLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };
    
    // Touch events
    display.addEventListener('touchstart', startLongPress);
    display.addEventListener('touchend', cancelLongPress);
    display.addEventListener('touchmove', cancelLongPress);
    
    // Mouse events (for desktop testing)
    display.addEventListener('mousedown', startLongPress);
    display.addEventListener('mouseup', cancelLongPress);
    display.addEventListener('mouseleave', cancelLongPress);
  }
  
  handleKeyPress(digit, keyElement) {
    // Add visual feedback
    keyElement.classList.add('pressed');
    setTimeout(() => {
      keyElement.classList.remove('pressed');
    }, 150);
    
    // Add haptic feedback
    this.vibrate(10);
    
    // Update phone number
    this.phoneNumber += digit;
    this.updateDisplay();
    
    // Announce to screen readers
    this.announceDigit(digit);
  }
  
  handleCall(buttonElement) {
    // Add visual feedback
    buttonElement.classList.add('pressed');
    setTimeout(() => {
      buttonElement.classList.remove('pressed');
    }, 150);
    
    // Add haptic feedback
    this.vibrate(25);
    
    if (this.phoneNumber) {
      // Placeholder call functionality
      this.initiateCall(this.phoneNumber);
    } else {
      // Show feedback for empty number
      this.showCallFeedback('Please enter a phone number');
    }
  }
  
  initiateCall(number) {
    // Placeholder for actual call functionality
    this.showCallFeedback(`Calling ${number}...`);
    
    // In a real implementation, this would:
    // - Use WebRTC for browser-based calling
    // - Integrate with phone system APIs
    // - Handle call states (dialing, connected, ended)
    
    console.log(`Initiating call to: ${number}`);
  }
  
  showCallFeedback(message) {
    // Simple feedback - in a real app you might show a modal or toast
    alert(message);
  }
  
  clearPhoneNumber() {
    this.phoneNumber = '';
    this.updateDisplay();
  }
  
  updateDisplay() {
    const displayElement = document.getElementById('phoneNumber');
    displayElement.textContent = this.phoneNumber;
    
    // Update aria-label for accessibility
    const displayArea = document.getElementById('display');
    displayArea.setAttribute('aria-label', 
      this.phoneNumber ? `Phone number: ${this.phoneNumber}` : 'No number entered'
    );
  }
  
  updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false
    });
    
    const timeElement = document.getElementById('time');
    if (timeElement) {
      timeElement.textContent = timeString;
    }
  }
  
  announceDigit(digit) {
    // Create temporary element for screen reader announcement
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.textContent = digit;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
  
  vibrate(duration) {
    if ('vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  }
  
  // Utility method for formatting phone numbers (optional)
  formatPhoneNumber(number) {
    // Simple US phone number formatting
    // Remove all non-digits
    const cleaned = number.replace(/\D/g, '');
    
    // Apply formatting based on length
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dialerApp = new DialerApp();
});

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Handle keyboard input for desktop testing
document.addEventListener('keydown', (e) => {
  const dialerApp = window.dialerApp;
  if (!dialerApp) return;
  
  // Number keys
  if (e.key >= '0' && e.key <= '9') {
    e.preventDefault();
    const keyElement = document.querySelector(`[data-digit="${e.key}"]`);
    if (keyElement) {
      dialerApp.handleKeyPress(e.key, keyElement);
    }
  }
  
  // Special keys
  if (e.key === '*' || e.key === '#') {
    e.preventDefault();
    const keyElement = document.querySelector(`[data-digit="${e.key}"]`);
    if (keyElement) {
      dialerApp.handleKeyPress(e.key, keyElement);
    }
  }
  
  // Backspace to clear last digit
  if (e.key === 'Backspace') {
    e.preventDefault();
    dialerApp.phoneNumber = dialerApp.phoneNumber.slice(0, -1);
    dialerApp.updateDisplay();
  }
  
  // Enter to call
  if (e.key === 'Enter') {
    e.preventDefault();
    const callButton = document.getElementById('callButton');
    dialerApp.handleCall(callButton);
  }
  
  // Escape to clear all
  if (e.key === 'Escape') {
    e.preventDefault();
    dialerApp.clearPhoneNumber();
  }
});
