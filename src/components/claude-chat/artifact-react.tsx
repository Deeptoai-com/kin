/**
 * React Artifact Renderer
 *
 * Renders React/JavaScript components using Sandpack.
 *
 * Guard: only run content in a React Sandpack when it actually looks like a
 * self-contained React component. A plain DOM script (e.g. a vanilla app.js that
 * does document.getElementById(...).addEventListener) would otherwise be mounted
 * as the React entry and crash with "Cannot read properties of null ...", which
 * surfaces as Sandpack's "Something went wrong". Such files are shown as
 * read-only code instead. Running a real multi-file app is Phase C (sandbox).
 */

import type { FC } from 'react'
import { Sandpack } from '@codesandbox/sandpack-react'
import { CodeBlock } from './code-block'

export interface ReactArtifactProps {
  content: string
  title?: string
  fileName?: string
}

function looksLikeReactComponent(code: string): boolean {
  if (!code || !code.trim()) return false
  const importsReact =
    /\bfrom\s+['"]react['"]/.test(code) || /\brequire\(\s*['"]react['"]\s*\)/.test(code)
  const hasDefaultExport = /\bexport\s+default\b/.test(code)
  const returnsJsx = /return\s*\(?\s*</.test(code)
  return importsReact || hasDefaultExport || returnsJsx
}

export const ReactArtifact: FC<ReactArtifactProps> = ({ content, fileName = 'App.jsx' }) => {
  // Determine if this is TypeScript based on file extension
  const isTypeScript = fileName?.endsWith('.tsx') || fileName?.endsWith('.ts')

  // Non-React JS/TS (vanilla DOM scripts, utility modules): show as code rather
  // than crashing the React runtime.
  if (!looksLikeReactComponent(content)) {
    return (
      <div className="artifact-react-content h-full w-full overflow-auto p-3">
        <CodeBlock
          code={content}
          language={isTypeScript ? 'typescript' : 'javascript'}
          mode="full"
          className="w-full"
        />
      </div>
    )
  }

  // Sandpack React template uses /App.js (not .jsx) as the default entry file
  // Use .js for JavaScript and .tsx for TypeScript
  const entryFile = isTypeScript ? '/App.tsx' : '/App.js'

  return (
    <div className="artifact-react-content h-full w-full">
      <Sandpack
        template={isTypeScript ? 'react-ts' : 'react'}
        files={{
          [entryFile]: {
            code: content,
            active: true,
          },
        }}
        options={{
          showNavigator: false,
          showTabs: true,
          showLineNumbers: true,
          editorHeight: '100%',
          editorWidthPercentage: 50,
        }}
        theme="auto"
      />
    </div>
  )
}
