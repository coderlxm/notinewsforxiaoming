export const maxWebImageCount = 10;
export const maxWebImageBytes = 20 * 1024 * 1024;

const allowedWebImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export interface WebImageUpload {
  buffer: Buffer;
  mimeType: string;
  originalName: string | null;
}

export function assertWebImageUpload(input: WebImageUpload): void {
  if (!allowedWebImageMimeTypes.has(input.mimeType)) {
    throw new Error(`Unsupported Web image MIME type ${input.mimeType}.`);
  }
  if (input.buffer.byteLength > maxWebImageBytes) {
    throw new Error('Web image exceeds the 20 MB upload limit.');
  }
}

export function webImageKind(mimeType: string): 'animation' | 'photo' {
  return mimeType === 'image/gif' ? 'animation' : 'photo';
}
