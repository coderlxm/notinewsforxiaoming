import type { JournalDeletionResult } from '../shared/journalProtocol.js';
import type { JournalRepository } from './repository.js';
import type { JournalStorage } from './storage.js';
import type { JournalDeletionTarget } from './types.js';

export class JournalDeletionService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly storage: JournalStorage,
  ) {}

  async deleteById(id: number): Promise<JournalDeletionResult | null> {
    return this.deleteTarget(this.repository.findDeletionTargetById(id));
  }

  async deleteByPublicId(publicId: string): Promise<JournalDeletionResult | null> {
    return this.deleteTarget(this.repository.findDeletionTargetByPublicId(publicId));
  }

  private async deleteTarget(
    target: JournalDeletionTarget | null,
  ): Promise<JournalDeletionResult | null> {
    if (!target) return null;
    await this.storage.deleteEntryAssets(target.entries);
    return this.repository.deleteTarget(target);
  }
}
