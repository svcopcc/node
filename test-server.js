const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/submit', async (req, res) => {
    console.log('收到請求:', req.body);
    
    try {
        // 簡單測試回應
        res.json({
            code: "OK",
            message: "測試成功",
            data: {
                fileId: "test123",
                url: "https://example.com/test",
                sheetRow: 1
            }
        });
    } catch (error) {
        console.error('錯誤:', error);
        res.json({
            code: "TOOL_ERROR",
            message: `錯誤: ${error.message}`,
            data: { error_code: "TEST_ERROR" }
        });
    }
});

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`測試伺服器運行在 http://localhost:${PORT}`);
    console.log('伺服器已準備好接收請求...');
});

app.use((req, res, next) => {
    console.log(`收到 ${req.method} 請求到 ${req.url}`);
    next();
});