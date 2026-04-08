# Issue #851 功能測試計劃

## 🧪 測試環境

### 選項 A: VSCode 擴展測試（推薦）
使用 VSCode 擴展開發模式進行測試，可以完整驗證修復功能。

### 選項 B: Web 應用測試
使用 Web 版本進行測試，部分功能可以驗證。

---

## 📋 測試案例

### 1. 加載超時機制測試

#### 測試步驟
1. 啟動 VSCode 擴展或 Web 應用
2. 發送一個需要長時間處理的消息
3. 等待 30 秒
4. 觀察是否出現超時警告 UI

#### 預期結果
- ✅ 30 秒後顯示超時警告
- ✅ 顯示 "Retry" 和 "Cancel" 按鈕
- ✅ 控制台顯示警告日誌

#### 驗證點
```typescript
// 檢查控制台日誌
[Loading Timeout] Loading timeout exceeded (30000ms) for session {sessionId}
```

---

### 2. SSE 自動重連測試

#### 測試步驟
1. 啟動應用並建立 SSE 連接
2. 觀察控制台日誌
3. 模擬網絡中斷（可以通過以下方式）：
   - 暫停後端服務
   - 斷開網絡連接
   - 使用代理工具攔截請求

#### 預期結果
- ✅ 檢測到連接失敗
- ✅ 自動重連 3 次
- ✅ 使用指數退避：1s, 2s, 4s
- ✅ 控制台顯示重連日誌

#### 驗證點
```typescript
// 檢查控制台日誌
[SSE] Connecting to /event (attempt 1/4)
[SSE] Connection failed (attempt 1/3), retrying in 1000ms
[SSE] Connecting to /event (attempt 2/4)
[SSE] Connection failed (attempt 2/3), retrying in 2000ms
[SSE] Connecting to /event (attempt 3/4)
```

---

### 3. 消息傳遞重試測試

#### 測試步驟
1. 啟動應用
2. 發送一個測試消息
3. 觀察控制台日誌
4. 模擬消息確認失敗（可通過攔截 webview.postMessage）

#### 預期結果
- ✅ 消息發送後等待確認
- ✅ 5 秒後未收到確認自動重試
- ✅ 最多重試 3 次
- ✅ 控制台顯示重試日誌

#### 驗證點
```typescript
// 檢查控制台日誌
[Message Retry] Message msg_xxx not confirmed, retrying...
[Message Retry] Message msg_xxx failed after 3 retries
```

---

## 🚀 啟動測試環境

### 方法 1: VSCode 擴展開發模式（完整測試）

```bash
# 啟動 VSCode 擴展開發模式
npm run vscode:dev

# 或直接在 VSCode 中：
# 1. 按 F5 啟動擴展開發主機
# 2. 在新窗口中測試功能
```

### 方法 2: Web 應用開發模式（部分測試）

```bash
# 啟動 Web 開發環境
npm run dev

# 訪問 http://localhost:5173
```

---

## 📊 測試檢查清單

### Loading Timeout
- [ ] 30 秒後顯示超時警告
- [ ] 顯示 Retry/Cancel 按鈕
- [ ] 控制台有警告日誌
- [ ] 點擊 Retry 重新計時
- [ ] 點擊 Cancel 清除狀態

### SSE Reconnect
- [ ] 檢測到連接失敗
- [ ] 自動重連 3 次
- [ ] 指數退延遲正確
- [ ] 控制台有詳細日誌
- [ ] 3 次失敗後放棄

### Message Retry
- [ ] 消息發送後追蹤確認
- [ ] 5 秒超時機制
- [ ] 自動重試 3 次
- [ ] 控制台有重試日誌
- [ ] 3 次失敗後停止

---

## 🔧 測試工具

### 控制台日誌檢查
在 VSCode 中：
- `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Option+I` (Mac) 打開開發者工具
- 查看 Console 標籤

### 網絡監控
在開發者工具中：
- 查看 Network 標籤
- 篩選 SSE 連接
- 觀察連接狀態

---

## 📝 測試結果記錄

### 通過標準
- ✅ 所有預期行為都正確
- ✅ 無控制台錯誤
- ✅ 日誌格式正確

### 失敗標準
- ❌ 未顯示預期 UI
- ❌ 未觸發重試機制
- ❌ 控制台有錯誤
- ❌ 日誌格式不正確

---

## 💡 建議

由於這些修復涉及：
- SSE 網絡連接
- VSCode 擴展 API
- React UI 組件

**推薦使用 VSCode 擴展開發模式進行完整測試**，可以驗證所有三個修復功能。

如果時間有限，至少應測試：
1. SSE 重連（核心功能）
2. 加載超時（用戶體驗）
