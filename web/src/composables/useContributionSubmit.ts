import { computed, onBeforeUnmount, shallowRef } from 'vue';
import type { ContributionFormPayload } from './useContributionForm';

export type ContributionSubmitStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'failed';

export interface ContributionSuccessResult {
  publicId: string;
  senderName: string;
  assetCount: number;
  submittedAt: string;
}

interface ContributionUploadResponse {
  uploadId: string;
}

interface ContributionSuccessResponse {
  contribution: ContributionSuccessResult;
}

interface ContributionErrorResponse {
  error: {
    code: string;
    message: string;
    filename?: string;
  };
}

const ERROR_MESSAGES: Record<string, string> = {
  LINK_EXPIRED: '投稿链接已经过期，请向小明获取新的链接。',
  LINK_REVOKED: '投稿链接已经失效，请向小明获取新的链接。',
  INVALID_FORM: '请检查称呼、正文和所选素材。',
  TOO_MANY_ASSETS: '一次最多可以选择 30 项素材。',
  TOO_MANY_VIDEOS: '一次最多可以选择 5 段视频。',
  FILE_TOO_LARGE: '文件超过了约定的大小限制。',
  CONTRIBUTION_TOO_LARGE: '全部文件总量不能超过 500 MiB。',
  IMAGE_FORMAT_UNSUPPORTED: '照片不符合约定的格式。',
  IMAGE_PIXEL_LIMIT_EXCEEDED: '照片像素超过了 50 MP 的限制。',
  VIDEO_FORMAT_UNSUPPORTED: '视频不符合约定的格式。',
  VIDEO_DURATION_EXCEEDED: '视频时长超过了 5 分钟的限制。',
  MEDIA_PROCESSING_FAILED: '服务器整理素材时失败，投稿没有送达。',
};

function errorMessage(error: ContributionErrorResponse['error']): string {
  const message = ERROR_MESSAGES[error.code] ?? error.message;
  return error.filename ? `${error.filename}：${message}` : message;
}

function parseResponse<T>(responseText: string): T {
  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error('服务器返回了无法读取的响应，投稿没有送达。');
  }
}

function responseError(responseText: string): Error {
  const response = parseResponse<ContributionErrorResponse>(responseText);
  return new Error(errorMessage(response.error));
}

export function useContributionSubmit() {
  const status = shallowRef<ContributionSubmitStatus>('idle');
  const uploadPercent = shallowRef(0);
  const error = shallowRef('');
  const result = shallowRef<ContributionSuccessResult | null>(null);
  const activeXhr = shallowRef<XMLHttpRequest | null>(null);
  const activeFetchController = shallowRef<AbortController | null>(null);
  let disposed = false;

  const isSubmitting = computed(() =>
    status.value === 'uploading' || status.value === 'processing',
  );

  function fail(message: string): void {
    status.value = 'failed';
    error.value = message;
  }

  async function authorizedFetch(
    token: string,
    input: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    activeFetchController.value = controller;
    try {
      return await fetch(input, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } finally {
      if (activeFetchController.value === controller) {
        activeFetchController.value = null;
      }
    }
  }

  async function createUpload(token: string): Promise<string> {
    const response = await authorizedFetch(token, '/api/contribution-uploads', {
      method: 'POST',
    });
    const responseText = await response.text();
    if (!response.ok) throw responseError(responseText);
    return parseResponse<ContributionUploadResponse>(responseText).uploadId;
  }

  function uploadAsset(
    token: string,
    uploadId: string,
    file: File,
    completedBytes: number,
    totalBytes: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('asset', file, file.name);

      const xhr = new XMLHttpRequest();
      activeXhr.value = xhr;
      xhr.open('POST', `/api/contribution-uploads/${encodeURIComponent(uploadId)}/assets`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || disposed) return;
        uploadPercent.value = Math.round(
          ((completedBytes + event.loaded) / totalBytes) * 100,
        );
      };
      xhr.onerror = () => {
        reject(new Error('网络连接中断，投稿没有送达。'));
      };
      xhr.onabort = () => {
        reject(new Error('投稿请求已经中止。'));
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(responseError(xhr.responseText));
          return;
        }
        parseResponse(xhr.responseText);
        resolve();
      };
      xhr.onloadend = () => {
        if (activeXhr.value === xhr) activeXhr.value = null;
      };
      xhr.send(formData);
    });
  }

  async function completeUpload(
    token: string,
    uploadId: string,
    payload: ContributionFormPayload,
  ): Promise<ContributionSuccessResult> {
    const response = await authorizedFetch(token, '/api/contributions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadId,
        senderName: payload.senderName,
        contentText: payload.contentText,
      }),
    });
    const responseText = await response.text();
    if (!response.ok) throw responseError(responseText);
    return parseResponse<ContributionSuccessResponse>(responseText).contribution;
  }

  async function submit(token: string, payload: ContributionFormPayload): Promise<void> {
    status.value = 'uploading';
    uploadPercent.value = 0;
    error.value = '';
    result.value = null;

    try {
      const uploadId = await createUpload(token);
      const totalBytes = payload.assets.reduce((total, file) => total + file.size, 0);
      let completedBytes = 0;
      for (const file of payload.assets) {
        await uploadAsset(token, uploadId, file, completedBytes, totalBytes);
        completedBytes += file.size;
        uploadPercent.value = Math.round((completedBytes / totalBytes) * 100);
      }
      status.value = 'processing';
      result.value = await completeUpload(token, uploadId, payload);
      status.value = 'success';
    } catch (submissionError) {
      if (disposed) return;
      fail(
        submissionError instanceof Error
          ? submissionError.message
          : '投稿没有送达。',
      );
    }
  }

  onBeforeUnmount(() => {
    disposed = true;
    activeXhr.value?.abort();
    activeXhr.value = null;
    activeFetchController.value?.abort();
    activeFetchController.value = null;
  });

  return {
    status,
    uploadPercent,
    error,
    result,
    isSubmitting,
    submit,
  };
}
