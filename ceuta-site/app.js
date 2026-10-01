(() => {
  "use strict";

  const CONFIG = window.CEUTA_CONFIG || {};
  const SECTIONS = (window.CEUTA_QUESTIONS || {}).sections || [];
  const DEMO = new URLSearchParams(location.search).get("demo") === "1";
  const state = {
    startedAt: null,
    sectionIndex: 0,
    responses: {},
    trials: [],
    cognitive: {},
    visibilityLosses: 0,
    participantCode: null,
    savedPayload: null,
    taskStartedAt: null
  };

  const $ = id => document.getElementById(id);
  const welcome = $("welcome"), survey = $("survey"), cogIntro = $("cogIntro"), taskScreen = $("taskScreen"), finish = $("finish");
  const form = $("questionForm"), errorBox = $("formError");

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.startedAt) state.visibilityLosses++;
  });

  $("consentCheck").addEventListener("change", e => $("startBtn").disabled = !e.target.checked);
  $("startBtn").addEventListener("click", () => {
    state.startedAt = Date.now();
    state.participantCode = makeCode();
    welcome.classList.add("hidden");
    survey.classList.remove("hidden");
    renderSection();
  });
  $("backBtn").addEventListener("click", () => {
    saveCurrentSection(false);
    if (state.sectionIndex > 0) state.sectionIndex--;
    renderSection();
  });
  $("nextBtn").addEventListener("click", () => {
    if (!saveCurrentSection(true)) return;
    if (state.sectionIndex < SECTIONS.length - 1) {
      state.sectionIndex++;
      renderSection();
    } else {
      survey.classList.add("hidden");
      cogIntro.classList.remove("hidden");
      setProgress(82, "Pruebas cognitivas");
      window.scrollTo({top:0,behavior:"smooth"});
    }
  });
  $("beginCogBtn").addEventListener("click", async () => {
    cogIntro.classList.add("hidden");
    taskScreen.classList.remove("hidden");
    document.documentElement.requestFullscreen?.().catch(()=>{});
    await runCognitiveBattery();
    document.exitFullscreen?.().catch(()=>{});
    taskScreen.classList.add("hidden");
    finish.classList.remove("hidden");
    setProgress(100, "Completado");
    await finalize();
  });
  $("backupBtn").addEventListener("click", downloadBackup);

  function makeCode(){
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s="CEU-";
    for(let i=0;i<8;i++) s+=chars[Math.floor(Math.random()*chars.length)];
    return s;
  }

  function setProgress(pct, text){
    $("progressFill").style.width = Math.max(0,Math.min(100,pct))+"%";
    $("progressText").textContent = text;
  }

  function renderSection(){
    const sec=SECTIONS[state.sectionIndex];
    $("sectionKicker").textContent=sec.kicker;
    $("sectionTitle").textContent=sec.title;
    $("sectionIntro").textContent=sec.intro || "";
    $("stepPill").textContent=`${state.sectionIndex+1} / ${SECTIONS.length}`;
    form.innerHTML="";
    errorBox.classList.add("hidden");
    sec.questions.forEach(q => form.appendChild(renderQuestion(q)));
    $("backBtn").style.visibility = state.sectionIndex===0 ? "hidden":"visible";
    $("nextBtn").textContent = state.sectionIndex===SECTIONS.length-1 ? "Ir a pruebas cognitivas":"Continuar";
    setProgress(5 + Math.round((state.sectionIndex/SECTIONS.length)*72), sec.title);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function renderQuestion(q){
    const wrap=document.createElement("div");
    wrap.className="q";
    if(q.type==="matrix" || q.type==="tlx"){
      const title=document.createElement("div");
      title.className="q-title";
      title.innerHTML=(q.label||"")+" "+(q.required?'<span class="req">*</span>':"");
      if(q.label) wrap.appendChild(title);
    } else {
      const label=document.createElement("label");
      label.htmlFor=q.id;
      label.innerHTML=`${q.label}${q.required?'<span class="req"> *</span>':''}`;
      wrap.appendChild(label);
    }

    if(q.type==="select"){
      const el=document.createElement("select"); el.id=q.id; el.dataset.qid=q.id;
      el.innerHTML='<option value="">Seleccione…</option>'+q.options.map(o=>`<option value="${escAttr(o)}">${esc(o)}</option>`).join("");
      if(state.responses[q.id]!=null) el.value=state.responses[q.id];
      wrap.appendChild(el);
    } else if(q.type==="text" || q.type==="number"){
      const el=document.createElement("input"); el.id=q.id; el.dataset.qid=q.id; el.type=q.type;
      if(q.min!=null) el.min=q.min;if(q.max!=null)el.max=q.max;if(q.step!=null)el.step=q.step;
      if(state.responses[q.id]!=null) el.value=state.responses[q.id];
      wrap.appendChild(el);
    } else if(q.type==="radio"){
      const row=document.createElement("div"); row.className="radio-row";
      q.options.forEach(o=>{
        const l=document.createElement("label"); l.className="radio-chip";
        const inp=document.createElement("input"); inp.type="radio"; inp.name=q.id; inp.value=o; inp.dataset.qid=q.id;
        if(state.responses[q.id]===o) inp.checked=true;
        const sp=document.createElement("span"); sp.textContent=o;
        l.append(inp,sp);row.appendChild(l);
      });wrap.appendChild(row);
    } else if(q.type==="slider"){
      const row=document.createElement("div"); row.className="slider-wrap";
      const inp=document.createElement("input"); inp.type="range"; inp.id=q.id; inp.dataset.qid=q.id;
      inp.min=q.min;inp.max=q.max;inp.step=q.step||1;
      const has=state.responses[q.id]!=null && state.responses[q.id]!=="";
      inp.value=has?state.responses[q.id]:Math.round((Number(q.min)+Number(q.max))/2);
      inp.dataset.touched=has?"1":"0";
      const val=document.createElement("div");val.className="slider-value";val.textContent=has?inp.value:"—";
      inp.addEventListener("input",()=>{inp.dataset.touched="1";val.textContent=inp.value;});
      row.append(inp,val);wrap.appendChild(row);
    } else if(q.type==="matrix"){
      wrap.appendChild(renderMatrix(q));
    } else if(q.type==="tlx"){
      q.items.forEach(([id,label])=>{
        const r=document.createElement("div");r.className="q";
        const lab=document.createElement("label");lab.textContent=label+" *";
        const row=document.createElement("div");row.className="slider-wrap";
        const inp=document.createElement("input");inp.type="range";inp.min=0;inp.max=100;inp.step=5;inp.dataset.qid=id;
        const has=state.responses[id]!=null;inp.value=has?state.responses[id]:50;inp.dataset.touched=has?"1":"0";
        const val=document.createElement("div");val.className="slider-value";val.textContent=has?inp.value:"—";
        inp.addEventListener("input",()=>{inp.dataset.touched="1";val.textContent=inp.value;});
        row.append(inp,val);r.append(lab,row);wrap.appendChild(r);
      });
    }
    if(q.hint){const h=document.createElement("span");h.className="hint";h.textContent=q.hint;wrap.appendChild(h);}
    return wrap;
  }

  function renderMatrix(q){
    const matrix=document.createElement("div");matrix.className="matrix";
    q.items.forEach(([id,label],idx)=>{
      const row=document.createElement("div");row.className="matrix-row";
      const stem=document.createElement("div");stem.className="stem";stem.textContent=label;row.appendChild(stem);
      q.scale.forEach((s,i)=>{
        const l=document.createElement("label");l.className="scale-chip";l.title=s;
        const inp=document.createElement("input");inp.type="radio";inp.name=id;inp.dataset.qid=id;
        const numeric=Number((s.match(/^-?\d+/)||[i])[0]);inp.value=String(numeric);
        if(String(state.responses[id])===String(numeric)) inp.checked=true;
        const sp=document.createElement("span");sp.textContent=String(numeric);
        l.append(inp,sp);row.appendChild(l);
      });
      matrix.appendChild(row);
    });
    const legend=document.createElement("div");legend.className="hint";legend.textContent=q.scale.join("  ·  ");matrix.prepend(legend);
    return matrix;
  }

  function saveCurrentSection(validate){
    const sec=SECTIONS[state.sectionIndex];
    const missing=[];
    sec.questions.forEach(q=>{
      if(q.type==="matrix"){
        q.items.forEach(([id])=>{
          const checked=form.querySelector(`input[name="${cssEsc(id)}"]:checked`);
          if(checked) state.responses[id]=Number(checked.value); else if(validate && q.required) missing.push(id);
        });
      } else if(q.type==="tlx"){
        q.items.forEach(([id])=>{
          const inp=form.querySelector(`[data-qid="${cssEsc(id)}"]`);
          if(inp?.dataset.touched==="1") state.responses[id]=Number(inp.value); else if(validate && q.required) missing.push(id);
        });
      } else if(q.type==="radio"){
        const checked=form.querySelector(`input[name="${cssEsc(q.id)}"]:checked`);
        if(checked) state.responses[q.id]=checked.value; else if(validate && q.required) missing.push(q.id);
      } else if(q.type==="slider"){
        const inp=form.querySelector(`[data-qid="${cssEsc(q.id)}"]`);
        if(inp?.dataset.touched==="1") state.responses[q.id]=Number(inp.value);
        else if(validate && q.required) missing.push(q.id);
      } else {
        const inp=form.querySelector(`[data-qid="${cssEsc(q.id)}"]`);
        const v=inp?.value?.trim?.() ?? inp?.value;
        if(v!=="" && v!=null) state.responses[q.id]=q.type==="number"?Number(v):v;
        else if(validate && q.required) missing.push(q.id);
      }
    });
    if(validate && missing.length){
      errorBox.textContent="Complete las preguntas obligatorias antes de continuar.";
      errorBox.classList.remove("hidden");
      const first=form.querySelector(`[data-qid="${cssEsc(missing[0])}"],input[name="${cssEsc(missing[0])}"]`);
      first?.scrollIntoView({behavior:"smooth",block:"center"});
      return false;
    }
    errorBox.classList.add("hidden");return true;
  }

  async function runCognitiveBattery(){
    state.taskStartedAt=Date.now();
    await countdown("Las pruebas comienzan en");
    setProgress(84,"Vigilancia psicomotora");
    await runPVT();
    setProgress(89,"Control inhibitorio");
    await taskBreak("Control inhibitorio","Pulse RESPONDER cuando aparezca X. No responda cuando aparezca O.");
    await runGoNoGo();
    setProgress(93,"Discriminación");
    await taskBreak("Discriminación y elección","Indique lo antes posible si la flecha apunta a la izquierda o a la derecha.");
    await runChoice();
    setProgress(97,"Memoria de trabajo");
    await taskBreak("Memoria de trabajo 2-back","Pulse COINCIDE cuando la letra actual sea igual a la presentada dos posiciones antes. Si no coincide, no responda.");
    await runNBack();
  }

  async function countdown(title){
    $("taskName").textContent=title;$("taskCounter").textContent="";
    $("taskInstruction").textContent="Mantenga la atención en el centro de la pantalla.";
    for(const n of [3,2,1]){ $("stimulusArea").innerHTML=`<div class="countdown">${n}</div>`; await sleep(700); }
    $("stimulusArea").innerHTML="";
  }

  async function taskBreak(name,instruction){
    $("taskName").textContent=name;$("taskCounter").textContent="";
    $("taskInstruction").textContent=instruction;
    $("stimulusArea").innerHTML='<div class="feedback">Pulse para comenzar</div>';
    $("taskControls").innerHTML='<button class="task-key" id="continueTask">COMENZAR</button>';
    await new Promise(res=>$("continueTask").addEventListener("click",res,{once:true}));
    $("taskControls").innerHTML="";$("stimulusArea").innerHTML="";
    await countdown(name);
  }

  function waitResponse(timeoutMs, keys=[" ","Enter"], touchTarget=true){
    return new Promise(resolve=>{
      const start=performance.now();let done=false;
      const finish=(response)=>{
        if(done)return;done=true;cleanup();resolve({response,rt:response==null?null:performance.now()-start});
      };
      const key=e=>{ if(keys.includes(e.key)){e.preventDefault();finish(e.key);} };
      const pointer=()=>touchTarget&&finish("tap");
      const timer=setTimeout(()=>finish(null),timeoutMs);
      const cleanup=()=>{clearTimeout(timer);document.removeEventListener("keydown",key);$("stimulusArea").removeEventListener("pointerdown",pointer);};
      document.addEventListener("keydown",key);
      $("stimulusArea").addEventListener("pointerdown",pointer);
    });
  }

  async function runPVT(){
    $("taskName").textContent="Vigilancia psicomotora";
    $("taskInstruction").textContent="Cuando aparezca el círculo, toque la pantalla o pulse la barra espaciadora lo más rápido posible.";
    const duration=DEMO?20000:180000; const startAll=performance.now(); let i=0; const rts=[];
    while(performance.now()-startAll<duration){
      i++; $("taskCounter").textContent=`${Math.ceil((duration-(performance.now()-startAll))/1000)} s`;
      $("stimulusArea").innerHTML='<div style="color:#7c8894">+</div>';
      const isi=(DEMO?500:2000)+Math.random()*(DEMO?1200:4000);
      const premature=await waitForPrematureOrTime(isi);
      if(premature){
        state.trials.push({task:"pvt",trial:i,rt_ms:premature.rt,false_start:true,valid:false,timestamp:new Date().toISOString()});
        $("stimulusArea").innerHTML='<div class="feedback bad">Demasiado pronto</div>';await sleep(450);continue;
      }
      const onset=performance.now(); $("stimulusArea").innerHTML='<div class="pvt-dot"></div>';
      const resp=await waitResponse(1500,[" ","Enter"],true);
      const rt=resp.response?performance.now()-onset:null;
      const valid=rt!=null && rt>=100;
      if(rt!=null)rts.push(rt);
      state.trials.push({task:"pvt",trial:i,rt_ms:rt,false_start:rt!=null&&rt<100,lapse:rt==null||rt>=500,valid,timestamp:new Date().toISOString()});
      $("stimulusArea").innerHTML=rt==null?'<div class="feedback bad">Sin respuesta</div>':`<div class="feedback ok">${Math.round(rt)} ms</div>`;
      await sleep(250);
    }
    state.cognitive.pvt=summarizePVT(state.trials.filter(x=>x.task==="pvt"));
    $("stimulusArea").innerHTML='<div class="feedback ok">Prueba completada</div>';await sleep(650);
  }

  function waitForPrematureOrTime(ms){
    return new Promise(resolve=>{
      const start=performance.now();let done=false;
      const finish=v=>{if(done)return;done=true;clearTimeout(timer);document.removeEventListener("keydown",key);$("stimulusArea").removeEventListener("pointerdown",pointer);resolve(v);};
      const key=e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();finish({rt:performance.now()-start});}};
      const pointer=()=>finish({rt:performance.now()-start});
      const timer=setTimeout(()=>finish(null),ms);
      document.addEventListener("keydown",key);$("stimulusArea").addEventListener("pointerdown",pointer);
    });
  }

  async function runGoNoGo(){
    const n=DEMO?20:80; const trials=[];
    $("taskInstruction").textContent="X = responder · O = no responder";
    $("taskControls").innerHTML='<button class="task-key" id="goBtn">RESPONDER</button>';
    for(let i=0;i<n;i++){
      const isNo=Math.random()<0.25; const stim=isNo?"O":"X";
      $("taskCounter").textContent=`${i+1} / ${n}`;
      $("stimulusArea").innerHTML=`<div class="stim">${stim}</div>`;
      const onset=performance.now();
      const resp=await responseButtonOrKey("goBtn",650,[" ","Enter"]);
      const rt=resp?performance.now()-onset:null;
      const correct=isNo ? rt==null : rt!=null;
      const rec={task:"gonogo",trial:i+1,stimulus:stim,is_nogo:isNo,response:rt!=null,rt_ms:rt,correct,timestamp:new Date().toISOString()};
      trials.push(rec);state.trials.push(rec);
      $("stimulusArea").innerHTML="";await sleep(350);
    }
    $("taskControls").innerHTML="";
    state.cognitive.gonogo=summarizeGoNoGo(trials);
    $("stimulusArea").innerHTML='<div class="feedback ok">Prueba completada</div>';await sleep(650);
  }

  async function runChoice(){
    const n=DEMO?18:60; const trials=[];
    $("taskControls").innerHTML='<button class="task-key" id="leftBtn">← IZQUIERDA</button><button class="task-key" id="rightBtn">DERECHA →</button>';
    for(let i=0;i<n;i++){
      const dir=Math.random()<.5?"left":"right"; const arrow=dir==="left"?"←":"→";
      $("taskCounter").textContent=`${i+1} / ${n}`;$("stimulusArea").innerHTML=`<div class="stim">${arrow}</div>`;
      const onset=performance.now(); const resp=await choiceResponse(1200);
      const rt=resp?performance.now()-onset:null; const correct=resp?.choice===dir;
      const rec={task:"choice",trial:i+1,stimulus:dir,response:resp?.choice||null,rt_ms:rt,correct,timestamp:new Date().toISOString()};
      trials.push(rec);state.trials.push(rec);$("stimulusArea").innerHTML="";await sleep(250);
    }
    $("taskControls").innerHTML="";state.cognitive.choice=summarizeChoice(trials);
    $("stimulusArea").innerHTML='<div class="feedback ok">Prueba completada</div>';await sleep(650);
  }

  async function runNBack(){
    const n=DEMO?18:50, letters=["A","B","C","D","E","F"], seq=[], trials=[];
    for(let i=0;i<n;i++){
      let target=i>=2 && Math.random()<.28;
      let letter=target?seq[i-2]:letters[Math.floor(Math.random()*letters.length)];
      if(!target && i>=2 && letter===seq[i-2]) letter=letters[(letters.indexOf(letter)+1)%letters.length];
      seq.push(letter);
    }
    $("taskControls").innerHTML='<button class="task-key" id="matchBtn">COINCIDE</button>';
    for(let i=0;i<n;i++){
      const target=i>=2 && seq[i]===seq[i-2];
      $("taskCounter").textContent=`${i+1} / ${n}`;$("stimulusArea").innerHTML=`<div class="stim">${seq[i]}</div>`;
      const onset=performance.now(); const resp=await responseButtonOrKey("matchBtn",900,[" ","Enter"]);
      const rt=resp?performance.now()-onset:null; const correct=target ? rt!=null : rt==null;
      const rec={task:"nback2",trial:i+1,stimulus:seq[i],target,response:rt!=null,rt_ms:rt,correct,timestamp:new Date().toISOString()};
      trials.push(rec);state.trials.push(rec);$("stimulusArea").innerHTML="";await sleep(350);
    }
    $("taskControls").innerHTML="";state.cognitive.nback2=summarizeNBack(trials);
    $("stimulusArea").innerHTML='<div class="feedback ok">Batería completada</div>';await sleep(800);
  }

  function responseButtonOrKey(btnId,timeout,keys){
    return new Promise(resolve=>{
      let done=false; const btn=$(btnId);
      const finish=v=>{if(done)return;done=true;clearTimeout(timer);btn?.removeEventListener("click",click);document.removeEventListener("keydown",key);resolve(v);};
      const click=()=>finish({type:"button"}); const key=e=>{if(keys.includes(e.key)){e.preventDefault();finish({type:"key",key:e.key});}};
      const timer=setTimeout(()=>finish(null),timeout);btn?.addEventListener("click",click);document.addEventListener("keydown",key);
    });
  }

  function choiceResponse(timeout){
    return new Promise(resolve=>{
      let done=false;const l=$("leftBtn"),r=$("rightBtn");
      const finish=choice=>{if(done)return;done=true;clearTimeout(timer);cleanup();resolve(choice?{choice}:null);};
      const lk=()=>finish("left"),rk=()=>finish("right");
      const key=e=>{if(["ArrowLeft","a","A"].includes(e.key)){e.preventDefault();finish("left");}else if(["ArrowRight","l","L"].includes(e.key)){e.preventDefault();finish("right");}};
      const cleanup=()=>{l?.removeEventListener("click",lk);r?.removeEventListener("click",rk);document.removeEventListener("keydown",key);};
      const timer=setTimeout(()=>finish(null),timeout);l?.addEventListener("click",lk);r?.addEventListener("click",rk);document.addEventListener("keydown",key);
    });
  }

  function summarizePVT(t){
    const valid=t.filter(x=>x.valid&&x.rt_ms!=null).map(x=>x.rt_ms);
    return {n:t.length,n_valid:valid.length,median_rt_ms:median(valid),mean_rt_ms:mean(valid),sd_rt_ms:sd(valid),lapses:t.filter(x=>x.lapse).length,false_starts:t.filter(x=>x.false_start).length};
  }
  function summarizeGoNoGo(t){
    const go=t.filter(x=>!x.is_nogo),nogo=t.filter(x=>x.is_nogo),rts=go.filter(x=>x.response).map(x=>x.rt_ms);
    return {n:t.length,go_n:go.length,nogo_n:nogo.length,commission_errors:nogo.filter(x=>x.response).length,omission_errors:go.filter(x=>!x.response).length,accuracy:rate(t.filter(x=>x.correct).length,t.length),median_go_rt_ms:median(rts),sd_go_rt_ms:sd(rts)};
  }
  function summarizeChoice(t){
    const correct=t.filter(x=>x.correct),rts=correct.map(x=>x.rt_ms).filter(x=>x!=null);
    return {n:t.length,accuracy:rate(correct.length,t.length),median_correct_rt_ms:median(rts),mean_correct_rt_ms:mean(rts),sd_correct_rt_ms:sd(rts),omissions:t.filter(x=>!x.response).length};
  }
  function summarizeNBack(t){
    const targets=t.filter(x=>x.target),non=t.filter(x=>!x.target);
    const hits=targets.filter(x=>x.response).length,falseAlarms=non.filter(x=>x.response).length;
    const rts=targets.filter(x=>x.response).map(x=>x.rt_ms);
    return {n:t.length,targets:targets.length,hits,false_alarms:falseAlarms,hit_rate:rate(hits,targets.length),false_alarm_rate:rate(falseAlarms,non.length),d_prime:dprime(hits,targets.length,falseAlarms,non.length),median_hit_rt_ms:median(rts)};
  }

  function calculateScores(){
    const r=state.responses;
    const sum=ids=>ids.reduce((a,id)=>a+(Number(r[id])||0),0);
    const dassDep=["dass3","dass5","dass10","dass13","dass16","dass17","dass21"];
    const dassAnx=["dass2","dass4","dass7","dass9","dass15","dass19","dass20"];
    const dassStress=["dass1","dass6","dass8","dass11","dass12","dass14","dass18"];
    const cbiP=["cbi_p1","cbi_p2","cbi_p3","cbi_p4","cbi_p5","cbi_p6"];
    const cbiW=["cbi_w1","cbi_w2","cbi_w3","cbi_w4","cbi_w5","cbi_w6","cbi_w7"];
    const p=cbiP.map(id=>Number(r[id])).filter(Number.isFinite);
    const w=cbiW.map(id=>id==="cbi_w4" ? 100-Number(r[id]) : Number(r[id])).filter(Number.isFinite);
    const tlx=["tlx_mental","tlx_physical","tlx_temporal","tlx_performance","tlx_effort","tlx_frustration"].map(id=>Number(r[id])).filter(Number.isFinite);
    return {
      dass21_depression:sum(dassDep)*2,
      dass21_anxiety:sum(dassAnx)*2,
      dass21_stress:sum(dassStress)*2,
      cbi_personal:mean(p),
      cbi_work:mean(w),
      nasa_tlx_raw:mean(tlx),
      sleep_change_hours:finiteDiff(r.sleep_7d,r.sleep_before),
      insecurity_change:finiteDiff(r.insecurity_now,r.insecurity_before)
    };
  }

  async function finalize(){
    const payload={
      participant_code:state.participantCode,
      study_version:CONFIG.STUDY_VERSION||"1.0.0",
      started_at:new Date(state.startedAt).toISOString(),
      completed_at:new Date().toISOString(),
      completion_seconds:Math.round((Date.now()-state.startedAt)/1000),
      responses:state.responses,
      scores:calculateScores(),
      cognitive_summary:state.cognitive,
      device:deviceInfo(),
      visibility_losses:state.visibilityLosses,
      trials:state.trials
    };
    state.savedPayload=payload;
    $("participantCode").textContent=state.participantCode;$("participantCodeBox").classList.remove("hidden");
    try{
      if(!CONFIG.SUPABASE_URL||!CONFIG.SUPABASE_ANON_KEY) throw new Error("BACKEND_NOT_CONFIGURED");
      await submitSupabase(payload);
      $("saveStatus").textContent="Datos registrados correctamente. Gracias por su participación.";
      $("saveStatus").style.color="#1f6a4d";
      $("backupBtn").classList.remove("hidden");
    }catch(err){
      console.error(err);
      $("saveStatus").textContent="La evaluación ha finalizado, pero no se ha podido confirmar el envío.";
      $("saveError").textContent="Descargue la copia local de seguridad y comunique la incidencia al equipo investigador. No cierre esta página hasta guardar la copia.";
      $("saveError").classList.remove("hidden");$("backupBtn").classList.remove("hidden");
    }
  }

  async function submitSupabase(payload){
    const base=CONFIG.SUPABASE_URL.replace(/\/$/,"");
    const headers={"apikey":CONFIG.SUPABASE_ANON_KEY,"Authorization":"Bearer "+CONFIG.SUPABASE_ANON_KEY,"Content-Type":"application/json","Prefer":"return=representation"};
    const assessment={
      participant_code:payload.participant_code,study_version:payload.study_version,
      started_at:payload.started_at,completed_at:payload.completed_at,completion_seconds:payload.completion_seconds,
      responses:payload.responses,scores:payload.scores,cognitive_summary:payload.cognitive_summary,
      device:payload.device,visibility_losses:payload.visibility_losses
    };
    const a=await fetch(base+"/rest/v1/ceuta_assessments",{method:"POST",headers,body:JSON.stringify(assessment)});
    if(!a.ok) throw new Error("assessment "+a.status+" "+await a.text());
    const rows=await a.json(); const evaluationId=rows[0]?.id;
    if(!evaluationId) throw new Error("No assessment id");
    const trialRows=payload.trials.map(t=>({assessment_id:evaluationId,participant_code:payload.participant_code,task:t.task,trial_index:t.trial,trial_data:t}));
    for(let i=0;i<trialRows.length;i+=100){
      const b=await fetch(base+"/rest/v1/ceuta_trials",{method:"POST",headers,body:JSON.stringify(trialRows.slice(i,i+100))});
      if(!b.ok) throw new Error("trials "+b.status+" "+await b.text());
    }
  }

  function downloadBackup(){
    if(!state.savedPayload)return;
    const blob=new Blob([JSON.stringify(state.savedPayload,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`CEUTA_${state.participantCode}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }

  function deviceInfo(){
    return {
      user_agent:navigator.userAgent,
      language:navigator.language,
      platform:navigator.platform,
      touch_points:navigator.maxTouchPoints||0,
      screen_width:screen.width,screen_height:screen.height,
      viewport_width:innerWidth,viewport_height:innerHeight,
      pixel_ratio:devicePixelRatio||1,
      hardware_concurrency:navigator.hardwareConcurrency||null,
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
      local_time:new Date().toISOString()
    };
  }

  function median(a){if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?round(b[m]):round((b[m-1]+b[m])/2);}
  function mean(a){if(!a.length)return null;return round(a.reduce((x,y)=>x+y,0)/a.length);}
  function sd(a){if(a.length<2)return null;const m=a.reduce((x,y)=>x+y,0)/a.length;return round(Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)));}
  function round(x){return x==null?null:Math.round(x*100)/100;} function rate(n,d){return d?round(n/d):null;}
  function finiteDiff(a,b){a=Number(a);b=Number(b);return Number.isFinite(a)&&Number.isFinite(b)?round(a-b):null;}
  function dprime(h,hn,f,fn){if(!hn||!fn)return null;const hr=(h+.5)/(hn+1),fr=(f+.5)/(fn+1);return round(normInv(hr)-normInv(fr));}
  function normInv(p){
    const a=[-39.69683028665376,220.9460984245205,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239];
    const b=[-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572];
    const c=[-.007784894002430293,-.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
    const d=[.007784695709041462,.3224671290700398,2.445134137142996,3.754408661907416];
    const pl=.02425,ph=1-pl;let q,r;
    if(p<pl){q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
    if(p>ph){q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
    q=p-.5;r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const escAttr=esc;
  const cssEsc=s=>window.CSS&&CSS.escape?CSS.escape(s):String(s).replace(/[^a-zA-Z0-9_-]/g,"\\$&");
})();
