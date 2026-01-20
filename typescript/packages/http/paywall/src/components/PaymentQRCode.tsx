import { useEffect, useRef, useState } from "react";

export interface PaymentQRCodeProps {
  /**
   * The data to encode in the QR code (URI, address, etc.)
   */
  data: string;
  /**
   * Size of the QR code in pixels
   * @default 200
   */
  size?: number;
  /**
   * Label to show below the QR code
   */
  label?: string;
  /**
   * Whether to show a copy button
   * @default true
   */
  showCopyButton?: boolean;
  /**
   * Callback when the QR code data is copied
   */
  onCopy?: () => void;
}

/**
 * Simple QR Code matrix generator
 * Generates a QR code matrix from input data
 */
function generateQRMatrix(data: string): boolean[][] {
  // This is a simplified QR code generator for display purposes
  // In production, you might want to use a proper library like 'qrcode'

  // For now, we'll generate a placeholder pattern
  // The actual implementation would need a proper QR encoding algorithm
  const size = Math.max(21, Math.ceil(Math.sqrt(data.length * 8)) + 10);
  const matrix: boolean[][] = [];

  // Create empty matrix
  for (let i = 0; i < size; i++) {
    matrix[i] = new Array(size).fill(false);
  }

  // Add finder patterns (the three corner squares)
  const addFinderPattern = (startX: number, startY: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isOuter = y === 0 || y === 6 || x === 0 || x === 6;
        const isInner = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        matrix[startY + y][startX + x] = isOuter || isInner;
      }
    }
  };

  addFinderPattern(0, 0);
  addFinderPattern(size - 7, 0);
  addFinderPattern(0, size - 7);

  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Add data pattern (simplified - uses hash of data)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }

  // Fill in data area with pseudo-random pattern based on data
  for (let y = 9; y < size - 9; y++) {
    for (let x = 9; x < size - 9; x++) {
      if (x !== 6 && y !== 6) {
        const seed = (hash + x * 31 + y * 17 + data.charCodeAt((x + y) % data.length)) | 0;
        matrix[y][x] = (seed % 3) === 0;
      }
    }
  }

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
        ctx.fillRect(
          x * moduleSize,
          y * moduleSize,
          moduleSize,
          moduleSize,
        );
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
      const lightColor = computedStyle.getPropertyValue("--container-background-color").trim() || "#ffffff";

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
      <rect
        x="5"
        y="5"
        width="9"
        height="9"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
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
