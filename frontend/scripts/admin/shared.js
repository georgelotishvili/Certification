(function (global) {
  const shared = {};

  shared.arrayBufferToBase64 = function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return global.btoa(binary);
  };

  shared.loadExternalScript = function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
        } else {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', (error) => reject(error), { once: true });
        }
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.dynamicSrc = src;
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', (error) => reject(error), { once: true });
      document.head.appendChild(script);
    });
  };

  shared.escapeHtml = function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  function getToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  shared.showToast = function showToast(message, type = 'success') {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' error' : ''}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = String(message || '');
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 220);
    }, 2600);
  };

  shared.formatDateTime = function formatDateTime(iso) {
    try {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return String(iso || '');
      const pad = (value) => String(value).padStart(2, '0');
      return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } catch {
      return String(iso || '');
    }
  };

  shared.formatDuration = function formatDuration(startIso, endIso) {
    if (!startIso || !endIso) return '—';
    try {
      const start = new Date(startIso);
      const end = new Date(endIso);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return '—';
      const diffMs = end.getTime() - start.getTime();
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const parts = [];
      if (hours) parts.push(`${hours}სთ`);
      if (minutes || hours) parts.push(`${minutes}წთ`);
      parts.push(`${seconds}წმ`);
      return parts.join(' ');
    } catch (err) {
      console.warn('Failed to format duration', err);
      return '—';
    }
  };

  shared.handleAdminErrorResponse = async function handleAdminErrorResponse(response, fallbackMessage, showToastFn = shared.showToast) {
    if (!response) {
      showToastFn(fallbackMessage, 'error');
      return;
    }
    if (response.status === 401) {
      showToastFn('ადმინის სესია არ არის ავტორიზებული', 'error');
      console.error('Admin API auth error', response.status);
      return;
    }
    let detail = '';
    try {
      const clone = response.clone();
      const data = await clone.json();
      detail = data?.detail || data?.message || '';
    } catch {
      try {
        const text = await response.clone().text();
        detail = (text || '').trim();
      } catch {}
    }
    console.error('Admin API error', response.status, detail || fallbackMessage);
    showToastFn(detail || fallbackMessage, 'error');
  };

  global.AdminShared = shared;
})(window);


