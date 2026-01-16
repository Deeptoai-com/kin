import { FC, useState } from 'react';
import { X, File, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { McpDetail, McpFile } from '~/claude/mcp';

interface McpDetailDialogProps {
  mcp: McpDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export const McpDetailDialog: FC<McpDetailDialogProps> = ({
  mcp,
  isOpen,
  onClose,
}) => {
  const [selectedFile, setSelectedFile] = useState<McpFile | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/']));

  if (!isOpen || !mcp) return null;

  if (!selectedFile && mcp.files.length > 0) {
    const manifest = findFileByName(mcp.files, 'MCP.md');
    if (manifest) {
      setSelectedFile(manifest);
    } else {
      const firstFile = findFirstFile(mcp.files);
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

  const handleFileClick = (file: McpFile) => {
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
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <File className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{mcp.name}</h2>
              <p className="text-sm text-muted-foreground">{mcp.category}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 border-r overflow-y-auto p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Files</h3>
            <FileTree
              files={mcp.files}
              expandedDirs={expandedDirs}
              selectedFile={selectedFile}
              onFileClick={handleFileClick}
              level={0}
            />
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedFile ? (
              <>
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

                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <FileContent file={selectedFile} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>Select a file to view its content</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface FileTreeProps {
  files: McpFile[];
  expandedDirs: Set<string>;
  selectedFile: McpFile | null;
  onFileClick: (file: McpFile) => void;
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
                  <div className="h-4 w-4 shrink-0" />
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
  file: McpFile;
}

const FileContent: FC<FileContentProps> = ({ file }) => {
  if (file.isBinary) {
    return (
      <div className="text-muted-foreground">
        Binary file preview is not supported.
      </div>
    );
  }

  if (file.isTooLarge) {
    return (
      <div className="text-muted-foreground">
        File is too large to preview.
      </div>
    );
  }

  if (!file.content) {
    return (
      <div className="text-muted-foreground">
        No content available.
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap break-words text-sm text-foreground">
      {file.content}
    </pre>
  );
};

function findFirstFile(files: McpFile[]): McpFile | null {
  for (const file of files) {
    if (file.type === 'file') return file;
    if (file.type === 'dir' && file.children) {
      const child = findFirstFile(file.children);
      if (child) return child;
    }
  }
  return null;
}

function findFileByName(files: McpFile[], name: string): McpFile | null {
  for (const file of files) {
    if (file.type === 'file' && file.name === name) return file;
    if (file.type === 'dir' && file.children) {
      const child = findFileByName(file.children, name);
      if (child) return child;
    }
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
