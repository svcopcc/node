const { google } = require('googleapis');

export default async function handler(req, res) {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `https://${req.headers.host}/api/auth/callback`
        );

        const scopes = [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/spreadsheets'
        ];
        
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });
        
        res.redirect(url);
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).send('授權失敗: ' + error.message);
    }
}