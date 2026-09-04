import type {
  ChannelTags,
  SiteContactItem,
  SiteProfile,
} from '../types';
import { requestJson } from './client';

export function fetchSiteProfile(): Promise<SiteProfile> {
  return requestJson<SiteProfile>('/api/site-profile');
}

export function updateSiteProfile(input: {
  bio: string;
  avatar: File | null;
  weatherEnabled: boolean;
  channelTags: ChannelTags;
  aboutIntro: string;
  contactItems: SiteContactItem[];
}): Promise<SiteProfile> {
  const form = new FormData();
  form.append('bio', input.bio);
  form.append('weatherEnabled', String(input.weatherEnabled));
  form.append('channelTags', JSON.stringify(input.channelTags));
  form.append('aboutIntro', input.aboutIntro);
  form.append('contactItems', JSON.stringify(input.contactItems));
  if (input.avatar !== null) form.append('avatar', input.avatar);
  return requestJson<SiteProfile>('/api/me/site-profile', { method: 'PATCH', body: form });
}
