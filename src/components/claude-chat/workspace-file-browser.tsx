/**
 * Workspace File Browser Component
 *
 * Displays a tree view of workspace files for a session.
 * Allows selecting files to preview their content.
 */

import type { FC } from 'react'
import { useState, useEffect } from 'react'
import { File, Folder, ChevronRight, ChevronDown } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

export interface WorkspaceFileBrowserProps {
  sessionId: string
  onFileSelect?: (filePath: string, content: string) => void
}

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

type BuildNode = Omit<FileNode, 'children'> & { children?: Record<string, BuildNode> }

/**
 * Build a tree structure from flat file paths
 */
function buildFileTree(filePaths: string[]): FileNode[] {
  const root: Record<string, BuildNode> = {}

  for (const filePath of filePaths) {
    const parts = filePath.split('/')
    let current: Record<string, BuildNode> = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const fullPath = parts.slice(0, i + 1).join('/')

      if (!current[part]) {
        current[part] = {
          name: part,
          path: fullPath,
          isDirectory: !isLast,
          children: isLast ? undefined : {},
        }
      }

      if (!isLast && current[part].children) {
        current = current[part].children
      }
    }
  }

  // Convert record to array and sort
  const convertToArray = (nodes: Record<string, BuildNode>): FileNode[] => {
    const result = Object.values(nodes)
      .sort((a, b) => {
      // Directories first, then files
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
      })
      .map((node) => ({
        name: node.name,
        path: node.path,
        isDirectory: node.isDirectory,
        children: node.children ? convertToArray(node.children) : undefined,
      }))

    return result
  }

  return convertToArray(root)
}

/**
 * File Tree Node Component
 */
const FileTreeNode: FC<{
  node: FileNode
  sessionId: string
  depth: number
  onFileSelect?: (filePath: string, content: string) => void
}> = ({ node, sessionId, depth, onFileSelect }) => {
  const [isExpanded, setIsExpanded] = useState(depth === 0)
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (node.isDirectory) {
      setIsExpanded(!isExpanded)
    } else {
      // Load file content
      setIsLoading(true)
      try {
        const response = await fetch(`/api/workspace/${sessionId}/file/${node.path}`)
        if (response.ok) {
          const data = await response.json()
          onFileSelect?.(node.path, data.content)
        }
      } catch (error) {
        console.error('Failed to load file:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          'w-full justify-start gap-2 h-8 px-2 text-sm font-normal',
          'hover:bg-muted/50'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.isDirectory ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        ) : (
          <File className="h-4 w-4 shrink-0 text-muted-foreground ml-4" />
        )}
        <span className="truncate">{node.name}</span>
      </Button>

      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              sessionId={sessionId}
              depth={depth + 1}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const WorkspaceFileBrowser: FC<WorkspaceFileBrowserProps> = ({
  sessionId,
  onFileSelect,
}) => {
  const [files, setFiles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadFiles = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/workspace/${sessionId}/files`)
        if (!response.ok) {
          throw new Error('Failed to load workspace files')
        }

        const data = await response.json()
        setFiles(data.files || [])
      } catch (err) {
        console.error('Failed to load workspace files:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    loadFiles()
  }, [sessionId])

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading workspace files...</div>
    )
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">Error: {error}</div>
  }

  if (files.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">No files in workspace yet.</div>
    )
  }

  const fileTree = buildFileTree(files)

  return (
    <div className="workspace-file-browser overflow-auto">
      {fileTree.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          sessionId={sessionId}
          depth={0}
          onFileSelect={onFileSelect}
        />
      ))}
    </div>
  )
}
