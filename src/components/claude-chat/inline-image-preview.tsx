import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { ImagePreviewOverlay } from './overlay/image-preview-overlay';
import type { ArtifactImageFile } from '~/lib/stores/artifacts-store';

export interface InlineImagePreviewProps {
  images: ArtifactImageFile[];
  title?: string;
}

function getImageSrc(content: string, mimeType?: string): string {
  if (content.startsWith('data:') || content.startsWith('http')) {
    return content;
  }

  const isBase64 = /^[A-Za-z0-9+/=]+$/.test(content.replace(/\s/g, ''));
  if (isBase64) {
    const type = mimeType || 'image/png';
    return `data:${type};base64,${content}`;
  }

  return content;
}

export const InlineImagePreview: FC<InlineImagePreviewProps> = ({ images, title }) => {
  const imageList = useMemo(() => images.filter((image) => Boolean(image?.content)), [images]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [error, setError] = useState(false);

  const hasMultiple = imageList.length > 1;
  const activeImage = imageList[Math.min(activeIndex, Math.max(imageList.length - 1, 0))];
  const imageSrc = activeImage ? getImageSrc(activeImage.content, activeImage.mimeType) : '';

  useEffect(() => {
    setActiveIndex(0);
  }, [imageList.length]);

  useEffect(() => {
    setError(false);
  }, [activeIndex, imageList.length]);

  if (imageList.length === 0) return null;

  if (error) {
    return (
      <div className="mt-3 text-xs text-muted-foreground">
        Image preview unavailable.
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="group relative overflow-hidden rounded-xl">
        <button
          type="button"
          onClick={() => setShowOverlay(true)}
          className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Open image preview"
        >
          <img
            src={imageSrc}
            alt={title || activeImage?.filePath || 'Generated image'}
            onError={() => setError(true)}
            className="h-auto w-full cursor-zoom-in object-contain"
          />
        </button>
        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/70 px-2 py-1 text-[11px] text-muted-foreground opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" />
          <span>Preview</span>
        </div>
      </div>

      {hasMultiple && (
        <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={() => setActiveIndex((idx) => Math.max(idx - 1, 0))}
            className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-muted/60"
            aria-label="Previous image"
            disabled={activeIndex === 0}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span>{activeIndex + 1}/{imageList.length}</span>
          <button
            type="button"
            onClick={() => setActiveIndex((idx) => Math.min(idx + 1, imageList.length - 1))}
            className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-muted/60"
            aria-label="Next image"
            disabled={activeIndex >= imageList.length - 1}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <ImagePreviewOverlay
        isOpen={showOverlay}
        onClose={() => setShowOverlay(false)}
        images={imageList}
        title={title}
      />
    </div>
  );
};

export default InlineImagePreview;
