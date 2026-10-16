(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenTransport = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const finite = (v) => Number.isFinite(v) && v >= 0;
  function remoteLoss(row) {
    return finite(row?.fractionLost) && row.fractionLost <= 1 ? row.fractionLost * 100 : null;
  }
  function selectedRoute(stats) {
    const rows = [...stats.values()];
    const transport = rows.find((r) => r.type === 'transport' && r.selectedCandidatePairId);
    const pair =
      stats.get(transport?.selectedCandidatePairId) ||
      rows.find((r) => r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated);
    const local = stats.get(pair?.localCandidateId),
      remote = stats.get(pair?.remoteCandidateId);
    return {
      available: finite(pair?.availableOutgoingBitrate) ? pair.availableOutgoingBitrate : null,
      rtt: finite(pair?.currentRoundTripTime) ? pair.currentRoundTripTime * 1000 : null,
      route:
        !local || !remote
          ? null
          : local.candidateType === 'relay' || remote.candidateType === 'relay'
            ? 'relay'
            : 'direct',
    };
  }
  function receiveSample(row, previous) {
    const same = previous?.id === row.id && row.timestamp > previous.timestamp;
    const delta = (field) =>
      same && finite(row[field]) && finite(previous[field]) && row[field] >= previous[field]
        ? row[field] - previous[field]
        : null;
    const bytes = delta('bytesReceived'),
      frames = delta('framesDecoded');
    const received = delta('packetsReceived'),
      lost = delta('packetsLost');
    const elapsed = same ? (row.timestamp - previous.timestamp) / 1000 : null;
    const decodedTime = delta('totalDecodeTime');
    const jitterTime = delta('jitterBufferDelay');
    const jitterCount = delta('jitterBufferEmittedCount');
    return {
      decodeMs: frames > 0 && decodedTime !== null ? (decodedTime * 1000) / frames : null,
      jitterMs: jitterCount > 0 && jitterTime !== null ? (jitterTime * 1000) / jitterCount : null,
      droppedFrames: delta('framesDropped'),
      freezeMs:
        delta('totalFreezesDuration') === null ? null : delta('totalFreezesDuration') * 1000,
      freezes: delta('freezeCount'),
      fps: finite(row.framesPerSecond)
        ? row.framesPerSecond
        : frames !== null
          ? frames / elapsed
          : null,
      mbps: bytes !== null ? (bytes * 8) / elapsed / 1000000 : null,
      loss:
        received !== null && lost !== null && received + lost > 0
          ? (lost / (received + lost)) * 100
          : null,
      previous: {
        id: row.id,
        timestamp: row.timestamp,
        bytesReceived: row.bytesReceived,
        framesDecoded: row.framesDecoded,
        packetsReceived: row.packetsReceived,
        packetsLost: row.packetsLost,
        freezeCount: row.freezeCount,
        totalFreezesDuration: row.totalFreezesDuration,
        totalDecodeTime: row.totalDecodeTime,
        jitterBufferDelay: row.jitterBufferDelay,
        jitterBufferEmittedCount: row.jitterBufferEmittedCount,
        framesDropped: row.framesDropped,
      },
    };
  }
  function sendSample(row, previous) {
    const same = previous?.id === row.id && row.timestamp > previous.timestamp;
    const delta = (field) =>
      same && finite(row[field]) && finite(previous[field]) && row[field] >= previous[field]
        ? row[field] - previous[field]
        : null;
    const frames = delta('framesEncoded'),
      seconds = delta('totalEncodeTime');
    const bytes = delta('bytesSent');
    const elapsed = same ? (row.timestamp - previous.timestamp) / 1000 : null;
    return {
      encodeMs: frames > 0 && seconds !== null ? (seconds * 1000) / frames : null,
      sentFps: finite(row.framesPerSecond)
        ? row.framesPerSecond
        : frames !== null
          ? frames / elapsed
          : null,
      videoBitrate: bytes !== null ? (bytes * 8) / elapsed : null,
      previous: {
        id: row.id,
        timestamp: row.timestamp,
        bytesSent: row.bytesSent,
        framesEncoded: row.framesEncoded,
        totalEncodeTime: row.totalEncodeTime,
      },
    };
  }
  class AdaptiveQuality {
    constructor() {
      this.reset();
    }
    reset() {
      this.fps = null;
      this.network = 0;
      this.networkGood = 0;
      this.networkLimited = false;
      this.networkStage = 0;
      this.cpu = 0;
      this.cpuGood = 0;
      this.cpuPressure = 0;
      this.cpuScale = 1;
    }
    update(profile, sample) {
      const before = this.limits(profile);
      const congestion =
        finite(sample.loss) && sample.loss >= 3 && finite(sample.rtt) && sample.rtt >= 180;
      // availableOutgoingBitrate is the transport's congestion estimate, not
      // an independent link speed. Re-capping to 85% of it creates a feedback
      // ratchet that suppresses probing. Leave bitrate control to WebRTC.
      if (sample.limitation === 'bandwidth' || congestion) {
        this.networkGood = 0;
        this.network++;
        if (this.network >= 5) this.networkStage = Math.max(this.networkStage, 1);
        if (this.network >= 10) this.networkStage = Math.max(this.networkStage, 2);
        if (this.network >= 20) this.networkStage = Math.max(this.networkStage, 3);
      } else if (sample.limitation === 'none' && (!finite(sample.loss) || sample.loss < 1)) {
        this.network = 0;
        if (++this.networkGood >= 5) {
          this.networkStage = Math.max(0, this.networkStage - 1);
          this.networkGood = 0;
        }
      } else {
        this.network = 0;
        this.networkGood = 0;
      }
      this.networkLimited = this.networkStage > 0;
      if (sample.limitation === 'cpu') {
        this.cpuGood = 0;
        this.cpuPressure++;
        if (this.cpuPressure >= 4 && profile.allowScale)
          this.cpuScale = Math.max(this.cpuScale, Math.min(2, profile.maxScale || 1));
        if (this.cpuPressure >= 10 && profile.allowScale)
          this.cpuScale = Math.max(this.cpuScale, profile.maxScale || 1);
        if (++this.cpu >= 2) {
          this.fps = before.fps > 30 ? 30 : Math.min(before.fps, 15);
          this.cpu = 0;
        }
      } else if (sample.limitation === 'none' && !congestion) {
        this.cpu = 0;
        this.cpuPressure = 0;
        if (++this.cpuGood >= 5) {
          this.fps = before.fps < 30 && profile.fps > 30 ? 30 : null;
          this.cpuScale = Math.max(1, this.cpuScale - 0.5);
          this.cpuGood = 0;
        }
      } else {
        this.cpu = 0;
        this.cpuPressure = 0;
        this.cpuGood = 0;
      }
      const after = this.limits(profile);
      return before.fps !== after.fps || before.scale !== after.scale;
    }
    limits(profile) {
      return {
        ...profile,
        bitrate: profile.bitrate,
        fps: Math.min(
          profile.fps,
          this.fps ?? profile.fps,
          [profile.fps, 30, 15, 8][this.networkStage],
        ),
        ...(profile.maxScale
          ? {
              scale: Math.min(
                profile.maxScale,
                Math.max(
                  profile.scale || 1,
                  profile.allowScale ? this.cpuScale : 1,
                  this.networkStage >= 2 && profile.allowScale ? 1.5 : 1,
                ),
              ),
            }
          : {}),
      };
    }
  }
  class RecoveryBudget {
    constructor() {
      this.attempts = [];
    }
    take(now) {
      this.attempts = this.attempts.filter((t) => now - t < 60000);
      if (this.attempts.length >= 2) return false;
      this.attempts.push(now);
      return true;
    }
  }
  class RealtimeLane {
    constructor(pc, receive) {
      this.pc = pc;
      this.receive = receive;
      this.channel = null;
      this.inputChannel = null;
      this.sent = 0;
      this.seen = new Map();
      if (!pc) return;
      this.previous = pc.ondatachannel;
      this.handler = (event) => {
        if (event.channel.label === 'rk-screen-live-v9') this.attach(event.channel);
        else if (event.channel.label === 'rk-screen-input-v9') this.attachInput(event.channel);
        else this.previous?.call(pc, event);
      };
      pc.ondatachannel = this.handler;
    }
    attachInput(channel) {
      if (
        this.inputChannel ||
        !channel.ordered ||
        channel.maxRetransmits !== null ||
        channel.maxPacketLifeTime !== null
      ) {
        channel.close();
        return;
      }
      this.inputChannel = channel;
      channel.onmessage = (event) => {
        if (typeof event.data !== 'string' || event.data.length > 2048) return;
        try {
          const m = JSON.parse(event.data);
          if (this.isInput(m.type)) this.receive(m);
        } catch {}
      };
    }
    isInput(type) {
      return [
        'key',
        'text',
        'mouse-button',
        'mouse-wheel',
        'release-input',
        'ping',
        'pong',
        'control-state',
      ].includes(type);
    }
    sendInput(message) {
      if (!this.isInput(message.type) || this.inputChannel?.readyState !== 'open') return false;
      if (this.inputChannel.bufferedAmount > 65536) throw Error('Kontrol kanalı yoğun.');
      this.inputChannel.send(JSON.stringify(message));
      return true;
    }
    attach(channel) {
      if (this.channel || channel.ordered || channel.maxRetransmits !== 0) {
        channel.close();
        return;
      }
      this.channel = channel;
      channel.onmessage = (event) => {
        if (typeof event.data !== 'string' || event.data.length > 2048) return;
        try {
          const m = JSON.parse(event.data);
          if (
            !['mouse-move', 'pointer', 'cursor'].includes(m.type) ||
            !Number.isSafeInteger(m.liveSequence) ||
            m.liveSequence <= (this.seen.get(m.type) || 0)
          )
            return;
          this.seen.set(m.type, m.liveSequence);
          this.receive(m);
        } catch {}
      };
    }
    start() {
      if (this.pc && !this.channel)
        this.attach(
          this.pc.createDataChannel('rk-screen-live-v9', { ordered: false, maxRetransmits: 0 }),
        );
      if (this.pc && !this.inputChannel)
        this.attachInput(this.pc.createDataChannel('rk-screen-input-v9', { ordered: true }));
    }
    send(message) {
      if (this.channel?.readyState !== 'open') return false;
      // Discard obsolete motion rather than queueing it behind chat/files.
      if (this.channel.bufferedAmount < 8192)
        this.channel.send(JSON.stringify({ ...message, liveSequence: ++this.sent }));
      return true;
    }
    close() {
      if (this.pc && this.pc.ondatachannel === this.handler) this.pc.ondatachannel = this.previous;
      if (this.channel) {
        this.channel.onmessage = null;
        this.channel.close();
      }
      if (this.inputChannel) {
        this.inputChannel.onmessage = null;
        this.inputChannel.close();
      }
      this.channel = null;
      this.inputChannel = null;
      this.pc = null;
    }
  }
  class RetryBackoff {
    constructor() {
      this.attempt = 0;
    }
    reset() {
      this.attempt = 0;
    }
    next() {
      return Math.min(30000, 1000 * 2 ** Math.min(this.attempt++, 5));
    }
  }
  return {
    remoteLoss,
    selectedRoute,
    receiveSample,
    sendSample,
    AdaptiveQuality,
    RecoveryBudget,
    RealtimeLane,
    RetryBackoff,
  };
});
