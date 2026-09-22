(() => {
  'use strict';
  const KEY = 'moneyflow-v3';
  const DEFAULTS = [['Food & Drinks','expense'],['Transportation','expense'],['Family','expense'],['Housing','expense'],['Utilities','expense'],['Shopping','expense'],['Health','expense'],['Education','expense'],['Entertainment','expense'],['Rent','expense'],['Salary','income'],['Bonus','income'],['Other Income','income'],['Bank Loan','loan'],['Car Loan','loan'],['Other Loan','loan'],['Credit Card','credit'],['Other Credit','credit']];
  const $ = id => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0, 10);
  const currentMonth = () => today().slice(0, 7);
  let state = loadState();
  state.currentType = state.currentType || 'expense';
  state.reportMonth = state.reportMonth || currentMonth();
  state.settings = Object.assign({ theme: 'light', syncUrl: '', syncRevision: '', lastSynced: '' }, state.settings || {});
  let syncing = false;

  function loadState() {
    const fallback = { transactions: [], categories: DEFAULTS.map(([name, type]) => ({ name, type, createdAt: new Date().toISOString() })), settings: { theme: 'light', syncUrl: '', syncRevision: '', lastSynced: '' } };
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!data) return fallback;
      return { transactions: Array.isArray(data.transactions) ? data.transactions : [], categories: Array.isArray(data.categories) && data.categories.length ? data.categories : fallback.categories, settings: Object.assign({}, fallback.settings, data.settings || {}), reportMonth: data.reportMonth || currentMonth() };
    } catch (_) { return fallback; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function money(value) { return `${Math.round(Number(value) || 0).toLocaleString()} MMK`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function toast(message) { const el = $('toast'); if (!el) return; el.textContent = message; el.classList.add('on'); clearTimeout(el._timer); el._timer = setTimeout(() => el.classList.remove('on'), 1800); }
  function itemsFor(month) { return state.transactions.filter(tx => String(tx.date || '').slice(0, 7) === month); }
  function selectedMonth() { return state.reportMonth || currentMonth(); }
  function totals(items) { return items.reduce((r, tx) => { const n = Number(tx.amount) || 0; if (tx.type === 'income') r.income += n; else if (tx.type === 'expense') r.expense += n; else if (tx.type === 'loan') r.loan += n; else if (tx.type === 'credit') r.credit += n; return r; }, { income: 0, expense: 0, loan: 0, credit: 0 }); }
  function monthLabel(month) { const d = new Date(`${month}-01T00:00:00`); return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
  function theme() { const dark = state.settings.theme === 'dark'; document.body.classList.toggle('dark', dark); if ($('switch')) $('switch').classList.toggle('on', dark); if ($('theme')) $('theme').textContent = dark ? '☾' : '☀'; }
  function setType(type) { state.currentType = type; const titles = { expense: 'Add Expense', income: 'Add Income', loan: 'Add Loan Payment', credit: 'Add Credit Payment' }; if ($('formTitle')) $('formTitle').textContent = titles[type] || 'Add Transaction'; document.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b.dataset.type === type)); populateCategories(); }
  function populateCategories() { const select = $('category'); if (!select) return; const old = select.value; const list = state.categories.filter(x => x.type === state.currentType); select.innerHTML = list.map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('') || '<option value="">General</option>'; if (list.some(x => x.name === old)) select.value = old; }
  function show(id) { document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id)); document.querySelectorAll('nav [data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === id)); }

  function ensureReportFilters() {
    const dashboard = $('dashboard');
    if (!dashboard || $('reportFilters')) return;
    const box = document.createElement('div');
    box.id = 'reportFilters';
    box.className = 'panel';
    box.innerHTML = `<div class="head"><h2>Report period</h2><button type="button" id="reportThisMonth">Current month</button></div><label>Year / month<input id="reportMonth" type="month"></label><small id="reportPeriodLabel"></small>`;
    const firstPanel = dashboard.querySelector('.bi') || dashboard.firstElementChild;
    dashboard.insertBefore(box, firstPanel);
    $('reportMonth').value = selectedMonth();
    $('reportMonth').addEventListener('change', e => { state.reportMonth = e.target.value || currentMonth(); save(); renderReports(); });
    $('reportThisMonth').addEventListener('click', () => { state.reportMonth = currentMonth(); save(); renderReports(); });
  }

  function renderReports() {
    ensureReportFilters();
    const month = selectedMonth();
    const items = itemsFor(month);
    const t = totals(items);
    if ($('reportMonth')) $('reportMonth').value = month;
    if ($('reportPeriodLabel')) $('reportPeriodLabel').textContent = `Showing ${monthLabel(month)} · ${items.length} transaction${items.length === 1 ? '' : 's'}`;
    if ($('cashflow')) $('cashflow').textContent = money(t.income - t.expense - t.loan - t.credit);
    if ($('rhythm')) $('rhythm').textContent = `${items.length}`;
    const expenses = items.filter(x => x.type === 'expense');
    const grouped = {};
    expenses.forEach(x => { grouped[x.category] = (grouped[x.category] || 0) + (Number(x.amount) || 0); });
    const cats = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    const top = cats[0];
    if ($('topSpending')) $('topSpending').textContent = top ? top[0] : 'No expense';
    if ($('topAmt')) $('topAmt').textContent = top ? money(top[1]) : '0 MMK';
    const largest = items.slice().sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
    if ($('largest')) $('largest').textContent = largest ? largest.category : 'No activity';
    if ($('largestAmt')) $('largestAmt').textContent = largest ? money(largest.amount) : '0 MMK';
    if ($('focusBI')) {
      const messages = [];
      if (!items.length) messages.push(['No activity', `No transactions recorded for ${monthLabel(month)}.`]);
      else {
        messages.push(['Cash flow focus', `Net cash flow is ${money(t.income - t.expense - t.loan - t.credit)}.`]);
        if (top) messages.push(['Spending focus', `${top[0]} is the largest expense at ${money(top[1])}.`]);
        if (t.income) messages.push(['Savings focus', `${Math.max(0, ((t.income - t.expense - t.loan - t.credit) / t.income * 100)).toFixed(1)}% of income remains.`]);
      }
      $('focusBI').innerHTML = messages.map(([title, detail]) => `<div class="focusrow"><b>${esc(title)}</b><small>${esc(detail)}</small></div>`).join('');
    }
    if ($('pulse')) {
      const max = cats[0] ? cats[0][1] : 1;
      $('pulse').innerHTML = cats.length ? cats.slice(0, 8).map(([name, value]) => `<div class="row"><span>${esc(name)}</span><b>${money(value)}</b><div class="bar"><i style="width:${value / max * 100}%"></i></div></div>`).join('') : `<p>No expense data for ${esc(monthLabel(month))}.</p>`;
    }
    if ($('chart') && $('chart').getContext) drawChart(items);
  }
  function drawChart(items) { const canvas = $('chart'), ctx = canvas.getContext('2d'), width = canvas.clientWidth || 600, height = 250, ratio = window.devicePixelRatio || 1; canvas.width = width * ratio; canvas.height = height * ratio; canvas.style.height = `${height}px`; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height); const days = new Date(`${selectedMonth()}-01T00:00:00`); const count = new Date(days.getFullYear(), days.getMonth() + 1, 0).getDate(); const values = Array.from({length: count}, (_, i) => items.filter(x => Number(String(x.date).slice(8, 10)) === i + 1).reduce((sum, x) => sum + (x.type === 'income' ? Number(x.amount || 0) : -Number(x.amount || 0)), 0)); const max = Math.max(1, ...values.map(Math.abs)); ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid') || '#e5e7eb'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, height / 2); ctx.lineTo(width - 10, height / 2); ctx.stroke(); ctx.strokeStyle = '#5b7cff'; ctx.lineWidth = 3; ctx.beginPath(); values.forEach((v, i) => { const x = 10 + i * (width - 20) / Math.max(1, count - 1); const y = height / 2 - v / max * (height / 2 - 20); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }

  function render() {
    const month = selectedMonth(); const t = totals(itemsFor(month));
    [['income', t.income], ['expense', t.expense], ['loan', t.loan], ['credit', t.credit], ['remaining', t.income - t.expense - t.loan - t.credit]].forEach(([id, n]) => { if ($(id)) $(id).textContent = money(n); });
    if ($('month')) $('month').value = month;
    if ($('rows')) $('rows').innerHTML = state.transactions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map(x => `<tr><td>${esc(String(x.date || '').slice(5))}</td><td><b>${esc(x.category)}</b><small>${esc(x.type)}</small></td><td class="${x.type === 'income' ? 'income' : 'expense'}">${x.type === 'income' ? '+' : '-'}${money(x.amount)}</td><td><button type="button" data-del="${esc(x.id)}" class="danger">✕</button></td></tr>`).join('') || '<tr><td colspan="4">No transactions.</td></tr>';
    if ($('cats')) $('cats').innerHTML = state.categories.map((x, i) => `<div class="cat"><span>${esc(x.name)}</span><small>${esc(x.type)}</small><button type="button" data-cat-remove="${i}">✕</button></div>`).join('');
    if ($('syncUrl')) $('syncUrl').value = state.settings.syncUrl || '';
    if ($('syncStatus')) $('syncStatus').textContent = state.settings.syncUrl ? (syncing ? 'Syncing…' : 'Up to date') : 'Local only';
    if ($('syncText')) $('syncText').textContent = state.settings.lastSynced ? `Last synced: ${state.settings.lastSynced}` : 'Configure Google Apps Script in Settings.';
    theme(); populateCategories(); renderReports();
  }

  async function api(action, payload = {}) { if (!state.settings.syncUrl) throw Error('Add the Apps Script URL first.'); const response = await fetch(state.settings.syncUrl, { method: 'POST', redirect: 'follow', headers: {'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({action, ...payload}) }); if (!response.ok) throw Error(`Network error: ${response.status}`); const data = await response.json(); if (!data.ok) throw Error(data.message || 'Sync failed'); return data; }
  function markSynced(revision) { if (revision) state.settings.syncRevision = revision; state.settings.lastSynced = new Date().toLocaleString(); save(); }
  async function pullIfChanged(quiet = false) { if (syncing || !state.settings.syncUrl) return; syncing = true; render(); try { const status = await api('status'); const revision = status.data && status.data.revision; if (revision && revision === state.settings.syncRevision) { if (!quiet) toast('Already up to date'); return; } const result = await api('getAll'); if (result.data) { state.transactions = result.data.transactions || []; if (result.data.categories && result.data.categories.length) state.categories = result.data.categories; markSynced(result.data.revision); render(); } if (!quiet) toast('Updated data loaded'); } catch (e) { if (!quiet) toast(e.message); else console.warn(e); } finally { syncing = false; render(); } }
  async function pushChanges(quiet = true) { if (syncing || !state.settings.syncUrl) return; syncing = true; render(); try { const result = await api('replaceAll', {transactions: state.transactions, categories: state.categories}); markSynced(result.data && result.data.revision); if (!quiet) toast(`Synced ${result.count || 0} transactions`); } catch (e) { if (!quiet) toast(e.message); else console.warn(e); } finally { syncing = false; render(); } }

  document.addEventListener('click', e => { const page = e.target.closest('[data-page]'); if (page) return show(page.dataset.page); const add = e.target.closest('[data-add]'); if (add) { setType(add.dataset.add); return show('add'); } const type = e.target.closest('[data-type]'); if (type) return setType(type.dataset.type); const del = e.target.closest('[data-del]'); if (del) { state.transactions = state.transactions.filter(x => String(x.id) !== String(del.dataset.del)); save(); render(); return pushChanges(); } const cat = e.target.closest('[data-cat-remove]'); if (cat) { state.categories.splice(Number(cat.dataset.catRemove), 1); save(); render(); return pushChanges(); } });
  if ($('form')) $('form').addEventListener('submit', e => { e.preventDefault(); const amount = Number($('amount')?.value); if (!amount || amount <= 0) return toast('Enter an amount greater than zero.'); state.transactions.push({id:`${Date.now()}-${Math.random()}`, type:state.currentType, amount, date:$('date')?.value || today(), category:$('category')?.value || 'General', note:$('note')?.value || '', createdAt:new Date().toISOString()}); save(); e.target.reset(); if ($('date')) $('date').value = today(); render(); show('home'); toast('Transaction saved'); pushChanges(); });
  if ($('month')) $('month').addEventListener('change', e => { state.reportMonth = e.target.value || currentMonth(); save(); renderReports(); render(); });
  ['theme','switch'].forEach(id => { if ($(id)) $(id).addEventListener('click', () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; save(); theme(); }); });
  if ($('clear')) $('clear').addEventListener('click', () => { if (confirm('Delete all local transactions?')) { state.transactions = []; save(); render(); pushChanges(); } });
  if ($('syncUrl')) $('syncUrl').addEventListener('input', e => { state.settings.syncUrl = e.target.value.trim(); save(); render(); if (state.settings.syncUrl) pullIfChanged(); });
  if ($('test')) $('test').addEventListener('click', () => pullIfChanged(false)); if ($('pull')) $('pull').addEventListener('click', () => pullIfChanged(false)); if ($('push')) $('push').addEventListener('click', () => pushChanges(false));
  if ($('addCat')) $('addCat').addEventListener('click', () => { const name = $('newCat')?.value.trim(); if (!name) return toast('Enter a category name.'); state.categories.push({name, type:$('newType')?.value || 'expense', createdAt:new Date().toISOString()}); $('newCat').value=''; save(); render(); toast('Category added'); pushChanges(); });
  if ($('export')) $('export').addEventListener('click', () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})); a.download='moneyflow-backup.json'; a.click(); });
  if ($('date')) $('date').value = today();
  ensureReportFilters(); setType(state.currentType); render(); show('home');
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  pullIfChanged(true);
})();
