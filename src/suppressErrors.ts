
// suppressErrors.ts

// 1. Patch ResizeObserver to debounce callbacks to avoid loops
// This prevents the "ResizeObserver loop completed with undelivered notifications" error
// by yielding to the next frame before processing resize events.
const OriginalResizeObserver = window.ResizeObserver;

if (OriginalResizeObserver) {
  window.ResizeObserver = class ResizeObserver extends OriginalResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries: ResizeObserverEntry[], observer: ResizeObserver) => {
        // Wrap callback in requestAnimationFrame to avoid "Loop completed with undelivered notifications"
        window.requestAnimationFrame(() => {
          if (!Array.isArray(entries) || !entries.length) return;
          callback(entries, observer);
        });
      });
    }
  };
}

// 2. Patch console.error to suppress the error if it makes it to the console
const originalConsoleError = console.error;
const resizeObserverLoopErr = /ResizeObserver loop limit exceeded/;
const resizeObserverNotificationErr = /ResizeObserver loop completed with undelivered notifications/;

console.error = (...args: any[]) => {
  if (args.length > 0) {
    const msg = args[0];
    if (typeof msg === 'string' && (resizeObserverLoopErr.test(msg) || resizeObserverNotificationErr.test(msg))) {
      return;
    }
    if (msg instanceof Error && (resizeObserverLoopErr.test(msg.message) || resizeObserverNotificationErr.test(msg.message))) {
      return;
    }
  }
  originalConsoleError.apply(console, args);
};

// 3. Catch global errors with capture phase strategies
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const msg = event.message || '';
      if (
        typeof msg === 'string' &&
        (msg.includes('ResizeObserver loop limit exceeded') ||
         msg.includes('ResizeObserver loop completed with undelivered notifications'))
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true // Use capture phase to intercept before other listeners (like react-error-overlay)
  );

  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (
      typeof message === 'string' &&
      (message.includes('ResizeObserver loop limit exceeded') ||
       message.includes('ResizeObserver loop completed with undelivered notifications'))
    ) {
      return true; // Suppress error
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };
}

export {};
