export type McpCategory =
  | 'general'
  | 'development'
  | 'integration'
  | 'data';

export type McpConfig = {
  type: 'sdk' | 'stdio' | 'sse' | 'http';
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
};

export type McpInfo = {
  slug: string;
  name: string;
  description: string | null;
  category: McpCategory | string;
  defaultEnabled?: boolean;
  mcp: McpConfig | null;
};

export type ExtendedMcpInfo = McpInfo & {
  store: 'official' | 'user';
  enabled: boolean;
};

export type McpFile = {
  path: string;
  name: string;
  type: 'file' | 'dir';
  content?: string;
  size?: number;
  isBinary?: boolean;
  isTooLarge?: boolean;
  children?: McpFile[];
};

export type McpDetail = {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  files: McpFile[];
};
