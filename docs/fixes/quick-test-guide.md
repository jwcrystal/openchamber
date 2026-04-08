# Issue #851 快速功能測試指南

## 🚀 啟動測試環境

### 步驟 1: 在 VSCode 中打開項目
```bash
# 在 VSCode 中打開 vscode 擴展目錄
code packages/vscode
```

### 步驟 2: 按 F5 啟動擴展開發主機
- 確保你當前在 `packages/vscode` 目錄
- 按 **F5** 鍵
- 選擇 "Run Extension" 配置
- 等待新 VSCode 窗口打開（這是擴展開發主機）

### 步驟 3: 打開開發者工具
在新窗口中：
- Windows/Linux: `Ctrl+Shift+I`
- macOS: `Cmd+Option+I`
- 切換到 **Console** 標籤

---

## 🧪 測試案例

### 測試 1: 加載超時機制（30 秒）

**操作**：
1. 在擴展開發主機中，打開 OpenChamber 側邊欄
2. 發送一個測試消息（例如："hello"）
3. 切換到 Console 標籤，觀察日誌
4. 等待 30 秒

**預期結果**：
```
[Loading Timeout] Loading timeout exceeded (30000ms) for session xxx
```

**UI 檢查**：
- 應該顯示超時警告
- 應該有 "Retry" 和 "Cancel" 按鈕

---

### 測試 2: SSE 重新連接（可選，需要操作後端）

**操作**：
1. 啟動 OpenChamber 後端服務
2. 在 Console 中觀察 SSE 連接日誌
3. 暫停後端服務（模擬網絡中斷）
4. 觀察重連日誌

**預期結果**：
```
[SSE] Connecting to /event (attempt 1/4)
[SSE] Connection failed (attempt 1/3), retrying in 1000ms
[SSE] Connecting to /event (attempt 2/4)
```

---

### 測試 3: 消息重試（自動進行）

**操作**：
1. 打開 Console
2. 發送任何消息
3. 觀察是否有重試日誌

**預期結果**：
- 正常情況下不會看到重試日誌
- 只有消息傳遞失敗時才會看到：
```
[Message Retry] Message msg_xxx not confirmed, retrying...
```

---

## 📊 測試結果記錄

### 通過標準 ✅
- [ ] 看到超時日誌
- [ ] 看到 UI 警告
- [ ] 重試按鈕可用

### 失敗標準 ❌
- [ ] 無任何日誌輸出
- [ ] UI 無響應
- [ ] 控制台有錯誤

---

## 🔍 日誌關鍵字搜索

在 Console 中按 `Cmd+F` (Mac) 或 `Ctrl+F` (Windows) 搜索：
- `Loading Timeout` - 檢查超時機制
- `SSE` - 檢查連接狀態
- `Message Retry` - 檢查消息重試

---

## 🛑 停止測試

1. 關閉擴展開發主機窗口
2. 回到原 VSCode 窗口
3. 按 `Shift+F5` 停止調試

---

## 💡 提示

- **第一次啟動可能較慢**：需要編譯擴展
- **日誌很重要**：所有修復都會輸出日誌
- **不需要真的連接 API**：超時機制即使沒有 API 也會觸發

---

## 📝 測試完成後

如果測試通過，可以提交 PR：
```bash
git add .
git commit -m "test: verified loading timeout, SSE reconnect, and message retry"
git push
```

如果測試失敗，記錄錯誤信息並報告。
