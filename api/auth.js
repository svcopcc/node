export default async function handler(req, res) {
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = `https://${req.headers.host}/api/auth/callback`;
        
        const scopes = [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/spreadsheets'
        ].join(' ');
        
        const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `scope=${encodeURIComponent(scopes)}&` +
            `response_type=code&` +
            `access_type=offline&` +
            `prompt=consent`;
        
        res.redirect(url);
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).send('授權失敗: ' + error.message);
    }
}