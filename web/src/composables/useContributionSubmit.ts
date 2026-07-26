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
  TOO_MANY_ASSETS: '一次最多可以选择 12 项素材。',
  TOO_MANY_VIDEOS: '一次最多可以选择 2 段视频。',
  FILE_TOO_LARGE: '文件超过了约定的大小限制。',
  CONTRIBUTION_TOO_LARGE: '全部文件总量不能超过 80 MiB。',
  IMAGE_FORMAT_UNSUPPORTED: '照片不符合约定的格式。',
  IMAGE_PIXEL_LIMIT_EXCEEDED: '照片像素超过了 25 MP 的限制。',
  VIDEO_FORMAT_UNSUPPORTED: '视频不符合约定的格式。',
  VIDEO_DURATION_EXCEEDED: '视频时长超过了 90 秒的限制。',
  MEDIA_PROCESSING_FAILED: '服务器整理素材时失败，投稿没有送达。',
};

function errorMessage(error: ContributionErrorResponse['error']): string {
  const message = ERROR_MESSAGES[error.code] ?? error.message;
  return error.filename ? `${error.filename}：${message}` : message;
}

export function useContributionSubmit() {
  const status = shallowRef<ContributionSubmitStatus>('idle');
  const uploadPercent = shallowRef(0);
  const error = shallowRef('');
  const result = shallowRef<ContributionSuccessResult | null>(null);
  const activeXhr = shallowRef<XMLHttpRequest | null>(null);
  let disposed = false;

  const isSubmitting = computed(() =>
    status.value === 'uploading' || status.value === 'processing',
  );

  function fail(message: string): void {
    status.value = 'failed';
    error.value = message;
  }

  function submit(token: string, payload: ContributionFormPayload): void {
    status.value = 'uploading';
    uploadPercent.value = 0;
    error.value = '';
    result.value = null;

    const formData = new FormData();
    formData.append('senderName', payload.senderName);
    formData.append('contentText', payload.contentText);
    formData.append('assetOrder', JSON.stringify(payload.assets.map((_, index) => index)));
    payload.assets.forEach((file) => formData.append('assets[]', file, file.name));

    const xhr = new XMLHttpRequest();
    activeXhr.value = xhr;
    xhr.open('POST', '/api/contributions');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || disposed) return;
      uploadPercent.value = Math.round((event.loaded / event.total) * 100);
    };
    xhr.upload.onload = () => {
      if (disposed) return;
      uploadPercent.value = 100;
      status.value = 'processing';
    };
    xhr.onerror = () => {
      if (!disposed) fail('网络连接中断，投稿没有送达。');
    };
    xhr.onabort = () => {
      if (!disposed) fail('投稿请求已经中止。');
    };
    xhr.onload = () => {
      if (disposed) return;

      let response: ContributionSuccessResponse | ContributionErrorResponse;
      try {
        response = JSON.parse(xhr.responseText) as ContributionSuccessResponse | ContributionErrorResponse;
      } catch {
        fail('服务器返回了无法读取的响应，投稿没有送达。');
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        fail(errorMessage((response as ContributionErrorResponse).error));
        return;
      }

      result.value = (response as ContributionSuccessResponse).contribution;
      status.value = 'success';
    };
    xhr.onloadend = () => {
      if (activeXhr.value === xhr) activeXhr.value = null;
    };
    xhr.send(formData);
  }

  onBeforeUnmount(() => {
    disposed = true;
    activeXhr.value?.abort();
    activeXhr.value = null;
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
