const QR_CONFIGS = {
  3: { size: 29, dataCodewords: 55, eccCodewords: 15, alignmentCenters: [6, 22] },
  4: { size: 33, dataCodewords: 80, eccCodewords: 20, alignmentCenters: [6, 26] }
};

const getByteData = (text) => Array.from(new TextEncoder().encode(text));

const appendBits = (bits, value, length) => {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
};

const bitsToBytes = (bits) => {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) {
      value = (value << 1) | (bits[i + j] || 0);
    }
    bytes.push(value);
  }
  return bytes;
};

const buildGfTables = () => {
  const exp = new Array(512).fill(0);
  const log = new Array(256).fill(0);
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    exp[i] = value;
    log[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255];
  return { exp, log };
};

const GF = buildGfTables();

const gfMul = (a, b) => {
  if (a === 0 || b === 0) return 0;
  return GF.exp[GF.log[a] + GF.log[b]];
};

const reedSolomonDivisor = (degree) => {
  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(result.length + 1).fill(0);
    result.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMul(coefficient, GF.exp[i]);
    });
    result = next;
  }
  return result;
};

const reedSolomonRemainder = (data, degree) => {
  const divisor = reedSolomonDivisor(degree);
  const result = [...data, ...new Array(degree).fill(0)];
  data.forEach((_value, index) => {
    const factor = result[index];
    if (factor === 0) return;
    divisor.forEach((coefficient, offset) => {
      result[index + offset] ^= gfMul(coefficient, factor);
    });
  });
  return result.slice(result.length - degree);
};

const getFormatBits = (mask) => {
  const data = (1 << 3) | mask; // Error correction level L.
  let remainder = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if (((remainder >>> i) & 1) !== 0) {
      remainder ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | remainder) ^ 0x5412;
};

const getBit = (value, index) => ((value >>> index) & 1) !== 0;

const createMatrix = (size) => ({
  modules: Array.from({ length: size }, () => new Array(size).fill(false)),
  reserved: Array.from({ length: size }, () => new Array(size).fill(false))
});

const setFunctionModule = (matrix, row, col, isDark) => {
  if (row < 0 || col < 0 || row >= matrix.modules.length || col >= matrix.modules.length) return;
  matrix.modules[row][col] = Boolean(isDark);
  matrix.reserved[row][col] = true;
};

const drawFinder = (matrix, row, col) => {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const r = row + dy;
      const c = col + dx;
      const inFinder = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const isDark =
        inFinder &&
        (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setFunctionModule(matrix, r, c, isDark);
    }
  }
};

const drawAlignment = (matrix, centerRow, centerCol) => {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(matrix, centerRow + dy, centerCol + dx, distance !== 1);
    }
  }
};

const reserveFormatAreas = (matrix) => {
  const size = matrix.modules.length;
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      setFunctionModule(matrix, 8, i, false);
      setFunctionModule(matrix, i, 8, false);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    setFunctionModule(matrix, 8, size - 1 - i, false);
    setFunctionModule(matrix, size - 1 - i, 8, false);
  }
  setFunctionModule(matrix, size - 8, 8, true);
};

const drawFunctionPatterns = (matrix, config) => {
  const size = config.size;
  drawFinder(matrix, 0, 0);
  drawFinder(matrix, 0, size - 7);
  drawFinder(matrix, size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    const isDark = i % 2 === 0;
    setFunctionModule(matrix, 6, i, isDark);
    setFunctionModule(matrix, i, 6, isDark);
  }

  config.alignmentCenters.forEach((row) => {
    config.alignmentCenters.forEach((col) => {
      const overlapsFinder =
        (row === 6 && col === 6) ||
        (row === 6 && col === size - 7) ||
        (row === size - 7 && col === 6);
      if (!overlapsFinder) drawAlignment(matrix, row, col);
    });
  });

  reserveFormatAreas(matrix);
};

const drawFormatBits = (matrix, mask) => {
  const size = matrix.modules.length;
  const bits = getFormatBits(mask);

  for (let i = 0; i <= 5; i += 1) setFunctionModule(matrix, i, 8, getBit(bits, i));
  setFunctionModule(matrix, 7, 8, getBit(bits, 6));
  setFunctionModule(matrix, 8, 8, getBit(bits, 7));
  setFunctionModule(matrix, 8, 7, getBit(bits, 8));
  for (let i = 9; i < 15; i += 1) setFunctionModule(matrix, 8, 14 - i, getBit(bits, i));

  for (let i = 0; i < 8; i += 1) setFunctionModule(matrix, size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i += 1) setFunctionModule(matrix, 8, size - 15 + i, getBit(bits, i));
  setFunctionModule(matrix, size - 8, 8, true);
};

const createDataCodewords = (text, config) => {
  const data = getByteData(text);
  if (data.length > config.dataCodewords - 2) {
    throw new Error('QR code value is too long.');
  }

  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, data.length, 8);
  data.forEach((byte) => appendBits(bits, byte, 8));

  const capacityBits = config.dataCodewords * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const bytes = bitsToBytes(bits);
  for (let pad = 0xec; bytes.length < config.dataCodewords; pad ^= 0xfd) {
    bytes.push(pad);
  }
  return bytes;
};

const drawData = (matrix, codewords, mask) => {
  const size = matrix.modules.length;
  const bits = [];
  codewords.forEach((byte) => appendBits(bits, byte, 8));

  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const row = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset;
        if (matrix.reserved[row][col]) continue;
        const rawBit = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        const masked = rawBit !== ((row + col) % 2 === 0 && mask === 0);
        matrix.modules[row][col] = masked;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
};

const generateQrModules = (text) => {
  const byteLength = getByteData(text).length;
  const version = byteLength <= QR_CONFIGS[3].dataCodewords - 2 ? 3 : 4;
  const config = QR_CONFIGS[version];
  const mask = 0;
  const matrix = createMatrix(config.size);
  drawFunctionPatterns(matrix, config);

  const data = createDataCodewords(text, config);
  const ecc = reedSolomonRemainder(data, config.eccCodewords);
  drawData(matrix, [...data, ...ecc], mask);
  drawFormatBits(matrix, mask);
  return matrix.modules;
};

export default function QrCode({ value, label }) {
  let modules = null;

  try {
    modules = generateQrModules(value);
  } catch {
    modules = null;
  }

  if (!modules) {
    return (
      <div className="qr-fallback">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    );
  }

  const quietZone = 4;
  const size = modules.length + quietZone * 2;

  return (
    <svg className="qr-code" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#ffffff" />
      {modules.flatMap((row, rowIndex) =>
        row.map((isDark, colIndex) =>
          isDark ? (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex + quietZone}
              y={rowIndex + quietZone}
              width="1"
              height="1"
              fill="#15212f"
            />
          ) : null
        )
      )}
    </svg>
  );
}
