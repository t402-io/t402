import { useEffect, useRef, useState } from "react";

export interface PaymentQRCodeProps {
  /**
   * The data to encode in the QR code (URI, address, etc.)
   */
  data: string;
  /**
   * Size of the QR code in pixels
   *
   * @default 200
   */
  size?: number;
  /**
   * Label to show below the QR code
   */
  label?: string;
  /**
   * Whether to show a copy button
   *
   * @default true
   */
  showCopyButton?: boolean;
  /**
   * Callback when the QR code data is copied
   */
  onCopy?: () => void;
}

/**
 * QR Code matrix generator using byte-mode encoding with Level L error correction.
 *
 * Supports QR versions 1-6 (data up to 134 bytes). For longer data, the input
 * is truncated. Uses mask pattern 0 (checkerboard) for simplicity.
 */
function generateQRMatrix(data: string): boolean[][] {
  // Version capacities for byte mode, Level L error correction
  const versionCapacities = [
    { version: 1, size: 21, dataBytes: 17, ecBytes: 7, ecBlockCount: 1 },
    { version: 2, size: 25, dataBytes: 32, ecBytes: 10, ecBlockCount: 1 },
    { version: 3, size: 29, dataBytes: 53, ecBytes: 15, ecBlockCount: 1 },
    { version: 4, size: 33, dataBytes: 78, ecBytes: 20, ecBlockCount: 1 },
    { version: 5, size: 37, dataBytes: 106, ecBytes: 26, ecBlockCount: 1 },
    { version: 6, size: 41, dataBytes: 134, ecBytes: 18, ecBlockCount: 2 },
  ];

  // Convert data to bytes (UTF-8)
  const encoder = new TextEncoder();
  let dataBytes = encoder.encode(data);

  // Select smallest version that fits
  let cfg = versionCapacities[versionCapacities.length - 1];
  for (const v of versionCapacities) {
    if (dataBytes.length <= v.dataBytes) {
      cfg = v;
      break;
    }
  }

  // Truncate if still too long
  if (dataBytes.length > cfg.dataBytes) {
    dataBytes = dataBytes.slice(0, cfg.dataBytes);
  }

  const size = cfg.size;
  const matrix: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  // --- Place function patterns ---

  const setModule = (y: number, x: number, val: boolean, reserve = true) => {
    if (y >= 0 && y < size && x >= 0 && x < size) {
      matrix[y][x] = val;
      if (reserve) reserved[y][x] = true;
    }
  };

  // Finder patterns
  const addFinder = (cy: number, cx: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const y = cy + dy;
        const x = cx + dx;
        if (y < 0 || y >= size || x < 0 || x >= size) continue;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const ring = Math.max(adx, ady);
        setModule(y, x, ring !== 3 && ring !== 4);
      }
    }
  };

  addFinder(3, 3);
  addFinder(3, size - 4);
  addFinder(size - 4, 3);

  // Separators (already handled by finder's ring 3/4 being false)

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // Alignment pattern (version >= 2)
  if (cfg.version >= 2) {
    const alignPos = size - 7;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        setModule(alignPos + dy, alignPos + dx, ring !== 1);
      }
    }
  }

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  reserved[8][8] = true;
  // Dark module
  setModule(size - 8, 8, true);

  // --- Encode data ---

  // Build data codewords: mode=0100 (byte), char count, data, terminator, padding
  const totalDataCodewords = cfg.dataBytes;
  const bits: number[] = [];

  const pushBits = (val: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(dataBytes.length, cfg.version >= 10 ? 16 : 8); // Character count
  for (const b of dataBytes) pushBits(b, 8);
  pushBits(0, Math.min(4, totalDataCodewords * 8 - bits.length)); // Terminator

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad with alternating 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataCodewords * 8) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to codewords
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    codewords.push(byte);
  }

  // Simple Reed-Solomon EC generation using GF(256) with primitive polynomial 0x11D
  const gfExp = new Uint8Array(512);
  const gfLog = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    gfExp[i] = x;
    gfLog[x] = i;
    x = x << 1;
    if (x >= 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];

  const gfMul = (a: number, b: number) =>
    a === 0 || b === 0 ? 0 : gfExp[gfLog[a] + gfLog[b]];

  // Build generator polynomial
  const ecCount = cfg.ecBytes;
  let gen = [1];
  for (let i = 0; i < ecCount; i++) {
    const newGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfMul(gen[j], gfExp[i]);
    }
    gen = newGen;
  }

  // Compute EC codewords
  const msgPoly = new Array(codewords.length + ecCount).fill(0);
  for (let i = 0; i < codewords.length; i++) msgPoly[i] = codewords[i];

  for (let i = 0; i < codewords.length; i++) {
    const coef = msgPoly[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msgPoly[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }

  const ecCodewords = msgPoly.slice(codewords.length);
  const allCodewords = [...codewords, ...ecCodewords];

  // --- Place data modules ---

  let bitIndex = 0;
  const totalBits = allCodewords.length * 8;

  // Data placement: right-to-left, alternating upward/downward columns
  let upward = true;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5; // Skip timing column
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const dc of [0, -1]) {
        const c = col + dc;
        if (c < 0 || c >= size) continue;
        if (reserved[row][c]) continue;
        if (bitIndex < totalBits) {
          const codewordIdx = Math.floor(bitIndex / 8);
          const bitPos = 7 - (bitIndex % 8);
          const bit = (allCodewords[codewordIdx] >> bitPos) & 1;
          // Apply mask pattern 0: (row + col) % 2 === 0
          const masked = bit ^ (((row + c) % 2 === 0) ? 1 : 0);
          matrix[row][c] = masked === 1;
        }
        bitIndex++;
      }
    }
    upward = !upward;
  }

  // --- Place format information ---
  // Format: ECC level L (01) + mask pattern 0 (000) = 01000
  // Pre-computed format bits for L-0: 0x77C0 = 0111011111000000 (after BCH)
  const formatBits = 0x77c0;

  // Horizontal: modules around top-left finder
  for (let i = 0; i <= 5; i++) matrix[8][i] = ((formatBits >> (14 - i)) & 1) === 1;
  matrix[8][7] = ((formatBits >> 8) & 1) === 1;
  matrix[8][8] = ((formatBits >> 7) & 1) === 1;
  matrix[7][8] = ((formatBits >> 6) & 1) === 1;
  for (let i = 0; i <= 5; i++) matrix[5 - i][8] = ((formatBits >> (i)) & 1) === 1;

  // Second copy
  for (let i = 0; i <= 7; i++) matrix[size - 1 - i][8] = ((formatBits >> (14 - i)) & 1) === 1;
  for (let i = 0; i <= 7; i++) matrix[8][size - 8 + i] = ((formatBits >> (7 - i)) & 1) === 1;

  return matrix;
}

/**
 * Render QR matrix to canvas
 */
function renderQRToCanvas(
  canvas: HTMLCanvasElement,
  matrix: boolean[][],
  size: number,
  darkColor: string = "#000000",
  lightColor: string = "#ffffff",
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const moduleCount = matrix.length;
  const moduleSize = size / moduleCount;

  // Set canvas size (with device pixel ratio for sharp rendering)
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.scale(dpr, dpr);

  // Fill background
  ctx.fillStyle = lightColor;
  ctx.fillRect(0, 0, size, size);

  // Draw modules
  ctx.fillStyle = darkColor;
  for (let y = 0; y < moduleCount; y++) {
    for (let x = 0; x < moduleCount; x++) {
      if (matrix[y][x]) {
        ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
      }
    }
  }
}

/**
 * QR Code display component for payment flows
 * Shows a QR code that can be scanned by mobile wallets
 */
export function PaymentQRCode({
  data,
  size = 200,
  label,
  showCopyButton = true,
  onCopy,
}: PaymentQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current && data) {
      const matrix = generateQRMatrix(data);

      // Get colors from CSS variables
      const computedStyle = getComputedStyle(document.documentElement);
      const darkColor = computedStyle.getPropertyValue("--text-color").trim() || "#000000";
      const lightColor =
        computedStyle.getPropertyValue("--container-background-color").trim() || "#ffffff";

      renderQRToCanvas(canvasRef.current, matrix, size, darkColor, lightColor);
    }
  }, [data, size]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = data;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="qr-code-container">
      <canvas
        ref={canvasRef}
        className="qr-code-canvas"
        aria-label={`QR code for: ${label || data.slice(0, 20)}...`}
      />
      {label && <p className="qr-code-label">{label}</p>}
      {showCopyButton && (
        <button
          type="button"
          className="button button-secondary qr-code-copy-button"
          onClick={handleCopy}
          aria-label={copied ? "Copied!" : "Copy to clipboard"}
        >
          {copied ? (
            <>
              <CheckIcon /> Copied
            </>
          ) : (
            <>
              <CopyIcon /> Copy
            </>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Copy icon
 */
function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ marginRight: "0.25rem" }}
    >
      <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M11 5V3C11 2.44772 10.5523 2 10 2H3C2.44772 2 2 2.44772 2 3V10C2 10.5523 2.44772 11 3 11H5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * Check icon
 */
function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ marginRight: "0.25rem" }}
    >
      <path
        d="M13.5 4.5L6.5 11.5L3 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Generate a payment URI for various wallet types
 */
export function generatePaymentURI(params: {
  network: "ethereum" | "solana" | "ton" | "tron";
  address: string;
  amount?: string;
  asset?: string;
  label?: string;
}): string {
  const { network, address, amount, asset, label } = params;

  switch (network) {
    case "ethereum": {
      // EIP-681 payment URI
      let uri = `ethereum:${address}`;
      const queryParams: string[] = [];
      if (amount) queryParams.push(`value=${amount}`);
      if (asset) queryParams.push(`token=${asset}`);
      if (label) queryParams.push(`label=${encodeURIComponent(label)}`);
      if (queryParams.length > 0) {
        uri += `?${queryParams.join("&")}`;
      }
      return uri;
    }

    case "solana": {
      // Solana Pay URI
      let uri = `solana:${address}`;
      const queryParams: string[] = [];
      if (amount) queryParams.push(`amount=${amount}`);
      if (asset) queryParams.push(`spl-token=${asset}`);
      if (label) queryParams.push(`label=${encodeURIComponent(label)}`);
      if (queryParams.length > 0) {
        uri += `?${queryParams.join("&")}`;
      }
      return uri;
    }

    case "ton": {
      // TON URI scheme
      let uri = `ton://transfer/${address}`;
      const queryParams: string[] = [];
      if (amount) queryParams.push(`amount=${amount}`);
      if (asset) queryParams.push(`jetton=${asset}`);
      if (label) queryParams.push(`text=${encodeURIComponent(label)}`);
      if (queryParams.length > 0) {
        uri += `?${queryParams.join("&")}`;
      }
      return uri;
    }

    case "tron": {
      // TRON URI (simplified)
      return `tron:${address}${amount ? `?amount=${amount}` : ""}`;
    }

    default:
      return address;
  }
}
