// src/context/ToastContext.jsx  (ADMIN PROJECT — drop-in replacement)
// Fix: toast object was recreated every render, causing useCallback deps to
// fire infinitely. Now the toast API is stable via useRef + useCallback.

import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message, type = 'success') => {
    // Deduplicate: if an identical message is already visible, skip
    setToasts(prev => {
      const alreadyVisible = prev.some(t => t.message === message && t.type === type);
      if (alreadyVisible) return prev;

      const id = ++counterRef.current;
      setTimeout(() => {
        setToasts(p => p.filter(t => t.id !== id));
      }, 4000);

      return [...prev.slice(-3), { id, message, type }]; // max 4 at a time
    });
  }, []); // stable — no deps change

  // Stable toast API object — wrapped in useRef so the reference never changes
  const toastRef = useRef({
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
  });

  // Keep the functions up to date without changing the object reference
  toastRef.current.success = (msg) => addToast(msg, 'success');
  toastRef.current.error   = (msg) => addToast(msg, 'error');
  toastRef.current.warning = (msg) => addToast(msg, 'warning');

  return (
    <ToastContext.Provider value={toastRef.current}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>
              {t.type === 'success' && '✓'}
              {t.type === 'error'   && '✕'}
              {t.type === 'warning' && '!'}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
