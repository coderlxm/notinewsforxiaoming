import { Worker } from 'node:worker_threads';

interface DecodedHeicWorkerMessage {
  width: number;
  height: number;
  data: ArrayBuffer;
}

export interface DecodedHeicImage {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

export async function decodeHeicImage(source: Buffer): Promise<DecodedHeicImage> {
  const input = Uint8Array.from(source);
  const worker = new Worker(
    new URL('./photoHeicDecoderWorker.cjs', import.meta.url),
    {
      workerData: input,
      transferList: [input.buffer],
    },
  );

  return await new Promise((resolve, reject) => {
    let completed = false;

    worker.once('message', (message: DecodedHeicWorkerMessage) => {
      completed = true;
      resolve({
        width: message.width,
        height: message.height,
        data: new Uint8ClampedArray(message.data),
      });
    });
    worker.once('error', (error) => {
      completed = true;
      reject(error);
    });
    worker.once('exit', (code) => {
      if (!completed) {
        reject(new Error(`HEIC decoder worker exited without a result (code ${code}).`));
      }
    });
  });
}
