import React, { useEffect, useMemo, useRef, useState } from "react";

const NOTE_CATEGORIES = ["Contest","Stoppage","Defence","Transition","Forward 50","Opposition","Individual","Set Play","Intensity","Decision Making","General"];
const KEYWORDS = {
  Contest: ["contest", "ground ball", "aerial", "body", "pressure", "tackle", "hunt", "compete", "hard ball"],
  Stoppage: ["stoppage", "ball up", "throw in", "clearance", "ruck", "hitout", "midfield", "centre", "bounce"],
  Defence: ["defence", "defense", "backline", "behind", "mark up", "spoil", "intercept", "shape", "zone", "switch off"],
  Transition: ["transition", "spread", "run", "overlap", "rebound", "switch", "corridor", "wings", "outside"],
  "Forward 50": ["forward", "inside 50", "goal", "crumb", "lead", "entry", "shot", "pressure forward", "small forward"],
  Opposition: ["opposition", "they", "their", "number", "player", "kew", "collegians", "caulfield", "marcellin", "beaumaris"],
  Individual: ["she", "her", "player", "role", "wing", "half back", "mid", "ruck", "captain", "name"],
  "Set Play": ["set play", "kick in", "restart", "structure", "setup", "signal", "pattern", "planned"],
  Intensity: ["intensity", "effort", "work rate", "energy", "urgency", "repeat", "chase", "pressure"],
  "Decision Making": ["decision", "option", "kick", "handball", "overuse", "hold", "first give", "awareness", "scan"],
};
function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds)) return "00:00";
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${String(hrs).padStart(2,"0")}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
  return `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
}
function detectCategory(text) {
  const lower = text.toLowerCase();
  let best = { category: "General", score: 0 };
  Object.entries(KEYWORDS).forEach(([category, words]) => {
    const score = words.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
    if (score > best.score) best = { category, score };
  });
  return best.category;
}
function detectTone(text) {
  const positive = ["good", "great", "excellent", "love", "strong", "perfect", "smart", "clean", "well done", "win"];
  const improve = ["need", "must", "late", "miss", "poor", "slow", "danger", "wrong", "exposed", "fix", "work on"];
  const lower = text.toLowerCase();
  const p = positive.filter((w) => lower.includes(w)).length;
  const i = improve.filter((w) => lower.includes(w)).length;
  if (p > i) return "Reinforce";
  if (i > p) return "Improve";
  return "Observe";
}
function buildInterpretation(text, category, tone) {
  const clean = text.trim();
  if (!clean) return "";
  const actionPrefix = tone === "Reinforce" ? "Keep reinforcing" : tone === "Improve" ? "Coaching focus" : "Observation";
  const short = clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
  return `${actionPrefix}: ${category.toLowerCase()} theme — ${short}`;
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function csvEscape(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
export default function App() {
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const [videoName, setVideoName] = useState("No video loaded");
  const [videoUrl, setVideoUrl] = useState("");
  const [gameTitle, setGameTitle] = useState("Old Brighton Women's Team - Match Review");
  const [opponent, setOpponent] = useState("");
  const [round, setRound] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [notes, setNotes] = useState(() => { try { return JSON.parse(localStorage.getItem("obgfcCoachNotes") || "[]"); } catch { return []; } });
  const [manualNote, setManualNote] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("General");
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [status, setStatus] = useState("Load a match video, press play, then start commentary.");
  useEffect(() => { localStorage.setItem("obgfcCoachNotes", JSON.stringify(notes)); }, [notes]);
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); if (recognitionRef.current) recognitionRef.current.stop(); }, [videoUrl]);
  const filteredNotes = useMemo(() => {
    const query = search.toLowerCase();
    return notes.filter((note) => (activeFilter === "All" || note.category === activeFilter) && (!query || `${note.raw} ${note.interpretation} ${note.category} ${note.tone}`.toLowerCase().includes(query)));
  }, [notes, activeFilter, search]);
  const summary = useMemo(() => ({
    byCategory: NOTE_CATEGORIES.map((cat) => ({ category: cat, count: notes.filter((n) => n.category === cat).length })).filter((x) => x.count > 0),
    improve: notes.filter((n) => n.tone === "Improve").length,
    reinforce: notes.filter((n) => n.tone === "Reinforce").length,
    observe: notes.filter((n) => n.tone === "Observe").length,
  }), [notes]);
  function handleVideoUpload(event) { const file = event.target.files?.[0]; if (!file) return; if (videoUrl) URL.revokeObjectURL(videoUrl); const url = URL.createObjectURL(file); setVideoUrl(url); setVideoName(file.name); setStatus("Video loaded. Commentary timestamps will follow the video clock."); }
  async function captureScreenVideo() { try { if (!navigator.mediaDevices?.getDisplayMedia) { setStatus("This browser does not support screen capture. Upload a video file instead."); return; } const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.controls = true; videoRef.current.play(); } setVideoName("Live screen capture / opposition footage"); setStatus("Screen capture is showing in the video pane. Start commentary when ready."); } catch { setStatus("Screen capture was cancelled or blocked by the browser."); } }
  function addNote(rawText, forcedCategory) { const text = rawText.trim(); if (!text) return; const currentTime = videoRef.current?.currentTime || 0; const category = forcedCategory || detectCategory(text); const tone = detectTone(text); const note = { id: crypto.randomUUID(), time: currentTime, label: formatTime(currentTime), raw: text, category, tone, interpretation: buildInterpretation(text, category, tone), createdAt: new Date().toISOString() }; setNotes((prev) => [note, ...prev]); setLiveTranscript(""); setStatus(`Added ${category} note at ${note.label}.`); }
  function startListening() { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SpeechRecognition) { setSpeechSupported(false); setStatus("Speech recognition is not supported in this browser. Chrome or Edge is recommended."); return; } const recognition = new SpeechRecognition(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = "en-AU"; recognition.onstart = () => { setIsListening(true); setStatus("Listening. Speak naturally while the footage plays."); }; recognition.onresult = (event) => { let interim = ""; for (let i = event.resultIndex; i < event.results.length; i++) { const transcript = event.results[i][0].transcript; if (event.results[i].isFinal) addNote(transcript); else interim += transcript; } setLiveTranscript(interim); }; recognition.onerror = (event) => setStatus(`Speech recognition issue: ${event.error}. You can still add manual notes.`); recognition.onend = () => { setIsListening(false); if (recognitionRef.current) setStatus("Commentary stopped. You can restart or export notes."); }; recognitionRef.current = recognition; recognition.start(); }
  function stopListening() { if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; } setIsListening(false); setLiveTranscript(""); }
  function jumpTo(seconds) { if (!videoRef.current) return; videoRef.current.currentTime = seconds; videoRef.current.play(); }
  function exportMarkdown() { const lines = [`# ${gameTitle || "Match Review"}`]; if (opponent || round) lines.push(`**Opponent:** ${opponent || "-"}  |  **Round:** ${round || "-"}`); lines.push(`**Video:** ${videoName}`, `**Generated:** ${new Date().toLocaleString()}`, "", "## Coaching Summary", `- Reinforce moments: ${summary.reinforce}`, `- Improvement moments: ${summary.improve}`, `- Observation moments: ${summary.observe}`); summary.byCategory.forEach((x) => lines.push(`- ${x.category}: ${x.count}`)); lines.push("", "## Timestamped Notes"); [...notes].reverse().forEach((n) => lines.push(`### ${n.label} - ${n.category} - ${n.tone}`, `**Commentary:** ${n.raw}`, `**Interpretation:** ${n.interpretation}`, "")); downloadFile("obgfc-coaching-notes.md", lines.join("\n"), "text/markdown"); }
  function exportCsv() { const header = ["Time", "Category", "Tone", "Commentary", "Interpretation", "Created At"]; const rows = notes.map((n) => [n.label, n.category, n.tone, n.raw, n.interpretation, n.createdAt]); downloadFile("obgfc-coaching-notes.csv", [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n"), "text/csv"); }
  function exportJson() { downloadFile("obgfc-coaching-notes.json", JSON.stringify({ gameTitle, opponent, round, videoName, notes }, null, 2), "application/json"); }
  function clearNotes() { setNotes([]); setStatus("Notes cleared for this device."); }
  return <div className="min-h-screen bg-slate-950 text-slate-100"><div className="mx-auto max-w-7xl px-4 py-6"><header className="mb-6 rounded-3xl bg-gradient-to-r from-sky-800 via-slate-900 to-orange-700 p-6 shadow-2xl"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm uppercase tracking-[0.25em] text-sky-100/80">Old Brighton Women's Team</p><h1 className="mt-2 text-3xl font-black md:text-5xl">Video Commentary Coach Notes</h1><p className="mt-2 max-w-3xl text-slate-200">Load a match or opposition video, talk through what you see, and turn commentary into timestamped coaching notes.</p></div><div className="rounded-2xl bg-white/10 px-4 py-3 text-sm backdrop-blur"><div className="font-semibold">Status</div><div className="text-slate-200">{status}</div></div></div></header><section className="mb-6 grid gap-4 rounded-3xl bg-slate-900 p-4 shadow-xl md:grid-cols-4"><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-slate-300">Review title</span><input value={gameTitle} onChange={(e) => setGameTitle(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400" /></label><label><span className="mb-1 block text-sm font-semibold text-slate-300">Opponent</span><input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="e.g. Kew" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400" /></label><label><span className="mb-1 block text-sm font-semibold text-slate-300">Round / game</span><input value={round} onChange={(e) => setRound(e.target.value)} placeholder="e.g. Round 14" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400" /></label></section><main className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]"><section className="rounded-3xl bg-slate-900 p-4 shadow-xl"><div className="mb-4 flex flex-wrap items-center gap-3"><label className="cursor-pointer rounded-2xl bg-sky-500 px-4 py-2 font-bold text-white shadow hover:bg-sky-400">Load video<input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" /></label><button onClick={captureScreenVideo} className="rounded-2xl bg-slate-800 px-4 py-2 font-bold text-slate-100 hover:bg-slate-700">Capture screen</button><button onClick={() => videoRef.current?.play()} className="rounded-2xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500">Play</button><button onClick={() => videoRef.current?.pause()} className="rounded-2xl bg-amber-600 px-4 py-2 font-bold text-white hover:bg-amber-500">Pause</button><span className="ml-auto rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">{videoName}</span></div><div className="overflow-hidden rounded-3xl border border-slate-800 bg-black"><video ref={videoRef} src={videoUrl} controls className="aspect-video w-full bg-black" /></div><div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950 p-4"><div className="flex flex-wrap items-center gap-3">{!isListening ? <button onClick={startListening} className="rounded-2xl bg-orange-600 px-5 py-3 font-black text-white hover:bg-orange-500">Start commentary</button> : <button onClick={stopListening} className="rounded-2xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-500">Stop commentary</button>}<span className={`rounded-full px-3 py-1 text-sm font-semibold ${isListening ? "bg-red-500/20 text-red-200" : "bg-slate-800 text-slate-300"}`}>{isListening ? "Recording voice" : "Voice off"}</span>{!speechSupported && <span className="text-sm text-amber-300">Speech recognition unavailable in this browser.</span>}</div><div className="mt-3 min-h-14 rounded-2xl bg-slate-900 p-3 text-slate-300">{liveTranscript || "Live transcript will appear here while you speak. Final phrases become timestamped notes automatically."}</div></div><div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950 p-4"><h2 className="text-xl font-black">Add manual coaching note</h2><div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px_auto]"><input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Type a quick timestamped note..." className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-sky-400" /><select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-sky-400">{NOTE_CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}</select><button onClick={() => { addNote(manualNote, selectedCategory); setManualNote(""); }} className="rounded-2xl bg-sky-500 px-5 py-3 font-bold text-white hover:bg-sky-400">Add</button></div></div></section><aside className="space-y-6"><section className="rounded-3xl bg-slate-900 p-5 shadow-xl"><h2 className="text-xl font-black">Interpretation summary</h2><div className="mt-4 grid grid-cols-3 gap-3 text-center"><div className="rounded-2xl bg-emerald-500/15 p-3"><div className="text-2xl font-black text-emerald-300">{summary.reinforce}</div><div className="text-xs text-slate-300">Reinforce</div></div><div className="rounded-2xl bg-orange-500/15 p-3"><div className="text-2xl font-black text-orange-300">{summary.improve}</div><div className="text-xs text-slate-300">Improve</div></div><div className="rounded-2xl bg-sky-500/15 p-3"><div className="text-2xl font-black text-sky-300">{summary.observe}</div><div className="text-xs text-slate-300">Observe</div></div></div><div className="mt-4 space-y-2">{summary.byCategory.length === 0 && <div className="text-sm text-slate-400">No notes yet. Start commentary to build themes.</div>}{summary.byCategory.map((x) => <div key={x.category} className="flex items-center justify-between rounded-2xl bg-slate-950 px-3 py-2 text-sm"><span>{x.category}</span><span className="font-black text-sky-300">{x.count}</span></div>)}</div></section><section className="rounded-3xl bg-slate-900 p-5 shadow-xl"><h2 className="text-xl font-black">Export</h2><div className="mt-3 grid grid-cols-3 gap-2"><button onClick={exportMarkdown} className="rounded-2xl bg-slate-800 px-3 py-2 font-bold hover:bg-slate-700">MD</button><button onClick={exportCsv} className="rounded-2xl bg-slate-800 px-3 py-2 font-bold hover:bg-slate-700">CSV</button><button onClick={exportJson} className="rounded-2xl bg-slate-800 px-3 py-2 font-bold hover:bg-slate-700">JSON</button></div><button onClick={clearNotes} className="mt-3 w-full rounded-2xl bg-red-500/20 px-3 py-2 font-bold text-red-200 hover:bg-red-500/30">Clear notes</button></section></aside></main><section className="mt-6 rounded-3xl bg-slate-900 p-5 shadow-xl"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><h2 className="text-2xl font-black">Timestamped coaching notes</h2><div className="flex flex-wrap gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes..." className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 outline-none focus:border-sky-400" /><select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 outline-none focus:border-sky-400"><option>All</option>{NOTE_CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}</select></div></div><div className="mt-4 grid gap-3">{filteredNotes.length === 0 && <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">No matching notes yet.</div>}{filteredNotes.map((note) => <article key={note.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-4"><div className="flex flex-wrap items-center gap-2"><button onClick={() => jumpTo(note.time)} className="rounded-full bg-sky-500 px-3 py-1 font-black text-white hover:bg-sky-400">{note.label}</button><span className="rounded-full bg-slate-800 px-3 py-1 text-sm">{note.category}</span><span className={`rounded-full px-3 py-1 text-sm font-bold ${note.tone === "Improve" ? "bg-orange-500/20 text-orange-200" : note.tone === "Reinforce" ? "bg-emerald-500/20 text-emerald-200" : "bg-sky-500/20 text-sky-200"}`}>{note.tone}</span><button onClick={() => setNotes((prev) => prev.filter((n) => n.id !== note.id))} className="ml-auto rounded-full bg-red-500/10 px-3 py-1 text-sm font-bold text-red-200 hover:bg-red-500/20">Delete</button></div><p className="mt-3 text-slate-200"><span className="font-bold text-slate-400">Commentary:</span> {note.raw}</p><p className="mt-2 text-slate-300"><span className="font-bold text-slate-400">Interpretation:</span> {note.interpretation}</p></article>)}</div></section></div></div>;
}
