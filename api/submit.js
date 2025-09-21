const { google } = require('googleapis');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

module.exports = async function handler(req, res) {
    // 設定CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, student_id, signature_data_url, sign_item, consent, userEmail } = req.body;

        // 驗證
        if (!userEmail) {
            return res.json({ code: "AUTH_REQUIRED", message: "請先以 Google 帳戶登入" });
        }
        if (!name || !student_id || !signature_data_url || !consent) {
            return res.json({ code: "VALIDATION_ERROR", message: "所有欄位皆為必填" });
        }
        if (!/^J\d{9}$/.test(student_id)) {
            return res.json({ code: "VALIDATION_ERROR", message: "學號格式錯誤" });
        }

        // OAuth設定
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/auth/callback` : 'http://localhost:3003/auth/callback'
        );

        // 檢查tokens
        const tokens = JSON.parse(process.env.GOOGLE_TOKENS || '{}');
        if (!tokens.access_token) {
            return res.json({
                code: "AUTH_REQUIRED",
                message: "需要Google Drive授權",
                data: { auth_url: "/api/auth" }
            });
        }

        oauth2Client.setCredentials(tokens);

        // 檢查重複
        const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
        const existingData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'A:D',
        });

        const today = new Date().toDateString();
        const duplicate = existingData.data.values?.find(row => 
            row[3] === student_id && new Date(row[0]).toDateString() === today
        );

        if (duplicate) {
            return res.json({
                code: "DUPLICATE",
                message: "此學號今日已簽收"
            });
        }

        // 生成PDF
        const timestamp = new Date();
        const fileName = `${student_id}_${name}_${timestamp.getTime()}.pdf`;
        
        const browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: 'new',
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        
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
        
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ 
            format: 'A4',
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
            printBackground: true
        });
        
        await browser.close();

        // 上傳PDF到Google Drive
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
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

        // 記錄到 Google Sheets
        const dateStr = timestamp.toLocaleDateString('zh-TW');
        const timeStr = timestamp.toLocaleTimeString('zh-TW');
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
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
                url: fileUrl
            }
        });

    } catch (error) {
        console.error('API Error:', error);
        res.json({
            code: "TOOL_ERROR",
            message: `儲存檔案時發生錯誤: ${error.message}`,
            data: { error_code: "DRIVE_UPLOAD_FAILED" }
        });
    }
}