const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: '.env.server' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 提供靜態檔案服務
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 記錄所有請求
app.use((req, res, next) => {
    console.log(`收到 ${req.method} 請求到 ${req.url}`);
    next();
});

// Google APIs 設定
const SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = process.env.GOOGLE_SHEET_ID; // 需要設定

// 初始化 Google Auth
const auth = new google.auth.GoogleAuth({
    keyFile: './service-account-key.json', // 需要下載服務帳戶金鑰
    scopes: SCOPES,
});

// 簽收提交 API
app.post('/api/submit', async (req, res) => {
    try {
        console.log('收到提交請求');
        const { name, student_id, signature_data_url, sign_item, consent, userEmail } = req.body;
        console.log('環境變數:', { SHEET_ID, DRIVE_FOLDER: process.env.GOOGLE_DRIVE_FOLDER_ID });

        // 驗證
        if (!userEmail) {
            return res.json({ code: "AUTH_REQUIRED", message: "請先以 Google 帳戶登入" });
        }
        if (!name || !student_id || !signature_data_url || !consent) {
            return res.json({ code: "VALIDATION_ERROR", message: "所有欄位皆為必填" });
        }
        if (!/^J\d{9}$/.test(student_id)) {
            return res.json({ code: "VALIDATION_ERROR", message: "學號格式錯誤", data: { field: "student_id" } });
        }

        // 檢查重複
        const sheets = google.sheets({ version: 'v4', auth });
        const existingData = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'A:B',
        });

        const today = new Date().toDateString();
        const duplicate = existingData.data.values?.find(row => 
            row[1] === student_id && new Date(row[0]).toDateString() === today
        );

        if (duplicate) {
            return res.json({
                code: "DUPLICATE",
                message: "此學號今日已簽收",
                data: { duplicate: true, existing: { fileId: "existing", url: "https://example.com" } }
            });
        }

        // 生成PDF
        const timestamp = new Date();
        const fileName = `${student_id}_${name}_${timestamp.getTime()}.pdf`;
        
        // 建立資料夾
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
        }
        
        // 生成HTML內容
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>線上簽收單</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .content { margin: 20px 0; }
                .signature { margin: 20px 0; }
                .signature img { max-width: 300px; border: 1px solid #ccc; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>線上簽收單</h1>
            </div>
            <div class="content">
                <p><strong>日期時間：</strong> ${timestamp.toLocaleString('zh-TW')}</p>
                <p><strong>姓名：</strong> ${name}</p>
                <p><strong>學號：</strong> ${student_id}</p>
                <p><strong>簽收項目：</strong> ${sign_item}</p>
                <p><strong>Email：</strong> ${userEmail}</p>
            </div>
            <div class="signature">
                <p><strong>簽名：</strong></p>
                <img src="${signature_data_url}" alt="簽名" />
            </div>
        </body>
        </html>
        `;
        
        // 使用Puppeteer生成PDF
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(htmlContent);
        
        const pdfPath = path.join(uploadsDir, fileName);
        await page.pdf({ 
            path: pdfPath, 
            format: 'A4',
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
        });
        
        await browser.close();
        
        // 上傳PDF到Google Drive
        const drive = google.drive({ version: 'v3', auth });
        const pdfBuffer = fs.readFileSync(pdfPath);
        
        const fileMetadata = {
            name: fileName,
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        };

        const media = {
            mimeType: 'application/pdf',
            body: require('stream').Readable.from(pdfBuffer),
        };

        const driveResponse = await drive.files.create({
            resource: fileMetadata,
            media: media,
        });

        const fileId = driveResponse.data.id;
        const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;
        
        // 刪除本地檔案
        fs.unlinkSync(pdfPath);

        // 記錄到 Google Sheets
        const dateStr = timestamp.toLocaleDateString('zh-TW');
        const timeStr = timestamp.toLocaleTimeString('zh-TW');
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: 'A:H',
            valueInputOption: 'RAW',
            resource: {
                values: [[dateStr, timeStr, name, student_id, sign_item, userEmail, fileName, fileUrl]]
            },
        });

        res.json({
            code: "OK",
            message: "簽收完成，PDF已上傳至Google Drive",
            data: {
                fileId: fileId,
                url: fileUrl,
                sheetRow: existingData.data.values?.length + 1 || 1
            }
        });

    } catch (error) {
        console.error('API Error:', error);
        res.json({
            code: "TOOL_ERROR",
            message: `儲存檔案時發生錯誤: ${error.message}`,
            data: { error_code: "DRIVE_UPLOAD_FAILED", details: error.message }
        });
    }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`伺服器運行在 http://localhost:${PORT}`);
});