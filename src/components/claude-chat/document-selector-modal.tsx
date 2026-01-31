/**
 * Document Selector Modal Component
 *
 * Allows users to select documents from the global document library
 * to add to the current session's knowledge base.
 */

'use client';

import { useState, useEffect } from 'react';
import { useIntlayer } from 'react-intlayer';
import { useQuery } from '@tanstack/react-query';
import { X, Search, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { cn, toLocalizedString } from '~/lib/utils';

interface Document {
  id: string;
  title: string;
  filename: string;
  size: number;
  fileType: string;
  createdAt: string;
}

interface DocumentSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (fileIds: string[]) => Promise<void>;
  excludeFileIds?: string[]; // Already added documents
}

export function DocumentSelectorModal({
  isOpen,
  onClose,
  onSelect,
  excludeFileIds = [],
}: DocumentSelectorModalProps) {
  const content = useIntlayer('documents');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Fetch documents from global library
  const { data, isLoading, error } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json() as Promise<Document[]>;
    },
    enabled: isOpen,
  });

  const documents = data || [];

  // Filter out already added documents and apply search
  const availableDocuments = documents.filter((doc) => {
    if (excludeFileIds.includes(doc.id)) return false;
    if (!searchQuery) return true;
    return (
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.filename?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === availableDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(availableDocuments.map((doc) => doc.id)));
    }
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;

    setIsAdding(true);
    try {
      await onSelect(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSearchQuery('');
      onClose();
    } catch (error) {
      console.error('Failed to add documents:', error);
      alert(toLocalizedString(content.selector.addFailed));
    } finally {
      setIsAdding(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${sizes[i]}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-xl bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold text-foreground">
            {content.selector.title}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition hover:bg-accent"
            aria-label={toLocalizedString(content.selector.close)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={toLocalizedString(content.selector.searchPlaceholder)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Document List */}
        <div className="max-h-96 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-destructive">
              {content.selector.loadError}
            </div>
          ) : availableDocuments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? content.selector.noResults : content.selector.noDocuments}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select All */}
              {availableDocuments.length > 0 && (
                <div className="mb-3">
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-primary hover:underline"
                  >
                    {selectedIds.size === availableDocuments.length
                      ? content.selector.deselectAll
                      : content.selector.selectAll}
                  </button>
                </div>
              )}

              {availableDocuments.map((doc) => {
                const isSelected = selectedIds.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleToggle(doc.id)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-accent'
                    )}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                        isSelected
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      )}
                    >
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                    </div>

                    {/* Icon */}
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-sm text-foreground">
                        {doc.title || doc.filename}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(doc.size)}</span>
                        {doc.fileType && (
                          <>
                            <span>•</span>
                            <span>{doc.fileType}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t p-4">
          <p className="text-sm text-muted-foreground">
            {toLocalizedString(content.selector.selected).replace('{count}', String(selectedIds.size))}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              {content.selector.cancel}
            </button>
            <button
              onClick={handleAdd}
              disabled={selectedIds.size === 0 || isAdding}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {isAdding ? (
                <>
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  {content.selector.adding}
                </>
              ) : (
                content.selector.addToSession
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
