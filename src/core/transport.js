(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenTransport = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const finite = (v) => Number.isFinite(v) && v >= 0;
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
    return {
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
      },
    };
  }
  class AdaptiveQuality {
    constructor() {
      this.reset();
    }
    reset() {
      this.bitrate = null;
      this.fps = null;
      this.low = 0;
      this.good = 0;
      this.cpu = 0;
      this.cpuGood = 0;
    }
    update(profile, sample) {
      const before = this.limits(profile);
      const available = sample.available;
      const floor = Math.min(750000, profile.bitrate);
      if (finite(available) && available > 0) {
        const desired = Math.max(floor, Math.min(profile.bitrate, Math.round(available * 0.85)));
        if (desired < before.bitrate * 0.8) {
          this.good = 0;
          if (++this.low >= 2) {
            this.bitrate = desired;
            this.low = 0;
          }
        } else if (desired > before.bitrate * 1.05) {
          this.low = 0;
          if (++this.good >= 5) {
            this.bitrate = Math.min(profile.bitrate, desired, Math.round(before.bitrate * 1.15));
            this.good = 0;
          }
        } else {
          this.low = 0;
          this.good = 0;
        }
      } else {
        this.low = 0;
        this.good = 0;
      }
      if (sample.limitation === 'cpu') {
        this.cpuGood = 0;
        if (++this.cpu >= 2) {
          this.fps = before.fps > 30 ? 30 : Math.min(before.fps, 15);
          this.cpu = 0;
        }
      } else if (sample.limitation === 'none') {
        this.cpu = 0;
        if (++this.cpuGood >= 5) {
          this.fps = before.fps < 30 && profile.fps > 30 ? 30 : null;
          this.cpuGood = 0;
        }
      } else {
        this.cpu = 0;
        this.cpuGood = 0;
      }
      const after = this.limits(profile);
      return before.bitrate !== after.bitrate || before.fps !== after.fps;
    }
    limits(profile) {
      return {
        ...profile,
        bitrate: Math.min(profile.bitrate, this.bitrate ?? profile.bitrate),
        fps: Math.min(profile.fps, this.fps ?? profile.fps),
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
  return { selectedRoute, receiveSample, AdaptiveQuality, RecoveryBudget };
});
