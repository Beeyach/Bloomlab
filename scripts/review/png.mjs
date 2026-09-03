// Minimal PNG reader for the review probes. Chrome's screenshots are non-interlaced 8-bit
// RGB/RGBA, which is all this handles — enough to compare what is actually painted in a card's
// corner while a finger is down, instead of only reading the CSS that was supposed to paint it.
import { inflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

/** Decodes a PNG buffer to `{ width, height, channels, data }` with one byte per sample. */
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
  let offset = 8;
  let header = null;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (!header) throw new Error('PNG has no IHDR');
  if (header.depth !== 8) throw new Error(`Unsupported bit depth ${header.depth}`);
  if (header.interlace !== 0) throw new Error('Interlaced PNG is not supported');
  const channels = CHANNELS[header.colorType];
  if (!channels) throw new Error(`Unsupported colour type ${header.colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = header.width * channels;
  const data = Buffer.alloc(stride * header.height);
  let position = 0;
  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[position];
    position += 1;
    const line = raw.subarray(position, position + stride);
    position += stride;
    const out = data.subarray(y * stride, (y + 1) * stride);
    const previous = y > 0 ? data.subarray((y - 1) * stride, y * stride) : null;
    unfilter(filter, line, out, previous, channels);
  }
  return { width: header.width, height: header.height, channels, data };
}

function unfilter(filter, line, out, previous, channels) {
  const left = (i) => (i >= channels ? out[i - channels] : 0);
  const up = (i) => (previous ? previous[i] : 0);
  const upLeft = (i) => (previous && i >= channels ? previous[i - channels] : 0);
  for (let i = 0; i < line.length; i += 1) {
    const value = line[i];
    switch (filter) {
      case 0:
        out[i] = value;
        break;
      case 1:
        out[i] = (value + left(i)) & 0xff;
        break;
      case 2:
        out[i] = (value + up(i)) & 0xff;
        break;
      case 3:
        out[i] = (value + ((left(i) + up(i)) >> 1)) & 0xff;
        break;
      case 4:
        out[i] = (value + paeth(left(i), up(i), upLeft(i))) & 0xff;
        break;
      default:
        throw new Error(`Unknown PNG filter ${filter}`);
    }
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** The largest per-channel difference between two same-sized images, ignoring alpha. */
export function maxChannelDelta(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 255;
  const colour = Math.min(3, a.channels, b.channels);
  let worst = 0;
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      for (let c = 0; c < colour; c += 1) {
        const delta = Math.abs(
          a.data[(y * a.width + x) * a.channels + c] - b.data[(y * b.width + x) * b.channels + c],
        );
        if (delta > worst) worst = delta;
      }
    }
  }
  return worst;
}
