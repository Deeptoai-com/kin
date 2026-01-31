import { FC, useState } from 'react';
import { X, File, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { useIntlayer } from 'react-intlayer';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { SkillDetail, SkillFile } from '~/claude/skills';

interface SkillDetailDialogProps {
  skill: SkillDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SkillDetailDialog: FC<SkillDetailDialogProps> = ({
  skill,
  isOpen,
  onClose,
}) => {
  const content = useIntlayer('skills');
  const [selectedFile, setSelectedFile] = useState<SkillFile | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/']));

  if (!isOpen || !skill) return null;

  // Auto-select SKILL.md on first load
  if (!selectedFile && skill.files.length > 0) {
    const skillMd = findFileByName(skill.files, 'SKILL.md');
    if (skillMd) {
      setSelectedFile(skillMd);
    } else {
      // Select first file if SKILL.md not found
      const firstFile = findFirstFile(skill.files);
      if (firstFile) setSelectedFile(firstFile);
    }
  }

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleFileClick = (file: SkillFile) => {
    if (file.type === 'dir') {
      toggleDir(file.path);
    } else {
      setSelectedFile(file);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-[90vw] max-w-6xl flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <File className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{skill.name}</h2>
              <p className="text-sm text-muted-foreground">{skill.category}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* File Tree */}
          <div className="w-72 border-r overflow-y-auto p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{content.detail.filesLabel}</h3>
            <FileTree
              files={skill.files}
              expandedDirs={expandedDirs}
              selectedFile={selectedFile}
              onFileClick={handleFileClick}
              level={0}
            />
          </div>

          {/* File Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedFile ? (
              <>
                {/* File Header */}
                <div className="flex items-center justify-between border-b px-6 py-3">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedFile.name}</span>
                    {selectedFile.size !== undefined && (
                      <span className="text-sm text-muted-foreground">
                        ({formatFileSize(selectedFile.size)})
                      </span>
                    )}
                  </div>
                </div>

                {/* File Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <FileContent file={selectedFile} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>{content.detail.selectFile}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface FileTreeProps {
  files: SkillFile[];
  expandedDirs: Set<string>;
  selectedFile: SkillFile | null;
  onFileClick: (file: SkillFile) => void;
  level: number;
}

const FileTree: FC<FileTreeProps> = ({
  files,
  expandedDirs,
  selectedFile,
  onFileClick,
  level,
}) => {
  return (
    <div className={cn('space-y-0.5', level > 0 && 'ml-4')}>
      {files.map((file) => {
        const isExpanded = expandedDirs.has(file.path);
        const isSelected = selectedFile?.path === file.path;

        return (
          <div key={file.path}>
            <div
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-muted'
              )}
              onClick={() => onFileClick(file)}
            >
              {file.type === 'dir' ? (
                <>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
                  ) : (
                    <Folder className="h-4 w-4 shrink-0 text-blue-500" />
                  )}
                  <span className="flex-1 truncate">{file.name}</span>
                </>
              ) : (
                <>
                  <div className="h-4 w-4 shrink-0" /> {/* Spacer */}
                  <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                </>
              )}
            </div>
            {file.type === 'dir' && isExpanded && file.children && (
              <FileTree
                files={file.children}
                expandedDirs={expandedDirs}
                selectedFile={selectedFile}
                onFileClick={onFileClick}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

interface FileContentProps {
  file: SkillFile;
}

const FileContent: FC<FileContentProps> = ({ file }) => {
  const content = useIntlayer('skills');

  if (file.type === 'dir') {
    return <div className="text-muted-foreground">{content.detail.directoryNoContent}</div>;
  }

  if (file.isBinary) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <File className="h-5 w-5" />
        <span>{content.detail.binaryFile}</span>
      </div>
    );
  }

  if (file.isTooLarge) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <File className="h-5 w-5" />
        <span>{content.detail.tooLarge}</span>
      </div>
    );
  }

  if (file.content === undefined) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <File className="h-5 w-5" />
        <span>{content.detail.noContent}</span>
      </div>
    );
  }

  // Determine file type for syntax highlighting
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (extension === 'md') {
    return <MarkdownPreview content={file.content} />;
  }

  return <CodePreview content={file.content} filename={file.name} />;
};

interface MarkdownPreviewProps {
  content: string;
}

const MarkdownPreview: FC<MarkdownPreviewProps> = ({ content }) => {
  // Simple markdown preview - for now just render as preformatted text with basic formatting
  // In a full implementation, you'd use react-markdown here
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
        {content}
      </pre>
    </div>
  );
};

interface CodePreviewProps {
  content: string;
  filename: string;
}

const CodePreview: FC<CodePreviewProps> = ({ content, filename }) => {
  // For now, just show as preformatted text
  // In a full implementation, you'd use react-syntax-highlighter here
  return (
    <pre className="h-full overflow-auto rounded-lg bg-muted p-4 text-sm">
      <code>{content}</code>
    </pre>
  );
};

// Helper functions
function findFileByName(files: SkillFile[], name: string): SkillFile | null {
  for (const file of files) {
    if (file.type === 'file' && file.name === name) {
      return file;
    }
    if (file.type === 'dir' && file.children) {
      const found = findFileByName(file.children, name);
      if (found) return found;
    }
  }
  return null;
}

function findFirstFile(files: SkillFile[]): SkillFile | null {
  for (const file of files) {
    if (file.type === 'file') {
      return file;
    }
    if (file.type === 'dir' && file.children) {
      const found = findFirstFile(file.children);
      if (found) return found;
    }
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
