import { describe, it, expect } from "vitest";
import { generateSegmentAudio, getSegmentInfo } from "../../app/lib/audio-generator";

describe("generateSegmentAudio", () => {
  it("generates audio buffer with correct WAV header", () => {
    const buffer = generateSegmentAudio(0, 1); // 1 second for speed
    const view = new DataView(buffer);

    // Check RIFF header
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    expect(riff).toBe("RIFF");

    // Check WAVE identifier
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11)
    );
    expect(wave).toBe("WAVE");

    // Check fmt chunk
    const fmt = String.fromCharCode(
      view.getUint8(12),
      view.getUint8(13),
      view.getUint8(14),
      view.getUint8(15)
    );
    expect(fmt).toBe("fmt ");
  });

  it("generates stereo audio (2 channels)", () => {
    const buffer = generateSegmentAudio(0, 1);
    const view = new DataView(buffer);

    // Number of channels at offset 22
    const numChannels = view.getUint16(22, true);
    expect(numChannels).toBe(2);
  });

  it("generates 44100 Hz sample rate", () => {
    const buffer = generateSegmentAudio(0, 1);
    const view = new DataView(buffer);

    // Sample rate at offset 24
    const sampleRate = view.getUint32(24, true);
    expect(sampleRate).toBe(44100);
  });

  it("generates 16-bit audio", () => {
    const buffer = generateSegmentAudio(0, 1);
    const view = new DataView(buffer);

    // Bits per sample at offset 34
    const bitsPerSample = view.getUint16(34, true);
    expect(bitsPerSample).toBe(16);
  });

  it("generates correct size for 10 second audio", () => {
    const buffer = generateSegmentAudio(0, 10);
    // Header (44 bytes) + data (44100 samples * 10 seconds * 2 channels * 2 bytes)
    const expectedSize = 44 + 44100 * 10 * 2 * 2;
    expect(buffer.byteLength).toBe(expectedSize);
  });

  it("generates different melodies for different segments", () => {
    const buffer0 = generateSegmentAudio(0, 1);
    const buffer1 = generateSegmentAudio(1, 1);

    // Compare audio data (skip header)
    const view0 = new DataView(buffer0);
    const view1 = new DataView(buffer1);

    // Sample some data points
    let different = false;
    for (let i = 44; i < 1000; i += 4) {
      if (view0.getInt16(i, true) !== view1.getInt16(i, true)) {
        different = true;
        break;
      }
    }
    expect(different).toBe(true);
  });
});

describe("getSegmentInfo", () => {
  it("returns correct duration", () => {
    const info = getSegmentInfo(0);
    expect(info.duration).toBe(10);
  });

  it("returns correct format", () => {
    const info = getSegmentInfo(0);
    expect(info.format).toBe("audio/wav");
  });

  it("returns correct sample rate", () => {
    const info = getSegmentInfo(0);
    expect(info.sampleRate).toBe(44100);
  });

  it("returns cost", () => {
    const info = getSegmentInfo(0);
    expect(info.cost).toBe("0.001");
  });

  it("returns melody name for each segment", () => {
    for (let i = 0; i < 5; i++) {
      const info = getSegmentInfo(i);
      expect(info.melody).toBeTruthy();
      expect(info.melody).toContain("Arpeggio");
    }
  });
});
