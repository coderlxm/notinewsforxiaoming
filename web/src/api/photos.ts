import type {
  PhotoAlbumDetail,
  PhotoLibraryOverview,
} from '../../../src/shared/photoLibraryProtocol';
import { requestJson } from './client';

export function fetchPhotoLibrary(): Promise<PhotoLibraryOverview> {
  return requestJson<PhotoLibraryOverview>('/api/photos');
}

export function fetchPhotoAlbum(albumId: string): Promise<PhotoAlbumDetail> {
  return requestJson<PhotoAlbumDetail>(
    `/api/photos/albums/${encodeURIComponent(albumId)}`,
  );
}
