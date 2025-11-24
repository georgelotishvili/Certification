document.addEventListener('DOMContentLoaded', () => {
  preventZooming();

  const byId = (id) => document.getElementById(id);
  const qs = (selector) => document.querySelector(selector);
  const setHidden = (el, value) => { if (el) el.hidden = !!value; };
  const show = (el, display = 'block') => { if (el) el.style.display = display; };
  const hide = (el) => { if (el) el.style.display = 'none'; };
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const getAnswers = (question) => Array.isArray(question?.answers)
    ? question.answers
    : (Array.isArray(question?.options) ? question.options : []);

  const DOM = {
    root: document.documentElement,
    gateOverlay: byId('examGateOverlay'),
    gateForm: byId('examGateForm'),
    gateInput: byId('examPassword'),
    gateError: byId('examGateError'),
    gateClose: byId('examGateClose'),
    examStart: byId('examStart'),
    examFinish: byId('examFinish'),
    examConfirm: byId('examConfirm'),
    examFinal: byId('examFinal'),
    confirmOverlay: byId('confirmOverlay'),
    finalOverlay: byId('finalOverlay'),
    prestartOverlay: byId('prestartOverlay'),
    resultsOverlay: byId('resultsOverlay'),
    examResults: byId('examResults'),
    resultsList: byId('resultsList'),
    resultsClose: byId('resultsClose'),
    confirmLeaveYes: byId('confirmLeaveYes'),
    confirmLeaveNo: byId('confirmLeaveNo'),
    agreeExit: byId('agreeExit'),
    returnToExam: byId('returnToExam'),
    ctTitle: qs('.ct-section.ct-title'),
    countdownEl: byId('examCountdown'),
    rightDateTime: byId('rightDateTime'),
    cmHeader: qs('.cm-header'),
    cmContent: qs('.cm-content'),
    cmDotsWrap: qs('.cm-dots'),
    prevBtn: qs('.cm-nav.prev'),
    nextBtn: qs('.cm-nav.next'),
    qNumEl: qs('.question-number-num'),
    blockNumEl: qs('.block-number-num'),
    answerAllOverlay: byId('answerAllOverlay'),
    answerAllDialog: byId('answerAllDialog'),
    answerAllClose: byId('answerAllClose'),
    cameraSlot: qs('.camera-slot'),
  };

  const MEDIA_TYPES = {
    CAMERA: 'camera',
    SCREEN: 'screen',
  };
  const MEDIA_TYPE_LIST = Object.values(MEDIA_TYPES);

  function createMediaState() {
    return {
      recorder: null,
      chunkIndex: 0,
      uploadQueue: [],
      uploading: false,
      uploadTimer: null,
      stopRequested: false,
      recordingActive: false,
      uploadError: false,
      recordingStartedAt: null,
    };
  }

  function getMediaState(mediaType) {
    return state.mediaStates?.[mediaType];
  }

  if (DOM.examFinish) {
    try { DOM.examFinish.disabled = true; } catch {}
  }

  if (DOM.examStart) {
    try { DOM.examStart.disabled = true; } catch {}
  }

  const state = {
    sessionId: null,
    sessionToken: null,
    serverEndsAtMs: null,
    examDurationMinutes: 60,
    isStartingSession: false,
    gatePassed: false,
    examStarted: false,
    mustStayFullscreen: false,
    blocks: [],
    selectedByBlock: [],
    flatQuestions: [],
    flatIndexByQuestionId: new Map(),
    answers: new Map(),
    currentFlatIndex: 0,
    currentBlockIndex: 0,
    pendingBlockTransition: null,
    trapFocusHandler: null,
    cameraStream: null,
    cameraVideo: null,
    cameraDevices: [],
    cameraDeviceId: null,
    cameraDeviceLabel: '',
    screenStream: null,
    mediaStates: {
      [MEDIA_TYPES.CAMERA]: createMediaState(),
      [MEDIA_TYPES.SCREEN]: createMediaState(),
    },
  };

  const timers = { countdown: null };
  let remainingMs = 0;
  let cameraStartPromise = null;
  let screenStartPromise = null;
  function showCameraMessage(message, options = {}) {
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
    placeholder.style.gap = '12px';

    const text = document.createElement('div');
    text.textContent = String(message || '');
    placeholder.appendChild(text);

    const labelText = options.currentLabel ?? getCurrentCameraLabel();
    if (labelText) {
      const label = document.createElement('div');
      label.textContent = `არჩევანი: ${labelText}`;
      label.style.fontSize = '12px';
      label.style.color = '#475569';
      label.style.fontWeight = '500';
      placeholder.appendChild(label);
    }

    if (options.retry) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'კამერის ხელახლა ჩართვა';
      btn.className = 'btn primary camera-retry-btn';
      btn.style.padding = '8px 14px';
      btn.style.fontSize = '13px';
      btn.addEventListener('click', () => {
        btn.disabled = true;
        showCameraMessage('კამერის ჩართვა მიმდინარეობს...', {
          allowSwitch: options.allowSwitch,
          currentLabel: options.currentLabel,
        });
        startCamera({ force: true }).finally(() => {
          btn.disabled = false;
        });
      });
      placeholder.appendChild(btn);
    }

    if (options.allowSwitch && (state.cameraDevices?.length || 0) > 1) {
      const switchBtn = document.createElement('button');
      switchBtn.type = 'button';
      switchBtn.textContent = 'კამერის გადართვა';
      switchBtn.className = 'btn camera-switch-btn';
      switchBtn.style.padding = '8px 14px';
      switchBtn.style.fontSize = '13px';
      switchBtn.addEventListener('click', () => {
        switchBtn.disabled = true;
        switchToNextCamera().finally(() => {
          switchBtn.disabled = false;
        });
      });
      placeholder.appendChild(switchBtn);
    }

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
    if (!state.examStarted && !state.gatePassed) return;
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
      dlog('enumerateDevices failed', err);
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
      state.cameraVideo.addEventListener('error', () => {
        if (state.examStarted || state.gatePassed) {
          stopCamera();
          startCamera({ force: true }).catch(() => {});
        }
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
      dlog('camera play failed', err);
    }
  }

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
      showCameraMessage('კამერის გამოსაყენებლად გახსენით გვერდი უსაფრთხო (https) კავშირით ან localhost-იდან.', {
        retry: true,
        allowSwitch: (state.cameraDevices.length || 0) > 1,
      });
      return null;
    }

    const preferredIds = buildCameraPreference(state.cameraDevices, requestedDeviceId);
    const allowSwitch = (state.cameraDevices.length || 0) > 1;
    const currentLabel = requestedDeviceId
      ? getCameraLabelById(requestedDeviceId)
      : getCurrentCameraLabel();

    showCameraMessage('კამერის ჩართვა მიმდინარეობს...', {
      allowSwitch,
      currentLabel,
    });

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
          dlog('camera start failed for device', deviceId, error);
        }
      }

      throw lastError || new Error('კამერა ვერ ჩაირთო');
    })();

    try {
      return await cameraStartPromise;
    } catch (err) {
      showCameraMessage(getCameraErrorMessage(err), {
        retry: true,
        allowSwitch: (state.cameraDevices.length || 0) > 1,
        currentLabel: getCurrentCameraLabel(),
      });
      return null;
    } finally {
      cameraStartPromise = null;
    }
  }

  async function switchToNextCamera() {
    await refreshCameraDevices().catch(() => []);
    const devices = state.cameraDevices;
    if (!devices.length) {
      showCameraMessage('კამერა ვერ მოიძებნა. გთხოვთ შეაერთოთ კამერა და სცადოთ ხელახლა.', { retry: true });
      return null;
    }

    const ids = devices.map((device) => device.deviceId).filter((id) => !!id);
    if (!ids.length) {
      showCameraMessage('კამერა ვერ მოიძებნა. გთხოვთ შეაერთოთ კამერა და სცადოთ ხელახლა.', { retry: true });
      return null;
    }

    const currentIndex = state.cameraDeviceId ? ids.indexOf(state.cameraDeviceId) : -1;
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % ids.length : 0;
    const nextDeviceId = ids[nextIndex];

    return startCamera({ force: true, requestedDeviceId: nextDeviceId });
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

  function handleScreenStreamEnded() {
    if (!state.examStarted && !state.gatePassed) return;
    stopScreenCapture();
    alert('ეკრანის გაზიარება შეწყდა. გამოცდის გაგრძელებისთვის აუცილებელია ეკრანის გაზიარების ხელახლა ჩართვა.');
    startScreenCapture({ force: true })
      .then((stream) => {
        if (stream && state.examStarted) {
          void startMediaRecording(MEDIA_TYPES.SCREEN, stream);
        }
      })
      .catch((error) => {
        dlog('screen capture restart failed', error);
      });
  }

  function monitorScreenStream(stream) {
    if (!stream) return;
    try {
      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', handleScreenStreamEnded, { once: true });
        track.addEventListener('inactive', handleScreenStreamEnded, { once: true });
      });
    } catch {}
  }

  async function startScreenCapture({ force = false } = {}) {
    const getDisplayMedia = navigator.mediaDevices?.getDisplayMedia;
    if (typeof getDisplayMedia !== 'function') {
      alert('თქვენი ბრაუზერი არ უჭერს მხარს ეკრანის გაზიარებას.');
      return null;
    }

    if (state.screenStream) {
      if (!force && isStreamActive(state.screenStream)) {
        return state.screenStream;
      }
      stopScreenCapture();
    }

    if (screenStartPromise) return screenStartPromise;

    screenStartPromise = (async () => {
      const constraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };
      const stream = await getDisplayMedia.call(navigator.mediaDevices, constraints);
      state.screenStream = stream;
      monitorScreenStream(stream);
      return stream;
    })();

    try {
      return await screenStartPromise;
    } finally {
      screenStartPromise = null;
    }
  }

  function stopScreenCapture() {
    if (state.screenStream) {
      try {
        state.screenStream.getTracks().forEach((track) => {
          try { track.stop(); } catch {}
        });
      } catch {}
    }
    state.screenStream = null;
  }

  function isMediaRecorderSupported() {
    return typeof window.MediaRecorder === 'function';
  }

  function getPreferredMimeType() {
    if (!isMediaRecorderSupported()) return '';
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    for (const candidate of candidates) {
      try {
        if (!candidate) continue;
        if (!window.MediaRecorder.isTypeSupported || window.MediaRecorder.isTypeSupported(candidate)) {
          return candidate;
        }
      } catch {
        continue;
      }
    }
    return '';
  }

  function handleRecorderData(mediaType, event) {
    if (!event?.data || !event.data.size) return;
    const mediaState = getMediaState(mediaType);
    if (!mediaState) return;
    const isRecorderInactive = !mediaState.recorder || mediaState.recorder.state === 'inactive';
    const item = {
      index: mediaState.chunkIndex,
      blob: event.data,
      isLast: mediaState.stopRequested && isRecorderInactive,
      retries: 0,
    };
    mediaState.chunkIndex += 1;
    mediaState.uploadQueue.push(item);
    void processMediaUploadQueue(mediaType);
  }

  function handleRecorderStop(mediaType) {
    const mediaState = getMediaState(mediaType);
    if (!mediaState) return;
    mediaState.recordingActive = false;
    mediaState.recorder = null;
    mediaState.stopRequested = false;
    void processMediaUploadQueue(mediaType);
  }

  function handleRecorderError(mediaType, event) {
    const mediaState = getMediaState(mediaType);
    if (!mediaState) return;
    mediaState.uploadError = true;
    dlog(`${mediaType} recorder error`, event?.error || event);
    try {
      if (mediaState.recorder && mediaState.recorder.state !== 'inactive') {
        mediaState.recorder.stop();
      }
    } catch {}
  }

  async function startMediaRecording(mediaType, stream) {
    if (!isMediaRecorderSupported()) {
      dlog('MediaRecorder unsupported in this browser');
      return;
    }
    if (!stream) return;

    const mediaState = getMediaState(mediaType);
    if (!mediaState) return;
    if (mediaState.recorder && mediaState.recorder.state === 'recording') return;

    const hasAudioTrack = typeof stream.getAudioTracks === 'function'
      ? stream.getAudioTracks().some((track) => track.kind === 'audio')
      : false;
    if (!hasAudioTrack && mediaType === MEDIA_TYPES.CAMERA) {
      dlog('No audio track available on camera stream');
    }

    const mimeType = getPreferredMimeType();
    let recorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (error) {
      dlog(`${mediaType} MediaRecorder init failed`, error);
      return;
    }

    mediaState.recorder = recorder;
    mediaState.chunkIndex = 0;
    mediaState.uploadQueue = [];
    mediaState.uploading = false;
    mediaState.uploadError = false;
    mediaState.recordingActive = true;
    mediaState.recordingStartedAt = Date.now();
    mediaState.stopRequested = false;
    if (mediaState.uploadTimer) {
      clearTimeout(mediaState.uploadTimer);
      mediaState.uploadTimer = null;
    }

    recorder.addEventListener('dataavailable', (event) => handleRecorderData(mediaType, event));
    recorder.addEventListener('stop', () => handleRecorderStop(mediaType));
    recorder.addEventListener('error', (event) => handleRecorderError(mediaType, event));

    try {
      recorder.start(MEDIA_TIMESLICE_MS);
      dlog('MediaRecorder started', { mediaType, mimeType });
    } catch (error) {
      dlog(`${mediaType} MediaRecorder start failed`, error);
      mediaState.recordingActive = false;
    }
  }

  async function processMediaUploadQueue(mediaType) {
    const mediaState = getMediaState(mediaType);
    if (!mediaState) return;
    if (mediaState.uploading) return;
    if (!mediaState.uploadQueue.length) return;
    if (!state.sessionId || !state.sessionToken) {
      if (!mediaState.uploadTimer) {
        mediaState.uploadTimer = setTimeout(() => {
          mediaState.uploadTimer = null;
          void processMediaUploadQueue(mediaType);
        }, 1000);
      }
      return;
    }

    const item = mediaState.uploadQueue[0];
    if (!item || !item.blob) {
      mediaState.uploadQueue.shift();
      void processMediaUploadQueue(mediaType);
      return;
    }

    const formData = new FormData();
    formData.append('chunk_index', String(item.index));
    formData.append('is_last', item.isLast ? 'true' : 'false');
    const durationMs = mediaState.recordingStartedAt ? Math.max(Date.now() - mediaState.recordingStartedAt, 0) : 0;
    formData.append('duration_ms', String(durationMs));
    formData.append('chunk', item.blob, `chunk-${item.index}.webm`);
    formData.append('media_type', mediaType);

    const headers = { ...authHeaders() };
    mediaState.uploading = true;
    try {
      const response = await fetch(`${API_BASE}/exam/${state.sessionId}/media`, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`upload failed: ${response.status}`);
      }
      const payload = await response.json().catch(() => ({}));
      mediaState.uploadQueue.shift();
      item.blob = null;
      if (typeof payload?.next_chunk_index === 'number') {
        mediaState.chunkIndex = payload.next_chunk_index;
      }
      if (mediaState.uploadTimer) {
        clearTimeout(mediaState.uploadTimer);
        mediaState.uploadTimer = null;
      }
    } catch (error) {
      dlog(`${mediaType} media chunk upload error`, error);
      item.retries = (item.retries || 0) + 1;
      if (item.retries > MEDIA_UPLOAD_MAX_RETRIES) {
        mediaState.uploadError = true;
        mediaState.uploading = false;
        return;
      }
      mediaState.uploading = false;
      const delay = MEDIA_UPLOAD_RETRY_DELAY * item.retries;
      if (mediaState.uploadTimer) {
        clearTimeout(mediaState.uploadTimer);
      }
      mediaState.uploadTimer = setTimeout(() => {
        mediaState.uploadTimer = null;
        void processMediaUploadQueue(mediaType);
      }, delay);
      return;
    }
    mediaState.uploading = false;
    void processMediaUploadQueue(mediaType);
  }

  async function stopRecorder(mediaType) {
    const mediaState = getMediaState(mediaType);
    if (!mediaState?.recorder) return;
    if (mediaState.recorder.state === 'inactive') return;
    mediaState.stopRequested = true;
    await new Promise((resolve) => {
      const handleStop = () => {
        mediaState.recorder?.removeEventListener('stop', handleStop);
        resolve();
      };
      mediaState.recorder.addEventListener('stop', handleStop, { once: true });
      try {
        mediaState.recorder.stop();
      } catch {
        resolve();
      }
    });
  }

  async function finalizeRecording(opts = {}) {
    const waitForUploads = !!opts.waitForUploads;
    await Promise.all(MEDIA_TYPE_LIST.map((type) => stopRecorder(type)));
    if (waitForUploads) {
      const started = Date.now();
      const shouldWait = () => MEDIA_TYPE_LIST.some((type) => {
        const mediaState = getMediaState(type);
        if (!mediaState) return false;
        return (mediaState.uploadQueue.length || mediaState.uploading);
      });
      while (shouldWait() && Date.now() - started < MEDIA_UPLOAD_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }


  const API_BASE = (window.APP_CONFIG && typeof window.APP_CONFIG.API_BASE === 'string')
    ? window.APP_CONFIG.API_BASE
    : 'http://127.0.0.1:8000';
  const EXAM_ID = 1;
  const DEFAULT_TITLE_TEXT = '';
  const KEYBOARD_LOCKS = ['Escape', 'F11', 'F4'];
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
  const MEDIA_TIMESLICE_MS = 60 * 1000;
  const MEDIA_UPLOAD_MAX_RETRIES = 5;
  const MEDIA_UPLOAD_RETRY_DELAY = 3 * 1000;
  const MEDIA_UPLOAD_WAIT_MS = 30 * 1000;
  const getPercentColorClass = (percent) => {
    if (percent < 70) return 'pct-red';
    if (percent <= 75) return 'pct-yellow';
    return 'pct-green';
  };

  const dlog = (...args) => {
    try { console.debug('[exam]', ...args); } catch {}
  };

  const authHeaders = () => (state.sessionToken ? { 'Authorization': `Bearer ${state.sessionToken}` } : {});
  const asJson = (method, body, extra = {}) => ({
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(extra.headers || {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const getOpts = (extra = {}) => ({
    method: 'GET',
    headers: { ...authHeaders(), ...(extra.headers || {}) },
  });

  async function beginSession() {
    if (state.isStartingSession || (state.sessionId && state.sessionToken)) return;
    state.isStartingSession = true;
    try {
      const user = getCurrentUser() || {};
      const resp = await apiStartSession(user.firstName, user.lastName, user.code);
      state.sessionId = resp.session_id;
      state.sessionToken = resp.token;
      state.serverEndsAtMs = resp.ends_at ? new Date(resp.ends_at).getTime() : null;
      if (typeof resp.duration_minutes === 'number') {
        state.examDurationMinutes = resp.duration_minutes;
      }
      updateUserHeader();
      dlog('session started', { sessionId: state.sessionId, hasToken: !!state.sessionToken });
    } catch (err) {
      dlog('session start failed', err);
    } finally {
      state.isStartingSession = false;
      if (DOM.examStart && !state.examStarted) {
        try { DOM.examStart.disabled = false; DOM.examStart.focus(); } catch {}
      }
    }
  }

  async function apiGetConfig(examId) {
    dlog('GET config');
    const res = await fetch(`${API_BASE}/exam/${examId}/config`, getOpts());
    if (!res.ok) throw new Error('კონფიგი ვერ ჩაიტვირთა');
    const json = await res.json();
    dlog('config ok', json);
    return json;
  }

  async function apiStartSession(firstName, lastName, code) {
    const res = await fetch(`${API_BASE}/exam/session/start`, asJson('POST', {
      exam_id: EXAM_ID,
      candidate_first_name: String(firstName || ''),
      candidate_last_name: String(lastName || ''),
      candidate_code: String(code || ''),
    }));
    if (!res.ok) throw new Error('სესია ვერ დაიწყო');
    return await res.json();
  }

  async function apiGetBlockQuestions(blockId) {
    if (!state.sessionId) throw new Error('სესია არ არის');
    dlog('GET questions', { sessionId: state.sessionId, hasToken: !!state.sessionToken, blockId });
    const res = await fetch(`${API_BASE}/exam/${state.sessionId}/questions?block_id=${encodeURIComponent(blockId)}`, getOpts());
    if (!res.ok) throw new Error('კითხვები ვერ ჩაიტვირთა');
    const json = await res.json();
    dlog('questions ok', json);
    return json;
  }

  async function apiAnswer(questionId, optionId) {
    if (!state.sessionId) throw new Error('სესია არ არის');
    const res = await fetch(`${API_BASE}/exam/${state.sessionId}/answer`, asJson('POST', {
      question_id: Number(questionId),
      option_id: Number(optionId),
    }));
    if (!res.ok) throw new Error('პასუხი ვერ შეინახა');
    return await res.json();
  }

  async function apiFinish() {
    if (!state.sessionId) return;
    try { await fetch(`${API_BASE}/exam/${state.sessionId}/finish`, asJson('POST', {})); } catch {}
  }

  async function verifyGatePassword(password) {
    try {
      const response = await fetch(`${API_BASE}/exam/gate/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_id: EXAM_ID, password }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      return !!data?.valid;
    } catch {
      return false;
    }
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function updateUserHeader() {
    if (!DOM.ctTitle) return;
    const user = getCurrentUser();
    if (user?.firstName && user?.lastName && user?.code) {
      DOM.ctTitle.textContent = `${user.firstName} ${user.lastName} — ${user.code}`;
    } else {
      DOM.ctTitle.textContent = DEFAULT_TITLE_TEXT;
    }
  }

  const pad2 = (value) => String(value).padStart(2, '0');
  const formatDate = (date) => `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
  const formatTime = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  function updateRightDateTime() {
    if (!DOM.rightDateTime) return;
    const now = new Date();
    DOM.rightDateTime.innerHTML = `<div class="rd-date">${formatDate(now)}</div><div class="rd-time">${formatTime(now)}</div>`;
  }

  const focusTrap = {
    enable() {
      if (state.trapFocusHandler) return;
      state.trapFocusHandler = (event) => {
        if (event.key !== 'Tab') return;
        const items = getVisibleFocusable();
        if (!items.length) return;
        event.preventDefault();
        const currentIndex = items.indexOf(document.activeElement);
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? items.length - 1 : currentIndex - 1)
          : (currentIndex === items.length - 1 ? 0 : currentIndex + 1);
        items[nextIndex].focus();
      };
      document.addEventListener('keydown', state.trapFocusHandler);
    },
    disable() {
      if (!state.trapFocusHandler) return;
      document.removeEventListener('keydown', state.trapFocusHandler);
      state.trapFocusHandler = null;
    },
  };

  async function lockKeys() {
    try { await navigator.keyboard?.lock?.(KEYBOARD_LOCKS); } catch {}
  }

  async function unlockKeys() {
    try { await navigator.keyboard?.unlock?.(); } catch {}
  }

  async function safeNavigateHome() {
    state.mustStayFullscreen = false;
    focusTrap.disable();
    unlockKeys();
    try {
      await finalizeRecording({ waitForUploads: true });
    } catch (err) {
      dlog('finalize recording failed', err);
    }
    stopCamera();
    stopScreenCapture();
    try {
      if (document.fullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document);
      }
    } catch {}
    window.location.href = 'index.html';
  }

  function getVisibleFocusable() {
    return Array.from(document.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null && !el.closest('[hidden]'));
  }

  function showStep1() {
    if (!DOM.examConfirm || !DOM.confirmOverlay) return;
    setHidden(DOM.examFinal, true);
    hide(DOM.finalOverlay);
    setHidden(DOM.examConfirm, false);
    show(DOM.confirmOverlay);
    DOM.confirmLeaveYes?.focus();
  }

  function showStep2() {
    if (!DOM.examFinal || !DOM.finalOverlay || !DOM.confirmOverlay) return;
    setHidden(DOM.examConfirm, true);
    hide(DOM.confirmOverlay);
    setHidden(DOM.examFinal, false);
    show(DOM.finalOverlay);
    DOM.agreeExit?.focus();
  }

  function hideAll() {
    setHidden(DOM.examConfirm, true);
    setHidden(DOM.examFinal, true);
    hide(DOM.confirmOverlay);
    hide(DOM.finalOverlay);
    DOM.examStart?.focus();
  }

  function enterFullscreen() {
    try {
      const request = DOM.root.requestFullscreen || DOM.root.webkitRequestFullscreen || DOM.root.msRequestFullscreen;
      if (request) {
        const result = request.call(DOM.root, { navigationUI: 'hide' });
        if (result?.then) {
          result.then(lockKeys).catch(() => {});
        } else {
          lockKeys();
        }
      } else {
        lockKeys();
      }
    } catch {}
  }

  function ensureFullscreen() {
    if (state.mustStayFullscreen && !document.fullscreenElement) {
      enterFullscreen();
    }
  }

  function exitFullscreen() {
    state.mustStayFullscreen = false;
    focusTrap.disable();
    unlockKeys();
    try {
      if (document.fullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document);
      }
    } catch {}
  }

  function resetAnswers() {
    state.answers = new Map();
  }

  function rebuildFlat({ resetPosition = false } = {}) {
    state.flatQuestions = [];
    state.flatIndexByQuestionId = new Map();

    state.selectedByBlock.forEach((questions, blockIndex) => {
      (questions || []).forEach((question, localIndex) => {
        if (!question) return;
        const entry = { blockIndex, localIndex, question };
        const key = String(question.id);
        state.flatIndexByQuestionId.set(key, state.flatQuestions.length);
        state.flatQuestions.push(entry);
      });
    });

    if (resetPosition || state.flatQuestions.length === 0) {
      state.currentFlatIndex = 0;
    } else if (state.currentFlatIndex >= state.flatQuestions.length) {
      state.currentFlatIndex = state.flatQuestions.length - 1;
    }

    const currentEntry = state.flatQuestions[state.currentFlatIndex];
    state.currentBlockIndex = currentEntry ? currentEntry.blockIndex : 0;
  }

  function getCurrentEntry() {
    return state.flatQuestions[state.currentFlatIndex] || null;
  }

  function setCurrentFlatIndex(nextIndex) {
    if (nextIndex < 0 || nextIndex >= state.flatQuestions.length) return;
    state.currentFlatIndex = nextIndex;
    const entry = state.flatQuestions[nextIndex];
    state.currentBlockIndex = entry ? entry.blockIndex : 0;
    renderExamView();
  }

  function renderHeader(entry) {
    if (!DOM.cmHeader) return;
    DOM.cmHeader.innerHTML = '';
    if (!entry) return;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = '1fr 1fr 1fr';

    const left = document.createElement('div');
    left.textContent = `ბლოკი ${entry.blockIndex + 1}`;
    left.style.justifySelf = 'start';

    const center = document.createElement('div');
    center.textContent = 'შეარჩიეთ და მონიშნეთ სწორი პასუხი';
    center.style.justifySelf = 'center';

    const right = document.createElement('div');
    right.textContent = entry.question?.code ? String(entry.question.code) : '';
    right.style.justifySelf = 'end';

    wrapper.append(left, center, right);
    DOM.cmHeader.appendChild(wrapper);
  }

  function renderQuestion() {
    if (!DOM.cmContent) return;
    DOM.cmContent.innerHTML = '';

    const entry = getCurrentEntry();
    renderHeader(entry);

    if (!entry) {
      if (state.examStarted) {
        DOM.cmContent.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;color:#7f1d1d;font-weight:700;">კითხვები ვერ ჩაიტვირთა</div>';
      }
      return;
    }

    const question = entry.question;
    const answers = getAnswers(question);
    const fragment = document.createDocumentFragment();

    const questionWrap = document.createElement('div');
    questionWrap.className = 'question';
    questionWrap.innerHTML = `<div class="question-text">${escapeHtml(question.text || '')}</div>`;
    fragment.appendChild(questionWrap);

    const classes = ['answerA', 'answerb', 'answerc', 'answerd'];
    const labels = ['A', 'B', 'C', 'D'];

    answers.slice(0, 4).forEach((answer, index) => {
      if (!answer) return;
      const answerId = String(answer.id);
      const row = document.createElement('div');
      row.className = `${classes[index] || 'answerA'} cm-answer`;
      row.dataset.answerId = answerId;
      row.innerHTML = `
        <div class="mark"><div class="bullet" data-answer-id="${answerId}"></div></div>
        <div class="code">${labels[index] || ''}</div>
        <div class="text">${escapeHtml(answer.text || '')}</div>
      `;
      fragment.appendChild(row);
    });

    DOM.cmContent.appendChild(fragment);
    applyAnswerStateStyles();
  }

  function renderDots() {
    if (!DOM.cmDotsWrap) return;
    DOM.cmDotsWrap.innerHTML = '';

    const blockIndex = state.currentBlockIndex;
    const questions = state.selectedByBlock[blockIndex] || [];
    if (!questions.length) return;

    const fragment = document.createDocumentFragment();

    questions.forEach((question) => {
      if (!question) return;
      const key = String(question.id);
      const dot = document.createElement('span');
      dot.className = 'cm-dot';
      dot.dataset.questionId = key;

      const flatIndex = state.flatIndexByQuestionId.get(key);
      if (flatIndex === state.currentFlatIndex) {
        dot.classList.add('active');
      }

      const answerState = state.answers.get(key);
      if (answerState) {
        if (answerState.correct) {
          dot.style.background = '#16a34a';
          dot.style.borderColor = '#15803d';
        } else {
          dot.style.background = '#dc2626';
          dot.style.borderColor = '#991b1b';
        }
      } else {
        dot.style.background = '';
        dot.style.borderColor = '';
      }

      fragment.appendChild(dot);
    });

    DOM.cmDotsWrap.appendChild(fragment);
  }

  function updateIndicators() {
    const totalQuestions = state.flatQuestions.length;
    const currentQuestionNumber = totalQuestions ? state.currentFlatIndex + 1 : 0;
    if (DOM.qNumEl) {
      DOM.qNumEl.textContent = `${currentQuestionNumber}/${totalQuestions}`;
    }

    const totalBlocks = state.blocks.length || 0;
    const currentBlockNumber = totalQuestions ? state.currentBlockIndex + 1 : 0;
    if (DOM.blockNumEl) {
      DOM.blockNumEl.textContent = `${currentBlockNumber}/${totalBlocks}`;
    }
  }

  function updateNavButtons() {
    if (DOM.prevBtn) {
      DOM.prevBtn.disabled = state.currentFlatIndex <= 0;
    }
    if (DOM.nextBtn) {
      DOM.nextBtn.disabled = state.flatQuestions.length === 0;
    }
  }

  function renderExamView() {
    renderQuestion();
    renderDots();
    updateIndicators();
    updateNavButtons();
  }

  function applyAnswerStateStyles() {
    if (!DOM.cmContent) return;
    const entry = getCurrentEntry();
    if (!entry) return;

    const key = String(entry.question?.id ?? '');
    const answerState = state.answers.get(key);
    const rows = Array.from(DOM.cmContent.querySelectorAll('.cm-answer'));
    if (!rows.length) return;

    if (!answerState) {
      rows.forEach((row) => {
        row.style.pointerEvents = '';
        const bullet = row.querySelector('.bullet');
        if (bullet) {
          bullet.style.background = '';
          bullet.style.borderColor = '';
        }
      });
      return;
    }

    rows.forEach((row) => {
      row.style.pointerEvents = 'none';
      const bullet = row.querySelector('.bullet');
      if (!bullet) return;
      bullet.style.background = '';
      bullet.style.borderColor = '';
      if (row.dataset.answerId === String(answerState.chosenAnswerId || '')) {
        const color = answerState.correct ? '#16a34a' : '#dc2626';
        bullet.style.background = color;
        bullet.style.borderColor = color;
      }
    });
  }

  async function selectAnswer(answerId) {
    if (!state.examStarted) return;
    const entry = getCurrentEntry();
    if (!entry) return;
    const key = String(entry.question?.id ?? '');
    if (!key || state.answers.has(key)) return;

    state.answers.set(key, { chosenAnswerId: String(answerId || ''), correct: false });
    applyAnswerStateStyles();
    renderDots();

    try {
      const response = await apiAnswer(entry.question.id, Number(answerId));
      const isCorrect = !!response?.correct;
      state.answers.set(key, { chosenAnswerId: String(answerId || ''), correct: isCorrect });
    } catch {
      const fallbackCorrect = String(entry.question?.correctAnswerId || '') === String(answerId || '');
      state.answers.set(key, { chosenAnswerId: String(answerId || ''), correct: fallbackCorrect });
    }

    applyAnswerStateStyles();
    renderDots();
  }

  function areAllQuestionsAnsweredInBlock(blockIndex) {
    const questions = state.selectedByBlock[blockIndex] || [];
    return questions.every((question) => {
      const key = String(question?.id ?? '');
      return !!state.answers.get(key);
    });
  }

  function gotoQuestionIndex(index) {
    if (index < 0 || index >= state.flatQuestions.length) return;
    const target = state.flatQuestions[index];
    if (!target) return;

    if (target.blockIndex !== state.currentBlockIndex && !areAllQuestionsAnsweredInBlock(state.currentBlockIndex)) {
      showAnswerAllDialog(target.blockIndex, index);
      return;
    }

    setCurrentFlatIndex(index);
  }

  function gotoPrevQuestion() {
    gotoQuestionIndex(state.currentFlatIndex - 1);
  }

  function gotoNextQuestion() {
    if (state.currentFlatIndex < state.flatQuestions.length - 1) {
      gotoQuestionIndex(state.currentFlatIndex + 1);
      return;
    }
    if (allQuestionsAnswered()) {
      showResults();
    }
  }

  function allQuestionsAnswered() {
    return state.flatQuestions.length > 0 && state.flatQuestions.every(({ question }) => {
      const key = String(question?.id ?? '');
      return !!state.answers.get(key);
    });
  }

  function showAnswerAllDialog(nextBlockIndex, nextFlatIndex) {
    if (!DOM.answerAllOverlay || !DOM.answerAllDialog) return;
    state.pendingBlockTransition = { nextBlockIndex, nextFlatIndex };
    show(DOM.answerAllOverlay);
    setHidden(DOM.answerAllDialog, false);
    ensureFullscreen();
    setTimeout(() => DOM.answerAllClose?.focus(), 150);
  }

  function hideAnswerAllDialog() {
    hide(DOM.answerAllOverlay);
    setHidden(DOM.answerAllDialog, true);
    state.pendingBlockTransition = null;
    setTimeout(() => ensureFullscreen(), 50);
  }

  function showResults() {
    try {
      void finalizeRecording({ waitForUploads: false });
      stopCountdown();
      void apiFinish();
      if (!DOM.resultsOverlay || !DOM.examResults || !DOM.resultsList) return;

      DOM.resultsList.innerHTML = '';
      const createResultRow = (labelText, correctCount, totalCount) => {
        const safeTotal = Number(totalCount) || 0;
        const percent = safeTotal > 0 ? Math.round((correctCount / safeTotal) * 100) : 0;

        const row = document.createElement('div');
        row.className = 'result-row';

        const label = document.createElement('div');
        label.className = 'result-label';
        label.textContent = labelText;

        const value = document.createElement('div');
        const colorClass = getPercentColorClass(percent);
        value.className = `result-value ${colorClass}`;
        value.textContent = `${correctCount}/${safeTotal} (${percent}%)`;

        row.append(label, value);
        return row;
      };

      const blockRows = [];
      let totalCorrect = 0;
      let totalQuestions = 0;

      state.selectedByBlock.forEach((questions, blockIndex) => {
        const items = Array.isArray(questions) ? questions : [];
        const total = items.length;
        let correctCount = 0;
        items.forEach((question) => {
          const key = String(question?.id ?? '');
          if (state.answers.get(key)?.correct) correctCount += 1;
        });

        totalCorrect += correctCount;
        totalQuestions += total;

        const row = createResultRow(`ბლოკი ${blockIndex + 1}`, correctCount, total);
        blockRows.push(row);
      });

      if (totalQuestions > 0 || blockRows.length) {
        const summaryRow = createResultRow('საერთო შედეგი', totalCorrect, totalQuestions);
        summaryRow.classList.add('result-row-total');
        DOM.resultsList.appendChild(summaryRow);
        blockRows.forEach((row) => DOM.resultsList.appendChild(row));
      } else {
        const emptyRow = document.createElement('div');
        emptyRow.className = 'result-empty';
        emptyRow.textContent = 'შედეგების საჩვენებლად მონაცემები არ არის';
        DOM.resultsList.appendChild(emptyRow);
      }

      show(DOM.resultsOverlay);
      setHidden(DOM.examResults, false);
    } catch {}
  }

  function hideResults() {
    hide(DOM.resultsOverlay);
    setHidden(DOM.examResults, true);
  }

  function readDurationMinutes() {
    const value = Number(state.examDurationMinutes || 0);
    return value > 0 ? value : 60;
  }

  function formatHMS(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  function updateCountdownView() {
    if (DOM.countdownEl) {
      DOM.countdownEl.textContent = formatHMS(remainingMs);
    }
  }

  function stopCountdown() {
    if (timers.countdown) {
      clearInterval(timers.countdown);
      timers.countdown = null;
    }
  }

  function startCountdown() {
    stopCountdown();
    if (state.serverEndsAtMs) {
      remainingMs = Math.max(0, state.serverEndsAtMs - Date.now());
    } else {
      remainingMs = readDurationMinutes() * 60 * 1000;
    }
    updateCountdownView();
    timers.countdown = setInterval(() => {
      remainingMs -= 1000;
      if (remainingMs <= 0) {
        remainingMs = 0;
        updateCountdownView();
        stopCountdown();
        showResults();
        return;
      }
      updateCountdownView();
    }, 1000);
  }

  async function initExamData() {
    if (!state.sessionId || !state.sessionToken) {
      return;
    }

    try {
      const config = await apiGetConfig(EXAM_ID);
      state.blocks = Array.isArray(config?.blocks) ? config.blocks : [];
      const cfgDuration = Number(config?.duration_minutes || config?.durationMinutes || 0);
      if (cfgDuration > 0) state.examDurationMinutes = cfgDuration;
    } catch (err) {
      console.error('Failed to load exam config:', err);
      state.blocks = [];
    }

    if (!Array.isArray(state.blocks) || !state.blocks.length) {
      state.selectedByBlock = [];
      renderExamView();
      return;
    }

    state.selectedByBlock = Array.from({ length: state.blocks.length }, () => []);

    try {
      const first = await apiGetBlockQuestions(state.blocks[0].id);
      state.selectedByBlock[0] = Array.isArray(first?.questions) ? first.questions : [];
    } catch (err) {
      console.error('Failed to load first block questions', err);
      return;
    }

    if (!Array.isArray(state.selectedByBlock[0]) || !state.selectedByBlock[0].length) {
      renderExamView();
      return;
    }

    resetAnswers();
    rebuildFlat({ resetPosition: true });
    renderExamView();

    const restPromises = state.blocks.slice(1).map((block, index) =>
      apiGetBlockQuestions(block.id)
        .then((payload) => ({
          index: index + 1,
          questions: Array.isArray(payload?.questions) ? payload.questions : [],
        }))
        .catch((err) => {
          console.error('Failed to load block', block.id, err);
          return { index: index + 1, questions: [] };
        })
    );

    const rest = await Promise.all(restPromises);
    rest.forEach(({ index, questions }) => {
      state.selectedByBlock[index] = questions;
    });

    rebuildFlat({ resetPosition: false });
    renderDots();
    updateNavButtons();
    updateIndicators();
  }

  async function handleGateSubmit(event) {
    event.preventDefault();
    const value = (DOM.gateInput?.value || '').trim();
    if (!value) {
      setHidden(DOM.gateError, false);
      DOM.gateInput?.focus();
      return;
    }

    const submitBtn = DOM.gateForm?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const valid = await verifyGatePassword(value);
      if (!valid) {
        setHidden(DOM.gateError, false);
        DOM.gateInput?.focus();
        DOM.gateInput?.select?.();
        return;
      }
      setHidden(DOM.gateError, true);

      // Gate წარმატებულია — ჯერ დავბლოკოთ "გამოცდის დაწყება" სანამ ნებართვები არ დადასტურდება
      if (DOM.examStart) DOM.examStart.disabled = true;

      state.gatePassed = true;
      state.mustStayFullscreen = false;
      hide(DOM.gateOverlay);

      // კამერა/მიკროფონი — ნებართვა Gate-ის შემდეგ
      const cameraStream = await startCamera().catch(() => null);
      if (!cameraStream) {
        alert('კამერის/მიკროფონის ნებართვა აუცილებელია გამოცდის დასაწყებად. გთხოვთ დაუშვათ წვდომა.');
        if (DOM.examStart) DOM.examStart.disabled = true;
        return;
      }

      // ეკრანის გაზიარება — ნებართვა Gate-ის შემდეგ
      const screenStream = await startScreenCapture().catch(() => null);
      if (!screenStream) {
        alert('ეკრანის გაზიარება აუცილებელია გამოცდის დასაწყებად. გთხოვთ აირჩიოთ სრულ ეკრანზე გაზიარება და სცადოთ ხელახლა.');
        if (DOM.examStart) DOM.examStart.disabled = true;
        return;
      }

      // ნებართვების მიღებისთანავე დავიწყოთ ჩაწერა
      void startMediaRecording(MEDIA_TYPES.CAMERA, cameraStream);
      void startMediaRecording(MEDIA_TYPES.SCREEN, screenStream);

      // ახლა შესაძლებელია გამოცდის დაწყება
      if (DOM.examStart) DOM.examStart.disabled = false;
      if (DOM.examFinish) DOM.examFinish.disabled = false;
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function activateExamUi() {
    state.examStarted = true;
    if (DOM.examStart) DOM.examStart.disabled = true;
    if (DOM.examFinish) DOM.examFinish.disabled = false;
    hide(DOM.prestartOverlay);
    if (isStreamActive(state.cameraStream)) {
      void startMediaRecording(MEDIA_TYPES.CAMERA, state.cameraStream);
    } else {
      startCamera()
        .then((stream) => {
          if (stream) {
            return startMediaRecording(MEDIA_TYPES.CAMERA, stream);
          }
          return null;
        })
        .catch(() => {});
    }

    if (isStreamActive(state.screenStream)) {
      void startMediaRecording(MEDIA_TYPES.SCREEN, state.screenStream);
    } else {
      startScreenCapture()
        .then((stream) => {
          if (stream) {
            return startMediaRecording(MEDIA_TYPES.SCREEN, stream);
          }
          return null;
        })
        .catch(() => {});
    }
  }

  async function handleExamStart() {
    if (state.examStarted) return;

    if (!state.sessionId || !state.sessionToken) {
      if (!state.gatePassed) {
        show(DOM.gateOverlay);
        DOM.gateInput?.focus();
        return;
      }
    }

    const startButton = DOM.examStart;
    if (startButton) startButton.disabled = true;

    state.mustStayFullscreen = true;
    enterFullscreen();

    try {
      const cameraStream = await startCamera().catch(() => null);
      if (!cameraStream) return;

      const screenStream = await startScreenCapture().catch((error) => {
        dlog('screen capture failed', error);
        return null;
      });

      if (!screenStream) {
        alert('ეკრანის გაზიარება აუცილებელია გამოცდის დასაწყებად. გთხოვთ აირჩიოთ სრულ ეკრანზე გაზიარება და სცადოთ ხელახლა.');
        return;
      }

      activateExamUi();

      // სესია და დროის ათვლა იწყება მხოლოდ "დაწყება"-ზე
      if (!state.sessionId || !state.sessionToken) {
        await beginSession();
      }
      startCountdown();
      await initExamData();
    } finally {
      if (!state.examStarted) {
        exitFullscreen();
      }
      if (!state.examStarted && startButton) {
        startButton.disabled = false;
        startButton.focus?.();
      }
    }
  }

  function handleAnswerClick(event) {
    const row = event.target?.closest?.('.cm-answer');
    if (!row || !DOM.cmContent?.contains(row)) return;
    const mark = event.target?.closest?.('.mark');
    if (!mark || !row.contains(mark)) return;
    const answerId = row.dataset.answerId;
    if (!answerId) return;
    selectAnswer(answerId).catch(() => {});
  }

  function handleDotClick(event) {
    const dot = event.target?.closest?.('.cm-dot');
    if (!dot || !DOM.cmDotsWrap?.contains(dot)) return;
    const key = dot.dataset.questionId;
    if (!key) return;
    const index = state.flatIndexByQuestionId.get(key);
    if (typeof index === 'number') {
      gotoQuestionIndex(index);
    }
  }

  function handleGlobalKey(event) {
    if (!state.examStarted) {
      if (event.key === 'F4' && event.altKey) {
        event.preventDefault();
        ensureFullscreen();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        ensureFullscreen();
        return;
      }
      ensureFullscreen();
      return;
    }
    if (event.key === 'F4' && event.altKey) {
      event.preventDefault();
      showStep1();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      showStep1();
      return;
    }
    ensureFullscreen();
  }

  function handleFullscreenChange() {
    if (document.fullscreenElement || !state.mustStayFullscreen) return;

    if (!state.examStarted) {
      requestAnimationFrame(() => {
        if (state.mustStayFullscreen && !document.fullscreenElement) {
          enterFullscreen();
        }
      });
      return;
    }

    if (DOM.answerAllDialog && !DOM.answerAllDialog.hidden) {
      requestAnimationFrame(() => {
        if (state.mustStayFullscreen && !document.fullscreenElement) {
          enterFullscreen();
        }
      });
      return;
    }

    showStep1();
    enterFullscreen();
  }

  function wireUI() {
    DOM.gateForm?.addEventListener('submit', handleGateSubmit);
    DOM.gateClose?.addEventListener('click', () => { void safeNavigateHome(); });
    DOM.gateInput?.addEventListener('input', () => setHidden(DOM.gateError, true));

    DOM.examStart?.addEventListener('click', handleExamStart);
    DOM.examFinish?.addEventListener('click', () => {
      if (!state.examStarted) return;
      showStep1();
    });

    DOM.confirmLeaveNo?.addEventListener('click', hideAll);
    DOM.confirmLeaveYes?.addEventListener('click', showStep2);
    DOM.returnToExam?.addEventListener('click', hideAll);
    DOM.agreeExit?.addEventListener('click', () => {
      exitFullscreen();
      void safeNavigateHome();
    });

    DOM.resultsClose?.addEventListener('click', () => {
      hideResults();
      exitFullscreen();
      void safeNavigateHome();
    });

    DOM.answerAllClose?.addEventListener('click', hideAnswerAllDialog);

    DOM.prevBtn?.addEventListener('click', gotoPrevQuestion);
    DOM.nextBtn?.addEventListener('click', gotoNextQuestion);

    DOM.cmContent?.addEventListener('click', handleAnswerClick);
    DOM.cmDotsWrap?.addEventListener('click', handleDotClick);

    if (DOM.prestartOverlay) {
      show(DOM.prestartOverlay);
    }
  }

  function wireGlobalGuards() {
    document.addEventListener('keydown', handleGlobalKey);
    document.addEventListener('click', () => ensureFullscreen(), { capture: true });
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  }

  function initializeCountdownDisplay() {
    remainingMs = state.serverEndsAtMs
      ? Math.max(0, state.serverEndsAtMs - Date.now())
      : readDurationMinutes() * 60 * 1000;
    updateCountdownView();
  }

  async function preloadExamMetadata() {
    try {
      const config = await apiGetConfig(EXAM_ID);
      const duration = Number(config?.duration_minutes || config?.durationMinutes || 0);
      if (duration > 0) {
        state.examDurationMinutes = duration;
        initializeCountdownDisplay();
      }
    } catch (err) {
      dlog('preload config failed', err);
    }
  }

  function initialize() {
    hideAll();
    focusTrap.enable();
    updateUserHeader();
    updateRightDateTime();
    setInterval(updateRightDateTime, 30 * 1000);
    initializeCountdownDisplay();
    void preloadExamMetadata();
    show(DOM.gateOverlay);
    if (DOM.gateInput) DOM.gateInput.focus();
    showCameraMessage('კამერა ჩაირთვება ადმინისტრატორის პაროლის შეყვანის და გამოცდის დაწყების შემდეგ.', {
      allowSwitch: (state.cameraDevices.length || 0) > 1,
      currentLabel: getCurrentCameraLabel(),
    });
    refreshCameraDevices()
      .then(() => {
        if (state.cameraStream) return;
        showCameraMessage('კამერა ჩაირთვება ადმინისტრატორის პაროლის შეყვანის და გამოცდის დაწყების შემდეგ.', {
          allowSwitch: (state.cameraDevices.length || 0) > 1,
          currentLabel: getCurrentCameraLabel(),
        });
      })
      .catch(() => {});
    window.addEventListener('beforeunload', () => {
      void finalizeRecording({ waitForUploads: false });
      stopCamera();
      stopScreenCapture();
    });
    const handleDeviceChange = async () => {
      await refreshCameraDevices().catch(() => []);
      if (!state.examStarted && !state.gatePassed) {
        showCameraMessage('კამერა ჩაირთვება ადმინისტრატორის პაროლის შეყვანის და გამოცდის დაწყების შემდეგ.', {
          allowSwitch: (state.cameraDevices.length || 0) > 1,
          currentLabel: getCurrentCameraLabel(),
        });
        return;
      }
      if (isStreamActive(state.cameraStream)) return;
      startCamera({ force: true }).catch(() => {});
    };
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    } else if (navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = handleDeviceChange;
    }
  }

  function preventZooming() {
    document.addEventListener('wheel', (event) => {
      if (event.ctrlKey) event.preventDefault();
    }, { passive: false });

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '-' || event.key === '=')) {
        event.preventDefault();
      }
    }, { passive: false });
  }

  wireUI();
  wireGlobalGuards();
  initialize();
});
