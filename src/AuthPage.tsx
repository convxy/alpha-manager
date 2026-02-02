import React, { useState } from 'react';
import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    sendPasswordResetEmail
} from 'firebase/auth';
import { Mail, Lock, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import logoIcon from './assets/logo_icon.png';
import logoText from './assets/logo_text.png';

// --- MORANDI PALETTE ---


interface AuthPageProps {
    auth: any;
    onAuthSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ auth, onAuthSuccess }) => {
    const [mode, setMode] = useState<'main' | 'email-login' | 'email-register' | 'reset-password'>('main');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            onAuthSuccess();
        } catch (e: any) {
            console.error('Google login error:', e);
            setError(getErrorMessage(e.code));
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('请填写邮箱和密码');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            onAuthSuccess();
        } catch (e: any) {
            console.error('Email login error:', e);
            setError(getErrorMessage(e.code));
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('请填写邮箱和密码');
            return;
        }
        if (password.length < 6) {
            setError('密码至少需要6位');
            return;
        }
        if (password !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            onAuthSuccess();
        } catch (e: any) {
            console.error('Email register error:', e);
            setError(getErrorMessage(e.code));
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError('请输入邮箱地址');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await sendPasswordResetEmail(auth, email);
            setSuccessMessage('重置密码邮件已发送，请查收邮箱');
        } catch (e: any) {
            console.error('Reset password error:', e);
            setError(getErrorMessage(e.code));
        } finally {
            setIsLoading(false);
        }
    };

    const getErrorMessage = (code: string): string => {
        const messages: { [key: string]: string } = {
            'auth/email-already-in-use': '该邮箱已被注册',
            'auth/invalid-email': '邮箱格式不正确',
            'auth/user-not-found': '用户不存在',
            'auth/wrong-password': '密码错误',
            'auth/weak-password': '密码强度不够',
            'auth/too-many-requests': '尝试次数过多，请稍后再试',
            'auth/popup-closed-by-user': '登录窗口被关闭',
            'auth/cancelled-popup-request': '登录被取消',
            'auth/account-exists-with-different-credential': '该邮箱已使用其他方式注册',
        };
        return messages[code] || '登录失败，请重试';
    };

    const resetState = () => {
        setError('');
        setSuccessMessage('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
    };

    const goBack = () => {
        resetState();
        setMode('main');
    };

    return (
        <div className="flex items-center justify-center p-4 relative rounded-[32px] shadow-2xl border-4 border-white/50" style={{ backgroundColor: '#F7F7F5', fontFamily: "'Space Grotesk', 'Noto Sans SC', sans-serif" }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');`}</style>

            <div className="w-full max-w-md relative z-10">
                {/* Logo Area */}
                <div className="text-center mb-8 animate-fade-in-down">
                    <img src={logoIcon} alt="AlphaDash" className="h-20 w-auto mx-auto mb-4 drop-shadow-sm transition-transform duration-500 hover:scale-105" />
                    <img src={logoText} alt="AlphaDash" className="h-8 w-auto mx-auto opacity-90" />
                </div>

                {/* Clean Card - Solid White, No Blur */}
                <div className="rounded-3xl p-8 shadow-xl bg-white border border-slate-100 overflow-hidden relative">

                    <div className="transition-all duration-300 transform">
                        {/* Main Login Options */}
                        {mode === 'main' && (
                            <div className="space-y-5 animate-fade-in-up">
                                <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">欢迎回来</h2>

                                {/* Google Login */}
                                <button
                                    onClick={handleGoogleLogin}
                                    disabled={isLoading}
                                    className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.01] hover:shadow-sm disabled:opacity-50 border border-slate-200 bg-white group text-gray-700"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Google 快速登录
                                </button>

                                {/* Divider */}
                                <div className="flex items-center gap-4 my-2">
                                    <div className="flex-1 h-px bg-gray-100"></div>
                                    <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">or</span>
                                    <div className="flex-1 h-px bg-gray-100"></div>
                                </div>

                                {/* Email Options */}
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => { resetState(); setMode('email-login'); }}
                                        className="py-3.5 rounded-xl font-bold text-sm transition-all hover:bg-slate-50 border border-transparent text-slate-600 bg-slate-50/50"
                                    >
                                        邮箱登录
                                    </button>
                                    <button
                                        onClick={() => { resetState(); setMode('email-register'); }}
                                        className="py-3.5 rounded-xl font-bold text-sm transition-all hover:bg-emerald-50 border border-transparent text-emerald-600 bg-emerald-50/50"
                                    >
                                        新用户注册
                                    </button>
                                </div>

                                {error && (
                                    <div className="mt-4 p-3 rounded-xl text-sm text-center bg-red-50 text-red-500 animate-shake">
                                        {error}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Email Login Form */}
                        {mode === 'email-login' && (
                            <form onSubmit={handleEmailLogin} className="space-y-5 animate-fade-in-right">
                                <div className="flex items-center justify-between mb-2">
                                    <button type="button" onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500">
                                        <ArrowLeft size={20} />
                                    </button>
                                    <h2 className="text-xl font-bold text-gray-800">邮箱登录</h2>
                                    <div className="w-8"></div>
                                </div>

                                <div className="space-y-4">
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 padding-left-3 flex items-center pointer-events-none pl-4">
                                            <Mail size={18} className="text-gray-400 group-focus-within:text-slate-600 transition-colors" />
                                        </div>
                                        <input
                                            type="email"
                                            placeholder="输入邮箱地址"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="block w-full pl-12 pr-4 py-4 bg-[#F7F7F5] border-none rounded-xl outline-none focus:ring-2 focus:ring-slate-200 transition-all text-gray-700 placeholder-gray-400 font-medium"
                                        />
                                    </div>

                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 padding-left-3 flex items-center pointer-events-none pl-4">
                                            <Lock size={18} className="text-gray-400 group-focus-within:text-slate-600 transition-colors" />
                                        </div>
                                        <input
                                            type="password"
                                            placeholder="输入密码"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="block w-full pl-12 pr-4 py-4 bg-[#F7F7F5] border-none rounded-xl outline-none focus:ring-2 focus:ring-slate-200 transition-all text-gray-700 placeholder-gray-400 font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => { resetState(); setMode('reset-password'); }}
                                        className="text-sm font-medium text-slate-500 hover:text-slate-700"
                                    >
                                        忘记密码？
                                    </button>
                                </div>

                                {error && (
                                    <div className="p-3 rounded-xl text-sm text-center bg-red-50 text-red-500 animate-shake">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] hover:shadow-lg disabled:opacity-70 disabled:hover:scale-100 bg-[#434343] hover:bg-[#2d2d2d] shadow-md"
                                >
                                    {isLoading && <Loader2 className="animate-spin" size={20} />}
                                    登 录
                                </button>
                            </form>
                        )}

                        {/* Email Register Form */}
                        {mode === 'email-register' && (
                            <form onSubmit={handleEmailRegister} className="space-y-5 animate-fade-in-right">
                                <div className="flex items-center justify-between mb-2">
                                    <button type="button" onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500">
                                        <ArrowLeft size={20} />
                                    </button>
                                    <h2 className="text-xl font-bold text-gray-800">注册账号</h2>
                                    <div className="w-8"></div>
                                </div>

                                <div className="space-y-4">
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 padding-left-3 flex items-center pointer-events-none pl-4">
                                            <Mail size={18} className="text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                                        </div>
                                        <input
                                            type="email"
                                            placeholder="邮箱地址"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="block w-full pl-12 pr-4 py-4 bg-[#F7F7F5] border-none rounded-xl outline-none focus:ring-2 focus:ring-emerald-100 transition-all text-gray-700 placeholder-gray-400 font-medium"
                                        />
                                    </div>

                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 padding-left-3 flex items-center pointer-events-none pl-4">
                                            <Lock size={18} className="text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                                        </div>
                                        <input
                                            type="password"
                                            placeholder="设置密码 (至少6位)"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="block w-full pl-12 pr-4 py-4 bg-[#F7F7F5] border-none rounded-xl outline-none focus:ring-2 focus:ring-emerald-100 transition-all text-gray-700 placeholder-gray-400 font-medium"
                                        />
                                    </div>

                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 padding-left-3 flex items-center pointer-events-none pl-4">
                                            <CheckCircle size={18} className="text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                                        </div>
                                        <input
                                            type="password"
                                            placeholder="确认密码"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            className="block w-full pl-12 pr-4 py-4 bg-[#F7F7F5] border-none rounded-xl outline-none focus:ring-2 focus:ring-emerald-100 transition-all text-gray-700 placeholder-gray-400 font-medium"
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 rounded-xl text-sm text-center bg-red-50 text-red-500 animate-shake">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] hover:shadow-lg disabled:opacity-70 disabled:hover:scale-100 bg-[#8EB897] hover:bg-[#7da886] shadow-md"
                                >
                                    {isLoading && <Loader2 className="animate-spin" size={20} />}
                                    立即注册
                                </button>
                            </form>
                        )}

                        {/* Reset Password Form */}
                        {mode === 'reset-password' && (
                            <form onSubmit={handleResetPassword} className="space-y-5 animate-fade-in-right">
                                <div className="flex items-center justify-between mb-2">
                                    <button type="button" onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500">
                                        <ArrowLeft size={20} />
                                    </button>
                                    <h2 className="text-xl font-bold text-gray-800">重置密码</h2>
                                    <div className="w-8"></div>
                                </div>

                                <p className="text-sm text-gray-500 mb-4 bg-slate-50 p-4 rounded-xl">
                                    输入您的注册邮箱，我们将向您发送重置链接。
                                </p>

                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 padding-left-3 flex items-center pointer-events-none pl-4">
                                        <Mail size={18} className="text-gray-400 group-focus-within:text-slate-600 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="邮箱地址"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="block w-full pl-12 pr-4 py-4 bg-[#F7F7F5] border-none rounded-xl outline-none focus:ring-2 focus:ring-slate-200 transition-all text-gray-700 placeholder-gray-400 font-medium"
                                    />
                                </div>

                                {error && (
                                    <div className="p-3 rounded-xl text-sm text-center bg-red-50 text-red-500 animate-shake">
                                        {error}
                                    </div>
                                )}

                                {successMessage && (
                                    <div className="p-4 rounded-xl text-sm text-center flex items-center justify-center gap-2 bg-green-50 text-green-600 shadow-sm animate-bounce-in">
                                        <CheckCircle size={18} /> {successMessage}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading || !!successMessage}
                                    className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] hover:shadow-lg disabled:opacity-70 disabled:hover:scale-100 bg-[#6D8299] hover:bg-[#5c7085] shadow-md"
                                >
                                    {isLoading && <Loader2 className="animate-spin" size={20} />}
                                    发送重置邮件
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs mt-6 text-gray-400 font-medium tracking-wide">
                    登录即表示您同意我们的 <span className="underline cursor-pointer hover:text-gray-600 transition-colors">服务条款</span> 和 <span className="underline cursor-pointer hover:text-gray-600 transition-colors">隐私政策</span>
                </p>
            </div>
        </div>
    );
};

export default AuthPage;
