const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { MAX_FILE_SIZE } = require('./file-store');
class FileSender {
  constructor() {
    this.pending = new Map();
    this.active = null;
  }
  async enqueue(paths) {
    if (
      !Array.isArray(paths) ||
      !paths.length ||
      paths.length + this.pending.size + Number(!!this.active) > 20
    )
      throw Error('Kuyrukta en fazla 20 dosya olabilir.');
    const selected = [];
    for (const file of paths) {
      if (typeof file !== 'string' || !path.isAbsolute(file)) throw Error('Geçersiz dosya seçimi.');
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size > MAX_FILE_SIZE)
        throw Error('Her dosya en fazla 512 MB olabilir; klasör seçilemez.');
      selected.push({
        id: crypto.randomUUID(),
        path: file,
        name: path.basename(file),
        size: stat.size,
        modified: stat.mtimeMs,
      });
    }
    for (const item of selected) this.pending.set(item.id, item);
    return selected.map(({ id, name, size }) => ({ id, name, size }));
  }
  async open(id) {
    if (this.active) throw Error('Bir dosya aktarımı zaten sürüyor.');
    const item = this.pending.get(id);
    if (!item) throw Error('Seçili dosya artık kuyrukta değil.');
    const handle = await fs.open(item.path, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== item.size || stat.mtimeMs !== item.modified)
        throw Error('Dosya seçildikten sonra değişti. Yeniden seçin.');
      this.active = { ...item, handle, offset: 0, hash: crypto.createHash('sha256') };
      this.pending.delete(id);
      return { id: item.id, name: item.name, size: item.size };
    } catch (error) {
      await handle.close();
      throw error;
    }
  }
  async read(id) {
    const file = this.active;
    if (!file || file.id !== id) throw Error('Dosya aktarımı kapandı.');
    if (file.offset === file.size) {
      const stat = await file.handle.stat();
      if (stat.size !== file.size || stat.mtimeMs !== file.modified)
        throw Error('Dosya aktarım sırasında değişti. Yeniden seçin.');
      const hash = file.hash.digest('hex');
      this.active = null;
      await file.handle.close();
      return { done: true, hash };
    }
    const buffer = Buffer.alloc(Math.min(32768, file.size - file.offset));
    const { bytesRead } = await file.handle.read(buffer, 0, buffer.length, file.offset);
    if (!bytesRead) throw Error('Dosya okunamadı veya aktarım sırasında değişti.');
    file.offset += bytesRead;
    const bytes = buffer.subarray(0, bytesRead);
    file.hash.update(bytes);
    return { data: bytes.toString('base64'), bytes: file.offset };
  }
  async cancel() {
    this.pending.clear();
    const file = this.active;
    this.active = null;
    if (file) await file.handle.close();
  }
}
module.exports = { FileSender };
