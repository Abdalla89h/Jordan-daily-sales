// Management View dashboard (v3) — embedded data, works locally + on GitHub Pages
(function(){
  const DATA = (window.SALES_DATA || []).map(r => ({...r}));
  const LAST_DATE = window.LAST_SALES_DATE || "";

  // Show data load status (helps debugging GitHub Pages deploys)
  const statusEl = document.getElementById("dataStatus");
  if (statusEl) {
    statusEl.textContent = DATA.length
      ? (DATA.length.toLocaleString() + " rows loaded")
      : "NO DATA (check deployment paths)";
  }
  if (!DATA.length) {
    const warn = document.createElement("div");
    warn.className = "banner";
    warn.innerHTML = "<strong>Data not loaded.</strong> Make sure you uploaded the dashboard files (not the .zip) and that <span class='mono'>data/sales_data.js</span> exists next to <span class='mono'>index.html</span> (or inside <span class='mono'>/docs</span> if you publish from /docs).";
    document.body.insertBefore(warn, document.body.children[1] || document.body.firstChild);
  }


  const $ = (id) => document.getElementById(id);

  const teamFilter = $("teamFilter");
  const groupFilter = $("groupFilter");
  const monthFilter = $("monthFilter");
  const itemSearch = $("itemSearch");
  const ytdMode = $("ytdMode");
  const resetBtn = $("resetBtn");
  const exportBtn = $("exportBtn");

  $("lastDate").textContent = LAST_DATE || "—";

  const fmtMoney = (x) => {
    if (x === null || x === undefined || isNaN(x)) return "—";
    return Number(x).toLocaleString(undefined, {maximumFractionDigits:2});
  };
  const fmtPct = (x) => {
    if (x === null || x === undefined || isNaN(x)) return "—";
    return (Number(x)*100).toLocaleString(undefined, {maximumFractionDigits:1}) + "%";
  };
  const uniq = (arr) => Array.from(new Set(arr)).filter(x => x !== null && x !== undefined && x !== "" && x !== "nan");

  function fillSelect(select, values, includeAll=true){
    select.innerHTML = "";
    if(includeAll){
      const opt = document.createElement("option");
      opt.value = "__ALL__";
      opt.textContent = "All";
      select.appendChild(opt);
    }
    values.forEach(v => {
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = String(v);
      select.appendChild(opt);
    });
  }
  function fillMonths(select, months){
    select.innerHTML = "";
    months.forEach(m => {
      const opt = document.createElement("option");
      opt.value = String(m);
      opt.textContent = String(m);
      opt.selected = true;
      select.appendChild(opt);
    });
  }

  function getSelectedMonths(){
    const sel = Array.from(monthFilter.options).filter(o => o.selected).map(o => Number(o.value));
    if (!sel.length) return uniq(DATA.map(d => Number(d.Month))).map(Number);
    if (!ytdMode.checked) return sel;
    const maxM = Math.max(...sel);
    const all = uniq(DATA.map(d => Number(d.Month))).map(Number);
    return all.filter(m => m <= maxM);
  }

  function filtered(){
    const t = teamFilter.value;
    const g = groupFilter.value;
    const q = (itemSearch.value || "").trim().toLowerCase();
    const months = new Set(getSelectedMonths());

    return DATA.filter(r => {
      if (t !== "__ALL__" && String(r.Team) !== t) return false;
      if (g !== "__ALL__" && String(r["Product Group"]) !== g) return false;
      if (!months.has(Number(r.Month))) return false;
      if (q && !String(r.Item).toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function sum(rows, key){
    let s = 0;
    for (const r of rows){
      const v = Number(r[key] ?? 0);
      if (!isNaN(v)) s += v;
    }
    return s;
  }

  // --- Canvas helpers ---
  function clearCanvas(ctx){ ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height); }

  function drawAxes(ctx, padL, padT, padR, padB){
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, H - padB);
    ctx.lineTo(W - padR, H - padB);
    ctx.stroke();
  }

  function drawGroupedBars(canvas, labels, series){
    const ctx = canvas.getContext("2d");
    clearCanvas(ctx);

    const W = canvas.width, H = canvas.height;
    const padL = 60, padR = 14, padT = 18, padB = 38;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const allVals = series.flatMap(s => s.values);
    const maxV = Math.max(1, ...allVals);

    drawAxes(ctx, padL, padT, padR, padB);

    ctx.fillStyle = "rgba(232,238,246,0.75)";
    ctx.font = "11px system-ui";
    const ticks = 4;
    for (let i=0;i<=ticks;i++){
      const y = padT + (innerH * (i/ticks));
      const v = maxV * (1 - i/ticks);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillText(Math.round(v).toLocaleString(), 6, y+4);
    }

    const groups = labels.length;
    const sCount = series.length;
    const groupW = innerW / Math.max(1, groups);
    const barW = Math.max(4, (groupW * 0.70) / Math.max(1, sCount));
    const gap = Math.max(2, (groupW * 0.30) / Math.max(1, sCount+1));

    series.forEach((s, si) => {
      for (let i=0;i<groups;i++){
        const v = s.values[i] || 0;
        const h = innerH * (v / maxV);
        const x = padL + i*groupW + gap + si*(barW+gap);
        const y = (H - padB) - h;
        ctx.fillStyle = si === 0 ? "rgba(78,163,255,0.85)" : "rgba(130,212,255,0.55)";
        ctx.fillRect(x, y, barW, h);
      }
    });

    ctx.fillStyle = "rgba(232,238,246,0.7)";
    ctx.font = "11px system-ui";
    for (let i=0;i<groups;i++){
      const x = padL + i*groupW + groupW/2;
      const y = H - 12;
      const text = String(labels[i]);
      const tw = ctx.measureText(text).width;
      ctx.fillText(text, x - tw/2, y);
    }

    ctx.font = "12px system-ui";
    let lx = padL, ly = 12;
    series.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? "rgba(78,163,255,0.85)" : "rgba(130,212,255,0.55)";
      ctx.fillRect(lx, ly, 10, 10);
      ctx.fillStyle = "rgba(232,238,246,0.8)";
      ctx.fillText(s.name, lx + 14, ly + 10);
      lx += 14 + ctx.measureText(s.name).width + 18;
    });
  }

  function drawHorizontalBars(canvas, labels, values, maxBars=10){
    const ctx = canvas.getContext("2d");
    clearCanvas(ctx);

    const pairs = labels.map((l,i)=>({l, v: values[i]||0})).sort((a,b)=>b.v-a.v).slice(0,maxBars);
    labels = pairs.map(p=>p.l);
    values = pairs.map(p=>p.v);

    const W = canvas.width, H = canvas.height;
    const padL = 210, padR = 14, padT = 14, padB = 20;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const maxV = Math.max(1, ...values);
    const rows = labels.length;
    const rowH = innerH / Math.max(1, rows);
    const barH = Math.max(12, rowH * 0.58);

    ctx.font = "12px system-ui";
    for (let i=0;i<rows;i++){
      const yMid = padT + i*rowH + rowH/2;
      const v = values[i] || 0;
      const w = innerW * (v / maxV);

      ctx.fillStyle = "rgba(232,238,246,0.8)";
      const label = String(labels[i]);
      ctx.fillText(label.length>26 ? label.slice(0,26)+'…' : label, 8, yMid+4);

      const y = yMid - barH/2;
      ctx.fillStyle = "rgba(78,163,255,0.75)";
      ctx.fillRect(padL, y, w, barH);

      ctx.fillStyle = "rgba(232,238,246,0.65)";
      const txt = Math.round(v).toLocaleString();
      ctx.fillText(txt, padL + w + 6, yMid+4);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(padL, H - padB);
    ctx.lineTo(W - padR, H - padB);
    ctx.stroke();
  }

  function drawWaterfall(canvas, labels, deltas, startValue, endValue){
    const ctx = canvas.getContext("2d");
    clearCanvas(ctx);

    const W = canvas.width, H = canvas.height;
    const padL = 60, padR = 14, padT = 18, padB = 38;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const steps = [{name:"Budget", type:"total", value:startValue}];
    labels.forEach((l,i)=> steps.push({name:l, type:"delta", value:deltas[i]}));
    steps.push({name:"Actual", type:"total", value:endValue});

    let cum = startValue;
    const bars = [];
    for (let i=0;i<steps.length;i++){
      const s = steps[i];
      if (s.type === "total"){
        const totalVal = (i===0) ? startValue : endValue;
        bars.push({name:s.name, from:0, to:totalVal, delta:totalVal, isTotal:true});
      } else {
        const from = cum;
        const to = cum + s.value;
        bars.push({name:s.name, from, to, delta:s.value, isTotal:false});
        cum = to;
      }
    }

    const maxY = Math.max(...bars.map(b => Math.max(b.from, b.to)));
    const minY = Math.min(...bars.map(b => Math.min(b.from, b.to)));
    const span = (maxY - minY) || 1;

    const scaleY = (v) => (H - padB) - ((v - minY) / span) * innerH;

    drawAxes(ctx, padL, padT, padR, padB);

    ctx.fillStyle = "rgba(232,238,246,0.75)";
    ctx.font = "11px system-ui";
    const ticks = 4;
    for (let i=0;i<=ticks;i++){
      const v = minY + (span * (i/ticks));
      const y = scaleY(v);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillText(Math.round(v).toLocaleString(), 6, y+4);
    }

    const n = bars.length;
    const slotW = innerW / Math.max(1, n);
    const barW = slotW * 0.70;
    const gap = slotW * 0.30;

    for (let i=0;i<n;i++){
      const b = bars[i];
      const x = padL + i*slotW + gap/2;
      const y1 = scaleY(b.from);
      const y2 = scaleY(b.to);
      const top = Math.min(y1,y2);
      const h = Math.abs(y2-y1);

      if (b.isTotal){
        ctx.fillStyle = "rgba(130,212,255,0.45)";
      } else {
        ctx.fillStyle = b.delta >= 0 ? "rgba(122,255,198,0.55)" : "rgba(255,122,122,0.55)";
      }
      ctx.fillRect(x, top, barW, Math.max(2,h));

      if (i < n-1 && !b.isTotal){
        const x2 = padL + (i+1)*slotW + gap/2;
        const yConn = scaleY(b.to);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.beginPath();
        ctx.moveTo(x+barW, yConn);
        ctx.lineTo(x2, yConn);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(232,238,246,0.75)";
      ctx.font = "11px system-ui";
      const name = String(b.name);
      const short = name.length>10 ? name.slice(0,10)+'…' : name;
      const tx = x + barW/2 - ctx.measureText(short).width/2;
      ctx.fillText(short, tx, H - 12);

      const val = b.isTotal ? b.to : b.delta;
      const valTxt = b.isTotal ? Math.round(val).toLocaleString()
                               : ((val>=0?"+":"") + Math.round(val).toLocaleString());
      const ty = top - 6;
      ctx.fillStyle = "rgba(232,238,246,0.65)";
      ctx.fillText(valTxt, x + 2, Math.max(12, ty));
    }
  }

  function update(){
    const rows = filtered();

    const sales = sum(rows, "SalesTotalValue");
    const budget = sum(rows, "BudgetTotalValue");
    const variance = sales - budget;
    const ach = budget > 0 ? (sales / budget) : NaN;
    const salesQty = sum(rows, "SalesTotalQty");
    const bonusVal = sum(rows, "Sales Bonus Value");
    const bonusShare = sales > 0 ? (bonusVal / sales) : NaN;

    $("kpiSales").textContent = fmtMoney(sales);
    $("kpiBudget").textContent = fmtMoney(budget);
    $("kpiAch").textContent = isNaN(ach) ? "—" : fmtPct(ach);
    $("kpiVar").textContent = (variance>=0?"+":"") + fmtMoney(variance);
    $("kpiSalesQty").textContent = fmtMoney(salesQty);
    $("kpiBonusShare").textContent = isNaN(bonusShare) ? "—" : fmtPct(bonusShare);

    const months = uniq(rows.map(r => Number(r.Month))).sort((a,b)=>a-b);
    const salesByM = months.map(m => sum(rows.filter(r => Number(r.Month)===m), "SalesTotalValue"));
    const budgetByM = months.map(m => sum(rows.filter(r => Number(r.Month)===m), "BudgetTotalValue"));
    drawGroupedBars($("chartMonthly"), months, [
      {name:"Sales", values: salesByM},
      {name:"Budget", values: budgetByM},
    ]);

    const teams = uniq(rows.map(r => r.Team));
    const teamAgg = teams.map(t => ({t, v: sum(rows.filter(r => r.Team===t), "SalesTotalValue")}))
                         .sort((a,b)=>b.v-a.v)
                         .slice(0,10);
    drawHorizontalBars($("chartTeams"), teamAgg.map(x=>x.t), teamAgg.map(x=>x.v), 10);

    const itemAggMap = new Map();
    for (const r of rows){
      const key = String(r.Item || "");
      itemAggMap.set(key, (itemAggMap.get(key) || 0) + Number(r.SalesTotalValue || 0));
    }
    const itemAgg = Array.from(itemAggMap.entries()).map(([k,v])=>({k,v}))
                        .sort((a,b)=>b.v-a.v)
                        .slice(0,10);
    drawHorizontalBars($("chartItems"), itemAgg.map(x=>x.k), itemAgg.map(x=>x.v), 10);

    const groups = uniq(rows.map(r => r["Product Group"]));
    const groupAgg = groups.map(g => ({
      g,
      budget: sum(rows.filter(r => r["Product Group"]===g), "BudgetTotalValue"),
      sales: sum(rows.filter(r => r["Product Group"]===g), "SalesTotalValue"),
    })).map(x => ({...x, delta: x.sales - x.budget}));

    groupAgg.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
    const top = groupAgg.slice(0,8);
    const rest = groupAgg.slice(8);
    if (rest.length){
      const restDelta = rest.reduce((s,x)=>s+x.delta,0);
      top.push({g:"Others", delta: restDelta});
    }
    drawWaterfall($("chartWaterfall"), top.map(x=>x.g), top.map(x=>x.delta), budget, sales);

    const tbody = $("dataTable").querySelector("tbody");
    tbody.innerHTML = "";
    const sorted = [...rows].sort((a,b)=> (Number(b.SalesTotalValue||0) - Number(a.SalesTotalValue||0)));
    for (const r of sorted){
      const bud = Number(r.BudgetTotalValue||0);
      const sal = Number(r.SalesTotalValue||0);
      const varv = sal - bud;
      const a = bud > 0 ? (sal/bud) : NaN;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.Team ?? ""}</td>
        <td>${r["Product Group"] ?? ""}</td>
        <td>${r.Item ?? ""}</td>
        <td class="num">${r.Month ?? ""}</td>
        <td class="num">${fmtMoney(bud)}</td>
        <td class="num">${fmtMoney(sal)}</td>
        <td class="num">${(varv>=0?"+":"") + fmtMoney(varv)}</td>
        <td class="num">${isNaN(a) ? "—" : fmtPct(a)}</td>
        <td class="num">${fmtMoney(r.SalesTotalQty)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function reset(){
    teamFilter.value = "__ALL__";
    groupFilter.value = "__ALL__";
    itemSearch.value = "";
    ytdMode.checked = false;
    Array.from(monthFilter.options).forEach(o => o.selected = true);
    update();
  }

  function exportCSV(){
    const rows = filtered();
    const cols = ["Team","Product Group","Item","Month","BudgetTotalValue","SalesTotalValue","VarianceValue","SalesTotalQty"];
    const header = cols.join(",");
    const esc = (s) => {
      const str = String(s ?? "");
      if (/[",\n]/.test(str)) return '"' + str.replace(/"/g,'""') + '"';
      return str;
    };
    const lines = rows.map(r => cols.map(c => esc(r[c])).join(","));
    const csv = [header, ...lines].join("\n");

    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "filtered_sales_export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const teams = uniq(DATA.map(d => d.Team)).sort();
  const groups = uniq(DATA.map(d => d["Product Group"])).sort();
  const months = uniq(DATA.map(d => Number(d.Month))).sort((a,b)=>a-b);

  fillSelect(teamFilter, teams, true);
  fillSelect(groupFilter, groups, true);
  fillMonths(monthFilter, months);

  teamFilter.addEventListener("change", update);
  groupFilter.addEventListener("change", update);
  monthFilter.addEventListener("change", update);
  itemSearch.addEventListener("input", update);
  ytdMode.addEventListener("change", update);
  resetBtn.addEventListener("click", reset);
  exportBtn.addEventListener("click", exportCSV);

  update();
})();
