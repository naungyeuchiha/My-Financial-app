(() => {
  'use strict';
  const KEY = 'moneyflow-v3';
  const DEFAULT_SYNC_URL = '';
  const $ = id => document.getElementById(id);
  const today = new Date().toISOString().slice(0, 10);
  const defaults = [['Food & Drinks','expense'],['Transportation','expense'],['Family','expense'],['Housing','expense'],['Utilities','expense'],['Shopping','expense'],['Health','expense'],['Education','expense'],['Entertainment','expense'],['Rent','expense'],['Salary','income'],['Bonus','income'],['Other Income','income'],['Bank Loan','loan'],['Car Loan','loan'],['Other Loan','loan'],['Credit Card','credit'],['Other Credit','credit']];
  let state = load();
  state.currentType = state.currentType || 'expense';
  state.reportMonth = state.reportMonth || today.slice(0, 7);
  state.settings = Object.assign({theme:'light', syncUrl:DEFAULT_SYNC_URL, syncRevision:'', lastSynced:''}, state.settings || {});
  let syncing = false;

  function load() {
    const fallback = {transactions:[], categories:defaults.map(([name,type]) => ({name,type})), settings:{theme:'light',syncUrl:DEFAULT_SYNC_URL,syncRevision:'',lastSynced:''}, reportMonth:today.slice(0,7)};
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!data) return fallback;
      return {transactions:Array.isArray(data.transactions)?data.transactions:[], categories:Array.isArray(data.categories)&&data.categories.length?data.categories:fallback.categories, settings:Object.assign({},fallback.settings,data.settings||{}), reportMonth:data.reportMonth||fallback.reportMonth};
    } catch (_) { return fallback; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function money(value) { return `${Math.round(Number(value)||0).toLocaleString()} MMK`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(message) { const el=$('toast'); if(!el)return; el.textContent=message; el.classList.add('on'); clearTimeout(el._timer); el._timer=setTimeout(()=>el.classList.remove('on'),1800); }
  function selectedMonth() { return state.reportMonth || today.slice(0,7); }
  function monthItems(month=selectedMonth()) { return state.transactions.filter(tx=>String(tx.date||'').slice(0,7)===month); }
  function monthLabel(month) { const d=new Date(`${month}-01T00:00:00`); return Number.isNaN(d.getTime())?month:d.toLocaleDateString(undefined,{month:'long',year:'numeric'}); }
  function totals(items) { return items.reduce((r,tx)=>{const n=Number(tx.amount)||0;if(tx.type==='income')r.income+=n;else if(tx.type==='expense')r.expense+=n;else if(tx.type==='loan')r.loan+=n;else if(tx.type==='credit')r.credit+=n;return r;},{income:0,expense:0,loan:0,credit:0}); }
  function theme() { const dark=state.settings.theme==='dark'; document.body.classList.toggle('dark',dark); if($('switch'))$('switch').classList.toggle('on',dark); if($('theme'))$('theme').textContent=dark?'☾':'☀'; }
  function setType(type) { state.currentType=type; const titles={expense:'Add Expense',income:'Add Income',loan:'Add Loan Payment',credit:'Add Credit Payment'}; if($('formTitle'))$('formTitle').textContent=titles[type]||'Add Transaction'; document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b.dataset.type===type)); populateCategories(); }
  function populateCategories() { const select=$('category'); if(!select)return; const old=select.value; const list=state.categories.filter(x=>x.type===state.currentType); select.innerHTML=list.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')||'<option value="">General</option>'; if(list.some(x=>x.name===old))select.value=old; }
  function show(id) { document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id)); document.querySelectorAll('nav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===id)); }

  function renderReports() {
    const month=selectedMonth(), items=monthItems(month), t=totals(items);
    if($('month'))$('month').value=month;
    if($('cashflow'))$('cashflow').textContent=money(t.income-t.expense-t.loan-t.credit);
    const grouped={}; items.filter(x=>x.type==='expense').forEach(x=>{const k=x.category||'General';grouped[k]=(grouped[k]||0)+(Number(x.amount)||0);});
    const sorted=Object.entries(grouped).sort((a,b)=>b[1]-a[1]), top=sorted[0];
    if($('topSpending'))$('topSpending').textContent=top?top[0]:'No expense';
    if($('topAmt'))$('topAmt').textContent=top?money(top[1]):'0 MMK';
    const largest=items.slice().sort((a,b)=>(Number(b.amount)||0)-(Number(a.amount)||0))[0];
    if($('largest'))$('largest').textContent=largest?largest.category:'No activity';
    if($('largestAmt'))$('largestAmt').textContent=largest?money(largest.amount):'0 MMK';
    if($('rhythm'))$('rhythm').textContent=String(items.length);
    if($('focusBI')) { const net=t.income-t.expense-t.loan-t.credit; const rows=[]; if(!items.length)rows.push(`<div class="focusrow"><b>No activity</b><small>No transactions for ${esc(monthLabel(month))}.</small></div>`); else { rows.push(`<div class="focusrow"><b>Cash flow</b><small>Net cash flow is ${money(net)}.</small></div>`); if(top)rows.push(`<div class="focusrow"><b>Expense focus</b><small>${esc(top[0])} is the largest expense at ${money(top[1])}.</small></div>`); if(t.income)rows.push(`<div class="focusrow"><b>Savings focus</b><small>${Math.max(0,net/t.income*100).toFixed(1)}% of income remains.</small></div>`); } $('focusBI').innerHTML=rows.join(''); }
    if($('pulse')) { const max=top?top[1]:1; $('pulse').innerHTML=sorted.length?sorted.slice(0,6).map(([name,value])=>`<div class="row"><span>${esc(name)}</span><b>${money(value)}</b><div class="bar"><i style="width:${Math.max(8,value/max*100)}%"></i></div></div>`).join(''):`<p>No expense data for ${esc(monthLabel(month))}.</p>`; }
  }

  function render() {
    const t=totals(monthItems());
    [['income',t.income],['expense',t.expense],['loan',t.loan],['credit',t.credit],['remaining',t.income-t.expense-t.loan-t.credit]].forEach(([id,n])=>{if($(id))$(id).textContent=money(n);});
    if($('rows'))$('rows').innerHTML=state.transactions.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(tx=>`<tr><td>${esc(String(tx.date||'').slice(5))}</td><td><b>${esc(tx.category)}</b><small>${esc(tx.type)}</small></td><td class="${tx.type==='income'?'income':'expense'}">${tx.type==='income'?'+':'-'}${money(tx.amount)}</td><td><button type="button" data-del="${esc(tx.id)}" class="danger">✕</button></td></tr>`).join('')||'<tr><td colspan="4">No transactions.</td></tr>';
    if($('txCount'))$('txCount').textContent=`Activity (${state.transactions.length})`;
    if($('cats'))$('cats').innerHTML=state.categories.map((x,i)=>`<div class="cat"><span>${esc(x.name)}</span><small>${esc(x.type)}</small><button type="button" data-cat-remove="${i}">✕</button></div>`).join('');
    if($('syncUrl') && document.activeElement!==$('syncUrl'))$('syncUrl').value=state.settings.syncUrl||'';
    if($('syncStatus'))$('syncStatus').textContent=state.settings.syncUrl?(syncing?'Syncing…':'Up to date'):'Local only';
    if($('syncText'))$('syncText').textContent=state.settings.syncUrl?(state.settings.lastSynced?`Last synced: ${state.settings.lastSynced}`:'Ready to sync'):'Configure Google Apps Script in Settings.';
    theme(); populateCategories(); renderReports();
  }

  async function api(action,payload={}) {
    const url=(state.settings.syncUrl||'').trim();
    if(!url)throw Error('Add the Apps Script URL first.');
    const response=await fetch(url,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload})});
    if(!response.ok)throw Error(`Network error: ${response.status}`);
    const data=await response.json(); if(!data.ok)throw Error(data.message||'Sync failed'); return data;
  }
  function markSynced(revision) { if(revision)state.settings.syncRevision=revision; state.settings.lastSynced=new Date().toLocaleString(); save(); }
  async function pullIfChanged(quiet=false) { if(syncing||!state.settings.syncUrl)return; syncing=true; render(); try { const status=await api('status'); const revision=status.data&&status.data.revision; if(revision&&revision===state.settings.syncRevision){if(!quiet)toast('Already up to date');return;} const result=await api('getAll'); if(result.data){state.transactions=Array.isArray(result.data.transactions)?result.data.transactions:[]; if(Array.isArray(result.data.categories)&&result.data.categories.length)state.categories=result.data.categories; markSynced(result.data.revision); render();} if(!quiet)toast('Updated data loaded'); } catch(e) { if(!quiet)toast(e.message||'Sync failed'); else console.warn('Automatic pull failed:',e); } finally {syncing=false;render();} }
  async function pushChanges(quiet=true) { if(syncing||!state.settings.syncUrl)return; syncing=true;render(); try { const result=await api('replaceAll',{transactions:state.transactions,categories:state.categories}); markSynced(result.data&&result.data.revision); if(!quiet)toast(`Synced ${result.count||0} transactions`); } catch(e) { if(!quiet)toast(e.message||'Sync failed'); else console.warn('Automatic push failed:',e); } finally {syncing=false;render();} }

  document.addEventListener('click',e=>{const page=e.target.closest('[data-page]');if(page)return show(page.dataset.page);const add=e.target.closest('[data-add]');if(add){setType(add.dataset.add);return show('add');}const type=e.target.closest('[data-type]');if(type)return setType(type.dataset.type);const del=e.target.closest('[data-del]');if(del){state.transactions=state.transactions.filter(x=>String(x.id)!==String(del.dataset.del));save();render();return pushChanges();}const cat=e.target.closest('[data-cat-remove]');if(cat){state.categories.splice(Number(cat.dataset.catRemove),1);save();render();return pushChanges();}});
  if($('form'))$('form').addEventListener('submit',e=>{e.preventDefault();const amount=Number($('amount')?.value);if(!amount||amount<=0)return toast('Enter an amount greater than zero.');state.transactions.push({id:`${Date.now()}-${Math.random()}`,type:state.currentType,amount,date:$('date')?.value||today,category:$('category')?.value||'General',note:$('note')?.value||'',createdAt:new Date().toISOString()});save();e.target.reset();if($('date'))$('date').value=today;render();show('home');toast('Transaction saved');pushChanges();});
  if($('month'))$('month').addEventListener('change',e=>{state.reportMonth=e.target.value||today.slice(0,7);save();render();});
  ['theme','switch'].forEach(id=>{if($(id))$(id).addEventListener('click',()=>{state.settings.theme=state.settings.theme==='dark'?'light':'dark';save();theme();});});
  if($('clear'))$('clear').addEventListener('click',()=>{if(confirm('Delete all local transactions?')){state.transactions=[];save();render();pushChanges();}});
  if($('syncUrl'))$('syncUrl').addEventListener('input',e=>{state.settings.syncUrl=e.target.value.trim();save();render();});
  if($('syncUrl'))$('syncUrl').addEventListener('change',()=>{if(state.settings.syncUrl)pullIfChanged(false);});
  if($('test'))$('test').addEventListener('click',()=>pullIfChanged(false));
  if($('pull'))$('pull').addEventListener('click',()=>pullIfChanged(false));
  if($('push'))$('push').addEventListener('click',()=>pushChanges(false));
  if($('addCat'))$('addCat').addEventListener('click',()=>{const name=$('newCat')?.value.trim();if(!name)return toast('Enter a category name.');state.categories.push({name,type:$('newType')?.value||'expense',createdAt:new Date().toISOString()});$('newCat').value='';save();render();toast('Category added');pushChanges();});
  if($('export'))$('export').addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='moneyflow-backup.json';a.click();});
  if($('date'))$('date').value=today;
  setType(state.currentType); render(); show('home');
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  if(state.settings.syncUrl)pullIfChanged(true);
})();
