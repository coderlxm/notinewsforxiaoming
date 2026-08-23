import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import type { drive_v3 } from 'googleapis';
import type {
  PhotoAlbumDetail,
  PhotoAlbumSummary,
  PhotoDisplayMetadata,
  PhotoImageVariant,
  PhotoImageVariantName,
  PhotoLibraryOverview,
  PhotoLibraryPhoto,
} from '../shared/photoLibraryProtocol.js';
import type { JournalPhotoDriveClient } from './photoDriveClient.js';

dayjs.extend(customParseFormat);

const driveFolderMimeType = 'application/vnd.google-apps.folder';
const jpegMimeType = 'image/jpeg';
const indexFreshnessMs = 5 * 60 * 1000;

const variantSpecifications = {
  preview: { width: 64, quality: 35 },
  card: { width: 1600, height: 1600, quality: 82 },
  view: { width: 3000, height: 3000, quality: 90 },
} as const satisfies Record<PhotoImageVariantName, {
  width: number;
  height?: number;
  quality: number;
}>;

interface IndexedPhoto {
  driveFileId: string;
  driveName: string;
  contentRevision: string;
  publicPhoto: PhotoLibraryPhoto;
  snapshot: object;
}

interface IndexedAlbum {
  driveFolderId: string;
  driveName: string;
  publicSummary: PhotoAlbumSummary;
  publicDetail: PhotoAlbumDetail;
  photos: IndexedPhoto[];
  snapshot: object;
}

interface PhotoLibraryIndex {
  overview: PhotoLibraryOverview;
  albumsById: ReadonlyMap<string, PhotoAlbumDetail>;
  photosById: ReadonlyMap<string, IndexedPhoto>;
}

export interface JournalPhotoMedia {
  source: Readable;
  resize: {
    width: number;
    height?: number;
  };
  quality: number;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function requireString(value: string | null | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function requirePositiveInteger(value: number | null | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function cleanOptionalString(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatTakenAt(value: string | null | undefined, label: string): string | null {
  if (!value) return null;
  const parsed = dayjs(value, 'YYYY:MM:DD HH:mm:ss', true);
  if (!parsed.isValid()) throw new Error(`${label} has an invalid EXIF capture time.`);
  return parsed.format('YYYY-MM-DDTHH:mm:ss');
}

function formatCamera(makeValue: string | null | undefined, modelValue: string | null | undefined) {
  const make = cleanOptionalString(makeValue);
  const model = cleanOptionalString(modelValue);
  if (!make) return model;
  if (!model) return make;
  return model.toLocaleLowerCase().startsWith(make.toLocaleLowerCase())
    ? model
    : `${make} ${model}`;
}

function formatShutterSpeed(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) throw new Error('Exposure time must be positive.');
  if (value >= 1) return `${formatNumber(value)} s`;
  return `1/${Math.round(1 / value)} s`;
}

function mapDisplayMetadata(
  metadata: NonNullable<drive_v3.Schema$File['imageMediaMetadata']>,
  label: string,
): PhotoDisplayMetadata {
  return {
    takenAt: formatTakenAt(metadata.time, label),
    camera: formatCamera(metadata.cameraMake, metadata.cameraModel),
    lens: cleanOptionalString(metadata.lens),
    focalLength: metadata.focalLength === null || metadata.focalLength === undefined
      ? null
      : `${formatNumber(metadata.focalLength)} mm`,
    aperture: metadata.aperture === null || metadata.aperture === undefined
      ? null
      : `f/${formatNumber(metadata.aperture)}`,
    shutterSpeed: formatShutterSpeed(metadata.exposureTime),
    iso: metadata.isoSpeed === null || metadata.isoSpeed === undefined
      ? null
      : String(metadata.isoSpeed),
  };
}

function rotatedDimensions(width: number, height: number, rotation: number | null | undefined) {
  return Math.abs(rotation ?? 0) % 2 === 1
    ? { width: height, height: width }
    : { width, height };
}

function constrainDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maximumWidth: number,
  maximumHeight?: number,
) {
  const scale = Math.min(
    1,
    maximumWidth / sourceWidth,
    maximumHeight === undefined ? 1 : maximumHeight / sourceHeight,
  );
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function createVariant(
  contentRevision: string,
  photoId: string,
  variant: PhotoImageVariantName,
  sourceWidth: number,
  sourceHeight: number,
): PhotoImageVariant {
  const specification = variantSpecifications[variant];
  return {
    url: `/media/photos/${contentRevision}/${photoId}/${variant}`,
    ...constrainDimensions(
      sourceWidth,
      sourceHeight,
      specification.width,
      'height' in specification ? specification.height : undefined,
    ),
  };
}

function compareNullableTakenAtAscending(left: IndexedPhoto, right: IndexedPhoto): number {
  const leftTime = left.publicPhoto.metadata.takenAt;
  const rightTime = right.publicPhoto.metadata.takenAt;
  if (leftTime && rightTime && leftTime !== rightTime) return leftTime.localeCompare(rightTime);
  if (leftTime && !rightTime) return -1;
  if (!leftTime && rightTime) return 1;
  return left.driveName.localeCompare(right.driveName)
    || left.driveFileId.localeCompare(right.driveFileId);
}

interface FeaturedPhotoCandidate {
  albumName: string;
  photo: IndexedPhoto;
}

function compareFeatured(left: FeaturedPhotoCandidate, right: FeaturedPhotoCandidate) {
  const leftTime = left.photo.publicPhoto.metadata.takenAt;
  const rightTime = right.photo.publicPhoto.metadata.takenAt;
  if (leftTime && rightTime && leftTime !== rightTime) return rightTime.localeCompare(leftTime);
  if (leftTime && !rightTime) return -1;
  if (!leftTime && rightTime) return 1;
  const albumNameComparison = left.albumName.localeCompare(right.albumName);
  return albumNameComparison
    || left.photo.driveName.localeCompare(right.photo.driveName)
    || left.photo.driveFileId.localeCompare(right.photo.driveFileId);
}

function newestTakenAt(album: IndexedAlbum): string | null {
  const times = album.photos
    .map(photo => photo.publicPhoto.metadata.takenAt)
    .filter((value): value is string => value !== null);
  return times.at(-1) ?? null;
}

function compareAlbums(left: IndexedAlbum, right: IndexedAlbum): number {
  const leftTime = newestTakenAt(left);
  const rightTime = newestTakenAt(right);
  if (leftTime && rightTime && leftTime !== rightTime) return rightTime.localeCompare(leftTime);
  if (leftTime && !rightTime) return -1;
  if (!leftTime && rightTime) return 1;
  return left.driveName.localeCompare(right.driveName)
    || left.driveFolderId.localeCompare(right.driveFolderId);
}

export class JournalPhotoLibraryService {
  private currentIndex: PhotoLibraryIndex | null = null;
  private refreshedAt = 0;
  private pendingRefresh: Promise<PhotoLibraryIndex> | null = null;

  constructor(
    private readonly drive: JournalPhotoDriveClient,
    private readonly rootFolderId: string,
  ) {}

  async initialize(): Promise<void> {
    await this.ensureCurrent();
  }

  async ensureCurrent(): Promise<PhotoLibraryOverview> {
    const index = await this.getCurrentIndex();
    return index.overview;
  }

  async getAlbum(albumId: string): Promise<PhotoAlbumDetail | null> {
    const index = await this.getCurrentIndex();
    return index.albumsById.get(albumId) ?? null;
  }

  async openMedia(
    contentRevision: string,
    photoId: string,
    variant: PhotoImageVariantName,
    signal: AbortSignal,
  ): Promise<JournalPhotoMedia | null> {
    const photo = this.currentIndex?.photosById.get(photoId);
    if (!photo || photo.contentRevision !== contentRevision) return null;
    const specification = variantSpecifications[variant];
    return {
      source: await this.drive.openFile(photo.driveFileId, signal),
      resize: {
        width: specification.width,
        ...('height' in specification ? { height: specification.height } : {}),
      },
      quality: specification.quality,
    };
  }

  private async getCurrentIndex(): Promise<PhotoLibraryIndex> {
    if (
      this.currentIndex
      && Date.now() - this.refreshedAt <= indexFreshnessMs
    ) {
      return this.currentIndex;
    }
    if (this.pendingRefresh) return await this.pendingRefresh;

    const refresh = this.refresh();
    this.pendingRefresh = refresh;
    try {
      return await refresh;
    } finally {
      this.pendingRefresh = null;
    }
  }

  private async refresh(): Promise<PhotoLibraryIndex> {
    const rootChildren = await this.drive.listChildren(this.rootFolderId);
    if (rootChildren.length === 0) throw new Error('Photo library root folder is empty.');

    const albums: IndexedAlbum[] = [];
    for (const folder of rootChildren) {
      if (folder.mimeType !== driveFolderMimeType) continue;

      const folderId = requireString(folder.id, 'Photo album folder id');
      const folderName = requireString(folder.name, 'Photo album folder name');

      const albumId = sha256(folderId);
      const drivePhotos = await this.drive.listChildren(folderId);
      if (drivePhotos.length === 0) throw new Error(`Photo album ${folderName} is empty.`);
      const photos = drivePhotos
        .filter(file => file.mimeType === jpegMimeType && /\.jpe?g$/i.test(file.name ?? ''))
        .map(file => this.indexPhoto(file, albumId, folderName));
      if (photos.length === 0) continue;
      photos.sort(compareNullableTakenAtAscending);

      const takenTimes = photos
        .map(photo => photo.publicPhoto.metadata.takenAt)
        .filter((value): value is string => value !== null);
      const cover = takenTimes.length > 0
        ? photos.filter(photo => photo.publicPhoto.metadata.takenAt !== null).at(-1)!
        : photos[0]!;
      const summary: PhotoAlbumSummary = {
        id: albumId,
        name: folderName,
        photoCount: photos.length,
        takenAtStart: takenTimes[0] ?? null,
        takenAtEnd: takenTimes.at(-1) ?? null,
        cover: cover.publicPhoto,
      };
      const detail: PhotoAlbumDetail = {
        revision: '',
        album: {
          id: summary.id,
          name: summary.name,
          photoCount: summary.photoCount,
          takenAtStart: summary.takenAtStart,
          takenAtEnd: summary.takenAtEnd,
        },
        photos: photos.map(photo => photo.publicPhoto),
      };
      albums.push({
        driveFolderId: folderId,
        driveName: folderName,
        publicSummary: summary,
        publicDetail: detail,
        photos,
        snapshot: {
          id: folderId,
          name: folderName,
          mimeType: folder.mimeType,
          parents: folder.parents ?? [],
          modifiedTime: folder.modifiedTime ?? null,
          photos: photos
            .slice()
            .sort((left, right) => left.driveFileId.localeCompare(right.driveFileId))
            .map(photo => photo.snapshot),
        },
      });
    }

    albums.sort(compareAlbums);
    const revision = sha256(JSON.stringify(
      albums
        .slice()
        .sort((left, right) => left.driveFolderId.localeCompare(right.driveFolderId))
        .map(album => album.snapshot),
    ));
    for (const album of albums) album.publicDetail.revision = revision;

    const featured = albums
      .flatMap(album => album.photos.map(photo => ({ albumName: album.driveName, photo })))
      .sort(compareFeatured)
      .slice(0, 12)
      .map(item => item.photo.publicPhoto);
    const index: PhotoLibraryIndex = {
      overview: {
        revision,
        featured,
        albums: albums.map(album => album.publicSummary),
      },
      albumsById: new Map(albums.map(album => [album.publicSummary.id, album.publicDetail])),
      photosById: new Map(
        albums.flatMap(album => album.photos.map(photo => [photo.publicPhoto.id, photo] as const)),
      ),
    };
    this.currentIndex = index;
    this.refreshedAt = Date.now();
    return index;
  }

  private indexPhoto(
    file: drive_v3.Schema$File,
    albumId: string,
    albumName: string,
  ): IndexedPhoto {
    const fileId = requireString(file.id, `Photo in album ${albumName} id`);
    const fileName = requireString(file.name, `Photo name in album ${albumName}`);
    if (file.capabilities?.canDownload !== true) {
      throw new Error(`Photo ${fileName} in album ${albumName} cannot be downloaded.`);
    }
    const checksum = requireString(file.md5Checksum, `Photo ${fileName} md5Checksum`);
    const metadata = file.imageMediaMetadata;
    if (!metadata) throw new Error(`Photo ${fileName} does not expose image metadata.`);
    const originalWidth = requirePositiveInteger(metadata.width, `Photo ${fileName} width`);
    const originalHeight = requirePositiveInteger(metadata.height, `Photo ${fileName} height`);
    const dimensions = rotatedDimensions(originalWidth, originalHeight, metadata.rotation);
    const photoId = sha256(fileId);
    const contentRevision = sha256(`${fileId}:${checksum}`);
    const publicPhoto: PhotoLibraryPhoto = {
      id: photoId,
      albumId,
      title: fileName.replace(/\.[^.]+$/, ''),
      preview: createVariant(
        contentRevision,
        photoId,
        'preview',
        dimensions.width,
        dimensions.height,
      ),
      card: createVariant(
        contentRevision,
        photoId,
        'card',
        dimensions.width,
        dimensions.height,
      ),
      view: createVariant(
        contentRevision,
        photoId,
        'view',
        dimensions.width,
        dimensions.height,
      ),
      metadata: mapDisplayMetadata(metadata, `Photo ${fileName}`),
    };
    return {
      driveFileId: fileId,
      driveName: fileName,
      contentRevision,
      publicPhoto,
      snapshot: {
        id: fileId,
        name: fileName,
        mimeType: file.mimeType,
        parents: file.parents ?? [],
        md5Checksum: checksum,
        modifiedTime: file.modifiedTime ?? null,
        imageMediaMetadata: {
          width: metadata.width,
          height: metadata.height,
          rotation: metadata.rotation ?? null,
          time: metadata.time ?? null,
          cameraMake: metadata.cameraMake ?? null,
          cameraModel: metadata.cameraModel ?? null,
          lens: metadata.lens ?? null,
          focalLength: metadata.focalLength ?? null,
          aperture: metadata.aperture ?? null,
          exposureTime: metadata.exposureTime ?? null,
          isoSpeed: metadata.isoSpeed ?? null,
        },
      },
    };
  }
}
