/**
 * Simple audio generator for demo streaming
 * Generates sine wave audio data without external dependencies
 */

// WAV file constants
const SAMPLE_RATE = 44100;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 2; // Stereo

// Musical notes frequencies (Hz)
const NOTES = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
};

// Simple melodies for each segment (frequencies in Hz)
const SEGMENT_MELODIES: number[][] = [
  [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5], // Segment 0: C major arpeggio
  [NOTES.D4, NOTES.F4, NOTES.A4, NOTES.D4], // Segment 1: D minor arpeggio
  [NOTES.E4, NOTES.G4, NOTES.B4, NOTES.E4], // Segment 2: E minor arpeggio
  [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.F4], // Segment 3: F major arpeggio
  [NOTES.G4, NOTES.B4, NOTES.D4, NOTES.G4], // Segment 4: G major arpeggio
];

/**
 * Generate a sine wave sample
 */
function generateSineWave(
  frequency: number,
  sampleIndex: number,
  amplitude: number = 0.3
): number {
  return amplitude * Math.sin((2 * Math.PI * frequency * sampleIndex) / SAMPLE_RATE);
}

/**
 * Apply ADSR envelope to smooth audio
 */
function applyEnvelope(sample: number, position: number, totalSamples: number): number {
  const attackTime = 0.01; // 10ms attack
  const releaseTime = 0.05; // 50ms release

  const attackSamples = SAMPLE_RATE * attackTime;
  const releaseSamples = SAMPLE_RATE * releaseTime;

  let envelope = 1.0;

  if (position < attackSamples) {
    envelope = position / attackSamples;
  } else if (position > totalSamples - releaseSamples) {
    envelope = (totalSamples - position) / releaseSamples;
  }

  return sample * envelope;
}

/**
 * Generate WAV audio data for a specific segment
 * @param segmentIndex - Segment number (0-4)
 * @param durationSeconds - Duration in seconds (default 10)
 * @returns ArrayBuffer containing WAV audio data
 */
export function generateSegmentAudio(
  segmentIndex: number,
  durationSeconds: number = 10
): ArrayBuffer {
  const melody = SEGMENT_MELODIES[segmentIndex % SEGMENT_MELODIES.length];
  const totalSamples = SAMPLE_RATE * durationSeconds;
  const noteDuration = totalSamples / melody.length;

  // Create buffer for audio data
  const dataSize = totalSamples * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // Write WAV header
  writeWavHeader(view, dataSize, SAMPLE_RATE, NUM_CHANNELS, BITS_PER_SAMPLE);

  // Generate audio samples
  let offset = headerSize;
  for (let i = 0; i < totalSamples; i++) {
    const noteIndex = Math.floor(i / noteDuration);
    const frequency = melody[noteIndex];
    const notePosition = i % noteDuration;

    // Generate sample with harmonics for richer sound
    let sample = generateSineWave(frequency, i, 0.25);
    sample += generateSineWave(frequency * 2, i, 0.1); // 2nd harmonic
    sample += generateSineWave(frequency * 3, i, 0.05); // 3rd harmonic

    // Apply envelope
    sample = applyEnvelope(sample, notePosition, noteDuration);

    // Convert to 16-bit integer
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));

    // Write stereo samples (left and right channels)
    view.setInt16(offset, intSample, true);
    offset += 2;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return buffer;
}

/**
 * Write WAV file header
 */
function writeWavHeader(
  view: DataView,
  dataSize: number,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number
): void {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Sub-chunk size
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);
}

/**
 * Write ASCII string to DataView
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Get segment info for metadata
 */
export function getSegmentInfo(segmentIndex: number) {
  const melodyNames = [
    "C Major Arpeggio",
    "D Minor Arpeggio",
    "E Minor Arpeggio",
    "F Major Arpeggio",
    "G Major Arpeggio",
  ];

  return {
    segment: segmentIndex,
    duration: 10,
    format: "audio/wav",
    sampleRate: SAMPLE_RATE,
    channels: NUM_CHANNELS,
    bitsPerSample: BITS_PER_SAMPLE,
    melody: melodyNames[segmentIndex % melodyNames.length],
    cost: "0.001",
  };
}
