(function (global) {
  const shared = {};

  const GEORGIA_TIME_ZONE = 'Asia/Tbilisi';
  const ISO_NO_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;
  const ISO_WITH_SPACE_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;
  let tbilisiDateTimeFormatter = null;

  function getTbilisiDateTimeFormatter() {
    if (!tbilisiDateTimeFormatter) {
      tbilisiDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: GEORGIA_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    return tbilisiDateTimeFormatter;
  }

  function normalizeIsoString(value) {
    if (!(typeof value === 'string')) return value;
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (trimmed.endsWith('Z')) return trimmed;
    if (/[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed;
    if (ISO_NO_TZ_REGEX.test(trimmed)) return `${trimmed}Z`;
    if (ISO_WITH_SPACE_REGEX.test(trimmed)) return `${trimmed.replace(' ', 'T')}Z`;
    return trimmed;
  }

  function parseUtcDate(input) {
    if (!input) return null;
    if (input instanceof Date) {
      return Number.isNaN(input.getTime()) ? null : input;
    }
    const normalized = normalizeIsoString(String(input));
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

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
    if (!iso) return '';
    try {
      const date = parseUtcDate(iso);
      if (!date) return String(iso || '');
      const formatter = getTbilisiDateTimeFormatter();
      const parts = formatter.formatToParts(date);
      const mapped = parts.reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
      }, {});
      const day = mapped.day || '00';
      const month = mapped.month || '00';
      const year = mapped.year || '0000';
      const hour = mapped.hour || '00';
      const minute = mapped.minute || '00';
      return `${day}-${month}-${year} ${hour}:${minute}`;
    } catch {
      return String(iso || '');
    }
  };

  shared.formatDuration = function formatDuration(startIso, endIso) {
    if (!startIso || !endIso) return '—';
    try {
      const start = parseUtcDate(startIso);
      const end = parseUtcDate(endIso);
      if (!start || !end || end <= start) return '—';
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


