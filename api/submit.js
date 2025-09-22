const { google } = require('googleapis');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
        
        // 限制特定組織email
        const allowedDomains = ['@nkust.edu.tw']; // 更改為您的組織域名
        const isAllowedDomain = allowedDomains.some(domain => userEmail.endsWith(domain));
        if (!isAllowedDomain) {
            return res.json({ code: "AUTH_REQUIRED", message: "只允許特定組織的Gmail帳號使用" });
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

        // 檢查重複（日期+學號+簽收項目）
        const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
        const existingData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'A:H',
        });

        const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
        
        const duplicate = existingData.data.values?.find(row => {
            return row && row.length >= 5 && 
                   row[0] === today && 
                   row[3] === student_id && 
                   row[4] === sign_item;
        });

        if (duplicate) {
            return res.json({
                code: "DUPLICATE",
                message: `此學號今日已簽收「${sign_item}」`
            });
        }

        // 使用PDFKit + 中文字體生成PDF
        const timestamp = new Date();
        const fileName = `${student_id}_${name}_${timestamp.getTime()}.pdf`;
        
        // 讀取中文字體
        const fontPath = path.join(process.cwd(), 'Typeface', 'NotoSansTC-Regular.ttf');
        
        const doc = new PDFDocument();
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        
        // 設定中文字體
        doc.registerFont('NotoSans', fontPath);
        doc.font('NotoSans');
        
        // 標題
        doc.fontSize(20)
           .text('線上簽收單', 50, 50, { align: 'center' });
        
        // 內容
        doc.fontSize(12);
        let yPos = 120;
        
        doc.text(`日期時間: ${timestamp.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`, 50, yPos);
        yPos += 30;
        
        doc.text(`姓名: ${name}`, 50, yPos);
        yPos += 30;
        
        doc.text(`學號: ${student_id}`, 50, yPos);
        yPos += 30;
        
        doc.text(`簽收項目: ${sign_item}`, 50, yPos);
        yPos += 30;
        
        doc.text(`Email: ${userEmail}`, 50, yPos);
        yPos += 50;
        
        doc.text('簽名:', 50, yPos);
        yPos += 30;
        
        doc.text('我已確認已簽收本次簽收項目', 50, yPos);
        yPos += 30;
        
        // 加入簽名圖片
        if (signature_data_url) {
            try {
                const base64Data = signature_data_url.replace(/^data:image\/\w+;base64,/, '');
                const imgBuffer = Buffer.from(base64Data, 'base64');
                
                // 設定簽名區域更大尺寸
                const maxWidth = 450;
                const maxHeight = 200;
                
                // 放置簽名圖片
                doc.image(imgBuffer, 50, yPos, { 
                    width: maxWidth,
                    height: maxHeight,
                    fit: [maxWidth, maxHeight]
                });
                
                // 簽名欄位外框（固定尺寸）
                doc.rect(50, yPos, maxWidth, maxHeight)
                   .stroke();
                   
            } catch (imgError) {
                console.error('簽名圖片加載錯誤:', imgError);
                // 如果圖片加載失敗，只顯示外框
                doc.rect(50, yPos, 450, 200).stroke();
            }
        } else {
            // 沒有簽名時的預設外框
            doc.rect(50, yPos, 450, 200).stroke();
        }
        
        doc.end();
        
        const pdfBuffer = await new Promise(resolve => {
            doc.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        });
        
        // 計算PDF雜湊值
        const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
        console.log('PDF SHA-256 Hash:', pdfHash);

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
        
        // 寄送PDF至簽收者信箱
        try {
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            
            const boundary = '----boundary_' + Date.now();
            const emailSubject = `=?UTF-8?B?${Buffer.from(`線上簽收單 - ${sign_item}`).toString('base64')}?=`;
            
            const emailBody = `您好 ${name}，

您的線上簽收已完成，詳細資訊如下：

簽收項目：${sign_item}
學號：${student_id}
簽收時間：${timestamp.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
PDF雜湊值：${pdfHash}

PDF簽收單已附加於本信件中。

謝謝您的使用！

---
線上簽收系統`;
            
            const emailMessage = [
                `To: ${userEmail}`,
                `Subject: ${emailSubject}`,
                'MIME-Version: 1.0',
                `Content-Type: multipart/mixed; boundary="${boundary}"`,
                '',
                `--${boundary}`,
                'Content-Type: text/plain; charset=UTF-8',
                'Content-Transfer-Encoding: base64',
                '',
                Buffer.from(emailBody).toString('base64'),
                '',
                `--${boundary}`,
                'Content-Type: application/pdf',
                `Content-Disposition: attachment; filename="${fileName}"`,
                'Content-Transfer-Encoding: base64',
                '',
                pdfBuffer.toString('base64'),
                '',
                `--${boundary}--`
            ].join('\r\n');
            
            const encodedMessage = Buffer.from(emailMessage)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
            
            await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage
                }
            });
            
        } catch (emailError) {
            console.error('寄送信件錯誤:', emailError);
            // 信件寄送失敗不影響主流程
        }

        // 記錄到 Google Sheets
        const dateStr = timestamp.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
        const timeStr = timestamp.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' });
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'A:I',
            valueInputOption: 'RAW',
            resource: {
                values: [[dateStr, timeStr, name, student_id, sign_item, userEmail, fileName, fileUrl, pdfHash]]
            },
        });

        res.json({
            code: "OK",
            message: "簽收完成，PDF已上傳並寄送至您的信箱",
            data: {
                fileId: fileId,
                url: fileUrl,
                hash: pdfHash
            }
        });

    } catch (error) {
        console.error('API Error:', error);
        console.error('Error stack:', error.stack);
        res.json({
            code: "TOOL_ERROR",
            message: `儲存檔案時發生錯誤: ${error.message || error.toString()}`,
            data: { 
                error_code: "DRIVE_UPLOAD_FAILED", 
                details: error.message || error.toString(),
                stack: error.stack
            }
        });
    }
}