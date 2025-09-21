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


## 限制只有指定域名的Gmail帳號才能登入使用系統。請將"/api/submit.js"中的 allowedDomains 陣列中的域名改為您的組織域名，例如：

['@yourschool.edu.tw'] - 學校

['@yourcompany.com'] - 公司

['@gmail.com'] - 允許所有Gmail（移除限制）

submit.js 是全部簽收項目頁面通用的。

所有簽收頁面（停車證、學生證等）都使用同一個 /api/submit 端點，透過前端傳送的 sign_item 參數來區分不同的簽收項目：

停車證頁面 (index.tsx)：傳送 sign_item: '停車證'

學生證頁面 (stc.tsx)：傳送 sign_item: '學生證'

## 重複驗證

重複驗證只比對三個項目：

日期（不含時間）

學號

簽收項目

如果這三個都相同，就會拒絕重複簽收。

## 修改 簽收項目
簽收項目的程式碼設定在兩個地方：

1. 前端顯示 (index.tsx)：
<div className="card">
    <label htmlFor="signItem">簽收項目</label>
    <input 
        id="signItem" 
        type="text" 
        value="停車證"
        readOnly
        style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
    />
</div>

2. 後端提交 (index.tsx)：
const requestPayload = {
    name,
    student_id: studentId,
    signature_data_url: signatureDataUrl,
    sign_item: '停車證',
    consent,
    userEmail,
};

目前簽收項目固定為 "停車證"。如果要修改，需要同時更改這兩個地方的值。