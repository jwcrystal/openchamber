# Issue #851: Chat Loading Timeout 修復方案

## 問題
Chat 一直顯示 loading，不顯示 AI 回應，需要重啟 VSCode。

## 根本原因
1. **SSE 事件丟失**：背景頁面/webview 錯過最終事件
2. **無 timeout 機制**：loading 狀態永久卡住
3. **狀態同步失效**：UI 不知道串流已完成

## 快速修復 (2-4 小時)

### 修復 1: Loading Timeout + 用戶提示

**檔案**: `packages/ui/src/hooks/useAssistantStatus.ts`

```typescript
// 新增 timeout 機制
const LOADING_TIMEOUT = 30000; // 30 秒

export function useAssistantStatus(sessionID: string) {
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const streamingState = useStreamingStore(selectMessageStreamState);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (status === 'streaming' || status === 'busy') {
      // 設定 30 秒 timeout
      timeoutId = setTimeout(() => {
        setLoadingTooLong(true);
      }, LOADING_TIMEOUT);
    } else {
      setLoadingTooLong(false);
    }

    return () => clearTimeout(timeoutId);
  }, [status, streamingState]);

  // 顯示警告訊息
  if (loadingTooLong) {
    return (
      <WarningBanner>
        回應時間較長。可以嘗試：
        <button onClick={handleRetry}>重新載入</button>
        <button onClick={handleCancel}>取消請求</button>
      </WarningBanner>
    );
  }
}
```

### 修復 2: SSE Reconnect 機制

**檔案**: `packages/vscode/src/sseProxy.ts`

```typescript
// 在 openSseProxy 函數中加入重連邏輯
export const openSseProxy = async ({
  manager,
  path,
  headers,
  signal,
  onChunk,
}: OpenSseProxyOptions): Promise<OpenSseProxyResult> => {
  const client = await createAuthedClient(manager, headers);
  const { pathname, directory } = normalizeSsePath(path);
  const resolvedDirectory = directory || resolveDefaultDirectory(manager);

  let reconnectAttempts = 0;
  const MAX_RECONNECTS = 3;
  const RECONNECT_DELAY = 1000; // 1 秒

  const connect = async (): Promise<{ stream: AsyncIterable<unknown> }> => {
    try {
      if (pathname === '/global/event') {
        try {
          return await client.global.event(getSseOptions(signal, onChunk));
        } catch (error) {
          if ((error as Error)?.name === 'AbortError' || signal.aborted) {
            throw error;
          }
          // 回退到 directory event
          return client.event.subscribe(
            { directory: resolvedDirectory },
            getSseOptions(signal, onChunk, resolvedDirectory),
          );
        }
      }

      return client.event.subscribe(
        { directory: resolvedDirectory },
        getSseOptions(signal, onChunk),
      );
    } catch (error) {
      // 自動重連邏輯
      if (reconnectAttempts < MAX_RECONNECTS && !signal.aborted) {
        reconnectAttempts++;
        console.warn(`SSE connection failed, retrying (${reconnectAttempts}/${MAX_RECONNECTS})...`);

        await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY * reconnectAttempts));
        return connect();
      }
      throw error;
    }
  };

  const result = await connect();
  // ... 其餘程式碼
};
```

### 修復 3: Webview 訊息確認機制

**檔案**: `packages/vscode/src/ChatViewProvider.ts`

```typescript
// 在 ChatViewProvider 中加入訊息確認
private readonly _pendingMessages = new Set<string>();

private async sendMessageWithRetry(message: BridgeResponse, maxRetries = 3): Promise<boolean> {
  const messageId = Math.random().toString(36).substring(7);
  this._pendingMessages.add(messageId);

  for (let i = 0; i < maxRetries; i++) {
    try {
      this._view?.webview.postMessage({
        ...message,
        _id: messageId,
      });

      // 等待確認 (簡單版本)
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!this._pendingMessages.has(messageId)) {
        return true; // 確認收到
      }
    } catch (error) {
      console.warn(`Failed to send message (attempt ${i + 1}/${maxRetries})`, error);
      await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
    }
  }

  this._pendingMessages.delete(messageId);
  return false; // 發送失敗
}

// 在 webview onDidReceiveMessage 中加入確認處理
webviewView.webview.onDidReceiveMessage(async (message: BridgeRequest & { _id?: string }) => {
  if (message._id) {
    this._pendingMessages.delete(message._id);
  }

  // ... 現有處理邏輯
});
```

---

## 中期修復 (1-2 週)

### 修復 4: 狀態同步檢查機制

**檔案**: `packages/ui/src/sync/streaming.ts`

```typescript
// 定期檢查並修正卡住的 streaming 狀態
const STUCK_TIMEOUT = 60000; // 60 秒無更新視為卡住

export function cleanupStuckStreamingStates() {
  const now = Date.now();
  const { streamingMessageIds, messageStreamStates } = useStreamingStore.getState();
  const nextStreamStates = new Map(messageStreamStates);
  let changed = false;

  for (const [sessionID, messageID] of streamingMessageIds) {
    if (!messageID) continue;

    const state = messageStreamStates.get(messageID);
    if (state && state.phase === 'streaming') {
      const timeSinceUpdate = now - state.lastUpdateAt;

      if (timeSinceUpdate > STUCK_TIMEOUT) {
        console.warn(`Message ${messageID} stuck streaming for ${timeSinceUpdate}ms, forcing completion`);

        nextStreamStates.set(messageID, {
          ...state,
          phase: 'completed',
          completedAt: now,
        });
        changed = true;
      }
    }
  }

  if (changed) {
    useStreamingStore.setState({
      streamingMessageIds: new Map(streamingMessageIds),
      messageStreamStates: nextStreamStates,
    });
  }
}

// 在 sync-context 中定期執行
setInterval(cleanupStuckStreamingStates, 10000); // 每 10 秒檢查一次
```

### 修復 5: 偵測並恢復 SSE 中斷

**檔案**: 新增 `packages/ui/src/sync/sse-health-monitor.ts`

```typescript
/**
 * SSE 連線健康監控
 */
export class SSEHealthMonitor {
  private lastEventTime = Date.now();
  private reconnectScheduled = false;

  onEvent() {
    this.lastEventTime = Date.now();
    this.reconnectScheduled = false;
  }

  checkHealth() {
    const timeSinceLastEvent = Date.now() - this.lastEventTime;

    // 超過 20 秒沒有新事件，且當前有 streaming，觸發重連
    if (timeSinceLastEvent > 20000 && this.isStreaming()) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectScheduled) return;

    this.reconnectScheduled = true;
    console.warn('SSE connection appears stale, scheduling reconnect...');

    setTimeout(() => {
      // 觸發 SSE 重新連線
      window.location.reload(); // 簡單版本：重新載入頁面
    }, 3000);
  }

  private isStreaming(): boolean {
    const { streamingMessageIds } = useStreamingStore.getState();
    return Array.from(streamingMessageIds.values()).some(id => id !== null);
  }
}

export const sseHealthMonitor = new SSEHealthMonitor();
```

---

## 長期修復 (2-4 週)

### 修復 6: 完整的錯誤邊界和恢復機制

1. **Error Boundary**：捕獲渲染錯誤
2. **狀態快照**：定期保存 UI 狀態
3. **自動恢復**：偵測到異常時自動重置狀態
4. **日誌記錄**：記錄所有 SSE 事件和錯誤

---

## 測試計劃

### 單元測試
- [ ] Timeout 機制觸發
- [ ] SSE 重連邏輯
- [ ] 訊息重試機制

### 整合測試
- [ ] 模擬 SSE 中斷
- [ ] 模擬背景頁面事件丟失
- [ ] VSCode webview 通訊失敗場景

### 手動測試
- [ ] 驗證 #851 不再發生
- [ ] 測試重連功能
- [ ] 驗證錯誤提示訊息

---

## 部署策略

1. **Phase 1** (本週)：部署修復 1-3 (timeout + reconnect + retry)
2. **Phase 2** (下週)：部署修復 4-5 (狀態檢查 + 健康監控)
3. **Phase 3** (之後)：部署修復 6 (完整錯誤處理)

---

## 相關 Issues
- #851: chat just keep loading (本修復)
- #817: SSE reconnect (已修復，可參考)
- #840: /compact stuck (可能類似根因)
