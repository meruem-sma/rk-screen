/* UI coordination. Privileged operations are checked again in the main process. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id),
    api = window.rkScreen;
  const { SessionGate, validMessage, inputTypes, RequestLimiter, validVideoKey } =
    window.RKScreenSession;
  const requestLimiter = new RequestLimiter();
  let traffic = new window.RKScreenSession.SessionTraffic();
  const pendingChats = new Map(),
    receivedChats = new Set();
  const gate = new SessionGate(),
    PROTOCOL = 8;
  let liveLane = null,
    inputSequence = 0,
    lastPointerSent = 0;
  let cursorTimer,
    pointerTimer,
    pendingPointer = null,
    lastCursorPacket = '',
    lastCursorSent = 0;
  let qualityQueue = Promise.resolve(),
    videoInfo = null;
  let videoKey = null,
    hostVideoPending = false,
    activeSource = null,
    switchSources = [],
    switchRevision = 0;
  const {
    selectedRoute,
    receiveSample,
    AdaptiveQuality,
    RecoveryBudget,
    RealtimeLane,
    RetryBackoff,
  } = window.RKScreenTransport;
  const adaptive = new AdaptiveQuality();
  const diagnostics = new window.RKScreenDiagnostics.Diagnostics();
  const signalingRetry = new RetryBackoff();
  let recoveryTimer = null,
    recoveryBudget = new RecoveryBudget(),
    qualityWarning = false;
  const { profiles, qualitySettings, geometry, coordinates } = window.RKScreenVideo;
  let peer,
    peerRevision = 0,
    token = null,
    stream = null,
    media = null,
    refreshingVideo = false,
    restartingVideo = false,
    sources = [],
    name = 'Bu bilgisayar',
    deviceId = '',
    connectedName = '';
  let quality = 'balanced',
    remotePaused = false,
    remoteInput = false,
    remoteClipboard = false,
    online = false,
    ending = Promise.resolve();
  let connectTimer,
    heartbeat,
    clipTimer,
    reconnectTimer,
    clipboardBaseline = null,
    unread = 0,
    toastTimer,
    lastPong = 0,
    oldStats = null;
  let mouseTimer = null,
    pendingMouse = null,
    lastInputError = 0,
    unicodeKeys = new Set(),
    lastMouse = 0,
    lastCoords = { x: 0, y: 0 },
    pressedButtons = new Set(),
    lastCursor = null,
    ownCursor = null;
  let transfer = null,
    fileWaiter = null,
    fileTimer = null,
    fileQueue = Promise.resolve(),
    selectingFile = false,
    queuedFileMessages = 0,
    outgoingFiles = [],
    drainingFiles = false,
    editingDevice = null,
    fileBitrate = 1000000;
  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };
  const savedPrefs = read('menzil_preferences_v3', null);
  const prefs = {
    quality: Object.hasOwn(profiles, savedPrefs?.quality) ? savedPrefs.quality : 'auto',
    clipboard: savedPrefs?.clipboard === true,
    requests: savedPrefs?.requests !== false,
  };
  function toast(text, error = false) {
    clearTimeout(toastTimer);
    $('toast').textContent = text;
    $('toast').classList.toggle('error', error);
    $('toast').hidden = false;
    toastTimer = setTimeout(() => ($('toast').hidden = true), error ? 7000 : 4000);
  }
  function errorText(err) {
    if (err?.type || ['NotAllowedError', 'NotReadableError'].includes(err?.name))
      return window.RKScreenErrors.explain(err, navigator.onLine);
    return String(err?.message || err).replace(
      /^Error invoking remote method '[^']+': Error: /,
      '',
    );
  }
  function on(id, event, fn) {
    $(id).addEventListener(event, (e) => {
      Promise.resolve()
        .then(() => fn(e))
        .catch((err) => toast(errorText(err), true));
    });
  }
  function formatted(id) {
    return String(id).replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  }
  function message(text, error = false) {
    $('connect-message').textContent = text;
    $('connect-message').classList.toggle('error', error);
  }
  function network(state, label) {
    diagnostics.record('connection', { state });
    online = state === 'online';
    $('network-dot').className = 'status-dot ' + state;
    $('network-label').textContent =
      state === 'online' && !prefs.requests ? 'Gelen istekler kapalı' : label;
    $('retry').hidden = state !== 'offline';
    refreshControls();
  }
  function refreshControls() {
    $('connect-button').disabled = !online || !!gate.connection;
    $('remote-id').disabled = !!gate.connection;
    $('connect-button').firstChild.textContent =
      gate.connection && gate.role === 'controller' && !gate.approved ? 'Bağlanıyor…' : 'Bağlan';
    $('copy-id').disabled = !api || !deviceId;
    $('cancel-connect').hidden = !gate.connection || gate.role !== 'controller' || gate.approved;
    document
      .querySelectorAll('.recent-connect')
      .forEach((b) => (b.disabled = !online || !!gate.connection));
  }
  function send(data, conn = gate.connection) {
    if (!conn?.open) return false;
    try {
      if (inputTypes.has(data.type)) data = { ...data, videoKey };
      if (['mouse-move', 'mouse-button'].includes(data.type))
        data = { ...data, sequence: ++inputSequence };
      if (
        conn === gate.connection &&
        ['mouse-move', 'cursor', 'pointer'].includes(data.type) &&
        !data.pulse
      ) {
        if (liveLane?.send(data)) return true;
        if ((conn.dataChannel?.bufferedAmount || 0) > 16384) return false;
      }
      conn.send(data);
      return true;
    } catch {
      return false;
    }
  }
  function armTimeout(ms, text) {
    clearTimeout(connectTimer);
    const owner = gate.connection;
    connectTimer = setTimeout(() => {
      if (gate.connection === owner) {
        cleanup();
        message(text, true);
        toast(text, true);
      }
    }, ms);
  }
  function showPage(settings) {
    $('dashboard').hidden = settings;
    $('settings-page').hidden = !settings;
    $('nav-home').classList.toggle('selected', !settings);
    $('nav-settings').classList.toggle('selected', settings);
    $('page-label').textContent = settings ? 'Ayarlar' : 'Bağlantı';
  }
  function recentItems() {
    return window.RKScreenDevices.normalize(read('menzil_recents', []));
  }
  function renderRecents() {
    const root = $('recents');
    root.replaceChildren();
    const items = recentItems().sort(
      (a, b) => Number(b.favorite) - Number(a.favorite) || b.time - a.time,
    );
    if (!items.length) {
      const row = document.createElement('div');
      row.className = 'recent-empty';
      row.innerHTML =
        '<svg><use href="#i-clock"/></svg><div><strong>Henüz bir bağlantı yok</strong><p>Bağlandığınız bilgisayarlar burada listelenir.</p></div>';
      root.append(row);
      return;
    }
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'recent-row';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.innerHTML = '<use href="#i-monitor"/>';
      const text = document.createElement('div'),
        title = document.createElement('strong'),
        caption = document.createElement('small');
      title.textContent = item.alias || item.name;
      caption.textContent = formatted(item.id);
      text.append(title, caption);
      const button = document.createElement('button');
      button.className = 'button small recent-connect';
      button.textContent = 'Bağlan';
      button.addEventListener('click', () => {
        $('remote-id').value = formatted(item.id);
        connect(item.id).catch((e) => toast(errorText(e), true));
      });
      const actions = document.createElement('div');
      actions.className = 'recent-actions';
      const favorite = document.createElement('button');
      favorite.className = 'text-button favorite-button';
      favorite.textContent = item.favorite ? '★' : '☆';
      favorite.setAttribute('aria-pressed', String(item.favorite));
      favorite.setAttribute('aria-label', item.favorite ? 'Favoriden kaldır' : 'Favoriye ekle');
      favorite.addEventListener('click', () => {
        write(
          'menzil_recents',
          recentItems().map((v) => (v.id === item.id ? { ...v, favorite: !v.favorite } : v)),
        );
        renderRecents();
      });
      const rename = document.createElement('button');
      rename.className = 'text-button';
      rename.textContent = 'Adlandır';
      rename.addEventListener('click', () => {
        editingDevice = item.id;
        $('device-alias').value = item.alias;
        $('device-dialog').showModal();
        $('device-alias').focus();
      });
      const remove = document.createElement('button');
      remove.className = 'text-button';
      remove.textContent = 'Sil';
      remove.addEventListener('click', () => {
        write(
          'menzil_recents',
          recentItems().filter((v) => v.id !== item.id),
        );
        renderRecents();
      });
      actions.append(favorite, rename, remove, button);
      row.append(icon, text, actions);
      root.append(row);
    }
    refreshControls();
  }
  function saveRecent(id, remoteName) {
    write('menzil_recents', window.RKScreenDevices.remember(recentItems(), id, remoteName));
    renderRecents();
  }
  function newDeviceId() {
    return String(100000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000000));
  }
  function reconnectSignaling(owner, initial = false) {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(
      () => {
        if (peer !== owner || online) return;
        if (owner.destroyed) {
          if (!gate.connection) initPeer();
          return;
        }
        try {
          if (owner.disconnected) owner.reconnect();
          else if (!gate.connection) {
            initPeer();
            return;
          }
        } catch {}
        reconnectSignaling(owner);
      },
      initial ? 10000 : signalingRetry.next(),
    );
  }
  async function initPeer() {
    if (!api) {
      network('offline', 'Arayüz önizlemesi');
      $('retry').hidden = true;
      return;
    }
    clearTimeout(reconnectTimer);
    const revision = ++peerRevision;
    if (peer) {
      peer.removeAllListeners();
      peer.destroy();
    }
    network('waiting', 'Bağlantı hazırlanıyor');
    let config;
    try {
      config = api.connectionConfig
        ? await api.connectionConfig()
        : {
            iceServers: [
              { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
            ],
          };
    } catch (err) {
      network('offline', 'Bağlantı sunucusu ayarını kontrol edin');
      toast(errorText(err), true);
      return;
    }
    if (revision !== peerRevision) return;
    peer = new Peer('rkscreen-v8-' + deviceId, { debug: 0, config });
    const ownerPeer = peer;
    reconnectSignaling(ownerPeer, true);
    peer.on('open', () => {
      if (peer !== ownerPeer) return;
      clearTimeout(reconnectTimer);
      signalingRetry.reset();
      network('online', 'Bağlantıya hazır');
    });
    peer.on('disconnected', () => {
      if (peer !== ownerPeer) return;
      network('offline', 'Bağlantı hizmetine erişilemiyor');
      reconnectSignaling(ownerPeer);
    });
    peer.on('error', (err) => {
      if (peer !== ownerPeer) return;
      if (err.type === 'unavailable-id') {
        if (gate.approved) {
          // A stale signaling lease must not tear down an approved P2P session.
          network('offline', 'Bağlantı hizmeti yeniden deneniyor');
          reconnectSignaling(ownerPeer);
          return;
        }
        if (gate.connection) cleanup();
        deviceId = newDeviceId();
        write('menzil_device_id_v3', deviceId);
        $('device-id').textContent = formatted(deviceId);
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(initPeer, 1000);
        return;
      }
      if (err.type === 'peer-unavailable') {
        cleanup();
        message(window.RKScreenErrors.explain(err, navigator.onLine), true);
        return;
      }
      if (['network', 'socket-error', 'socket-closed', 'server-error'].includes(err.type)) {
        network('offline', 'Bağlantı hizmeti yeniden deneniyor');
        message(window.RKScreenErrors.explain(err, navigator.onLine), true);
        reconnectSignaling(ownerPeer);
      } else if (gate.connection && !gate.approved) {
        cleanup();
        message(window.RKScreenErrors.explain(err, navigator.onLine), true);
      } else if (err.type === 'webrtc' && media) scheduleVideoRecovery(media);
    });
    peer.on('connection', (conn) => {
      const refusal =
        conn.metadata?.version !== PROTOCOL
          ? 'version'
          : !prefs.requests
            ? 'disabled'
            : !requestLimiter.allow(conn.peer)
              ? 'rate'
              : !gate.reserve(conn, 'host')
                ? 'busy'
                : null;
      if (refusal) {
        const refuse = () => {
          send({ type: 'denied', reason: refusal }, conn);
          setTimeout(() => conn.close(), 100);
        };
        conn.on('open', refuse);
        if (conn.open) refuse();
        return;
      }
      connectedName = window.RKScreenPointer.cleanName(conn.metadata.name);
      bindConnection(conn);
      refreshControls();
      armTimeout(45000, 'Bağlantı isteğinin süresi doldu.');
      let prompted = false;
      const prompt = async () => {
        if (prompted || gate.connection !== conn) return;
        prompted = true;
        await ending;
        if (gate.connection !== conn) return;
        $('incoming-name').textContent = connectedName + ' bağlanmak istiyor';
        $('incoming-id').textContent =
          'Cihaz kimliği: ' + formatted(conn.peer.replace('rkscreen-v8-', ''));
        $('allow-input').checked = false;
        $('allow-clipboard').checked = prefs.clipboard;
        $('allow-audio').checked = false;
        $('accept').disabled = true;
        $('incoming-error').textContent = '';
        $('incoming-dialog').showModal();
        try {
          sources = await api.sources();
          if (gate.connection !== conn) return;
          $('source-select').replaceChildren(
            ...sources.map((s, i) => {
              const o = document.createElement('option');
              o.value = s.id;
              o.textContent = sourceLabel(s, i);
              return o;
            }),
          );
          updateSource();
          $('accept').disabled = !sources.length;
          if (!sources.length)
            $('incoming-error').textContent = 'Paylaşılabilecek ekran bulunamadı.';
        } catch (e) {
          $('incoming-error').textContent = errorText(e);
        }
      };
      conn.on('open', () => prompt().catch((e) => toast(errorText(e), true)));
      if (conn.open) prompt().catch((e) => toast(errorText(e), true));
    });
    peer.on('call', (call) => {
      if (
        !gate.approved ||
        gate.role !== 'controller' ||
        call.peer !== gate.connection?.peer ||
        media ||
        call.metadata?.version !== PROTOCOL ||
        !validVideoKey(videoKey) ||
        call.metadata?.videoKey !== videoKey
      ) {
        call.close();
        return;
      }
      media = call;
      call.answer();
      // PeerJS creates the receiving RTCPeerConnection inside answer().
      bindMedia(call);
      call.on('stream', (remote) => {
        if (media !== call || !gate.approved) return;
        $('remote-video').srcObject = remote;
        const expectedKey = videoKey;
        $('remote-video').requestVideoFrameCallback(() => {
          if (media !== call || videoKey !== expectedKey || !gate.approved) return;
          clearTimeout(connectTimer);
          refreshingVideo = false;
          $('refresh-video').disabled = false;
          $('video-wait').hidden = true;
          send({ type: 'video-visible', videoKey });
          updateControlStatus();
        });
        $('remote-video')
          .play()
          .catch(() => toast('Görüntüyü başlatmak için uzak ekrana tıklayın.'));
        const audio = remote.getAudioTracks().length > 0;
        $('audio-toggle').disabled = !audio;
        $('audio-toggle').textContent = audio
          ? $('remote-video').muted
            ? 'Sesi aç'
            : 'Sesi kapat'
          : 'Ses paylaşılmıyor';
        $('audio-toggle').setAttribute('aria-pressed', String(audio && !$('remote-video').muted));
        const track = remote.getVideoTracks()[0];
        if (track)
          track.onended = () => {
            if (media === call) scheduleVideoRecovery(call);
          };
        saveRecent(call.peer.replace('rkscreen-v8-', ''), connectedName);
      });
    });
  }
  function scheduleVideoRecovery(call) {
    if (media !== call || !gate.approved || !gate.connection?.open) return;
    diagnostics.record('recovery');
    if (gate.role === 'controller') {
      if (!refreshingVideo) {
        prepareControllerVideo();
        send({ type: 'video-interrupted', videoKey });
      }
      return;
    }
    if (restartingVideo || recoveryTimer) return;
    const owner = gate.connection,
      ownerToken = token,
      key = videoKey;
    hostVideoPending = true;
    // Pause native input immediately, retaining the current capability until rebuild.
    api.videoState(ownerToken, { videoKey: key, displayId: activeSource.displayId }).catch(() => {
      if (gate.connection === owner && token === ownerToken)
        cleanup('Kontrol güvenli biçimde bekletilemedi.');
    });
    $('host-label').textContent = 'Bağlantı toparlanıyor · Kontrol beklemede';
    recoveryTimer = setTimeout(() => {
      recoveryTimer = null;
      if (gate.connection === owner && media === call && videoKey === key) {
        if (!recoveryBudget.take(Date.now())) {
          cleanup('Görüntü bağlantısı tekrar tekrar kesiliyor. Ağı kontrol edip yeniden bağlanın.');
          return;
        }
        restartHostVideo().catch(() => cleanup('Görüntü yeniden başlatılamadı.'));
      }
    }, 4000);
  }
  function bindMedia(call) {
    call.on('close', () => scheduleVideoRecovery(call));
    call.on('error', () => scheduleVideoRecovery(call));
    const pc = call.peerConnection;
    const reapply = () => {
      if (media === call && gate.role === 'host' && pc.signalingState === 'stable')
        applyQuality().catch(() => {});
    };
    pc?.addEventListener('signalingstatechange', reapply);
    pc?.addEventListener('icecandidateerror', (event) => {
      if (media === call) diagnostics.record('relay-error', { code: event.errorCode });
    });
    pc?.addEventListener('connectionstatechange', () => {
      if (media !== call) return;
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState))
        scheduleVideoRecovery(call);
      if (pc.connectionState === 'connected') {
        reapply();
        if (gate.role === 'controller' && refreshingVideo && $('remote-video').srcObject) {
          const key = videoKey;
          $('remote-video').requestVideoFrameCallback(() => {
            if (
              media !== call ||
              videoKey !== key ||
              !gate.approved ||
              pc.connectionState !== 'connected'
            )
              return;
            clearTimeout(connectTimer);
            refreshingVideo = false;
            $('refresh-video').disabled = false;
            $('video-wait').hidden = true;
            send({ type: 'video-visible', videoKey });
            updateControlStatus();
          });
        }
      }
    });
  }
  function bindConnection(conn) {
    traffic = new window.RKScreenSession.SessionTraffic();
    liveLane = new RealtimeLane(conn.peerConnection, (data) => {
      if (gate.allows(conn)) handleData(conn, data).catch(() => {});
    });
    conn.on('data', (data) =>
      handleData(conn, data).catch((err) => {
        if (gate.connection === conn) {
          toast(errorText(err), true);
          cleanup();
        }
      }),
    );
    conn.on('close', () => {
      if (gate.connection === conn) cleanup('Bağlantı sona erdi.');
    });
    conn.on('error', () => {
      if (gate.connection === conn) cleanup(window.RKScreenErrors.explain('disconnected'));
    });
  }
  async function connect(id) {
    if (!navigator.onLine) {
      message(window.RKScreenErrors.explain('offline'), true);
      return;
    }
    if (!api || !online || gate.connection) return;
    if (!/^\d{9}$/.test(id)) {
      message('Dokuz haneli cihaz kimliğini girin.', true);
      return;
    }
    if (id === deviceId) {
      message('Bu bilgisayarın kendi kimliğini girdiniz.', true);
      return;
    }
    await ending;
    if (gate.connection) return;
    const conn = peer.connect('rkscreen-v8-' + id, {
      reliable: true,
      metadata: { version: PROTOCOL, name },
    });
    gate.reserve(conn, 'controller');
    bindConnection(conn);
    refreshControls();
    message('Karşı bilgisayara bağlanılıyor…');
    armTimeout(25000, window.RKScreenErrors.explain('timeout'));
    conn.on('open', () => {
      if (gate.connection !== conn) return;
      message('Karşı tarafın onayı bekleniyor…');
      armTimeout(50000, 'Karşı taraf isteğe yanıt vermedi.');
    });
  }
  function updateSource() {
    const source = sources.find((s) => s.id === $('source-select').value);
    if (source) $('source-preview').src = source.thumbnail;
  }
  function sourceLabel(source, index) {
    return (
      'Ekran ' +
      (index + 1) +
      (source.width && source.height ? ' · ' + source.width + ' × ' + source.height : '')
    );
  }
  async function captureSource(source, audio = false) {
    const video = {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
        maxFrameRate: 60,
        ...(source.width && source.height
          ? {
              minWidth: source.width,
              maxWidth: source.width,
              minHeight: source.height,
              maxHeight: source.height,
            }
          : {}),
      },
    };
    try {
      return await navigator.mediaDevices.getUserMedia({
        video,
        audio: audio ? { mandatory: { chromeMediaSource: 'desktop' } } : false,
      });
    } catch (err) {
      if (!audio) throw err;
      const captured = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      toast('Sistem sesi alınamadı. Ekran sessiz paylaşılıyor.');
      return captured;
    }
  }
  function stopStream(value) {
    value?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
  }
  function prepareControllerVideo() {
    releaseInput();
    refreshingVideo = true;
    oldStats = null;
    videoInfo = null;
    $('quality-status').textContent = 'Yeni görüntü bilgisi bekleniyor';
    $('stat-fps').textContent = '— FPS';
    $('stat-rate').textContent = '— Mbps';
    lastCursor = null;
    $('remote-cursor').hidden = true;
    $('refresh-video').disabled = true;
    $('remote-video')
      .srcObject?.getTracks()
      .forEach((t) => {
        t.onended = null;
      });
    $('video-wait').hidden = false;
    $('session-state').textContent = 'Görüntü hazırlanıyor · Kontrol beklemede';
    armTimeout(20000, 'Yeni görüntü alınamadı. Bağlantıyı yeniden kurun.');
  }
  async function restartHostVideo(nextStream = stream, source = activeSource) {
    const owner = gate.connection,
      ownerToken = token;
    if (!gate.approved || gate.role !== 'host' || restartingVideo || !source) return false;
    restartingVideo = true;
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
    hostVideoPending = true;
    $('host-screen').disabled = true;
    const nextKey = crypto.randomUUID();
    try {
      await api.videoState(ownerToken, { videoKey: nextKey, displayId: source.displayId });
      if (gate.connection !== owner || token !== ownerToken) return false;
      videoKey = nextKey;
      adaptive.reset();
      activeSource = source;
      const previous = media;
      media = null;
      previous?.close();
      if (stream !== nextStream) {
        stopStream(stream);
        stream = nextStream;
      }
      const track = stream.getVideoTracks()[0];
      track.onended = () => cleanup('Ekran paylaşımı sona erdi.');
      track.contentHint = 'detail';
      $('host-label').textContent = 'Yeni görüntünün ulaşması bekleniyor';
      $('host-detail').textContent = source.label;
      armTimeout(20000, 'Yeni görüntü karşı bilgisayara ulaşmadı.');
      send({ type: 'video-reset', videoKey });
      return true;
    } catch (err) {
      if (gate.connection === owner) cleanup('Görüntü değiştirilemedi: ' + errorText(err));
      return false;
    } finally {
      if (gate.connection === owner) restartingVideo = false;
    }
  }
  async function chooseScreen() {
    const owner = gate.connection;
    if (!gate.approved || gate.role !== 'host' || hostVideoPending) return;
    const revision = ++switchRevision;
    $('switch-source').disabled = false;
    $('switch-cancel').disabled = false;
    $('switch-confirm').disabled = true;
    $('switch-error').textContent = '';
    $('switch-source').replaceChildren();
    $('switch-preview').removeAttribute('src');
    $('screen-dialog').showModal();
    try {
      const list = await api.sources();
      if (gate.connection !== owner || revision !== switchRevision || !$('screen-dialog').open)
        return;
      switchSources = list.map((s, i) => ({ ...s, label: sourceLabel(s, i) }));
      $('switch-source').replaceChildren(
        ...switchSources.map((s) => {
          const option = document.createElement('option');
          option.value = s.id;
          option.textContent = s.label;
          return option;
        }),
      );
      if (switchSources.some((s) => s.id === activeSource?.id))
        $('switch-source').value = activeSource.id;
      updateSwitchPreview();
      if (!list.length) $('switch-error').textContent = 'Paylaşılabilecek ekran bulunamadı.';
    } catch (err) {
      if (gate.connection === owner) $('switch-error').textContent = errorText(err);
    }
  }
  function updateSwitchPreview() {
    const source = switchSources.find((s) => s.id === $('switch-source').value);
    if (source) $('switch-preview').src = source.thumbnail;
    $('switch-confirm').disabled = !source || source.id === activeSource?.id;
  }
  async function switchScreen() {
    const owner = gate.connection,
      ownerToken = token,
      revision = switchRevision;
    const source = switchSources.find((s) => s.id === $('switch-source').value);
    if (
      !source ||
      source.id === activeSource?.id ||
      !gate.approved ||
      gate.role !== 'host' ||
      hostVideoPending
    )
      return;
    $('switch-confirm').disabled = true;
    $('switch-source').disabled = true;
    $('switch-error').textContent = '';
    let captured;
    try {
      // Capture first: if the new source fails, the current screen remains available.
      captured = await captureSource(source, stream?.getAudioTracks().length > 0);
      if (
        gate.connection !== owner ||
        token !== ownerToken ||
        revision !== switchRevision ||
        !$('screen-dialog').open
      )
        return;
      // Once native coordinates are committing, finish the atomic transition.
      $('switch-cancel').disabled = true;
      if (await restartHostVideo(captured, source)) {
        captured = null;
        $('screen-dialog').close();
      }
    } catch (err) {
      if (gate.connection === owner && revision === switchRevision)
        $('switch-error').textContent = errorText(err);
    } finally {
      stopStream(captured);
      if (gate.connection === owner && revision === switchRevision) {
        $('switch-source').disabled = false;
        $('switch-cancel').disabled = false;
        updateSwitchPreview();
      }
    }
  }
  async function accept() {
    const conn = gate.connection;
    if (!conn || gate.role !== 'host' || gate.approved) return;
    $('accept').disabled = true;
    const source = sources.find((s) => s.id === $('source-select').value);
    if (!source) return;
    let captured;
    const input = $('allow-input').checked,
      clipboard = $('allow-clipboard').checked;
    try {
      await ending;
      const localToken = await api.begin({
        role: 'host',
        remoteName: connectedName,
        displayId: source.displayId,
        input,
        clipboard,
      });
      if (gate.connection !== conn) {
        await api.end(localToken);
        return;
      }
      token = localToken;
      videoKey = crypto.randomUUID();
      activeSource = { ...source, label: sourceLabel(source, sources.indexOf(source)) };
      hostVideoPending = true;
      $('host-screen').disabled = true;
      await api.videoState(localToken, { videoKey, displayId: source.displayId });
      captured = await captureSource(source, $('allow-audio').checked);
      if (gate.connection !== conn) {
        captured.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = captured;
      gate.approve(conn);
      remoteClipboard = false;
      $('host-input').checked = input;
      $('host-pointer').checked = true;
      $('host-clipboard').checked = clipboard;
      $('incoming-dialog').close();
      clearTimeout(connectTimer);
      $('host-label').textContent = connectedName + ' ile paylaşım başlatılıyor';
      $('host-detail').textContent =
        $('source-select').selectedOptions[0]?.textContent || 'Ekran paylaşımı';
      $('host-session').hidden = false;
      showPage(false);
      const track = stream.getVideoTracks()[0];
      track.onended = () => cleanup('Ekran paylaşımı sona erdi.');
      track.contentHint = 'detail';
      send({ type: 'granted', version: PROTOCOL, name, input, clipboard, videoKey });
      quality = prefs.quality;
      armTimeout(20000, 'Karşı bilgisayar ekran paylaşımına hazır değil.');
      startSession();
      refreshControls();
    } catch (err) {
      captured?.getTracks().forEach((t) => t.stop());
      if (gate.connection === conn) {
        send({ type: 'denied', reason: 'capture' });
        cleanup();
        toast('Ekran paylaşılamadı: ' + errorText(err), true);
      }
    } finally {
      $('accept').disabled = false;
    }
  }
  async function handleData(conn, m) {
    if (conn !== gate.connection || !m || typeof m !== 'object') return;
    if (!gate.approved) {
      if (gate.role !== 'controller') return;
      if (m.type === 'denied') {
        cleanup();
        message(window.RKScreenErrors.explain(m.reason), true);
        return;
      }
      if (
        m.type !== 'granted' ||
        m.version !== PROTOCOL ||
        !validVideoKey(m.videoKey) ||
        typeof m.input !== 'boolean' ||
        typeof m.clipboard !== 'boolean'
      )
        return;
      gate.approve(conn);
      videoKey = m.videoKey;
      connectedName = window.RKScreenPointer.cleanName(m.name);
      $('cursor-name').textContent = connectedName;
      $('self-cursor-name').textContent = name;
      remoteInput = m.input;
      remoteClipboard = m.clipboard;
      const newToken = await api.begin({
        role: 'controller',
        clipboard: prefs.clipboard && remoteClipboard,
      });
      if (gate.connection !== conn) {
        await api.end(newToken);
        return;
      }
      token = newToken;
      liveLane?.start();
      $('session-clipboard').checked = prefs.clipboard;
      $('remote-name').textContent = connectedName;
      $('remote-session').hidden = false;
      prepareControllerVideo();
      $('input-mode').value = remoteInput ? 'control' : 'view';
      $('input-mode').disabled = false;
      $('input-mode').querySelector('[value="control"]').disabled = !remoteInput;
      updateControlStatus();
      $('viewport').focus();
      quality = prefs.quality;
      $('quality').value = quality;
      send({ type: 'quality', value: quality });
      send({ type: 'permissions', input: false, clipboard: prefs.clipboard });
      send({ type: 'ready', videoKey });
      $('chat-partner').textContent = connectedName;
      if (!$('remote-video').srcObject)
        armTimeout(20000, 'Ekran akışı başlamadı. Bağlantıyı yeniden deneyin.');
      startSession();
      refreshControls();
      return;
    }
    if (!validMessage(m) || !token || !traffic.allow(m)) return;
    if (inputTypes.has(m.type)) {
      if (gate.role === 'host') {
        try {
          await api.input(token, m);
        } catch (err) {
          if (Date.now() - lastInputError > 5000) {
            lastInputError = Date.now();
            toast(errorText(err), true);
            send({ type: 'input-error' });
          }
        }
      }
      return;
    }
    switch (m.type) {
      case 'video-interrupted':
        if (gate.role === 'host' && m.videoKey === videoKey && media) scheduleVideoRecovery(media);
        break;
      case 'refresh-video':
        if (gate.role === 'host' && stream && m.videoKey === videoKey) await restartHostVideo();
        break;
      case 'video-reset':
        if (gate.role !== 'controller' || m.videoKey === videoKey) break;
        prepareControllerVideo();
        videoKey = m.videoKey;
        {
          const previous = media;
          media = null;
          previous?.close();
        }
        $('remote-video').srcObject = null;
        send({ type: 'ready', videoKey });
        break;
      case 'video-visible':
        if (gate.role === 'host' && hostVideoPending && media && m.videoKey === videoKey) {
          const ownerToken = token;
          if (await api.videoReady(ownerToken, videoKey)) {
            if (gate.connection !== conn || token !== ownerToken || m.videoKey !== videoKey) break;
            hostVideoPending = false;
            clearTimeout(recoveryTimer);
            recoveryTimer = null;
            clearTimeout(connectTimer);
            $('host-screen').disabled = false;
            $('host-label').textContent = connectedName + ' ekranınızı görüntülüyor';
          }
        }
        break;
      case 'ready':
        if (gate.role === 'host' && stream && !media && m.videoKey === videoKey) {
          media = peer.call(conn.peer, stream, { metadata: { version: PROTOCOL, videoKey } });
          bindMedia(media);
          await applyQuality();
        }
        break;
      case 'input-error':
        toast(
          'Windows kontrolü engelledi. Karşı bilgisayardaki izinleri ve uygulamanın yetki düzeyini kontrol edin.',
          true,
        );
        break;
      case 'bye':
        cleanup('Karşı taraf bağlantıyı bitirdi.');
        break;
      case 'ping':
        send({ type: 'pong', time: m.time });
        if (gate.role === 'host') await api.inputKeepAlive?.(token);
        break;
      case 'pong':
        lastPong = Date.now();
        $('stat-ping').textContent = Math.max(0, Math.round(performance.now() - m.time)) + ' ms';
        break;
      case 'chat':
        send({ type: 'chat-ack', id: m.id });
        if (!receivedChats.has(m.id)) {
          receivedChats.add(m.id);
          if (receivedChats.size > 200) receivedChats.delete(receivedChats.values().next().value);
          addChat(m.text, false, m.id);
        }
        break;
      case 'chat-ack': {
        const item = pendingChats.get(m.id);
        if (item) {
          clearTimeout(item.timer);
          item.status.textContent = 'Teslim edildi';
          item.retry.hidden = true;
          pendingChats.delete(m.id);
        }
        break;
      }
      case 'permissions':
        remoteClipboard = m.clipboard;
        if (gate.role === 'controller') {
          const wasAllowed = remoteInput;
          remoteInput = m.input;
          if (!wasAllowed && remoteInput) $('input-mode').value = 'control';
          $('input-mode').disabled = false;
          $('input-mode').querySelector('[value="control"]').disabled = !remoteInput;
          if (!remoteInput) {
            $('input-mode').value = 'view';
            send({ type: 'release-input' });
          }
          updateControlStatus();
          await api.clipboardPermission(token, $('session-clipboard').checked && remoteClipboard);
        }
        clipboardBaseline = null;
        break;
      case 'clipboard':
        if (clipboardEnabled() && remoteClipboard) {
          clipboardBaseline = m.text;
          await api.clipboardWrite(token, m.text);
        }
        break;
      case 'quality':
        if (gate.role === 'host') {
          if (quality !== m.value) adaptive.reset();
          quality = m.value;
          adaptive.reset();
          await applyQuality();
        }
        break;
      case 'cursor':
        if (gate.role === 'controller' && m.videoKey === videoKey) {
          const paused = m.control === 'local' || m.control === 'manual';
          if (paused && !remotePaused) releaseInput(false);
          remotePaused = paused;
          $('input-help').textContent =
            m.control === 'manual'
              ? 'Ekran sahibi uzak kontrolü duraklattı. İşaretçi kullanılabilir.'
              : paused
                ? 'Ekran sahibi faresini kullanıyor; uzak fare ve klavye bekliyor.'
                : 'Ekran sahibi faresini kullanırken uzak fare ve klavye bekler.';
          lastCursor = m;
          updateControlStatus();
          positionCursor();
        }
        break;
      case 'pointer':
        if (gate.role === 'host' && m.videoKey === videoKey) await api.pointer(token, m);
        break;
      case 'video-info':
        if (gate.role === 'controller' && m.videoKey === videoKey) {
          diagnostics.record('video', { ...m, profile: quality });
          videoInfo = m;
          updateQualityStatus();
        }
        break;
      default:
        if (m.type.startsWith('file-')) {
          if (m.type === 'file-reply') receiveFileReply(m);
          else {
            if (queuedFileMessages >= 4) {
              cleanup('Geçersiz dosya aktarım trafiği.');
              return;
            }
            queuedFileMessages++;
            fileQueue = fileQueue
              .then(() => receiveFileMessage(conn, m))
              .catch((err) => {
                if (gate.connection === conn) {
                  cancelTransfer(true);
                  toast(errorText(err), true);
                }
              })
              .finally(() => queuedFileMessages--);
          }
        }
    }
  }
  function applyQuality() {
    const ownerStream = stream,
      ownerMedia = media,
      requested = quality;
    const task = qualityQueue.then(() => configureQuality(ownerStream, ownerMedia, requested));
    qualityQueue = task.catch(() => {});
    return task;
  }
  async function configureQuality(ownerStream, ownerMedia, requested) {
    if (
      !ownerStream ||
      !ownerMedia?.peerConnection ||
      stream !== ownerStream ||
      media !== ownerMedia
    )
      return;
    const track = ownerStream.getVideoTracks()[0];
    if (!track) return;
    const settings = track.getSettings();
    const p = adaptive.limits(qualitySettings(requested, settings.width, settings.height));
    track.contentHint = p.hint;
    await track.applyConstraints({ frameRate: { ideal: p.fps, max: p.fps } }).catch(qualityFailed);
    if (stream !== ownerStream || media !== ownerMedia) return;
    for (const sender of ownerMedia.peerConnection.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      const params = sender.getParameters();
      if (!params.encodings?.length) continue;
      for (const enc of params.encodings) {
        enc.scaleResolutionDownBy = p.scale;
        enc.maxBitrate = p.bitrate;
        enc.maxFramerate = p.fps;
      }
      params.degradationPreference = p.degradation;
      await sender.setParameters(params).catch(qualityFailed);
    }
  }
  function qualityFailed() {
    diagnostics.record('quality', { state: 'unsupported' });
    if (qualityWarning) return;
    qualityWarning = true;
    toast(
      'Bazı görüntü hedefleri uygulanamadı. Donanımın desteklediği ayarlar kullanılıyor.',
      true,
    );
  }
  function clipboardEnabled() {
    return gate.role === 'host' ? $('host-clipboard').checked : $('session-clipboard').checked;
  }
  function startSession() {
    clearInterval(heartbeat);
    clearInterval(clipTimer);
    clearInterval(cursorTimer);
    clearInterval(pointerTimer);
    lastCursorPacket = '';
    inputSequence = 0;
    lastPointerSent = 0;
    lastPong = Date.now();
    const verificationOwner = gate.connection;
    $('host-code').textContent = $('session-code').textContent = 'Doğrulama kodu bekleniyor';
    window.RKScreenVerification.verificationCode(verificationOwner?.peerConnection)
      .then((code) => {
        if (gate.connection !== verificationOwner || !gate.approved) return;
        $('host-code').textContent = $('session-code').textContent = code
          ? 'Kod: ' + code
          : 'Doğrulama kodu alınamadı';
      })
      .catch(() => {});
    adaptive.reset();
    recoveryBudget = new RecoveryBudget();
    qualityWarning = false;
    oldStats = null;
    clipboardBaseline = null;
    remotePaused = false;
    $('host-pause').setAttribute('aria-pressed', 'false');
    $('host-pause').textContent = 'Kontrolü duraklat';
    $('chat-partner').textContent = connectedName;
    const owner = gate.connection;
    let pollingCursor = false;
    cursorTimer = setInterval(async () => {
      if (
        pollingCursor ||
        gate.connection !== owner ||
        gate.role !== 'host' ||
        !token ||
        hostVideoPending
      )
        return;
      pollingCursor = true;
      const currentKey = videoKey;
      try {
        const p = await api.cursor(token);
        if (
          gate.connection !== owner ||
          videoKey !== currentKey ||
          !p ||
          ((!liveLane?.channel || liveLane.channel.readyState !== 'open') &&
            (owner.dataChannel?.bufferedAmount || 0) > 16384)
        )
          return;
        const signature = JSON.stringify(p);
        if (signature !== lastCursorPacket || Date.now() - lastCursorSent > 1000) {
          if (!send({ type: 'cursor', ...p, videoKey: currentKey })) return;
          lastCursorPacket = signature;
          lastCursorSent = Date.now();
        }
      } catch {
      } finally {
        pollingCursor = false;
      }
    }, 50);
    pointerTimer = setInterval(() => {
      if (
        !pendingPointer ||
        gate.connection !== owner ||
        refreshingVideo ||
        ((!liveLane?.channel || liveLane.channel.readyState !== 'open') &&
          (owner.dataChannel?.bufferedAmount || 0) > 16384)
      )
        return;
      if (Date.now() - lastPointerSent > 750 || pendingPointer.changed) {
        if (send({ type: 'pointer', ...pendingPointer, videoKey })) {
          pendingPointer.changed = false;
          lastPointerSent = Date.now();
        }
      }
    }, 40);
    let measuring = false;
    heartbeat = setInterval(async () => {
      if (gate.connection !== owner || !gate.approved) return;
      if (Date.now() - lastPong > 30000) {
        cleanup('Bağlantı yanıt vermiyor.');
        return;
      }
      send({ type: 'ping', time: performance.now() });
      if (measuring) return;
      measuring = true;
      try {
        if (media?.peerConnection) {
          const currentMedia = media,
            currentKey = videoKey;
          const stats = await media.peerConnection.getStats();
          if (gate.connection !== owner || media !== currentMedia || videoKey !== currentKey)
            return;
          const route = selectedRoute(stats);
          fileBitrate = Math.max(64000, Math.min(2000000, (route.available || 4000000) * 0.25));
          const routeLabel =
            route.route === 'relay'
              ? 'Aktarma sunucusu'
              : route.route === 'direct'
                ? 'Doğrudan'
                : 'Rota —';
          $('stat-network').textContent = routeLabel;
          $('stat-network').title =
            'Medya gecikmesi: ' + (route.rtt === null ? '—' : Math.round(route.rtt) + ' ms');
          let changed = false;
          stats.forEach((r) => {
            if (gate.role === 'host' && r.type === 'outbound-rtp' && r.kind === 'video') {
              const source = stream?.getVideoTracks()[0]?.getSettings() || {};
              const profile = qualitySettings(quality, source.width, source.height);
              changed =
                adaptive.update(profile, {
                  ...route,
                  limitation: r.qualityLimitationReason,
                  loss: window.RKScreenTransport.remoteLoss(stats.get(r.remoteId)),
                }) || changed;
              const effective = adaptive.limits(profile);
              diagnostics.record('video', {
                profile: quality,
                limitation: r.qualityLimitationReason,
                route: route.route || 'unknown',
                rtt: route.rtt,
                available: route.available,
                sourceWidth: source.width,
                sourceHeight: source.height,
                sentWidth: r.frameWidth,
                sentHeight: r.frameHeight,
                targetFps: effective.fps,
                maxBitrate: effective.bitrate,
              });
              send({
                type: 'video-info',
                targetFps: effective.fps,
                maxBitrate: effective.bitrate,
                videoKey,
                sourceWidth: source.width || 0,
                sourceHeight: source.height || 0,
                sentWidth: r.frameWidth || 0,
                sentHeight: r.frameHeight || 0,
                limitation: ['none', 'cpu', 'bandwidth', 'other'].includes(
                  r.qualityLimitationReason,
                )
                  ? r.qualityLimitationReason
                  : 'unknown',
              });
            }
            if (r.type === 'inbound-rtp' && r.kind === 'video') {
              const sample = receiveSample(r, oldStats);
              diagnostics.record('receive', {
                ...sample,
                route: route.route || 'unknown',
                rtt: route.rtt,
              });
              $('stat-fps').textContent =
                sample.fps === null ? '— FPS' : Math.round(sample.fps) + ' FPS';
              $('stat-rate').textContent =
                sample.mbps === null ? '— Mbps' : sample.mbps.toFixed(1) + ' Mbps';
              $('stat-network').textContent =
                routeLabel +
                (sample.loss === null ? '' : ' · %' + sample.loss.toFixed(1) + ' kayıp');
              oldStats = sample.previous;
            }
          });
          if (changed) await applyQuality();
        }
      } catch {
      } finally {
        measuring = false;
      }
    }, 2000);
    let reading = false;
    clipTimer = setInterval(async () => {
      if (reading || !token || !clipboardEnabled() || !remoteClipboard) return;
      reading = true;
      try {
        const text = await api.clipboardRead(token);
        if (gate.connection !== owner || text === null) return;
        if (clipboardBaseline === null) {
          clipboardBaseline = text;
          return;
        }
        if (text !== clipboardBaseline) {
          clipboardBaseline = text;
          send({ type: 'clipboard', text });
        }
      } catch {
      } finally {
        reading = false;
      }
    }, 1200);
  }
  function cleanup(reason) {
    const conn = gate.connection,
      oldToken = token;
    if (conn?.open && gate.approved) send({ type: 'bye' }, conn);
    releaseInput();
    gate.reset();
    liveLane?.close();
    liveLane = null;
    videoKey = null;
    hostVideoPending = false;
    restartingVideo = false;
    activeSource = null;
    switchSources = [];
    switchRevision++;
    $('switch-cancel').disabled = false;
    $('screen-dialog').close();
    $('host-screen').disabled = false;
    refreshingVideo = false;
    $('refresh-video').disabled = false;
    token = null;
    clearTimeout(connectTimer);
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
    clearInterval(heartbeat);
    clearInterval(clipTimer);
    clearInterval(cursorTimer);
    clearInterval(pointerTimer);
    pendingPointer = null;
    videoInfo = null;
    $('quality-status').textContent = 'Görüntü bilgisi bekleniyor';
    clearTimeout(fileTimer);
    if (fileWaiter) {
      const w = fileWaiter;
      fileWaiter = null;
      clearTimeout(w.timer);
      w.reject(new Error('Aktarım iptal edildi.'));
    }
    transfer?.chunks?.cancel(new Error('Bağlantı sona erdi.'));
    transfer?.abort?.abort();
    outgoingFiles = [];
    transfer = null;
    $('transfer-panel').hidden = true;
    $('file-approval').hidden = true;
    if (stream) {
      const old = stream;
      stream = null;
      old.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
    }
    const oldMedia = media;
    media = null;
    try {
      oldMedia?.close();
    } catch {}
    try {
      conn?.close();
    } catch {}
    ending = ending.then(() => (oldToken ? api.end(oldToken).catch(() => {}) : undefined));
    $('remote-video').srcObject = null;
    $('remote-video').muted = true;
    $('remote-session').hidden = true;
    $('host-session').hidden = true;
    $('chat-panel').hidden = true;
    $('incoming-dialog').close();
    $('video-wait').hidden = false;
    $('remote-cursor').hidden = true;
    lastCursor = null;
    $('stat-ping').textContent = '— ms';
    $('stat-resolution').textContent = '—';
    $('stat-fps').textContent = '— FPS';
    $('stat-rate').textContent = '— Mbps';
    $('stat-network').textContent = 'Rota —';
    $('stat-network').title = '';
    for (const item of pendingChats.values()) clearTimeout(item.timer);
    pendingChats.clear();
    receivedChats.clear();
    $('chat-input').value = '';
    $('chat-search').value = '';
    $('chat-count').textContent = '0 / 4000';
    $('chat-new').hidden = true;
    $('chat-messages').replaceChildren();
    unread = 0;
    $('chat-unread').hidden = true;
    pressedButtons.clear();
    remoteInput = false;
    remotePaused = false;
    remoteClipboard = false;
    $('host-code').textContent = $('session-code').textContent = 'Doğrulama kodu bekleniyor';
    clipboardBaseline = null;
    refreshControls();
    message(reason || 'Bağlantı, karşı tarafın onayıyla başlar.', !!reason);
    if (reason) toast(reason);
    // A destroyed signaling peer could not be replaced while the session was active.
    if (!online && peer) reconnectSignaling(peer);
    return ending;
  }

  function addChat(text, mine, id) {
    const root = $('chat-messages');
    const nearBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 48;
    root.querySelector('.empty-chat')?.remove();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble' + (mine ? ' mine' : '');
    bubble.dataset.messageId = id;
    bubble.dataset.time = String(Date.now());
    bubble.dataset.text = text;
    bubble.dataset.mine = String(mine);
    const body = document.createElement('p');
    body.className = 'chat-text';
    body.textContent = text;
    bubble.append(body);
    const time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    bubble.append(time);
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'text-button chat-copy';
    copy.textContent = 'Kopyala';
    copy.addEventListener('click', () =>
      api
        ?.copyText?.(text)
        .then(() => toast('Mesaj kopyalandı.'))
        .catch((err) => toast(errorText(err), true)),
    );
    bubble.append(copy);
    if (mine) {
      const status = document.createElement('span');
      status.className = 'chat-delivery';
      status.setAttribute('role', 'status');
      bubble.append(status);
      const retry = document.createElement('button');
      retry.className = 'text-button chat-retry';
      retry.textContent = 'Yeniden dene';
      retry.type = 'button';
      retry.hidden = true;
      bubble.append(retry);
      const item = { id, text, status, retry, timer: null, connection: gate.connection };
      pendingChats.set(id, item);
      retry.addEventListener('click', () => deliverChat(item));
    }
    root.append(bubble);
    filterChat();
    while (root.children.length > 200) {
      const old = root.firstChild,
        item = pendingChats.get(old.dataset.messageId);
      if (item) clearTimeout(item.timer);
      pendingChats.delete(old.dataset.messageId);
      old.remove();
    }
    if (mine || nearBottom) {
      root.scrollTop = root.scrollHeight;
      $('chat-new').hidden = true;
    } else $('chat-new').hidden = false;
    if (!mine && $('chat-panel').hidden) {
      unread++;
      $('chat-unread').hidden = false;
      $('chat-unread').textContent = unread > 99 ? '99+' : String(unread);
      toast('Yeni sohbet mesajı');
    }
  }
  function filterChat() {
    const query = $('chat-search').value.toLocaleLowerCase('tr-TR');
    for (const bubble of $('chat-messages').querySelectorAll('.chat-bubble'))
      bubble.hidden = !bubble.dataset.text.toLocaleLowerCase('tr-TR').includes(query);
  }
  function deliverChat(item) {
    clearTimeout(item.timer);
    item.retry.hidden = true;
    item.status.textContent = 'Gönderiliyor…';
    const failed = () => {
      item.status.textContent = 'Teslim doğrulanamadı';
      item.retry.hidden = false;
    };
    if (
      !gate.approved ||
      gate.connection !== item.connection ||
      !send({ type: 'chat', id: item.id, text: item.text })
    ) {
      failed();
      return;
    }
    item.timer = setTimeout(failed, 10000);
  }
  function submitChat() {
    const text = $('chat-input').value.trim();
    if (!text || text.length > 4000 || !gate.approved) return;
    const id = crypto.randomUUID();
    addChat(text, true, id);
    deliverChat(pendingChats.get(id));
    $('chat-input').value = '';
    $('chat-count').textContent = '0 / 4000';
    $('chat-input').focus();
  }
  function openChat() {
    if (!gate.approved) return;
    $('chat-panel').hidden = false;
    unread = 0;
    $('chat-unread').hidden = true;
    $('chat-input').focus();
  }
  function canControl() {
    return (
      gate.approved &&
      gate.role === 'controller' &&
      remoteInput &&
      !remotePaused &&
      !refreshingVideo &&
      $('video-wait').hidden &&
      $('input-mode').value === 'control'
    );
  }
  function updateControlStatus() {
    if (refreshingVideo) {
      $('session-state').textContent = 'Görüntü hazırlanıyor · Kontrol beklemede';
      return;
    }
    if (remotePaused) {
      $('session-state').textContent = 'Ekran sahibinde kontrol · Uzak girdi bekliyor';
      return;
    }
    if ($('input-mode').value === 'point') {
      $('session-state').textContent = 'İşaretleme · Tıklama ve klavye gönderilmez';
      return;
    }
    const active = canControl();
    $('session-state').textContent = !remoteInput
      ? 'İzleme · Karşı taraf kontrol izni vermedi'
      : !active
        ? 'Yalnızca izleme · Kontrol modu kapalı'
        : document.activeElement === $('viewport')
          ? 'Fare ve klavye kontrolü açık'
          : 'Kontrol hazır · Uzak ekrana tıklayın';
  }
  function coords(e, clamp = false) {
    const video = $('remote-video');
    return coordinates(
      $('video-stage').getBoundingClientRect(),
      video.videoWidth,
      video.videoHeight,
      $('scale').value,
      e.clientX,
      e.clientY,
      clamp,
      window.devicePixelRatio,
    );
  }
  function positionCursor() {
    if (refreshingVideo) return;
    const video = $('remote-video'),
      stage = $('video-stage');
    const g = geometry(
      { left: 0, top: 0, width: stage.clientWidth, height: stage.clientHeight },
      video.videoWidth,
      video.videoHeight,
      $('scale').value,
      window.devicePixelRatio,
    );
    const ownVisible = !!(ownCursor?.visible && g && !refreshingVideo);
    $('self-cursor').hidden = !ownVisible;
    $('viewport').classList.toggle('viewport-pointer-active', ownVisible);
    if (ownVisible) {
      $('self-cursor').style.left = g.left + ownCursor.x * g.width + 'px';
      $('self-cursor').style.top = g.top + ownCursor.y * g.height + 'px';
      $('self-cursor').classList.toggle('label-left', ownCursor.x > 0.75);
      $('self-cursor').classList.toggle('label-above', ownCursor.y > 0.8);
    }
    if (!lastCursor?.visible || !g) {
      $('remote-cursor').hidden = true;
      return;
    }
    $('remote-cursor').style.left = g.left + lastCursor.x * g.width + 'px';
    $('remote-cursor').style.top = g.top + lastCursor.y * g.height + 'px';
    $('remote-cursor').classList.toggle('label-left', lastCursor.x > 0.75);
    $('remote-cursor').classList.toggle('label-above', lastCursor.y > 0.8);
    $('remote-cursor').hidden = false;
  }
  function flushMouse() {
    clearTimeout(mouseTimer);
    mouseTimer = null;
    if (!pendingMouse || !canControl()) {
      pendingMouse = null;
      return;
    }
    if (
      (!liveLane?.channel || liveLane.channel.readyState !== 'open') &&
      (gate.connection?.dataChannel?.bufferedAmount || 0) > 16384
    ) {
      mouseTimer = setTimeout(flushMouse, 16);
      return;
    }
    const p = pendingMouse;
    pendingMouse = null;
    lastMouse = performance.now();
    send({ type: 'mouse-move', ...p });
  }
  function releaseInput(clearPointer = true) {
    if (clearPointer) {
      ownCursor = null;
      $('self-cursor').hidden = true;
      $('viewport').classList.remove('viewport-pointer-active');
      pendingPointer = null;
    }
    if (clearPointer && gate.approved && gate.role === 'controller' && videoKey)
      send({ type: 'pointer', x: 0, y: 0, visible: false, videoKey });
    clearTimeout(mouseTimer);
    mouseTimer = null;
    pendingMouse = null;
    unicodeKeys.clear();
    if (gate.approved && gate.role === 'controller') send({ type: 'release-input' });
    pressedButtons.clear();
  }
  function setupInput() {
    const viewport = $('viewport');
    viewport.addEventListener('pointermove', (e) => {
      if (!gate.approved || gate.role !== 'controller' || refreshingVideo) return;
      const p = coords(e, pressedButtons.size > 0);
      ownCursor = { ...(p || { x: 0, y: 0 }), visible: !!p };
      positionCursor();
      pendingPointer = { ...(p || { x: 0, y: 0 }), visible: !!p, changed: true };
      if (!canControl()) return;
      if (!p) return;
      lastCoords = p;
      pendingMouse = p;
      if (!mouseTimer)
        mouseTimer = setTimeout(flushMouse, Math.max(0, 8 - (performance.now() - lastMouse)));
    });
    viewport.addEventListener('pointerdown', (e) => {
      viewport.focus();
      if (
        gate.approved &&
        gate.role === 'controller' &&
        !refreshingVideo &&
        $('input-mode').value === 'point'
      ) {
        const p = coords(e);
        if (p) {
          e.preventDefault();
          send({ type: 'pointer', ...p, visible: true, pulse: true, videoKey });
          $('self-cursor').classList.add('pulse');
          setTimeout(() => $('self-cursor').classList.remove('pulse'), 900);
        }
        return;
      }
      if (!canControl() || e.button > 2) return;
      const p = coords(e);
      if (!p) return;
      e.preventDefault();
      lastCoords = p;
      pendingMouse = null;
      viewport.setPointerCapture(e.pointerId);
      const button = ['left', 'middle', 'right'][e.button];
      pressedButtons.add(button);
      send({ type: 'mouse-button', button, pressed: true, ...p });
    });
    viewport.addEventListener('pointerup', (e) => {
      const button = ['left', 'middle', 'right'][e.button];
      if (!pressedButtons.has(button)) return;
      pressedButtons.delete(button);
      flushMouse();
      send({ type: 'mouse-button', button, pressed: false, ...(coords(e, true) || lastCoords) });
      if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
    });
    viewport.addEventListener('lostpointercapture', () => {
      if (pressedButtons.size) releaseInput();
    });
    viewport.addEventListener('pointercancel', releaseInput);
    viewport.addEventListener('pointerleave', () => {
      ownCursor = null;
      positionCursor();
      pendingPointer = { x: 0, y: 0, visible: false, changed: true };
    });
    viewport.addEventListener('focus', updateControlStatus);
    viewport.addEventListener('contextmenu', (e) => e.preventDefault());
    viewport.addEventListener(
      'wheel',
      (e) => {
        if (!canControl()) return;
        e.preventDefault();
        const factor = e.deltaMode === 1 ? 30 : e.deltaMode === 2 ? 300 : 1;
        send({
          type: 'mouse-wheel',
          dx: Math.max(-2000, Math.min(2000, e.deltaX * factor)),
          dy: Math.max(-2000, Math.min(2000, e.deltaY * factor)),
        });
      },
      { passive: false },
    );
    for (const event of ['keydown', 'keyup'])
      viewport.addEventListener(event, (e) => {
        if (!canControl() || e.key === 'F11') return;
        e.preventDefault();
        if (e.isComposing || e.key === 'Dead') return;
        const printable =
          [...e.key].length === 1 &&
          ((!e.ctrlKey && !e.metaKey && !e.altKey) || e.getModifierState('AltGraph'));
        if (event === 'keyup' && unicodeKeys.delete(e.code)) return;
        if (event === 'keydown' && printable) {
          unicodeKeys.add(e.code);
          send({ type: 'text', text: e.key });
          return;
        }
        send({ type: 'key', code: e.code, pressed: event === 'keydown' });
      });
    viewport.addEventListener('compositionend', (e) => {
      if (canControl() && e.data) for (const char of e.data) send({ type: 'text', text: char });
    });
    viewport.addEventListener('blur', () => {
      releaseInput();
      updateControlStatus();
    });
    window.addEventListener('blur', releaseInput);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseInput();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F11' && gate.role === 'controller') {
        e.preventDefault();
        api.fullscreen().catch(() => {});
      }
    });
    new ResizeObserver(refreshVideoLayout).observe(viewport);
    window.addEventListener('resize', refreshVideoLayout);
  }
  function bytes(n) {
    return n < 1024
      ? n + ' B'
      : n < 1048576
        ? (n / 1024).toFixed(1) + ' KB'
        : (n / 1048576).toFixed(1) + ' MB';
  }
  function transferUI(title, filename, status, percent = 0) {
    $('transfer-panel').hidden = false;
    $('transfer-title').textContent = title;
    $('transfer-name').textContent = String(filename).replace(
      /[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g,
      '_',
    );
    $('transfer-status').textContent = status;
    $('transfer-progress').value = percent;
  }
  function transferStatus(task, count) {
    const now = performance.now();
    task.startedAt ??= now;
    const seconds = (now - task.startedAt) / 1000;
    const rate = seconds >= 1 ? count / seconds : 0;
    const remaining = rate > 0 ? Math.ceil(Math.max(0, task.size - count) / rate) : 0;
    return (
      bytes(count) +
      ' / ' +
      bytes(task.size) +
      (rate ? ' · ' + bytes(rate) + '/sn' : '') +
      (remaining > 0
        ? ' · Yaklaşık ' + (remaining < 60 ? remaining + ' sn' : Math.ceil(remaining / 60) + ' dk')
        : '')
    );
  }
  function receiveFileReply(m) {
    if (!transfer || m.id !== transfer.id) return;
    if (m.status === 'chunk' && transfer.chunks) {
      transfer.chunks.acknowledge(m.id, m.index);
      return;
    }
    if (['error', 'reject', 'cancel'].includes(m.status)) {
      if (fileWaiter) {
        const w = fileWaiter;
        fileWaiter = null;
        clearTimeout(w.timer);
        w.reject(
          new Error(
            m.status === 'reject' ? 'Dosya isteği reddedildi.' : 'Dosya aktarımı durduruldu.',
          ),
        );
      } else cancelTransfer(false);
      return;
    }
    if (
      fileWaiter &&
      fileWaiter.status === m.status &&
      (m.status !== 'chunk' || m.index === fileWaiter.index)
    ) {
      const w = fileWaiter;
      fileWaiter = null;
      clearTimeout(w.timer);
      w.resolve(m);
    }
  }
  function sendAndWait(data, status, index) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => {
          fileWaiter = null;
          reject(new Error('Dosya aktarımı zaman aşımına uğradı.'));
        },
        status === 'accept' ? 60000 : 20000,
      );
      fileWaiter = { resolve, reject, status, index, timer };
      if (!send(data)) {
        clearTimeout(timer);
        fileWaiter = null;
        reject(new Error('Bağlantı kesildi.'));
      }
    });
  }
  async function cancelTransfer(notify = true) {
    const previous = transfer;
    transfer = null;
    previous?.abort?.abort();
    outgoingFiles = [];
    updateFileQueue();
    previous?.chunks?.cancel();
    clearTimeout(fileTimer);
    if (fileWaiter) {
      const w = fileWaiter;
      fileWaiter = null;
      clearTimeout(w.timer);
      w.reject(new Error('Aktarım iptal edildi.'));
    }
    if (previous && notify) send({ type: 'file-reply', id: previous.id, status: 'cancel' });
    $('file-approval').hidden = true;
    $('transfer-panel').hidden = true;
    if (token) await api.cancelFile(token).catch(() => {});
  }
  async function sendFile(droppedFile) {
    if (!token || !gate.approved || selectingFile) return;
    if (transfer && !api.pickFiles) {
      toast('Önce devam eden aktarımı bitirin.');
      return;
    }
    const owner = gate.connection,
      currentToken = token;
    selectingFile = true;
    let selected;
    try {
      if (api.pickFiles)
        selected = await api.pickFiles(
          currentToken,
          droppedFile ? (Array.isArray(droppedFile) ? droppedFile : [droppedFile]) : null,
        );
      else {
        const meta = droppedFile
          ? await api.droppedFile(currentToken, droppedFile)
          : await api.selectFile(currentToken);
        selected = meta ? [meta] : null;
      }
    } finally {
      selectingFile = false;
    }
    if (!selected?.length || gate.connection !== owner) return;
    outgoingFiles.push(...selected);
    updateFileQueue();
    await pumpFiles();
  }
  function updateFileQueue() {
    $('transfer-queue').textContent = outgoingFiles.length
      ? `Kuyrukta ${outgoingFiles.length} dosya · Her dosya için alıcı onayı gerekir.`
      : '';
  }
  async function pumpFiles() {
    if (drainingFiles || transfer || !gate.approved || !token) return;
    drainingFiles = true;
    const owner = gate.connection,
      currentToken = token;
    try {
      while (outgoingFiles.length && gate.connection === owner && !transfer) {
        const meta = outgoingFiles.shift();
        updateFileQueue();
        if (api.openFile) await api.openFile(currentToken, meta.id);
        if (gate.connection !== owner) return;
        await transmitFile(meta, owner, currentToken);
      }
    } catch (err) {
      if (gate.connection === owner) {
        await cancelTransfer();
        toast(errorText(err), true);
      }
    } finally {
      drainingFiles = false;
      if (outgoingFiles.length && !transfer && gate.approved)
        queueMicrotask(() => pumpFiles().catch((err) => toast(errorText(err), true)));
    }
  }
  async function transmitFile(meta, owner, currentToken) {
    transfer = { ...meta, direction: 'out' };
    const task = transfer;
    task.abort = new AbortController();
    transferUI('Dosya gönderiliyor', meta.name, 'Karşı tarafın onayı bekleniyor…');
    $('file-approval').hidden = true;
    try {
      await sendAndWait({ type: 'file-offer', ...meta }, 'accept');
      task.startedAt = performance.now();
      task.chunks = new window.RKScreenTransfer.ChunkWindow(meta.id, (m) => send(m));
      const jobs = new Set();
      let failure;
      let index = 0;
      while (transfer === task && gate.connection === owner) {
        if (failure) throw failure;
        const part = await api.readFile(currentToken, meta.id);
        if (transfer !== task) return;
        if (part.done) {
          await Promise.all(jobs);
          if (failure) throw failure;
          if (transfer !== task || gate.connection !== owner) return;
          await sendAndWait({ type: 'file-end', id: meta.id, hash: part.hash }, 'saved');
          if (transfer !== task) return;
          transferUI('Dosya gönderildi', meta.name, 'Karşı bilgisayara kaydedildi.', 100);
          transfer = null;
          return;
        }
        // SCTP file traffic and video use separate peer connections. Bound file
        // uploads so a large transfer cannot consume all of the video uplink.
        await window.RKScreenTransfer.paceChunk(
          Math.min(32768, meta.size - index * 32768),
          fileBitrate,
          task.abort.signal,
        );
        if (transfer !== task || gate.connection !== owner) return;
        const job = task.chunks
          .send({ type: 'file-chunk', id: meta.id, index, data: part.data })
          .then(
            () => {
              if (transfer !== task) return;
              task.confirmedBytes = Math.max(task.confirmedBytes || 0, part.bytes);
              transferUI(
                'Dosya gönderiliyor',
                meta.name,
                transferStatus(task, task.confirmedBytes),
                meta.size ? (task.confirmedBytes / meta.size) * 100 : 100,
              );
            },
            (err) => {
              failure ??= err;
            },
          );
        jobs.add(job);
        job.then(() => jobs.delete(job));
        index++;
        if (jobs.size >= 3) await Promise.race(jobs);
      }
    } catch (err) {
      if (transfer === task) {
        await cancelTransfer();
        toast(errorText(err), true);
      }
    }
  }
  async function receiveFileMessage(conn, m) {
    if (!gate.allows(conn) || !token) return;
    if (m.type === 'file-offer') {
      if (transfer || selectingFile) {
        send({ type: 'file-reply', id: m.id, status: 'reject' });
        return;
      }
      transfer = { ...m, direction: 'in', accepted: false, processing: false };
      transferUI(
        'Dosya alma isteği',
        m.name,
        bytes(m.size) + ' · Onay verirseniz İndirilenler’e kaydedilir.',
      );
      $('file-approval').hidden = false;
      fileTimer = setTimeout(() => cancelTransfer(true), 60000);
      return;
    }
    if (!transfer || transfer.direction !== 'in' || !transfer.accepted || transfer.id !== m.id)
      return;
    const task = transfer;
    clearTimeout(fileTimer);
    fileTimer = setTimeout(() => cancelTransfer(true), 30000);
    if (m.type === 'file-chunk') {
      const count = await api.writeChunk(token, m.id, m.index, m.data);
      if (transfer !== task) return;
      transferUI(
        'Dosya alınıyor',
        task.name,
        transferStatus(task, count),
        task.size ? (count / task.size) * 100 : 100,
      );
      send({ type: 'file-reply', id: m.id, status: 'chunk', index: m.index });
    } else if (m.type === 'file-end') {
      const result = await api.finishFile(token, m.id, m.hash);
      if (transfer !== task) return;
      clearTimeout(fileTimer);
      send({ type: 'file-reply', id: m.id, status: 'saved' });
      transferUI('Dosya kaydedildi', result.name, 'İndirilenler klasöründe hazır.', 100);
      transfer = null;
      pumpFiles().catch((err) => toast(errorText(err), true));
    }
  }
  async function acceptFile() {
    const task = transfer;
    if (!task || task.direction !== 'in' || task.accepted || task.processing) return;
    const owner = gate.connection,
      ownerToken = token;
    task.processing = true;
    try {
      await api.beginFile(ownerToken, task);
      if (transfer !== task || gate.connection !== owner || token !== ownerToken) return;
      task.accepted = true;
      task.startedAt = performance.now();
      $('file-approval').hidden = true;
      clearTimeout(fileTimer);
      send({ type: 'file-reply', id: task.id, status: 'accept' });
      fileTimer = setTimeout(() => cancelTransfer(true), 30000);
      transferUI('Dosya alınıyor', task.name, 'Aktarım başlıyor…');
    } catch (err) {
      if (transfer !== task || gate.connection !== owner || token !== ownerToken) return;
      await cancelTransfer();
      toast(errorText(err), true);
    }
  }
  async function init() {
    if (api) {
      const info = await api.info();
      name = window.RKScreenPointer.cleanName(info.name);
      $('compatibility-mode').checked = info.compatibility === true;
      $('machine-name').textContent = name;
      const beta = /-beta\.(\d+)$/.exec(info.version);
      $('app-version').textContent =
        (beta ? 'Beta ' + beta[1] : 'Sürüm ' + info.version) +
        (info.build ? ' · ' + info.build : '');
      $('about-version').textContent = $('app-version').textContent;
    }
    deviceId = read('menzil_device_id_v3', '');
    if (!/^\d{9}$/.test(deviceId)) {
      deviceId = newDeviceId();
      write('menzil_device_id_v3', deviceId);
    }
    $('device-id').textContent = api ? formatted(deviceId) : '000 000 000';
    $('default-quality').value = prefs.quality;
    $('default-clipboard').checked = prefs.clipboard;
    $('allow-requests').checked = prefs.requests;
    renderRecents();
    setupInput();
    initPeer();
  }
  on('allow-requests', 'change', () => {
    prefs.requests = $('allow-requests').checked;
    write('menzil_preferences_v3', prefs);
    if (online) network('online', 'Bağlantıya hazır');
  });
  on('nav-home', 'click', () => showPage(false));
  on('host-pause', 'click', async () => {
    if (!token || gate.role !== 'host') return;
    const paused = $('host-pause').getAttribute('aria-pressed') !== 'true';
    await api.pauseControl(token, paused);
    $('host-pause').setAttribute('aria-pressed', String(paused));
    $('host-pause').textContent = paused ? 'Kontrolü sürdür' : 'Kontrolü duraklat';
    toast(
      paused
        ? 'Uzak fare ve klavye duraklatıldı. İşaretçi açık kalır.'
        : 'Uzak kontrol yeniden kullanılabilir.',
    );
  });
  on('check-update', 'click', async () => {
    if (!api?.checkUpdate) {
      $('update-result').textContent = 'Güncelleme kontrolü uygulamada kullanılabilir.';
      return;
    }
    $('check-update').disabled = true;
    $('download-update').hidden = true;
    $('update-result').textContent = 'GitHub’daki güncel yapı kontrol ediliyor…';
    try {
      const result = await api.checkUpdate();
      $('update-result').textContent =
        (result.available ? 'Yeni yapı var: ' : 'Yeni yapı bulunamadı. Yayındaki yapı: ') +
        result.build +
        (result.signed ? '' : ' · Setup imzasız; Windows engeli devam edebilir.');
      $('download-update').hidden = !result.available;
    } catch (err) {
      $('update-result').textContent = 'Kontrol tamamlanamadı: ' + errorText(err);
    } finally {
      $('check-update').disabled = false;
    }
  });
  on('download-update', 'click', () => api.openUpdate());
  on('device-cancel', 'click', () => $('device-dialog').close());
  $('device-form').addEventListener('submit', (e) => {
    e.preventDefault();
    write(
      'menzil_recents',
      window.RKScreenDevices.normalize(
        recentItems().map((v) =>
          v.id === editingDevice ? { ...v, alias: $('device-alias').value } : v,
        ),
      ),
    );
    $('device-dialog').close();
    renderRecents();
  });
  on('compatibility-mode', 'change', async () => {
    await api.compatibility($('compatibility-mode').checked);
    toast('Ayar kaydedildi. RK Screen’i kapatıp açınca uygulanır.');
  });
  on('nav-settings', 'click', () => showPage(true));
  document.querySelector('.brand').addEventListener('click', (e) => {
    e.preventDefault();
    showPage(false);
  });
  for (const id of ['about-button', 'help-button'])
    on(id, 'click', () => $('info-dialog').showModal());
  on('close-info', 'click', () => $('info-dialog').close());
  for (const id of ['report-settings', 'report-session'])
    on(id, 'click', async () => {
      if (await api?.saveDiagnostics(diagnostics.snapshot())) toast('Bağlantı raporu kaydedildi.');
    });
  on('network-check', 'click', async () => {
    if (!api || gate.connection) {
      toast('Ağ testi için açık oturumu bitirin.');
      return;
    }
    const button = $('network-check');
    button.disabled = true;
    $('network-check-result').textContent = 'Ağ bağlantısı kontrol ediliyor…';
    try {
      const config = await api.connectionConfig();
      const result = await window.RKScreenNetworkCheck.checkNetwork(config);
      const hasRelay = config.iceServers.some((s) =>
        [].concat(s.urls).some((u) => /^turns?:/.test(u)),
      );
      $('network-check-result').textContent =
        (result.public
          ? 'İnternet bağlantı adayı bulundu. '
          : 'Doğrudan internet bağlantısı bu testte doğrulanamadı. ') +
        (result.relay
          ? 'Aktarma bağlantı adayı bulundu. '
          : hasRelay
            ? 'Ayarlanan aktarma sunucusundan yanıt alınamadı. '
            : 'Aktarma sunucusu ayarlı değil. ') +
        'Bu kontrol karşı bilgisayarla bağlantı garantisi vermez.';
      diagnostics.record('connection', {
        state: result.public || result.relay ? 'online' : 'offline',
      });
    } catch (err) {
      $('network-check-result').textContent = 'Test tamamlanamadı: ' + errorText(err);
    } finally {
      button.disabled = false;
    }
  });
  if (api?.connectionSettings)
    api
      .connectionSettings()
      .then((settings) => {
        $('relay-url').value = settings.url;
        $('relay-user').value = settings.username;
        $('relay-password').placeholder = settings.hasPassword
          ? 'Kaydedilmiş · Değiştirmek için yazın'
          : '';
      })
      .catch(() => {});
  on('relay-save', 'click', async () => {
    if (!api) return;
    await api.saveConnectionSettings({
      url: $('relay-url').value,
      username: $('relay-user').value,
      password: $('relay-password').value,
    });
    $('relay-password').value = '';
    $('relay-password').placeholder = $('relay-url').value
      ? 'Kaydedilmiş · Değiştirmek için yazın'
      : '';
    toast('Bağlantı sunucusu ayarı kaydedildi.');
    await initPeer();
  });
  on('retry', 'click', () => {
    if (!gate.connection) initPeer();
    else toast('Yeniden denemek için mevcut oturumu bitirin.');
  });
  on('remote-id', 'input', (e) => {
    e.target.value = e.target.value
      .replace(/\D/g, '')
      .slice(0, 9)
      .replace(/(\d{3})(?=\d)/g, '$1 ');
  });
  $('connect-form').addEventListener('submit', (e) => {
    e.preventDefault();
    connect($('remote-id').value.replace(/\D/g, '')).catch((err) => toast(errorText(err), true));
  });
  on('cancel-connect', 'click', () => cleanup());
  on('copy-id', 'click', async () => {
    await api.copyId(formatted(deviceId));
    toast('Cihaz kimliği kopyalandı.');
  });
  on('source-select', 'change', updateSource);
  on('accept', 'click', accept);
  on('reject', 'click', () => {
    send({ type: 'denied', reason: 'rejected' });
    cleanup();
  });
  $('incoming-dialog').addEventListener('cancel', (e) => {
    e.preventDefault();
    send({ type: 'denied', reason: 'rejected' });
    cleanup();
  });
  $('incoming-form').addEventListener('submit', (e) => e.preventDefault());
  on('host-stop', 'click', () => cleanup());
  on('host-pointer', 'change', () => {
    if (token) return api.pointerEnabled(token, $('host-pointer').checked);
  });
  on('host-screen', 'click', chooseScreen);
  on('switch-source', 'change', updateSwitchPreview);
  on('switch-confirm', 'click', switchScreen);
  on('switch-cancel', 'click', () => {
    switchRevision++;
    $('screen-dialog').close();
  });
  $('screen-dialog').addEventListener('cancel', (e) => {
    if ($('switch-cancel').disabled) e.preventDefault();
    else switchRevision++;
  });
  on('disconnect', 'click', () => cleanup());
  for (const id of ['host-input', 'host-clipboard'])
    on(id, 'change', async () => {
      if (!token) return;
      const permissions = {
        input: $('host-input').checked,
        clipboard: $('host-clipboard').checked,
      };
      await api.permissions(token, permissions);
      send({ type: 'permissions', ...permissions });
      clipboardBaseline = null;
    });
  on('session-clipboard', 'change', async () => {
    if (!token) return;
    await api.clipboardPermission(token, $('session-clipboard').checked && remoteClipboard);
    send({ type: 'permissions', input: false, clipboard: $('session-clipboard').checked });
    clipboardBaseline = null;
  });
  on('quality', 'change', () => {
    quality = $('quality').value;
    send({ type: 'quality', value: quality });
  });
  on('scale', 'change', () => {
    $('viewport').className = 'viewport scale-' + $('scale').value;
    positionCursor();
  });
  on('input-mode', 'change', () => {
    releaseInput();
    updateControlStatus();
    if (canControl()) $('viewport').focus();
  });
  on('audio-toggle', 'click', () => {
    const video = $('remote-video');
    video.muted = !video.muted;
    $('audio-toggle').textContent = video.muted ? 'Sesi aç' : 'Sesi kapat';
    $('audio-toggle').setAttribute('aria-pressed', String(!video.muted));
  });
  on('refresh-video', 'click', () => {
    if (!gate.approved || gate.role !== 'controller' || refreshingVideo) return;
    prepareControllerVideo();
    send({ type: 'refresh-video', videoKey });
  });
  on('fullscreen', 'click', () => api.fullscreen());
  function refreshVideoLayout() {
    const video = $('remote-video'),
      ratio = window.devicePixelRatio || 1;
    if (!video.videoWidth) return;
    $('video-stage').style.setProperty('--video-width', video.videoWidth / ratio + 'px');
    $('video-stage').style.setProperty('--video-height', video.videoHeight / ratio + 'px');
    $('stat-resolution').textContent = video.videoWidth + ' × ' + video.videoHeight;
    updateQualityStatus();
    positionCursor();
  }
  function updateQualityStatus() {
    if (!videoInfo || refreshingVideo) return;
    const m = videoInfo;
    const size = (w, h) => (w && h ? w + '×' + h : '—');
    const reason = {
      cpu: ' · İşlemci sınırı',
      bandwidth: ' · Ağ sınırı',
      other: ' · Kaynak sınırı',
      none: '',
      unknown: '',
    }[m.limitation];
    $('quality-status').textContent =
      'Kaynak ' +
      size(m.sourceWidth, m.sourceHeight) +
      ' · İletilen ' +
      size(m.sentWidth, m.sentHeight) +
      reason +
      (m.targetFps
        ? ' · Hedef ' +
          m.targetFps +
          ' FPS / ' +
          (m.maxBitrate / 1000000).toFixed(1) +
          ' Mbps tavan'
        : '');
  }
  $('remote-video').addEventListener('loadedmetadata', refreshVideoLayout);
  $('remote-video').addEventListener('resize', refreshVideoLayout);
  for (const id of ['host-chat', 'open-chat']) on(id, 'click', openChat);
  on('close-chat', 'click', () => ($('chat-panel').hidden = true));
  on('chat-search', 'input', filterChat);
  on('chat-export', 'click', async () => {
    if (!api?.exportChat || !gate.approved) return;
    const messages = [...$('chat-messages').querySelectorAll('.chat-bubble')].map((v) => ({
      text: v.dataset.text,
      mine: v.dataset.mine === 'true',
      time: Number(v.dataset.time),
    }));
    if (!messages.length) return toast('Kaydedilecek mesaj yok.');
    if (await api.exportChat(messages)) toast('Sohbet seçtiğiniz dosyaya kaydedildi.');
  });
  $('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitChat();
  });
  $('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submitChat();
    }
  });
  $('chat-input').addEventListener('input', () => {
    $('chat-count').textContent = $('chat-input').value.length + ' / 4000';
  });
  $('chat-new').addEventListener('click', () => {
    $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    $('chat-new').hidden = true;
  });
  $('chat-messages').addEventListener('scroll', () => {
    const r = $('chat-messages');
    if (r.scrollHeight - r.scrollTop - r.clientHeight < 48) $('chat-new').hidden = true;
  });
  for (const id of ['send-file', 'host-file']) on(id, 'click', () => sendFile());
  $('viewport').addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  $('viewport').addEventListener('drop', (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length)
      sendFile(api.pickFiles ? files : files[0]).catch((err) => toast(errorText(err), true));
  });
  on('accept-file', 'click', acceptFile);
  on('reject-file', 'click', () => cancelTransfer(true));
  on('cancel-file', 'click', () => cancelTransfer(true));
  on('default-quality', 'change', () => {
    prefs.quality = $('default-quality').value;
    write('menzil_preferences_v3', prefs);
    toast('Görüntü tercihi kaydedildi.');
  });
  on('default-clipboard', 'change', () => {
    prefs.clipboard = $('default-clipboard').checked;
    write('menzil_preferences_v3', prefs);
    toast('Pano tercihi kaydedildi.');
  });
  on('clear-recents', 'click', () => {
    write(
      'menzil_recents',
      recentItems().filter((v) => v.favorite),
    );
    renderRecents();
    toast('Bağlantı geçmişi temizlendi.');
  });
  on('clear-devices', 'click', () => {
    write('menzil_recents', []);
    renderRecents();
    toast('Favoriler ve kayıtlı cihazlar temizlendi.');
  });
  window.addEventListener('offline', () => {
    message(window.RKScreenErrors.explain('offline'), true);
    if (gate.approved) releaseInput();
    else if (gate.connection) cleanup(window.RKScreenErrors.explain('offline'));
  });
  window.addEventListener('online', () => {
    if (!gate.connection) initPeer();
  });
  window.addEventListener('beforeunload', () => {
    cleanup();
    peer?.destroy();
  });
  init().catch((err) => {
    network('offline', 'Uygulama hazırlanamadı');
    toast(errorText(err), true);
  });
})();
