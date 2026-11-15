"use strict";
const $ = id => document.getElementById(id);
const STORE_KEY = "gullyCricketMatchesV2";
let match = null, tossCall = "Heads", tossWinner = null, tossResolved = false, undoStack = [];

function show(id){["homePanel","setupPanel","tossPanel","matchPanel"].forEach(x=>$(x).classList.add("hidden"));$(id).classList.remove("hidden");}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400);}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function loadSaved(){try{const x=JSON.parse(localStorage.getItem(STORE_KEY)||"[]");return Array.isArray(x)?x:[];}catch{return [];}}
function saveAll(){if(!match)return;const list=loadSaved().filter(x=>x.id!==match.id);list.push(match);localStorage.setItem(STORE_KEY,JSON.stringify(list));renderSaved();}
function snapshot(){undoStack.push(JSON.stringify(match));if(undoStack.length>100)undoStack.shift();}
function legalBalls(inn){return inn.deliveries.filter(d=>d.legal).length;}
function currentInnings(){return match.innings[match.currentInnings];}
function nextOverNumber(inn){return Math.floor(legalBalls(inn)/6)+1;}
function initInnings(batting,bowling){return {batting,bowling,runs:0,wickets:0,wideCount:0,wideBonus:0,deliveries:[]};}
function startSetup(){show("setupPanel");}
$("newMatchBtn").onclick=startSetup;$("headerStart").onclick=startSetup;$("cancelSetup").onclick=()=>show("homePanel");

$("createMatchBtn").onclick=()=>{
 const a=$("teamAInput").value.trim()||"Team A",b=$("teamBInput").value.trim()||"Team B",overs=Number($("oversInput").value);
 if(a.toLowerCase()===b.toLowerCase()){toast("Please enter two different teams.");return;}
 if(!Number.isInteger(overs)||overs<1||overs>50){toast("Overs must be between 1 and 50.");return;}
 match={id:Date.now().toString(),date:new Date().toLocaleString(),teams:[a,b],maxOvers:overs,currentInnings:0,innings:[],status:"LIVE",result:"",toss:null};
 tossResolved=false;tossWinner=null;undoStack=[];
 $("tossTeam").innerHTML=`<option value="0">${escapeHTML(a)}</option><option value="1">${escapeHTML(b)}</option>`;
 $("coinResult").textContent="🪙";$("tossDecision").classList.add("hidden");$("flipCoinBtn").disabled=false;
 document.querySelectorAll(".coin-button").forEach(x=>{x.disabled=false;x.classList.toggle("selected",x.dataset.call==="Heads");});tossCall="Heads";show("tossPanel");
};

document.querySelectorAll(".coin-button").forEach(btn=>btn.onclick=()=>{
 if(tossResolved)return;document.querySelectorAll(".coin-button").forEach(x=>x.classList.remove("selected"));btn.classList.add("selected");tossCall=btn.dataset.call;
});
function secureCoinToss(){if(!window.crypto?.getRandomValues)throw new Error("Secure random generator is not available. Use HTTPS or localhost.");const r=new Uint32Array(1);window.crypto.getRandomValues(r);return (r[0]&1)===0?"Heads":"Tails";}
$("flipCoinBtn").onclick=()=>{
 if(tossResolved)return;let result;try{result=secureCoinToss();}catch(e){toast(e.message);return;}
 tossResolved=true;$("flipCoinBtn").disabled=true;document.querySelectorAll(".coin-button").forEach(x=>x.disabled=true);
 const coin=$("coinResult");coin.classList.remove("flipping");void coin.offsetWidth;coin.classList.add("flipping");
 setTimeout(()=>{const caller=Number($("tossTeam").value);coin.textContent=result==="Heads"?"🪙 HEADS":"🪙 TAILS";tossWinner=result===tossCall?caller:1-caller;match.toss={caller,call:tossCall,result,winner:tossWinner};$("tossWinnerText").textContent=`${match.teams[tossWinner]} won the toss!`;$("tossDecision").classList.remove("hidden");},650);
};
$("chooseBat").onclick=()=>beginMatch(tossWinner,1-tossWinner);$("chooseBowl").onclick=()=>beginMatch(1-tossWinner,tossWinner);
function beginMatch(bat,bowl){if(bat===null||bowl===null){toast("Complete the toss first.");return;}match.innings=[initInnings(bat,bowl)];match.currentInnings=0;match.status="LIVE";undoStack=[];saveAll();show("matchPanel");render();toast("Match started. Good luck!");}
function inningsComplete(inn){return inn.wickets>=10||legalBalls(inn)>=match.maxOvers*6||(match.currentInnings===1&&inn.runs>=match.innings[0].runs+1);}

function addDelivery(type,value=0){
 if(!match||match.status!=="LIVE")return;const inn=currentInnings();if(inningsComplete(inn)){toast("This innings is complete.");return;}snapshot();
 let runs=0,legal=true,label="",isWide=false,extraType=null;
 if(type==="run"){runs=value;label=String(value);}
 else if(type==="wicket"){inn.wickets++;label="W";}
 else if(type==="wide"){
  legal=false;isWide=true;extraType="wide";inn.wideCount++;
  if(inn.wideCount===3){runs=2;inn.wideBonus+=2;inn.wideCount=0;label="WD +2";toast("3 wides in this over – 2 bonus runs added!");}
  else{label="WD";toast(`Wide ${inn.wideCount}/3 – no run added.`);}
 }else if(type==="noball"){legal=false;extraType="no-ball";runs=1;label="NB";}
 else if(type==="bye"||type==="legbye"){runs=1;extraType=type;label=type==="bye"?"B1":"LB1";}
 const over=nextOverNumber(inn),legalBall=legal?(legalBalls(inn)%6)+1:null;
 inn.runs+=runs;inn.deliveries.push({sequence:inn.deliveries.length+1,type,label,runs,legal,extraType,over,legalBall,isWide,timestamp:Date.now()});
 // The special counter resets after each completed over (six legal balls).
 if(legal&&legalBalls(inn)%6===0)inn.wideCount=0;
 saveAll();render();if(inningsComplete(inn))toast("Innings completed.");
}
document.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>addDelivery(btn.dataset.action,Number(btn.dataset.value||0)));
$("undoBtn").onclick=()=>{if(!undoStack.length){toast("Nothing to undo.");return;}match=JSON.parse(undoStack.pop());saveAll();render();toast("Last delivery undone.");};
$("endInningsBtn").onclick=()=>{
 if(!match||match.status!=="LIVE")return;
 if(match.currentInnings===0){snapshot();const first=match.innings[0];match.innings.push(initInnings(first.bowling,first.batting));match.currentInnings=1;saveAll();render();toast("Second innings started.");}
 else finishMatch();
};
$("finishMatchBtn").onclick=finishMatch;$("backHomeBtn").onclick=()=>{renderSaved();show("homePanel");};
function finishMatch(){
 if(!match||match.status!=="LIVE")return;if(match.innings.length<2){toast("Start the second innings before finishing.");return;}
 const first=match.innings[0],second=match.innings[1],target=first.runs+1;
 if(second.runs<target&&!inningsComplete(second)&&!confirm("The second innings is not complete. Finish the match now?"))return;
 match.status="COMPLETED";
 if(second.runs===first.runs)match.result="Match tied";
 else if(second.runs>first.runs)match.result=`${match.teams[second.batting]} won by ${Math.max(0,10-second.wickets)} wickets`;
 else match.result=`${match.teams[first.batting]} won by ${first.runs-second.runs} runs`;
 saveAll();render();toast(match.result);show("homePanel");
}
function ballClass(d){if(d.type==="wicket")return"wicket";if(d.isWide)return"wide";if(d.runs===4||d.runs===6)return"boundary";return"";}
function render(){
 if(!match)return;const inn=currentInnings(),legal=legalBalls(inn),overs=Math.floor(legal/6),balls=legal%6;
 $("teamAName").textContent=match.teams[0].toUpperCase();$("teamBName").textContent=match.teams[1].toUpperCase();$("inningsLabel").textContent=`${match.teams[inn.batting].toUpperCase()} BATTING · INNINGS ${match.currentInnings+1}`;
 $("runs").textContent=inn.runs;$("wickets").textContent=inn.wickets;$("overs").textContent=`${overs}.${balls}`;$("oversLimit").textContent=`/ ${match.maxOvers}`;$("runRate").textContent=legal?(inn.runs/(legal/6)).toFixed(1):"0.0";
 if(match.currentInnings===1){$("targetBox").classList.remove("hidden");$("target").textContent=match.innings[0].runs+1;const need=Math.max(0,match.innings[0].runs+1-inn.runs);$("matchStatus").textContent=need===0?"TARGET ACHIEVED":`${need} runs needed`;}else{$("targetBox").classList.add("hidden");$("matchStatus").textContent="";}
 const displayOver=inn.deliveries.length?inn.deliveries[inn.deliveries.length-1].over:1;const thisOver=inn.deliveries.filter(d=>d.over===displayOver);
 $("thisOverRuns").textContent=thisOver.reduce((s,d)=>s+d.runs,0);$("currentBalls").innerHTML=thisOver.length?thisOver.map(d=>`<span class="ball-chip ${ballClass(d)}">${escapeHTML(d.label)}</span>`).join(""):'<span class="ball-chip">—</span>';
 $("wideCounter").textContent=`WIDES ${inn.wideCount}/3`;$("deliveryCount").textContent=`${inn.deliveries.length} deliveries`;$("undoBtn").disabled=!undoStack.length;
 const done=inningsComplete(inn);document.querySelectorAll("[data-action]").forEach(b=>b.disabled=done);$("endInningsBtn").disabled=match.currentInnings===1&&done;renderOvers(inn);renderSaved();
}
function renderOvers(inn){
 const groups={};inn.deliveries.forEach(d=>(groups[d.over]??=[]).push(d));const keys=Object.keys(groups).map(Number).sort((a,b)=>b-a);
 $("oversHistory").innerHTML=keys.length?keys.map(n=>{const ds=groups[n],runs=ds.reduce((s,d)=>s+d.runs,0),wk=ds.filter(d=>d.type==="wicket").length;return `<div class="over-row"><div class="over-label"><small>OVER ${n}</small><b>${runs}</b><small>RUNS</small></div><div class="over-balls">${ds.map(d=>`<span class="ball-text ${ballClass(d)}">${escapeHTML(d.label)}</span>`).join("")}</div><div class="over-meta">${wk?wk+" WICKET"+(wk>1?"S":""):""}</div></div>`;}).join(""):'<p class="empty">Ball-by-ball history will appear here.</p>';
}
function renderSaved(){
 const items=loadSaved().sort((a,b)=>Number(b.id)-Number(a.id));$("savedMatches").innerHTML=items.length?items.map(m=>{const score=(m.innings||[]).map(i=>`${escapeHTML(m.teams[i.batting])} ${i.runs}/${i.wickets}`).join(" · ");return `<article class="saved-card"><b>${escapeHTML(m.teams[0])} vs ${escapeHTML(m.teams[1])}</b><small>${escapeHTML(m.date)} · ${escapeHTML(m.status)}</small><p>${score||"No score yet"}</p><small>${escapeHTML(m.result||"Match in progress")}</small><div class="saved-card-actions">${m.status==="LIVE"?`<button data-resume="${escapeHTML(m.id)}">RESUME</button>`:""}<button class="delete" data-delete="${escapeHTML(m.id)}">DELETE</button></div></article>`;}).join(""):'<p class="empty">Your saved matches will appear here.</p>';
 document.querySelectorAll("[data-resume]").forEach(b=>b.onclick=()=>resumeMatch(b.dataset.resume));document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteMatch(b.dataset.delete));
}
function resumeMatch(id){const saved=loadSaved().find(m=>m.id===id);if(!saved||saved.status!=="LIVE"){toast("Live match not found.");return;}match=saved;undoStack=[];show("matchPanel");render();toast("Match resumed.");}
function deleteMatch(id){if(!confirm("Delete this saved match?"))return;localStorage.setItem(STORE_KEY,JSON.stringify(loadSaved().filter(m=>m.id!==id)));renderSaved();toast("Match deleted.");}
renderSaved();
