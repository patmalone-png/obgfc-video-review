import React, { useEffect, useMemo, useRef, useState } from "react";

const THEMES = [
  "Contest", "Pressure", "Clearance", "Turnover", "Defensive Transition", "Forward-half Pressure",
  "Stoppage Shape", "Ball Movement", "Inside 50", "Opposition Threat", "Individual Development",
  "Set Play", "Leadership / Communication", "Work Rate", "Game Sense", "General"
];
const QUARTERS = ["Pre-game", "Q1", "Quarter-time", "Q2", "Half-time", "Q3", "Three-quarter-time", "Q4", "Post-game"];
const PLAYERS = Array.from({ length: 60 }, (_, i) => String(i + 1));
const QUICK_TAGS = ["Great", "Fix", "Watch", "Clip", "Training", "Quarter-time", "Opposition", "Player", "Momentum", "Effort"];
const POSITIVE = ["good", "great", "excellent", "love", "strong", "perfect", "smart", "clean", "well done", "win", "nailed", "brilliant", "better"];
const IMPROVE = ["need", "must", "late", "miss", "poor", "slow", "danger", "wrong", "exposed", "fix", "work on", "too easy", "lost", "lazy"];
const KEYWORDS = {
  Contest: ["contest", "ground ball", "aerial", "body", "hard ball", "one on one", "first possession", "compete"],
  Pressure: ["pressure", "tackle", "hunt", "chase", "harass", "corrall", "closing speed", "urgency"],
  Clearance: ["clearance", "centre bounce", "stoppage", "ruck", "hitout", "inside mid", "extract", "throw in"],
  Turnover: ["turnover", "missed target", "intercept", "gave it back", "poor kick", "bad option", "overuse", "fumble"],
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

function pad(n){ return String(n).padStart(2,"0"); }
function timeLabel(seconds){ const s = Math.max(0, Math.floor(Number.isFinite(seconds)?seconds:0)); const h=Math.floor(s/3600); const m=Math.floor((s%3600)/60); const x=s%60; return h>0?`${pad(h)}:${pad(m)}:${pad(x)}`:`${pad(m)}:${pad(x)}`; }
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
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const [tab, setTab] = useState("replay");
  const [matchTitle,setMatchTitle]=useState("Old Brighton Women's Team - Match Review");
  const [opponent,setOpponent]=useState("");
  const [venue,setVenue]=useState("");

  const [videoUrl,setVideoUrl]=useState("");
  const [videoName,setVideoName]=useState("No video loaded");

  const [clock,setClock]=useState(0);
  const [clockRunning,setClockRunning]=useState(false);

  const [quarter,setQuarter]=useState("Q1");
  const [scope,setScope]=useState("Auto");
  const [player,setPlayer]=useState("Auto");
  const [theme,setTheme]=useState("Auto-detect");
  const [manual,setManual]=useState("");
  const [live,setLive]=useState("");
  const [status,setStatus]=useState("Pick a tab: Replay Review, Match Day, or Season Dashboard.");
  const [listening,setListening]=useState(false);
  const [recording,setRecording]=useState(false);
  const [audioUrl,setAudioUrl]=useState("");
  const [filter,setFilter]=useState("All");

  const [notes,setNotes]=useState(()=>{ try{return JSON.parse(localStorage.getItem("obgfcV7Notes")||"[]");}catch{return [];} });
  const [season,setSeason]=useState(()=>{ try{return JSON.parse(localStorage.getItem("obgfcV7Season")||"[]");}catch{return [];} });

  // AI Coach config (V7: secure server proxy is the default)
  const [aiMode,setAiMode]=useState(()=>localStorage.getItem("obgfcV7AiMode")||"secure"); // secure | builtin
  const [aiEndpoint,setAiEndpoint]=useState(()=>localStorage.getItem("obgfcV7AiEndpoint")||"/api/coach");
  const [teamSecret,setTeamSecret]=useState(()=>localStorage.getItem("obgfcV7TeamSecret")||"");
  const [aiOutput,setAiOutput]=useState("");
  const [aiBusy,setAiBusy]=useState(false);
  const [aiScope,setAiScope]=useState("thisMatch");
  const [aiInfo,setAiInfo]=useState("");

  useEffect(()=>localStorage.setItem("obgfcV7Notes", JSON.stringify(notes)),[notes]);
  useEffect(()=>localStorage.setItem("obgfcV7Season", JSON.stringify(season)),[season]);
  useEffect(()=>localStorage.setItem("obgfcV7AiMode", aiMode),[aiMode]);
  useEffect(()=>localStorage.setItem("obgfcV7AiEndpoint", aiEndpoint),[aiEndpoint]);
  useEffect(()=>localStorage.setItem("obgfcV7TeamSecret", teamSecret),[teamSecret]);
  useEffect(()=>{ if(clockRunning){ timerRef.current=setInterval(()=>setClock(c=>c+1),1000); } else if(timerRef.current){ clearInterval(timerRef.current); } return ()=>{ if(timerRef.current) clearInterval(timerRef.current); }; },[clockRunning]);
  useEffect(()=>()=>{ if(videoUrl) URL.revokeObjectURL(videoUrl); if(recognitionRef.current) recognitionRef.current.stop(); },[videoUrl]);

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

  const seasonData = useMemo(()=>{
    const games = [...season].map((m,i)=>{
      const t = countBy(m.notes, "theme");
      const thornThemes = countBy(m.notes.filter(n=>n.tone==="Thorn"), "theme");
      return { id:m.id, label:`${m.opponent||m.matchTitle||("Game "+(i+1))}`, date:m.createdAt, total:m.notes.length,
        rose:m.notes.filter(n=>n.tone==="Rose").length, bud:m.notes.filter(n=>n.tone==="Bud").length, thorn:m.notes.filter(n=>n.tone==="Thorn").length, themes:t, thornThemes };
    }).reverse();
    const allThemes = new Set(); games.forEach(g=>Object.keys(g.themes).forEach(t=>allThemes.add(t)));
    const themeTrend = {}; allThemes.forEach(t=>{ themeTrend[t] = games.map(g=>g.themes[t]||0); });
    const seasonThorn = {}; games.forEach(g=>Object.entries(g.thornThemes).forEach(([t,c])=>{ seasonThorn[t]=(seasonThorn[t]||0)+c; }));
    const recurringThorns = Object.entries(seasonThorn).sort((a,b)=>b[1]-a[1]).slice(0,6);
    return { games, themeTrend, recurringThorns, gameCount:games.length };
  },[season]);

  const shown = useMemo(()=>notes.filter(n=>filter==="All" || [n.quarter,n.scope,n.theme,n.tone,n.tag,n.source,n.player?`#${n.player}`:""].includes(filter)),[notes,filter]);

  function currentTimestamp(){
    if(tab==="replay"){ const t=videoRef.current?.currentTime||0; return { seconds:t, label:timeLabel(t), source:"Replay" }; }
    return { seconds:clock, label:timeLabel(clock), source:"Match Day" };
  }
  function addNote(rawInput, overrides={}){
    const raw=rawInput.trim(); if(!raw) return;
    const ts=currentTimestamp();
    const autoPlayer=detectPlayer(raw);
    const resolvedPlayer = overrides.player ?? (player==="Auto" ? autoPlayer : player);
    const resolvedScope = overrides.scope ?? (scope==="Auto" ? detectScope(raw) : scope);
    const resolvedTheme = overrides.theme ?? (theme==="Auto-detect" ? detectTheme(raw) : theme);
    const resolvedTone = overrides.tone ?? detectTone(raw);
    const resolvedTag = overrides.tag ?? detectTag(raw);
    const note={ id:crypto.randomUUID(), matchTitle, opponent, venue, quarter, seconds:ts.seconds, clockLabel:ts.label, source:ts.source, scope:resolvedScope, player:resolvedPlayer, theme:resolvedTheme, tone:resolvedTone, tag:resolvedTag, raw, interpretation:`${resolvedTone}: ${resolvedScope}${resolvedPlayer?` #${resolvedPlayer}`:""} - ${resolvedTheme}. ${raw}`, createdAt:new Date().toISOString() };
    setNotes(prev=>[note,...prev]);
    setStatus(`Added ${resolvedTone} note (${ts.source} ${ts.label}) - ${resolvedTheme}${resolvedPlayer?` #${resolvedPlayer}`:""}.`);
  }
  function jumpTo(seconds){ if(tab!=="replay"||!videoRef.current) return; videoRef.current.currentTime=seconds; videoRef.current.play(); }
  function handleVideo(e){ const f=e.target.files?.[0]; if(!f) return; if(videoUrl) URL.revokeObjectURL(videoUrl); const u=URL.createObjectURL(f); setVideoUrl(u); setVideoName(f.name); setStatus("Video loaded. Commentary timestamps follow the video clock."); }
  async function captureScreen(){ try{ if(!navigator.mediaDevices?.getDisplayMedia){ setStatus("Screen capture unsupported in this browser."); return; } const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true}); if(videoRef.current){ videoRef.current.srcObject=stream; videoRef.current.controls=true; videoRef.current.play(); } setVideoName("Screen / opposition footage"); setStatus("Screen capture active."); } catch { setStatus("Screen capture cancelled or blocked."); } }
  function startQuarter(q){ setQuarter(q); if(tab==="matchday"){ setClock(0); setClockRunning(false); } }
  function addQuick(tag){
    const text = tag==="Great"?"Great moment. Reinforce this behaviour.":tag==="Fix"?"Fix this. Needs coaching attention.":tag==="Watch"?"Watch this pattern again.":tag==="Clip"?"Clip this moment for video review.":tag==="Training"?"Training theme identified.":tag==="Quarter-time"?"Quarter-time message. Keep it clear and simple.":tag==="Opposition"?"Opposition pattern or threat identified.":tag==="Momentum"?"Momentum shift. Capture what changed.":tag==="Effort"?"Effort and work-rate note.":"Player-specific development note.";
    addNote(text,{ tag, scope:tag==="Opposition"?"Opposition":undefined });
  }
  function startSpeech(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){ setStatus("Speech recognition unavailable. Use Chrome or Edge."); return; }
    const rec=new SR(); rec.continuous=true; rec.interimResults=true; rec.lang="en-AU";
    rec.onstart=()=>{ setListening(true); setStatus("Live transcription on. Speak naturally."); };
    rec.onresult=(e)=>{ let interim=""; for(let i=e.resultIndex;i<e.results.length;i++){ const t=e.results[i][0].transcript; if(e.results[i].isFinal) addNote(t); else interim+=t; } setLive(interim); };
    rec.onerror=(e)=>setStatus(`Speech issue: ${e.error}. Use quick or manual notes if needed.`);
    rec.onend=()=>{ setListening(false); if(recognitionRef.current) setStatus("Speech paused. Restart if needed."); };
    recognitionRef.current=rec; rec.start();
  }
  function stopSpeech(){ if(recognitionRef.current){ recognitionRef.current.stop(); recognitionRef.current=null; } setListening(false); setLive(""); setStatus("Live transcription off."); }
  async function startAudio(){
    try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true}); const rec=new MediaRecorder(stream); audioChunksRef.current=[]; rec.ondataavailable=e=>{ if(e.data.size>0) audioChunksRef.current.push(e.data); }; rec.onstop=()=>{ const blob=new Blob(audioChunksRef.current,{type:"audio/webm"}); setAudioUrl(URL.createObjectURL(blob)); stream.getTracks().forEach(t=>t.stop()); }; recorderRef.current=rec; rec.start(); setRecording(true); setStatus("Audio backup recording on."); } catch { setStatus("Audio recording blocked or unavailable."); }
  }
  function stopAudio(){ if(recorderRef.current && recorderRef.current.state!=="inactive") recorderRef.current.stop(); setRecording(false); }
  function exportAudio(){ if(!audioUrl) return; const a=document.createElement("a"); a.href=audioUrl; a.download="obgfc-v7-audio.webm"; document.body.appendChild(a); a.click(); a.remove(); }

  function summaryText(){
    const lines=[`# ${matchTitle}`,`Opponent: ${opponent||"-"}`,`Venue: ${venue||"-"}`,`Generated: ${new Date().toLocaleString()}`,"","## Rose / Bud / Thorn",`Rose: ${intel.rose.length}`,`Bud: ${intel.bud.length}`,`Thorn: ${intel.thorn.length}`,"","## Main Themes"];
    if(!intel.topThemes.length) lines.push("No themes captured yet."); else intel.topThemes.slice(0,10).forEach(([t,c])=>lines.push(`- ${t}: ${c}`));
    lines.push("","## Top 5 Coaching Actions"); intel.actions.forEach(a=>lines.push(`- ${a.title}: ${a.detail}`));
    lines.push("","## Opposition Scout"); if(!intel.oppThemes.length) lines.push("No opposition-specific moments captured yet."); else intel.oppThemes.forEach(([t,c])=>lines.push(`- ${t}: ${c}`));
    lines.push("","## Player Mentions"); if(!intel.players.length) lines.push("No player-specific tags captured yet."); else intel.players.slice(0,20).forEach(([p,c])=>lines.push(`- #${p}: ${c}`));
    lines.push("","## Clip List"); if(!intel.clips.length) lines.push("No clip moments captured yet."); else intel.clips.forEach(n=>lines.push(`- ${n.source} ${n.clockLabel}: ${n.raw}`));
    lines.push("","## Timestamped Calls"); [...notes].reverse().forEach(n=>lines.push(`- [${n.source}] ${n.quarter} ${n.clockLabel} | ${n.scope}${n.player?` #${n.player}`:""} | ${n.theme} | ${n.tone} | ${n.tag}: ${n.raw}`));
    return lines.join("\n");
  }
  function exportMarkdown(){ download("obgfc-v7-match-report.md", summaryText(), "text/markdown"); }
  function exportCsv(){ const h=["Source","Match","Opponent","Venue","Quarter","Clock","Scope","Player","Theme","Tone","Tag","Raw","Interpretation","Created At"]; const rows=notes.map(n=>[n.source,n.matchTitle,n.opponent,n.venue,n.quarter,n.clockLabel,n.scope,n.player,n.theme,n.tone,n.tag,n.raw,n.interpretation,n.createdAt]); download("obgfc-v7-notes.csv", [h,...rows].map(r=>r.map(csvEscape).join(",")).join("\n"), "text/csv"); }
  function exportJson(){ download("obgfc-v7-season-data.json", JSON.stringify({matchTitle,opponent,venue,notes,season},null,2), "application/json"); }
  function exportWord(){ const extra = aiOutput?`<h2>AI Coach Summary</h2><p>${safeHtml(aiOutput).replaceAll("\n","<br/>")}</p>`:""; const body=safeHtml(summaryText()).replaceAll("\n","<br/>"); const html=`<!doctype html><html><head><meta charset="utf-8"><title>${safeHtml(matchTitle)}</title><style>body{font-family:Arial,sans-serif;color:#111;line-height:1.4}h1{color:#0f172a}h2{color:#075985;border-bottom:1px solid #ccc;padding-bottom:4px}</style></head><body>${body}<br/>${extra}</body></html>`; download("obgfc-v7-match-report.doc", html, "application/msword"); }
  function saveSnapshot(){ setSeason(prev=>[{id:crypto.randomUUID(),matchTitle,opponent,venue,createdAt:new Date().toISOString(),notes,summary:summaryText()},...prev]); setStatus("Saved match snapshot to season memory."); }
  function importJson(e){ const file=e.target.files?.[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result); if(Array.isArray(data.notes)) setNotes(data.notes); if(Array.isArray(data.season)) setSeason(data.season); setStatus("Imported JSON data."); }catch{ setStatus("Could not import JSON file."); } }; reader.readAsText(file); }

  // ---------- AI COACH ----------
  function buildAiPayload(){
    if(aiScope==="season"){
      const games = seasonData.games.map(g=>`${g.label} (${new Date(g.date).toLocaleDateString()}): total ${g.total}, rose ${g.rose}, bud ${g.bud}, thorn ${g.thorn}. Themes: ${Object.entries(g.themes).map(([t,c])=>`${t} ${c}`).join(", ")}`).join("\n");
      const recurring = seasonData.recurringThorns.map(([t,c])=>`${t}: ${c}`).join(", ");
      return `SEASON DATA (${seasonData.gameCount} saved games)\n${games}\n\nRecurring improvement (thorn) themes across season: ${recurring}`;
    }
    return summaryText();
  }
  function builtinAi(){
    const top = intel.topThemes.slice(0,3).map(([t,c])=>`${t} (${c})`).join(", ") || "not enough data";
    const train = intel.training.map(([t,c])=>`${t} (${c})`).join(", ") || "not enough data";
    const oppText = intel.oppThemes.slice(0,3).map(([t,c])=>`${t} (${c})`).join(", ") || "no opposition notes";
    const recurring = seasonData.recurringThorns.map(([t,c])=>`${t} (${c})`).join(", ") || "not enough saved games";
    const lines = [];
    lines.push("COACHING SUMMARY (built-in, rule-based)","");
    lines.push(`What went well: ${intel.rose.length} reinforce moments captured. Strongest themes overall: ${top}.`);
    lines.push(`Where to improve: ${intel.thorn.length} thorn moments. Priority improvement themes: ${train}.`);
    lines.push(`Opposition read: ${oppText}.`,"","SUGGESTED TRAINING FOCUSES");
    (intel.training.length?intel.training:[["Contest",0],["Pressure",0],["Ball Movement",0]]).slice(0,4).forEach(([t],i)=>{
      lines.push(`${i+1}. ${t} - design a small-sided drill or constraint that forces repeated ${t.toLowerCase()} reps under fatigue.`);
    });
    lines.push("",`SEASON TREND: recurring improvement themes across saved games - ${recurring}.`);
    return lines.join("\n");
  }
  async function callSecureProxy(payload){
    const headers={ "Content-Type":"application/json" };
    if(teamSecret) headers["x-coach-secret"]=teamSecret;
    const res=await fetch(aiEndpoint || "/api/coach", { method:"POST", headers, body: JSON.stringify({ payload }) });
    const text=await res.text();
    let data; try{ data=JSON.parse(text); }catch{ throw new Error(`Bad response from ${aiEndpoint}: ${text.slice(0,200)}`); }
    if(!res.ok){ throw new Error(data.error || `Proxy error ${res.status}`); }
    setAiInfo(data.provider?`Engine: ${data.provider} (secure server)`:"");
    return data.summary || "No response.";
  }
  async function runAi(){
    setAiBusy(true); setAiOutput(""); setAiInfo("");
    try{
      const payload=buildAiPayload();
      if(aiMode==="builtin"){ setAiOutput(builtinAi()); setAiInfo("Engine: built-in (offline)"); }
      else { setAiOutput(await callSecureProxy(payload)); }
    }catch(err){ setAiOutput(`Secure AI request failed. ${err.message}\n\nFalling back to built-in summary:\n\n${builtinAi()}`); setAiInfo("Fell back to built-in"); }
    finally{ setAiBusy(false); }
  }
  async function testEndpoint(){
    setAiBusy(true); setAiInfo("");
    try{
      const headers={ "Content-Type":"application/json" };
      if(teamSecret) headers["x-coach-secret"]=teamSecret;
      const res=await fetch(aiEndpoint || "/api/coach", { method:"POST", headers, body: JSON.stringify({ payload:"Connection test. Reply with a one line coaching tip." }) });
      const text=await res.text(); let data; try{ data=JSON.parse(text); }catch{ data={ error:text.slice(0,200) }; }
      if(res.ok){ setAiInfo(`OK - endpoint reachable. Engine: ${data.provider||"?"}`); }
      else { setAiInfo(`Endpoint responded ${res.status}: ${data.error||"error"}`); }
    }catch(err){ setAiInfo(`Could not reach endpoint: ${err.message}. This is normal on localhost - it works once deployed on Vercel.`); }
    finally{ setAiBusy(false); }
  }
  function copyAi(){ if(aiOutput) navigator.clipboard?.writeText(aiOutput); }
  function exportAiWord(){ const html=`<!doctype html><html><head><meta charset="utf-8"><title>AI Coach Summary</title><style>body{font-family:Arial,sans-serif;color:#111;line-height:1.5}h1{color:#0f172a}</style></head><body><h1>${safeHtml(matchTitle)} - AI Coach Summary</h1><p>${safeHtml(aiOutput).replaceAll("\n","<br/>")}</p></body></html>`; download("obgfc-v7-ai-coach-summary.doc", html, "application/msword"); }

  const maxTrend = useMemo(()=>{ let m=1; Object.values(seasonData.themeTrend).forEach(arr=>arr.forEach(v=>{ if(v>m) m=v; })); return m; },[seasonData]);

  return (
    <div className="app">
      <div className="wrap">
        <header className="hero">
          <div className="eyebrow">Old Brighton Women's Team</div>
          <h1>V7 Coaching Intelligence</h1>
          <p>Replay review, live match-day capture, a season dashboard, and a secure server-side AI coach.</p>
          <div className="tabs">
            <button className={tab==="replay"?"tab active":"tab"} onClick={()=>{setTab("replay"); setStatus("Replay Review: load footage and comment while you watch.");}}>Replay Review</button>
            <button className={tab==="matchday"?"tab active":"tab"} onClick={()=>{setTab("matchday"); setStatus("Match Day: start the clock and capture live mic commentary.");}}>Match Day Intelligence</button>
            <button className={tab==="season"?"tab active":"tab"} onClick={()=>{setTab("season"); setStatus("Season Dashboard: track themes and get a secure AI coaching summary.");}}>Season Dashboard</button>
          </div>
          <div className="status"><b>Status:</b> {status}</div>
        </header>

        <section className="card grid four top">
          <label className="wide"><span>Match title</span><input value={matchTitle} onChange={e=>setMatchTitle(e.target.value)} /></label>
          <label><span>Opponent</span><input value={opponent} onChange={e=>setOpponent(e.target.value)} placeholder="e.g. Kew" /></label>
          <label><span>Venue</span><input value={venue} onChange={e=>setVenue(e.target.value)} placeholder="e.g. Brighton Beach Oval" /></label>
        </section>

        {tab!=="season" ? (
        <main className="grid two top">
          <section className="card no-print">
            {tab==="replay" ? (
              <>
                <div className="actions">
                  <label className="filebtn blue">Load video<input type="file" accept="video/*" onChange={handleVideo} /></label>
                  <button onClick={captureScreen}>Capture screen</button>
                  <button className="green" onClick={()=>videoRef.current?.play()}>Play</button>
                  <button className="orange" onClick={()=>videoRef.current?.pause()}>Pause</button>
                  <span className="pill push">{videoName}</span>
                </div>
                <div className="videowrap"><video ref={videoRef} src={videoUrl} controls /></div>
              </>
            ) : (
              <div className="grid two">
                <div>
                  <div className="muted">Quarter clock</div>
                  <div className="clock">{timeLabel(clock)}</div>
                  <div className="actions">
                    <button className={clockRunning?"red":"green"} onClick={()=>setClockRunning(v=>!v)}>{clockRunning?"Pause clock":"Start clock"}</button>
                    <button onClick={()=>setClock(0)}>Reset</button>
                    <button onClick={()=>setClock(c=>Math.max(0,c-10))}>-10s</button>
                    <button onClick={()=>setClock(c=>c+10)}>+10s</button>
                  </div>
                </div>
                <div className="sub">
                  <h2>Live mic</h2>
                  <div className="actions">
                    {!listening?<button className="orange" onClick={startSpeech}>Start transcription</button>:<button className="red" onClick={stopSpeech}>Stop transcription</button>}
                    {!recording?<button className="blue" onClick={startAudio}>Audio backup</button>:<button className="red" onClick={stopAudio}>Stop audio</button>}
                    {audioUrl&&<button className="green" onClick={exportAudio}>Download audio</button>}
                  </div>
                </div>
              </div>
            )}

            <div className="grid four top">
              <label><span>Quarter</span><select value={quarter} onChange={e=>startQuarter(e.target.value)}>{QUARTERS.map(q=><option key={q}>{q}</option>)}</select></label>
              <label><span>Scope</span><select value={scope} onChange={e=>setScope(e.target.value)}><option>Auto</option><option>Us</option><option>Opposition</option><option>Both</option></select></label>
              <label><span>Player</span><select value={player} onChange={e=>setPlayer(e.target.value)}><option>Auto</option><option value="">No player tag</option>{PLAYERS.map(p=><option key={p}>{p}</option>)}</select></label>
              <label><span>Theme</span><select value={theme} onChange={e=>setTheme(e.target.value)}><option>Auto-detect</option>{THEMES.map(t=><option key={t}>{t}</option>)}</select></label>
            </div>

            {tab==="replay" && (
              <div className="sub top">
                <h2>Commentary</h2>
                <div className="actions">
                  {!listening?<button className="orange" onClick={startSpeech}>Start commentary</button>:<button className="red" onClick={stopSpeech}>Stop commentary</button>}
                </div>
              </div>
            )}

            <div className="sub top">
              <div className="note live">{live||"Live transcript appears here. Final phrases become timestamped calls."}</div>
            </div>

            <div className="sub top">
              <h2>Quick tags</h2>
              <div className="actions">{QUICK_TAGS.map(t=><button key={t} onClick={()=>addQuick(t)}>{t}</button>)}</div>
            </div>

            <div className="sub top">
              <h2>Manual note</h2>
              <textarea value={manual} onChange={e=>setManual(e.target.value)} placeholder="Type a note..." />
              <div className="actions top-sm"><button className="blue" onClick={()=>{addNote(manual,{tag:"Manual"});setManual("");}}>Add note</button></div>
            </div>
          </section>

          <aside className="grid">
            <section className="card">
              <h2>Rose / Bud / Thorn</h2>
              <div className="grid three">
                <div className="note"><span className="pill rose">Rose</span><h2>{intel.rose.length}</h2></div>
                <div className="note"><span className="pill bud">Bud</span><h2>{intel.bud.length}</h2></div>
                <div className="note"><span className="pill thorn">Thorn</span><h2>{intel.thorn.length}</h2></div>
              </div>
              {intel.topThemes.slice(0,7).map(([t,c])=><div className="row" key={t}><span>{t}</span><b>{c}</b></div>)}
            </section>
            <section className="card">
              <h2>Top 5 coaching actions</h2>
              {intel.actions.map(a=><div className="note" key={a.title}><b>{a.title}</b><p className="muted">{a.detail}</p></div>)}
            </section>
            <section className="card">
              <h2>Opposition scout</h2>
              {intel.oppThemes.length?intel.oppThemes.map(([t,c])=><div className="row" key={t}><span>{t}</span><b>{c}</b></div>):<p className="muted">Tagged opposition moments will appear here.</p>}
            </section>
            <section className="card no-print">
              <h2>Export / archive</h2>
              <div className="actions">
                <button onClick={exportMarkdown}>Markdown</button>
                <button onClick={exportCsv}>CSV</button>
                <button onClick={exportJson}>JSON</button>
                <button className="green" onClick={exportWord}>Word</button>
                <button onClick={()=>window.print()}>PDF</button>
                <button className="blue" onClick={saveSnapshot}>Save snapshot</button>
                <label className="filebtn">Import JSON<input type="file" accept="application/json" onChange={importJson} /></label>
                <button className="red" onClick={()=>setNotes([])}>Clear notes</button>
              </div>
            </section>
          </aside>
        </main>
        ) : (
        <main className="grid top">
          <section className="card">
            <div className="actions space">
              <h2>Season overview</h2>
              <span className="pill">{seasonData.gameCount} saved game{seasonData.gameCount===1?"":"s"}</span>
            </div>
            {seasonData.gameCount===0 ? (
              <p className="muted">No saved games yet. On the Replay or Match Day tab, capture notes then press <b>Save snapshot</b>. Each saved game feeds these season trends.</p>
            ) : (
              <>
                <div className="grid four top">
                  {seasonData.games.slice(-4).map(g=>(
                    <div className="note" key={g.id}>
                      <b>{g.label}</b>
                      <div className="muted">{new Date(g.date).toLocaleDateString()}</div>
                      <div className="row"><span>Rose</span><b>{g.rose}</b></div>
                      <div className="row"><span>Bud</span><b>{g.bud}</b></div>
                      <div className="row"><span>Thorn</span><b>{g.thorn}</b></div>
                    </div>
                  ))}
                </div>
                <h2 className="top">Theme trend across games (oldest → newest)</h2>
                <div className="trend">
                  {Object.entries(seasonData.themeTrend).sort((a,b)=>{ const sa=a[1].reduce((x,y)=>x+y,0), sb=b[1].reduce((x,y)=>x+y,0); return sb-sa; }).slice(0,8).map(([t,arr])=>(
                    <div className="trendrow" key={t}>
                      <div className="trendlabel">{t}</div>
                      <div className="bars">{arr.map((v,i)=>(<div className="barcol" key={i} title={`${v}`}><div className="bar" style={{height:`${(v/maxTrend)*100}%`}}></div></div>))}</div>
                      <div className="trendtotal">{arr.reduce((x,y)=>x+y,0)}</div>
                    </div>
                  ))}
                </div>
                <h2 className="top">Recurring improvement themes (season)</h2>
                {seasonData.recurringThorns.length?seasonData.recurringThorns.map(([t,c])=><div className="row" key={t}><span>{t}</span><b>{c}</b></div>):<p className="muted">No recurring thorn themes yet.</p>}
              </>
            )}
          </section>

          <section className="card top">
            <h2>AI Coach (secure)</h2>
            <p className="muted">V7 sends your notes to a serverless function on your own Vercel project. The API key lives in Vercel environment variables and is never exposed to the browser. Works on any device and for your assistant coaches.</p>
            <div className="grid four top">
              <label><span>Engine</span><select value={aiMode} onChange={e=>setAiMode(e.target.value)}><option value="secure">Secure server (Vercel)</option><option value="builtin">Built-in (offline)</option></select></label>
              <label><span>Analyse</span><select value={aiScope} onChange={e=>setAiScope(e.target.value)}><option value="thisMatch">This match's notes</option><option value="season">Whole season</option></select></label>
              <label><span>Endpoint</span><input value={aiEndpoint} onChange={e=>setAiEndpoint(e.target.value)} placeholder="/api/coach" disabled={aiMode!=="secure"} /></label>
              <label><span>Team secret (optional)</span><input type="password" value={teamSecret} onChange={e=>setTeamSecret(e.target.value)} placeholder="Only if you set COACH_SHARED_SECRET" disabled={aiMode!=="secure"} /></label>
            </div>
            <div className="actions top-sm">
              <button className="green" onClick={runAi} disabled={aiBusy}>{aiBusy?"Thinking…":"Generate AI coaching summary"}</button>
              {aiMode==="secure" && <button onClick={testEndpoint} disabled={aiBusy}>Test endpoint</button>}
              {aiOutput && <button onClick={copyAi}>Copy</button>}
              {aiOutput && <button className="blue" onClick={exportAiWord}>Export Word</button>}
            </div>
            {aiInfo && <p className="muted top-sm">{aiInfo}</p>}
            <div className="note ai top-sm">{aiOutput || "AI coaching summary will appear here."}</div>
          </section>
        </main>
        )}

        {tab!=="season" && (
        <section className="card top">
          <div className="actions space no-print">
            <h2>Timestamped calls</h2>
            <select value={filter} onChange={e=>setFilter(e.target.value)}>
              <option>All</option>
              <option>Replay</option><option>Match Day</option>
              {QUARTERS.map(q=><option key={q}>{q}</option>)}
              <option>Us</option><option>Opposition</option><option>Both</option>
              <option>Rose</option><option>Bud</option><option>Thorn</option>
              {THEMES.map(t=><option key={t}>{t}</option>)}
              {QUICK_TAGS.map(t=><option key={t}>{t}</option>)}
              {PLAYERS.map(p=><option key={p}>{`#${p}`}</option>)}
            </select>
          </div>
          <div className="list top-sm">
            {shown.length===0&&<div className="note muted">No notes yet.</div>}
            {shown.map(n=>(
              <article className="note" key={n.id}>
                <div className="actions">
                  <button className="pill jump" onClick={()=>jumpTo(n.seconds)}>{n.source} {n.clockLabel}</button>
                  <span className="pill">{n.quarter}</span>
                  <span className="pill">{n.scope}</span>
                  {n.player&&<span className="pill">#{n.player}</span>}
                  <span className="pill">{n.theme}</span>
                  <span className={`pill ${n.tone.toLowerCase()}`}>{n.tone}</span>
                  <span className="pill">{n.tag}</span>
                  <button className="red push no-print" onClick={()=>setNotes(prev=>prev.filter(x=>x.id!==n.id))}>Delete</button>
                </div>
                <p><b>Call:</b> {n.raw}</p>
                <p className="muted"><b>Interpretation:</b> {n.interpretation}</p>
              </article>
            ))}
          </div>
        </section>
        )}

        <section className="card top">
          <h2>Season memory</h2>
          <p className="muted">Snapshots are stored locally in this browser. Use JSON export to back up the season outside the device.</p>
          {season.length===0?<p className="muted">No saved snapshots yet.</p>:season.slice(0,10).map(s=><div className="row" key={s.id}><span>{s.matchTitle} vs {s.opponent||"-"}</span><b>{s.notes.length} notes</b></div>)}
        </section>
      </div>
    </div>
  );
}
