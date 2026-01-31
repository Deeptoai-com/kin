/**
 * Workspace Sandpack Panel
 *
 * Session-level persistent Sandpack workspace.
 * Shows file browser + Sandpack editor with live preview.
 */

import type { FC } from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useIntlayer } from 'react-intlayer'
import { toLocalizedString } from '~/lib/utils'
import { Download, Package, Upload, X } from 'lucide-react'
import { Sandpack } from '@codesandbox/sandpack-react'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { WorkspaceFileBrowser } from './workspace-file-browser'
import JSZip from 'jszip'
import { useServerFn } from '@tanstack/react-start'
import { uploadUserSkillFn } from '~/server/function/skills.server'
import { toast } from 'sonner'

export interface WorkspaceSandpackPanelProps {
  sessionId: string
  onClose: () => void
}

/**
 * Detect the appropriate Sandpack template based on files
 */
function detectTemplate(files: Record<string, string>): 'react' | 'react-ts' | 'vanilla' {
  const fileNames = Object.keys(files)

  // Check for TypeScript
  if (fileNames.some((f) => f.endsWith('.tsx') || f.endsWith('.ts'))) {
    return 'react-ts'
  }

  // Check for React/JSX
  if (fileNames.some((f) => f.endsWith('.jsx') || f.endsWith('.js'))) {
    return 'react'
  }

  return 'vanilla'
}

/**
 * Determine entry file based on template
 */
function getEntryFile(template: 'react' | 'react-ts' | 'vanilla'): string {
  switch (template) {
    case 'react-ts':
      return '/App.tsx'
    case 'react':
      return '/App.js'
    case 'vanilla':
      return '/index.html'
  }
}

type WorkspaceSkillCandidate = {
  root: string
  displayName: string
  skillName: string
}

function parseSkillName(content: string): string | null {
  const match = content.match(/^name:\s*(.+)$/m)
  if (!match) return null
  return match[1].trim().replace(/^["']|["']$/g, '')
}

export const WorkspaceSandpackPanel: FC<WorkspaceSandpackPanelProps> = ({
  sessionId,
  onClose,
}) => {
  const content = useIntlayer('claude-chat')
  const [workspaceFiles, setWorkspaceFiles] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [isSkillBusy, setIsSkillBusy] = useState(false)
  const uploadSkill = useServerFn(uploadUserSkillFn)

  const normalizedWorkspaceFiles = useMemo(() => {
    const normalized: Record<string, string> = {}
    for (const [path, content] of Object.entries(workspaceFiles)) {
      const trimmedPath = path.startsWith('/') ? path.slice(1) : path
      if (trimmedPath) {
        normalized[trimmedPath] = content
      }
    }
    return normalized
  }, [workspaceFiles])

  const workspaceSkills = useMemo(() => {
    const candidates = new Map<string, WorkspaceSkillCandidate>()
    for (const [path, content] of Object.entries(normalizedWorkspaceFiles)) {
      if (!/skill\.md$/i.test(path)) continue
      const root = path.replace(/skill\.md$/i, '').replace(/\/$/, '')
      const skillName = parseSkillName(content) || root.split('/').pop() || 'skill'
      const displayName = root ? root.split('/').pop() || root : skillName
      const key = root || skillName
      if (!candidates.has(key)) {
        candidates.set(key, {
          root,
          displayName,
          skillName,
        })
      }
    }
    return Array.from(candidates.values())
  }, [normalizedWorkspaceFiles])

  const collectSkillFiles = (root: string) => {
    const files: Array<{ path: string; content: string }> = []
    const prefix = root ? `${root.replace(/\/$/, '')}/` : ''
    for (const [path, content] of Object.entries(normalizedWorkspaceFiles)) {
      if (!prefix || path.startsWith(prefix)) {
        files.push({ path, content })
      }
    }
    return files
  }

  useEffect(() => {
    const loadWorkspaceFiles = async () => {
      setIsLoading(true)

      try {
        // Get file list
        const listResponse = await fetch(`/api/workspace/${sessionId}/files`)
        if (!listResponse.ok) {
          console.error('Failed to load workspace files')
          setIsLoading(false)
          return
        }

        const { files } = await listResponse.json()

        // Load content for each file
        const fileContents: Record<string, string> = {}
        await Promise.all(
          files.map(async (filePath: string) => {
            try {
              const contentResponse = await fetch(
                `/api/workspace/${sessionId}/file/${filePath}`
              )
              if (contentResponse.ok) {
                const { content } = await contentResponse.json()
                // Ensure file path starts with /
                const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`
                fileContents[normalizedPath] = content
              }
            } catch (error) {
              console.error(`Failed to load file ${filePath}:`, error)
            }
          })
        )

        setWorkspaceFiles(fileContents)
      } catch (error) {
        console.error('Failed to load workspace:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkspaceFiles()
  }, [sessionId])

  const handleFileSelect = (filePath: string, content: string) => {
    setSelectedFile(filePath)
    // Update workspace files if needed
    const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`
    setWorkspaceFiles((prev) => ({
      ...prev,
      [normalizedPath]: content,
    }))
  }

  const handleDownloadWorkspace = () => {
    // Create a JSON file with all workspace files
    const workspaceData = JSON.stringify(workspaceFiles, null, 2)
    const blob = new Blob([workspaceData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workspace-${sessionId.slice(0, 8)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadSkill = async (skill: WorkspaceSkillCandidate) => {
    if (isSkillBusy) return
    setIsSkillBusy(true)
    try {
      const files = collectSkillFiles(skill.root)
      if (files.length === 0) {
        toast.error(toLocalizedString(content.artifactsPanel.toast.noSkillFiles))
        return
      }
      const zip = new JSZip()
      for (const file of files) {
        zip.file(file.path, file.content)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${skill.skillName}.skill`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(toLocalizedString(content.artifactsPanel.toast.exportSuccess).replace('{name}', skill.skillName))
    } catch (error) {
      console.error('Failed to package skill:', error)
      toast.error(toLocalizedString(content.artifactsPanel.toast.exportFailed))
    } finally {
      setIsSkillBusy(false)
    }
  }

  const handleImportSkill = async (skill: WorkspaceSkillCandidate) => {
    if (isSkillBusy) return
    setIsSkillBusy(true)
    try {
      const files = collectSkillFiles(skill.root)
      if (files.length === 0) {
        toast.error(toLocalizedString(content.artifactsPanel.toast.noSkillFiles))
        return
      }
      const totalSize = files.reduce((sum, file) => sum + file.content.length, 0)
      if (files.length > 100) {
        toast.error(toLocalizedString(content.artifactsPanel.toast.tooManyFiles))
        return
      }
      if (totalSize > 10 * 1024 * 1024) {
        toast.error(toLocalizedString(content.artifactsPanel.toast.sizeLimitExceeded))
        return
      }
      await uploadSkill({
        data: {
          name: skill.skillName,
          files,
        },
      })
      toast.success(toLocalizedString(content.artifactsPanel.toast.importSuccess).replace('{name}', skill.skillName))
    } catch (error) {
      console.error('Failed to import skill:', error)
      toast.error(toLocalizedString(content.artifactsPanel.toast.importFailed))
    } finally {
      setIsSkillBusy(false)
    }
  }

  const template = detectTemplate(workspaceFiles)
  const entryFile = getEntryFile(template)
  const fileCount = Object.keys(workspaceFiles).length

  return (
    <div className="workspace-sandpack-panel h-full w-full flex flex-col border-l bg-background">
      {/* Header */}
      <div className="workspace-header flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{content.workspacePanel.title}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">{toLocalizedString(content.workspacePanel.filesCount).replace('{count}', String(fileCount))}</span>
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title={toLocalizedString(content.artifactsPanel.skillActions)}
                className="h-8 w-8"
                disabled={isLoading}
              >
                <Package className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{content.workspacePanel.workspaceSkills}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaceSkills.length === 0 ? (
                <DropdownMenuItem disabled>{content.workspacePanel.noSkillFound}</DropdownMenuItem>
              ) : (
                workspaceSkills.map((skill) => (
                  <DropdownMenuSub key={`${skill.root}-${skill.skillName}`}>
                    <DropdownMenuSubTrigger>{skill.displayName}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem
                        onSelect={() => handleDownloadSkill(skill)}
                        disabled={isSkillBusy}
                      >
                        <Download className="h-4 w-4" />
                        {content.artifactsPanel.downloadSkill}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleImportSkill(skill)}
                        disabled={isSkillBusy}
                      >
                        <Upload className="h-4 w-4" />
                        {content.artifactsPanel.importToSkills}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownloadWorkspace}
            title={toLocalizedString(content.workspacePanel.downloadWorkspace)}
            className="h-8 w-8"
          >
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title={toLocalizedString(content.artifactsPanel.close)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content: File Browser + Sandpack */}
      <div className="workspace-content flex-1 flex overflow-hidden">
        {/* File Browser Sidebar */}
        <div className="workspace-sidebar w-64 border-r overflow-auto">
          <div className="p-2">
            <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
              {content.workspacePanel.filesLabel}
            </div>
            <WorkspaceFileBrowser sessionId={sessionId} onFileSelect={handleFileSelect} />
          </div>
        </div>

        {/* Sandpack Editor + Preview */}
        <div className="workspace-editor flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {content.workspacePanel.loadingWorkspace}
            </div>
          ) : fileCount === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {content.workspacePanel.noFilesYet}
            </div>
          ) : (
            <Sandpack
              template={template}
              files={Object.fromEntries(
                Object.entries(workspaceFiles).map(([path, code]) => [
                  path,
                  { code, active: path === selectedFile || path === entryFile },
                ])
              )}
              options={{
                showNavigator: false,
                showTabs: true,
                showLineNumbers: true,
                editorHeight: '100%',
                editorWidthPercentage: 50,
              }}
              theme="auto"
            />
          )}
        </div>
      </div>
    </div>
  )
}
