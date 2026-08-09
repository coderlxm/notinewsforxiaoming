import { readonly, shallowRef } from 'vue';
import { requestTopicSuggestion } from '../api';

export function useTopicSuggestion() {
  const busy = shallowRef(false);

  async function generate(contentText: string): Promise<string> {
    busy.value = true;
    try {
      const response = await requestTopicSuggestion({ contentText });
      return response.topic;
    }
    finally {
      busy.value = false;
    }
  }

  return {
    busy: readonly(busy),
    generate,
  };
}
