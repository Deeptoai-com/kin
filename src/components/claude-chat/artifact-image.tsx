/**
 * Image Artifact Component
 *
 * Renders image content with zoom/pan capabilities.
 * Supports base64-encoded images and URLs.
 */

import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { ArtifactImageFile } from '~/lib/stores/artifacts-store';

interface ImageArtifactProps {
  content: string;
  title?: string;
  mimeType?: string;
  images?: ArtifactImageFile[];
}

/**
 * Detect if content is a base64 data URL or plain URL
 */
function getImageSrc(content: string, mimeType?: string): string {
  // If already a data URL or http(s) URL, use as-is
  if (content.startsWith('data:') || content.startsWith('http')) {
    return content;
  }

  // Try to detect if it's base64
  const isBase64 = /^[A-Za-z0-9+/=]+$/.test(content.replace(/\s/g, ''));
  if (isBase64) {
    const type = mimeType || 'image/png';
    return `data:${type};base64,${content}`;
  }

  // Otherwise treat as URL
  return content;
}

export const ImageArtifact: FC<ImageArtifactProps> = ({
  content,
  title,
  mimeType,
  images,
}) => {
  const imageList = (images && images.length > 0)
    ? images
    : [{ filePath: title || 'image', content, mimeType }];
  const [activeIndex, setActiveIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState(false);

  const activeImage = imageList[Math.min(activeIndex, imageList.length - 1)];
  const imageSrc = getImageSrc(activeImage?.content || content, activeImage?.mimeType || mimeType);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));
  const handleReset = () => setScale(1);
  const handlePrev = () => setActiveIndex((idx) => Math.max(idx - 1, 0));
  const handleNext = () => setActiveIndex((idx) => Math.min(idx + 1, imageList.length - 1));
  const hasMultiple = imageList.length > 1;

  useEffect(() => {
    setActiveIndex(0);
  }, [imageList.length]);

  useEffect(() => {
    setScale(1);
    setError(false);
  }, [activeIndex, imageList.length]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">无法加载图片</p>
          <p className="mt-1 text-xs opacity-70 break-all max-w-md">
            {content.slice(0, 100)}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-2 border-b bg-muted/30 px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          disabled={scale <= 0.25}
          className="h-8 w-8"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="min-w-[4rem] text-center text-sm text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          disabled={scale >= 3}
          className="h-8 w-8"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleReset}
          className="h-8 w-8"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        {hasMultiple && (
          <>
            <div className="mx-2 h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={activeIndex === 0}
              className="h-8 px-2 text-xs"
            >
              上一张
            </Button>
            <span className="min-w-[4rem] text-center text-xs text-muted-foreground">
              {activeIndex + 1}/{imageList.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              disabled={activeIndex >= imageList.length - 1}
              className="h-8 px-2 text-xs"
            >
              下一张
            </Button>
          </>
        )}
      </div>

      {/* Image container */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className="flex items-center justify-center min-h-full"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease',
          }}
        >
          <img
            src={imageSrc}
            alt={title || 'Artifact image'}
            onError={() => setError(true)}
            className="max-w-full h-auto shadow-lg rounded"
            style={{ maxHeight: '80vh' }}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageArtifact;
