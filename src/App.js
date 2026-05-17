import React, { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext, lazy, Suspense } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, Cell } from "recharts";
import katex from "katex";

// ==================== CONSTANTS ====================
const SUBJECTS = [
  { id: "biologi", name: "Biologi", icon: "🧬", color: "#22c55e" },
  { id: "kimia", name: "Kimia", icon: "⚗️", color: "#f59e0b" },
  { id: "bindonesia", name: "Bahasa Indonesia", icon: "⚛️", color: "#3b82f6" },
  { id: "binggris", name: "Bahasa Inggris", icon: "⚛️", color: "#3b82f6" },
  { id: "tpa", name: "TPA", icon: "⚛️", color: "#3b82f6" },
  { id: "matematika", name: "Matematika Dasar", icon: "📐", color: "#a855f7" },
];
const DIFFICULTY = ["mudah", "sedang", "sulit"];
const SCORING = { correct: 4, wrong: -1, unanswered: 0 };
const TRYOUT_DURATION = 120 * 60;
const TRYOUT_TOTAL = 80;
const PER_SUBJECT = 20;
const PASSING_GRADE = 780;
const SR_INTERVALS = [1, 3, 7, 14];

// ==================== MOCK DATA ====================
const generateMockQuestions = () => {
  const topics = {
    biologi: [
      { topic: "Sel", subtopics: ["Struktur Sel", "Organel Sel", "Transport Membran"] },
      { topic: "Genetika", subtopics: ["Hukum Mendel", "DNA & RNA", "Mutasi"] },
      { topic: "Evolusi", subtopics: ["Teori Evolusi", "Seleksi Alam", "Spesiasi"] },
      { topic: "Ekologi", subtopics: ["Ekosistem", "Rantai Makanan", "Siklus Biogeokimia"] },
    ],
    kimia: [
      { topic: "Stoikiometri", subtopics: ["Mol", "Persamaan Reaksi", "Limiting Reagent"] },
      { topic: "Ikatan Kimia", subtopics: ["Ikatan Ion", "Ikatan Kovalen", "Gaya Antarmolekul"] },
      { topic: "Termokimia", subtopics: ["Entalpi", "Hukum Hess", "Kalorimetri"] },
      { topic: "Kesetimbangan", subtopics: ["Tetapan Kesetimbangan", "Pergeseran Kesetimbangan", "pH Larutan"] },
    ],
    fisika: [
      { topic: "Mekanika", subtopics: ["Kinematika", "Dinamika", "Usaha & Energi"] },
      { topic: "Gelombang", subtopics: ["Gelombang Bunyi", "Gelombang Cahaya", "Interferensi"] },
      { topic: "Listrik", subtopics: ["Hukum Ohm", "Rangkaian Listrik", "GGL Induksi"] },
      { topic: "Termodinamika", subtopics: ["Hukum Termodinamika", "Mesin Carnot", "Entropi"] },
    ],
    matematika: [
      { topic: "Kalkulus", subtopics: ["Limit", "Turunan", "Integral"] },
      { topic: "Aljabar", subtopics: ["Matriks", "Vektor", "Persamaan Kuadrat"] },
      { topic: "Trigonometri", subtopics: ["Identitas", "Persamaan Trigonometri", "Grafik"] },
      { topic: "Statistika", subtopics: ["Peluang", "Distribusi", "Kombinatorik"] },
    ],
  };

  const questions = [];
  let id = 1;

  Object.entries(topics).forEach(([subject, topicList]) => {
    topicList.forEach((t) => {
      t.subtopics.forEach((st) => {
        DIFFICULTY.forEach((diff) => {
          for (let i = 0; i < 2; i++) {
            questions.push({
              id: `q${String(id++).padStart(4, "0")}`,
              subject,
              topic: t.topic,
              subtopic: st,
              difficulty: diff,
              question: `[${subject.toUpperCase()}] ${t.topic} - ${st} (${diff}) Soal #${i + 1}: Tentukan jawaban yang paling tepat untuk konsep ${st} dalam ${t.topic}.${diff === "sulit" ? " Gunakan analisis mendalam." : ""}`,
              options: ["Pilihan A - jawaban pertama", "Pilihan B - jawaban kedua", "Pilihan C - jawaban ketiga", "Pilihan D - jawaban keempat", "Pilihan E - jawaban kelima"],
              correctAnswer: Math.floor(Math.random() * 5),
              explanation: `Pembahasan: Jawaban yang benar untuk soal tentang ${st} dalam ${t.topic} (${diff}) adalah berdasarkan konsep dasar yang berlaku.${diff === "sulit" ? " Diperlukan pemahaman mendalam tentang materi ini." : ""}`,
              tags: [subject, t.topic, st, diff],
            });
          }
        });
      });
    });
  });
  return questions;
};

const MOCK_LEADERBOARD = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `Siswa ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) || ""}`,
  school: ["SMAN 1 Yogyakarta", "SMAN 3 Bandung", "SMAN 8 Jakarta", "SMAN 5 Surabaya", "SMA Taruna Nusantara"][i % 5],
  city: ["Yogyakarta", "Bandung", "Jakarta", "Surabaya", "Magelang"][i % 5],
  score: Math.max(200, 850 - i * 12 + Math.floor(Math.random() * 30)),
  tryouts: Math.floor(Math.random() * 20) + 5,
  target: "Kedokteran",
}));

// ==================== CONTEXTS ====================
const AppContext = createContext();

const useApp = () => useContext(AppContext);

// ==================== UTILITY FUNCTIONS ====================
const cn = (...classes) => classes.filter(Boolean).join(" ");

const formatTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const getToday = () => new Date().toISOString().split("T")[0];

const getDaysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const linearRegression = (data) => {
  if (data.length < 2) return { slope: 0, intercept: data[0]?.y || 0 };
  const n = data.length;
  const sumX = data.reduce((s, d, i) => s + i, 0);
  const sumY = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d, i) => s + i * d.y, 0);
  const sumX2 = data.reduce((s, _, i) => s + i * i, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
};

// ==================== CUSTOM HOOKS ====================
function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      if (item) return JSON.parse(item);
      return typeof initial === "function" ? initial() : initial;
    } catch { return typeof initial === "function" ? initial() : initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
}

function useTimer(initialTime, onEnd) {
  const [time, setTime] = useState(initialTime);
  const [running, setRunning] = useState(false);
  const cbRef = useRef(onEnd);
  cbRef.current = onEnd;

  useEffect(() => {
    if (!running || time <= 0) return;
    const id = setInterval(() => {
      setTime((t) => {
        if (t <= 1) { cbRef.current?.(); setRunning(false); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, time]);

  return { time, running, start: () => setRunning(true), pause: () => setRunning(false), reset: (t) => { setTime(t || initialTime); setRunning(false); } };
}

// ==================== LATEX RENDERER ====================
function Latex({ children }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current && children) {
      try {
        const parts = children.split(/(\$[^$]+\$)/g);
        ref.current.innerHTML = parts.map(p => {
          if (p.startsWith("$") && p.endsWith("$")) {
            return katex.renderToString(p.slice(1, -1), { throwOnError: false });
          }
          return p;
        }).join("");
      } catch { ref.current.textContent = children; }
    }
  }, [children]);
  return <span ref={ref}>{children}</span>;
}

// ==================== QUESTION IMAGE ====================
function QuestionImage({ src, alt, className }) {
  const [zoomed, setZoomed] = useState(false);
  if (!src) return null;
  return (
    <>
      <img src={src} alt={alt || "Gambar soal"} onClick={() => setZoomed(true)}
        className={cn("max-w-full max-h-64 rounded-lg border border-slate-200 dark:border-slate-700 cursor-zoom-in object-contain my-3 hover:opacity-90 transition", className)} />
      {zoomed && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setZoomed(false)}>
          <img src={src} alt={alt || "Gambar soal"} className="max-w-full max-h-[90vh] rounded-lg object-contain" />
          <button onClick={() => setZoomed(false)} className="absolute top-4 right-4 text-white text-2xl bg-black/50 w-10 h-10 rounded-full">✕</button>
        </div>
      )}
    </>
  );
}

function ImageUploadButton({ value, onChange, label }) {
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Ukuran gambar maksimal 5MB!"); return; }
    if (!file.type.startsWith("image/")) { alert("File harus berupa gambar!"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  return (
    <div className="space-y-2">
      <label className="text-xs text-slate-500">{label || "Gambar"}</label>
      <div className="flex items-center gap-2">
        <label className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-medium cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition border border-slate-300 dark:border-slate-600">
          📷 {value ? "Ganti Gambar" : "Upload Gambar"}
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
        {value && (
          <>
            <img src={value} alt="preview" className="h-12 w-12 object-cover rounded-lg border border-slate-300 dark:border-slate-600" />
            <button onClick={() => onChange("")} className="text-xs text-red-500 hover:text-red-700">✕ Hapus</button>
          </>
        )}
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================
export default function App() {
  const [darkMode, setDarkMode] = useLocalStorage("ugm_dark", false);
  const [fontSize, setFontSize] = useLocalStorage("ugm_fontsize", "normal");
  const [page, setPage] = useState("dashboard");
  const [questions, setQuestions] = useLocalStorage("ugm_questions", () => generateMockQuestions());
  const [tryoutHistory, setTryoutHistory] = useLocalStorage("ugm_tryouts", []);
  const [practiceHistory, setPracticeHistory] = useLocalStorage("ugm_practice", []);
  const [bookmarks, setBookmarks] = useLocalStorage("ugm_bookmarks", []);
  const [srQueue, setSrQueue] = useLocalStorage("ugm_sr", []);
  const [notes, setNotes] = useLocalStorage("ugm_notes", []);
  const [calendar, setCalendar] = useLocalStorage("ugm_calendar", []);
  const [streak, setStreak] = useLocalStorage("ugm_streak", { count: 0, lastDate: null });
  const [goals, setGoals] = useLocalStorage("ugm_goals", { score: 780, accuracy: 80, timePerQ: 90, days: 90 });
  const [userName, setUserName] = useLocalStorage("ugm_username", "Peserta");
  const [mobileNav, setMobileNav] = useState(false);

  // Streak tracking
  useEffect(() => {
    const today = getToday();
    if (streak.lastDate !== today) {
      const yesterday = getDaysFromNow(-1);
      if (streak.lastDate === yesterday) {
        setStreak({ count: streak.count + 1, lastDate: today });
      } else if (streak.lastDate !== today) {
        setStreak({ count: 1, lastDate: today });
      }
    }
  }, []);

  // Auto backup
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const backups = JSON.parse(localStorage.getItem("ugm_backups") || "[]");
        const backup = {
          date: new Date().toISOString(),
          data: { questions, tryoutHistory, practiceHistory, bookmarks, srQueue, notes, calendar, goals }
        };
        backups.unshift(backup);
        localStorage.setItem("ugm_backups", JSON.stringify(backups.slice(0, 5)));
      } catch {}
    }, 86400000);
    return () => clearInterval(interval);
  }, [questions, tryoutHistory]);

  const srDueToday = useMemo(() => {
    const today = getToday();
    return srQueue.filter((s) => s.nextReview <= today);
  }, [srQueue]);

  const fontClass = { small: "text-sm", normal: "text-base", large: "text-lg", xl: "text-xl" }[fontSize] || "text-base";

  const ctx = {
    darkMode, setDarkMode, fontSize, setFontSize, page, setPage,
    questions, setQuestions, tryoutHistory, setTryoutHistory,
    practiceHistory, setPracticeHistory, bookmarks, setBookmarks,
    srQueue, setSrQueue, srDueToday, notes, setNotes,
    calendar, setCalendar, streak, setStreak, goals, setGoals,
    userName, setUserName,
  };

  const exportData = () => {
    const data = { questions, tryoutHistory, practiceHistory, bookmarks, srQueue, notes, calendar, goals };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ugm-backup-${getToday()}.json`;
    a.click();
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.questions) setQuestions(data.questions);
        if (data.tryoutHistory) setTryoutHistory(data.tryoutHistory);
        if (data.practiceHistory) setPracticeHistory(data.practiceHistory);
        if (data.bookmarks) setBookmarks(data.bookmarks);
        if (data.srQueue) setSrQueue(data.srQueue);
        if (data.notes) setNotes(data.notes);
        if (data.calendar) setCalendar(data.calendar);
        if (data.goals) setGoals(data.goals);
        alert("Data berhasil diimpor!");
      } catch { alert("Format file tidak valid!"); }
    };
    reader.readAsText(file);
  };

  const pages = {
    dashboard: <Dashboard />,
    practice: <Practice />,
    tryout: <TryOut />,
    analysis: <Analysis />,
    leaderboard: <Leaderboard />,
    calendar: <CalendarPage />,
    notes: <Notes />,
    review: <ReviewPage />,
    bank: <QuestionBank />,
    settings: <Settings exportData={exportData} importData={importData} />,
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "practice", label: "Latihan", icon: "📝" },
    { id: "tryout", label: "Try Out", icon: "🎯" },
    { id: "review", label: "Review", icon: "🔄" },
    { id: "analysis", label: "Analisis", icon: "📈" },
    { id: "leaderboard", label: "Peringkat", icon: "🏆" },
    { id: "calendar", label: "Kalender", icon: "📅" },
    { id: "notes", label: "Catatan", icon: "📒" },
    { id: "bank", label: "Bank Soal", icon: "🗃️" },
    { id: "settings", label: "Pengaturan", icon: "⚙️" },
  ];

  return (
    <AppContext.Provider value={ctx}>
      <div className={cn(darkMode ? "dark" : "", fontClass)} style={{ fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif" }}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
          {/* Skip link */}
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] bg-blue-700 text-white px-4 py-2 rounded">
            Skip to main content
          </a>

          {/* Top Nav */}
          <header className="sticky top-0 z-50 bg-[#0033A0] dark:bg-slate-900 text-white shadow-lg border-b border-blue-800 dark:border-slate-700">
            <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button className="lg:hidden p-1.5" onClick={() => setMobileNav(!mobileNav)} aria-label="Menu">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
                </button>
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPage("dashboard")}>
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-sm">UGM</div>
                  <div>
                    <div className="font-bold text-sm leading-tight tracking-wide">UM CBT UGM Prep</div>
                    <div className="text-[10px] text-blue-200 leading-tight">Saintek • Kedokteran</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {srDueToday.length > 0 && (
                  <button onClick={() => setPage("review")} className="relative bg-amber-500 text-white text-xs px-2.5 py-1 rounded-full font-semibold animate-pulse">
                    🔄 {srDueToday.length} Review
                  </button>
                )}
                <span className="text-xs bg-white/10 px-2 py-1 rounded-full">🔥 {streak.count} hari</span>
                <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 rounded-lg hover:bg-white/10 transition" aria-label="Toggle dark mode">
                  {darkMode ? "☀️" : "🌙"}
                </button>
              </div>
            </div>
          </header>

          <div className="flex">
            {/* Sidebar - Desktop */}
            <nav className={cn(
              "fixed lg:sticky top-14 left-0 h-[calc(100vh-3.5rem)] w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-40 overflow-y-auto transition-transform duration-200",
              mobileNav ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
              <div className="p-3 space-y-0.5">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setPage(item.id); setMobileNav(false); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      page === item.id
                        ? "bg-[#0033A0] text-white dark:bg-blue-700 shadow-md"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>

            {/* Overlay */}
            {mobileNav && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileNav(false)} />}

            {/* Main */}
            <main id="main" className="flex-1 min-w-0 p-4 lg:p-6 max-w-6xl mx-auto w-full" role="main">
              {pages[page] || <Dashboard />}
            </main>
          </div>
        </div>
      </div>
    </AppContext.Provider>
  );
}

// ==================== DASHBOARD ====================
function Dashboard() {
  const { tryoutHistory, questions, srDueToday, streak, goals, setPage, practiceHistory, bookmarks } = useApp();

  const lastTryout = tryoutHistory[tryoutHistory.length - 1];
  const totalPracticed = practiceHistory.length;
  const avgScore = tryoutHistory.length > 0
    ? Math.round(tryoutHistory.reduce((s, t) => s + t.score, 0) / tryoutHistory.length)
    : 0;

  const subjectStats = SUBJECTS.map((sub) => {
    const subTryouts = tryoutHistory.flatMap((t) => t.perSubject?.filter((ps) => ps.subject === sub.id) || []);
    const acc = subTryouts.length > 0
      ? Math.round(subTryouts.reduce((s, ps) => s + (ps.correct / ps.total) * 100, 0) / subTryouts.length)
      : 0;
    return { ...sub, accuracy: acc };
  });

  const radarData = subjectStats.map((s) => ({ subject: s.name, value: s.accuracy, fullMark: 100 }));

  const scoreData = tryoutHistory.map((t, i) => ({ name: `TO-${i + 1}`, score: t.score, date: t.date }));

  const progress = lastTryout ? Math.min(100, Math.round((lastTryout.score / goals.score) * 100)) : 0;

  return (
    <div className="space-y-6 animate-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0033A0] to-blue-700 dark:from-blue-900 dark:to-blue-800 text-white p-6 lg:p-8">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute right-20 bottom-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          <h1 className="text-2xl lg:text-3xl font-bold mb-1">Selamat Datang! 👋</h1>
          <p className="text-blue-100 text-sm mb-4">Target: Kedokteran UGM • Passing Grade: {goals.score}+</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Skor Terakhir" value={lastTryout?.score || "—"} sub={`Target: ${goals.score}`} />
            <StatCard label="Try Out" value={tryoutHistory.length} sub="total selesai" />
            <StatCard label="Streak" value={`🔥 ${streak.count}`} sub="hari berturut" />
            <StatCard label="Review Hari Ini" value={srDueToday.length} sub="soal menunggu" accent />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Mulai Try Out", icon: "🎯", page: "tryout", color: "bg-red-500" },
          { label: "Latihan Soal", icon: "📝", page: "practice", color: "bg-green-500" },
          { label: "Review Soal", icon: "🔄", page: "review", color: "bg-amber-500" },
          { label: "Lihat Analisis", icon: "📈", page: "analysis", color: "bg-purple-500" },
        ].map((a) => (
          <button key={a.page} onClick={() => setPage(a.page)} className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 dark:border-slate-700 text-left group">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg mb-2", a.color)}>
              {a.icon}
            </div>
            <div className="font-semibold text-sm">{a.label}</div>
          </button>
        ))}
      </div>

      {/* Progress to Goal */}
      <Card title="Progres Menuju Target">
        <div className="mb-2 flex justify-between text-sm">
          <span>Skor saat ini: {lastTryout?.score || 0}</span>
          <span>Target: {goals.score}</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#0033A0] to-blue-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-1">{progress}% tercapai</p>
      </Card>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="📈 Tren Skor Try Out">
          {scoreData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis domain={[0, 'auto']} fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#0033A0" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Belum ada data try out" />}
        </Card>
        <Card title="🎯 Kekuatan Per Mapel">
          {radarData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#cbd5e1" />
                <PolarAngleAxis dataKey="subject" fontSize={11} />
                <PolarRadiusAxis domain={[0, 100]} fontSize={10} />
                <Radar dataKey="value" stroke="#0033A0" fill="#0033A0" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Selesaikan try out untuk melihat analisis" />}
        </Card>
      </div>

      {/* Subject Overview */}
      <Card title="📚 Ringkasan Per Mapel">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {subjectStats.map((s) => (
            <div key={s.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{s.icon}</span>
                <span className="font-semibold text-sm">{s.name}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.accuracy}%</div>
              <div className="text-xs text-slate-500">akurasi rata-rata</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={cn("rounded-xl p-3", accent ? "bg-amber-400/20 border border-amber-400/30" : "bg-white/10")}>
      <div className="text-xs text-blue-200 mb-0.5">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-blue-200">{sub}</div>
    </div>
  );
}

// ==================== PRACTICE MODE ====================
function Practice() {
  const { questions, practiceHistory, setPracticeHistory, bookmarks, setBookmarks, srQueue, setSrQueue } = useApp();
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [sessionAnswers, setSessionAnswers] = useState({});

  const subjectQuestions = useMemo(() => {
    if (!selectedSubject) return {};
    const qs = questions.filter((q) => q.subject === selectedSubject);
    const byTopic = {};
    qs.forEach((q) => {
      if (!byTopic[q.topic]) byTopic[q.topic] = [];
      byTopic[q.topic].push(q);
    });
    return byTopic;
  }, [selectedSubject, questions]);

  const startPractice = (topic) => {
    const qs = questions.filter((q) => q.subject === selectedSubject && q.topic === topic);
    setPracticeQuestions(qs.sort(() => Math.random() - 0.5));
    setSelectedTopic(topic);
    setCurrentQ(0);
    setAnswer(null);
    setShowExplanation(false);
    setSessionAnswers({});
  };

  const handleAnswer = (idx) => {
    if (answer !== null) return;
    setAnswer(idx);
    setShowExplanation(true);
    const q = practiceQuestions[currentQ];
    const isCorrect = idx === q.correctAnswer;

    setSessionAnswers((prev) => ({ ...prev, [q.id]: { answer: idx, correct: isCorrect } }));
    setPracticeHistory((prev) => [...prev, { questionId: q.id, answer: idx, correct: isCorrect, date: getToday() }]);

    if (!isCorrect) {
      setSrQueue((prev) => {
        const existing = prev.find((s) => s.questionId === q.id);
        if (existing) {
          return prev.map((s) => s.questionId === q.id ? { ...s, interval: 0, nextReview: getDaysFromNow(1) } : s);
        }
        return [...prev, { questionId: q.id, interval: 0, nextReview: getDaysFromNow(1) }];
      });
    }
  };

  const nextQuestion = () => {
    if (currentQ < practiceQuestions.length - 1) {
      setCurrentQ(currentQ + 1);
      setAnswer(null);
      setShowExplanation(false);
    }
  };

  const toggleBookmark = (qId) => {
    setBookmarks((prev) => prev.includes(qId) ? prev.filter((b) => b !== qId) : [...prev, qId]);
  };

  if (selectedTopic && practiceQuestions.length > 0) {
    const q = practiceQuestions[currentQ];
    const isBookmarked = bookmarks.includes(q.id);
    const sessionStats = Object.values(sessionAnswers);
    const correctCount = sessionStats.filter((s) => s.correct).length;

    return (
      <div className="space-y-4 animate-in">
        <div className="flex items-center justify-between">
          <button onClick={() => { setSelectedTopic(null); setPracticeQuestions([]); }} className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
            ← Kembali
          </button>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-600">✓ {correctCount}</span>
            <span className="text-red-500">✗ {sessionStats.length - correctCount}</span>
            <span>{currentQ + 1}/{practiceQuestions.length}</span>
          </div>
        </div>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DifficultyBadge difficulty={q.difficulty} />
              <span className="text-xs text-slate-500">{q.topic} → {q.subtopic}</span>
            </div>
            <button onClick={() => toggleBookmark(q.id)} className="text-xl" aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}>
              {isBookmarked ? "🔖" : "📌"}
            </button>
          </div>

          <p className="text-base mb-4 leading-relaxed">{q.question}</p>
          <QuestionImage src={q.image} alt={`Gambar soal ${q.topic}`} />

          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const isSelected = answer === i;
              const isCorrect = i === q.correctAnswer;
              let optClass = "border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500";
              if (answer !== null) {
                if (isCorrect) optClass = "border-green-500 bg-green-50 dark:bg-green-900/20";
                else if (isSelected && !isCorrect) optClass = "border-red-500 bg-red-50 dark:bg-red-900/20";
              } else if (isSelected) {
                optClass = "border-blue-500 bg-blue-50 dark:bg-blue-900/20";
              }

              return (
                <button key={i} onClick={() => handleAnswer(i)} disabled={answer !== null}
                  className={cn("w-full text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3", optClass)}>
                  <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                    answer !== null && isCorrect ? "bg-green-500 text-white" :
                    answer !== null && isSelected ? "bg-red-500 text-white" :
                    "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}>{letter}</span>
                  <span className="text-sm pt-0.5">{opt}</span>
                </button>
              );
            })}
          </div>

          {showExplanation && (
            <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <h4 className="font-bold text-sm mb-1 text-blue-800 dark:text-blue-300">💡 Pembahasan</h4>
              <p className="text-sm text-blue-700 dark:text-blue-200">{q.explanation}</p>
              <QuestionImage src={q.explanationImage} alt="Gambar pembahasan" />
            </div>
          )}

          {answer !== null && currentQ < practiceQuestions.length - 1 && (
            <button onClick={nextQuestion} className="mt-4 w-full py-2.5 bg-[#0033A0] text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition">
              Soal Berikutnya →
            </button>
          )}
          {answer !== null && currentQ === practiceQuestions.length - 1 && (
            <div className="mt-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
              <p className="font-bold text-green-700 dark:text-green-300">🎉 Sesi selesai!</p>
              <p className="text-sm text-green-600 dark:text-green-400">Benar: {correctCount}/{practiceQuestions.length} ({Math.round(correctCount / practiceQuestions.length * 100)}%)</p>
              <button onClick={() => { setSelectedTopic(null); setPracticeQuestions([]); }} className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm">
                Kembali
              </button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (selectedSubject) {
    return (
      <div className="space-y-4 animate-in">
        <button onClick={() => setSelectedSubject(null)} className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
          ← Pilih Mapel
        </button>
        <h2 className="text-xl font-bold">{SUBJECTS.find(s => s.id === selectedSubject)?.icon} {SUBJECTS.find(s => s.id === selectedSubject)?.name}</h2>
        <div className="grid gap-3">
          {Object.entries(subjectQuestions).map(([topic, qs]) => {
            const practiced = practiceHistory.filter((p) => qs.some((q) => q.id === p.questionId));
            const accuracy = practiced.length > 0
              ? Math.round(practiced.filter((p) => p.correct).length / practiced.length * 100)
              : null;

            return (
              <button key={topic} onClick={() => startPractice(topic)}
                className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:shadow-md transition-all">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{topic}</h3>
                    <p className="text-xs text-slate-500">{qs.length} soal • {[...new Set(qs.map(q => q.subtopic))].length} subtopik</p>
                  </div>
                  <div className="text-right">
                    {accuracy !== null ? (
                      <div className={cn("text-lg font-bold", accuracy >= 70 ? "text-green-500" : accuracy >= 40 ? "text-amber-500" : "text-red-500")}>
                        {accuracy}%
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Belum latihan</span>
                    )}
                  </div>
                </div>
                {accuracy !== null && (
                  <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                    <div className={cn("h-full rounded-full", accuracy >= 70 ? "bg-green-500" : accuracy >= 40 ? "bg-amber-500" : "bg-red-500")}
                      style={{ width: `${accuracy}%` }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in">
      <h1 className="text-2xl font-bold">📝 Mode Latihan</h1>
      <p className="text-slate-500 text-sm">Pilih mata pelajaran untuk mulai berlatih</p>
      <div className="grid grid-cols-2 gap-4">
        {SUBJECTS.map((sub) => {
          const count = questions.filter((q) => q.subject === sub.id).length;
          return (
            <button key={sub.id} onClick={() => setSelectedSubject(sub.id)}
              className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all text-center group">
              <div className="text-4xl mb-3">{sub.icon}</div>
              <h3 className="font-bold text-lg mb-1">{sub.name}</h3>
              <p className="text-sm text-slate-500">{count} soal tersedia</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== TRY OUT MODE ====================
function TryOut() {
  const { questions, tryoutHistory, setTryoutHistory, srQueue, setSrQueue } = useApp();
  const [phase, setPhase] = useState("intro"); // intro, exam, result
  const [examQuestions, setExamQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState(new Set());
  const [timePerQuestion, setTimePerQuestion] = useState({});
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [showNav, setShowNav] = useState(false);
  const [result, setResult] = useState(null);

  const timer = useTimer(TRYOUT_DURATION, () => submitExam());

  const startExam = () => {
    const selected = [];
    SUBJECTS.forEach((sub) => {
      const subQs = questions.filter((q) => q.subject === sub.id);
      const easy = subQs.filter((q) => q.difficulty === "mudah").sort(() => Math.random() - 0.5).slice(0, 5);
      const med = subQs.filter((q) => q.difficulty === "sedang").sort(() => Math.random() - 0.5).slice(0, 10);
      const hard = subQs.filter((q) => q.difficulty === "sulit").sort(() => Math.random() - 0.5).slice(0, 5);
      let pool = [...easy, ...med, ...hard];
      while (pool.length < PER_SUBJECT && subQs.length > pool.length) {
        const remaining = subQs.filter((q) => !pool.includes(q));
        pool.push(remaining[Math.floor(Math.random() * remaining.length)]);
      }
      selected.push(...pool.slice(0, PER_SUBJECT));
    });
    setExamQuestions(selected);
    setAnswers({});
    setFlags(new Set());
    setTimePerQuestion({});
    setCurrentQ(0);
    setQuestionStartTime(Date.now());
    setPhase("exam");
    timer.reset(TRYOUT_DURATION);
    timer.start();
  };

  const recordTime = (qIdx) => {
    if (questionStartTime) {
      const elapsed = (Date.now() - questionStartTime) / 1000;
      setTimePerQuestion((prev) => ({
        ...prev,
        [qIdx]: (prev[qIdx] || 0) + elapsed,
      }));
    }
  };

  const navigateTo = (idx) => {
    recordTime(currentQ);
    setCurrentQ(idx);
    setQuestionStartTime(Date.now());
    setShowNav(false);
  };

  const selectAnswer = (optIdx) => {
    setAnswers((prev) => ({ ...prev, [currentQ]: optIdx }));
  };

  const toggleFlag = () => {
    setFlags((prev) => {
      const n = new Set(prev);
      n.has(currentQ) ? n.delete(currentQ) : n.add(currentQ);
      return n;
    });
  };

  const submitExam = () => {
    recordTime(currentQ);
    timer.pause();

    let totalScore = 0;
    let correct = 0, wrong = 0, unanswered = 0;
    const perSubject = SUBJECTS.map((sub) => ({ subject: sub.id, name: sub.name, correct: 0, wrong: 0, unanswered: 0, total: 0 }));

    examQuestions.forEach((q, i) => {
      const subStat = perSubject.find((p) => p.subject === q.subject);
      subStat.total++;
      if (answers[i] === undefined) {
        unanswered++;
        subStat.unanswered++;
      } else if (answers[i] === q.correctAnswer) {
        correct++;
        subStat.correct++;
        totalScore += SCORING.correct;
      } else {
        wrong++;
        subStat.wrong++;
        totalScore += SCORING.wrong;
        // Add to SR queue
        setSrQueue((prev) => {
          const existing = prev.find((s) => s.questionId === q.id);
          if (existing) return prev.map((s) => s.questionId === q.id ? { ...s, interval: 0, nextReview: getDaysFromNow(1) } : s);
          return [...prev, { questionId: q.id, interval: 0, nextReview: getDaysFromNow(1) }];
        });
      }
    });

    // Normalize score (scaled)
    const scaledScore = Math.round((totalScore / (TRYOUT_TOTAL * SCORING.correct)) * 1000);

    const res = {
      date: new Date().toISOString(),
      score: Math.max(0, scaledScore),
      rawScore: totalScore,
      correct, wrong, unanswered,
      total: TRYOUT_TOTAL,
      perSubject,
      timePerQuestion: { ...timePerQuestion },
      duration: TRYOUT_DURATION - timer.time,
      questions: examQuestions.map((q, i) => ({
        ...q,
        userAnswer: answers[i],
        timeSpent: timePerQuestion[i] || 0,
        isCorrect: answers[i] === q.correctAnswer,
      })),
    };

    setResult(res);
    setTryoutHistory((prev) => [...prev, res]);
    setPhase("result");
  };

  if (phase === "intro") {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-in">
        <div className="text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h1 className="text-2xl font-bold mb-2">Mode Try Out</h1>
          <p className="text-slate-500 text-sm">Simulasi UM CBT UGM Saintek</p>
        </div>
        <Card>
          <div className="space-y-3 text-sm">
            <InfoRow icon="📝" label="Jumlah Soal" value="80 soal (20/mapel)" />
            <InfoRow icon="⏱️" label="Durasi" value="120 menit" />
            <InfoRow icon="✅" label="Benar" value="+4 poin" />
            <InfoRow icon="❌" label="Salah" value="-1 poin" />
            <InfoRow icon="⬜" label="Kosong" value="0 poin" />
            <InfoRow icon="🏥" label="Target Kedokteran" value="780+" />
          </div>
        </Card>
        <Card>
          <p className="text-sm text-slate-500 mb-2">Proporsi Kesulitan</p>
          <div className="flex gap-2">
            <DiffBadgeSmall d="mudah" pct="25%" />
            <DiffBadgeSmall d="sedang" pct="50%" />
            <DiffBadgeSmall d="sulit" pct="25%" />
          </div>
        </Card>
        <button onClick={startExam}
          className="w-full py-3.5 bg-[#0033A0] text-white rounded-xl font-bold text-lg hover:bg-blue-800 transition-all shadow-lg hover:shadow-xl">
          Mulai Try Out 🚀
        </button>
      </div>
    );
  }

  if (phase === "exam") {
    const q = examQuestions[currentQ];
    const warning = timer.time <= 300;
    const sub = SUBJECTS.find((s) => s.id === q?.subject);

    return (
      <div className="space-y-3 animate-in">
        {/* Timer Bar */}
        <div className={cn("flex items-center justify-between p-3 rounded-xl", warning ? "bg-red-100 dark:bg-red-900/30" : "bg-white dark:bg-slate-800", "border border-slate-200 dark:border-slate-700")}>
          <div className="flex items-center gap-2">
            <span className={cn("text-xl font-mono font-bold", warning && "text-red-600 animate-pulse")}>{formatTime(timer.time)}</span>
            {warning && <span className="text-xs text-red-600 font-semibold">⚠️ Waktu hampir habis!</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNav(!showNav)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-medium">
              📋 Navigasi
            </button>
            <button onClick={() => { if (window.confirm("Yakin submit?")) submitExam(); }}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium">
              Submit
            </button>
          </div>
        </div>

        {/* Navigation Grid */}
        {showNav && (
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-10 gap-1.5">
              {examQuestions.map((_, i) => {
                const answered = answers[i] !== undefined;
                const flagged = flags.has(i);
                const isCurrent = i === currentQ;
                return (
                  <button key={i} onClick={() => navigateTo(i)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-semibold transition-all flex items-center justify-center",
                      isCurrent ? "ring-2 ring-blue-500 ring-offset-1" : "",
                      flagged ? "bg-amber-400 text-amber-900" :
                      answered ? "bg-green-500 text-white" :
                      "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                    )}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-slate-500">
              <span>🟢 Dijawab: {Object.keys(answers).length}</span>
              <span>🟡 Ditandai: {flags.size}</span>
              <span>⬜ Belum: {TRYOUT_TOTAL - Object.keys(answers).length}</span>
            </div>
          </div>
        )}

        {/* Question */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: sub?.color }}>
                {sub?.icon} {sub?.name}
              </span>
              <DifficultyBadge difficulty={q.difficulty} />
              <span className="text-xs text-slate-500">#{currentQ + 1}</span>
            </div>
            <button onClick={toggleFlag} className={cn("px-2 py-1 rounded-lg text-xs font-medium border transition",
              flags.has(currentQ) ? "bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "border-slate-300 dark:border-slate-600")}>
              {flags.has(currentQ) ? "🚩 Ditandai" : "🏳️ Tandai"}
            </button>
          </div>

          <p className="text-base mb-4 leading-relaxed">{q.question}</p>
          <QuestionImage src={q.image} alt={`Gambar soal ${q.topic}`} />

          <div className="space-y-2">
            {q.options.map((opt, i) => (
              <button key={i} onClick={() => selectAnswer(i)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3",
                  answers[currentQ] === i ? "border-[#0033A0] bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                )}>
                <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                  answers[currentQ] === i ? "bg-[#0033A0] text-white" : "bg-slate-100 dark:bg-slate-700"
                )}>{String.fromCharCode(65 + i)}</span>
                <span className="text-sm pt-0.5">{opt}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Nav Buttons */}
        <div className="flex gap-2">
          <button onClick={() => navigateTo(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium disabled:opacity-40">
            ← Sebelumnya
          </button>
          <button onClick={() => navigateTo(Math.min(examQuestions.length - 1, currentQ + 1))} disabled={currentQ === examQuestions.length - 1}
            className="flex-1 py-2.5 rounded-xl bg-[#0033A0] text-white text-sm font-medium disabled:opacity-40">
            Berikutnya →
          </button>
        </div>
      </div>
    );
  }

  if (phase === "result" && result) {
    const avgTime = Object.values(result.timePerQuestion).reduce((s, t) => s + t, 0) / TRYOUT_TOTAL;
    const passTarget = result.score >= PASSING_GRADE;

    return (
      <div className="space-y-4 animate-in">
        <div className={cn("text-center p-6 rounded-2xl", passTarget ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20")}>
          <div className="text-5xl mb-2">{passTarget ? "🎉" : "💪"}</div>
          <h1 className="text-3xl font-bold mb-1">{result.score}</h1>
          <p className="text-sm text-slate-500">Target: {PASSING_GRADE} • {passTarget ? "Tercapai!" : `Kurang ${PASSING_GRADE - result.score} poin`}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Benar" value={result.correct} color="text-green-600" icon="✅" />
          <MiniStat label="Salah" value={result.wrong} color="text-red-500" icon="❌" />
          <MiniStat label="Kosong" value={result.unanswered} color="text-slate-400" icon="⬜" />
        </div>

        <Card title="📊 Skor Per Mapel">
          <div className="space-y-2">
            {result.perSubject.map((ps) => {
              const sub = SUBJECTS.find((s) => s.id === ps.subject);
              const acc = ps.total > 0 ? Math.round((ps.correct / ps.total) * 100) : 0;
              return (
                <div key={ps.subject} className="flex items-center gap-3">
                  <span className="text-lg w-8">{sub?.icon}</span>
                  <span className="text-sm font-medium flex-1">{sub?.name}</span>
                  <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div className="h-full rounded-full" style={{ width: `${acc}%`, background: sub?.color }} />
                  </div>
                  <span className="text-sm font-bold w-12 text-right">{acc}%</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="⏱️ Analisis Waktu">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500">Rata-rata/soal:</span> <strong>{avgTime.toFixed(1)}s</strong></div>
            <div><span className="text-slate-500">Total waktu:</span> <strong>{formatTime(Math.round(result.duration))}</strong></div>
          </div>
        </Card>

        {/* Question Review */}
        <Card title="📝 Review Soal">
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {result.questions.map((q, i) => (
              <div key={i} className={cn("p-3 rounded-xl border text-sm", q.isCorrect ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10" : q.userAnswer === undefined ? "border-slate-200 dark:border-slate-700" : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10")}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-xs">#{i + 1}</span>
                  <span className="text-xs">{q.isCorrect ? "✅" : q.userAnswer === undefined ? "⬜" : "❌"}</span>
                  <span className="text-xs text-slate-500">{q.topic} • {q.subtopic}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1 line-clamp-2">{q.question}</p>
                {q.image && <img src={q.image} alt="Gambar soal" className="max-h-32 rounded border border-slate-200 dark:border-slate-700 my-1" />}
                {q.userAnswer !== undefined && !q.isCorrect && (
                  <p className="text-xs text-red-500">Jawaban: {String.fromCharCode(65 + q.userAnswer)} | Benar: {String.fromCharCode(65 + q.correctAnswer)}</p>
                )}
                <details className="mt-1">
                  <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer">Lihat pembahasan</summary>
                  <p className="text-xs mt-1 text-slate-600 dark:text-slate-400">{q.explanation}</p>
                  {q.explanationImage && <img src={q.explanationImage} alt="Gambar pembahasan" className="max-h-32 rounded border border-slate-200 dark:border-slate-700 mt-1" />}
                </details>
              </div>
            ))}
          </div>
        </Card>

        <button onClick={() => setPhase("intro")} className="w-full py-3 bg-[#0033A0] text-white rounded-xl font-semibold">
          Kembali ke Menu Try Out
        </button>
      </div>
    );
  }

  return null;
}

// ==================== ANALYSIS ====================
function Analysis() {
  const { tryoutHistory, practiceHistory, questions } = useApp();

  const scoreData = tryoutHistory.map((t, i) => ({
    name: `TO-${i + 1}`,
    score: t.score,
    ...SUBJECTS.reduce((acc, sub) => {
      const ps = t.perSubject?.find((p) => p.subject === sub.id);
      acc[sub.id] = ps ? Math.round((ps.correct / ps.total) * 100) : 0;
      return acc;
    }, {}),
  }));

  const radarData = SUBJECTS.map((sub) => {
    const entries = tryoutHistory.flatMap((t) => t.perSubject?.filter((p) => p.subject === sub.id) || []);
    const avg = entries.length > 0 ? Math.round(entries.reduce((s, e) => s + (e.correct / e.total) * 100, 0) / entries.length) : 0;
    return { subject: sub.name, value: avg, fullMark: 100 };
  });

  // Topic heatmap data
  const topicData = {};
  questions.forEach((q) => {
    const key = `${q.subject}|${q.topic}`;
    if (!topicData[key]) topicData[key] = { subject: q.subject, topic: q.topic, total: 0, correct: 0 };
    const practices = practiceHistory.filter((p) => p.questionId === q.id);
    practices.forEach((p) => { topicData[key].total++; if (p.correct) topicData[key].correct++; });
    tryoutHistory.forEach((t) => {
      const tq = t.questions?.find((tq) => tq.id === q.id);
      if (tq) { topicData[key].total++; if (tq.isCorrect) topicData[key].correct++; }
    });
  });

  const topicStats = Object.values(topicData).filter((t) => t.total > 0).map((t) => ({
    ...t,
    accuracy: Math.round((t.correct / t.total) * 100),
  })).sort((a, b) => a.accuracy - b.accuracy);

  // Prediction
  const regression = linearRegression(tryoutHistory.map((t, i) => ({ x: i, y: t.score })));
  const predictNext = Math.round(regression.intercept + regression.slope * tryoutHistory.length);

  // Most missed questions
  const missedCount = {};
  tryoutHistory.forEach((t) => {
    t.questions?.forEach((q) => {
      if (!q.isCorrect && q.userAnswer !== undefined) {
        missedCount[q.id] = (missedCount[q.id] || 0) + 1;
      }
    });
  });
  const topMissed = Object.entries(missedCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ question: questions.find((q) => q.id === id), count }))
    .filter((m) => m.question);

  return (
    <div className="space-y-4 animate-in">
      <h1 className="text-2xl font-bold">📈 Analisis & Progres</h1>

      {tryoutHistory.length === 0 ? (
        <EmptyState text="Selesaikan try out terlebih dahulu untuk melihat analisis" />
      ) : (
        <>
          {/* Prediction */}
          <Card title="🔮 Prediksi">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#0033A0]">{predictNext}</div>
                <div className="text-xs text-slate-500">Prediksi skor TO berikutnya</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{regression.slope > 0 ? "📈" : "📉"} {regression.slope > 0 ? "+" : ""}{regression.slope.toFixed(1)}</div>
                <div className="text-xs text-slate-500">Tren per TO</div>
              </div>
            </div>
          </Card>

          {/* Score Trend */}
          <Card title="📈 Tren Skor Try Out">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis domain={[0, 'auto']} fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" name="Skor" stroke="#0033A0" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Per Subject Trend */}
          <Card title="📊 Akurasi Per Mapel">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} />
                <Tooltip />
                <Legend />
                {SUBJECTS.map((sub) => (
                  <Line key={sub.id} type="monotone" dataKey={sub.id} name={sub.name} stroke={sub.color} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Radar */}
          <Card title="🎯 Kekuatan Per Mapel (Radar)">
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#cbd5e1" />
                <PolarAngleAxis dataKey="subject" fontSize={11} />
                <PolarRadiusAxis domain={[0, 100]} fontSize={10} />
                <Radar dataKey="value" stroke="#0033A0" fill="#0033A0" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>

          {/* Topic Heatmap */}
          <Card title="🗺️ Heatmap Topik">
            <div className="space-y-1">
              {SUBJECTS.map((sub) => {
                const subTopics = topicStats.filter((t) => t.subject === sub.id);
                if (subTopics.length === 0) return null;
                return (
                  <div key={sub.id}>
                    <div className="text-xs font-semibold mb-1 mt-2">{sub.icon} {sub.name}</div>
                    <div className="flex flex-wrap gap-1">
                      {subTopics.map((t) => (
                        <div key={t.topic} className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ background: t.accuracy >= 70 ? "#22c55e" : t.accuracy >= 40 ? "#f59e0b" : "#ef4444" }}
                          title={`${t.topic}: ${t.accuracy}% (${t.correct}/${t.total})`}>
                          {t.topic} {t.accuracy}%
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Top Missed */}
          <Card title="🚨 Soal Paling Sering Salah">
            {topMissed.length > 0 ? (
              <div className="space-y-2">
                {topMissed.map((m, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/10 text-sm">
                    <span className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">{m.count}</span>
                    <div>
                      <p className="text-xs text-slate-500">{m.question.topic} • {m.question.subtopic}</p>
                      <p className="text-sm line-clamp-2">{m.question.question}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState text="Belum ada data" />}
          </Card>
        </>
      )}
    </div>
  );
}

// ==================== LEADERBOARD ====================
function Leaderboard() {
  const { tryoutHistory, userName } = useApp();
  const [filter, setFilter] = useState("all");

  const lastScore = tryoutHistory.length > 0 ? tryoutHistory[tryoutHistory.length - 1].score : 0;
  const userEntry = { id: 0, name: userName, score: lastScore, tryouts: tryoutHistory.length, school: "Sekolah Saya", city: "-", target: "Kedokteran" };

  const allEntries = [...MOCK_LEADERBOARD, userEntry].sort((a, b) => b.score - a.score);
  const userRank = allEntries.findIndex((e) => e.id === 0) + 1;

  const filtered = filter === "all" ? allEntries :
    filter === "week" ? allEntries.slice(0, 20) :
    allEntries.slice(0, 30);

  return (
    <div className="space-y-4 animate-in">
      <h1 className="text-2xl font-bold">🏆 Leaderboard</h1>

      {/* User Rank */}
      <div className="p-4 bg-gradient-to-r from-[#0033A0] to-blue-600 rounded-xl text-white">
        <div className="text-sm text-blue-200">Peringkat Kamu</div>
        <div className="text-3xl font-bold">#{userRank}</div>
        <div className="text-sm">Skor: {lastScore} • {tryoutHistory.length} TO selesai</div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[["all", "Semua"], ["week", "Minggu Ini"], ["month", "Bulan Ini"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition",
              filter === val ? "bg-[#0033A0] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <div className="space-y-1">
          {filtered.slice(0, 20).map((entry, i) => {
            const rank = i + 1;
            const isUser = entry.id === 0;
            return (
              <div key={entry.id} className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg transition",
                isUser ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}>
                <span className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                  rank === 1 ? "bg-amber-400 text-amber-900" :
                  rank === 2 ? "bg-slate-300 text-slate-700" :
                  rank === 3 ? "bg-amber-600 text-amber-100" :
                  "bg-slate-100 dark:bg-slate-700 text-slate-500"
                )}>{rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{entry.name} {isUser && "⭐"}</div>
                  <div className="text-xs text-slate-500 truncate">{entry.school}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold">{entry.score}</div>
                  <div className="text-xs text-slate-500">{entry.tryouts} TO</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ==================== CALENDAR ====================
function CalendarPage() {
  const { calendar, setCalendar, streak } = useApp();
  const [viewDate, setViewDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [newSession, setNewSession] = useState({ subject: "biologi", topic: "", duration: 60, priority: "sedang", date: getToday() });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getSessionsForDate = (day) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return calendar.filter((s) => s.date === dateStr);
  };

  const addSession = () => {
    setCalendar((prev) => [...prev, { ...newSession, id: Date.now(), done: false }]);
    setShowAdd(false);
    setNewSession({ subject: "biologi", topic: "", duration: 60, priority: "sedang", date: getToday() });
  };

  const toggleDone = (id) => {
    setCalendar((prev) => prev.map((s) => s.id === id ? { ...s, done: !s.done } : s));
  };

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📅 Kalender Belajar</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full font-medium">🔥 Streak: {streak.count} hari</span>
          <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-[#0033A0] text-white rounded-lg text-sm font-medium">+ Tambah</button>
        </div>
      </div>

      {/* Add Session Modal */}
      {showAdd && (
        <Card>
          <h3 className="font-semibold mb-3">Tambah Sesi Belajar</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Tanggal</label>
              <input type="date" value={newSession.date} onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Mapel</label>
              <select value={newSession.subject} onChange={(e) => setNewSession({ ...newSession, subject: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
                {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Topik</label>
              <input type="text" value={newSession.topic} onChange={(e) => setNewSession({ ...newSession, topic: e.target.value })}
                placeholder="Opsional" className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Durasi (menit)</label>
              <input type="number" value={newSession.duration} onChange={(e) => setNewSession({ ...newSession, duration: parseInt(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
            </div>
          </div>
          <button onClick={addSession} className="mt-3 px-4 py-2 bg-[#0033A0] text-white rounded-lg text-sm font-medium">Simpan</button>
        </Card>
      )}

      {/* Calendar Grid */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setViewDate(new Date(year, month - 1))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">←</button>
          <h3 className="font-semibold">{monthName}</h3>
          <button onClick={() => setViewDate(new Date(year, month + 1))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
            <div key={d} className="py-1 text-slate-500 font-medium">{d}</div>
          ))}
          {days.map((day, i) => {
            const sessions = getSessionsForDate(day);
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            return (
              <div key={i} className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center relative",
                !day ? "" : isToday ? "bg-[#0033A0] text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800",
              )}>
                {day && (
                  <>
                    <span className="text-xs">{day}</span>
                    {sessions.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {sessions.slice(0, 3).map((s, j) => (
                          <div key={j} className={cn("w-1.5 h-1.5 rounded-full", s.done ? "bg-green-400" : "bg-amber-400")} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Today's Sessions */}
      <Card title="📋 Sesi Hari Ini">
        {(() => {
          const today = getToday();
          const todaySessions = calendar.filter((s) => s.date === today);
          if (todaySessions.length === 0) return <EmptyState text="Belum ada sesi hari ini" />;
          return (
            <div className="space-y-2">
              {todaySessions.map((s) => {
                const sub = SUBJECTS.find((sb) => sb.id === s.subject);
                return (
                  <div key={s.id} className={cn("flex items-center gap-3 p-3 rounded-xl border", s.done ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10" : "border-slate-200 dark:border-slate-700")}>
                    <button onClick={() => toggleDone(s.id)} className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0", s.done ? "border-green-500 bg-green-500 text-white" : "border-slate-300")}>
                      {s.done && "✓"}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{sub?.icon} {sub?.name} {s.topic && `• ${s.topic}`}</div>
                      <div className="text-xs text-slate-500">{s.duration} menit</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Card>
    </div>
  );
}

// ==================== NOTES ====================
function Notes() {
  const { notes, setNotes } = useApp();
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [newNote, setNewNote] = useState({ subject: "biologi", topic: "", title: "", content: "", formula: "" });
  const [showAdd, setShowAdd] = useState(false);

  const filteredNotes = notes.filter((n) => {
    if (selectedSubject && n.subject !== selectedSubject) return false;
    if (search) {
      const s = search.toLowerCase();
      return n.title.toLowerCase().includes(s) || n.content.toLowerCase().includes(s) || n.formula?.toLowerCase().includes(s) || n.topic?.toLowerCase().includes(s);
    }
    return true;
  });

  const addNote = () => {
    if (!newNote.title) return;
    setNotes((prev) => [...prev, { ...newNote, id: Date.now(), createdAt: new Date().toISOString() }]);
    setNewNote({ subject: "biologi", topic: "", title: "", content: "", formula: "" });
    setShowAdd(false);
  };

  const deleteNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📒 Catatan & Rumus</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-[#0033A0] text-white rounded-lg text-sm font-medium">+ Tambah</button>
      </div>

      {/* Search */}
      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Cari rumus atau konsep..."
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />

      {/* Subject Filter */}
      <div className="flex gap-2 overflow-x-auto">
        <button onClick={() => setSelectedSubject(null)}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0", !selectedSubject ? "bg-[#0033A0] text-white" : "bg-slate-100 dark:bg-slate-800")}>
          Semua
        </button>
        {SUBJECTS.map((sub) => (
          <button key={sub.id} onClick={() => setSelectedSubject(sub.id)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0", selectedSubject === sub.id ? "bg-[#0033A0] text-white" : "bg-slate-100 dark:bg-slate-800")}>
            {sub.icon} {sub.name}
          </button>
        ))}
      </div>

      {/* Add Note Form */}
      {showAdd && (
        <Card>
          <h3 className="font-semibold mb-3">Tambah Catatan</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Mapel</label>
                <select value={newNote.subject} onChange={(e) => setNewNote({ ...newNote, subject: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
                  {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Topik</label>
                <input type="text" value={newNote.topic} onChange={(e) => setNewNote({ ...newNote, topic: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Judul</label>
              <input type="text" value={newNote.title} onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Rumus (LaTeX, gunakan $...$ untuk inline)</label>
              <input type="text" value={newNote.formula} onChange={(e) => setNewNote({ ...newNote, formula: e.target.value })}
                placeholder="$E = mc^2$" className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Isi / Ringkasan</label>
              <textarea value={newNote.content} onChange={(e) => setNewNote({ ...newNote, content: e.target.value })} rows={4}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <button onClick={addNote} className="px-4 py-2 bg-[#0033A0] text-white rounded-lg text-sm font-medium">Simpan Catatan</button>
          </div>
        </Card>
      )}

      {/* Notes List */}
      {filteredNotes.length === 0 ? <EmptyState text="Belum ada catatan" /> : (
        <div className="space-y-3">
          {filteredNotes.map((note) => {
            const sub = SUBJECTS.find((s) => s.id === note.subject);
            return (
              <Card key={note.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{sub?.icon}</span>
                    <span className="font-semibold text-sm">{note.title}</span>
                    {note.topic && <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full">{note.topic}</span>}
                  </div>
                  <button onClick={() => deleteNote(note.id)} className="text-xs text-red-500 hover:text-red-700">🗑️</button>
                </div>
                {note.formula && (
                  <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2 text-sm font-mono overflow-x-auto">
                    <Latex>{note.formula}</Latex>
                  </div>
                )}
                {note.content && <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{note.content}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== REVIEW (SPACED REPETITION) ====================
function ReviewPage() {
  const { questions, srQueue, setSrQueue, srDueToday } = useApp();
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const dueQuestions = srDueToday.map((sr) => ({
    ...questions.find((q) => q.id === sr.questionId),
    srData: sr,
  })).filter((q) => q.id);

  const handleAnswer = (idx) => {
    if (answer !== null) return;
    setAnswer(idx);
    setShowExplanation(true);

    const q = dueQuestions[current];
    const isCorrect = idx === q.correctAnswer;

    setSrQueue((prev) => prev.map((sr) => {
      if (sr.questionId !== q.id) return sr;
      if (isCorrect) {
        const nextInterval = Math.min(sr.interval + 1, SR_INTERVALS.length - 1);
        return { ...sr, interval: nextInterval, nextReview: getDaysFromNow(SR_INTERVALS[nextInterval]) };
      } else {
        return { ...sr, interval: 0, nextReview: getDaysFromNow(SR_INTERVALS[0]) };
      }
    }));
  };

  const next = () => {
    if (current < dueQuestions.length - 1) {
      setCurrent(current + 1);
      setAnswer(null);
      setShowExplanation(false);
    }
  };

  return (
    <div className="space-y-4 animate-in">
      <h1 className="text-2xl font-bold">🔄 Spaced Repetition Review</h1>

      <Card>
        <div className="flex items-center justify-between text-sm">
          <span>Soal yang perlu di-review hari ini:</span>
          <span className="text-xl font-bold text-amber-500">{dueQuestions.length}</span>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Total dalam antrian: {srQueue.length} soal
        </div>
      </Card>

      {dueQuestions.length === 0 ? (
        <EmptyState text="🎉 Tidak ada soal yang perlu di-review hari ini!" />
      ) : (
        <div>
          <div className="text-sm text-slate-500 mb-2">Soal {current + 1} dari {dueQuestions.length}</div>
          <Card>
            {(() => {
              const q = dueQuestions[current];
              if (!q) return null;
              const sub = SUBJECTS.find((s) => s.id === q.subject);
              return (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm" style={{ color: sub?.color }}>{sub?.icon} {sub?.name}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <span className="text-xs text-slate-500">Interval: {SR_INTERVALS[q.srData.interval]} hari</span>
                  </div>
                  <p className="mb-4">{q.question}</p>
                  <QuestionImage src={q.image} alt={`Gambar soal ${q.topic}`} />
                  <div className="space-y-2">
                    {q.options.map((opt, i) => {
                      let cls = "border-slate-200 dark:border-slate-700";
                      if (answer !== null) {
                        if (i === q.correctAnswer) cls = "border-green-500 bg-green-50 dark:bg-green-900/20";
                        else if (i === answer) cls = "border-red-500 bg-red-50 dark:bg-red-900/20";
                      }
                      return (
                        <button key={i} onClick={() => handleAnswer(i)} disabled={answer !== null}
                          className={cn("w-full text-left p-3 rounded-xl border-2 transition flex items-start gap-3", cls)}>
                          <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                            answer !== null && i === q.correctAnswer ? "bg-green-500 text-white" :
                            answer !== null && i === answer ? "bg-red-500 text-white" :
                            "bg-slate-100 dark:bg-slate-700"
                          )}>{String.fromCharCode(65 + i)}</span>
                          <span className="text-sm pt-0.5">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {showExplanation && (
                    <>
                      <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <p className="text-sm">{q.explanation}</p>
                        <QuestionImage src={q.explanationImage} alt="Gambar pembahasan" />
                      </div>
                      {current < dueQuestions.length - 1 ? (
                        <button onClick={next} className="mt-3 w-full py-2.5 bg-[#0033A0] text-white rounded-xl font-semibold text-sm">
                          Soal Berikutnya →
                        </button>
                      ) : (
                        <div className="mt-3 text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                          <p className="font-bold text-green-700 dark:text-green-300">🎉 Review hari ini selesai!</p>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </Card>
        </div>
      )}
    </div>
  );
}

// ==================== QUESTION BANK ====================
function QuestionBank() {
  const { questions, setQuestions } = useApp();
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDiff, setFilterDiff] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [newQ, setNewQ] = useState({
    subject: "biologi", topic: "", subtopic: "", difficulty: "sedang",
    question: "", options: ["", "", "", "", ""], correctAnswer: 0, explanation: "", tags: [],
    image: "", explanationImage: "",
  });

  const filtered = questions.filter((q) => {
    if (filterSubject && q.subject !== filterSubject) return false;
    if (filterDiff && q.difficulty !== filterDiff) return false;
    if (search) {
      const s = search.toLowerCase();
      return q.question.toLowerCase().includes(s) || q.topic.toLowerCase().includes(s) || q.subtopic.toLowerCase().includes(s);
    }
    return true;
  });

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((q) => q.id)));
  };

  const batchDelete = () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Hapus ${selected.size} soal?`)) return;
    setQuestions((prev) => prev.filter((q) => !selected.has(q.id)));
    setSelected(new Set());
  };

  const duplicateSelected = () => {
    const dupes = questions.filter((q) => selected.has(q.id)).map((q) => ({
      ...q,
      id: `q${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      question: `[DUPLIKAT] ${q.question}`,
    }));
    setQuestions((prev) => [...prev, ...dupes]);
    setSelected(new Set());
  };

  const addQuestion = () => {
    if (!newQ.question || !newQ.topic) return alert("Isi soal dan topik!");
    setQuestions((prev) => [...prev, {
      ...newQ,
      id: `q${Date.now()}`,
      tags: [newQ.subject, newQ.topic, newQ.subtopic, newQ.difficulty].filter(Boolean),
    }]);
    setNewQ({ subject: "biologi", topic: "", subtopic: "", difficulty: "sedang", question: "", options: ["", "", "", "", ""], correctAnswer: 0, explanation: "", tags: [], image: "", explanationImage: "" });
    setShowAdd(false);
  };

  const fileInputRef = useRef(null);

  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        let qs = Array.isArray(data) ? data : data.questions || data.soal || [];
        if (!Array.isArray(qs) || qs.length === 0) {
          alert("Tidak ada soal ditemukan. Pastikan JSON berisi array soal atau object dengan key 'questions'.");
          return;
        }
        const validated = qs.map((q, i) => ({
          id: q.id || `import_${Date.now()}_${i}`,
          subject: q.subject || q.mapel || "biologi",
          topic: q.topic || q.topik || "Umum",
          subtopic: q.subtopic || q.subtopik || "Umum",
          difficulty: q.difficulty || q.kesulitan || "sedang",
          question: q.question || q.soal || q.pertanyaan || "",
          options: q.options || q.pilihan || q.opsi || ["A", "B", "C", "D", "E"],
          correctAnswer: q.correctAnswer ?? q.jawaban ?? q.correct ?? 0,
          explanation: q.explanation || q.penjelasan || q.pembahasan || "",
          image: q.image || q.gambar || q.gambarSoal || "",
          explanationImage: q.explanationImage || q.gambarPembahasan || "",
          tags: q.tags || [q.subject || "biologi", q.topic || "Umum"],
        })).filter(q => q.question.trim() !== "");
        if (validated.length === 0) {
          alert("Semua soal kosong atau format tidak sesuai.");
          return;
        }
        setQuestions((prev) => [...prev, ...validated]);
        alert(`✅ ${validated.length} soal berhasil diimpor!`);
      } catch (err) {
        alert("Format JSON tidak valid! Error: " + err.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadSampleJSON = () => {
    const sample = [
      {
        subject: "biologi",
        topic: "Sel",
        subtopic: "Struktur Sel",
        difficulty: "sedang",
        question: "Organel sel yang berfungsi sebagai pusat pengendali sel adalah...",
        options: ["Mitokondria", "Nukleus", "Ribosom", "Lisosom", "Badan Golgi"],
        correctAnswer: 1,
        explanation: "Nukleus (inti sel) mengandung DNA dan berfungsi sebagai pusat pengendali seluruh aktivitas sel.",
        image: "",
        explanationImage: ""
      },
      {
        subject: "kimia",
        topic: "Stoikiometri",
        subtopic: "Mol",
        difficulty: "mudah",
        question: "Jumlah partikel dalam 1 mol zat adalah...",
        options: ["6.02 x 10^23", "3.01 x 10^23", "6.02 x 10^22", "1.66 x 10^-24", "6.02 x 10^24"],
        correctAnswer: 0,
        explanation: "Bilangan Avogadro menyatakan bahwa 1 mol zat mengandung 6.02 x 10^23 partikel.",
        image: "https://contoh.com/gambar-soal.png (URL atau kosongkan)",
        explanationImage: "https://contoh.com/gambar-pembahasan.png (URL atau kosongkan)"
      }
    ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contoh-soal-import.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">🗃️ Bank Soal</h1>
        <div className="flex gap-2">
          <label className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium cursor-pointer">
            📥 Impor JSON
            <input ref={fileInputRef} type="file" accept=".json" onChange={importJSON} className="hidden" />
          </label>
          <button onClick={downloadSampleJSON} className="px-3 py-1.5 bg-slate-500 text-white rounded-lg text-xs font-medium">📄 Contoh Format</button>
          <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-[#0033A0] text-white rounded-lg text-xs font-medium">+ Tambah Soal</button>
        </div>
      </div>

      <div className="text-sm text-slate-500">Total: {questions.length} soal • Ditampilkan: {filtered.length}</div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Cari soal..." className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm flex-1 min-w-[200px]" />
        <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
          <option value="">Semua Mapel</option>
          {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
          <option value="">Semua Kesulitan</option>
          {DIFFICULTY.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Batch Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-sm font-medium">{selected.size} dipilih</span>
          <button onClick={batchDelete} className="px-2 py-1 bg-red-500 text-white rounded text-xs">Hapus</button>
          <button onClick={duplicateSelected} className="px-2 py-1 bg-blue-500 text-white rounded text-xs">Duplikasi</button>
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <Card>
          <h3 className="font-semibold mb-3">Tambah Soal Baru</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-500">Mapel</label>
                <select value={newQ.subject} onChange={(e) => setNewQ({ ...newQ, subject: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
                  {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Topik</label>
                <input type="text" value={newQ.topic} onChange={(e) => setNewQ({ ...newQ, topic: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Subtopik</label>
                <input type="text" value={newQ.subtopic} onChange={(e) => setNewQ({ ...newQ, subtopic: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Kesulitan</label>
                <select value={newQ.difficulty} onChange={(e) => setNewQ({ ...newQ, difficulty: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
                  {DIFFICULTY.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Soal</label>
              <textarea value={newQ.question} onChange={(e) => setNewQ({ ...newQ, question: e.target.value })} rows={3}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <ImageUploadButton value={newQ.image} onChange={(v) => setNewQ({ ...newQ, image: v })} label="Gambar Soal (opsional)" />
            {newQ.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={newQ.correctAnswer === i} onChange={() => setNewQ({ ...newQ, correctAnswer: i })} />
                <span className="text-xs font-bold w-5">{String.fromCharCode(65 + i)}</span>
                <input type="text" value={opt} onChange={(e) => {
                  const opts = [...newQ.options];
                  opts[i] = e.target.value;
                  setNewQ({ ...newQ, options: opts });
                }} placeholder={`Opsi ${String.fromCharCode(65 + i)}`}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
              </div>
            ))}
            <div>
              <label className="text-xs text-slate-500">Pembahasan</label>
              <textarea value={newQ.explanation} onChange={(e) => setNewQ({ ...newQ, explanation: e.target.value })} rows={2}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <ImageUploadButton value={newQ.explanationImage} onChange={(v) => setNewQ({ ...newQ, explanationImage: v })} label="Gambar Pembahasan (opsional)" />
            <button onClick={addQuestion} className="px-4 py-2 bg-[#0033A0] text-white rounded-lg text-sm font-medium">Simpan Soal</button>
          </div>
        </Card>
      )}

      {/* Question List */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} />
          <span className="text-xs text-slate-500">Pilih Semua</span>
        </div>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filtered.slice(0, 100).map((q) => {
            const sub = SUBJECTS.find((s) => s.id === q.subject);
            return (
              <div key={q.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSelect(q.id)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs" style={{ color: sub?.color }}>{sub?.icon}</span>
                    <span className="text-xs text-slate-500">{q.topic} • {q.subtopic}</span>
                    <DifficultyBadge difficulty={q.difficulty} small />
                    {q.image && <span className="text-xs" title="Ada gambar">🖼️</span>}
                  </div>
                  <p className="text-sm truncate">{q.question}</p>
                </div>
              </div>
            );
          })}
          {filtered.length > 100 && <p className="text-xs text-center text-slate-400 py-2">Menampilkan 100 dari {filtered.length} soal</p>}
        </div>
      </Card>
    </div>
  );
}

// ==================== SETTINGS ====================
function Settings({ exportData, importData }) {
  const { darkMode, setDarkMode, fontSize, setFontSize, userName, setUserName, goals, setGoals, questions } = useApp();

  return (
    <div className="space-y-4 animate-in">
      <h1 className="text-2xl font-bold">⚙️ Pengaturan</h1>

      <Card title="👤 Profil">
        <div>
          <label className="text-xs text-slate-500">Nama</label>
          <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
        </div>
      </Card>

      <Card title="🎯 Target">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Target Skor</label>
            <input type="number" value={goals.score} onChange={(e) => setGoals({ ...goals, score: parseInt(e.target.value) })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Target Akurasi (%)</label>
            <input type="number" value={goals.accuracy} onChange={(e) => setGoals({ ...goals, accuracy: parseInt(e.target.value) })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Target Waktu/Soal (detik)</label>
            <input type="number" value={goals.timePerQ} onChange={(e) => setGoals({ ...goals, timePerQ: parseInt(e.target.value) })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Target Hari Persiapan</label>
            <input type="number" value={goals.days} onChange={(e) => setGoals({ ...goals, days: parseInt(e.target.value) })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
          </div>
        </div>
      </Card>

      <Card title="🎨 Tampilan">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Dark Mode</span>
            <button onClick={() => setDarkMode(!darkMode)}
              className={cn("w-12 h-6 rounded-full transition-all relative", darkMode ? "bg-blue-600" : "bg-slate-300")}>
              <div className={cn("w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all", darkMode ? "left-6" : "left-0.5")} />
            </button>
          </div>
          <div>
            <span className="text-sm">Ukuran Font</span>
            <div className="flex gap-2 mt-1">
              {[["small", "Kecil"], ["normal", "Normal"], ["large", "Besar"], ["xl", "Sangat Besar"]].map(([val, label]) => (
                <button key={val} onClick={() => setFontSize(val)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium", fontSize === val ? "bg-[#0033A0] text-white" : "bg-slate-100 dark:bg-slate-800")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="💾 Data">
        <div className="space-y-3">
          <div className="text-sm text-slate-500">Bank soal: {questions.length} soal</div>
          <div className="flex gap-2">
            <button onClick={exportData} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">📤 Ekspor Semua Data</button>
            <label className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer">
              📥 Impor Data
              <input type="file" accept=".json" onChange={importData} className="hidden" />
            </label>
          </div>
          <button onClick={() => {
            if (window.confirm("Hapus semua data? Ini tidak bisa dibatalkan!")) {
              localStorage.clear();
              window.location.reload();
            }
          }} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">🗑️ Reset Semua Data</button>
        </div>
      </Card>

      <Card title="⌨️ Keyboard Shortcuts">
        <div className="space-y-1 text-sm text-slate-500">
          <p>Ctrl + ← / → : Navigasi soal</p>
          <p>Ctrl + 1-5 : Pilih jawaban A-E</p>
          <p>Ctrl + F : Tandai ragu</p>
          <p>Ctrl + Enter : Submit try out</p>
        </div>
      </Card>
    </div>
  );
}

// ==================== SHARED COMPONENTS ====================
function Card({ title, children, className: cls }) {
  return (
    <div className={cn("bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm", cls)}>
      {title && <h3 className="font-semibold text-sm mb-3">{title}</h3>}
      {children}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-8 text-slate-400 dark:text-slate-500">
      <div className="text-3xl mb-2">📭</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function DifficultyBadge({ difficulty, small }) {
  const colors = { mudah: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", sedang: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", sulit: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  return (
    <span className={cn("rounded-full font-medium", colors[difficulty], small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs")}>
      {difficulty}
    </span>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2"><span>{icon}</span> {label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, color, icon }) {
  return (
    <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="text-lg">{icon}</div>
      <div className={cn("text-xl font-bold", color)}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function DiffBadgeSmall({ d, pct }) {
  const colors = { mudah: "bg-green-100 text-green-700", sedang: "bg-amber-100 text-amber-700", sulit: "bg-red-100 text-red-700" };
  return (
    <span className={cn("px-2.5 py-1 rounded-lg text-xs font-medium", colors[d])}>{d}: {pct}</span>
  );
}
