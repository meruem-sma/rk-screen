(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenTransfer = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const WINDOW_SIZE = 8; // At most 256 KiB of raw file data in flight.
  class FilePacer {
    constructor() {
      this.reset();
    }
    reset(sendingVideo = false) {
      this.sendingVideo = sendingVideo;
      this.rate = 4000000;
      this.baseline = null;
      this.adjustedAt = 0;
      this.media = null;
    }
    updateMedia(sample, now = performance.now()) {
      this.media = { ...sample, time: now };
    }
    acknowledge(elapsed, now = performance.now()) {
      if (!Number.isFinite(elapsed) || elapsed < 0) return;
      this.baseline = Math.min(this.baseline ?? elapsed, elapsed);
      if (now - this.adjustedAt < 1000) return;
      if (elapsed > Math.max(750, this.baseline * 3)) this.rate = Math.max(64000, this.rate * 0.7);
      else if (elapsed <= Math.max(200, this.baseline * 2))
        this.rate = Math.min(16000000, this.rate * 1.25);
      this.adjustedAt = now;
    }
    budget(now = performance.now()) {
      // An inbound media connection's outgoing RTP estimate says nothing about
      // this computer's file upload capacity. Only reserve for OUR video uplink.
      if (!this.sendingVideo) return this.rate;
      const m = this.media;
      if (!m || now - m.time > 6000 || !Number.isFinite(m.available) || m.available <= 0)
        return Math.min(this.rate, 2000000);
      const used = Number.isFinite(m.videoBitrate) ? m.videoBitrate : m.available * 0.75;
      const spare = Math.max(0, m.available - used) * 0.7;
      const cap =
        m.limitation === 'bandwidth' || m.loss >= 3 ? Math.min(spare, m.available * 0.1) : spare;
      return Math.max(64000, Math.min(this.rate, cap));
    }
  }
  class ChunkWindow {
    constructor(id, send, timeoutMs = 45000) {
      this.id = id;
      this.sendMessage = send;
      this.timeoutMs = timeoutMs;
      this.pending = new Map();
      this.closed = false;
    }
    send(message) {
      if (
        this.closed ||
        this.pending.size >= WINDOW_SIZE ||
        message.id !== this.id ||
        this.pending.has(message.index)
      )
        return Promise.reject(Error('Dosya aktarım kuyruğu kapalı veya dolu.'));
      return new Promise((resolve, reject) => {
        this.pending.set(message.index, { resolve, reject, sentAt: performance.now() });
        this.arm(message.index);
        try {
          if (!this.sendMessage(message)) throw Error('Bağlantı kesildi.');
        } catch (err) {
          clearTimeout(this.pending.get(message.index)?.timer);
          this.pending.delete(message.index);
          reject(err);
        }
      });
    }
    arm(index) {
      const item = this.pending.get(index);
      clearTimeout(item.timer);
      item.timer = setTimeout(
        () =>
          this.cancel(
            Error(
              'Dosya parçası zaman aşımına uğradı. Karşı bilgisayar aktarımı yanıtlamıyor. Bağlantıyı kontrol edip dosyayı yeniden gönderin.',
            ),
          ),
        this.timeoutMs,
      );
    }
    acknowledge(id, index) {
      if (id !== this.id) return;
      const item = this.pending.get(index);
      if (!item) return;
      this.pending.delete(index);
      clearTimeout(item.timer);
      item.resolve();
      // A progressing slow link must not time out later chunks merely because
      // they have been waiting behind earlier bytes on the reliable channel.
      for (const pending of this.pending.keys()) this.arm(pending);
      return performance.now() - item.sentAt;
    }
    cancel(reason = Error('Aktarım iptal edildi.')) {
      this.closed = true;
      for (const item of this.pending.values()) {
        clearTimeout(item.timer);
        item.reject(reason);
      }
      this.pending.clear();
    }
  }
  function paceChunk(bytes, bitrate, signal) {
    if (signal?.aborted) return Promise.reject(Error('Aktarım iptal edildi.'));
    const delay = Math.ceil(
      (Math.max(0, Math.min(65536, bytes)) * 8000) /
        Math.max(64000, Math.min(16000000, bitrate || 4000000)),
    );
    return new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(Error('Aktarım iptal edildi.'));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve();
      }, delay);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
  return { ChunkWindow, FilePacer, paceChunk, WINDOW_SIZE };
});
