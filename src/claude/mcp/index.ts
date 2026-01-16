/**
 * Claude MCP Module
 *
 * Exports MCP management utilities.
 */

export type { McpInfo, McpDetail, McpFile, ExtendedMcpInfo, McpConfig } from './types';

export {
  normalizeMcpName,
  getUserClaudeHome,
  getMcpStore,
  getUserEnabledMcpServers,
  enableMcpServer,
  disableMcpServer,
  resolveMcpServerConfigs,
  getMcpDetail,
} from './manager.js';

export { fileExists, parseMcpMetadata } from './metadata.js';
