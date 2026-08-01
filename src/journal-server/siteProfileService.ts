import fs from 'node:fs';
import sharp from 'sharp';
import type { JournalChannelTags, JournalSiteProfile } from '../shared/journalProtocol.js';
import { journalSiteProfileBioSchema } from '../shared/journalProtocol.js';
import type { JournalRepository, JournalSiteProfileRecord } from './repository.js';

export const maxSiteProfileAvatarBytes = 5 * 1024 * 1024;

const initialBio = '姚黄魏紫开次第，不觉成恨俱零凋';
const allowedAvatarMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedAvatarFormats = new Set(['jpeg', 'png', 'webp']);

export interface JournalSiteProfileAvatarUpload {
  buffer: Buffer;
  mimeType: string;
}

export class JournalSiteProfileInputError extends Error {
  readonly statusCode = 400;
}

export class JournalSiteProfileService {
  constructor(private readonly repository: JournalRepository) {}

  async initialize(initialAvatarPath: string): Promise<void> {
    if (this.repository.getSiteProfileOrNull()) return;
    const source = await fs.promises.readFile(initialAvatarPath);
    const avatarWebp = await this.processAvatar(source);
    this.repository.initializeSiteProfile(initialBio, avatarWebp, new Date().toISOString());
  }

  getProfile(): JournalSiteProfile {
    return this.toPublicProfile(this.getRequiredProfile());
  }

  getAvatarWebp(): Buffer {
    return this.getRequiredProfile().avatarWebp;
  }

  async update(input: {
    bio: string;
    avatar: JournalSiteProfileAvatarUpload | null;
    weatherEnabled: boolean;
    channelTags: JournalChannelTags;
  }): Promise<JournalSiteProfile> {
    const bio = journalSiteProfileBioSchema.parse(input.bio);
    const avatarWebp = input.avatar === null
      ? null
      : await this.processAvatarUpload(input.avatar);
    const profile = this.repository.updateSiteProfile({
      bio,
      avatarWebp,
      weatherEnabled: input.weatherEnabled,
      channelTags: input.channelTags,
      updatedAt: new Date().toISOString(),
    });
    return this.toPublicProfile(profile);
  }

  private async processAvatarUpload(input: JournalSiteProfileAvatarUpload): Promise<Buffer> {
    if (!allowedAvatarMimeTypes.has(input.mimeType)) {
      throw new JournalSiteProfileInputError(
        'Avatar must use the JPEG, PNG, or WebP MIME type.',
      );
    }
    if (input.buffer.byteLength > maxSiteProfileAvatarBytes) {
      throw new JournalSiteProfileInputError('Avatar exceeds the 5 MB upload limit.');
    }
    return await this.processAvatar(input.buffer);
  }

  private async processAvatar(source: Buffer): Promise<Buffer> {
    try {
      const image = sharp(source, { animated: false });
      const metadata = await image.metadata();
      if (!metadata.format || !allowedAvatarFormats.has(metadata.format)) {
        throw new JournalSiteProfileInputError(
          'Avatar must be a readable JPEG, PNG, or WebP image.',
        );
      }
      return await image
        .autoOrient()
        .resize(512, 512, { fit: 'cover', position: 'center' })
        .webp()
        .toBuffer();
    } catch (error) {
      if (error instanceof JournalSiteProfileInputError) throw error;
      throw new JournalSiteProfileInputError(
        'Avatar must be a readable JPEG, PNG, or WebP image.',
        { cause: error },
      );
    }
  }

  private getRequiredProfile(): JournalSiteProfileRecord {
    const profile = this.repository.getSiteProfileOrNull();
    if (!profile) throw new Error('Journal site profile was not initialized.');
    return profile;
  }

  private toPublicProfile(profile: JournalSiteProfileRecord): JournalSiteProfile {
    return {
      bio: profile.bio,
      avatarUrl: `/api/site-profile/avatar?v=${profile.avatarRevision}`,
      weatherEnabled: profile.weatherEnabled,
      channelTags: profile.channelTags,
      updatedAt: profile.updatedAt,
    };
  }
}
