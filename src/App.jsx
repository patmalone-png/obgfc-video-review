import React, { useEffect, useMemo, useRef, useState } from "react";

const THEMES = [
  "Contest", "Pressure", "Clearance", "Turnover", "Defensive Transition", "Forward-half Pressure",
  "Stoppage Shape", "Ball Movement", "Inside 50", "Opposition Threat", "Individual Development",
  "Set Play", "Leadership / Communication", "Work Rate", "Game Sense", "General"
];
const QUARTERS = ["Pre-game", "Q1", "Quarter-time", "Q2", "Half-time", "Q3", "Three-quarter-time", "Q4", "Post-game"];
const PLAYERS = Array.from({ length: 60 }, (_, i) => String(i + 1));
const QUICK_TAGS = ["Great", "Fix", "Watch", "Clip", "Training", "Quarter-time", "Opposition", "Player", "Momentum", "Effort"];
const KEYWORDS = {
  "Contest": ["contest", "ground ball", "aerial", "body", "hard ball", "one on one", "first possession", "compete"],
  "Pressure": ["pressure", "tackle", "hunt", "chase", "harass", "corrall", "closing speed", "urgency"],
  "Clearance": ["clearance", "centre bounce", "stoppage", "ruck", "hitout", "inside mid", "extract", "throw in"],
  "Turnover": ["turnover", "missed target", "intercept", "gave it back", "poor kick", "bad option", "overuse", "fumble"],
  "Defensive Transition": ["defensive transition", "transition defence", "fold back", "goal side", "weak side", "mark up", "out the back", "exposed"],
  "Forward-half Pressure": ["forward pressure", "front half", "lock it in", "repeat entry", "crumb", "small forward"],
  "Stoppage Shape": ["stoppage shape", "defensive side", "sweep", "setup", "structure", "outside mid", "exit"],
  "Ball Movement": ["switch", "corridor", "overlap", "width", "spread", "handball receive", "run", "outside"],
  "Inside 50": ["inside 50", "forward entry", "lead", "shot", "goal", "deep", "pocket", "square"],
  "Opposition Threat": ["opposition", "their", "danger", "watch number", "match up", "loose", "tag", "scout"],
  "Individual Development": ["player", "role", "decision", "wing", "mid", "half back", "ruck", "confidence"],
  "Set Play": ["set play", "kick in", "restart", "signal", "planned", "outlet", "pattern"],
  "Leadership / Communication": ["talk", "voice", "communicate", "organise", "organize", "direct", "leader", "calm"],
  "Work Rate": ["work rate", "repeat", "effort", "run both ways", "spread hard", "chase back"],
  "Game Sense": ["scan", "awareness", "decision", "hold", "tempo", "slow it", "take space"]
};
const POSITIVE = ["good", "great", "excellent", "love", "strong", "perfect", "smart", "clean", "well done", "win", "nailed", "brilliant", "better"];
const IMPROVE = ["need", "must", "late", "miss", "poor", "slow", "danger", "wrong", "exposed", "fix", "work on", "too easy", "lost", "lazy"];

function pad(n){ return String(n).padStart(2,"0"); }
function clockLabel(seconds){ const s = Math.max(0, Math.floor(Number.isFinite(seconds)?seconds:0)); return `${pad(Math.floor(s/60))}:${pad(s%60)}`; }
function detectTheme(text){ const lower = text.toLowerCase(); let best = ["General",0]; Object.entries(KEYWORDS).forEach(([theme, words]) => { const score = words.reduce((n,w)=>n+(lower.includes(w)?1:0),0); if(score>best[1]) best=[theme,score]; }); return best[0]; }
function detectTone(text){ const lower=text.toLowerCase(); const p=POSITIVE.filter(w=>lower.includes(w)).length; const i=IMPROVE.filter(w=>lower.includes(w)).length; if(p>i) return "Rose"; if(i>p) return "Thorn"; return "Bud"; }
function detectScope(text){ const lower=text.toLowerCase(); if(lower.includes("opposition") || lower.includes("their ") || lower.includes("they ") || lower.includes("watch number")) return "Opposition"; return "Us"; }
function detectPlayer(text){ const lower = text.toLowerCase(); const patterns = [/\bnumber\s+(\d{1,2})\b/i, /\bno\.\s*(\d{1,2})\b/i, /#\s*(\d{1,2})\b/i, /\bplayer\s+(\d{1,2})\b/i]; for(const p of patterns){ const m = lower.match(p); if(m && Number(m[1])>=1 && Number(m[1])<=60) return String(Number(m[1])); } return ""; }
function detectTag(text){ const lower=text.toLowerCase(); if(lower.includes("clip")) return "Clip"; if(lower.includes("quarter time") || lower.includes("quarter-time")) return "Quarter-time"; if(lower.includes("training")) return "Training"; if(lower.includes("watch")) return "Watch"; if(lower.includes("fix")) return "Fix"; if(lower.includes("great")) return "Great"; return "Voice"; }
function countBy(items,key){ return items.reduce((acc,item)=>{ const v=item[key]||"Unassigned"; acc[v]=(acc[v]||0)+1; return acc; },{}); }
function csvEscape(v){ return `"${String(v??"").replaceAll('"','""')}"`; }
function download(name, content, type){ const blob = new Blob([content], { type }); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function safeHtml(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

export default function App(){
  const recognitionRef = useRef(null);
  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const [matchTitle,setMatchTitle]=useState("Old Brighton Women's Team - Match Day Mic Review V4");
  const [opponent,setOpponent]=useState("");
  const [venue,setVenue]=useState("");
  const [quarter,setQuarter]=useState("Q1");
  const [clock,setClock]=useState(0);
  const [clockRunning,setClockRunning]=useState(false);
  const [scope,setScope]=useState("Auto");
  const [player,setPlayer]=useState("Auto");
  const [theme,setTheme]=useState("Auto-detect");
  const [manual,setManual]=useState("");
  const [live,setLive]=useState("");
  const [status,setStatus]=useState("Ready. Start the quarter clock, then start live transcription and audio backup.");
  const [listening,setListening]=useState(false);
  const [recording,setRecording]=useState(false);
  const [audioUrl,setAudioUrl]=useState("");
  const [filter,setFilter]=useState("All");
  const [notes,setNotes]=useState(()=>{ try{return JSON.parse(localStorage.getItem("obgfcV4Notes")||"[]");}catch{return [];} });
  const [season,setSeason]=useState(()=>{ try{return JSON.parse(localStorage.getItem("obgfcV4Season")||"[]");}catch{return [];} });

  useEffect(()=>localStorage.setItem("obgfcV4Notes", JSON.stringify(notes)),[notes]);
  useEffect(()=>localStorage.setItem("obgfcV4Season", JSON.stringify(season)),[season]);
  useEffect(()=>{ if(clockRunning){ timerRef.current=setInterval(()=>setClock(c=>c+1),1000); } else if(timerRef.current){ clearInterval(timerRef.current); } return ()=>{ if(timerRef.current) clearInterval(timerRef.current); }; },[clockRunning]);

  const intel = useMemo(()=>{
    const rose=notes.filter(n=>n.tone==="Rose"), bud=notes.filter(n=>n.tone==="Bud"), thorn=notes.filter(n=>n.tone==="Thorn");
    const topThemes=Object.entries(countBy(notes,"theme")).sort((a,b)=>b[1]-a[1]);
    const training=Object.entries(countBy(thorn,"theme")).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const players=Object.entries(countBy(notes.filter(n=>n.player),"player")).sort((a,b)=>b[1]-a[1]);
    const opp=notes.filter(n=>n.scope==="Opposition");
    const oppThemes=Object.entries(countBy(opp,"theme")).sort((a,b)=>b[1]-a[1]);
    const clips=notes.filter(n=>n.tag==="Clip" || n.raw.toLowerCase().includes("clip"));
    const actions=training.map(([t,c],i)=>({ title:`${i+1}. ${t}`, detail:`${c} thorn comment${c===1?"":"s"}. Convert into a training constraint, quarter-time cue, or simple game-day behaviour.` }));
    while(actions.length<5) actions.push({ title:`${actions.length+1}. Capture more evidence`, detail:"Use voice notes or quick buttons to build a sharper action list." });
    return { rose,bud,thorn,topThemes,training,players,opp,oppThemes,clips,actions };
  },[notes]);

  const shown = useMemo(()=>notes.filter(n=>filter==="All" || [n.quarter,n.scope,n.theme,n.tone,n.tag,n.player?`#${n.player}`:""].includes(filter)),[notes,filter]);

  function addNote(rawInput, overrides={}){
    const raw=rawInput.trim(); if(!raw) return;
    const autoPlayer=detectPlayer(raw);
    const resolvedPlayer = overrides.player ?? (player==="Auto" ? autoPlayer : player);
    const resolvedScope = overrides.scope ?? (scope==="Auto" ? detectScope(raw) : scope);
    const resolvedTheme = overrides.theme ?? (theme==="Auto-detect" ? detectTheme(raw) : theme);
    const resolvedTone = overrides.tone ?? detectTone(raw);
    const resolvedTag = overrides.tag ?? detectTag(raw);
    const note={ id:crypto.randomUUID(), matchTitle, opponent, venue, quarter, clock, clockLabel:clockLabel(clock), scope:resolvedScope, player:resolvedPlayer, theme:resolvedTheme, tone:resolvedTone, tag:resolvedTag, raw, interpretation:`${resolvedTone}: ${resolvedScope}${resolvedPlayer?` #${resolvedPlayer}`:""} - ${resolvedTheme}. ${raw}`, createdAt:new Date().toISOString() };
    setNotes(prev=>[note,...prev]);
  }

  function startQuarter(q){ setQuarter(q); setClock(0); setClockRunning(false); }
  function addQuick(tag){
    const text = tag==="Great"?"Great moment. Reinforce this behaviour.":tag==="Fix"?"Fix this. Needs coaching attention.":tag==="Watch"?"Watch this pattern again after the game.":tag==="Clip"?"Clip this moment for video review.":tag==="Training"?"Training theme from match-day observation.":tag==="Quarter-time"?"Quarter-time message. Keep it clear and simple.":tag==="Opposition"?"Opposition pattern or threat identified.":tag==="Momentum"?"Momentum shift. Capture what changed.":tag==="Effort"?"Effort and work-rate note.":"Player-specific development note.";
    addNote(text,{ tag, scope:tag==="Opposition"?"Opposition":undefined });
  }

  function startSpeech(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){ setStatus("Speech recognition is unavailable in this browser. Use Chrome or Edge."); return; }
    const rec=new SR(); rec.continuous=true; rec.interimResults=true; rec.lang="en-AU";
    rec.onstart=()=>{ setListening(true); setStatus("Live transcription on. Spoken coaching comments will become timestamped notes."); };
    rec.onresult=(e)=>{ let interim=""; for(let i=e.resultIndex;i<e.results.length;i++){ const t=e.results[i][0].transcript; if(e.results[i].isFinal) addNote(t); else interim+=t; } setLive(interim); };
    rec.onerror=(e)=>setStatus(`Speech issue: ${e.error}. Use quick or manual notes if needed.`);
    rec.onend=()=>{ setListening(false); if(recognitionRef.current) setStatus("Speech paused. Restart live transcription if needed."); };
    recognitionRef.current=rec; rec.start();
  }
  function stopSpeech(){ if(recognitionRef.current){ recognitionRef.current.stop(); recognitionRef.current=null; } setListening(false); setLive(""); setStatus("Live transcription off."); }
  async function startAudio(){
    try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true}); const rec=new MediaRecorder(stream); audioChunksRef.current=[]; rec.ondataavailable=e=>{ if(e.data.size>0) audioChunksRef.current.push(e.data); }; rec.onstop=()=>{ const blob=new Blob(audioChunksRef.current,{type:"audio/webm"}); setAudioUrl(URL.createObjectURL(blob)); stream.getTracks().forEach(t=>t.stop()); }; recorderRef.current=rec; rec.start(); setRecording(true); setStatus("Audio backup recording on."); } catch { setStatus("Audio recording permission blocked or unavailable."); }
  }
  function stopAudio(){ if(recorderRef.current && recorderRef.current.state!=="inactive") recorderRef.current.stop(); setRecording(false); }
  function exportAudio(){ if(!audioUrl) return; const a=document.createElement("a"); a.href=audioUrl; a.download="obgfc-v4-match-audio.webm"; document.body.appendChild(a); a.click(); a.remove(); }

  function summaryText(){
    const lines=[`# ${matchTitle}`,`Opponent: ${opponent||"-"}`,`Venue: ${venue||"-"}`,`Generated: ${new Date().toLocaleString()}`,"","## Rose / Bud / Thorn",`Rose: ${intel.rose.length}`,`Bud: ${intel.bud.length}`,`Thorn: ${intel.thorn.length}`,"","## Main Themes"];
    if(!intel.topThemes.length) lines.push("No themes captured yet."); else intel.topThemes.slice(0,10).forEach(([t,c])=>lines.push(`- ${t}: ${c}`));
    lines.push("","## Top 5 Coaching Actions"); intel.actions.forEach(a=>lines.push(`- ${a.title}: ${a.detail}`));
    lines.push("","## Opposition Scout"); if(!intel.oppThemes.length) lines.push("No opposition-specific moments captured yet."); else intel.oppThemes.forEach(([t,c])=>lines.push(`- ${t}: ${c}`));
    lines.push("","## Player Mentions"); if(!intel.players.length) lines.push("No player-specific tags captured yet."); else intel.players.slice(0,20).forEach(([p,c])=>lines.push(`- #${p}: ${c}`));
    lines.push("","## Clip List"); if(!intel.clips.length) lines.push("No clip moments captured yet."); else intel.clips.forEach(n=>lines.push(`- ${n.quarter} ${n.clockLabel}: ${n.raw}`));
    lines.push("","## Timestamped Calls"); [...notes].reverse().forEach(n=>lines.push(`- ${n.quarter} ${n.clockLabel} | ${n.scope}${n.player?` #${n.player}`:""} | ${n.theme} | ${n.tone} | ${n.tag}: ${n.raw}`));
    return lines.join("\n");
  }
  function exportMarkdown(){ download("obgfc-v4-match-report.md", summaryText(), "text/markdown"); }
  function exportCsv(){ const h=["Match","Opponent","Venue","Quarter","Clock","Scope","Player","Theme","Tone","Tag","Raw","Interpretation","Created At"]; const rows=notes.map(n=>[n.matchTitle,n.opponent,n.venue,n.quarter,n.clockLabel,n.scope,n.player,n.theme,n.tone,n.tag,n.raw,n.interpretation,n.createdAt]); download("obgfc-v4-notes.csv", [h,...rows].map(r=>r.map(csvEscape).join(",")).join("\n"), "text/csv"); }
  function exportJson(){ download("obgfc-v4-season-data.json", JSON.stringify({matchTitle,opponent,venue,notes,season},null,2), "application/json"); }
  function exportWord(){ const body=safeHtml(summaryText()).replaceAll("\n","<br/>"); const html=`<!doctype html><html><head><meta charset="utf-8"><title>${safeHtml(matchTitle)}</title><style>body{font-family:Arial,sans-serif;color:#111;line-height:1.4}h1{color:#0f172a}h2{color:#075985;border-bottom:1px solid #ccc;padding-bottom:4px}</style></head><body>${body}</body></html>`; download("obgfc-v4-match-report.doc", html, "application/msword"); }
  function saveSnapshot(){ setSeason(prev=>[{id:crypto.randomUUID(),matchTitle,opponent,venue,createdAt:new Date().toISOString(),notes,summary:summaryText()},...prev]); setStatus("Saved match snapshot to local season memory."); }
  function importJson(e){ const file=e.target.files?.[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result); if(Array.isArray(data.notes)) setNotes(data.notes); if(Array.isArray(data.season)) setSeason(data.season); setStatus("Imported JSON data."); }catch{ setStatus("Could not import JSON file."); } }; reader.readAsText(file); }

  return <div className="app"><div className="wrap"><header className="hero"><div className="eyebrow">Old Brighton Women's Team</div><h1>V4 Match Day Intelligence</h1><p>Mic capture, auto player detection, live clock, clip markers, opposition scouting, season memory and Word export.</p><div className="status"><b>Status:</b> {status}</div></header>
  <section className="card grid four top"><label className="wide"><span>Match title</span><input value={matchTitle} onChange={e=>setMatchTitle(e.target.value)} /></label><label><span>Opponent</span><input value={opponent} onChange={e=>setOpponent(e.target.value)} placeholder="e.g. Kew" /></label><label><span>Venue</span><input value={venue} onChange={e=>setVenue(e.target.value)} placeholder="e.g. Brighton Beach Oval" /></label></section>
  <main className="grid two top"><section className="card no-print"><div className="grid two"><div><div className="muted">Quarter clock</div><div className="clock">{clockLabel(clock)}</div><div className="actions"><button className={clockRunning?"red":"green"} onClick={()=>setClockRunning(v=>!v)}>{clockRunning?"Pause clock":"Start clock"}</button><button onClick={()=>setClock(0)}>Reset</button><button onClick={()=>setClock(c=>Math.max(0,c-10))}>-10s</button><button onClick={()=>setClock(c=>c+10)}>+10s</button></div></div><div className="stack"><label><span>Quarter / phase</span><select value={quarter} onChange={e=>startQuarter(e.target.value)}>{QUARTERS.map(q=><option key={q}>{q}</option>)}</select></label><label><span>Scope</span><select value={scope} onChange={e=>setScope(e.target.value)}><option>Auto</option><option>Us</option><option>Opposition</option><option>Both</option></select></label></div></div>
  <div className="grid three top"><label><span>Player</span><select value={player} onChange={e=>setPlayer(e.target.value)}><option>Auto</option><option value="">No player tag</option>{PLAYERS.map(p=><option key={p}>{p}</option>)}</select></label><label className="span2"><span>Theme</span><select value={theme} onChange={e=>setTheme(e.target.value)}><option>Auto-detect</option>{THEMES.map(t=><option key={t}>{t}</option>)}</select></label></div>
  <div className="sub top"><h2>Live capture</h2><div className="actions">{!listening?<button className="orange" onClick={startSpeech}>Start live transcription</button>:<button className="red" onClick={stopSpeech}>Stop transcription</button>}{!recording?<button className="blue" onClick={startAudio}>Start audio backup</button>:<button className="red" onClick={stopAudio}>Stop audio backup</button>}{audioUrl&&<button className="green" onClick={exportAudio}>Download audio</button>}</div><p className="muted">Speak naturally. V4 auto-detects player numbers from phrases like “number 12”, “player 8” or “#21”.</p><div className="note live">{live||"Live transcript appears here. Final phrases become timestamped calls."}</div></div>
  <div className="sub top"><h2>Quick tags</h2><div className="actions">{QUICK_TAGS.map(t=><button key={t} onClick={()=>addQuick(t)}>{t}</button>)}</div></div>
  <div className="sub top"><h2>Manual note</h2><textarea value={manual} onChange={e=>setManual(e.target.value)} placeholder="Type a sideline note..."/><div className="actions top-sm"><button className="blue" onClick={()=>{addNote(manual,{tag:"Manual"});setManual("");}}>Add note</button></div></div></section>
  <aside className="grid"><section className="card"><h2>Rose / Bud / Thorn</h2><div className="grid three"><div className="note"><span className="pill rose">Rose</span><h2>{intel.rose.length}</h2></div><div className="note"><span className="pill bud">Bud</span><h2>{intel.bud.length}</h2></div><div className="note"><span className="pill thorn">Thorn</span><h2>{intel.thorn.length}</h2></div></div>{intel.topThemes.slice(0,7).map(([t,c])=><div className="row" key={t}><span>{t}</span><b>{c}</b></div>)}</section><section className="card"><h2>Top 5 coaching actions</h2>{intel.actions.map(a=><div className="note" key={a.title}><b>{a.title}</b><p className="muted">{a.detail}</p></div>)}</section><section className="card"><h2>Opposition scout</h2>{intel.oppThemes.length?intel.oppThemes.map(([t,c])=><div className="row" key={t}><span>{t}</span><b>{c}</b></div>):<p className="muted">Tagged opposition moments will appear here.</p>}</section><section className="card no-print"><h2>Export / archive</h2><div className="actions"><button onClick={exportMarkdown}>Markdown</button><button onClick={exportCsv}>CSV</button><button onClick={exportJson}>JSON</button><button className="green" onClick={exportWord}>Word</button><button onClick={()=>window.print()}>PDF</button><button className="blue" onClick={saveSnapshot}>Save snapshot</button><label className="filebtn">Import JSON<input type="file" accept="application/json" onChange={importJson}/></label><button className="red" onClick={()=>setNotes([])}>Clear notes</button></div></section></aside></main>
  <section className="card top"><div className="actions space no-print"><h2>Live timestamped calls</h2><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{QUARTERS.map(q=><option key={q}>{q}</option>)}<option>Us</option><option>Opposition</option><option>Both</option><option>Rose</option><option>Bud</option><option>Thorn</option>{THEMES.map(t=><option key={t}>{t}</option>)}{QUICK_TAGS.map(t=><option key={t}>{t}</option>)}{PLAYERS.map(p=><option key={p}>{`#${p}`}</option>)}</select></div><div className="list top-sm">{shown.length===0&&<div className="note muted">No notes yet.</div>}{shown.map(n=><article className="note" key={n.id}><div className="actions"><span className="pill">{n.quarter} {n.clockLabel}</span><span className="pill">{n.scope}</span>{n.player&&<span className="pill">#{n.player}</span>}<span className="pill">{n.theme}</span><span className={`pill ${n.tone.toLowerCase()}`}>{n.tone}</span><span className="pill">{n.tag}</span><button className="red push no-print" onClick={()=>setNotes(prev=>prev.filter(x=>x.id!==n.id))}>Delete</button></div><p><b>Call:</b> {n.raw}</p><p className="muted"><b>Interpretation:</b> {n.interpretation}</p></article>)}</div></section>
  <section className="card top"><h2>Season memory</h2><p className="muted">Snapshots are stored locally in this browser. Use JSON export to keep a season backup outside the device.</p>{season.length===0?<p className="muted">No saved snapshots yet.</p>:season.slice(0,10).map(s=><div className="row" key={s.id}><span>{s.matchTitle} vs {s.opponent||"-"}</span><b>{s.notes.length} notes</b></div>)}</section></div></div>;
}
