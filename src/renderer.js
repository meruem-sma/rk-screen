/* UI coordination. Privileged operations are checked again in the main process. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id),
    api = window.rkScreen;
  const { SessionGate, validMessage, inputTypes, RequestLimiter, validVideoKey } =
    window.RKScreenSession;
  const requestLimiter = new RequestLimiter();
  const pendingChats = new Map(),
    receivedChats = new Set();
  const gate = new SessionGate(),
    PROTOCOL = 7;
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
  const { selectedRoute, receiveSample, AdaptiveQuality, RecoveryBudget } =
    window.RKScreenTransport;
  const adaptive = new AdaptiveQuality();
  let recoveryTimer = null,
    recoveryBudget = new RecoveryBudget(),
    qualityWarning = false;
  const { profiles, qualitySettings, geometry, coordinates } = window.RKScreenVideo;
  let peer,
    token = null,
    stream = null,
    media = null,
    refreshingVideo = false,
    sources = [],
    name = 'Bu bilgisayar',
    deviceId = '',
    connectedName = '';
  let quality = 'balanced',
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
    lastCursor = null;
  let transfer = null,
    fileWaiter = null,
    fileTimer = null,
    fileQueue = Promise.resolve(),
    selectingFile = false,
    queuedFileMessages = 0;
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
    quality: Object.hasOwn(profiles, savedPrefs?.quality) ? savedPrefs.quality : 'balanced',
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
    const list = read('menzil_recents', []);
    return Array.isArray(list) ? list.filter((x) => x && /^\d{9}$/.test(x.id)).slice(0, 5) : [];
  }
  function renderRecents() {
    const root = $('recents');
    root.replaceChildren();
    const items = recentItems();
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
      title.textContent = String(item.name || 'Uzak bilgisayar').slice(0, 80);
      caption.textContent = formatted(item.id);
      text.append(title, caption);
      const button = document.createElement('button');
      button.className = 'button small recent-connect';
      button.textContent = 'Bağlan';
      button.addEventListener('click', () => {
        $('remote-id').value = formatted(item.id);
        connect(item.id).catch((e) => toast(errorText(e), true));
      });
      row.append(icon, text, button);
      root.append(row);
    }
    refreshControls();
  }
  function saveRecent(id, remoteName) {
    write(
      'menzil_recents',
      [
        { id, name: remoteName, time: Date.now() },
        ...recentItems().filter((x) => x.id !== id),
      ].slice(0, 5),
    );
    renderRecents();
  }
  function newDeviceId() {
    return String(100000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000000));
  }
  function initPeer() {
    if (!api) {
      network('offline', 'Arayüz önizlemesi');
      $('retry').hidden = true;
      return;
    }
    clearTimeout(reconnectTimer);
    if (peer) {
      peer.removeAllListeners();
      peer.destroy();
    }
    network('waiting', 'Bağlantı hazırlanıyor');
    peer = new Peer('rkscreen-v7-' + deviceId, {
      debug: 0,
      config: {
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
          {
            urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443?transport=tcp'],
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
      },
    });
    peer.on('open', () => network('online', 'Bağlantıya hazır'));
    peer.on('disconnected', () => {
      network('offline', 'Bağlantı hizmetine erişilemiyor');
      reconnectTimer = setTimeout(() => {
        if (peer?.disconnected && !peer.destroyed) peer.reconnect();
      }, 5000);
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        if (gate.connection) cleanup();
        deviceId = newDeviceId();
        write('menzil_device_id_v3', deviceId);
        $('device-id').textContent = formatted(deviceId);
        reconnectTimer = setTimeout(initPeer, 1000);
        return;
      }
      if (err.type === 'peer-unavailable') {
        cleanup();
        message(
          'Cihaz bulunamadı. Kimliği ve karşı cihazdaki RK Screen sürümünü kontrol edin.',
          true,
        );
        return;
      }
      if (gate.connection && !gate.approved) cleanup();
      network('offline', 'Bağlantı kurulamadı');
      message('İnternet bağlantısını kontrol edin ve yeniden deneyin.', true);
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
      connectedName = String(conn.metadata.name || 'Uzak bilgisayar').slice(0, 80);
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
          'Cihaz kimliği: ' + formatted(conn.peer.replace('rkscreen-v7-', ''));
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
        saveRecent(call.peer.replace('rkscreen-v7-', ''), connectedName);
      });
    });
  }
  function scheduleVideoRecovery(call) {
    if (media !== call || !gate.approved || !gate.connection?.open) return;
    if (gate.role === 'controller') {
      if (!refreshingVideo) {
        prepareControllerVideo();
        send({ type: 'video-interrupted', videoKey });
      }
      return;
    }
    if (hostVideoPending || recoveryTimer) return;
    if (!recoveryBudget.take(Date.now())) {
      cleanup('Görüntü bağlantısı tekrar tekrar kesiliyor. Ağı kontrol edip yeniden bağlanın.');
      return;
    }
    const owner = gate.connection,
      ownerToken = token,
      key = videoKey;
    // Pause native input immediately, retaining the current capability until rebuild.
    api.videoState(ownerToken, { videoKey: key, displayId: activeSource.displayId }).catch(() => {
      if (gate.connection === owner && token === ownerToken)
        cleanup('Kontrol güvenli biçimde bekletilemedi.');
    });
    $('host-label').textContent = 'Bağlantı toparlanıyor · Kontrol beklemede';
    recoveryTimer = setTimeout(() => {
      recoveryTimer = null;
      if (gate.connection === owner && media === call && videoKey === key)
        restartHostVideo().catch(() => cleanup('Görüntü yeniden başlatılamadı.'));
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
    pc?.addEventListener('connectionstatechange', () => {
      if (media !== call) return;
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState))
        scheduleVideoRecovery(call);
      if (pc.connectionState === 'connected') reapply();
    });
  }
  function bindConnection(conn) {
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
      if (gate.connection === conn) cleanup('Veri bağlantısı kesildi.');
    });
  }
  async function connect(id) {
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
    const conn = peer.connect('rkscreen-v7-' + id, {
      reliable: true,
      metadata: { version: PROTOCOL, name },
    });
    gate.reserve(conn, 'controller');
    bindConnection(conn);
    refreshControls();
    message('Karşı bilgisayara bağlanılıyor…');
    armTimeout(25000, 'Cihaza ulaşılamadı. Her iki cihazın çevrimiçi olduğundan emin olun.');
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
    if (!gate.approved || gate.role !== 'host' || hostVideoPending || !source) return false;
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
    hostVideoPending = true;
    $('host-screen').disabled = true;
    const nextKey = crypto.randomUUID();
    try {
      await api.videoState(ownerToken, { videoKey: nextKey, displayId: source.displayId });
      if (gate.connection !== owner || token !== ownerToken) return false;
      videoKey = nextKey;
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
        message(
          {
            busy: 'Cihaz başka bir oturumda.',
            version: 'İki cihazda aynı RK Screen sürümünü kullanın.',
            disabled: 'Karşı cihaz gelen istekleri kapatmış.',
            rate: 'Çok sık bağlantı denendi. Bir dakika sonra tekrar deneyin.',
            capture: 'Karşı cihaz ekran paylaşımını başlatamadı.',
          }[m.reason] || 'Bağlantı isteği reddedildi.',
          true,
        );
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
      connectedName = String(m.name || 'Uzak bilgisayar').slice(0, 80);
      $('cursor-name').textContent = connectedName;
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
      $('session-clipboard').checked = prefs.clipboard;
      $('remote-name').textContent = connectedName;
      $('remote-session').hidden = false;
      prepareControllerVideo();
      $('input-mode').value = remoteInput ? 'control' : 'view';
      $('input-mode').disabled = !remoteInput;
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
    if (!validMessage(m) || !token) return;
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
          $('input-mode').disabled = !remoteInput;
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
          quality = m.value;
          adaptive.reset();
          await applyQuality();
        }
        break;
      case 'cursor':
        if (gate.role === 'controller' && m.videoKey === videoKey) {
          lastCursor = m;
          positionCursor();
        }
        break;
      case 'pointer':
        if (gate.role === 'host' && m.videoKey === videoKey) await api.pointer(token, m);
        break;
      case 'video-info':
        if (gate.role === 'controller' && m.videoKey === videoKey) {
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
        enc.scaleResolutionDownBy = requested === 'speed' ? 1.5 : 1;
        enc.maxBitrate = p.bitrate;
        enc.maxFramerate = p.fps;
      }
      params.degradationPreference = p.degradation;
      await sender.setParameters(params).catch(qualityFailed);
    }
  }
  function qualityFailed() {
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
    lastPong = Date.now();
    adaptive.reset();
    recoveryBudget = new RecoveryBudget();
    qualityWarning = false;
    oldStats = null;
    clipboardBaseline = null;
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
          (owner.dataChannel?.bufferedAmount || 0) > 65536
        )
          return;
        const signature = JSON.stringify(p);
        if (signature !== lastCursorPacket || Date.now() - lastCursorSent > 1000) {
          send({ type: 'cursor', ...p, videoKey: currentKey });
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
        (owner.dataChannel?.bufferedAmount || 0) > 65536
      )
        return;
      send({ type: 'pointer', ...pendingPointer, videoKey });
      pendingPointer = null;
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
                adaptive.update(profile, { ...route, limitation: r.qualityLimitationReason }) ||
                changed;
              const effective = adaptive.limits(profile);
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
    videoKey = null;
    hostVideoPending = false;
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
    $('chat-count').textContent = '0 / 4000';
    $('chat-new').hidden = true;
    $('chat-messages').replaceChildren();
    unread = 0;
    $('chat-unread').hidden = true;
    pressedButtons.clear();
    remoteInput = false;
    remoteClipboard = false;
    clipboardBaseline = null;
    refreshControls();
    message('Bağlantı, karşı tarafın onayıyla başlar.');
    if (reason) toast(reason);
    return ending;
  }

  function addChat(text, mine, id) {
    const root = $('chat-messages');
    const nearBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 48;
    root.querySelector('.empty-chat')?.remove();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble' + (mine ? ' mine' : '');
    bubble.dataset.messageId = id;
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
    if ((gate.connection?.dataChannel?.bufferedAmount || 0) > 65536) {
      mouseTimer = setTimeout(flushMouse, 16);
      return;
    }
    const p = pendingMouse;
    pendingMouse = null;
    lastMouse = performance.now();
    send({ type: 'mouse-move', ...p });
  }
  function releaseInput() {
    pendingPointer = null;
    if (gate.approved && gate.role === 'controller' && videoKey)
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
      pendingPointer = { ...(p || { x: 0, y: 0 }), visible: !!p };
      if (!canControl()) return;
      if (!p) return;
      lastCoords = p;
      pendingMouse = p;
      if (!mouseTimer)
        mouseTimer = setTimeout(flushMouse, Math.max(0, 8 - (performance.now() - lastMouse)));
    });
    viewport.addEventListener('pointerdown', (e) => {
      viewport.focus();
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
      pendingPointer = { x: 0, y: 0, visible: false };
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
    $('transfer-name').textContent = filename;
    $('transfer-status').textContent = status;
    $('transfer-progress').value = percent;
  }
  function receiveFileReply(m) {
    if (!transfer || m.id !== transfer.id) return;
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
    if (transfer) {
      toast('Önce devam eden aktarımı bitirin.');
      return;
    }
    const owner = gate.connection,
      currentToken = token;
    selectingFile = true;
    let meta;
    try {
      meta = droppedFile
        ? await api.droppedFile(currentToken, droppedFile)
        : await api.selectFile(currentToken);
    } finally {
      selectingFile = false;
    }
    if (!meta) return;
    if (gate.connection !== owner) return;
    if (transfer) {
      await api.cancelFile(currentToken);
      toast('Başka bir dosya aktarımı başladı. Lütfen yeniden deneyin.');
      return;
    }
    transfer = { ...meta, direction: 'out' };
    const task = transfer;
    transferUI('Dosya gönderiliyor', meta.name, 'Karşı tarafın onayı bekleniyor…');
    $('file-approval').hidden = true;
    try {
      await sendAndWait({ type: 'file-offer', ...meta }, 'accept');
      let index = 0;
      while (transfer === task && gate.connection === owner) {
        const part = await api.readFile(currentToken, meta.id);
        if (transfer !== task) return;
        if (part.done) {
          await sendAndWait({ type: 'file-end', id: meta.id, hash: part.hash }, 'saved');
          if (transfer !== task) return;
          transferUI('Dosya gönderildi', meta.name, 'Karşı bilgisayara kaydedildi.', 100);
          transfer = null;
          return;
        }
        await sendAndWait(
          { type: 'file-chunk', id: meta.id, index, data: part.data },
          'chunk',
          index,
        );
        transferUI(
          'Dosya gönderiliyor',
          meta.name,
          bytes(part.bytes) + ' / ' + bytes(meta.size),
          meta.size ? (part.bytes / meta.size) * 100 : 100,
        );
        index++;
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
        bytes(count) + ' / ' + bytes(task.size),
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
    }
  }
  async function acceptFile() {
    const task = transfer;
    if (!task || task.direction !== 'in' || task.accepted || task.processing) return;
    task.processing = true;
    try {
      await api.beginFile(token, task);
      if (transfer !== task) return;
      task.accepted = true;
      $('file-approval').hidden = true;
      clearTimeout(fileTimer);
      send({ type: 'file-reply', id: task.id, status: 'accept' });
      fileTimer = setTimeout(() => cancelTransfer(true), 30000);
      transferUI('Dosya alınıyor', task.name, 'Aktarım başlıyor…');
    } catch (err) {
      await cancelTransfer();
      toast(errorText(err), true);
    }
  }
  async function init() {
    if (api) {
      const info = await api.info();
      name = info.name;
      $('compatibility-mode').checked = info.compatibility === true;
      $('machine-name').textContent = name;
      $('app-version').textContent = 'Sürüm ' + info.version;
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
    const file = e.dataTransfer?.files[0];
    if (file) sendFile(file).catch((err) => toast(errorText(err), true));
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
    write('menzil_recents', []);
    renderRecents();
    toast('Bağlantı geçmişi temizlendi.');
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
