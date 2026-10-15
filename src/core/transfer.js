(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenTransfer = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  // Three 32 KiB chunks bound both sender buffering and the receiver's work queue.
  class ChunkWindow {
    constructor(id, send, timeoutMs = 20000) {
      this.id = id;
      this.sendMessage = send;
      this.timeoutMs = timeoutMs;
      this.pending = new Map();
      this.closed = false;
    }
    send(message) {
      if (
        this.closed ||
        this.pending.size >= 3 ||
        message.id !== this.id ||
        this.pending.has(message.index)
      )
        return Promise.reject(Error('Dosya aktarım kuyruğu kapalı veya dolu.'));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(message.index);
          reject(Error('Dosya parçası zaman aşımına uğradı.'));
        }, this.timeoutMs);
        this.pending.set(message.index, { resolve, reject, timer });
        try {
          if (!this.sendMessage(message)) throw Error('Bağlantı kesildi.');
        } catch (err) {
          clearTimeout(timer);
          this.pending.delete(message.index);
          reject(err);
        }
      });
    }
    acknowledge(id, index) {
      if (id !== this.id) return;
      const item = this.pending.get(index);
      if (!item) return;
      this.pending.delete(index);
      clearTimeout(item.timer);
      item.resolve();
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
  return { ChunkWindow };
});
