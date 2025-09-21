import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';

declare const google: any;

const StudentCardApp = () => {
    // State management (複製原本的state)
    const [name, setName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [consent, setConsent] = useState(false);
    const [signatureDataUrl, setSignatureDataUrl] = useState('');
    const [isSignatureConfirmed, setIsSignatureConfirmed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [responseLog, setResponseLog] = useState<object | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [validationError, setValidationError] = useState('');
    const [studentIdError, setStudentIdError] = useState('');
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [showFullscreenSignature, setShowFullscreenSignature] = useState(false);

    // Canvas refs and state (複製原本的canvas邏輯)
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number, y: number } | null>(null);

    // Canvas Logic (複製原本的canvas函數)
    const getPos = (e: MouseEvent | TouchEvent, canvas?: HTMLCanvasElement): { x: number, y: number } | null => {
        const targetCanvas = canvas || canvasRef.current;
        if (!targetCanvas) return null;
        const rect = targetCanvas.getBoundingClientRect();
        const touch = 'touches' in e ? e.touches[0] : e;
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    };

    const startDrawing = useCallback((e: MouseEvent | TouchEvent, canvas?: HTMLCanvasElement) => {
        isDrawing.current = true;
        lastPos.current = getPos(e, canvas);
    }, []);

    const draw = useCallback((e: MouseEvent | TouchEvent, canvas?: HTMLCanvasElement) => {
        const targetCanvas = canvas || canvasRef.current;
        if (!isDrawing.current || !targetCanvas || !lastPos.current) return;
        
        e.preventDefault();
        
        const ctx = targetCanvas.getContext('2d');
        const currentPos = getPos(e, targetCanvas);

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
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }
        
        if (fullscreenCanvasRef.current) {
            const ctx = fullscreenCanvasRef.current.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, fullscreenCanvasRef.current.width, fullscreenCanvasRef.current.height);
            }
        }
        
        setSignatureDataUrl('');
        setIsSignatureConfirmed(false);
    };

    // Canvas setup (複製原本的useEffect)
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

        const fullscreenCanvas = fullscreenCanvasRef.current;
        if (fullscreenCanvas && showFullscreenSignature) {
            const dpr = window.devicePixelRatio || 1;
            const rect = fullscreenCanvas.getBoundingClientRect();
            fullscreenCanvas.width = rect.width * dpr;
            fullscreenCanvas.height = rect.height * dpr;
            
            const ctx = fullscreenCanvas.getContext('2d');
            if (ctx) {
                ctx.scale(dpr, dpr);
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#333';
            }

            const fullscreenStartDrawing = (e: MouseEvent | TouchEvent) => startDrawing(e, fullscreenCanvas);
            const fullscreenDraw = (e: MouseEvent | TouchEvent) => draw(e, fullscreenCanvas);

            fullscreenCanvas.addEventListener('mousedown', fullscreenStartDrawing);
            fullscreenCanvas.addEventListener('mousemove', fullscreenDraw);
            fullscreenCanvas.addEventListener('touchstart', fullscreenStartDrawing, { passive: false });
            fullscreenCanvas.addEventListener('touchmove', fullscreenDraw, { passive: false });
        }

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            window.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            window.removeEventListener('touchend', stopDrawing);
        };
    }, [startDrawing, draw, stopDrawing, showFullscreenSignature]);

    // Google Sign-In Logic (複製原本的登入邏輯)
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
            setName(userObject.name || '');
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

        google.accounts.id.prompt();
    }, [userEmail, handleGoogleSignIn]);

    const handleLogout = () => {
        if (typeof google !== 'undefined') {
            google.accounts.id.disableAutoSelect();
        }
        setUserEmail(null);
        setName('');
        setStudentId('');
        setStudentIdError('');
        setConsent(false);
        clearCanvas();
        setResponseLog(null);
        setValidationError('');
    };

    // UI Handlers (複製原本的處理函數)
    const handleConfirmSignature = () => {
        const activeCanvas = showFullscreenSignature ? fullscreenCanvasRef.current : canvasRef.current;
        if (!activeCanvas) return;
        
        const dataUrl = activeCanvas.toDataURL('image/png');
        const ctx = activeCanvas.getContext('2d');
        if(ctx) {
            const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, activeCanvas.width, activeCanvas.height).data.buffer);
            if (!pixelBuffer.some(color => color !== 0)) {
                alert('簽名為空，請先簽名。');
                return;
            }
        }
        
        const base64Length = dataUrl.length - 'data:image/png;base64,'.length;
        const byteSize = base64Length * (3 / 4) - (dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0);

        if (byteSize < 10000) {
            alert('簽名太小或過於簡單，請重新簽名。');
            return;
        }
        if (byteSize > 5000000) {
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

        const requestPayload = {
            name,
            student_id: studentId,
            signature_data_url: signatureDataUrl,
            sign_item: '學生證', // 改為學生證
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
                    setStatusMessage(`✅ 成功: ${jsonResponse.message}`);
                    break;
                case 'DUPLICATE':
                    setStatusMessage(`⚠️ 提醒: ${jsonResponse.message}`);
                    break;
                case 'VALIDATION_ERROR':
                case 'AUTH_REQUIRED':
                case 'TOOL_ERROR':
                case 'TOO_MANY_REQUESTS':
                    setStatusMessage(`❌ 錯誤: ${jsonResponse.message}`);
                    break;
                default:
                    setStatusMessage(`❓ 未知回應: ${jsonResponse.message}`);
            }

        } catch (error) {
            console.error("API Error:", error);
            const errorMessage = "與後端 API 連線時發生錯誤。";
            setResponseLog({ error: errorMessage, details: String(error) });
            setStatusMessage(`❌ 連線錯誤: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <main>
            <h1>學生證簽收系統</h1>

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
                            value="學生證"
                            readOnly
                            style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                        />
                    </div>

                    <div className="card">
                        <label htmlFor="signature-pad">簽名</label>
                        <div className={isSignatureConfirmed ? 'hidden' : ''}>
                            <canvas 
                                id="signature-pad" 
                                ref={canvasRef} 
                                aria-label="簽名區域"
                                onClick={() => setShowFullscreenSignature(true)}
                            ></canvas>
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
                            我已確認已簽收本次簽收項目
                        </label>
                    </div>
                    
                    {validationError && <p className="error-message">{validationError}</p>}
                    
                    <button type="submit" className="primary" disabled={isLoading || !userEmail} style={{width: '100%', fontSize: '1.2rem'}}>
                        {!userEmail ? '請先登入' : isLoading ? '處理中...' : '送出'}
                    </button>
                </fieldset>
            </form>
            
            {statusMessage && (
                <div className="status-message">
                    {statusMessage}
                </div>
            )}
            
            {isLoading && <div className="spinner" aria-label="載入中"></div>}

            {responseLog && (
                 <div className="log hidden" aria-live="polite">
                     <p className="log-title">API 回應:</p>
                     <pre>{JSON.stringify(responseLog, null, 2)}</pre>
                 </div>
            )}

            <footer style={{
                backgroundColor: '#f8f9fa',
                padding: '20px',
                textAlign: 'center',
                borderTop: '1px solid #dee2e6',
                marginTop: '50px'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <p style={{ margin: '5px 0', color: '#6c757d' }}>© 2024 線上簽收系統 - 所有權利保留</p>
                    <p style={{ margin: '5px 0', color: '#6c757d' }}>如有問題請聯繫系統管理員</p>
                    <p style={{ margin: '5px 0', color: '#6c757d', fontSize: '12px' }}>系統版本 v1.0 | 最後更新：2024年</p>
                </div>
            </footer>
            
            {showFullscreenSignature && (
                <div className="fullscreen-signature-overlay">
                    <div className="fullscreen-signature-container">
                        <div className="fullscreen-signature-header">
                            <h3>簽名區域</h3>
                            <button 
                                type="button" 
                                className="close-button"
                                onClick={() => setShowFullscreenSignature(false)}
                            >×</button>
                        </div>
                        <canvas 
                            id="fullscreen-signature-pad" 
                            ref={fullscreenCanvasRef}
                            className="fullscreen-canvas"
                            aria-label="滿版簽名區域"
                        ></canvas>
                        <div className="fullscreen-button-group">
                            <button type="button" className="secondary" onClick={clearCanvas}>清除</button>
                            <button 
                                type="button" 
                                className="primary" 
                                onClick={() => {
                                    handleConfirmSignature();
                                    setShowFullscreenSignature(false);
                                }}
                            >確認簽名</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<StudentCardApp />);