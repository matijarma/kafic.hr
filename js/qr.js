// Lightweight QR v1-L generator (byte mode, up to 17 bytes). Fits join codes.
const MODULE_COUNT = 21;
const DATA_CODEWORDS = 19;
const EC_CODEWORDS = 7;

const gfExp = new Uint8Array(512);
const gfLog = new Uint8Array(256);
(function initGF() {
  gfExp[0] = 1;
  for (let i = 1; i < 512; i++) {
    let val = gfExp[i - 1] << 1;
    if (val & 0x100) val ^= 0x11d;
    gfExp[i] = val;
  }
  for (let i = 0; i < 255; i++) gfLog[gfExp[i]] = i;
})();

const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : gfExp[(gfLog[a] + gfLog[b]) % 255];

const buildGeneratorPoly = (degree) => {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const factor = [1, gfExp[i]];
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], factor[0]);
      next[j + 1] ^= gfMul(poly[j], factor[1]);
    }
    poly = next;
  }
  return poly;
};

const generatorPoly = buildGeneratorPoly(EC_CODEWORDS);

const encodeData = (text) => {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 17) throw new Error('Join code too long for QR v1');

  const bits = [];
  const pushBits = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  pushBits(0b0100, 4); // mode byte
  pushBits(bytes.length, 8);
  bytes.forEach(b => pushBits(b, 8));

  const capacity = DATA_CODEWORDS * 8;
  const remaining = capacity - bits.length;
  if (remaining > 0) pushBits(0, Math.min(4, remaining));
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  }
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (data.length < DATA_CODEWORDS) {
    data.push(padBytes[padIndex % padBytes.length]);
    padIndex++;
  }
  return data;
};

const computeEC = (data) => {
  const ec = new Array(EC_CODEWORDS).fill(0);
  data.forEach(byte => {
    const factor = byte ^ ec[0];
    ec.shift();
    ec.push(0);
    if (factor !== 0) {
      for (let i = 0; i < generatorPoly.length - 1; i++) {
        ec[i] ^= gfMul(generatorPoly[i + 1], factor);
      }
    }
  });
  return ec;
};

const buildMatrix = (codewords) => {
  const modules = Array.from({ length: MODULE_COUNT }, () => Array(MODULE_COUNT).fill(null));
  const reserve = Array.from({ length: MODULE_COUNT }, () => Array(MODULE_COUNT).fill(false));

  const placeFinder = (r, c) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const yy = r + y, xx = c + x;
        if (yy < 0 || yy >= MODULE_COUNT || xx < 0 || xx >= MODULE_COUNT) continue;
        const inPattern = (y >= 0 && y <= 6 && (x === 0 || x === 6)) ||
                          (x >= 0 && x <= 6 && (y === 0 || y === 6)) ||
                          (y >= 2 && y <= 4 && x >= 2 && x <= 4);
        modules[yy][xx] = inPattern;
        reserve[yy][xx] = true;
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, MODULE_COUNT - 7);
  placeFinder(MODULE_COUNT - 7, 0);

  for (let i = 0; i < MODULE_COUNT; i++) {
    if (!reserve[6][i]) { modules[6][i] = i % 2 === 0; reserve[6][i] = true; }
    if (!reserve[i][6]) { modules[i][6] = i % 2 === 0; reserve[i][6] = true; }
  }

  const formatPositions = [];
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) formatPositions.push([i, 8], [8, i]);
  }
  for (let i = MODULE_COUNT - 8; i < MODULE_COUNT; i++) formatPositions.push([i, 8], [8, i]);
  formatPositions.forEach(([r, c]) => reserve[r][c] = true);
  reserve[MODULE_COUNT - 8][8] = true;

  // Data placement
  let row = MODULE_COUNT - 1;
  let col = MODULE_COUNT - 1;
  let dir = -1;
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  const nextBit = () => {
    const byteIndex = Math.floor(bitIndex / 8);
    const offset = 7 - (bitIndex % 8);
    const value = ((codewords[byteIndex] >>> offset) & 1) === 1;
    bitIndex++;
    return value;
  };

  while (col > 0) {
    if (col === 6) col--; // skip timing column
    while (true) {
      for (let cOffset = 0; cOffset < 2; cOffset++) {
        const cc = col - cOffset;
        if (!reserve[row][cc] && bitIndex < totalBits) {
          modules[row][cc] = nextBit();
        }
      }
      row += dir;
      if (row < 0 || row >= MODULE_COUNT) {
        row -= dir;
        dir = -dir;
        col -= 2;
        break;
      }
    }
  }

  return { modules, reserve };
};

const maskFunction = (r, c) => ((r + c) % 2) === 0; // mask 0

const formatBitsForMask0 = (() => {
  const format = (0b01 << 3) | 0; // EC L, mask 0
  const g = 0x537;
  let data = format << 10;
  for (let i = 14; i >= 10; i--) if ((data >> i) & 1) data ^= g << (i - 10);
  const bits = ((format << 10) | data) ^ 0x5412;
  return bits;
})();

const applyMaskAndFormat = (modules, reserve) => {
  for (let r = 0; r < MODULE_COUNT; r++) {
    for (let c = 0; c < MODULE_COUNT; c++) {
      if (reserve[r][c]) continue;
      if (maskFunction(r, c)) modules[r][c] = !modules[r][c];
    }
  }

  const bits = formatBitsForMask0;
  for (let i = 0; i < 15; i++) {
    const bit = ((bits >> i) & 1) === 1;
    // vertical timing
    if (i < 6) modules[i][8] = bit;
    else if (i < 8) modules[i + 1][8] = bit;
    else modules[MODULE_COUNT - 15 + i][8] = bit;
    // horizontal timing
    if (i < 8) modules[8][MODULE_COUNT - 1 - i] = bit;
    else if (i < 9) modules[8][15 - i - 1 + 1] = bit;
    else modules[8][15 - i - 1] = bit;
  }
  modules[MODULE_COUNT - 8][8] = true; // dark module
};

const drawToCanvas = (canvas, modules, size = 220) => {
  const cell = Math.floor(size / MODULE_COUNT);
  const dim = cell * MODULE_COUNT;
  canvas.width = canvas.height = dim;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = '#000';
  for (let r = 0; r < MODULE_COUNT; r++) {
    for (let c = 0; c < MODULE_COUNT; c++) {
      if (modules[r][c]) ctx.fillRect(c * cell, r * cell, cell, cell);
    }
  }
};

export const renderQR = (canvas, text, size = 220) => {
  if (!canvas || !text) return;
  try {
    const data = encodeData(text);
    const ec = computeEC(data);
    const codewords = data.concat(ec);
    const { modules, reserve } = buildMatrix(codewords);
    applyMaskAndFormat(modules, reserve);
    drawToCanvas(canvas, modules, size);
  } catch (e) {
    console.error('QR render failed', e);
  }
};
