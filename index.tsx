// import { GoogleGenAI, Type } from "@google/genai"; // 不再需要
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';

// Add this line to inform TypeScript about the global 'google' object from the GSI script
declare const google: any;

const App = () => {
    // State management
    const [name, setName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [consent, setConsent] = useState(false);
    const [signatureDataUrl, setSignatureDataUrl] = useState('');
    const [isSignatureConfirmed, setIsSignatureConfirmed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [responseLog, setResponseLog] = useState<object | null>(null);
    const [validationError, setValidationError] = useState('');
    const [studentIdError, setStudentIdError] = useState('');
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Canvas refs and state
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number, y: number } | null>(null);

    // --- 不再需要 AI 設定 ---
    
    // --- Canvas Logic ---
    const getPos = (e: MouseEvent | TouchEvent): { x: number, y: number } | null => {
        if (!canvasRef.current) return null;
        const rect = canvasRef.current.getBoundingClientRect();
        const touch = 'touches' in e ? e.touches[0] : e;
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    };

    const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
        isDrawing.current = true;
        lastPos.current = getPos(e);
    }, []);

    const draw = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDrawing.current || !canvasRef.current || !lastPos.current) return;
        
        e.preventDefault(); // Prevent scrolling on touch devices
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const currentPos = getPos(e);

        if (ctx && currentPos) {
            ctx.beginPath();
            ctx.moveTo(lastPos.current.x, lastPos.current.y);
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.stroke();
            lastPos.current = currentPos;
        }
    }, []);

    const stopDrawing = useCallback(() => {
        isDrawing.current = false;
        lastPos.current = null;
    }, []);
    
    const clearCanvas = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setSignatureDataUrl('');
        setIsSignatureConfirmed(false);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#333';
        }

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        window.addEventListener('touchend', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            window.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            window.removeEventListener('touchend', stopDrawing);
        };
    }, [startDrawing, draw, stopDrawing]);
    
    // --- Google Sign-In Logic ---
    const decodeJwt = (token: string) => {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            console.error("Error decoding JWT:", e);
            return null;
        }
    };
    
    const handleGoogleSignIn = useCallback((response: any) => {
        if (!response.credential) {
            console.error("Google Sign-In failed: No credential returned.");
            return;
        }
        const userObject = decodeJwt(response.credential);
        if (userObject) {
            setUserEmail(userObject.email);
            setName(userObject.name || ''); // Pre-fill name from Google profile
        } else {
            console.error("Failed to decode JWT.");
            alert('登入失敗，無法解析您的資訊。');
        }
    }, []);

    useEffect(() => {
        if (userEmail || typeof google === 'undefined') {
            return;
        }

        google.accounts.id.initialize({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            callback: handleGoogleSignIn,
        });

        const signInButtonContainer = document.getElementById('google-signin-button');
        if (signInButtonContainer) {
            google.accounts.id.renderButton(
                signInButtonContainer,
                { theme: "outline", size: "large", type: "standard", text: "signin_with" }
            );
        }

        google.accounts.id.prompt(); // One-tap login prompt
    }, [userEmail, handleGoogleSignIn]);

    const handleLogout = () => {
        if (typeof google !== 'undefined') {
            google.accounts.id.disableAutoSelect();
        }
        setUserEmail(null);
        // Clear all form fields on logout for privacy and to start fresh
        setName('');
        setStudentId('');
        setStudentIdError('');
        setConsent(false);
        clearCanvas();
        setResponseLog(null);
        setValidationError('');
    };


    // --- UI Handlers ---
    const handleConfirmSignature = () => {
        if (!canvasRef.current) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if(ctx) {
            const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
            if (!pixelBuffer.some(color => color !== 0)) {
                alert('簽名為空，請先簽名。');
                return;
            }
        }
        
        const base64Length = dataUrl.length - 'data:image/png;base64,'.length;
        const byteSize = base64Length * (3 / 4) - (dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0);

        if (byteSize < 10000) { // 10KB
            alert('簽名太小或過於簡單，請重新簽名。');
            return;
        }
        if (byteSize > 5000000) { // 5MB
            alert('簽名檔案過大 (超過 5MB)，請清除後重試。');
            return;
        }
        
        setSignatureDataUrl(dataUrl);
        setIsSignatureConfirmed(true);
    };
    
    const handleEditSignature = () => {
        setIsSignatureConfirmed(false);
    };
    
    const validateStudentId = (id: string) => {
        if (id && !/^J\d{9}$/.test(id)) {
            setStudentIdError('學號格式需為 J + 9 碼數字');
        } else {
            setStudentIdError('');
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError('');
        setResponseLog(null);

        if (!userEmail) {
            setValidationError('請先登入 Google 帳號以提交。');
            return;
        }
        if (!name || !studentId || !isSignatureConfirmed || !consent) {
            setValidationError('所有欄位皆為必填，且需確認簽名與同意事項。');
            return;
        }
        if (studentIdError) {
             setValidationError('請修正錯誤的學號格式。');
             return;
        }

        setIsLoading(true);

        // 不再需要 systemInstruction

        const requestPayload = {
            name,
            student_id: studentId,
            signature_data_url: signatureDataUrl,
            sign_item: '停車證',
            consent,
            userEmail,
        };

        try {
            console.log('正在呼叫後端 API:', '/api/submit');
            console.log('請求資料:', requestPayload);
            
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestPayload)
            });
            
            console.log('後端回應:', response);

            const jsonResponse = await response.json();
            setResponseLog(jsonResponse);

            switch (jsonResponse.code) {
                case 'OK':
                    alert(`成功: ${jsonResponse.message}\n檔案連結: ${jsonResponse.data.url}`);
                    break;
                case 'DUPLICATE':
                    alert(`提醒: ${jsonResponse.message}`);
                    if (window.confirm('您今日已簽收過，要開啟已存在的簽收單嗎？')) {
                        window.open(jsonResponse.data.existing.url, '_blank');
                    }
                    break;
                case 'VALIDATION_ERROR':
                case 'AUTH_REQUIRED':
                case 'TOOL_ERROR':
                case 'TOO_MANY_REQUESTS':
                     alert(`錯誤: ${jsonResponse.message}`);
                    break;
                default:
                     alert(`收到未知的回應: ${jsonResponse.message}`);
            }

        } catch (error) {
            console.error("API Error:", error);
            const errorMessage = "與後端 API 連線時發生錯誤。";
            setResponseLog({ error: errorMessage, details: String(error) });
            alert(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <main>
            <h1>線上簽收系統</h1>

            <div className="card auth-card">
                {userEmail ? (
                    <div className="auth-info">
                        <span>登入身分: <strong>{userEmail}</strong></span>
                        <button type="button" className="secondary" onClick={handleLogout}>登出</button>
                    </div>
                ) : (
                    <div className="auth-info">
                        <span>請先登入後再提交</span>
                        <div id="google-signin-button"></div>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} noValidate>
                <fieldset disabled={!userEmail}>
                    <div className="card">
                        <label htmlFor="name">姓名</label>
                        <input 
                            id="name" 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={50}
                            required
                            aria-required="true"
                        />
                        
                        <br/><br/>
                        
                        <label htmlFor="studentId">學號 (J+9碼數字)</label>
                        <input 
                            id="studentId" 
                            type="text" 
                            value={studentId}
                            onChange={(e) => {
                                const upperCaseId = e.target.value.toUpperCase();
                                setStudentId(upperCaseId);
                                validateStudentId(upperCaseId);
                            }}
                            pattern="^J\d{9}$"
                            required
                            aria-required="true"
                            aria-invalid={!!studentIdError}
                            aria-describedby="sid-error"
                        />
                         {studentIdError && <p id="sid-error" className="error-message">{studentIdError}</p>}
                    </div>

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

                    <div className="card">
                        <label htmlFor="signature-pad">簽名</label>
                        <div className={isSignatureConfirmed ? 'hidden' : ''}>
                            <canvas id="signature-pad" ref={canvasRef} aria-label="簽名區域"></canvas>
                            <div className="button-group">
                                <button type="button" className="secondary" onClick={clearCanvas}>清除</button>
                                <button type="button" className="primary" onClick={handleConfirmSignature}>確認簽名</button>
                            </div>
                        </div>
                        <div className={!isSignatureConfirmed ? 'hidden' : ''}>
                            <img 
                                id="signature-preview" 
                                src={signatureDataUrl} 
                                alt="您的簽名預覽" 
                                style={{ display: isSignatureConfirmed ? 'block' : 'none' }}
                            />
                             <div className="button-group">
                                <button type="button" className="secondary" onClick={handleEditSignature}>修改簽名</button>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                         <label className="consent-label">
                            <input 
                                id="consent"
                                type="checkbox" 
                                checked={consent}
                                onChange={(e) => setConsent(e.target.checked)}
                                required
                                aria-required="true"
                            />
                            我已閱讀並同意個資告知事項
                        </label>
                    </div>
                    
                    {validationError && <p className="error-message">{validationError}</p>}
                    
                    <button type="submit" className="primary" disabled={isLoading || !userEmail} style={{width: '100%', fontSize: '1.2rem'}}>
                        {!userEmail ? '請先登入' : isLoading ? '處理中...' : '送出'}
                    </button>
                </fieldset>
            </form>
            
            {isLoading && <div className="spinner" aria-label="載入中"></div>}

            {responseLog && (
                 <div className="log" aria-live="polite">
                     <p className="log-title">API 回應:</p>
                     <pre>{JSON.stringify(responseLog, null, 2)}</pre>
                 </div>
            )}
            <div id="footer-container"></div>
        </main>
    );
};

// 加載footer
fetch('/footer.html')
    .then(response => response.text())
    .then(html => {
        const footerContainer = document.getElementById('footer-container');
        if (footerContainer) {
            footerContainer.innerHTML = html;
        }
    })
    .catch(error => console.log('Footer加載失敗:', error));

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);