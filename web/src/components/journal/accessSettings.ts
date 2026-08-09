import type { JournalVisibility } from '../../types';

export interface AccessSettingsInput {
  visibility: JournalVisibility;
  accessPassword?: string;
}
