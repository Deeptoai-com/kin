import type { FC } from 'react';
import { X } from 'lucide-react';
import { cn } from '~/lib/utils';

interface SkillChipProps {
  label: string;
  onRemove?: () => void;
  className?: string;
}

export const SkillChip: FC<SkillChipProps> = ({ label, onRemove, className }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground',
        className
      )}
    >
      <span className="truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
          aria-label="移除技能"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
};
