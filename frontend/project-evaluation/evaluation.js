document.addEventListener('DOMContentLoaded', () => {
  const qs = (selector) => document.querySelector(selector);
  
  const API_BASE = (window.APP_CONFIG && typeof window.APP_CONFIG.API_BASE === 'string')
    ? window.APP_CONFIG.API_BASE
    : 'http://127.0.0.1:8000';

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getActorHeaders() {
    const user = getCurrentUser();
    const email = user?.email || '';
    return email ? { 'x-actor-email': email } : {};
  }

  const DOM = {
    cameraSlot: qs('.camera-slot'),
    userInfo: qs('.pe-lb-1'),
    rightDateTime: qs('#rightDateTime'),
    projectCode: qs('.pe-lb-3'),
    centerContent: qs('.pe-center-content'),
    rightMid: qs('.pe-right-mid'),
    startBtn: qs('.btn.primary'),
    finishBtn: qs('.btn.finish'),
  };

  const state = {
    cameraStream: null,
    cameraVideo: null,
    cameraDevices: [],
    cameraDeviceId: null,
    cameraDeviceLabel: '',
    project: null,
    selectedAnswerId: null,
    started: false,
    finished: false,
  };

  function showCameraMessage(message) {
    if (!DOM.cameraSlot) return;
    DOM.cameraSlot.innerHTML = '';

    const placeholder = document.createElement('div');
    placeholder.className = 'camera-placeholder';
    placeholder.style.display = 'flex';
    placeholder.style.flexDirection = 'column';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.textAlign = 'center';
    placeholder.style.padding = '12px';
    placeholder.style.height = '100%';
    placeholder.style.color = '#1d2744';
    placeholder.style.fontWeight = '600';
    placeholder.style.fontSize = '14px';
    placeholder.style.lineHeight = '1.4';
    placeholder.style.background = 'rgba(29, 39, 68, 0.08)';
    placeholder.style.boxSizing = 'border-box';

    const text = document.createElement('div');
    text.textContent = String(message || '');
    placeholder.appendChild(text);

    DOM.cameraSlot.appendChild(placeholder);
  }

  function isStreamActive(stream) {
    if (!stream) return false;
    try {
      return stream.getTracks().some((track) => track.readyState === 'live');
    } catch {
      return false;
    }
  }

  function handleCameraStreamEnded() {
    stopCamera();
    startCamera({ force: true }).catch(() => {});
  }

  function monitorCameraStream(stream) {
    if (!stream) return;
    try {
      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', handleCameraStreamEnded, { once: true });
        track.addEventListener('mute', handleCameraStreamEnded, { once: true });
        track.addEventListener('inactive', handleCameraStreamEnded, { once: true });
      });
    } catch {}
  }

  async function refreshCameraDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return state.cameraDevices;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      state.cameraDevices = devices.filter((device) => device.kind === 'videoinput');
    } catch (err) {
      console.debug('[evaluation] enumerateDevices failed', err);
    }
    return state.cameraDevices;
  }

  function getCameraLabelById(deviceId) {
    if (!deviceId) return '';
    const match = state.cameraDevices.find((device) => device.deviceId === deviceId);
    return match?.label || '';
  }

  function getCurrentCameraLabel() {
    return getCameraLabelById(state.cameraDeviceId) || state.cameraDeviceLabel || '';
  }

  function isLikelyVirtualCamera(device) {
    const label = String(device?.label || '').toLowerCase();
    const VIRTUAL_CAMERA_HINTS = [
      'virtual',
      'obs',
      'splitcam',
      'iriun',
      'droidcam',
      'epoccam',
      'manycam',
      'snap camera',
      'snapcamera',
      'camo',
      'webcam utility',
      'loopback',
      'avatar',
    ];
    return VIRTUAL_CAMERA_HINTS.some((hint) => label.includes(hint));
  }

  function buildCameraPreference(devices, requestedDeviceId) {
    const ordered = [];
    const add = (id) => {
      if (!id) return;
      if (!ordered.includes(id)) ordered.push(id);
    };

    if (requestedDeviceId) add(requestedDeviceId);
    if (state.cameraDeviceId) add(state.cameraDeviceId);

    devices.filter((device) => !isLikelyVirtualCamera(device)).forEach((device) => add(device.deviceId));
    devices.forEach((device) => add(device.deviceId));

    return ordered;
  }

  async function acquireCameraStream(deviceId) {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is not supported');
    }

    const baseConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    if (deviceId) {
      baseConstraints.video.deviceId = { exact: deviceId };
    } else {
      baseConstraints.video.facingMode = { ideal: 'user' };
    }

    try {
      return await mediaDevices.getUserMedia(baseConstraints);
    } catch (error) {
      if (error?.name === 'OverconstrainedError' || error?.name === 'ConstraintNotSatisfiedError' || error?.name === 'NotReadableError') {
        const relaxedConstraints = deviceId
          ? { video: { deviceId: { exact: deviceId } }, audio: true }
          : { video: true, audio: true };
        return await mediaDevices.getUserMedia(relaxedConstraints);
      }
      throw error;
    }
  }

  function getCameraErrorMessage(error) {
    if (!error) {
      return 'კამერა/მიკროფონი ვერ ჩაირთო. გთხოვთ შეამოწმოთ მოწყობილობა და ბრაუზერის უფლებები.';
    }
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'კამერისა და მიკროფონის ჩართვა მოითხოვს ნებართვას. გთხოვთ დაადასტუროთ მათი გამოყენება ბრაუზერის შეტყობინებაში.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'კამერა ვერ მოიძებნა. შეაერთეთ კამერა და სცადეთ თავიდან.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'კამერა უკვე გამოიყენება სხვა აპლიკაციაში. გათიშეთ სხვა პროგრამა და სცადეთ ხელახლა.';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'კამერა არ შეესაბამება მოთხოვნილ პარამეტრებს. სცადეთ სტანდარტული კამერის გამოყენება.';
      case 'SecurityError':
        return 'ბრაუზერმა დაბლოკა კამერის ჩართვა უსაფრთხოების მიზეზით. გთხოვთ გახსნათ გვერდი უსაფრთხო (https) კავშირით.';
      default:
        return 'კამერა/მიკროფონი ვერ ჩაირთო. გთხოვთ შეამოწმოთ მოწყობილობა და ბრაუზერის უფლებები.';
    }
  }

  function attachStreamToCameraSlot(stream) {
    if (!DOM.cameraSlot) return;
    DOM.cameraSlot.innerHTML = '';
    if (!state.cameraVideo) {
      state.cameraVideo = document.createElement('video');
      state.cameraVideo.setAttribute('playsinline', '');
      state.cameraVideo.autoplay = true;
      state.cameraVideo.muted = true;
      state.cameraVideo.controls = false;
      state.cameraVideo.style.width = '100%';
      state.cameraVideo.style.height = '100%';
      state.cameraVideo.style.objectFit = 'contain';
      state.cameraVideo.style.display = 'block';
      state.cameraVideo.addEventListener('error', () => {
        stopCamera();
        startCamera({ force: true }).catch(() => {});
      });
    }
    if (!DOM.cameraSlot.contains(state.cameraVideo)) {
      DOM.cameraSlot.appendChild(state.cameraVideo);
    }
    try {
      state.cameraVideo.srcObject = stream;
      const playPromise = state.cameraVideo.play?.();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
    } catch (err) {
      console.debug('[evaluation] camera play failed', err);
    }
  }

  let cameraStartPromise = null;

  async function startCamera({ force = false, requestedDeviceId = null } = {}) {
    if (!DOM.cameraSlot) return null;

    if (state.cameraStream) {
      if (!force && isStreamActive(state.cameraStream)) {
        attachStreamToCameraSlot(state.cameraStream);
        return state.cameraStream;
      }
      stopCamera();
    }

    if (cameraStartPromise) return cameraStartPromise;

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      showCameraMessage('თქვენი ბრაუზერი არ უჭერს მხარს კამერის ჩართვას.');
      return null;
    }

    const hostname = window.location?.hostname || '';
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname);

    await refreshCameraDevices().catch(() => []);

    if (window.isSecureContext === false && !isLocalHost) {
      showCameraMessage('კამერის გამოსაყენებლად გახსენით გვერდი უსაფრთხო (https) კავშირით ან localhost-იდან.');
      return null;
    }

    const preferredIds = buildCameraPreference(state.cameraDevices, requestedDeviceId);

    showCameraMessage('კამერის ჩართვა მიმდინარეობს...');

    cameraStartPromise = (async () => {
      let lastError = null;
      const queue = [...preferredIds, null].filter((value, index, arr) => arr.indexOf(value) === index);
      for (const deviceId of queue) {
        try {
          const stream = await acquireCameraStream(deviceId);
          if (!stream) continue;

          const tracks = typeof stream.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
          const track = tracks[0];
          if (!track) {
            try { stream.getTracks().forEach((t) => t.stop()); } catch {}
            continue;
          }
          const settings = track.getSettings ? track.getSettings() : null;
          const actualDeviceId = settings?.deviceId || deviceId || null;
          const trackLabel = track.label || '';

          state.cameraStream = stream;
          monitorCameraStream(stream);
          attachStreamToCameraSlot(stream);
          await refreshCameraDevices().catch(() => []);

          let effectiveDeviceId = actualDeviceId;
          if (!effectiveDeviceId && trackLabel) {
            const matched = state.cameraDevices.find((device) => device.label === trackLabel);
            if (matched?.deviceId) {
              effectiveDeviceId = matched.deviceId;
            }
          }
          state.cameraDeviceId = effectiveDeviceId;
          state.cameraDeviceLabel = trackLabel || getCameraLabelById(effectiveDeviceId) || state.cameraDeviceLabel;
          return stream;
        } catch (error) {
          lastError = error;
          console.debug('[evaluation] camera start failed for device', deviceId, error);
        }
      }

      throw lastError || new Error('კამერა ვერ ჩაირთო');
    })();

    try {
      return await cameraStartPromise;
    } catch (err) {
      showCameraMessage(getCameraErrorMessage(err));
      return null;
    } finally {
      cameraStartPromise = null;
    }
  }

  function stopCamera() {
    if (state.cameraStream) {
      try {
        state.cameraStream.getTracks().forEach((track) => {
          try { track.stop(); } catch {}
        });
      } catch {}
    }
    state.cameraStream = null;
    if (state.cameraVideo) {
      try { state.cameraVideo.srcObject = null; } catch {}
      if (state.cameraVideo.parentElement) {
        state.cameraVideo.parentElement.removeChild(state.cameraVideo);
      }
    }
    if (DOM.cameraSlot) {
      DOM.cameraSlot.innerHTML = '';
    }
  }

  function updateUserInfo() {
    if (!DOM.userInfo) return;
    const user = getCurrentUser();
    if (user?.firstName && user?.lastName && user?.code) {
      DOM.userInfo.textContent = `${user.firstName} ${user.lastName} — ${user.code}`;
    } else {
      DOM.userInfo.textContent = '';
    }
  }

  function getProjectCodeFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') || params.get('projectCode') || '';
  }

  async function loadProject(code) {
    if (!code) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/public/multi-apartment/projects/${encodeURIComponent(code)}`, {
        headers: { 'Cache-Control': 'no-cache', ...getActorHeaders() },
      });
      if (!response.ok) {
        if (response.status === 404) {
          showError('პროექტი ვერ მოიძებნა');
        } else {
          showError('პროექტის ჩატვირთვა ვერ მოხერხდა');
        }
        return;
      }
      const project = await response.json();
      state.project = project;
      renderProject();
    } catch (err) {
      console.error('Failed to load project', err);
      showError('პროექტის ჩატვირთვა ვერ მოხერხდა');
    }
  }

  function showError(message) {
    if (DOM.centerContent) {
      DOM.centerContent.innerHTML = `<div style="padding: 20px; text-align: center; color: #d32f2f;">${message}</div>`;
    }
  }

  function renderProject() {
    if (!state.project) return;

    // Update project code display
    if (DOM.projectCode) {
      DOM.projectCode.textContent = `პროექტის კოდი - ${state.project.code}`;
    }

    // Render PDF in center
    if (DOM.centerContent && state.project.pdfUrl) {
      const pdfUrl = state.project.pdfUrl.startsWith('http')
        ? state.project.pdfUrl
        : `${API_BASE}${state.project.pdfUrl}`;
      DOM.centerContent.innerHTML = `
        <iframe 
          src="${pdfUrl}" 
          style="width: 100%; height: 100%; border: none;"
          title="პროექტის PDF"
        ></iframe>
      `;
    } else if (DOM.centerContent) {
      DOM.centerContent.innerHTML = '<div style="padding: 20px; text-align: center;">PDF ფაილი არ არის ხელმისაწვდომი</div>';
    }

    // Render answers in right column
    if (DOM.rightMid && Array.isArray(state.project.answers)) {
      const answersHtml = state.project.answers.map((answer, index) => `
        <div class="answer-option" data-answer-id="${answer.id}" style="
          padding: 10px;
          margin: 5px 0;
          border: 2px solid #ccc;
          border-radius: 4px;
          cursor: pointer;
          background: ${state.selectedAnswerId === String(answer.id) ? '#e3f2fd' : '#fff'};
        ">
          <strong>${index + 1}.</strong> ${escapeHtml(answer.text)}
        </div>
      `).join('');
      DOM.rightMid.innerHTML = `
        <div style="padding: 10px;">
          <h3 style="margin-top: 0;">პასუხები:</h3>
          ${answersHtml}
        </div>
      `;

      // Add click handlers
      DOM.rightMid.querySelectorAll('.answer-option').forEach((el) => {
        el.addEventListener('click', () => {
          const answerId = el.dataset.answerId;
          if (answerId) {
            state.selectedAnswerId = answerId;
            renderProject();
          }
        });
      });
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function submitEvaluation() {
    if (!state.project || !state.selectedAnswerId) {
      alert('გთხოვთ აირჩიოთ პასუხი');
      return;
    }

    if (state.finished) {
      alert('შეფასება უკვე გაგზავნილია');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/public/multi-apartment/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getActorHeaders(),
        },
        body: JSON.stringify({
          projectCode: state.project.code,
          selectedAnswerId: parseInt(state.selectedAnswerId, 10),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Evaluation submission failed', errorText);
        alert('შეფასების გაგზავნა ვერ მოხერხდა');
        return;
      }

      state.finished = true;
      if (DOM.finishBtn) {
        DOM.finishBtn.disabled = true;
        DOM.finishBtn.textContent = 'გაგზავნილია';
      }
      alert('შეფასება წარმატებით გაიგზავნა');
    } catch (err) {
      console.error('Failed to submit evaluation', err);
      alert('შეფასების გაგზავნა ვერ მოხერხდა');
    }
  }

  const pad2 = (value) => String(value).padStart(2, '0');
  const formatDate = (date) => {
    const day = pad2(date.getDate());
    const month = pad2(date.getMonth() + 1);
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };
  const formatTime = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  function updateRightDateTime() {
    if (!DOM.rightDateTime) return;
    const now = new Date();
    DOM.rightDateTime.innerHTML = `<span>${formatDate(now)}</span><span>${formatTime(now)}</span>`;
  }

  // Initialize camera on page load
  async function initialize() {
    updateUserInfo();
    updateRightDateTime();
    setInterval(updateRightDateTime, 30 * 1000);
    showCameraMessage('კამერის ჩართვა მიმდინარეობს...');
    
    try {
      await startCamera();
    } catch (err) {
      console.debug('[evaluation] camera initialization failed', err);
    }

    // Handle device changes
    const handleDeviceChange = async () => {
      await refreshCameraDevices().catch(() => []);
      if (isStreamActive(state.cameraStream)) return;
      startCamera({ force: true }).catch(() => {});
    };
    
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    } else if (navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = handleDeviceChange;
    }

    // Load project
    const projectCode = getProjectCodeFromURL();
    if (projectCode) {
      await loadProject(projectCode);
    }

    // Button handlers
    if (DOM.startBtn) {
      DOM.startBtn.addEventListener('click', () => {
        state.started = true;
        if (DOM.startBtn) DOM.startBtn.disabled = true;
        if (DOM.finishBtn) DOM.finishBtn.disabled = false;
      });
    }

    if (DOM.finishBtn) {
      DOM.finishBtn.disabled = true;
      DOM.finishBtn.addEventListener('click', () => {
        void submitEvaluation();
      });
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      stopCamera();
    });
  }

  initialize();
});

