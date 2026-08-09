import { readonly, shallowRef } from 'vue';
import {
  requestTagSuggestions,
  type JournalTagSuggestionRequest,
} from '../api';

export function useTagSuggestions() {
  const busy = shallowRef(false);

  async function generate(input: JournalTagSuggestionRequest): Promise<string[]> {
    busy.value = true;
    try {
      const response = await requestTagSuggestions(input);
      return response.tags;
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
