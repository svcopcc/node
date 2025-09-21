# 線上簽收系統

一個基於 React + Node.js 的線上簽收系統，支援 Google 登入、手寫簽名、PDF 生成和 Google Drive 儲存。

## 功能特色

- ✅ Google OAuth 登入驗證
- ✅ 手寫簽名功能
- ✅ 表單驗證（學號格式檢查）
- ✅ PDF 簽收單生成
- ✅ Google Drive 檔案儲存
- ✅ Google Sheets 資料記錄
- ✅ 重複簽收檢查

## 安裝與設定

### 1. 安裝依賴套件
```bash
npm install
```

### 2. 環境變數設定
複製 `.env.example` 為 `.env.server` 並填入相關資訊：
```bash
cp .env.example .env.server
```

### 3. Google Cloud Console 設定
1. 建立 Google Cloud 專案
2. 啟用 Google Drive API 和 Google Sheets API
3. 建立 OAuth 2.0 憑證
4. 設定重新導向 URI：`http://localhost:3003/auth/callback`

### 4. 啟動應用程式

**前端：**
```bash
npm run dev
```

**後端：**
```bash
node oauth-server.js
```

### 5. 授權 Google Drive
前往 `http://localhost:3003/auth` 進行 Google Drive 授權

## 使用方式

1. 開啟 `http://localhost:5174/`
2. 使用 Google 帳戶登入
3. 填寫姓名、學號
4. 手寫簽名
5. 勾選同意事項
6. 提交簽收

## 技術架構

- **前端：** React + TypeScript + Vite
- **後端：** Node.js + Express
- **認證：** Google OAuth 2.0
- **儲存：** Google Drive + Google Sheets
- **PDF 生成：** Puppeteer
