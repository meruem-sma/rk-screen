// Convert the approved PNG into standard PNG-compressed Windows ICO sizes.
const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app
  .whenReady()
  .then(() => {
    const source = nativeImage.createFromPath(path.join(__dirname, '../assets/rk-screen.png'));
    if (source.isEmpty()) throw Error('Logo PNG is missing');
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const images = sizes.map((size) =>
      source.resize({ width: size, height: size, quality: 'best' }).toPNG(),
    );
    const header = Buffer.alloc(6 + sizes.length * 16);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(sizes.length, 4);
    let offset = header.length;
    sizes.forEach((size, i) => {
      const at = 6 + i * 16;
      header[at] = header[at + 1] = size === 256 ? 0 : size;
      header.writeUInt16LE(1, at + 4);
      header.writeUInt16LE(32, at + 6);
      header.writeUInt32LE(images[i].length, at + 8);
      header.writeUInt32LE(offset, at + 12);
      offset += images[i].length;
    });
    fs.writeFileSync(
      path.join(__dirname, '../assets/rk-screen.ico'),
      Buffer.concat([header, ...images]),
    );
    fs.writeFileSync(path.join(__dirname, '../assets/rk-screen-mark.png'), images.at(-1));
    console.log('ICON PASS: 16/24/32/48/64/128/256 px Windows icon');
    app.exit(0);
  })
  .catch((err) => {
    console.error(err);
    app.exit(1);
  });
