## Summary
- Implement 30-second loading timeout with retry/cancel buttons to prevent infinite loading state in VSCode extension
- Add SSE auto-reconnect with up to 3 attempts using exponential backoff (1s, 2s, 4s delays)
- Add message delivery confirmation with 5-second timeout and automatic retry up to 3 times
- Ensure critical messages reach webview even on transient connection failures

## Root Cause
When SSE connections were interrupted or webview messages failed to deliver, the chat UI would get stuck in a permanent loading state with no recovery mechanism. Users had to restart VSCode to see new messages.

## Implementation Details
### Loading Timeout
- Tracks working time in `useAssistantStatus` hook
- Displays warning after 30 seconds with retry/cancel options
- Prevents permanent loading state
- Console logging for debugging

### SSE Reconnect
- Automatic reconnection on connection failures (up to 3 attempts)
- Exponential backoff strategy: 1s, 2s, 4s
- Handles socket errors (UND_ERR_SOCKET, ECONNRESET)
- Detailed console logging for debugging
- Preserves connection state across retries

### Message Retry
- Ensures critical messages reach webview
- 5-second timeout for message confirmation
- Automatic retry up to 3 times
- Tracks pending messages and timeouts
- Graceful degradation on permanent failures

## Validation
- ✅ TypeScript lint passes (npm run lint)
- ✅ Code review completed
- ⬜ Manual testing required (build issues exist in main branch, unrelated to this fix)
- ⬜ Unit tests to be added

## Files Changed
- `packages/ui/src/hooks/useAssistantStatus.ts`: +63 lines
- `packages/vscode/src/sseProxy.ts`: +78 lines
- `packages/vscode/src/ChatViewProvider.ts`: +87 lines

Total: +245 insertions, -23 deletions

## Related Issues
- Fixes #851
- Related to #817 (SSE reconnect fix)
