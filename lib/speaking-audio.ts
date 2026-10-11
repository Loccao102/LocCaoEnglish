// PCM conversion stays local; raw audio is never written to browser storage.
function downsample(input: Float32Array, sourceRate: number, targetRate = 16000) {
  if (sourceRate === targetRate) return input;
  const ratio = sourceRate / targetRate;
  const output = new Float32Array(Math.round(input.length / ratio));
  for (let i = 0; i < output.length; i++) {
    const start = Math.floor(i * ratio), end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let total = 0;
    for (let j = start; j < end; j++) total += input[j];
    output[i] = total / Math.max(1, end - start);
  }
  return output;
}

export function wavBase64(chunks: Float32Array[], sampleRate: number) {
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(size);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
  const pcm = downsample(merged, sampleRate, 16000);
  const buffer = new ArrayBuffer(44 + pcm.length * 2), view = new DataView(buffer);
  const write = (pos: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(pos + i, text.charCodeAt(i));
  };
  write(0, "RIFF"); view.setUint32(4, 36 + pcm.length * 2, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  let cursor = 44;
  for (const sample of pcm) {
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(cursor, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true); cursor += 2;
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
