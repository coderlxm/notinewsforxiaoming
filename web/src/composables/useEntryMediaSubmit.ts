import { computed, onBeforeUnmount, readonly, shallowRef } from 'vue';
import { Upload } from 'tus-js-client';
import { createEntryUpload, discardEntryUpload, processEntryUpload } from '../api';
import { markPublishProbe } from '../utils/publishProbe';

const chunkSize = 32 * 1024 * 1024;

export function useEntryMediaSubmit() {
  const uploading = shallowRef(false);
  const progress = shallowRef(0);
  const error = shallowRef<string | null>(null);
  const activeUpload = shallowRef<Upload | null>(null);
  let activeUploadId: string | null = null;

  const busy = computed(() => uploading.value);

  async function uploadFile(
    file: File,
    uploadId: string,
    token: string,
    position: number,
    completedBytes: number,
    totalBytes: number,
  ): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint: '/api/me/entry-file-uploads',
        chunkSize,
        retryDelays: [],
        storeFingerprintForResuming: false,
        headers: { Authorization: `Bearer ${token}` },
        metadata: {
          entryUploadId: uploadId,
          filename: file.name,
          filetype: file.type,
          position: String(position),
        },
        onProgress(bytesUploaded) {
          progress.value = Math.round(((completedBytes + bytesUploaded) / totalBytes) * 100);
        },
        onError(reason) {
          reject(reason);
        },
        onSuccess() {
          const assetUploadId = upload.url
            ? new URL(upload.url, window.location.origin).pathname.split('/').pop()
            : null;
          if (!assetUploadId) {
            reject(new Error('服务器没有返回媒体上传标识。'));
            return;
          }
          resolve(assetUploadId);
        },
      });
      activeUpload.value = upload;
      upload.start();
    }).finally(() => {
      activeUpload.value = null;
    });
  }

  async function submit(files: readonly File[], entryId?: number): Promise<string | null> {
    uploading.value = true;
    progress.value = 0;
    error.value = null;
    let uploadId: string | null = null;
    try {
      markPublishProbe('UPLOAD_REQUEST_STARTED');
      const upload = await createEntryUpload(entryId);
      markPublishProbe('UPLOAD_REQUEST_COMPLETED');
      uploadId = upload.uploadId;
      activeUploadId = uploadId;
      const totalBytes = files.reduce((total, file) => total + file.size, 0);
      let completedBytes = 0;
      for (const [position, file] of files.entries()) {
        const assetUploadId = await uploadFile(file, uploadId, upload.token, position, completedBytes, totalBytes || 1);
        await processEntryUpload(uploadId, assetUploadId);
        completedBytes += file.size;
        progress.value = totalBytes ? Math.round((completedBytes / totalBytes) * 100) : 100;
      }
      activeUploadId = null;
      return uploadId;
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : String(reason);
      if (uploadId) await discardEntryUpload(uploadId);
      activeUploadId = null;
      return null;
    } finally {
      uploading.value = false;
    }
  }

  onBeforeUnmount(() => {
    void activeUpload.value?.abort();
    if (activeUploadId) void discardEntryUpload(activeUploadId);
  });

  return { busy: readonly(busy), progress: readonly(progress), error: readonly(error), submit };
}
