// A question asked out loud, recorded in the browser. Each browser records in its own format:
// Chrome and Edge make WebM, Firefox Ogg, Safari MP4; the assistant's service reads all three.
const TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];

/**
 * Whether this browser can record a question here. It needs a microphone API, and a secure
 * page: https, or localhost while developing.
 */
export function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

export interface Recording {
  /** Stops, and hands over what was said. */
  stop: () => Promise<Blob>;
  /** Stops, and throws it away. */
  cancel: () => void;
}

/** Starts recording. Rejects when the reader refuses the microphone, or has none. */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mimeType = TYPES.find((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  // The microphone is let go as soon as recording ends, so the browser stops showing it in use.
  const release = () => stream.getTracks().forEach((track) => track.stop());
  recorder.start();
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.onstop = release;
      if (recorder.state === 'inactive') release();
      else recorder.stop();
    },
  };
}

/** A recording as base64, which is how JSON carries it. */
export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('The recording could not be read'));
    reader.readAsDataURL(blob);
  });
}
