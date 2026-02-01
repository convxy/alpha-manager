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
const COLORS = {
    bg: '#F7F7F5',
    card: '#FFFFFF',
    textPrimary: '#434343',
    textSecondary: '#8C8C8C',
    profit: '#8EB897',
    loss: '#DD8D8D',
    primary: '#6D8299',
    accent: '#E07A5F',
};

interface AuthPageProps {
    auth: any;
    onAuthSuccess: () => void;
}

export default function AuthPage({ auth, onAuthSuccess }: AuthPageProps) {
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
        <div className="flex items-center justify-center p-4" style={{ backgroundColor: COLORS.bg, fontFamily: "'Space Grotesk', 'Noto Sans SC', sans-serif" }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');`}</style>

            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <img src={logoIcon} alt="AlphaDash" className="h-20 w-auto mx-auto mb-4" />
                    <img src={logoText} alt="AlphaDash" className="h-8 w-auto mx-auto" />
                    <p className="text-sm mt-2" style={{ color: COLORS.textSecondary }}>Your Private Alpha Tracker</p>
                </div>

                {/* Card */}
                <div className="rounded-[32px] p-8 shadow-xl border" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20` }}>

                    {/* Main Login Options */}
                    {mode === 'main' && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-center mb-6" style={{ color: COLORS.textPrimary }}>登录 / 注册</h2>

                            {/* Google Login */}
                            <button
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                                className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-50 border-2"
                                style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}30`, color: COLORS.textPrimary }}
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Google 登录
                            </button>

                            {/* Divider */}
                            <div className="flex items-center gap-4 my-6">
                                <div className="flex-1 h-px" style={{ backgroundColor: `${COLORS.textSecondary}20` }}></div>
                                <span className="text-xs font-medium" style={{ color: COLORS.textSecondary }}>或使用邮箱</span>
                                <div className="flex-1 h-px" style={{ backgroundColor: `${COLORS.textSecondary}20` }}></div>
                            </div>

                            {/* Email Options */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => { resetState(); setMode('email-login'); }}
                                    className="py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                                    style={{ backgroundColor: `${COLORS.primary}15`, color: COLORS.primary }}
                                >
                                    邮箱登录
                                </button>
                                <button
                                    onClick={() => { resetState(); setMode('email-register'); }}
                                    className="py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                                    style={{ backgroundColor: `${COLORS.profit}15`, color: COLORS.profit }}
                                >
                                    邮箱注册
                                </button>
                            </div>

                            {error && (
                                <div className="mt-4 p-3 rounded-xl text-sm text-center" style={{ backgroundColor: `${COLORS.loss}15`, color: COLORS.loss }}>
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Email Login Form */}
                    {mode === 'email-login' && (
                        <form onSubmit={handleEmailLogin} className="space-y-4">
                            <button type="button" onClick={goBack} className="flex items-center gap-2 text-sm font-medium mb-4" style={{ color: COLORS.textSecondary }}>
                                <ArrowLeft size={16} /> 返回
                            </button>
                            <h2 className="text-xl font-bold mb-6" style={{ color: COLORS.textPrimary }}>邮箱登录</h2>

                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: COLORS.textSecondary }} />
                                <input
                                    type="email"
                                    placeholder="邮箱地址"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full py-4 pl-12 pr-4 rounded-2xl border-2 outline-none transition-all focus:border-blue-400"
                                    style={{ backgroundColor: COLORS.bg, borderColor: `${COLORS.textSecondary}20`, color: COLORS.textPrimary }}
                                />
                            </div>

                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: COLORS.textSecondary }} />
                                <input
                                    type="password"
                                    placeholder="密码"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full py-4 pl-12 pr-4 rounded-2xl border-2 outline-none transition-all focus:border-blue-400"
                                    style={{ backgroundColor: COLORS.bg, borderColor: `${COLORS.textSecondary}20`, color: COLORS.textPrimary }}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => { resetState(); setMode('reset-password'); }}
                                className="text-sm font-medium"
                                style={{ color: COLORS.primary }}
                            >
                                忘记密码？
                            </button>

                            {error && (
                                <div className="p-3 rounded-xl text-sm text-center" style={{ backgroundColor: `${COLORS.loss}15`, color: COLORS.loss }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
                                style={{ backgroundColor: COLORS.primary }}
                            >
                                {isLoading && <Loader2 className="animate-spin" size={18} />}
                                登录
                            </button>
                        </form>
                    )}

                    {/* Email Register Form */}
                    {mode === 'email-register' && (
                        <form onSubmit={handleEmailRegister} className="space-y-4">
                            <button type="button" onClick={goBack} className="flex items-center gap-2 text-sm font-medium mb-4" style={{ color: COLORS.textSecondary }}>
                                <ArrowLeft size={16} /> 返回
                            </button>
                            <h2 className="text-xl font-bold mb-6" style={{ color: COLORS.textPrimary }}>邮箱注册</h2>

                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: COLORS.textSecondary }} />
                                <input
                                    type="email"
                                    placeholder="邮箱地址"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full py-4 pl-12 pr-4 rounded-2xl border-2 outline-none transition-all focus:border-blue-400"
                                    style={{ backgroundColor: COLORS.bg, borderColor: `${COLORS.textSecondary}20`, color: COLORS.textPrimary }}
                                />
                            </div>

                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: COLORS.textSecondary }} />
                                <input
                                    type="password"
                                    placeholder="密码 (至少6位)"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full py-4 pl-12 pr-4 rounded-2xl border-2 outline-none transition-all focus:border-blue-400"
                                    style={{ backgroundColor: COLORS.bg, borderColor: `${COLORS.textSecondary}20`, color: COLORS.textPrimary }}
                                />
                            </div>

                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: COLORS.textSecondary }} />
                                <input
                                    type="password"
                                    placeholder="确认密码"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full py-4 pl-12 pr-4 rounded-2xl border-2 outline-none transition-all focus:border-blue-400"
                                    style={{ backgroundColor: COLORS.bg, borderColor: `${COLORS.textSecondary}20`, color: COLORS.textPrimary }}
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl text-sm text-center" style={{ backgroundColor: `${COLORS.loss}15`, color: COLORS.loss }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
                                style={{ backgroundColor: COLORS.profit }}
                            >
                                {isLoading && <Loader2 className="animate-spin" size={18} />}
                                注册
                            </button>
                        </form>
                    )}

                    {/* Reset Password Form */}
                    {mode === 'reset-password' && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <button type="button" onClick={goBack} className="flex items-center gap-2 text-sm font-medium mb-4" style={{ color: COLORS.textSecondary }}>
                                <ArrowLeft size={16} /> 返回
                            </button>
                            <h2 className="text-xl font-bold mb-6" style={{ color: COLORS.textPrimary }}>重置密码</h2>

                            <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
                                输入您的邮箱地址，我们将发送重置密码链接到您的邮箱。
                            </p>

                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: COLORS.textSecondary }} />
                                <input
                                    type="email"
                                    placeholder="邮箱地址"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full py-4 pl-12 pr-4 rounded-2xl border-2 outline-none transition-all focus:border-blue-400"
                                    style={{ backgroundColor: COLORS.bg, borderColor: `${COLORS.textSecondary}20`, color: COLORS.textPrimary }}
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl text-sm text-center" style={{ backgroundColor: `${COLORS.loss}15`, color: COLORS.loss }}>
                                    {error}
                                </div>
                            )}

                            {successMessage && (
                                <div className="p-3 rounded-xl text-sm text-center flex items-center justify-center gap-2" style={{ backgroundColor: `${COLORS.profit}15`, color: COLORS.profit }}>
                                    <CheckCircle size={16} /> {successMessage}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || !!successMessage}
                                className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
                                style={{ backgroundColor: COLORS.primary }}
                            >
                                {isLoading && <Loader2 className="animate-spin" size={18} />}
                                发送重置邮件
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-xs mt-6" style={{ color: COLORS.textSecondary }}>
                    登录即表示您同意我们的服务条款和隐私政策
                </p>
            </div>
        </div>
    );
}
