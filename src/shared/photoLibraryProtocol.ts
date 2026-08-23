export const photoImageVariantNames = ['preview', 'card', 'view'] as const;

export type PhotoImageVariantName = typeof photoImageVariantNames[number];

export interface PhotoImageVariant {
  url: string;
  width: number;
  height: number;
}

export interface PhotoDisplayMetadata {
  takenAt: string | null;
  camera: string | null;
  lens: string | null;
  focalLength: string | null;
  aperture: string | null;
  shutterSpeed: string | null;
  iso: string | null;
}

export interface PhotoLibraryPhoto {
  id: string;
  albumId: string;
  title: string;
  preview: PhotoImageVariant;
  card: PhotoImageVariant;
  view: PhotoImageVariant;
  metadata: PhotoDisplayMetadata;
}

export interface PhotoAlbumSummary {
  id: string;
  name: string;
  photoCount: number;
  takenAtStart: string | null;
  takenAtEnd: string | null;
  cover: PhotoLibraryPhoto;
}

export interface PhotoLibraryOverview {
  revision: string;
  featured: PhotoLibraryPhoto[];
  albums: PhotoAlbumSummary[];
}

export interface PhotoAlbumDetail {
  revision: string;
  album: Omit<PhotoAlbumSummary, 'cover'>;
  photos: PhotoLibraryPhoto[];
}
