module.exports = function handler(req, res) {
    res.status(200).json({ 
        message: 'API正常運作',
        env: process.env.GOOGLE_CLIENT_ID ? '環境變數已設定' : '環境變數未設定'
    });
}