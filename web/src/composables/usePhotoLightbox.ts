import { toValue } from 'vue';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import dayjs from 'dayjs';
import type { MaybeRefOrGetter } from 'vue';
import type { SlideData } from 'photoswipe';
import type { PhotoLibraryPhoto } from '../../../src/shared/photoLibraryProtocol';

interface PhotoSlideData extends SlideData {
  photo: PhotoLibraryPhoto;
}

function createCaptionContent(container: HTMLElement, photo: PhotoLibraryPhoto): void {
  const title = document.createElement('strong');
  title.textContent = photo.title;

  const metadata = [
    photo.metadata.takenAt
      ? `拍摄日期 ${dayjs(photo.metadata.takenAt).format('YYYY年M月D日')}`
      : null,
    photo.metadata.camera ? `相机 ${photo.metadata.camera}` : null,
    photo.metadata.lens ? `镜头 ${photo.metadata.lens}` : null,
    photo.metadata.focalLength ? `焦段 ${photo.metadata.focalLength}` : null,
    photo.metadata.aperture ? `光圈 ${photo.metadata.aperture}` : null,
    photo.metadata.shutterSpeed ? `快门 ${photo.metadata.shutterSpeed}` : null,
    photo.metadata.iso ? `ISO ${photo.metadata.iso}` : null,
  ].filter((value): value is string => value !== null);

  const details = document.createElement('span');
  details.textContent = metadata.join(' · ');

  container.replaceChildren(title);
  if (metadata.length > 0) container.append(details);
}

function createDataSource(photos: readonly PhotoLibraryPhoto[]): PhotoSlideData[] {
  return photos.map(photo => ({
    src: photo.view.url,
    width: photo.view.width,
    height: photo.view.height,
    msrc: photo.card.url,
    alt: photo.title,
    title: photo.title,
    photo,
  }));
}

export function usePhotoLightbox(
  photos: MaybeRefOrGetter<readonly PhotoLibraryPhoto[]>,
) {
  let lightbox: PhotoSwipeLightbox | null = null;

  function createLightbox(): PhotoSwipeLightbox {
    const instance = new PhotoSwipeLightbox({
      pswpModule: () => import('photoswipe'),
      bgOpacity: 0.96,
      closeTitle: '关闭照片',
      zoomTitle: '缩放照片',
      arrowPrevTitle: '上一张照片',
      arrowNextTitle: '下一张照片',
      errorMsg: '照片没有加载完成。',
    });

    instance.on('uiRegister', () => {
      instance.pswp!.ui!.registerElement({
        name: 'photoCaption',
        className: 'photo-lightbox-caption',
        appendTo: 'root',
        order: 9,
        onInit: (element, pswp) => {
          element.setAttribute('aria-live', 'polite');
          element.style.position = 'absolute';
          element.style.right = '0';
          element.style.bottom = '0';
          element.style.left = '0';
          element.style.zIndex = '10';
          element.style.display = 'grid';
          element.style.gap = '0.3rem';
          element.style.padding = '2.8rem max(1.25rem, env(safe-area-inset-right)) max(1.1rem, env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left))';
          element.style.background = 'linear-gradient(transparent, rgb(0 0 0 / 76%))';
          element.style.color = '#fff';
          element.style.pointerEvents = 'none';
          element.style.font = '0.76rem/1.55 var(--font-sans)';

          const updateCaption = (): void => {
            const slide = pswp.currSlide?.data as PhotoSlideData | undefined;
            if (slide) createCaptionContent(element, slide.photo);
          };

          pswp.on('change', updateCaption);
          updateCaption();
        },
      });
    });

    instance.init();
    return instance;
  }

  function open(index: number): void {
    lightbox ??= createLightbox();
    lightbox.loadAndOpen(index, createDataSource(toValue(photos)));
  }

  function destroy(): void {
    lightbox?.destroy();
    lightbox = null;
  }

  return { open, destroy };
}
