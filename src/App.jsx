import React, { useEffect, useMemo, useRef, useState } from "react";

const THEMES = ["Contest","Pressure","Clearance","Turnover","Defensive Transition","Forward-half Pressure","Stoppage Shape","Ball Movement","Inside 50","Opposition Threat","Individual Development","Set Play","Leadership / Communication","Work Rate","Game Sense","General"];
const SCOUT_THEMES = ["Ball Movement","Stoppage Setup","Defensive Structure","Kick-in Setup","Forward Entry","Danger Player","Weakness","Set Play","Ruck","Press / Zone","Rebound","General"];
const QUARTERS = ["Pre-game","Q1","Quarter-time","Q2","Half-time","Q3","Three-quarter-time","Q4","Post-game"];
const PLAYERS = Array.from({length:60},(_,i)=>String(i+1));
const QUICK_TAGS = ["Great","Fix","Watch","Clip","Training","Quarter-time","Opposition","Player","Momentum","Effort"];
const SCOUT_QUICK = ["Danger player","Weakness","Strength","Ball movement","Stoppage","Kick-in","Set play","Clip"];
const POSITIVE = ["good","great","excellent","love","strong","perfect","smart","clean","well done","win","nailed","brilliant","better"];
const IMPROVE = ["need","must","late","miss","poor","slow","danger","wrong","exposed","fix","work on","too easy","lost","lazy"];
const KEYWORDS = {
  Contest:["contest","ground ball","aerial","body","hard ball","one on one","first possession","compete"],
  Pressure:["pressure","tackle","hunt","chase","harass","corrall","closing speed","urgency"],
  Clearance:["clearance","centre bounce","stoppage","ruck","hitout","inside mid","extract","throw in"],
  Turnover:["turnover","missed target","intercept","gave it back","poor kick","bad option","overuse","fumble"],
  "Defensive Transition":["defensive transition","transition defence","fold back","goal side","weak side","mark up","out the back","exposed"],
  "Forward-half Pressure":["forward pressure","front half","lock it in","repeat entry","crumb","small forward"],
  "Stoppage Shape":["stoppage shape","defensive side","sweep","setup","structure","outside mid","exit"],
  "Ball Movement":["switch","corridor","overlap","width","spread","handball receive","run","outside"],
  "Inside 50":["inside 50","forward entry","lead","shot","goal","deep","pocket","square"],
  "Opposition Threat":["opposition","their","danger","watch number","match up","loose","tag","scout"],
  "Individual Development":["player","role","decision","wing","mid","half back","ruck","confidence"],
  "Set Play":["set play","kick in","restart","signal","planned","outlet","pattern"],
  "Leadership / Communication":["talk","voice","communicate","organise","organize","direct","leader","calm"],
  "Work Rate":["work rate","repeat","effort","run both ways","spread hard","chase back"],
  "Game Sense":["scan","awareness","decision","hold","tempo","slow it","take space"]
};
function pad(n){return String(n).padStart(2,"0");}
function timeLabel(s){s=Math.max(0,Math.floor(Number.isFinite(s)?s:0));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),x=s%60;return h>0?`${pad(h)}:${pad(m)}:${pad(x)}`:`${pad(m)}:${pad(x)}`;}
function detectTheme(t){const l=t.toLowerCase();let b=["General",0];Object.entries(KEYWORDS).forEach(([th,ws])=>{const s=ws.reduce((n,w)=>n+(l.includes(w)?1:0),0);if(s>b[1])b=[th,s];});return b[0];}
function detectTone(t){const l=t.toLowerCase();const p=POSITIVE.filter(w=>l.includes(w)).length,i=IMPROVE.filter(w=>l.includes(w)).length;return p>i?"Rose":i>p?"Thorn":"Bud";}
function detectScope(t){const l=t.toLowerCase();return (l.includes("opposition")||l.includes("their ")||l.includes("they ")||l.includes("watch number"))?"Opposition":"Us";}
function detectPlayer(t){const l=t.toLowerCase();const pats=[/\bnumber\s+(\d{1,2})\b/i,/\bno\.\s*(\d{1,2})\b/i,/#\s*(\d{1,2})\b/i,/\bplayer\s+(\d{1,2})\b/i];for(const p of pats){const m=l.match(p);if(m&&Number(m[1])>=1&&Number(m[1])<=60)return String(Number(m[1]));}return "";}
function detectTag(t){const l=t.toLowerCase();if(l.includes("clip"))return "Clip";if(l.includes("quarter time")||l.includes("quarter-time"))return "Quarter-time";if(l.includes("training"))return "Training";if(l.includes("watch"))return "Watch";if(l.includes("fix"))return "Fix";if(l.includes("great"))return "Great";return "Voice";}
function countBy(items,key){return items.reduce((a,it)=>{const v=it[key]||"Unassigned";a[v]=(a[v]||0)+1;return a;},{});}
function csvEscape(v){return `"${String(v??"").replaceAll('"','""')}"`;}
function download(name,content,type){const b=new Blob([content],{type});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);}
function safeHtml(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");}
function nl2br(s){return safeHtml(s).replaceAll("\n","<br/>");}

export default function App(){
  const videoRef=useRef(null), recognitionRef=useRef(null), recorderRef=useRef(null), audioChunksRef=useRef([]), timerRef=useRef(null);
  const scoutVideoRef=useRef(null), scoutRecRef=useRef(null);

  const [tab,setTab]=useState("replay");
  const [matchTitle,setMatchTitle]=useState("Old Brighton Women's Team - Match Review");
  const [opponent,setOpponent]=useState(""), [venue,setVenue]=useState("");
  const [videoUrl,setVideoUrl]=useState(""), [videoName,setVideoName]=useState("No video loaded");
  const [clock,setClock]=useState(0), [clockRunning,setClockRunning]=useState(false);
  const [quarter,setQuarter]=useState("Q1"), [scope,setScope]=useState("Auto"), [player,setPlayer]=useState("Auto"), [theme,setTheme]=useState("Auto-detect");
  const [manual,setManual]=useState(""), [live,setLive]=useState(""), [status,setStatus]=useState("Pick a tab to begin.");
  const [listening,setListening]=useState(false), [recording,setRecording]=useState(false), [audioUrl,setAudioUrl]=useState(""), [filter,setFilter]=useState("All");
  const [notes,setNotes]=useState(()=>{try{return JSON.parse(localStorage.getItem("obgfcV11Notes")||"[]");}catch{return [];}});
  const [season,setSeason]=useState(()=>{try{return JSON.parse(localStorage.getItem("obgfcV11Season")||"[]");}catch{return [];}});

  const [scoutTeam,setScoutTeam]=useState(""), [scoutVideoUrl,setScoutVideoUrl]=useState(""), [scoutVideoName,setScoutVideoName]=useState("No video loaded");
  const [scoutManual,setScoutManual]=useState(""), [scoutTheme,setScoutTheme]=useState("Auto-detect"), [scoutPlayer,setScoutPlayer]=useState("Auto");
  const [scoutNotes,setScoutNotes]=useState(()=>{try{return JSON.parse(localStorage.getItem("obgfcV11Scout")||"[]");}catch{return [];}});
  const [scoutDB,setScoutDB]=useState(()=>{try{return JSON.parse(localStorage.getItem("obgfcV11ScoutDB")||"[]");}catch{return [];}});
  const [scoutRoster,setScoutRoster]=useState([]);
  const [scoutListening,setScoutListening]=useState(false), [scoutLive,setScoutLive]=useState("");

  const [aiEndpoint,setAiEndpoint]=useState(()=>localStorage.getItem("obgfcV11AiEndpoint")||"/api/coach");
  const [teamSecret,setTeamSecret]=useState(()=>localStorage.getItem("obgfcV11TeamSecret")||"");
  const [aiScope,setAiScope]=useState("thisMatch"), [aiOutput,setAiOutput]=useState(""), [aiBusy,setAiBusy]=useState(false), [aiInfo,setAiInfo]=useState("");
  const [stopOutput,setStopOutput]=useState(""), [stopBusy,setStopBusy]=useState(false), [stopInfo,setStopInfo]=useState(""), [stopLimit,setStopLimit]=useState(60);
  const [scoutOut,setScoutOut]=useState(""), [scoutBusy,setScoutBusy]=useState(false), [scoutInfo,setScoutInfo]=useState("");
  const [previewOut,setPreviewOut]=useState(""), [previewBusy,setPreviewBusy]=useState(false);
  const [scoreUs,setScoreUs]=useState(""), [scoreThem,setScoreThem]=useState(""), [qScores,setQScores]=useState("");

  const [phqEndpoint,setPhqEndpoint]=useState(()=>localStorage.getItem("obgfcV11PhqEndpoint")||"/api/playhq");
  const [phqStatus,setPhqStatus]=useState("unknown"), [phqMsg,setPhqMsg]=useState("");
  const [fixtures,setFixtures]=useState(()=>{try{return JSON.parse(localStorage.getItem("obgfcV11Fixtures")||"[]");}catch{return [];}});
  const [ladder,setLadder]=useState(()=>{try{return JSON.parse(localStorage.getItem("obgfcV11Ladder")||"[]");}catch{return [];}});
  const [fixDraft,setFixDraft]=useState({round:"",opponent:"",date:"",venue:"",result:""});
  const [ladDraft,setLadDraft]=useState({team:"",played:"",wins:"",losses:"",pct:"",pts:""});

  // Committee pack
  const [packOut,setPackOut]=useState(""), [packBusy,setPackBusy]=useState(false), [packInfo,setPackInfo]=useState("");
  const [packWeek,setPackWeek]=useState("");
  const [nextOpp,setNextOpp]=useState("");

  useEffect(()=>localStorage.setItem("obgfcV11Notes",JSON.stringify(notes)),[notes]);
  useEffect(()=>localStorage.setItem("obgfcV11Season",JSON.stringify(season)),[season]);
  useEffect(()=>localStorage.setItem("obgfcV11Scout",JSON.stringify(scoutNotes)),[scoutNotes]);
  useEffect(()=>localStorage.setItem("obgfcV11ScoutDB",JSON.stringify(scoutDB)),[scoutDB]);
  useEffect(()=>localStorage.setItem("obgfcV11AiEndpoint",aiEndpoint),[aiEndpoint]);
  useEffect(()=>localStorage.setItem("obgfcV11TeamSecret",teamSecret),[teamSecret]);
  useEffect(()=>localStorage.setItem("obgfcV11PhqEndpoint",phqEndpoint),[phqEndpoint]);
  useEffect(()=>localStorage.setItem("obgfcV11Fixtures",JSON.stringify(fixtures)),[fixtures]);
  useEffect(()=>localStorage.setItem("obgfcV11Ladder",JSON.stringify(ladder)),[ladder]);
  useEffect(()=>{if(clockRunning){timerRef.current=setInterval(()=>setClock(c=>c+1),1000);}else if(timerRef.current){clearInterval(timerRef.current);}return ()=>{if(timerRef.current)clearInterval(timerRef.current);};},[clockRunning]);
  useEffect(()=>()=>{if(videoUrl)URL.revokeObjectURL(videoUrl);if(scoutVideoUrl)URL.revokeObjectURL(scoutVideoUrl);if(recognitionRef.current)recognitionRef.current.stop();if(scoutRecRef.current)scoutRecRef.current.stop();},[]);
  useEffect(()=>{ checkPhq(); },[]);

  const intel=useMemo(()=>{
    const rose=notes.filter(n=>n.tone==="Rose"),bud=notes.filter(n=>n.tone==="Bud"),thorn=notes.filter(n=>n.tone==="Thorn");
    const topThemes=Object.entries(countBy(notes,"theme")).sort((a,b)=>b[1]-a[1]);
    const training=Object.entries(countBy(thorn,"theme")).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const players=Object.entries(countBy(notes.filter(n=>n.player),"player")).sort((a,b)=>b[1]-a[1]);
    const actions=training.map(([t,c],i)=>({title:`${i+1}. ${t}`,detail:`${c} thorn comment${c===1?"":"s"}. Convert into a training constraint, quarter-time cue, or game-day behaviour.`}));
    while(actions.length<5)actions.push({title:`${actions.length+1}. Capture more evidence`,detail:"Use voice notes or quick buttons to build a sharper action list."});
    return {rose,bud,thorn,topThemes,training,players,actions};
  },[notes]);
  const scoutIntel=useMemo(()=>{
    const byTheme=Object.entries(countBy(scoutNotes,"theme")).sort((a,b)=>b[1]-a[1]);
    const dangerPlayers=Object.entries(countBy(scoutNotes.filter(n=>n.player),"player")).sort((a,b)=>b[1]-a[1]);
    return {byTheme,dangerPlayers,strengths:scoutNotes.filter(n=>n.kind==="Strength"),weaknesses:scoutNotes.filter(n=>n.kind==="Weakness"),clips:scoutNotes.filter(n=>n.tag==="Clip")};
  },[scoutNotes]);
  const seasonData=useMemo(()=>{
    const games=[...season].map((m,i)=>{const t=countBy(m.notes,"theme");const tt=countBy(m.notes.filter(n=>n.tone==="Thorn"),"theme");return {id:m.id,label:`${m.opponent||m.matchTitle||("Game "+(i+1))}`,date:m.createdAt,total:m.notes.length,rose:m.notes.filter(n=>n.tone==="Rose").length,bud:m.notes.filter(n=>n.tone==="Bud").length,thorn:m.notes.filter(n=>n.tone==="Thorn").length,themes:t,thornThemes:tt};}).reverse();
    const all=new Set();games.forEach(g=>Object.keys(g.themes).forEach(t=>all.add(t)));
    const themeTrend={};all.forEach(t=>{themeTrend[t]=games.map(g=>g.themes[t]||0);});
    const st={};games.forEach(g=>Object.entries(g.thornThemes).forEach(([t,c])=>{st[t]=(st[t]||0)+c;}));
    return {games,themeTrend,recurringThorns:Object.entries(st).sort((a,b)=>b[1]-a[1]).slice(0,6),gameCount:games.length};
  },[season]);
  const shown=useMemo(()=>notes.filter(n=>filter==="All"||[n.quarter,n.scope,n.theme,n.tone,n.tag,n.source,n.player?`#${n.player}`:""].includes(filter)),[notes,filter]);
  const replayNotes=useMemo(()=>notes.filter(n=>n.source==="Replay"),[notes]);
  const maxTrend=useMemo(()=>{let m=1;Object.values(seasonData.themeTrend).forEach(a=>a.forEach(v=>{if(v>m)m=v;}));return m;},[seasonData]);
  const nextFixture=useMemo(()=>fixtures.find(f=>!f.result)||null,[fixtures]);
  const ourLadder=useMemo(()=>{const idx=ladder.findIndex(r=>/old brighton|obgfc|brighton/i.test(r.team||""));return idx>=0?{pos:idx+1,row:ladder[idx]}:null;},[ladder]);

  async function callPhq(action,params={}){
    const headers={"Content-Type":"application/json"};if(teamSecret)headers["x-coach-secret"]=teamSecret;
    const res=await fetch(phqEndpoint||"/api/playhq",{method:"POST",headers,body:JSON.stringify({action,params})});
    const text=await res.text();let data;try{data=JSON.parse(text);}catch{throw new Error(`Bad response: ${text.slice(0,160)}`);}
    if(!res.ok)throw new Error(data.error||`PlayHQ proxy ${res.status}`);return data;
  }
  async function checkPhq(){try{const d=await callPhq("status");if(d.configured){setPhqStatus("live");setPhqMsg(`Live PlayHQ connected (tenant ${d.tenant||"afl"}).`);}else{setPhqStatus("manual");setPhqMsg("PlayHQ key not set - manual mode. Add PLAYHQ_API_KEY in Vercel to go live.");}}catch{setPhqStatus("manual");setPhqMsg("PlayHQ endpoint not reachable yet - manual mode. (Normal on localhost or before the key is added.)");}}
  function addFixture(){if(!fixDraft.opponent){setStatus("Enter an opponent.");return;}setFixtures(prev=>[...prev,{...fixDraft,id:crypto.randomUUID()}]);setFixDraft({round:"",opponent:"",date:"",venue:"",result:""});setStatus("Fixture added.");}
  function delFixture(id){setFixtures(prev=>prev.filter(f=>f.id!==id));}
  function addLadderRow(){if(!ladDraft.team){setStatus("Enter a team.");return;}setLadder(prev=>[...prev,{...ladDraft,id:crypto.randomUUID()}].sort((a,b)=>Number(b.pts||0)-Number(a.pts||0)||Number(b.pct||0)-Number(a.pct||0)));setLadDraft({team:"",played:"",wins:"",losses:"",pct:"",pts:""});}
  function delLadderRow(id){setLadder(prev=>prev.filter(r=>r.id!==id));}
  function useFixtureForScout(f){setScoutTeam(f.opponent);setTab("scout");setStatus(`Scouting ${f.opponent}.`);}
  function useFixtureForMatch(f){setOpponent(f.opponent);if(f.venue)setVenue(f.venue);setMatchTitle(`Old Brighton vs ${f.opponent}${f.round?` - Round ${f.round}`:""}`);setTab("replay");setStatus(`Set up match vs ${f.opponent}.`);}

  function currentTimestamp(){if(tab==="replay"){const t=videoRef.current?.currentTime||0;return {seconds:t,label:timeLabel(t),source:"Replay"};}return {seconds:clock,label:timeLabel(clock),source:"Match Day"};}
  function addNote(rawInput,overrides={}){const raw=rawInput.trim();if(!raw)return;const ts=currentTimestamp();const ap=detectPlayer(raw);const rp=overrides.player??(player==="Auto"?ap:player);const rs=overrides.scope??(scope==="Auto"?detectScope(raw):scope);const rt=overrides.theme??(theme==="Auto-detect"?detectTheme(raw):theme);const rtone=overrides.tone??detectTone(raw);const rtag=overrides.tag??detectTag(raw);const note={id:crypto.randomUUID(),matchTitle,opponent,venue,quarter,seconds:ts.seconds,clockLabel:ts.label,source:ts.source,scope:rs,player:rp,theme:rt,tone:rtone,tag:rtag,raw,interpretation:`${rtone}: ${rs}${rp?` #${rp}`:""} - ${rt}. ${raw}`,createdAt:new Date().toISOString()};setNotes(prev=>[note,...prev]);setStatus(`Added ${rtone} note (${ts.source} ${ts.label}) - ${rt}${rp?` #${rp}`:""}.`);}
  function jumpTo(s){if(tab!=="replay"||!videoRef.current)return;videoRef.current.currentTime=s;videoRef.current.play();}
  function handleVideo(e){const f=e.target.files?.[0];if(!f)return;if(videoUrl)URL.revokeObjectURL(videoUrl);const u=URL.createObjectURL(f);setVideoUrl(u);setVideoName(f.name);setStatus("Video loaded.");}
  async function captureScreen(){try{const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});if(videoRef.current){videoRef.current.srcObject=s;videoRef.current.controls=true;videoRef.current.play();}setVideoName("Screen / footage");}catch{setStatus("Screen capture cancelled.");}}
  function startQuarter(q){setQuarter(q);if(tab==="matchday"){setClock(0);setClockRunning(false);}}
  function addQuick(tag){const text=tag==="Great"?"Great moment. Reinforce this behaviour.":tag==="Fix"?"Fix this. Needs coaching attention.":tag==="Watch"?"Watch this pattern again.":tag==="Clip"?"Clip this moment for video review.":tag==="Training"?"Training theme identified.":tag==="Quarter-time"?"Quarter-time message.":tag==="Opposition"?"Opposition pattern identified.":tag==="Momentum"?"Momentum shift.":tag==="Effort"?"Effort and work-rate note.":"Player-specific development note.";addNote(text,{tag,scope:tag==="Opposition"?"Opposition":undefined});}
  function startSpeech(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setStatus("Speech recognition unavailable. Use Chrome or Edge.");return;}const rec=new SR();rec.continuous=true;rec.interimResults=true;rec.lang="en-AU";rec.onstart=()=>{setListening(true);setStatus("Live transcription on.");};rec.onresult=(e)=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)addNote(t);else interim+=t;}setLive(interim);};rec.onerror=(e)=>setStatus(`Speech issue: ${e.error}.`);rec.onend=()=>setListening(false);recognitionRef.current=rec;rec.start();}
  function stopSpeech(){if(recognitionRef.current){recognitionRef.current.stop();recognitionRef.current=null;}setListening(false);setLive("");}
  async function startAudio(){try{const s=await navigator.mediaDevices.getUserMedia({audio:true});const rec=new MediaRecorder(s);audioChunksRef.current=[];rec.ondataavailable=e=>{if(e.data.size>0)audioChunksRef.current.push(e.data);};rec.onstop=()=>{const b=new Blob(audioChunksRef.current,{type:"audio/webm"});setAudioUrl(URL.createObjectURL(b));s.getTracks().forEach(t=>t.stop());};recorderRef.current=rec;rec.start();setRecording(true);}catch{setStatus("Audio recording blocked.");}}
  function stopAudio(){if(recorderRef.current&&recorderRef.current.state!=="inactive")recorderRef.current.stop();setRecording(false);}
  function exportAudio(){if(!audioUrl)return;const a=document.createElement("a");a.href=audioUrl;a.download="obgfc-v11-audio.webm";document.body.appendChild(a);a.click();a.remove();}

  function handleScoutVideo(e){const f=e.target.files?.[0];if(!f)return;if(scoutVideoUrl)URL.revokeObjectURL(scoutVideoUrl);const u=URL.createObjectURL(f);setScoutVideoUrl(u);setScoutVideoName(f.name);}
  function addScoutNote(rawInput,overrides={}){const raw=rawInput.trim();if(!raw)return;const t=scoutVideoRef.current?.currentTime||0;const ap=detectPlayer(raw);const rp=overrides.player??(scoutPlayer==="Auto"?ap:scoutPlayer);const rt=overrides.theme??(scoutTheme==="Auto-detect"?detectTheme(raw):scoutTheme);let kind=overrides.kind||"";const l=raw.toLowerCase();if(!kind){if(l.includes("weak")||l.includes("expose")||l.includes("vulnerab"))kind="Weakness";else if(l.includes("strong")||l.includes("dangerous")||l.includes("threat")||l.includes("good"))kind="Strength";else kind="Observation";}const named=scoutRoster.find(r=>r.number===rp);const note={id:crypto.randomUUID(),team:scoutTeam||"Unnamed opponent",seconds:t,clockLabel:timeLabel(t),player:rp,playerName:named?named.name:"",theme:rt,kind,tag:overrides.tag||detectTag(raw),raw,createdAt:new Date().toISOString()};setScoutNotes(prev=>[note,...prev]);setStatus(`Scout note (${note.clockLabel}) - ${rt}${rp?` #${rp}${named?` ${named.name}`:""}`:""} [${kind}].`);}
  function scoutJump(s){if(!scoutVideoRef.current)return;scoutVideoRef.current.currentTime=s;scoutVideoRef.current.play();}
  function startScoutSpeech(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setStatus("Speech recognition unavailable.");return;}const rec=new SR();rec.continuous=true;rec.interimResults=true;rec.lang="en-AU";rec.onstart=()=>{setScoutListening(true);setStatus("Scout transcription on.");};rec.onresult=(e)=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)addScoutNote(t);else interim+=t;}setScoutLive(interim);};rec.onerror=(e)=>setStatus(`Speech issue: ${e.error}.`);rec.onend=()=>setScoutListening(false);scoutRecRef.current=rec;rec.start();}
  function stopScoutSpeech(){if(scoutRecRef.current){scoutRecRef.current.stop();scoutRecRef.current=null;}setScoutListening(false);setScoutLive("");}
  function addScoutQuick(tag){const map={"Danger player":{text:"Dangerous player - watch closely.",kind:"Strength",theme:"Danger Player"},"Weakness":{text:"Weakness to exploit.",kind:"Weakness",theme:"Weakness"},"Strength":{text:"Strength we must neutralise.",kind:"Strength",theme:"General"},"Ball movement":{text:"Ball movement pattern.",kind:"Observation",theme:"Ball Movement"},"Stoppage":{text:"Stoppage setup pattern.",kind:"Observation",theme:"Stoppage Setup"},"Kick-in":{text:"Kick-in setup pattern.",kind:"Observation",theme:"Kick-in Setup"},"Set play":{text:"Set play observed.",kind:"Observation",theme:"Set Play"},"Clip":{text:"Clip this moment.",kind:"Observation",theme:"General",tag:"Clip"}};const m=map[tag]||{text:tag,kind:"Observation",theme:"General"};addScoutNote(m.text,{kind:m.kind,theme:m.theme,tag:m.tag});}
  function clearScoutNotes(){setScoutNotes([]);setStatus("Scout notes cleared.");}
  async function loadOppositionRoster(){try{const teams=await callPhq("teams",{});if(teams.configured&&teams.data){setStatus("Pulled team list from PlayHQ.");}else{setStatus("PlayHQ not live yet - add roster manually below.");}}catch{setStatus("Could not auto-load roster (manual mode).");}}
  function parseManualRoster(text){const rows=text.split(/\n|,/).map(s=>s.trim()).filter(Boolean);const out=[];rows.forEach(r=>{const m=r.match(/(\d{1,2})\s*[-:. ]\s*(.+)/);if(m)out.push({number:String(Number(m[1])),name:m[2].trim()});});setScoutRoster(out);setStatus(`Loaded ${out.length} opposition players.`);}
  function scoutPayload(){const roster=scoutRoster.length?`\n\nOPPONENT TEAM LIST:\n${scoutRoster.map(r=>`#${r.number} ${r.name}`).join("\n")}`:"";const header=`OPPOSITION: ${scoutTeam||"Unnamed opponent"}${roster}\n\nSCOUTING VERBATIM NOTES (most recent first):`;const body=scoutNotes.map(n=>`[${n.clockLabel}${n.player?` #${n.player}${n.playerName?` ${n.playerName}`:""}`:""}] (${n.kind}/${n.theme}) ${n.raw}`).join("\n");return `${header}\n${body||"No scouting notes captured yet."}`;}
  function saveScoutTeam(){if(!scoutNotes.length){setStatus("Add scouting notes before saving.");return;}setScoutDB(prev=>[{id:crypto.randomUUID(),team:scoutTeam||"Unnamed opponent",createdAt:new Date().toISOString(),notes:scoutNotes,roster:scoutRoster,report:scoutOut||"",preview:previewOut||""},...prev]);setStatus(`Saved profile for ${scoutTeam||"opponent"}.`);}
  function loadScoutTeam(id){const p=scoutDB.find(x=>x.id===id);if(!p)return;setScoutTeam(p.team);setScoutNotes(p.notes||[]);setScoutRoster(p.roster||[]);setScoutOut(p.report||"");setPreviewOut(p.preview||"");setStatus(`Loaded profile for ${p.team}.`);}
  function exportScoutJson(){download("obgfc-v11-scout-db.json",JSON.stringify({currentTeam:scoutTeam,scoutNotes,scoutRoster,scoutDB},null,2),"application/json");}
  function importScoutJson(e){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(Array.isArray(d.scoutNotes))setScoutNotes(d.scoutNotes);if(Array.isArray(d.scoutDB))setScoutDB(d.scoutDB);if(Array.isArray(d.scoutRoster))setScoutRoster(d.scoutRoster);if(d.currentTeam)setScoutTeam(d.currentTeam);setStatus("Imported scouting data.");}catch{setStatus("Could not import scouting JSON.");}};r.readAsText(f);}

  function scoreContext(){if(!scoreUs&&!scoreThem&&!qScores)return "";const parts=[];if(scoreUs||scoreThem)parts.push(`Final: Old Brighton ${scoreUs||"?"} - ${scoreThem||"?"} ${opponent||"opponent"}`);if(qScores)parts.push(`Quarter scores: ${qScores}`);return `\n\nREAL SCORE CONTEXT:\n${parts.join("\n")}`;}
  function summaryText(){const lines=[`# ${matchTitle}`,`Opponent: ${opponent||"-"}`,`Venue: ${venue||"-"}`,`Generated: ${new Date().toLocaleString()}`];const sc=scoreContext();if(sc)lines.push(sc.trim());lines.push("","## Rose / Bud / Thorn",`Rose: ${intel.rose.length}`,`Bud: ${intel.bud.length}`,`Thorn: ${intel.thorn.length}`,"","## Main Themes");if(!intel.topThemes.length)lines.push("No themes captured yet.");else intel.topThemes.slice(0,10).forEach(([t,c])=>lines.push(`- ${t}: ${c}`));lines.push("","## Top 5 Coaching Actions");intel.actions.forEach(a=>lines.push(`- ${a.title}: ${a.detail}`));lines.push("","## Timestamped Calls");[...notes].reverse().forEach(n=>lines.push(`- [${n.source}] ${n.quarter} ${n.clockLabel} | ${n.scope}${n.player?` #${n.player}`:""} | ${n.theme} | ${n.tone} | ${n.tag}: ${n.raw}`));return lines.join("\n");}
  function exportMarkdown(){download("obgfc-v11-match-report.md",summaryText(),"text/markdown");}
  function exportCsv(){const h=["Source","Match","Opponent","Venue","Quarter","Clock","Scope","Player","Theme","Tone","Tag","Raw","Interpretation","Created At"];const rows=notes.map(n=>[n.source,n.matchTitle,n.opponent,n.venue,n.quarter,n.clockLabel,n.scope,n.player,n.theme,n.tone,n.tag,n.raw,n.interpretation,n.createdAt]);download("obgfc-v11-notes.csv",[h,...rows].map(r=>r.map(csvEscape).join(",")).join("\n"),"text/csv");}
  function exportJson(){download("obgfc-v11-data.json",JSON.stringify({matchTitle,opponent,venue,notes,season,scoutDB,fixtures,ladder},null,2),"application/json");}
  function exportWord(){const stop=stopOutput?`<h2>STOP5 Review</h2><p>${nl2br(stopOutput)}</p>`:"";const extra=aiOutput?`<h2>AI Coach Summary</h2><p>${nl2br(aiOutput)}</p>`:"";download("obgfc-v11-match-report.doc",`<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial;color:#111">${nl2br(summaryText())}<br/>${stop}${extra}</body></html>`,"application/msword");}
  function saveSnapshot(){setSeason(prev=>[{id:crypto.randomUUID(),matchTitle,opponent,venue,createdAt:new Date().toISOString(),notes,summary:summaryText()},...prev]);setStatus("Saved match snapshot.");}
  function importJson(e){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(Array.isArray(d.notes))setNotes(d.notes);if(Array.isArray(d.season))setSeason(d.season);if(Array.isArray(d.scoutDB))setScoutDB(d.scoutDB);if(Array.isArray(d.fixtures))setFixtures(d.fixtures);if(Array.isArray(d.ladder))setLadder(d.ladder);setStatus("Imported data.");}catch{setStatus("Could not import JSON.");}};r.readAsText(f);}

  async function callProxy(payload,mode){const headers={"Content-Type":"application/json"};if(teamSecret)headers["x-coach-secret"]=teamSecret;const res=await fetch(aiEndpoint||"/api/coach",{method:"POST",headers,body:JSON.stringify({payload,mode})});const text=await res.text();let data;try{data=JSON.parse(text);}catch{throw new Error(`Bad response: ${text.slice(0,160)}`);}if(!res.ok)throw new Error(data.error||`Proxy ${res.status}`);return data;}
  function buildAiPayload(){if(aiScope==="season"){const g=seasonData.games.map(x=>`${x.label} (${new Date(x.date).toLocaleDateString()}): total ${x.total}, rose ${x.rose}, bud ${x.bud}, thorn ${x.thorn}. Themes: ${Object.entries(x.themes).map(([t,c])=>`${t} ${c}`).join(", ")}`).join("\n");return `SEASON DATA (${seasonData.gameCount} saved games)\n${g}\n\nRecurring improvement themes: ${seasonData.recurringThorns.map(([t,c])=>`${t}: ${c}`).join(", ")}`;}return summaryText();}
  async function runAi(){setAiBusy(true);setAiOutput("");setAiInfo("");try{const d=await callProxy(buildAiPayload(),"default");setAiOutput(d.summary||"No response.");setAiInfo(`Engine: ${d.provider||"?"}`);}catch(err){setAiOutput(`AI request failed. ${err.message}`);setAiInfo("Error");}finally{setAiBusy(false);}}
  function buildStop5Payload(){const src=replayNotes.length?replayNotes:notes;const list=src.slice(0,stopLimit);const header=`MATCH: ${matchTitle}\nOPPONENT: ${opponent||"-"}${scoreContext()}\n\nCOACH VERBATIM COMMENTARY (most recent first, ${list.length} of ${src.length}):`;return `${header}\n${[...list].map(n=>`[${n.clockLabel}${n.quarter?` ${n.quarter}`:""}${n.player?` #${n.player}`:""}] ${n.raw}`).join("\n")||"No commentary yet."}`;}
  async function runStop5(){setStopBusy(true);setStopOutput("");setStopInfo("");const src=replayNotes.length?replayNotes:notes;if(!src.length){setStopOutput("No commentary captured yet.");setStopBusy(false);return;}try{const used=Math.min(stopLimit,src.length);const d=await callProxy(buildStop5Payload(),"stop5");setStopOutput(d.summary||"No response.");setStopInfo(`Engine: ${d.provider||"?"} | analysed ${used} of ${src.length} verbatims${(scoreUs||scoreThem)?" + real score":""}`);}catch(err){setStopOutput(`STOP5 failed. ${err.message}`);setStopInfo("Error");}finally{setStopBusy(false);}}
  async function runScoutReport(){setScoutBusy(true);setScoutOut("");setScoutInfo("");if(!scoutNotes.length){setScoutOut("Add scouting notes first.");setScoutBusy(false);return;}try{const d=await callProxy(scoutPayload(),"scout");setScoutOut(d.summary||"No response.");setScoutInfo(`Engine: ${d.provider||"?"} | ${scoutNotes.length} notes${scoutRoster.length?` + ${scoutRoster.length} players`:""}`);}catch(err){setScoutOut(`Scout report failed. ${err.message}`);setScoutInfo("Error");}finally{setScoutBusy(false);}}
  async function runPreview(){setPreviewBusy(true);setPreviewOut("");if(!scoutNotes.length){setPreviewOut("Add scouting notes first.");setPreviewBusy(false);return;}try{const d=await callProxy(scoutPayload(),"preview");setPreviewOut(d.summary||"No response.");}catch(err){setPreviewOut(`Preview failed. ${err.message}`);}finally{setPreviewBusy(false);}}
  function copyText(t){if(t)navigator.clipboard?.writeText(t);}
  function exportStop5Word(){download("obgfc-v11-stop5.doc",`<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial"><h1>${safeHtml(matchTitle)} - STOP5</h1><p>${nl2br(stopOutput)}</p></body></html>`,"application/msword");}
  function exportAiWord(){download("obgfc-v11-ai-coach.doc",`<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial"><h1>${safeHtml(matchTitle)} - AI Coach</h1><p>${nl2br(aiOutput)}</p></body></html>`,"application/msword");}
  function exportScoutWord(){const rep=scoutOut?`<h2>Scout Report + Game Plan</h2><p>${nl2br(scoutOut)}</p>`:"";const prev=previewOut?`<h2>Pre-Match Preview</h2><p>${nl2br(previewOut)}</p>`:"";download(`obgfc-v11-scout-${(scoutTeam||"opponent").replace(/\s+/g,"-").toLowerCase()}.doc`,`<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial;color:#111"><h1>Opposition Scout: ${safeHtml(scoutTeam||"Opponent")}</h1>${rep}${prev}</body></html>`,"application/msword");}

  // ---------- COMMITTEE PACK ----------
  function buildPackPayload(){
    const lastGame = season[0] || null;
    const lastThemes = lastGame ? Object.entries(countBy(lastGame.notes,"theme")).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([t,c])=>`${t} ${c}`).join(", ") : (intel.topThemes.slice(0,6).map(([t,c])=>`${t} ${c}`).join(", ")||"none yet");
    const lastScore = (scoreUs||scoreThem)?`Old Brighton ${scoreUs||"?"} - ${scoreThem||"?"} ${opponent||""}`:"score not entered";
    const oppName = nextOpp || nextFixture?.opponent || scoutTeam || "next opponent";
    const savedScout = scoutDB.find(p=>p.team && oppName && p.team.toLowerCase()===oppName.toLowerCase());
    const scoutSummary = (savedScout?.report) || scoutOut || (scoutNotes.length?scoutPayload():"No scouting notes yet for the next opponent.");
    const ladderText = ourLadder ? `Old Brighton are ${ordinal(ourLadder.pos)} on the ladder (${ourLadder.row.wins||0}-${ourLadder.row.losses||0}, ${ourLadder.row.pct||"?"}%, ${ourLadder.row.pts||0} pts).` : (ladder.length?`Ladder has ${ladder.length} teams; our position not detected (name row 'Old Brighton').`:"Ladder not entered.");
    const trend = seasonData.recurringThorns.length?`Recurring improvement themes this season: ${seasonData.recurringThorns.map(([t,c])=>`${t} (${c})`).join(", ")}.`:"Not enough saved games for a season trend yet.";
    const rbt = `Season so far across ${seasonData.gameCount} saved games.`;
    return [
      `WEEK: ${packWeek||new Date().toLocaleDateString()}`,
      ``,
      `LAST GAME:`,
      `Result/score: ${lastScore}`,
      `Main themes: ${lastThemes}`,
      stopOutput?`Coach STOP5 debrief:\n${stopOutput}`:``,
      ``,
      `LADDER & SEASON:`,
      ladderText,
      trend,
      rbt,
      ``,
      `NEXT OPPONENT: ${oppName}`,
      nextFixture?`Fixture: Round ${nextFixture.round||"?"} ${nextFixture.date||""} ${nextFixture.venue?`at ${nextFixture.venue}`:""}`:``,
      `Scouting summary:\n${scoutSummary}`,
    ].filter(Boolean).join("\n");
  }
  function ordinal(n){const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
  async function runPack(){
    setPackBusy(true);setPackOut("");setPackInfo("");
    try{ const d=await callProxy(buildPackPayload(),"pack"); setPackOut(d.summary||"No response."); setPackInfo(`Engine: ${d.provider||"?"}`); }
    catch(err){ setPackOut(`Committee pack failed. ${err.message}`); setPackInfo("Error"); }
    finally{ setPackBusy(false); }
  }
  function packHtml(){
    const oppName = nextOpp || nextFixture?.opponent || scoutTeam || "Next opponent";
    const ladderRows = ladder.map((r,i)=>`<tr${ourLadder&&ourLadder.pos===i+1?' style="font-weight:800;background:#eef6ff"':''}><td>${i+1}</td><td>${safeHtml(r.team)}</td><td>${r.played||0}</td><td>${r.wins||0}-${r.losses||0}</td><td>${r.pct||"-"}</td><td>${r.pts||0}</td></tr>`).join("");
    const trendRows = Object.entries(seasonData.themeTrend).sort((a,b)=>{const sa=a[1].reduce((x,y)=>x+y,0),sb=b[1].reduce((x,y)=>x+y,0);return sb-sa;}).slice(0,8).map(([t,arr])=>`<tr><td>${safeHtml(t)}</td><td>${arr.join(", ")}</td><td>${arr.reduce((x,y)=>x+y,0)}</td></tr>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>Match Committee Pack</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.45;margin:24px}
h1{color:#0b3b5e;margin:0 0 4px}
.sub{color:#555;margin:0 0 18px}
h2{color:#075985;border-bottom:2px solid #cde3f0;padding-bottom:4px;margin-top:24px}
table{border-collapse:collapse;width:100%;margin-top:8px;font-size:14px}
th,td{border:1px solid #d0d7de;padding:6px 8px;text-align:left}
th{background:#0b3b5e;color:#fff}
.small{font-size:12px;color:#666}
.box{background:#f6f9fc;border:1px solid #d0d7de;border-radius:8px;padding:12px;white-space:pre-wrap}
@media print{body{margin:0}}
</style></head><body>
<h1>Old Brighton Women's Team — Match Committee Pack</h1>
<p class="sub">Week: ${safeHtml(packWeek||new Date().toLocaleDateString())} &nbsp;|&nbsp; Next opponent: ${safeHtml(oppName)}</p>

<h2>Coach's Summary</h2>
<div class="box">${packOut?nl2br(packOut):"Generate the AI committee summary to fill this section."}</div>

<h2>Last Game Debrief (STOP5)</h2>
<div class="box">${stopOutput?nl2br(stopOutput):"No STOP5 debrief generated yet."}</div>

<h2>Ladder</h2>
${ladder.length?`<table><tr><th>#</th><th>Team</th><th>P</th><th>W-L</th><th>%</th><th>Pts</th></tr>${ladderRows}</table>`:'<p class="small">No ladder entered.</p>'}

<h2>Season Theme Trend (oldest → newest)</h2>
${trendRows?`<table><tr><th>Theme</th><th>Per game</th><th>Total</th></tr>${trendRows}</table>`:'<p class="small">Not enough saved games yet.</p>'}

<h2>Next Opponent Scout — ${safeHtml(oppName)}</h2>
<div class="box">${scoutOut?nl2br(scoutOut):(scoutNotes.length?nl2br(scoutPayload()):"No scouting report generated yet.")}</div>

${previewOut?`<h2>Pre-Match Player Preview</h2><div class="box">${nl2br(previewOut)}</div>`:""}

<p class="small">Generated by OBGFC Coaching Intelligence V11 on ${new Date().toLocaleString()}.</p>
</body></html>`;
  }
  function exportPackWord(){ download(`obgfc-committee-pack-${(packWeek||new Date().toLocaleDateString()).replace(/[^\w]+/g,"-").toLowerCase()}.doc`, packHtml(), "application/msword"); }
  function printPackPdf(){
    const w=window.open("","_blank");
    if(!w){ setStatus("Popup blocked - allow popups to print the pack, or use Export Word."); return; }
    w.document.write(packHtml()); w.document.close();
    w.focus(); setTimeout(()=>{ try{ w.print(); }catch{} }, 400);
  }

  const phqBadge = phqStatus==="live" ? <span className="pill rose">PlayHQ live</span> : <span className="pill thorn">Manual mode</span>;

  return (
    <div className="app">
      <div className="wrap">
        <header className="hero">
          <div className="eyebrow">Old Brighton Women's Team</div>
          <h1>V11 Coaching Intelligence</h1>
          <p>Review, live capture, opposition scouting, PlayHQ fixtures/ladder, season trends — and a one-click Match Committee Pack.</p>
          <div className="tabs">
            <button className={tab==="replay"?"tab active":"tab"} onClick={()=>{setTab("replay");setStatus("Replay Review.");}}>Replay Review</button>
            <button className={tab==="matchday"?"tab active":"tab"} onClick={()=>{setTab("matchday");setStatus("Match Day.");}}>Match Day</button>
            <button className={tab==="scout"?"tab active":"tab"} onClick={()=>{setTab("scout");setStatus("Opposition Scout.");}}>Opposition Scout</button>
            <button className={tab==="fixtures"?"tab active":"tab"} onClick={()=>{setTab("fixtures");setStatus("Fixtures & Ladder.");}}>Fixtures &amp; Ladder</button>
            <button className={tab==="season"?"tab active":"tab"} onClick={()=>{setTab("season");setStatus("Season Dashboard.");}}>Season Dashboard</button>
            <button className={tab==="pack"?"tab active":"tab"} onClick={()=>{setTab("pack");setStatus("Committee Pack.");}}>Committee Pack</button>
          </div>
          <div className="status"><b>Status:</b> {status} &nbsp; {phqBadge}</div>
        </header>

        {tab==="pack" && (
        <main className="grid two top">
          <section className="card stop5">
            <div className="actions space"><h2>Weekly Match Committee Pack</h2><span className="pill">1-click report</span></div>
            <p className="muted">Assembles last game's STOP5, the ladder, the season trend and next week's opposition scout into one committee-ready document. Fill the fields, generate the coach's summary, then export to PDF or Word.</p>
            <div className="grid two top-sm">
              <label><span>Week / round label</span><input value={packWeek} onChange={e=>setPackWeek(e.target.value)} placeholder="Round 15 - w/c 4 Aug" /></label>
              <label><span>Next opponent</span><input value={nextOpp} onChange={e=>setNextOpp(e.target.value)} placeholder={nextFixture?nextFixture.opponent:"Kew"} /></label>
            </div>
            <div className="actions top">
              <button className="green" onClick={runPack} disabled={packBusy}>{packBusy?"Writing coach summary…":"Generate coach summary"}</button>
              <button className="blue" onClick={printPackPdf}>Export / Print PDF</button>
              <button onClick={exportPackWord}>Export Word</button>
              {packOut && <button onClick={()=>copyText(packOut)}>Copy summary</button>}
            </div>
            {packInfo && <p className="muted top-sm">{packInfo}</p>}
            <div className="note ai top-sm">{packOut||"Your committee coach-summary will appear here. The PDF/Word export also includes the ladder table, season trend, STOP5 and opposition scout automatically."}</div>
          </section>

          <aside className="grid">
            <section className="card">
              <h2>What's included</h2>
              <div className="row"><span>Coach's AI summary</span><b>{packOut?"✓":"—"}</b></div>
              <div className="row"><span>Last game STOP5</span><b>{stopOutput?"✓":"—"}</b></div>
              <div className="row"><span>Ladder table</span><b>{ladder.length?`${ladder.length} teams`:"—"}</b></div>
              <div className="row"><span>Season trend</span><b>{seasonData.gameCount?`${seasonData.gameCount} games`:"—"}</b></div>
              <div className="row"><span>Opposition scout</span><b>{scoutOut?"✓":(scoutNotes.length?`${scoutNotes.length} notes`:"—")}</b></div>
              <div className="row"><span>Player preview</span><b>{previewOut?"✓":"—"}</b></div>
            </section>
            <section className="card">
              <h2>Quick checklist</h2>
              <p className="muted">For the fullest pack:</p>
              <div className="note">1. Replay tab → generate the <b>STOP5</b> for last game.</div>
              <div className="note">2. Fixtures tab → make sure the <b>ladder</b> has an "Old Brighton" row.</div>
              <div className="note">3. Scout tab → generate the <b>scout report</b> for the next opponent.</div>
              <div className="note">4. Back here → <b>Generate coach summary</b> → <b>Export PDF</b>.</div>
            </section>
            <section className="card">
              <h2>Our ladder position</h2>
              {ourLadder?<div className="note"><b>{ordinal(ourLadder.pos)}</b> — {ourLadder.row.wins||0}-{ourLadder.row.losses||0}, {ourLadder.row.pct||"?"}%, {ourLadder.row.pts||0} pts</div>:<p className="muted">Add a ladder row named "Old Brighton" on the Fixtures tab to show position here.</p>}
            </section>
          </aside>
        </main>
        )}

        {tab==="fixtures" && (
        <main className="grid two top">
          <section className="card">
            <div className="actions space"><h2>PlayHQ connection</h2>{phqBadge}</div>
            <p className="muted">{phqMsg||"Checking PlayHQ..."}</p>
            <div className="actions"><button onClick={checkPhq}>Re-check connection</button><label className="inline"><span>Endpoint</span><input value={phqEndpoint} onChange={e=>setPhqEndpoint(e.target.value)} placeholder="/api/playhq" /></label></div>
            <p className="muted top-sm">Go live: add <b>PLAYHQ_API_KEY</b>, <b>PLAYHQ_ORG_ID</b> and <b>PLAYHQ_TENANT=afl</b> in Vercel, then redeploy.</p>

            <h2 className="top">Add fixture</h2>
            <div className="grid three top-sm">
              <label><span>Round</span><input value={fixDraft.round} onChange={e=>setFixDraft({...fixDraft,round:e.target.value})} placeholder="15" /></label>
              <label className="wide"><span>Opponent</span><input value={fixDraft.opponent} onChange={e=>setFixDraft({...fixDraft,opponent:e.target.value})} placeholder="Kew" /></label>
              <label><span>Date</span><input value={fixDraft.date} onChange={e=>setFixDraft({...fixDraft,date:e.target.value})} placeholder="Sat 4 Aug" /></label>
              <label className="wide"><span>Venue</span><input value={fixDraft.venue} onChange={e=>setFixDraft({...fixDraft,venue:e.target.value})} placeholder="Brighton Beach Oval" /></label>
              <label><span>Result</span><input value={fixDraft.result} onChange={e=>setFixDraft({...fixDraft,result:e.target.value})} placeholder="W 8.6-6.5" /></label>
            </div>
            <div className="actions top-sm"><button className="green" onClick={addFixture}>Add fixture</button></div>

            <h2 className="top">Fixtures</h2>
            {fixtures.length===0?<p className="muted">No fixtures yet.</p>:fixtures.map(f=>(
              <div className="row" key={f.id}><span><b>R{f.round||"?"}</b> vs {f.opponent} <span className="muted">{f.date||""} {f.venue?`· ${f.venue}`:""} {f.result?`· ${f.result}`:""}</span></span><span className="actions"><button onClick={()=>useFixtureForScout(f)}>Scout</button><button onClick={()=>useFixtureForMatch(f)}>Set match</button><button className="red" onClick={()=>delFixture(f.id)}>x</button></span></div>
            ))}
          </section>
          <aside className="grid">
            <section className="card">
              <h2>Ladder</h2>
              <div className="grid three top-sm">
                <label className="wide"><span>Team</span><input value={ladDraft.team} onChange={e=>setLadDraft({...ladDraft,team:e.target.value})} placeholder="Old Brighton" /></label>
                <label><span>P</span><input value={ladDraft.played} onChange={e=>setLadDraft({...ladDraft,played:e.target.value})} /></label>
                <label><span>W</span><input value={ladDraft.wins} onChange={e=>setLadDraft({...ladDraft,wins:e.target.value})} /></label>
                <label><span>L</span><input value={ladDraft.losses} onChange={e=>setLadDraft({...ladDraft,losses:e.target.value})} /></label>
                <label><span>%</span><input value={ladDraft.pct} onChange={e=>setLadDraft({...ladDraft,pct:e.target.value})} /></label>
                <label><span>Pts</span><input value={ladDraft.pts} onChange={e=>setLadDraft({...ladDraft,pts:e.target.value})} /></label>
              </div>
              <div className="actions top-sm"><button className="green" onClick={addLadderRow}>Add ladder row</button></div>
              <div className="top-sm">{ladder.length===0?<p className="muted">No ladder yet.</p>:(<><div className="row"><span><b>Team</b></span><span><b>P / W-L / % / Pts</b></span></div>{ladder.map((r,i)=>(<div className="row" key={r.id}><span>{i+1}. {r.team}</span><span className="actions"><span className="muted">{r.played||0} / {r.wins||0}-{r.losses||0} / {r.pct||"-"} / {r.pts||0}</span><button className="red" onClick={()=>delLadderRow(r.id)}>x</button></span></div>))}</>)}</div>
            </section>
            <section className="card"><h2>Next up</h2>{nextFixture?<div className="note"><b>Round {nextFixture.round||"?"} vs {nextFixture.opponent}</b><div className="muted">{nextFixture.date||""} {nextFixture.venue?`· ${nextFixture.venue}`:""}</div><div className="actions top-sm"><button onClick={()=>useFixtureForScout(nextFixture)}>Scout them</button><button onClick={()=>useFixtureForMatch(nextFixture)}>Set up match</button></div></div>:<p className="muted">No upcoming fixture. Add one on the left.</p>}</section>
          </aside>
        </main>
        )}

        {tab==="scout" && (
        <main className="grid two top">
          <section className="card no-print">
            <label className="wide"><span>Opposition team</span><input value={scoutTeam} onChange={e=>setScoutTeam(e.target.value)} placeholder="e.g. Kew, Caulfield, Beaumaris" /></label>
            <div className="actions top-sm"><label className="filebtn blue">Load opposition video<input type="file" accept="video/*" onChange={handleScoutVideo} /></label><button className="green" onClick={()=>scoutVideoRef.current?.play()}>Play</button><button className="orange" onClick={()=>scoutVideoRef.current?.pause()}>Pause</button><button onClick={loadOppositionRoster}>Auto-load roster (PlayHQ)</button><span className="pill push">{scoutVideoName}</span></div>
            <div className="videowrap"><video ref={scoutVideoRef} src={scoutVideoUrl} controls /></div>
            <div className="sub top"><h2>Opponent roster {scoutRoster.length?`(${scoutRoster.length})`:""}</h2><p className="muted">Paste as "12 Sarah Jones" per line (or comma-separated). PlayHQ can auto-fill once live.</p><textarea placeholder={"12 Sarah Jones\n24 Mia Brown\n7 Ella Smith"} onBlur={e=>parseManualRoster(e.target.value)} />{scoutRoster.length>0&&<div className="actions top-sm">{scoutRoster.slice(0,12).map(r=><span className="pill" key={r.number}>#{r.number} {r.name}</span>)}</div>}</div>
            <div className="grid two top"><label><span>Player #</span><select value={scoutPlayer} onChange={e=>setScoutPlayer(e.target.value)}><option>Auto</option><option value="">No player</option>{PLAYERS.map(p=><option key={p}>{p}</option>)}</select></label><label><span>Theme</span><select value={scoutTheme} onChange={e=>setScoutTheme(e.target.value)}><option>Auto-detect</option>{SCOUT_THEMES.map(t=><option key={t}>{t}</option>)}</select></label></div>
            <div className="sub top"><h2>Scout commentary</h2><div className="actions">{!scoutListening?<button className="orange" onClick={startScoutSpeech}>Start scouting commentary</button>:<button className="red" onClick={stopScoutSpeech}>Stop</button>}</div><div className="note live top-sm">{scoutLive||"Live scouting transcript appears here."}</div></div>
            <div className="sub top"><h2>Quick scout tags</h2><div className="actions">{SCOUT_QUICK.map(t=><button key={t} onClick={()=>addScoutQuick(t)}>{t}</button>)}</div></div>
            <div className="sub top"><h2>Manual scout note</h2><textarea value={scoutManual} onChange={e=>setScoutManual(e.target.value)} placeholder="Type an opposition note..." /><div className="actions top-sm"><button className="blue" onClick={()=>{addScoutNote(scoutManual);setScoutManual("");}}>Add scout note</button></div></div>
            <div className="sub top"><h2>Scout database</h2><div className="actions"><button className="green" onClick={saveScoutTeam}>Save team profile</button><button onClick={exportScoutJson}>Export scout JSON</button><label className="filebtn">Import scout JSON<input type="file" accept="application/json" onChange={importScoutJson} /></label><button className="red" onClick={clearScoutNotes}>Clear notes</button></div>{scoutDB.length>0&&<div className="list top-sm">{scoutDB.slice(0,10).map(p=><div className="row" key={p.id}><span>{p.team} <span className="muted">({p.notes.length} notes, {new Date(p.createdAt).toLocaleDateString()})</span></span><button onClick={()=>loadScoutTeam(p.id)}>Load</button></div>)}</div>}</div>
          </section>
          <aside className="grid">
            <section className="card stop5"><div className="actions space"><h2>Scout Report + Game Plan</h2><span className="pill">{scoutNotes.length} notes</span></div><p className="muted">Gemini builds a report and game plan to beat {scoutTeam||"this opponent"}{scoutRoster.length?", using real player names":""}.</p><div className="actions"><button className="green" onClick={runScoutReport} disabled={scoutBusy}>{scoutBusy?"Analysing…":"Generate scout report"}</button>{scoutOut&&<button onClick={()=>copyText(scoutOut)}>Copy</button>}</div>{scoutInfo&&<p className="muted top-sm">{scoutInfo}</p>}<div className="note ai top-sm">{scoutOut||"Your opposition scout report and game plan will appear here."}</div></section>
            <section className="card"><h2>Pre-Match Preview</h2><p className="muted">A short player-facing team address.</p><div className="actions"><button className="blue" onClick={runPreview} disabled={previewBusy}>{previewBusy?"Writing…":"Generate player preview"}</button>{previewOut&&<button onClick={()=>copyText(previewOut)}>Copy</button>}{(scoutOut||previewOut)&&<button className="green" onClick={exportScoutWord}>Export Word</button>}</div><div className="note ai top-sm">{previewOut||"Your pre-match player preview will appear here."}</div></section>
            <section className="card"><h2>Scout snapshot</h2><div className="grid three"><div className="note"><span className="pill rose">Strengths</span><h2>{scoutIntel.strengths.length}</h2></div><div className="note"><span className="pill thorn">Weaknesses</span><h2>{scoutIntel.weaknesses.length}</h2></div><div className="note"><span className="pill bud">Clips</span><h2>{scoutIntel.clips.length}</h2></div></div><h2 className="top">Danger players</h2>{scoutIntel.dangerPlayers.length?scoutIntel.dangerPlayers.slice(0,6).map(([p,c])=>{const named=scoutRoster.find(r=>r.number===p);return <div className="row" key={p}><span>#{p}{named?` ${named.name}`:""}</span><b>{c}</b></div>;}):<p className="muted">Tag opposition players by number.</p>}</section>
          </aside>
        </main>
        )}

        {(tab==="replay"||tab==="matchday") && (
        <>
        <section className="card grid four top">
          <label className="wide"><span>Match title</span><input value={matchTitle} onChange={e=>setMatchTitle(e.target.value)} /></label>
          <label><span>Opponent</span><input value={opponent} onChange={e=>setOpponent(e.target.value)} placeholder="e.g. Kew" /></label>
          <label><span>Venue</span><input value={venue} onChange={e=>setVenue(e.target.value)} placeholder="e.g. Brighton Beach Oval" /></label>
        </section>
        <section className="card grid four">
          <label><span>Our score</span><input value={scoreUs} onChange={e=>setScoreUs(e.target.value)} placeholder="8.6-54" /></label>
          <label><span>Their score</span><input value={scoreThem} onChange={e=>setScoreThem(e.target.value)} placeholder="6.5-41" /></label>
          <label className="wide"><span>Quarter scores (feeds the AI)</span><input value={qScores} onChange={e=>setQScores(e.target.value)} placeholder="Q1 2.1-1.3, HT 4.3-3.4, 3QT 6.4-5.5, F 8.6-6.5" /></label>
        </section>
        <main className="grid two top">
          <section className="card no-print">
            {tab==="replay" ? (
              <><div className="actions"><label className="filebtn blue">Load video<input type="file" accept="video/*" onChange={handleVideo} /></label><button onClick={captureScreen}>Capture screen</button><button className="green" onClick={()=>videoRef.current?.play()}>Play</button><button className="orange" onClick={()=>videoRef.current?.pause()}>Pause</button><span className="pill push">{videoName}</span></div><div className="videowrap"><video ref={videoRef} src={videoUrl} controls /></div></>
            ) : (
              <div className="grid two"><div><div className="muted">Quarter clock</div><div className="clock">{timeLabel(clock)}</div><div className="actions"><button className={clockRunning?"red":"green"} onClick={()=>setClockRunning(v=>!v)}>{clockRunning?"Pause clock":"Start clock"}</button><button onClick={()=>setClock(0)}>Reset</button><button onClick={()=>setClock(c=>Math.max(0,c-10))}>-10s</button><button onClick={()=>setClock(c=>c+10)}>+10s</button></div></div><div className="sub"><h2>Live mic</h2><div className="actions">{!listening?<button className="orange" onClick={startSpeech}>Start transcription</button>:<button className="red" onClick={stopSpeech}>Stop</button>}{!recording?<button className="blue" onClick={startAudio}>Audio backup</button>:<button className="red" onClick={stopAudio}>Stop audio</button>}{audioUrl&&<button className="green" onClick={exportAudio}>Download audio</button>}</div></div></div>
            )}
            <div className="grid four top"><label><span>Quarter</span><select value={quarter} onChange={e=>startQuarter(e.target.value)}>{QUARTERS.map(q=><option key={q}>{q}</option>)}</select></label><label><span>Scope</span><select value={scope} onChange={e=>setScope(e.target.value)}><option>Auto</option><option>Us</option><option>Opposition</option><option>Both</option></select></label><label><span>Player</span><select value={player} onChange={e=>setPlayer(e.target.value)}><option>Auto</option><option value="">No player tag</option>{PLAYERS.map(p=><option key={p}>{p}</option>)}</select></label><label><span>Theme</span><select value={theme} onChange={e=>setTheme(e.target.value)}><option>Auto-detect</option>{THEMES.map(t=><option key={t}>{t}</option>)}</select></label></div>
            <div className="sub top"><h2>{tab==="replay"?"Commentary":"Live mic"}</h2><div className="actions">{!listening?<button className="orange" onClick={startSpeech}>{tab==="replay"?"Start commentary":"Start transcription"}</button>:<button className="red" onClick={stopSpeech}>Stop</button>}</div><div className="note live top-sm">{live||"Live transcript appears here."}</div></div>
            {tab==="replay" && (<div className="sub top stop5"><div className="actions space"><h2>Gemini STOP5 Review</h2><span className="pill">{replayNotes.length} replay verbatims</span></div><div className="actions"><button className="green" onClick={runStop5} disabled={stopBusy}>{stopBusy?"Interpreting…":"Generate STOP5 summary"}</button><label className="inline"><span>Analyse latest</span><select value={stopLimit} onChange={e=>setStopLimit(Number(e.target.value))}><option value={30}>30</option><option value={60}>60</option><option value={100}>100</option><option value={9999}>All</option></select></label>{stopOutput&&<button onClick={()=>copyText(stopOutput)}>Copy</button>}{stopOutput&&<button className="blue" onClick={exportStop5Word}>Export Word</button>}</div>{stopInfo&&<p className="muted top-sm">{stopInfo}</p>}<div className="note ai top-sm">{stopOutput||"Your STOP5 debrief will appear here."}</div></div>)}
            <div className="sub top"><h2>Quick tags</h2><div className="actions">{QUICK_TAGS.map(t=><button key={t} onClick={()=>addQuick(t)}>{t}</button>)}</div></div>
            <div className="sub top"><h2>Manual note</h2><textarea value={manual} onChange={e=>setManual(e.target.value)} placeholder="Type a note..." /><div className="actions top-sm"><button className="blue" onClick={()=>{addNote(manual,{tag:"Manual"});setManual("");}}>Add note</button></div></div>
          </section>
          <aside className="grid">
            <section className="card"><h2>Rose / Bud / Thorn</h2><div className="grid three"><div className="note"><span className="pill rose">Rose</span><h2>{intel.rose.length}</h2></div><div className="note"><span className="pill bud">Bud</span><h2>{intel.bud.length}</h2></div><div className="note"><span className="pill thorn">Thorn</span><h2>{intel.thorn.length}</h2></div></div>{intel.topThemes.slice(0,7).map(([t,c])=><div className="row" key={t}><span>{t}</span><b>{c}</b></div>)}</section>
            <section className="card"><h2>Top 5 coaching actions</h2>{intel.actions.map(a=><div className="note" key={a.title}><b>{a.title}</b><p className="muted">{a.detail}</p></div>)}</section>
            <section className="card no-print"><h2>Export / archive</h2><div className="actions"><button onClick={exportMarkdown}>Markdown</button><button onClick={exportCsv}>CSV</button><button onClick={exportJson}>JSON</button><button className="green" onClick={exportWord}>Word</button><button onClick={()=>window.print()}>PDF</button><button className="blue" onClick={saveSnapshot}>Save snapshot</button><label className="filebtn">Import JSON<input type="file" accept="application/json" onChange={importJson} /></label><button className="red" onClick={()=>setNotes([])}>Clear notes</button></div></section>
          </aside>
        </main>
        <section className="card top">
          <div className="actions space no-print"><h2>Timestamped calls</h2><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Replay</option><option>Match Day</option>{QUARTERS.map(q=><option key={q}>{q}</option>)}<option>Us</option><option>Opposition</option><option>Both</option><option>Rose</option><option>Bud</option><option>Thorn</option>{THEMES.map(t=><option key={t}>{t}</option>)}{PLAYERS.map(p=><option key={p}>{`#${p}`}</option>)}</select></div>
          <div className="list top-sm">{shown.length===0&&<div className="note muted">No notes yet.</div>}{shown.map(n=>(<article className="note" key={n.id}><div className="actions"><button className="pill jump" onClick={()=>jumpTo(n.seconds)}>{n.source} {n.clockLabel}</button><span className="pill">{n.quarter}</span><span className="pill">{n.scope}</span>{n.player&&<span className="pill">#{n.player}</span>}<span className="pill">{n.theme}</span><span className={`pill ${n.tone.toLowerCase()}`}>{n.tone}</span><span className="pill">{n.tag}</span><button className="red push no-print" onClick={()=>setNotes(prev=>prev.filter(x=>x.id!==n.id))}>Delete</button></div><p><b>Call:</b> {n.raw}</p><p className="muted"><b>Interpretation:</b> {n.interpretation}</p></article>))}</div>
        </section>
        </>
        )}

        {tab==="season" && (
        <main className="grid top">
          <section className="card"><div className="actions space"><h2>Season overview</h2><span className="pill">{seasonData.gameCount} saved games</span></div>{seasonData.gameCount===0?<p className="muted">No saved games yet. Capture notes then press Save snapshot.</p>:(<><div className="grid four top">{seasonData.games.slice(-4).map(g=>(<div className="note" key={g.id}><b>{g.label}</b><div className="muted">{new Date(g.date).toLocaleDateString()}</div><div className="row"><span>Rose</span><b>{g.rose}</b></div><div className="row"><span>Bud</span><b>{g.bud}</b></div><div className="row"><span>Thorn</span><b>{g.thorn}</b></div></div>))}</div><h2 className="top">Theme trend across games (oldest → newest)</h2><div className="trend">{Object.entries(seasonData.themeTrend).sort((a,b)=>{const sa=a[1].reduce((x,y)=>x+y,0),sb=b[1].reduce((x,y)=>x+y,0);return sb-sa;}).slice(0,8).map(([t,arr])=>(<div className="trendrow" key={t}><div className="trendlabel">{t}</div><div className="bars">{arr.map((v,i)=>(<div className="barcol" key={i} title={`${v}`}><div className="bar" style={{height:`${(v/maxTrend)*100}%`}}></div></div>))}</div><div className="trendtotal">{arr.reduce((x,y)=>x+y,0)}</div></div>))}</div><h2 className="top">Recurring improvement themes</h2>{seasonData.recurringThorns.length?seasonData.recurringThorns.map(([t,c])=><div className="row" key={t}><span>{t}</span><b>{c}</b></div>):<p className="muted">No recurring themes yet.</p>}</>)}</section>
          <section className="card top"><h2>AI Coach (secure)</h2><div className="grid four top"><label><span>Analyse</span><select value={aiScope} onChange={e=>setAiScope(e.target.value)}><option value="thisMatch">This match's notes</option><option value="season">Whole season</option></select></label><label><span>Endpoint</span><input value={aiEndpoint} onChange={e=>setAiEndpoint(e.target.value)} placeholder="/api/coach" /></label><label className="wide"><span>Team secret (optional)</span><input type="password" value={teamSecret} onChange={e=>setTeamSecret(e.target.value)} /></label></div><div className="actions top-sm"><button className="green" onClick={runAi} disabled={aiBusy}>{aiBusy?"Thinking…":"Generate AI coaching summary"}</button>{aiOutput&&<button onClick={()=>copyText(aiOutput)}>Copy</button>}{aiOutput&&<button className="blue" onClick={exportAiWord}>Export Word</button>}</div>{aiInfo&&<p className="muted top-sm">{aiInfo}</p>}<div className="note ai top-sm">{aiOutput||"AI coaching summary will appear here."}</div></section>
        </main>
        )}

      </div>
    </div>
  );
}
