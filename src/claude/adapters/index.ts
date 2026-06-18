/**
 * Claude Adapters Module
 *
 * Exports adapters for integrating Claude Agent with UI frameworks.
 */

export {
  runChat,
  cancelActiveRun,
  // BUG-010 暂停后续跑/重发: re-run a paused/failed turn from its original prompt.
  regenerateAssistantMessage,
  // Concurrent sessions (P2): detach the local run without killing the backend
  // worker (session switch / new chat); unsubscribe a left-behind session's stream.
  detachActiveRun,
  unsubscribeSession,
  startPreview,
  stopPreview,
  sharePreview,
  respondApproval,
  abort,
  resumeSession,
  createSession,
  initSession,
  newSession,
  disconnect,
  getSessionId,
  setSessionId,
  clearSession,
  checkIsQueryRunning,
  notifyUserAbort,
  onSessionInit,
} from './ws-adapter';
