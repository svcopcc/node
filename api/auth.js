module.exports = function handler(req, res) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    if (!clientId) {
        return res.status(500).send('環境變數未設定');
    }
    
    const redirectUri = 'https://online-signature-system.vercel.app/api/auth/callback';
    const scopes = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';
    
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' +
        'client_id=' + encodeURIComponent(clientId) + '&' +
        'redirect_uri=' + encodeURIComponent(redirectUri) + '&' +
        'scope=' + encodeURIComponent(scopes) + '&' +
        'response_type=code&' +
        'access_type=offline&' +
        'prompt=consent';
    
    res.redirect(url);
}