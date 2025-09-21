const https = require('https');
const querystring = require('querystring');

module.exports = async function handler(req, res) {
    const { code } = req.query;
    
    if (!code) {
        return res.status(400).send('授權碼遺失');
    }

    try {
        const postData = querystring.stringify({
            code: code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: `https://${req.headers.host}/api/auth/callback`,
            grant_type: 'authorization_code'
        });
        
        const options = {
            hostname: 'oauth2.googleapis.com',
            port: 443,
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const tokenRequest = new Promise((resolve, reject) => {
            const req = https.request(options, (response) => {
                let data = '';
                response.on('data', (chunk) => {
                    data += chunk;
                });
                response.on('end', () => {
                    try {
                        const tokens = JSON.parse(data);
                        if (tokens.error) {
                            reject(new Error(tokens.error_description));
                        } else {
                            resolve(tokens);
                        }
                    } catch (parseError) {
                        reject(parseError);
                    }
                });
            });
            
            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        const tokens = await tokenRequest;
        
        res.send(`
            <h2>授權成功！</h2>
            <p>請將以下tokens複製到Vercel環境變數 GOOGLE_TOKENS 中：</p>
            <textarea style="width:100%;height:200px;">${JSON.stringify(tokens, null, 2)}</textarea>
            <p>設定完成後即可使用簽收系統。</p>
        `);

    } catch (error) {
        console.error('授權錯誤:', error);
        res.status(500).send('授權失敗: ' + error.message);
    }
}