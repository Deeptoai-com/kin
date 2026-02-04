import type { FC } from 'react';
import { FullscreenOverlay } from './fullscreen-overlay';
import { ImageArtifact } from '../artifact-image';
import type { ArtifactImageFile } from '~/lib/stores/artifacts-store';

export interface ImagePreviewOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  images: ArtifactImageFile[];
  isLoading?: boolean;
  error?: string;
  title?: string;
}

function getTitle(title: string | undefined, images: ArtifactImageFile[]): string {
  if (title) return title;
  const first = images[0]?.filePath;
  if (first) return first.split('/').pop() || first;
  return 'Image Preview';
}

export const ImagePreviewOverlay: FC<ImagePreviewOverlayProps> = ({
  isOpen,
  onClose,
  images,
  isLoading = false,
  error,
  title,
}) => {
  const displayTitle = getTitle(title, images);
  const subtitle = images.length > 1 ? `${images.length} images` : undefined;

  return (
    <FullscreenOverlay
      isOpen={isOpen}
      onClose={onClose}
      accessibleTitle={`Image Preview ${displayTitle}`}
      title={displayTitle}
      subtitle={subtitle}
      badge={{ icon: '🖼️', label: 'Image', variant: 'purple' }}
      error={error ? { label: 'Preview Failed', message: error } : undefined}
      theme="dark"
    >
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            正在加载图片…
          </div>
        ) : images.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            暂无可预览的图片
          </div>
        ) : (
          <ImageArtifact
            content={images[0].content}
            title={displayTitle}
            mimeType={images[0].mimeType}
            images={images}
          />
        )}
      </div>
    </FullscreenOverlay>
  );
};

export default ImagePreviewOverlay;
