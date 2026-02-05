// Lightweight QR generator for version 1-L, 2-L, or 3-L (byte mode).
// Keeps codes small and scannable for short payloads.
const QR_SPECS = {
  1: { moduleCount: 21, dataCodewords: 19, ecCodewords: 7, align: [] },
  2: { moduleCount: 25, dataCodewords: 34, ecCodewords: 10, align: [6, 18] },
  3: { moduleCount: 29, dataCodewords: 55, ecCodewords: 15, align: [6, 22] }
};

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

const generatorPolyCache = new Map();
const getGeneratorPoly = (degree) => {
  if (generatorPolyCache.has(degree)) return generatorPolyCache.get(degree);
  const poly = buildGeneratorPoly(degree);
  generatorPolyCache.set(degree, poly);
  return poly;
};

const encodeData = (text, version) => {
  const bytes = new TextEncoder().encode(text);
  const spec = QR_SPECS[version];
  if (!spec) throw new Error('Unsupported QR version');
  const maxBytes = spec.dataCodewords;
  if (bytes.length > maxBytes) throw new Error('QR payload too long');

  const bits = [];
  const pushBits = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  pushBits(0b0100, 4); // byte mode
  pushBits(bytes.length, 8);
  bytes.forEach(b => pushBits(b, 8));

  const capacity = spec.dataCodewords * 8;
  const remaining = capacity - bits.length;
  if (remaining > 0) pushBits(0, Math.min(4, remaining));
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  }
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (data.length < spec.dataCodewords) {
    data.push(padBytes[padIndex % padBytes.length]);
    padIndex++;
  }
  return data;
};

const computeEC = (data, version) => {
  const spec = QR_SPECS[version];
  const generatorPoly = getGeneratorPoly(spec.ecCodewords);
  const ec = new Array(spec.ecCodewords).fill(0);
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

const buildMatrix = (codewords, version) => {
  const spec = QR_SPECS[version];
  const moduleCount = spec.moduleCount;
  const modules = Array.from({ length: moduleCount }, () => Array(moduleCount).fill(null));
  const reserve = Array.from({ length: moduleCount }, () => Array(moduleCount).fill(false));

  const placeFinder = (r, c) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const yy = r + y, xx = c + x;
        if (yy < 0 || yy >= moduleCount || xx < 0 || xx >= moduleCount) continue;
        const inPattern = (y >= 0 && y <= 6 && (x === 0 || x === 6)) ||
                          (x >= 0 && x <= 6 && (y === 0 || y === 6)) ||
                          (y >= 2 && y <= 4 && x >= 2 && x <= 4);
        modules[yy][xx] = inPattern;
        reserve[yy][xx] = true;
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, moduleCount - 7);
  placeFinder(moduleCount - 7, 0);

  for (let i = 0; i < moduleCount; i++) {
    if (!reserve[6][i]) { modules[6][i] = i % 2 === 0; reserve[6][i] = true; }
    if (!reserve[i][6]) { modules[i][6] = i % 2 === 0; reserve[i][6] = true; }
  }

  if (spec.align.length) {
    const positions = spec.align;
    const placeAlign = (r, c) => {
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          const yy = r + y, xx = c + x;
          if (yy < 0 || yy >= moduleCount || xx < 0 || xx >= moduleCount) continue;
          const dist = Math.max(Math.abs(x), Math.abs(y));
          const isBlack = dist !== 1;
          modules[yy][xx] = isBlack;
          reserve[yy][xx] = true;
        }
      }
    };
    for (let i = 0; i < positions.length; i++) {
      for (let j = 0; j < positions.length; j++) {
        const r = positions[i];
        const c = positions[j];
        const isFinderCorner = (i === 0 && j === 0) ||
          (i === 0 && j === positions.length - 1) ||
          (i === positions.length - 1 && j === 0);
        if (isFinderCorner) continue;
        placeAlign(r, c);
      }
    }
  }

  const formatPositions = [];
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) formatPositions.push([i, 8], [8, i]);
  }
  for (let i = moduleCount - 8; i < moduleCount; i++) formatPositions.push([i, 8], [8, i]);
  formatPositions.forEach(([r, c]) => reserve[r][c] = true);
  reserve[moduleCount - 8][8] = true;

  // Data placement
  let row = moduleCount - 1;
  let col = moduleCount - 1;
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
      if (row < 0 || row >= moduleCount) {
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

const applyMaskAndFormat = (modules, reserve, version) => {
  const moduleCount = QR_SPECS[version].moduleCount;
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (reserve[r][c]) continue;
      if (maskFunction(r, c)) modules[r][c] = !modules[r][c];
    }
  }

  const bits = formatBitsForMask0;
  for (let i = 0; i < 15; i++) {
    const bit = ((bits >> i) & 1) === 1;
    if (i < 6) modules[i][8] = bit;
    else if (i < 8) modules[i + 1][8] = bit;
    else modules[moduleCount - 15 + i][8] = bit;

    if (i < 8) modules[8][moduleCount - 1 - i] = bit;
    else if (i < 9) modules[8][15 - i - 1 + 1] = bit;
    else modules[8][15 - i - 1] = bit;
  }
  modules[moduleCount - 8][8] = true; // dark module
};

const drawToCanvas = (canvas, modules, moduleCount, size = 220) => {
  const quietZone = 4;
  const total = moduleCount + quietZone * 2;
  const cell = Math.max(2, Math.floor(size / total));
  const dim = cell * total;
  canvas.width = canvas.height = dim;
  canvas.style.width = `${dim}px`;
  canvas.style.height = `${dim}px`;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = '#000';
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (modules[r][c]) {
        ctx.fillRect((c + quietZone) * cell, (r + quietZone) * cell, cell, cell);
      }
    }
  }
};

export const renderQR = (canvas, text, size = 220) => {
  if (!canvas || !text) return false;
  try {
    const bytes = new TextEncoder().encode(text);
    let version = 1;
    if (bytes.length <= QR_SPECS[1].dataCodewords) version = 1;
    else if (bytes.length <= QR_SPECS[2].dataCodewords) version = 2;
    else version = 3;
    const data = encodeData(text, version);
    const ec = computeEC(data, version);
    const codewords = data.concat(ec);
    const { modules, reserve } = buildMatrix(codewords, version);
    applyMaskAndFormat(modules, reserve, version);
    drawToCanvas(canvas, modules, QR_SPECS[version].moduleCount, size);
    return true;
  } catch (e) {
    console.error('QR render failed', e);
    return false;
  }
};
