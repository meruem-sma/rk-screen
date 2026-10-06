const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_FILE_SIZE = 512 * 1024 * 1024;
function safeName(name) {
  let clean = path.win32
    .basename(String(name))
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .slice(0, 180)
    .replace(/[. ]+$/g, '');
  if (!clean || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean))
    clean = 'dosya_' + (clean || 'adsiz');
  return clean;
}
class FileReceiver {
  constructor(directory) {
    this.directory = directory;
    this.active = null;
  }
  async begin({ id, name, size }) {
    if (this.active) throw new Error('Bir aktarım zaten sürüyor.');
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_FILE_SIZE)
      throw new Error('Dosya boyutu sınırı 512 MB.');
    const temp = path.join(this.directory, '.rk-screen-' + crypto.randomUUID() + '.part');
    const handle = await fs.open(temp, 'wx');
    this.active = {
      id,
      name: safeName(name),
      size,
      bytes: 0,
      index: 0,
      temp,
      handle,
      hash: crypto.createHash('sha256'),
    };
  }
  async chunk(id, index, data) {
    const f = this.active;
    if (
      !f ||
      id !== f.id ||
      index !== f.index ||
      typeof data !== 'string' ||
      data.length > 65536 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)
    )
      throw new Error('Geçersiz dosya parçası.');
    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length || f.bytes + buffer.length > f.size)
      throw new Error('Dosya boyutu uyuşmuyor.');
    let written = 0;
    while (written < buffer.length) {
      const result = await f.handle.write(buffer, written, buffer.length - written);
      if (!result.bytesWritten) throw new Error('Dosyaya yazılamadı.');
      written += result.bytesWritten;
    }
    f.hash.update(buffer);
    f.bytes += buffer.length;
    f.index++;
    return f.bytes;
  }
  async finish(id, expectedHash) {
    const f = this.active;
    if (!f || f.id !== id || f.bytes !== f.size) throw new Error('Dosya eksik alındı.');
    if (f.hash.digest('hex') !== expectedHash) throw new Error('Dosya bütünlüğü doğrulanamadı.');
    await f.handle.close();
    const ext = path.extname(f.name),
      stem = path.basename(f.name, ext);
    for (let i = 0; i < 10000; i++) {
      const target = path.join(this.directory, i ? `${stem} (${i})${ext}` : f.name);
      try {
        await fs.link(f.temp, target);
        await fs.unlink(f.temp);
        this.active = null;
        return { name: path.basename(target), path: target };
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
      }
    }
    throw new Error('Uygun dosya adı bulunamadı.');
  }
  async cancel() {
    const f = this.active;
    this.active = null;
    if (f) {
      await f.handle.close().catch(() => {});
      await fs.unlink(f.temp).catch(() => {});
    }
  }
}
module.exports = { FileReceiver, safeName, MAX_FILE_SIZE };
