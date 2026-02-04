import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getFirestore, collection, doc, setDoc, getDocs, getDoc,
    query, orderBy, writeBatch, enableIndexedDbPersistence
} from 'firebase/firestore';
import { getAuth, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import {
    ResponsiveContainer, ComposedChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, AreaChart, Cell, BarChart
} from 'recharts';
import {
    Calendar as CalendarIcon, TrendingDown, TrendingUp,
    Save, FileUp, Monitor, X, ArrowRight, PieChart, DollarSign, Percent, CheckCircle, ChevronLeft, ChevronRight, Loader2, Wallet, BarChart3, LineChart, Trash2, Download, Twitter, Upload, Star, Gift, ExternalLink, Share2
} from 'lucide-react';
import logoIcon from './assets/logo_icon.png';
import logoText from './assets/logo_text.png';

// Lazy load ReportView for code-splitting
const ReportView = lazy(() => import('./ReportView'));
const AuthPage = lazy(() => import('./AuthPage'));

// --- CONFIGURATION ---
// 使用您提供的真实配置
const firebaseConfig = {
    apiKey: "AIzaSyBIp6moDVh3mPcuVapFZujscag0ZJkd6TE",
    authDomain: "alpha-tracker-6c0e0.firebaseapp.com",
    projectId: "alpha-tracker-6c0e0",
    storageBucket: "alpha-tracker-6c0e0.firebasestorage.app",
    messagingSenderId: "173966712115",
    appId: "1:173966712115:web:0ca500d0720498730ad3c3"
};

// --- CONSTANTS ---
const INITIAL_BALANCES: { [key: string]: number } = {
    '1号': 1972.25, '2号': 1649.62, '3号': 634.15, '4号': 1104.15,
    '5号': 573.54, '6号': 529.05, '7号': 635.33, '8号': 639.45
};

// --- MORANDI PALETTE (STYLE FROM FILE 1) ---
const COLORS = {
    bg: '#F7F7F5', // Warm Grey
    card: '#FFFFFF',
    textPrimary: '#434343',
    textSecondary: '#8C8C8C',
    profit: '#8EB897', // Sage Green
    profitLight: '#E3EFE5',
    loss: '#DD8D8D',   // Dusty Red
    lossLight: '#F7E6E6',
    revenue: '#9FB1BC', // Muted Blue/Grey
    revenueLight: '#EBF1F5',
    cost: '#D3C09A',    // Sand/Beige
    costLight: '#F5F0E6',
    primary: '#6D8299', // Slate Blue
    accent: '#E07A5F',  // Terra Cotta
};

// --- INITIALIZATION ---
let app: any, db: any, auth: any;
let isDemoMode = false; // Production mode - using Firebase Firestore

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Enable offline persistence for faster subsequent loads
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('离线持久化失败：多个标签页打开');
        } else if (err.code === 'unimplemented') {
            console.warn('离线持久化失败：浏览器不支持');
        }
    });
} catch (e) {
    console.warn("Firebase initialized in demo mode or already initialized.", e);
    isDemoMode = true;
}

// --- TYPES ---
type Record = {
    date: string;
    accountId: string;
    score: number;
    balance?: number;
    revenue?: number;
    cost: number;
    net: number;
    projectId?: string;
    balanceAdjust?: number; // 余额调整：空投收入(正数)、对外转账(负数)
    prevBalance?: number; // 手动录入的昨日余额（用于断档时记录）
};

// --- HELPER FUNCTIONS ---
// Format date as YYYY-MM-DD without timezone conversion (input is local time)
const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Parse various date input formats: 2026/1/29, 2026-1-29, 2026.1.29, etc.
const parseInputDate = (str: string): Date | null => {
    if (!str || !str.trim()) return null;
    const s = str.trim();

    // Try standard Date parsing first
    let d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    // Try parsing formats like 2026/1/29 or 2026.1.29
    const match = s.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
    if (match) {
        const [, year, month, day] = match;
        d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(d.getTime())) return d;
    }

    // Try parsing formats like 1/29/2026 (US format)
    const match2 = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
    if (match2) {
        const [, month, day, year] = match2;
        d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(d.getTime())) return d;
    }

    return null;
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const getWeekLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return `${monday.getMonth() + 1}.${monday.getDate()}`;
};

const parseData = (str: string): string[][] => {
    if (!str) return [];
    const lines = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const isTsv = lines[0].includes('\t');
    const delimiter = isTsv ? '\t' : ',';
    return lines.map(line => {
        const row: string[] = [];
        let current = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuote = !inQuote;
            else if (char === delimiter && !inQuote) {
                row.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
                current = '';
            } else current += char;
        }
        row.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        return row;
    });
};

// --- STORAGE ---
const STORAGE_KEY = 'binance_alpha_records';
const ACCOUNTS_KEY = 'binance_alpha_accounts';

const getLocalRecords = (): Record[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};
const saveLocalBatch = (newRecs: Record[]) => {
    const current = getLocalRecords();
    const map = new Map();
    current.forEach(r => map.set(`${r.date}_${r.accountId}`, r));
    newRecs.forEach(r => map.set(`${r.date}_${r.accountId}`, r));
    const updated = Array.from(map.values()).sort((a: any, b: any) => b.date.localeCompare(a.date));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

// Account persistence
const getLocalAccounts = (): string[] => {
    const data = localStorage.getItem(ACCOUNTS_KEY);
    return data ? JSON.parse(data) : ['1号']; // Default: 1 account
};
const saveLocalAccounts = (accounts: string[]) => {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

// Pro Unlock persistence - Structured for future monetization
const UNLOCK_KEY = 'alphadash_subscription';

interface SubscriptionData {
    tier: 'free' | 'follower' | 'pro';
    unlockedAt: string | null;
    source: 'twitter_follow' | 'paid' | null;
    accountLimit: number;
}

const DEFAULT_SUBSCRIPTION: SubscriptionData = {
    tier: 'free',
    unlockedAt: null,
    source: null,
    accountLimit: 1
};

const getSubscription = (): SubscriptionData => {
    const data = localStorage.getItem(UNLOCK_KEY);
    if (!data) return DEFAULT_SUBSCRIPTION;
    try {
        // Handle legacy boolean format migration
        if (data === 'true') {
            return { tier: 'follower', unlockedAt: new Date().toISOString(), source: 'twitter_follow', accountLimit: 50 };
        }
        return JSON.parse(data);
    } catch {
        return DEFAULT_SUBSCRIPTION;
    }
};

const setSubscription = (sub: SubscriptionData) => {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(sub));
};

// Legacy compatibility wrappers
const getUnlockStatus = (): boolean => {
    const sub = getSubscription();
    return sub.tier !== 'free';
};
const setUnlockStatus = (unlocked: boolean) => {
    if (unlocked) {
        setSubscription({
            tier: 'follower',
            unlockedAt: new Date().toISOString(),
            source: 'twitter_follow',
            accountLimit: 50 // Unlimited for now (future: 3 for follower tier)
        });
    } else {
        setSubscription(DEFAULT_SUBSCRIPTION);
    }
};

// --- MAIN COMPONENT ---
export default function App() {
    const [user, setUser] = useState<any>(null);
    const [records, setRecords] = useState<Record[]>([]);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'report'>('dashboard');
    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [pasteContent, setPasteContent] = useState('');
    const [parsedRecords, setParsedRecords] = useState<Record[]>([]);
    const [step, setStep] = useState<'paste' | 'preview'>('paste');
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [accounts, setAccounts] = useState<string[]>(getLocalAccounts);
    const [authLoading, setAuthLoading] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Pro Unlock State
    const [isProUnlocked, setIsProUnlocked] = useState(getUnlockStatus);
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [unlockStep, setUnlockStep] = useState<'prompt' | 'upload' | 'verifying' | 'success'>('prompt');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);

    // Pro feature limits
    // Free: 1 account only | Pro (after follow): unlimited for now (future: 3 accounts)
    const FREE_ACCOUNT_LIMIT = 1;

    // Account management functions
    const addAccount = () => {
        // Check Pro limit - free users can only have 1 account
        if (!isProUnlocked && accounts.length >= FREE_ACCOUNT_LIMIT) {
            alert(`免费用户仅支持 ${FREE_ACCOUNT_LIMIT} 个账号\n\n关注官方推特即可解锁多账号功能！`);
            setUnlockModalOpen(true);
            return;
        }
        const newNum = accounts.length + 1;
        const newAccounts = [...accounts, `${newNum}号`];
        setAccounts(newAccounts);
        saveLocalAccounts(newAccounts);
    };

    const removeAccount = () => {
        if (accounts.length <= 1) return;
        const newAccounts = accounts.slice(0, -1);
        setAccounts(newAccounts);
        saveLocalAccounts(newAccounts);
    };

    const setAccountCount = (count: number) => {
        // Check Pro limit
        const maxAllowed = isProUnlocked ? 50 : FREE_ACCOUNT_LIMIT;
        if (!isProUnlocked && count > FREE_ACCOUNT_LIMIT) {
            alert(`免费用户仅支持 ${FREE_ACCOUNT_LIMIT} 个账号\n\n关注官方推特即可解锁多账号功能！`);
            setUnlockModalOpen(true);
            return;
        }
        const clampedCount = Math.max(1, Math.min(maxAllowed, count));
        const newAccounts = Array.from({ length: clampedCount }, (_, i) => `${i + 1}号`);
        setAccounts(newAccounts);
        saveLocalAccounts(newAccounts);
    };

    useEffect(() => {
        if (isDemoMode) {
            setUser({ uid: 'demo-user', isLocal: true });
            fetchRecords('demo-user');
            setAuthLoading(false);
        }
        else if (auth) {
            const unsubscribe = onAuthStateChanged(auth, async (u: User | null) => {
                setAuthLoading(false);
                if (u) {
                    setUser(u);
                    setShowAuthModal(false);
                    // Fetch user profile for unlock status
                    if (db) {
                        try {
                            const userDocRef = doc(db, 'users', u.uid);
                            const userDocSnap = await getDoc(userDocRef);
                            if (userDocSnap.exists() && userDocSnap.data().isProUnlocked) {
                                setIsProUnlocked(true);
                                setUnlockStatus(true); // Sync local state too
                            } else {
                                // If not in Firestore, check if we have it locally and sync UP
                                const localStatus = getUnlockStatus();
                                if (localStatus) {
                                    await setDoc(userDocRef, { isProUnlocked: true }, { merge: true });
                                    setIsProUnlocked(true);
                                } else {
                                    setIsProUnlocked(false);
                                }
                            }
                        } catch (e) { console.error('Error fetching user profile:', e); }
                    }

                    fetchRecords(u.uid);
                } else {
                    // Not logged in - use local storage mode (free tier)
                    setUser({ uid: 'local-user', isLocal: true });
                    setRecords(getLocalRecords());
                }
            });
            return () => unsubscribe();
        }
    }, []);

    const handleLogout = async () => {
        if (!confirm('确定要退出登录吗？')) return;
        try {
            await signOut(auth);
            setUser({ uid: 'local-user', isLocal: true });
            setRecords(getLocalRecords());
        } catch (e) {
            console.error('Logout error:', e);
        }
    };

    const handleAuthSuccess = () => {
        setShowAuthModal(false);
        // Auth state change will trigger fetchRecords
    };

    const fetchRecords = async (userId: string) => {
        try {
            if (isDemoMode) setRecords(getLocalRecords());
            else if (db) {
                const q = query(collection(db, `users/${userId}/daily_records`), orderBy('date', 'desc'));
                const snap = await getDocs(q);
                setRecords(snap.docs.map(d => d.data() as Record));
            }
        } catch (e) { console.error(e); }
    };

    // --- LOGIC ENGINE ---
    const dashboardStats = useMemo(() => {
        // Use selectedDate to determine which month's stats to show
        const selectedMonthPrefix = selectedDate.slice(0, 7);
        let monthCost = 0, monthRev = 0, monthNet = 0;
        records.forEach(r => {
            if (r.date.startsWith(selectedMonthPrefix)) {
                monthCost += (r.cost || 0);
                monthRev += (r.revenue || 0);
                monthNet += (r.net || 0);
            }
        });
        const roi = monthCost > 0 ? (monthNet / monthCost) * 100 : 0;
        return { monthCost, monthRev, monthNet, roi, selectedMonth: selectedMonthPrefix };
    }, [records, selectedDate]);

    // Chart Data Preparation
    const { recent30Charts, weeklyCharts, firstDate, lastDate } = useMemo(() => {
        const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

        const dateMap = new Map<string, { net: number, rev: number, cost: number }>();
        sorted.forEach(r => {
            if (!dateMap.has(r.date)) dateMap.set(r.date, { net: 0, rev: 0, cost: 0 });
            const d = dateMap.get(r.date)!;
            d.net += r.net; d.rev += r.revenue || 0; d.cost += r.cost;
        });
        const dailyData = Array.from(dateMap.entries()).map(([date, d]) => ({
            date, ...d, net: Math.round(d.net), rev: Math.round(d.rev), cost: Math.round(d.cost)
        }));

        // Weekly (Cumulative)
        const weekMap = new Map<string, { net: number }>();
        let runningNet = 0;
        dailyData.forEach(d => {
            runningNet += d.net;
            const weekLabel = getWeekLabel(d.date);
            weekMap.set(weekLabel, { net: Math.round(runningNet) });
        });
        const weeklyData = Array.from(weekMap.entries()).map(([date, d]) => ({ date, accNet: d.net }));

        // Extract first and last date for dynamic title
        const firstDate = dailyData.length > 0 ? dailyData[0].date : '';
        const lastDate = dailyData.length > 0 ? dailyData[dailyData.length - 1].date : '';

        return {
            recent30Charts: dailyData.slice(-30),
            weeklyCharts: weeklyData,
            firstDate,
            lastDate
        };
    }, [records]);

    // Account Scoring (15-Day Rolling)
    const accountScores = useMemo(() => {
        const today = new Date(selectedDate);
        const prevDate = new Date(today); prevDate.setDate(today.getDate() - 1);
        const windowSize = 15;

        const getRollingSum = (endDate: Date, acc: string) => {
            let sum = 0;
            for (let i = 0; i < windowSize; i++) {
                const d = new Date(endDate); d.setDate(endDate.getDate() - i);
                const dStr = formatDate(d);
                const rec = records.find(r => r.accountId === acc && r.date === dStr);
                if (rec) sum += rec.score;
            }
            return sum;
        };

        return accounts.map(acc => {
            // FIXED: "当前积分" should be the 15-day rolling sum ending YESTERDAY (not including today)
            // "明日预估" includes today's entered score
            const currentTotalScore = getRollingSum(prevDate, acc); // Changed from 'today' to 'prevDate'
            const yesterdayTotalScore = getRollingSum(new Date(prevDate.getTime() - 86400000), acc); // Day before yesterday

            // Today's entered score (from BatchEntry)
            const todayRec = records.find(r => r.accountId === acc && r.date === selectedDate);
            const dailyScore = todayRec ? todayRec.score : 0;
            const todayRevenue = todayRec?.revenue || 0;

            // Score that will fall off from the CURRENT 15-day window when calculating tomorrow
            // Current window ends at yesterday, so tomorrow's window will drop: yesterday - 14
            const dayFallOffForTomorrow = new Date(prevDate);
            dayFallOffForTomorrow.setDate(prevDate.getDate() - 14);
            const dropRec = records.find(r => r.accountId === acc && r.date === formatDate(dayFallOffForTomorrow));
            const dropScore = dropRec ? dropRec.score : 0;

            // Tomorrow's predicted score:
            // = Current 15-day total (up to yesterday) + today's entered score - drop score
            // Note: No penalty applied since actual score calculation doesn't use penalty
            const predictedScore = currentTotalScore + dailyScore - dropScore;

            const reasons = [];
            if (dailyScore > 0) reasons.push(`+${dailyScore}`);
            if (dropScore > 0) reasons.push(`-${dropScore}`);
            // Show airdrop indicator without affecting score
            if (todayRevenue > 0) reasons.push(`空投`);

            return {
                id: acc,
                yesterdayTotal: yesterdayTotalScore,
                currentTotal: currentTotalScore,  // Now correctly shows sum up to yesterday
                dailyScore,
                nextDayScore: predictedScore,
                dropReason: reasons.length > 0 ? reasons.join(' ') : '',
            };
        });
    }, [records, accounts, selectedDate]);

    // Import Logic
    const handleParseRaw = () => {
        setIsParsing(true);

        setTimeout(() => {
            try {
                const grid = parseData(pasteContent);
                console.log("Parsed grid:", grid.length, "rows");
                if (grid.length < 2) { alert("数据不足"); setIsParsing(false); return; }

                // Check if this is AlphaDash exported CSV format
                // Format: 日期,账号,积分,余额,收益,磨损,净利润,余额调整,昨日余额
                const firstRow = grid[0];
                const isExportedFormat = firstRow.length >= 3 &&
                    (firstRow[0]?.includes('日期') || firstRow[0] === '日期') &&
                    (firstRow[1]?.includes('账号') || firstRow[1] === '账号') &&
                    (firstRow[2]?.includes('积分') || firstRow[2] === '积分');

                if (isExportedFormat) {
                    console.log("Detected AlphaDash exported format");
                    // Parse row-based format
                    const previews: Record[] = [];

                    // Find column indices
                    const dateIdx = 0;
                    const accIdx = 1;
                    const scoreIdx = 2;
                    const balanceIdx = 3;
                    const revenueIdx = 4;
                    const costIdx = 5;
                    const netIdx = 6;
                    const balAdjIdx = 7;
                    const prevBalIdx = 8;

                    for (let i = 1; i < grid.length; i++) {
                        const row = grid[i];
                        if (!row || row.length < 3) continue;

                        const dateStr = row[dateIdx];
                        if (!dateStr) continue;

                        const parsed = parseInputDate(dateStr);
                        if (!parsed) continue;

                        const dateFormatted = formatDate(parsed);
                        const accountId = row[accIdx] || '1号';
                        const score = parseFloat(row[scoreIdx]) || 0;
                        const balance = parseFloat(row[balanceIdx]) || 0;
                        const revenue = parseFloat(row[revenueIdx]) || 0;
                        const cost = parseFloat(row[costIdx]) || 0;
                        const net = parseFloat(row[netIdx]) || (revenue - cost);
                        const balanceAdjust = parseFloat(row[balAdjIdx]) || 0;
                        const prevBalance = parseFloat(row[prevBalIdx]) || 0;

                        previews.push({
                            date: dateFormatted,
                            accountId: accountId,
                            score: score,
                            balance: balance,
                            revenue: revenue,
                            cost: cost,
                            net: net,
                            balanceAdjust: balanceAdjust,
                            prevBalance: prevBalance,
                            projectId: 'Seed'
                        });
                    }

                    if (previews.length === 0) {
                        alert("未解析到有效数据");
                        setIsParsing(false);
                        return;
                    }

                    console.log("Parsed", previews.length, "records from exported format");
                    setParsedRecords(previews);
                    setStep('preview');
                    setIsParsing(false);
                    return;
                }

                // Original column-based format parsing (for Excel paste)
                console.log("Using column-based parsing for Excel format");

                // Find header row by looking for account indicators
                let headerIdx = -1; let maxScore = -1;
                grid.forEach((row, i) => {
                    let score = 0;
                    row.forEach(c => {
                        if (!c) return;
                        const cell = String(c);
                        if (cell.includes('号') && cell !== '账号') score += 10;
                        if (cell.includes('空投') || cell.includes('收益')) score += 5;
                    });
                    if (score > maxScore) { maxScore = score; headerIdx = i; }
                });

                console.log("Header row index:", headerIdx, "Header:", grid[headerIdx]);
                if (headerIdx === -1) { alert("未识别到表头"); setIsParsing(false); return; }

                const header = grid[headerIdx];

                // Find date column - look for column containing dates or labeled '日期'
                let dateIdx = -1;
                header.forEach((cell, i) => {
                    if (!cell) return;
                    const c = String(cell).replace(/\s/g, '');
                    if (c.includes('日期') || c.includes('date') || c.toLowerCase() === 'date') {
                        dateIdx = i;
                    }
                });

                // If no date column found in header, check first few data rows for date patterns in first column
                if (dateIdx === -1) {
                    for (let i = headerIdx + 1; i < Math.min(headerIdx + 5, grid.length); i++) {
                        const firstCell = grid[i][0];
                        if (firstCell && parseInputDate(firstCell)) {
                            dateIdx = 0;
                            break;
                        }
                    }
                }

                console.log("Date column index:", dateIdx);

                // Log first few rows for debugging
                console.log("First 5 rows:", grid.slice(0, 5));

                // Detect account columns - handle various header formats
                // Format 1: "1号" in one cell, "空投" in next cell
                // Format 2: "1号空投" or "1号 空投" combined in one cell
                // Format 3: "1号积分" with score, separate airdrop column
                const detectedAccs: any[] = [];

                header.forEach((cell, i) => {
                    if (!cell) return;
                    const c = String(cell).replace(/\s/g, '');

                    // Match patterns: "1号", "1号空投", "1号积分", "账号1", etc
                    const accMatch = c.match(/^(\d+)号/) || c.match(/(\d+)号空投/) || c.match(/(\d+)号积分/);

                    if (accMatch) {
                        const accNum = accMatch[1];
                        const accName = accNum + '号';

                        // Check if this account was already added
                        const existing = detectedAccs.find(a => a.name === accName);
                        if (!existing) {
                            // If cell contains 空投/收益, this is a revenue column
                            // Otherwise it's a score column
                            if (c.includes('空投') || c.includes('收益')) {
                                // This is a revenue column, look for corresponding score column or create new entry
                                const scoreAcc = detectedAccs.find(a => a.name === accName);
                                if (scoreAcc) {
                                    scoreAcc.revIdx = i;
                                } else {
                                    // Revenue column only, score might be in a different pattern
                                    detectedAccs.push({ name: accName, scoreIdx: i, revIdx: i });
                                }
                            } else {
                                // This is a score column
                                detectedAccs.push({ name: accName, scoreIdx: i, revIdx: -1 });
                            }
                        } else {
                            // Account already exists, this might be revenue column
                            if ((c.includes('空投') || c.includes('收益')) && existing.revIdx === -1) {
                                existing.revIdx = i;
                            }
                        }
                    } else if ((c.includes('空投') || c.includes('收益')) && detectedAccs.length > 0) {
                        // Standalone 空投/收益 column - assign to previous account
                        const lastAcc = detectedAccs[detectedAccs.length - 1];
                        if (lastAcc && lastAcc.revIdx === -1) {
                            lastAcc.revIdx = i;
                        }
                    }
                });

                console.log("Detected accounts:", detectedAccs.map(a => `${a.name}@idx${a.scoreIdx}(rev@${a.revIdx})`));

                if (detectedAccs.length === 0) {
                    alert("未检测到账号列（需包含'号'）");
                    setIsParsing(false);
                    return;
                }

                if (dateIdx === -1) {
                    alert("未检测到日期列");
                    setIsParsing(false);
                    return;
                }

                const previews: Record[] = [];
                const COST_COL_INDEX = 19;

                // Find actual data start row (first row with valid date after header)
                let dataStartIdx = headerIdx + 1;
                for (let i = headerIdx + 1; i < Math.min(headerIdx + 10, grid.length); i++) {
                    const dateCell = grid[i][dateIdx];
                    if (dateCell && parseInputDate(dateCell)) {
                        dataStartIdx = i;
                        break;
                    }
                }
                console.log("Data starts at row:", dataStartIdx);

                for (let i = dataStartIdx; i < grid.length; i++) {
                    const row = grid[i];
                    const dateCell = row[dateIdx];
                    if (!dateCell || !dateCell.trim()) {
                        continue;
                    }
                    const d = parseInputDate(dateCell);
                    if (!d) {
                        console.log("Row", i, "skipped: invalid date", dateCell);
                        continue;
                    }
                    const fmtDate = formatDate(d);

                    let dailyCost = 0;
                    if (row[COST_COL_INDEX]) {
                        const val = parseFloat(row[COST_COL_INDEX]);
                        if (!isNaN(val)) dailyCost = val;
                    }
                    const costPerAcc = dailyCost / (detectedAccs.length || 8);

                    detectedAccs.forEach(acc => {
                        const scoreCell = row[acc.scoreIdx];
                        const score = parseFloat(scoreCell);
                        if (isNaN(score)) {
                            // Only log first few invalid scores to avoid console spam
                            if (i < dataStartIdx + 5) {
                                console.log("Row", i, "account", acc.name, "skipped: invalid score", scoreCell);
                            }
                            return;
                        }
                        const rev = (acc.revIdx > -1) ? (parseFloat(row[acc.revIdx]) || 0) : 0;
                        previews.push({
                            date: fmtDate, accountId: acc.name, score: score, revenue: rev,
                            balance: 0, cost: costPerAcc, net: rev - costPerAcc, projectId: 'Import'
                        });
                    });
                }

                console.log("Parsed records:", previews.length);
                if (previews.length === 0) {
                    alert("未能解析出任何有效记录，请检查数据格式");
                    setIsParsing(false);
                    return;
                }

                setParsedRecords(previews);
                setStep('preview');
            } catch (e) {
                console.error("Parse error:", e);
                alert("解析错误: " + e);
            }
            finally { setIsParsing(false); }
        }, 50);
    };


    const commitToDb = async () => {
        if (parsedRecords.length === 0) return;
        setIsImporting(true);

        // Process in chunks - Firebase limit is 500 operations per batch
        const chunkSize = 500;
        const chunks: Record[][] = [];
        for (let i = 0; i < parsedRecords.length; i += chunkSize) {
            chunks.push(parsedRecords.slice(i, i + chunkSize));
        }

        setTimeout(async () => {
            try {
                if (isDemoMode) {
                    saveLocalBatch(parsedRecords);
                } else if (db && user) {
                    // Create all batches first
                    const batchPromises = chunks.map(chunk => {
                        const batch = writeBatch(db);
                        chunk.forEach((rec: Record) => batch.set(doc(db, `users/${user.uid}/daily_records`, `${rec.date}_${rec.accountId}`), rec));
                        return batch.commit();
                    });
                    // Execute all batches in parallel for faster speed
                    await Promise.all(batchPromises);
                }
                setIsImporting(false);
                setParsedRecords([]);
                setImportModalOpen(false);
                setStep('paste');
                setPasteContent('');
                fetchRecords(user.uid);
                alert(`✅ 成功导入 ${chunks.reduce((sum, c) => sum + c.length, 0)} 条数据`);
            } catch (e) {
                setIsImporting(false);
                alert("导入失败: " + e);
                console.error("Import error:", e);
            }
        }, 50);
    };

    const insertDemoData = () => {
        // Generate random test data: 6-18 accounts, 60-90 days
        // BUT respect Pro limit for free users
        const maxAccounts = isProUnlocked ? 18 : FREE_ACCOUNT_LIMIT;
        const minAccounts = isProUnlocked ? 6 : 1;
        const numAccounts = Math.floor(Math.random() * (maxAccounts - minAccounts + 1)) + minAccounts;
        const numDays = Math.floor(Math.random() * 31) + 60; // 60-90 days

        const accounts = Array.from({ length: numAccounts }, (_, i) => `${i + 1}号`);
        const newRecs: Record[] = [];

        // Generate initial balances for each account (random between 500-2000)
        const initialBalances = accounts.map(() => Math.random() * 1500 + 500);
        let currentBalances = [...initialBalances];

        // Start from numDays ago
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - numDays);

        for (let day = 0; day < numDays; day++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + day);
            const dateStr = formatDate(date);

            accounts.forEach((acc, i) => {
                const prevBalance = currentBalances[i];
                // Random daily values
                const score = Math.floor(Math.random() * 20) + 5; // 5-25 score
                const cost = Math.random() * 5 + 1; // 1-6 cost
                const hasRevenue = Math.random() > 0.7; // 30% chance of revenue
                const revenue = hasRevenue ? Math.floor(Math.random() * 500) + 50 : 0;

                // Calculate new balance
                const balanceChange = revenue - cost;
                currentBalances[i] = Math.max(0, prevBalance + balanceChange);

                const net = revenue - cost;

                newRecs.push({
                    date: dateStr,
                    accountId: acc,
                    score: score,
                    balance: parseFloat(currentBalances[i].toFixed(2)),
                    prevBalance: parseFloat(prevBalance.toFixed(2)),
                    revenue: revenue,
                    cost: parseFloat(cost.toFixed(2)),
                    net: parseFloat(net.toFixed(2)),
                    projectId: 'Seed'
                });
            });
        }

        // Save and refresh
        saveLocalBatch(newRecs);
        setAccounts(accounts);
        saveLocalAccounts(accounts);
        fetchRecords('demo-user');
        setImportModalOpen(false);
        alert(`✅ 已导入测试数据！\n\n账号数: ${numAccounts}\n天数: ${numDays}\n记录数: ${newRecs.length}`);
    };

    const clearAllData = async () => {
        if (!confirm('⚠️ 确定要删除所有数据吗？\n\n此操作将永久删除所有已导入的记录，无法恢复！')) {
            return;
        }

        try {
            if (isDemoMode) {
                localStorage.removeItem(STORAGE_KEY);
                setRecords([]);
                alert('✅ 本地数据已清空');
            } else if (db && user) {
                const snapshot = await getDocs(collection(db, `users/${user.uid}/daily_records`));
                if (snapshot.empty) {
                    alert('没有数据需要删除');
                    return;
                }

                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();

                setRecords([]);
                alert(`✅ 成功删除 ${snapshot.size} 条记录`);
            }
        } catch (e) {
            alert('删除失败: ' + e);
            console.error('Clear data error:', e);
        }
    };

    // --- EXPORT FUNCTIONS ---
    const [exportMenuOpen, setExportMenuOpen] = useState(false);

    const exportToCSV = () => {
        if (records.length === 0) {
            alert('没有数据可以导出');
            return;
        }
        const headers = ['日期', '账号', '积分', '余额', '收益', '磨损', '净利润', '余额调整', '昨日余额'];
        const csvContent = [
            headers.join(','),
            ...records.map(r => [
                r.date,
                r.accountId,
                r.score,
                r.balance || 0,
                r.revenue || 0,
                r.cost || 0,
                r.net || 0,
                r.balanceAdjust || 0,
                r.prevBalance || 0
            ].join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `AlphaDash_Export_${formatDate(new Date())}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        setExportMenuOpen(false);
        alert(`✅ 已导出 ${records.length} 条数据为 CSV 格式`);
    };

    const exportToJSON = () => {
        if (records.length === 0) {
            alert('没有数据可以导出');
            return;
        }
        const jsonContent = JSON.stringify(records, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `AlphaDash_Export_${formatDate(new Date())}.json`;
        link.click();
        URL.revokeObjectURL(url);
        setExportMenuOpen(false);
        alert(`✅ 已导出 ${records.length} 条数据为 JSON 格式`);
    };

    const downloadTemplate = () => {
        const headers = ['日期', '账号', '积分', '余额', '收益', '磨损', '余额调整', '昨日余额'];
        const exampleRows = [
            ['2026-01-01', '1号', '15', '1200.50', '0', '3.25', '0', '1203.75'],
            ['2026-01-01', '2号', '12', '800.00', '0', '2.50', '0', '802.50'],
            ['2026-01-02', '1号', '18', '1197.25', '0', '3.25', '0', '1200.50'],
            ['2026-01-02', '2号', '14', '797.50', '0', '2.50', '0', '800.00'],
        ];
        const csvContent = [
            headers.join(','),
            ...exampleRows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'AlphaDash_上传模板.csv';
        link.click();
        URL.revokeObjectURL(url);
        setExportMenuOpen(false);
        alert('✅ 模板已下载！\n\n请用 Excel 打开并填写您的数据，然后通过导入功能上传。');
    };

    // --- POSTER GENERATION ---
    const generatePoster = async () => {
        const today = formatDate(new Date());
        const todayRecords = records.filter(r => r.date === today);

        // Calculate today's totals
        let totalRev = 0, totalCost = 0, totalNet = 0, totalScore = 0;
        todayRecords.forEach(r => {
            totalRev += r.revenue || 0;
            totalCost += r.cost || 0;
            totalNet += r.net || 0;
            totalScore += r.score || 0;
        });

        // Create canvas
        const canvas = document.createElement('canvas');
        const width = 800;
        const height = 1000;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;

        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16213e');
        gradient.addColorStop(1, '#0f0f23');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Add decorative elements
        ctx.fillStyle = 'rgba(245, 190, 75, 0.05)';
        ctx.beginPath();
        ctx.arc(width * 0.8, height * 0.2, 200, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(width * 0.2, height * 0.7, 150, 0, Math.PI * 2);
        ctx.fill();

        // Title: BINANCE ALPHA
        ctx.textAlign = 'center';
        ctx.fillStyle = '#F5BE4B'; // Binance Yellow
        ctx.font = 'bold 56px "Space Grotesk", sans-serif';
        ctx.fillText('BINANCE ALPHA', width / 2, 100);

        // Subtitle: Date
        ctx.fillStyle = '#888';
        ctx.font = '24px "Space Grotesk", sans-serif';
        ctx.fillText(`收益报告  ·  ${today}`, width / 2, 145);

        // Divider line
        ctx.strokeStyle = 'rgba(245, 190, 75, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(100, 180);
        ctx.lineTo(width - 100, 180);
        ctx.stroke();

        // Main stat: Net Profit
        const netColor = totalNet >= 0 ? '#4ade80' : '#f87171';
        ctx.fillStyle = netColor;
        ctx.font = 'bold 96px "Space Grotesk", sans-serif';
        ctx.fillText(`${totalNet >= 0 ? '+' : ''}$${totalNet.toFixed(2)}`, width / 2, 300);

        ctx.fillStyle = '#aaa';
        ctx.font = '28px "Space Grotesk", sans-serif';
        ctx.fillText('今日净利润', width / 2, 350);

        // Stats grid
        const statsY = 450;
        const stats = [
            { label: '总收益', value: `$${totalRev.toFixed(2)}`, color: '#F5BE4B' },
            { label: '总磨损', value: `$${totalCost.toFixed(2)}`, color: '#f87171' },
            { label: '账号数', value: `${accounts.length}`, color: '#60a5fa' },
            { label: '总积分', value: `${totalScore}`, color: '#a78bfa' },
        ];

        const colWidth = (width - 160) / 4;
        stats.forEach((stat, i) => {
            const x = 80 + colWidth * i + colWidth / 2;

            // Value
            ctx.fillStyle = stat.color;
            ctx.font = 'bold 36px "Space Grotesk", sans-serif';
            ctx.fillText(stat.value, x, statsY);

            // Label
            ctx.fillStyle = '#888';
            ctx.font = '18px "Space Grotesk", sans-serif';
            ctx.fillText(stat.label, x, statsY + 35);
        });

        // Monthly stats section
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(60, 530, width - 120, 200);

        ctx.fillStyle = '#666';
        ctx.font = '20px "Space Grotesk", sans-serif';
        ctx.fillText(`本月统计  ·  ${dashboardStats.selectedMonth}`, width / 2, 570);

        const monthStats = [
            { label: '月收益', value: `$${dashboardStats.monthRev.toFixed(0)}` },
            { label: '月磨损', value: `$${dashboardStats.monthCost.toFixed(0)}` },
            { label: '月净利', value: `$${dashboardStats.monthNet.toFixed(0)}` },
            { label: 'ROI', value: `${dashboardStats.roi.toFixed(0)}%` },
        ];

        const monthColWidth = (width - 160) / 4;
        monthStats.forEach((stat, i) => {
            const x = 80 + monthColWidth * i + monthColWidth / 2;

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 32px "Space Grotesk", sans-serif';
            ctx.fillText(stat.value, x, 650);

            ctx.fillStyle = '#888';
            ctx.font = '16px "Space Grotesk", sans-serif';
            ctx.fillText(stat.label, x, 690);
        });

        // Load and draw logo watermark
        const logoImg = new window.Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = logoIcon;

        await new Promise((resolve) => {
            logoImg.onload = resolve;
            logoImg.onerror = resolve;
        });

        // Watermark area at bottom
        const wmY = height - 120;

        // Draw logo icon
        const logoSize = 60;
        ctx.globalAlpha = 0.8;
        ctx.drawImage(logoImg, width / 2 - logoSize / 2, wmY - 30, logoSize, logoSize);
        ctx.globalAlpha = 1;

        // AlphaDash text below logo
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = 'bold 20px "Space Grotesk", sans-serif';
        ctx.fillText('AlphaDash', width / 2, wmY + 55);

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '14px "Space Grotesk", sans-serif';
        ctx.fillText('Your Private Alpha Tracker', width / 2, wmY + 80);

        // Convert to image and download
        canvas.toBlob((blob) => {
            if (!blob) {
                alert('海报生成失败');
                return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `BINANCE_ALPHA_${today}.png`;
            link.click();
            URL.revokeObjectURL(url);
            alert('✅ 收益海报已生成！\n\n分享到推特展示您的 Alpha 收益！');
        }, 'image/png');
    };

    // --- UNLOCK HANDLERS ---
    const TWITTER_URL = 'https://x.com/ddudjy';

    const openUnlockModal = () => {
        setUnlockStep('prompt');
        setUploadedImage(null);
        setUnlockModalOpen(true);
    };

    const handleFollowClick = () => {
        window.open(TWITTER_URL, '_blank');
        setUnlockStep('upload');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setUploadedImage(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleVerifyScreenshot = () => {
        if (!uploadedImage) {
            alert('请先上传关注截图');
            return;
        }
        setUnlockStep('verifying');
        // Fake verification - 2 second delay then success
        setTimeout(() => {
            setUnlockStep('success');
            setIsProUnlocked(true);
            setUnlockStatus(true);

            // Persist to Firestore if logged in
            if (user && !user.isLocal && db) {
                const userDocRef = doc(db, 'users', user.uid);
                setDoc(userDocRef, { isProUnlocked: true }, { merge: true })
                    .catch(e => console.error('Error saving unlock status:', e));
            }
        }, 2000);
    };

    const closeUnlockModal = () => {
        setUnlockModalOpen(false);
        setUnlockStep('prompt');
        setUploadedImage(null);
    };

    // Show loading during auth check
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
                <Loader2 className="animate-spin" size={40} style={{ color: COLORS.primary }} />
            </div>
        );
    }

    // Check if user is using local storage (not logged in)
    const isLocalUser = user?.isLocal === true;

    return (
        <div className="min-h-screen font-sans pb-20 md:pb-0" style={{ fontFamily: "'Space Grotesk', 'Noto Sans SC', sans-serif", backgroundColor: COLORS.bg, color: COLORS.textPrimary }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');`}</style>

            {/* HEADER */}
            <header className="sticky top-0 z-30 px-8 py-4 flex justify-between items-center border-b" style={{ backgroundColor: COLORS.bg, borderColor: `${COLORS.textSecondary}20` }}>
                <div className="flex items-center gap-3 cursor-pointer hover:scale-105 transition-transform">
                    <img src={logoIcon} alt="AlphaDash Icon" className="h-12 md:h-16 w-auto object-contain" />
                    <img src={logoText} alt="AlphaDash Text" className="hidden md:block h-10 w-auto object-contain mt-1" />
                </div>
                <div className="flex gap-4">
                    <div className="hidden md:flex rounded-full p-1.5 shadow-sm border border-white" style={{ backgroundColor: COLORS.card }}>
                        <NavBtn label="看板" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Monitor size={16} />} />
                        <NavBtn label="报表" active={activeTab === 'report'} onClick={() => setActiveTab('report')} icon={<PieChart size={16} />} />
                    </div>
                    <button onClick={() => setImportModalOpen(true)} className="p-3 hover:shadow-md rounded-full transition-all border border-white" style={{ backgroundColor: COLORS.card }} title="导入数据">
                        <FileUp size={20} style={{ color: COLORS.primary }} />
                    </button>
                    {/* Export Button with Dropdown */}
                    <div className="relative">
                        <button onClick={() => setExportMenuOpen(!exportMenuOpen)} className="p-3 hover:shadow-md rounded-full transition-all border border-white" style={{ backgroundColor: COLORS.card }} title="导出数据">
                            <Download size={20} style={{ color: COLORS.profit }} />
                        </button>
                        {exportMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 rounded-xl shadow-lg border overflow-hidden z-50" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20`, minWidth: '180px' }}>
                                <button onClick={downloadTemplate} className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors" style={{ color: COLORS.textPrimary }}>
                                    <span className="w-8 h-5 rounded text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: COLORS.costLight, color: COLORS.cost }}>模板</span>
                                    上传模板
                                </button>
                                <button onClick={exportToCSV} className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors border-t" style={{ color: COLORS.textPrimary, borderColor: `${COLORS.textSecondary}10` }}>
                                    <span className="w-8 h-5 rounded text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: COLORS.profitLight, color: COLORS.profit }}>CSV</span>
                                    Excel / 表格
                                </button>
                                <button onClick={exportToJSON} className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors border-t" style={{ color: COLORS.textPrimary, borderColor: `${COLORS.textSecondary}10` }}>
                                    <span className="w-8 h-5 rounded text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: COLORS.revenueLight, color: COLORS.revenue }}>JSON</span>
                                    数据备份
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Share Poster Button */}
                    <button
                        onClick={generatePoster}
                        className="p-3 hover:shadow-md rounded-full transition-all border border-white hover:scale-105"
                        style={{ backgroundColor: COLORS.card }}
                        title="生成收益海报"
                    >
                        <Share2 size={20} style={{ color: '#a855f7' }} />
                    </button>
                    {/* Pro Unlock Button */}
                    {!isProUnlocked ? (
                        <button
                            onClick={openUnlockModal}
                            className="p-3 hover:shadow-md rounded-full transition-all border border-white relative group"
                            style={{ backgroundColor: COLORS.card }}
                            title="解锁 Pro 功能"
                        >
                            <Gift size={20} style={{ color: COLORS.revenue }} />
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white animate-pulse" style={{ backgroundColor: COLORS.loss }}>!</span>
                        </button>
                    ) : (
                        <button
                            className="p-3 hover:shadow-md rounded-full transition-all border border-white"
                            style={{ backgroundColor: COLORS.card }}
                            title="Pro 已解锁"
                        >
                            <Star size={20} style={{ color: COLORS.revenue }} fill={COLORS.revenue} />
                        </button>
                    )}
                    <button onClick={clearAllData} className="p-3 hover:shadow-md rounded-full transition-all border border-white hover:bg-red-50" style={{ backgroundColor: COLORS.card }} title="清空所有数据">
                        <Trash2 size={20} style={{ color: COLORS.loss }} />
                    </button>
                    {/* Login/Logout Button */}
                    {isLocalUser ? (
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="px-4 py-2 rounded-full font-bold text-sm transition-all hover:scale-105 flex items-center gap-2"
                            style={{ backgroundColor: COLORS.primary, color: 'white' }}
                        >
                            登录 / 注册
                        </button>
                    ) : user && !isDemoMode && (
                        <button onClick={handleLogout} className="p-3 hover:shadow-md rounded-full transition-all border border-white hover:bg-gray-100" style={{ backgroundColor: COLORS.card }} title={`退出登录 (${user.email || user.displayName || '用户'})`}>
                            <X size={20} style={{ color: COLORS.textSecondary }} />
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in-up">
                        {/* 1. HERO CARDS (Morandi) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <BentoCard title="总收益" value={Math.round(dashboardStats.monthRev)} icon={<DollarSign size={20} className="text-white" />} iconBg={COLORS.revenue} sub="Gross" />
                            <BentoCard title="净利润" value={Math.round(dashboardStats.monthNet)} icon={<TrendingUp size={20} className="text-white" />} iconBg={dashboardStats.monthNet >= 0 ? COLORS.profit : COLORS.loss} sub="Net" valueColor={dashboardStats.monthNet >= 0 ? COLORS.profit : COLORS.loss} />
                            <BentoCard title="总磨损" value={Math.round(dashboardStats.monthCost)} icon={<TrendingDown size={20} className="text-white" />} iconBg={COLORS.cost} sub="Cost" valueColor={COLORS.cost} />
                            <BentoCard title="ROI" value={`${dashboardStats.roi.toFixed(0)}%`} icon={<Percent size={20} className="text-white" />} iconBg={COLORS.primary} sub="Return" valueColor={COLORS.primary} />
                        </div>

                        {/* 2. DUAL CHARTS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Clustered Column + Line */}
                            <div className="rounded-[40px] p-8 shadow-sm border hover:shadow-lg transition-all duration-500 h-full" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20` }}>
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="font-bold flex items-center gap-2 text-lg" style={{ color: COLORS.textPrimary }}><BarChart3 size={20} style={{ color: COLORS.revenue }} /> 近30天盈亏明细</h3>
                                </div>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={recent30Charts} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                                            <XAxis dataKey="date" tickFormatter={d => d.slice(8)} tick={{ fontSize: 11, fill: COLORS.textSecondary, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} interval={2} />
                                            <YAxis tick={{ fontSize: 11, fill: COLORS.textSecondary, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} />
                                            <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', fontFamily: 'Space Grotesk' }} />
                                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                                            <Bar dataKey="rev" name="收益" fill={COLORS.revenue} radius={[4, 4, 4, 4]} barSize={8} />
                                            <Bar dataKey="cost" name="磨损" fill={COLORS.cost} radius={[4, 4, 4, 4]} barSize={8} />
                                            <Line type="monotone" dataKey="net" name="净利" stroke={COLORS.profit} strokeWidth={3} dot={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* All-Time Cumulative (Weekly) */}
                            <div className="rounded-[40px] p-8 shadow-sm border hover:shadow-lg transition-all duration-500 h-full" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20` }}>
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="font-bold flex items-center gap-2 text-lg" style={{ color: COLORS.textPrimary }}>
                                        <LineChart size={20} style={{ color: COLORS.primary }} />
                                        累计净值 {firstDate && lastDate ? `(${firstDate.replaceAll('-', '.')} - ${lastDate.replaceAll('-', '.')})` : ''}
                                    </h3>
                                </div>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={weeklyCharts} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.textSecondary, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} minTickGap={30} />
                                            <YAxis tick={{ fontSize: 11, fill: COLORS.textSecondary, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} />
                                            <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', fontFamily: 'Space Grotesk' }} />
                                            <Area type="monotone" dataKey="accNet" stroke={COLORS.primary} fillOpacity={1} fill="url(#colorAcc)" strokeWidth={3} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* 3. CALENDAR & SCOREBOARD */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 rounded-[40px] p-6 shadow-sm border hover:shadow-lg transition-all h-full" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20` }}>
                                <CalendarHeatmap records={records} selectedDate={selectedDate} onDateClick={setSelectedDate} />
                            </div>
                            <div className="rounded-[40px] p-6 shadow-sm border hover:shadow-lg transition-all flex flex-col h-full" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20` }}>
                                <LiveScoreBoard
                                    accountScores={accountScores} records={records} user={user} db={db}
                                    date={selectedDate} onSave={() => fetchRecords(user.uid)} isDemoMode={isDemoMode}
                                />
                            </div>
                        </div>

                        {/* 4. ACCOUNT MANAGEMENT */}
                        <div className="rounded-[32px] p-5 shadow-sm border flex items-center justify-between gap-4 flex-wrap" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20` }}>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-lg" style={{ color: COLORS.textPrimary }}>账号管理</span>
                                <span className="text-sm px-4 py-1.5 rounded-full font-bold" style={{ backgroundColor: `${COLORS.primary}20`, color: COLORS.primary }}>
                                    当前 {accounts.length} 个账号
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={removeAccount}
                                    disabled={accounts.length <= 1}
                                    className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                                    style={{ backgroundColor: `${COLORS.loss}20`, color: COLORS.loss }}
                                >
                                    - 删除账号
                                </button>
                                <button
                                    onClick={addAccount}
                                    disabled={accounts.length >= 50}
                                    className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 disabled:opacity-50"
                                    style={{ backgroundColor: `${COLORS.profit}20`, color: COLORS.profit }}
                                >
                                    + 添加账号
                                </button>
                                <div className="flex items-center gap-3 ml-2">
                                    <span className="text-sm font-bold" style={{ color: COLORS.textSecondary }}>设置数量:</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={accounts.length}
                                        onChange={e => setAccountCount(parseInt(e.target.value) || 1)}
                                        className="w-20 px-3 py-2 rounded-lg border text-center font-bold text-sm outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                                        style={{ borderColor: `${COLORS.textSecondary}30`, color: COLORS.textPrimary }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 5. ENTRY FORM & HISTORY STATS */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-stretch">
                            {/* BatchEntry - narrower on left */}
                            <div className="md:col-span-3 h-full">
                                <BatchEntry
                                    accounts={accounts} records={records} user={user} db={db}
                                    onSave={() => fetchRecords(user.uid)}
                                    date={selectedDate} onDateChange={setSelectedDate} isDemoMode={isDemoMode}
                                />
                            </div>
                            {/* HistoryStats - new panel on right */}
                            <div className="md:col-span-2 h-full">
                                <HistoryStats accounts={accounts} records={records} />
                            </div>
                        </div>
                    </div>
                )
                }

                {/* REPORT TAB */}
                {
                    activeTab === 'report' && (
                        <Suspense fallback={
                            <div className="flex items-center justify-center h-64" style={{ color: COLORS.textSecondary }}>
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="animate-spin" size={24} />
                                    <span className="text-sm font-medium">Loading report...</span>
                                </div>
                            </div>
                        }>
                            <ReportView records={records} />
                        </Suspense>
                    )
                }
            </main >

            {/* BRAND FOOTER - NEW */}
            {/* BRAND FOOTER - NEW */}
            <div className="text-center py-8 opacity-40 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4" style={{ color: COLORS.textSecondary }}>
                <div className="grayscale hover:grayscale-0 transition-all duration-500">
                    <img src={logoIcon} alt="AlphaDash Icon" className="h-12 w-auto object-contain" />
                </div>
                <div className="text-[10px] font-medium tracking-[0.3em] opacity-50 uppercase">Alpha Tracker</div>
            </div>

            {/* MOBILE NAV */}
            < div className="fixed bottom-6 left-1/2 -translate-x-1/2 backdrop-blur-xl border border-white/50 px-6 py-3 rounded-full flex gap-10 shadow-2xl shadow-slate-200/50 md:hidden z-40" style={{ backgroundColor: `${COLORS.card}CC` }}>
                <button onClick={() => setActiveTab('dashboard')} className="transition-all" style={{ color: activeTab === 'dashboard' ? COLORS.primary : COLORS.textSecondary }}><Monitor size={24} /></button>
                <button onClick={() => setActiveTab('report')} className="transition-all" style={{ color: activeTab === 'report' ? COLORS.primary : COLORS.textSecondary }}><PieChart size={24} /></button>
            </div >

            {/* IMPORT MODAL */}
            {
                importModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="rounded-[32px] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-scale-in" style={{ backgroundColor: COLORS.card }}>
                            <div className="flex justify-between items-center p-6 border-b" style={{ borderColor: `${COLORS.textSecondary}20` }}>
                                <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: COLORS.textPrimary }}>批量导入向导</h3>
                                <button onClick={() => setImportModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
                            </div>
                            {step === 'paste' && (
                                <div className="flex-1 p-8 flex flex-col gap-6">
                                    <textarea className="flex-1 border-2 rounded-2xl p-6 font-mono text-xs focus:outline-none resize-none transition-all" style={{ backgroundColor: COLORS.bg, borderColor: `${COLORS.textSecondary}20`, color: COLORS.textPrimary }} placeholder="在此处直接粘贴 Excel 数据 (Ctrl+V)..." value={pasteContent} onChange={e => setPasteContent(e.target.value)} />
                                    <div className="flex justify-between items-center">
                                        <button
                                            onClick={insertDemoData}
                                            className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-md border-2 border-dashed"
                                            style={{ backgroundColor: `${COLORS.revenue}15`, borderColor: COLORS.revenue, color: COLORS.revenue }}
                                        >
                                            <Gift size={18} />
                                            导入测试数据
                                        </button>
                                        <button onClick={handleParseRaw} disabled={isParsing} className="text-white px-8 py-3 rounded-xl font-bold hover:scale-105 transition-all flex items-center gap-2" style={{ backgroundColor: COLORS.primary }}>
                                            {isParsing ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                                            {isParsing ? '解析中...' : '解析数据'}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {step === 'preview' && (
                                <div className="flex-1 flex flex-col gap-6 overflow-hidden p-8">
                                    <div className="flex-1 overflow-auto border rounded-2xl" style={{ borderColor: `${COLORS.textSecondary}20`, backgroundColor: COLORS.bg }}>
                                        <table className="w-full text-xs text-left">
                                            <thead className="sticky top-0 shadow-sm z-10" style={{ backgroundColor: COLORS.card }}>
                                                <tr><th className="p-4">日期</th><th className="p-4">账号</th><th className="p-4">积分</th><th className="p-4">磨损</th><th className="p-4">收益</th></tr>
                                            </thead>
                                            <tbody className="divide-y" style={{ borderColor: `${COLORS.textSecondary}10` }}>
                                                {parsedRecords.map((r, i) => (
                                                    <tr key={i}>
                                                        <td className="p-4"><input className="bg-transparent w-24 outline-none border-b border-transparent focus:border-blue-500 transition-colors" value={r.date} onChange={e => {
                                                            const newRecs = [...parsedRecords]; newRecs[i].date = e.target.value; setParsedRecords(newRecs);
                                                        }} /></td>
                                                        <td className="p-4 font-bold">{r.accountId}</td>
                                                        <td className="p-4"><input type="number" className="bg-transparent w-16 outline-none border-b border-transparent focus:border-blue-500 transition-colors" value={r.score} onChange={e => {
                                                            const newRecs = [...parsedRecords]; newRecs[i].score = parseFloat(e.target.value) || 0; setParsedRecords(newRecs);
                                                        }} /></td>
                                                        <td className="p-4" style={{ color: COLORS.loss }}>{r.cost.toFixed(2)}</td>
                                                        <td className="p-4">
                                                            <input type="number" className="bg-transparent w-16 outline-none border-b border-transparent focus:border-emerald-500 transition-colors" style={{ color: COLORS.profit }} value={r.revenue} onChange={e => {
                                                                const newRecs = [...parsedRecords];
                                                                newRecs[i].revenue = parseFloat(e.target.value) || 0;
                                                                newRecs[i].net = (newRecs[i].revenue || 0) - (newRecs[i].cost || 0);
                                                                setParsedRecords(newRecs);
                                                            }} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <button onClick={() => setStep('paste')} className="px-6 py-3 border rounded-xl font-bold" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20`, color: COLORS.textSecondary }}>返回</button>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs font-bold" style={{ color: COLORS.textSecondary }}>共 {parsedRecords.length} 条数据 (可直接修改)</span>
                                            <button onClick={commitToDb} disabled={isImporting} className="px-8 py-3 text-white rounded-xl font-bold shadow-lg transition-all flex items-center gap-2" style={{ backgroundColor: COLORS.profit }}>
                                                {isImporting && <Loader2 className="animate-spin" size={18} />}
                                                {isImporting ? '导入中...' : '确认导入'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* UNLOCK PRO MODAL */}
            {unlockModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in" style={{ backgroundColor: COLORS.card }}>
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b" style={{ borderColor: `${COLORS.textSecondary}20` }}>
                            <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
                                <Gift size={24} style={{ color: COLORS.revenue }} />
                                解锁 Pro 功能
                            </h3>
                            <button onClick={closeUnlockModal} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
                        </div>

                        {/* Content */}
                        <div className="p-8">
                            {unlockStep === 'prompt' && (
                                <div className="text-center space-y-6">
                                    <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${COLORS.primary}15` }}>
                                        <Twitter size={40} style={{ color: COLORS.primary }} />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold mb-2" style={{ color: COLORS.textPrimary }}>关注官方推特，免费解锁</h4>
                                        <p className="text-sm" style={{ color: COLORS.textSecondary }}>关注我们的 Twitter 账号即可永久解锁全部 Pro 功能！</p>
                                    </div>
                                    <button
                                        onClick={handleFollowClick}
                                        className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-lg"
                                        style={{ backgroundColor: '#1DA1F2' }}
                                    >
                                        <Twitter size={20} />
                                        关注 @ddudjy
                                        <ExternalLink size={16} />
                                    </button>
                                    <p className="text-xs" style={{ color: COLORS.textSecondary }}>点击后会在新窗口打开 Twitter</p>
                                </div>
                            )}

                            {unlockStep === 'upload' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <CheckCircle size={48} className="mx-auto mb-3" style={{ color: COLORS.profit }} />
                                        <h4 className="text-lg font-bold mb-2" style={{ color: COLORS.textPrimary }}>太棒了！请上传关注截图</h4>
                                        <p className="text-sm" style={{ color: COLORS.textSecondary }}>上传您的关注截图以完成验证</p>
                                    </div>

                                    <label className="block cursor-pointer">
                                        <div
                                            className="border-2 border-dashed rounded-2xl p-8 text-center hover:border-blue-400 transition-colors"
                                            style={{ borderColor: uploadedImage ? COLORS.profit : `${COLORS.textSecondary}40` }}
                                        >
                                            {uploadedImage ? (
                                                <div className="space-y-3">
                                                    <img src={uploadedImage} alt="Screenshot" className="max-h-40 mx-auto rounded-lg shadow-md" />
                                                    <p className="text-sm font-medium" style={{ color: COLORS.profit }}>✓ 截图已上传，点击可更换</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <Upload size={40} className="mx-auto" style={{ color: COLORS.textSecondary }} />
                                                    <p className="text-sm" style={{ color: COLORS.textSecondary }}>点击上传截图</p>
                                                </div>
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                    </label>

                                    <button
                                        onClick={handleVerifyScreenshot}
                                        disabled={!uploadedImage}
                                        className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-lg disabled:opacity-50 disabled:hover:scale-100"
                                        style={{ backgroundColor: COLORS.profit }}
                                    >
                                        <Star size={20} />
                                        验证并解锁
                                    </button>
                                </div>
                            )}

                            {unlockStep === 'verifying' && (
                                <div className="text-center py-8 space-y-6">
                                    <Loader2 size={60} className="mx-auto animate-spin" style={{ color: COLORS.primary }} />
                                    <div>
                                        <h4 className="text-lg font-bold mb-2" style={{ color: COLORS.textPrimary }}>AI 正在核验截图...</h4>
                                        <p className="text-sm" style={{ color: COLORS.textSecondary }}>请稍候，正在验证您的关注状态</p>
                                    </div>
                                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
                                        <div className="h-full rounded-full animate-pulse" style={{ backgroundColor: COLORS.primary, width: '60%', animation: 'pulse 1s ease-in-out infinite' }} />
                                    </div>
                                </div>
                            )}

                            {unlockStep === 'success' && (
                                <div className="text-center py-8 space-y-6">
                                    <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${COLORS.profit}20` }}>
                                        <CheckCircle size={60} style={{ color: COLORS.profit }} />
                                    </div>
                                    <div>
                                        <h4 className="text-2xl font-bold mb-2" style={{ color: COLORS.profit }}>🎉 验证成功！</h4>
                                        <p className="text-sm" style={{ color: COLORS.textSecondary }}>Pro 功能已解锁，感谢您的支持！</p>
                                    </div>
                                    <button
                                        onClick={closeUnlockModal}
                                        className="w-full py-4 rounded-2xl font-bold text-white hover:scale-105 transition-transform shadow-lg"
                                        style={{ backgroundColor: COLORS.profit }}
                                    >
                                        开始使用
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* AUTH MODAL */}
            {showAuthModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative w-full max-w-md animate-scale-in">
                        <button
                            onClick={() => setShowAuthModal(false)}
                            className="absolute -top-3 -right-3 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 z-10"
                        >
                            <X size={20} style={{ color: COLORS.textSecondary }} />
                        </button>
                        <Suspense fallback={
                            <div className="rounded-[32px] p-8 flex items-center justify-center" style={{ backgroundColor: COLORS.card }}>
                                <Loader2 className="animate-spin" size={40} style={{ color: COLORS.primary }} />
                            </div>
                        }>
                            <AuthPage auth={auth} onAuthSuccess={handleAuthSuccess} />
                        </Suspense>
                    </div>
                </div>
            )}
        </div >
    );
}

// --- BENTO UI COMPONENTS ---

function BentoCard({ title, value, icon, sub, iconBg, valueColor }: any) {
    return (
        <div className={`rounded-[32px] p-6 shadow-sm border hover:shadow-lg transition-all duration-300 group relative overflow-hidden h-full`} style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20` }}>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 rounded-2xl" style={{ backgroundColor: `${iconBg}30`, color: iconBg }}>{React.cloneElement(icon, { className: '', style: { color: iconBg } })}</div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 px-2 py-1 rounded-lg" style={{ backgroundColor: COLORS.bg, color: COLORS.textSecondary }}>{sub}</span>
                </div>
                <div className="text-3xl font-black tracking-tighter" style={{ fontFamily: 'Space Grotesk', color: valueColor || COLORS.textPrimary }}>{value}</div>
                <div className="text-xs font-medium mt-1 opacity-70" style={{ color: COLORS.textSecondary }}>{title}</div>
            </div>
        </div>
    )
}

function LiveScoreBoard({ accountScores, records, user, db, date, onSave, isDemoMode }: any) {
    const [edits, setEdits] = useState<{ [key: string]: string }>({});
    const handleScoreChange = (accId: string, val: string) => setEdits(prev => ({ ...prev, [accId]: val }));
    const handleBlur = async (accId: string) => {
        const valStr = edits[accId];
        if (valStr === undefined) return;
        const score = parseFloat(valStr) || 0;
        const todayRec = records.find((r: any) => r.accountId === accId && r.date === date);
        const newData = { date, accountId: accId, score, balance: todayRec?.balance || 0, revenue: todayRec?.revenue || 0, cost: todayRec?.cost || 0, net: todayRec?.net || 0 };
        try {
            if (isDemoMode) saveLocalBatch([newData]);
            else if (db) await setDoc(doc(db, `users/${user.uid}/daily_records`, `${date}_${accId}`), newData);
            onSave();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold flex items-center gap-2" style={{ color: COLORS.textPrimary }}><CheckCircle style={{ color: COLORS.profit }} size={18} /> 积分看板</h3>
                <span className="text-[10px] font-bold" style={{ color: COLORS.textSecondary }}>15天滚动</span>
            </div>
            <div className="grid grid-cols-4 text-[10px] font-bold mb-2 px-3 tracking-wide" style={{ color: COLORS.textSecondary }}>
                <span>账号</span><span className="text-center">昨日</span><span className="text-center">当前</span><span className="text-right">明日预估</span>
            </div>
            <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
                {accountScores.map((acc: any) => {
                    // Dynamic padding: fewer accounts = more padding to fill space  
                    const rowPadding = accountScores.length <= 8 ? 'py-4' : accountScores.length <= 15 ? 'py-3' : accountScores.length <= 25 ? 'py-2' : 'py-1.5';
                    return (
                        <div key={acc.id} className={`grid grid-cols-4 ${rowPadding} px-3 rounded-xl border border-transparent hover:shadow-sm transition-all group`} style={{ backgroundColor: `${COLORS.bg}60` }}>
                            <div className="font-bold text-sm" style={{ color: COLORS.textPrimary }}>{acc.id}</div>
                            <div className="text-center font-mono text-sm tabular-nums" style={{ color: COLORS.textSecondary }}>{acc.yesterdayTotal}</div>
                            <div className="text-center font-mono font-bold text-sm tabular-nums" style={{ color: COLORS.textPrimary }}>
                                {acc.currentTotal}
                                <input
                                    type="number"
                                    className="ml-2 w-10 h-5 text-[10px] text-center border rounded focus:border-blue-500 outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}40` }}
                                    value={edits[acc.id] !== undefined ? edits[acc.id] : acc.dailyScore}
                                    onChange={e => handleScoreChange(acc.id, e.target.value)}
                                    onBlur={() => handleBlur(acc.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleBlur(acc.id)}
                                />
                            </div>
                            <div className="text-right font-bold font-mono text-sm tabular-nums" style={{ color: acc.nextDayScore < acc.currentTotal ? COLORS.accent : COLORS.textSecondary }}>
                                {acc.nextDayScore}
                                {acc.dropReason && <span className="text-[8px] ml-1 whitespace-nowrap" style={{ color: COLORS.accent }}>{acc.dropReason}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}

// New component for historical stats
function HistoryStats({ accounts, records }: { accounts: string[], records: Record[] }) {
    const stats = useMemo(() => {
        // Calculate totals for all accounts
        let totalRevenue = 0, totalCost = 0, totalNet = 0, totalAirdrops = 0;
        const perAccount: { [key: string]: { revenue: number; cost: number; net: number; airdrops: number } } = {};

        accounts.forEach(acc => {
            perAccount[acc] = { revenue: 0, cost: 0, net: 0, airdrops: 0 };
        });

        records.forEach(r => {
            totalRevenue += r.revenue || 0;
            totalCost += r.cost || 0;
            totalNet += r.net || 0;
            if ((r.revenue || 0) > 0) totalAirdrops++;

            if (perAccount[r.accountId]) {
                perAccount[r.accountId].revenue += r.revenue || 0;
                perAccount[r.accountId].cost += r.cost || 0;
                perAccount[r.accountId].net += r.net || 0;
                if ((r.revenue || 0) > 0) perAccount[r.accountId].airdrops++;
            }
        });

        return { totalRevenue, totalCost, totalNet, totalAirdrops, perAccount };
    }, [accounts, records]);

    // Chart data: show all accounts to reflect current configuration
    const chartData = useMemo(() => {
        return accounts.map(acc => ({
            name: acc.replace('号', ''),  // Shorten label: "1号" -> "1"
            net: stats.perAccount[acc].net
        }));
    }, [accounts, stats]);

    return (
        <div className="rounded-[32px] p-6 shadow-sm border hover:shadow-lg transition-all duration-300 h-full flex flex-col" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20` }}>
            <h3 className="font-bold flex items-center gap-2 mb-4" style={{ color: COLORS.textPrimary }}>
                <BarChart3 style={{ color: COLORS.primary }} size={18} /> 历史总数据
            </h3>

            {/* Total Summary - Single Row */}
            <div className="grid grid-cols-4 gap-4 mb-6 p-4 rounded-2xl items-center" style={{ backgroundColor: COLORS.bg }}>
                <div className="text-center border-r" style={{ borderColor: `${COLORS.textSecondary}20` }}>
                    <div className="text-[12px] font-bold mb-1 opacity-60">总收益</div>
                    <div className="text-lg font-bold font-mono" style={{ color: COLORS.profit }}>${stats.totalRevenue.toFixed(0)}</div>
                </div>
                <div className="text-center border-r" style={{ borderColor: `${COLORS.textSecondary}20` }}>
                    <div className="text-[12px] font-bold mb-1 opacity-60">总磨损</div>
                    <div className="text-lg font-bold font-mono" style={{ color: COLORS.loss }}>${stats.totalCost.toFixed(0)}</div>
                </div>
                <div className="text-center border-r" style={{ borderColor: `${COLORS.textSecondary}20` }}>
                    <div className="text-[12px] font-bold mb-1 opacity-60">总净利润</div>
                    <div className="text-lg font-bold font-mono" style={{ color: stats.totalNet >= 0 ? COLORS.profit : COLORS.loss }}>
                        ${stats.totalNet.toFixed(0)}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-[12px] font-bold mb-1 opacity-60">空投次数</div>
                    <div className="text-lg font-bold font-mono" style={{ color: COLORS.primary }}>{stats.totalAirdrops}</div>
                </div>
            </div>

            {/* Per Account Stats Header */}
            <div className="grid grid-cols-5 items-center py-2.5 px-4 text-xs font-bold uppercase tracking-wider rounded-lg mb-2" style={{ color: COLORS.textSecondary, backgroundColor: `${COLORS.bg}80` }}>
                <span>账号</span><span className="text-right">收益</span><span className="text-right">磨损</span><span className="text-right">净利</span><span className="text-right">空投</span>
            </div>

            {/* Per Account Stats Data - Dynamic row height based on account count */}
            <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto min-h-0 mb-4">
                {accounts.map(acc => {
                    const s = stats.perAccount[acc];
                    // Dynamic padding: fewer accounts = more padding to fill space
                    const rowPadding = accounts.length <= 10 ? 'py-4' : accounts.length <= 20 ? 'py-3' : accounts.length <= 35 ? 'py-2' : 'py-1.5';
                    return (
                        <div key={acc} className={`grid grid-cols-5 items-center ${rowPadding} px-4 text-sm hover:bg-black/5 transition-all rounded-lg cursor-default group`}>
                            <span className="font-bold flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.net >= 0 ? COLORS.profit : COLORS.loss }}></div>
                                {acc}
                            </span>
                            <span className="text-right font-mono tabular-nums opacity-80" style={{ color: COLORS.textPrimary }}>{s.revenue.toFixed(0)}</span>
                            <span className="text-right font-mono tabular-nums opacity-60">{s.cost.toFixed(0)}</span>
                            <span className="text-right font-mono font-bold tabular-nums" style={{ color: s.net >= 0 ? COLORS.profit : COLORS.loss }}>{s.net.toFixed(0)}</span>
                            <span className="text-right font-mono tabular-nums opacity-60">{s.airdrops}</span>
                        </div>
                    );
                })}
            </div>

            {/* Visual Chart at Bottom */}
            <div className="h-36 w-full mt-auto pt-3 border-t" style={{ borderColor: `${COLORS.textSecondary}10` }}>
                <div className="text-[10px] font-bold mb-0 text-center opacity-50">净利润分布</div>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: COLORS.textSecondary }}
                            interval="preserveStartEnd"
                        />
                        <Bar dataKey="net" radius={[4, 4, 4, 4]} barSize={20}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.net >= 0 ? COLORS.profit : COLORS.loss} />
                            ))}
                        </Bar>
                        <RechartsTooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                            formatter={(value: any) => [`$${parseFloat(value).toFixed(0)}`, '净利']}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function CalendarHeatmap({ records, selectedDate, onDateClick }: { records: Record[], selectedDate?: string, onDateClick?: (date: string) => void }) {
    const [viewDate, setViewDate] = useState(new Date());
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = new Date(year, month, 1).getDay();

    const dailyNet = useMemo(() => {
        const map = new Map<number, number>();
        records.forEach(r => {
            const d = new Date(r.date);
            if (d.getFullYear() === year && d.getMonth() === month) { map.set(d.getDate(), (map.get(d.getDate()) || 0) + r.net); }
        });
        return map;
    }, [records, year, month]);

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
        // Auto-update selectedDate to first day of new month to sync parent stats
        if (onDateClick) {
            const newYear = newDate.getFullYear();
            const newMonth = newDate.getMonth();
            const dateStr = `${newYear}-${String(newMonth + 1).padStart(2, '0')}-01`;
            onDateClick(dateStr);
        }
    };

    const handleDateClick = (day: number) => {
        if (onDateClick) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            onDateClick(dateStr);
        }
    };

    // Check if a day is the selected date
    const isSelected = (day: number) => {
        if (!selectedDate) return false;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return dateStr === selectedDate;
    };

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`}></div>);
    for (let d = 1; d <= daysInMonth; d++) {
        const net = dailyNet.get(d);
        const selected = isSelected(d);
        let bg = COLORS.bg;
        if (net !== undefined) {
            if (net > 0) { bg = net > 100 ? COLORS.profit : COLORS.profitLight; }
            else if (net < 0) { bg = net < -50 ? COLORS.loss : COLORS.lossLight; }
        }
        days.push(
            <div
                key={d}
                onClick={() => handleDateClick(d)}
                className={`h-full w-full aspect-square rounded-[10px] flex flex-col items-center justify-center relative group cursor-pointer transition-all hover:scale-105 ${selected ? 'ring-2 ring-amber-500 ring-offset-1' : ''}`}
                style={{ backgroundColor: bg }}
            >
                <span className="text-base font-bold" style={{ color: net && Math.abs(net) > 50 ? 'white' : COLORS.textPrimary }}>{d}</span>
                {net !== undefined && (
                    <span className="text-xs font-mono leading-none mt-0.5" style={{ color: net && Math.abs(net) > 50 ? 'white' : (net > 0 ? COLORS.profit : COLORS.loss) }}>
                        {net > 0 ? '+' : ''}{net.toFixed(0)}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full justify-center">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold flex items-center gap-2" style={{ color: COLORS.textPrimary }}><CalendarIcon style={{ color: COLORS.revenue }} size={18} /> 盈亏日历</h3>
                <div className="flex items-center gap-1 rounded-lg p-0.5 border" style={{ backgroundColor: COLORS.bg, borderColor: `${COLORS.textSecondary}20` }}>
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white rounded shadow-sm"><ChevronLeft size={12} /></button>
                    <span className="text-[10px] font-bold w-14 text-center" style={{ color: COLORS.textSecondary }}>{year}-{String(month + 1).padStart(2, '0')}</span>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white rounded shadow-sm"><ChevronRight size={12} /></button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">{['日', '一', '二', '三', '四', '五', '六'].map((d, i) => <div key={i} className="text-center text-xs font-bold mb-1" style={{ color: COLORS.textSecondary }}>{d}</div>)}{days}</div>
        </div>
    );
}

function BatchEntry({ accounts, records, user, db, onSave, date, onDateChange, isDemoMode }: any) {
    const [grid, setGrid] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);
    const prevDate = new Date(date); prevDate.setDate(prevDate.getDate() - 1);
    const prevStr = formatDate(prevDate);

    useEffect(() => {
        const newGrid: any = {};
        accounts.forEach((acc: string) => {
            const today = records.find((r: any) => r.accountId === acc && r.date === date);
            const prev = records.find((r: any) => r.accountId === acc && r.date === prevStr);

            // Priority: 1. Manual input saved in today's record (preserve user edits!), 2. Real previous record, 3. Initial default
            let defaultPrevBal = 0;
            if (today && today.prevBalance !== undefined) {
                // User manually saved a prevBalance for today - always respect it
                defaultPrevBal = today.prevBalance;
            } else if (prev && prev.balance !== undefined) {
                // Auto-fill from yesterday's record
                defaultPrevBal = prev.balance;
            } else {
                defaultPrevBal = INITIAL_BALANCES[acc] ?? 0;
            }



            newGrid[acc] = {
                score: today?.score,
                balance: today?.balance,
                revenue: today?.revenue,
                prevBalance: defaultPrevBal,
                balanceAdjust: today?.balanceAdjust ?? 0  // 余额调整: 空投收入(正)、对外转账(负)
            };
        });
        setGrid(newGrid);
    }, [date, accounts, records, prevStr]);

    const handleChange = (acc: string, field: string, val: string) => setGrid((prev: any) => ({ ...prev, [acc]: { ...prev[acc], [field]: val } }));

    // 磨损计算: cost = 昨日余额 + 余额调整 - 今日余额
    // 余额调整: 正数 = 空投收入(增加余额), 负数 = 对外转账(减少余额)
    const dailyTotal = useMemo(() => {
        let totalCost = 0, totalNet = 0;
        accounts.forEach((acc: string) => {
            const row = grid[acc] || {};
            const prevBal = parseFloat(row.prevBalance) || 0;
            const curBal = parseFloat(row.balance) || 0;
            const adjust = parseFloat(row.balanceAdjust) || 0;
            const rev = parseFloat(row.revenue) || 0;
            // 新公式: 磨损 = 昨日余额 + 余额调整 - 今日余额
            let cost = (prevBal > 0 && curBal > 0) ? (prevBal + adjust - curBal) : 0;
            totalCost += cost; totalNet += (rev - cost);
        });
        return { totalCost, totalNet };
    }, [grid, accounts]);

    const handleSave = async () => {
        if (!user) {
            alert("请先登录");
            return;
        }
        setIsSaving(true);
        try {
            const batchData: Record[] = [];
            accounts.forEach((acc: string) => {
                const row = grid[acc];
                if (!row) return;
                const scoreVal = row.score !== undefined && row.score !== '' ? parseFloat(row.score) : 0;
                const balanceVal = row.balance !== undefined && row.balance !== '' ? parseFloat(row.balance) : 0;
                const revenueVal = row.revenue !== undefined && row.revenue !== '' ? parseFloat(row.revenue) : 0;
                const prevBalVal = row.prevBalance !== undefined && row.prevBalance !== '' ? parseFloat(row.prevBalance) : 0;
                const adjustVal = row.balanceAdjust !== undefined && row.balanceAdjust !== '' ? parseFloat(row.balanceAdjust) : 0;
                // Save if any value has been entered or modified
                // Check if prevBalance was manually changed from the default
                const today = records.find((r: any) => r.accountId === acc && r.date === date);
                const prevBalChanged = today ? (prevBalVal !== (today.prevBalance ?? 0)) : (prevBalVal !== 0);
                if (row.score === undefined && row.balance === undefined && row.revenue === undefined && !prevBalChanged) return;
                // 新公式: 磨损 = 昨日余额 + 余额调整 - 今日余额
                let cost = (prevBalVal > 0 && balanceVal > 0) ? (prevBalVal + adjustVal - balanceVal) : 0;
                batchData.push({
                    date, accountId: acc, score: scoreVal, balance: balanceVal,
                    revenue: revenueVal, cost, net: revenueVal - cost,
                    balanceAdjust: adjustVal,
                    prevBalance: prevBalVal // Save manually entered prevBalance
                });
            });

            console.log("Saving data:", batchData.length, "records, isDemoMode:", isDemoMode, "db:", !!db);

            if (batchData.length > 0) {
                if (isDemoMode) {
                    saveLocalBatch(batchData);
                } else if (db) {
                    const batch = writeBatch(db);
                    batchData.forEach(r => batch.set(doc(db, `users/${user.uid}/daily_records`, `${r.date}_${r.accountId}`), r));
                    await batch.commit();
                }
            }
            // Always call onSave to refresh data
            onSave();
        } catch (e) {
            console.error("Save error:", e);
            alert("保存失败: " + e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="rounded-[32px] p-6 md:p-8 shadow-sm border hover:shadow-lg transition-all duration-300 h-full flex flex-col" style={{ backgroundColor: COLORS.card, borderColor: `${COLORS.textSecondary}20` }}>
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold flex items-center gap-2" style={{ color: COLORS.textPrimary }}><Wallet style={{ color: COLORS.primary }} size={18} /> 每日数据录入</h3>
                <div className="flex items-center gap-2 p-1.5 rounded-xl border" style={{ backgroundColor: COLORS.bg, borderColor: `${COLORS.textSecondary}20` }}>
                    <CalendarIcon size={14} style={{ color: COLORS.textSecondary }} />
                    <input type="date" value={date} onChange={e => onDateChange(e.target.value)} className="bg-transparent border-none focus:ring-0 text-sm font-bold" style={{ color: COLORS.textPrimary }} />
                </div>
            </div>
            {/* Unified Table + Footer Container */}
            <div className="flex-1 flex flex-col rounded-2xl border overflow-hidden" style={{ borderColor: `${COLORS.textSecondary}20` }}>

                {/* Scrollable Table Area */}
                <div className="overflow-x-auto overflow-y-auto flex-1 min-h-[350px]">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: `${COLORS.bg}80`, color: COLORS.textSecondary }}>
                            <tr>
                                <th className="py-2.5 px-2 md:px-4 w-12 md:w-16 text-right whitespace-nowrap">账号</th>
                                <th className="py-2.5 px-2 md:px-4 text-right whitespace-nowrap"><span className="hidden md:inline">昨日</span>余额</th>
                                <th className="py-2.5 px-2 md:px-4 text-right whitespace-nowrap"><span className="hidden md:inline">今日完成</span>积分</th>
                                <th className="py-2.5 px-2 md:px-4 text-right whitespace-nowrap"><span className="hidden md:inline">今日</span>余额</th>
                                <th className="py-2.5 px-2 md:px-4 text-right whitespace-nowrap" title="空投收入填正数，对外转账填负数">调整</th>
                                <th className="py-2.5 px-2 md:px-4 text-right whitespace-nowrap">磨损</th>
                                <th className="py-2.5 px-2 md:px-4 text-right whitespace-nowrap"><span className="hidden md:inline">空投</span>收益</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: `${COLORS.textSecondary}10` }}>{accounts.map((acc: string) => {
                            const row = grid[acc] || {};
                            const prevBal = parseFloat(row.prevBalance) || 0;
                            const curBal = parseFloat(row.balance) || 0;
                            const adjust = parseFloat(row.balanceAdjust) || 0;
                            // 新公式: 磨损 = 昨日余额 + 余额调整 - 今日余额
                            const cost = (prevBal > 0 && curBal > 0) ? (prevBal + adjust - curBal) : 0;
                            return (
                                <tr key={acc} className="hover:bg-black/5 transition-colors group">
                                    <td className="py-3 px-2 md:px-4 font-bold text-right whitespace-nowrap" style={{ color: COLORS.textPrimary }}>{acc}</td>
                                    <td className="py-3 px-2 md:px-4 text-right"><input type="number" className="w-full bg-transparent outline-none border-b border-transparent focus:border-blue-200 text-right" style={{ color: COLORS.textSecondary }} value={row.prevBalance !== undefined ? row.prevBalance : ''} onChange={e => handleChange(acc, 'prevBalance', e.target.value)} placeholder="-" /></td>
                                    <td className="py-3 px-2 md:px-4 text-right"><input type="number" className="w-full rounded-lg px-1 md:px-2 py-1 text-right border border-transparent focus:border-blue-200 outline-none" style={{ backgroundColor: COLORS.bg }} value={row.score !== undefined ? row.score : ''} onChange={e => handleChange(acc, 'score', e.target.value)} placeholder="0" /></td>
                                    <td className="py-3 px-2 md:px-4 text-right"><input type="number" className="w-full bg-transparent font-bold outline-none border-b border-transparent focus:border-yellow-400 text-right" style={{ color: COLORS.primary }} value={row.balance !== undefined ? row.balance : ''} onChange={e => handleChange(acc, 'balance', e.target.value)} placeholder="0.00" /></td>
                                    <td className="py-3 px-2 md:px-4 text-right"><input type="number" className="w-12 md:w-16 bg-transparent outline-none border-b border-transparent focus:border-purple-400 text-right" style={{ color: adjust > 0 ? COLORS.profit : adjust < 0 ? COLORS.loss : COLORS.textSecondary }} value={row.balanceAdjust !== undefined && row.balanceAdjust !== 0 ? row.balanceAdjust : ''} onChange={e => handleChange(acc, 'balanceAdjust', e.target.value)} placeholder="0" title="空投+，转出-" /></td>
                                    <td className="py-3 px-2 md:px-4 text-right font-mono font-medium whitespace-nowrap" style={{ color: cost > 0 ? COLORS.loss : COLORS.textSecondary }}>{cost !== 0 ? cost.toFixed(2) : '-'}</td>
                                    <td className="py-3 px-2 md:px-4 text-right"><input type="number" className="w-full bg-transparent font-bold outline-none border-b border-transparent focus:border-emerald-200 text-right" style={{ color: COLORS.profit }} value={row.revenue !== undefined ? row.revenue : ''} onChange={e => handleChange(acc, 'revenue', e.target.value)} placeholder="0" /></td>
                                </tr>
                            )
                        })}</tbody>
                    </table>
                </div>

                {/* Footer Bar - Fixed at bottom inside the unified container */}
                <div className="p-4 font-bold flex items-center justify-between border-t" style={{ backgroundColor: `${COLORS.bg}80`, borderColor: `${COLORS.textSecondary}20`, color: COLORS.textSecondary }}>
                    <button onClick={handleSave} disabled={isSaving} className="text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-lg text-xs tracking-wide whitespace-nowrap" style={{ backgroundColor: COLORS.primary, boxShadow: `0 5px 15px -5px ${COLORS.primary}50` }}>
                        {isSaving ? <Loader2 className="animate-spin" size={10} /> : <Save size={10} />} {isSaving ? '保存中...' : '保存'}
                    </button>
                    <div className="flex items-center gap-6">
                        <span>合计:</span>
                        <span style={{ color: COLORS.loss }}>{dailyTotal.totalCost.toFixed(2)}</span>
                        <span style={{ color: COLORS.profit }}>净利润: {dailyTotal.totalNet.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function NavBtn({ label, active, onClick, icon }: any) { return <button onClick={onClick} className={`px-5 py-2 rounded-full flex items-center gap-2 transition-all text-xs font-bold ${active ? 'text-white shadow-lg' : 'hover:bg-gray-100'}`} style={{ backgroundColor: active ? COLORS.textPrimary : 'transparent', color: active ? 'white' : COLORS.textSecondary }}>{icon} {label}</button> }