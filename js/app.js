(() => {
  const STORAGE_KEY = 'moneyflow-v3';
  const DEFAULT_DEFS = [
    ['Food & Drinks', 'expense'],
    ['Transportation', 'expense'],
    ['Family', 'expense'],
    ['Housing', 'expense'],
    ['Utilities', 'expense'],
    ['Shopping', 'expense'],
    ['Health', 'expense'],
    ['Education', 'expense'],
    ['Entertainment', 'expense'],
    ['Rent', 'expense'],
    ['Salary', 'income'],
    ['Bonus', 'income'],
    ['Other Income', 'income'],
    ['Bank Loan', 'loan'],
    ['Car Loan', 'loan'],
    ['Other Loan', 'loan'],
    ['Credit Card', 'credit'],
    ['Other Credit', 'credit']
  ];

  const state = loadState();
  state.currentType = state.currentType || 'expense';

  const els = {
    amount: document.getElementById('amount'),
    date: document.getElementById('date'),
    category: document.getElementById('category'),
    note: document.getElementById('note'),
    form: document.getElementById('form'),
    formTitle: document.getElementById('formTitle'),
    switch: document.getElementById('switch'),
    theme: document.getElementById('theme'),
    syncUrl: document.getElementById('syncUrl'),
    syncStatus: document.getElementById('syncStatus'),
    syncText: document.getElementById('syncText'),
    rows: document.getElementById('rows'),
    txCount: document.getElementById('txCount'),
    clear: document.getElementById('clear'),
    addCat: document.getElementById('addCat'),
    newCat: document.getElementById('newCat'),
    newType: document.getElementById('newType'),
    cats: document.getElementById('cats'),
    chart: document.getElementById('chart'),
    breakdown: document.getElementById('breakdown'),
    recent: document.getElementById('recent'),
    cashflow: document.getElementById('cashflow'),
    topSpending: document.getElementById('topSpending'),
    topAmt: document.getElementById('topAmt'),
    largest: document.getElementById('largest'),
    largestAmt: document.getElementById('largestAmt'),
    rhythm: document.getElementById('rhythm'),
    pulse: document.getElementById('pulse'),
    greet: document.getElementById('greet'),
    greetTitle: document.getElementById('greetTitle'),
    focusMsg: document.getElementById('focusMsg'),
    focusTitle: document.getElementById('focusTitle'),
    focusDetail: document.getElementById('focusDetail'),
    remaining: document.getElementById('remaining'),
    progress: document.getElementById('progress'),
    committeed: document.getElementById('committed'),
    saving: document.getElementById('saving'),
    income: document.getElementById('income'),
    expense: document.getElementById('expense'),
    loan: document.getElementById('loan'),
    credit: document.getElementById('credit'),
    pill: document.getElementById('pill'),
    test: document.getElementById('test'),
    pull: document.getElementById('pull'),
    push: document.getElementById('push'),
    export: document.getElementById('export'),
    import: document.getElementById('import')
  };

  function toCurrency(value) {
    return `${Math.round(Number(value || 0)).toLocaleString()} MMK`;
  }

  function sameDay(dateA, dateB) {
    const a = new Date(dateA);
    const b = new Date(dateB);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          transactions: [],
          categories: DEFAULT_DEFS.map(([name, type]) => ({ name, type })),
          settings: { theme: 'light', syncUrl: '' }
        };
      }
      const parsed = JSON.parse(raw);
      return {
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : DEFAULT_DEFS.map(([name, type]) => ({ name, type })),
        settings: Object.assign({ theme: 'light', syncUrl: '' }, parsed.settings || {})
      };
    } catch (error) {
      console.warn('Failed to load local storage data. Resetting app state.', error);
      return {
        transactions: [],
        categories: DEFAULT_DEFS.map(([name, type]) => ({ name, type })),
        settings: { theme: 'light', syncUrl: '' }
      };
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save local storage data.', error);
      toast('Storage is full or unavailable.');
    }
  }

  function toast(message) {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('on');
    window.clearTimeout(toastEl._timeout);
    toastEl._timeout = window.setTimeout(() => toastEl.classList.remove('on'), 1800);
  }

  function formatDate(dateValue) {
    const d = new Date(dateValue || new Date());
    return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
  }

  function esc(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getMonthTransactions() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return state.transactions.filter((tx) => tx.date && tx.date.startsWith(monthKey));
  }

  function totalsForMonth() {
    const monthItems = getMonthTransactions();
    const result = { income: 0, expense: 0, loan: 0, credit: 0, total: 0 };

    monthItems.forEach((tx) => {
      const amount = Number(tx.amount || 0);
      if (tx.type === 'income') result.income += amount;
      if (tx.type === 'expense') result.expense += amount;
      if (tx.type === 'loan') result.loan += amount;
      if (tx.type === 'credit') result.credit += amount;
    });

    result.total = result.income - result.expense - result.loan - result.credit;
    return result;
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark', isDark);
    state.settings.theme = isDark ? 'dark' : 'light';
    if (els.switch) els.switch.classList.toggle('on', isDark);
    if (els.theme) els.theme.textContent = isDark ? '☾' : '☀';
  }

  function setType(type) {
    state.currentType = type;
    document.querySelectorAll('[data-type]').forEach((button) => {
      button.classList.toggle('active', button.dataset.type === type);
    });
    if (els.formTitle) {
      const labels = {
        expense: 'Add Expense',
        income: 'Add Income',
        loan: 'Add Loan Payment',
        credit: 'Add Credit Payment'
      };
      els.formTitle.textContent = labels[type] || 'Add Transaction';
    }
  }

  function populateCategories() {
    const select = els.category;
    if (!select) return;

    const currentValue = select.value || state.categories[0]?.name || '';
    select.innerHTML = state.categories
      .filter((cat) => cat.type === state.currentType)
      .map((cat) => `<option value="${esc(cat.name)}">${esc(cat.name)}</option>`)
      .join('') || '<option value="">No categories</option>';

    if (currentValue && [...select.options].some((opt) => opt.value === currentValue)) {
      select.value = currentValue;
    } else if (select.options.length) {
      select.value = select.options[0].value;
    }
  }

  function renderGreeting() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    if (els.greet) els.greet.textContent = greeting.toUpperCase();
    if (els.greetTitle) els.greetTitle.textContent = `${greeting} 👋`;

    const latest = [...state.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (!latest) {
      if (els.focusMsg) els.focusMsg.textContent = 'Your money story will appear here.';
      if (els.focusTitle) els.focusTitle.textContent = 'Start your money log';
      if (els.focusDetail) els.focusDetail.textContent = 'Add your first transaction.';
      return;
    }

    if (els.focusTitle) els.focusTitle.textContent = `${latest.type === 'expense' ? 'Watch' : 'Track'} ${latest.category}`;
    if (els.focusDetail) els.focusDetail.textContent = `${latest.note ? `${latest.note} • ` : ''}${toCurrency(latest.amount)}`;
    if (els.focusMsg) els.focusMsg.textContent = `Your latest ${latest.type} is shaping today's focus.`;
  }

  function renderHomeSummary() {
    const totals = totalsForMonth();
    if (els.income) els.income.textContent = toCurrency(totals.income);
    if (els.expense) els.expense.textContent = toCurrency(totals.expense);
    if (els.loan) els.loan.textContent = toCurrency(totals.loan);
    if (els.credit) els.credit.textContent = toCurrency(totals.credit);
    if (els.remaining) els.remaining.textContent = toCurrency(totals.total);

    const committed = Math.min(100, Math.max(0, (totals.expense / Math.max(totals.income, 1)) * 100));
    if (els.progress) els.progress.style.width = `${Math.min(100, committed)}%`;
    if (els.committed) els.committed.textContent = `${committed.toFixed(0)}% committed`;
    if (els.saving) {
      const savingRate = totals.income ? ((totals.income - totals.expense - totals.loan - totals.credit) / totals.income) * 100 : 0;
      els.saving.textContent = `${savingRate.toFixed(0)}% savings rate`;
    }
  }

  function renderBreakdown() {
    const monthItems = getMonthTransactions().filter((tx) => tx.type === 'expense');
    const grouped = {};

    monthItems.forEach((tx) => {
      grouped[tx.category] = (grouped[tx.category] || 0) + Number(tx.amount || 0);
    });

    const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const max = entries.length ? Math.max(...entries.map(([, value]) => value), 1) : 1;

    if (els.breakdown) {
      els.breakdown.innerHTML = entries.length
        ? entries.map(([label, value]) => `
            <div class="row">
              <span>${esc(label)}</span>
              <b>${toCurrency(value)}</b>
              <div class="bar"><i style="width:${(value / max) * 100}%"></i></div>
            </div>
          `).join('')
        : '<p>No spending data this month.</p>';
    }
  }

  function renderRecent() {
    const recentItems = [...state.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
    if (els.recent) {
      els.recent.innerHTML = recentItems.length
        ? recentItems.map((tx) => `
            <div class="activity">
              <span>${tx.type === 'income' ? '↗' : tx.type === 'expense' ? '↘' : tx.type === 'loan' ? '◌' : '◍'} ${esc(tx.category)}</span>
              <div>
                <b>${tx.type === 'income' ? '+' : '-'}${toCurrency(tx.amount)}</b>
                <small>${esc(tx.note || tx.date)}</small>
              </div>
            </div>
          `).join('')
        : '<p>No transactions yet.</p>';
    }
  }

  function renderDashboard() {
    const totals = totalsForMonth();
    const incomeList = state.transactions.filter((tx) => tx.type === 'income');
    const expenseList = state.transactions.filter((tx) => tx.type === 'expense');

    if (els.cashflow) els.cashflow.textContent = toCurrency(totals.total);
    if (els.topSpending) els.topSpending.textContent = expenseList.length ? 'Expense' : '—';
    if (els.topAmt) els.topAmt.textContent = expenseList.length ? toCurrency(Math.max(...expenseList.map((tx) => Number(tx.amount || 0)))) : '0 MMK';

    const largest = [...state.transactions].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
    if (els.largest) els.largest.textContent = largest ? largest.category : '—';
    if (els.largestAmt) els.largestAmt.textContent = largest ? toCurrency(largest.amount) : '0 MMK';

    const rhythmValue = incomeList.length ? Math.round((totals.income / Math.max(incomeList.length, 1)) * 100) / 100 : 0;
    if (els.rhythm) els.rhythm.textContent = `${rhythmValue} MMK`;
    if (els.pulse) els.pulse.textContent = expenseList.length ? `${expenseList.length} entries` : '0 entries';

    if (els.chart) {
      const ctx = els.chart.getContext('2d');
      const width = els.chart.width || 600;
      const height = els.chart.height || 220;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid') || '#e5e7eb';
      ctx.lineWidth = 1;

      const days = Array.from({ length: 31 }, (_, index) => index + 1);
      const values = days.map((day) => {
        const key = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return state.transactions
          .filter((tx) => tx.date && tx.date.startsWith(key.slice(0, 7)) && tx.date.slice(-2) === String(day).padStart(2, '0'))
          .reduce((total, tx) => total + (tx.type === 'income' ? Number(tx.amount || 0) : -Number(tx.amount || 0)), 0);
      });

      const maxVal = Math.max(...values, 1);
      const minVal = Math.min(...values, 0);
      const span = Math.max(maxVal - minVal, 1);

      ctx.beginPath();
      values.forEach((value, index) => {
        const x = (index / Math.max(days.length - 1, 1)) * (width - 20) + 10;
        const y = height - 20 - ((value - minVal) / span) * (height - 40);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#5b7cff';
      ctx.stroke();
    }
  }

  function renderTransactions() {
    const items = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (els.rows) {
      els.rows.innerHTML = items.length
        ? items.map((tx) => `
            <tr>
              <td>${esc(tx.date.slice(5))}</td>
              <td><b>${esc(tx.category)}</b><small>${esc(tx.type)}</small></td>
              <td class="${tx.type === 'income' ? 'income' : 'expense'}">${tx.type === 'income' ? '+' : '-'}${toCurrency(tx.amount)}</td>
              <td><button data-del="${esc(tx.id)}" class="danger">✕</button></td>
            </tr>
          `).join('')
        : '<tr><td colspan="4">No transactions.</td></tr>';
    }
  }

  function renderCategories() {
    if (!els.cats) return;
    els.cats.innerHTML = state.categories.map((category, index) => `
      <div class="cat">
        <span>${esc(category.name)}</span>
        <small>${category.type}</small>
        <button data-cat-remove="${index}" aria-label="Remove ${esc(category.name)}">✕</button>
      </div>
    `).join('');
  }

  function renderSettings() {
    applyTheme(state.settings.theme);
    if (els.syncUrl) els.syncUrl.value = state.settings.syncUrl || '';
    if (els.syncStatus) els.syncStatus.textContent = state.settings.syncUrl ? 'Ready to sync' : 'Local only';
  }

  function resetForm() {
    if (els.amount) els.amount.value = '';
    if (els.note) els.note.value = '';
    if (els.date) els.date.value = formatDate(new Date());
    populateCategories();
  }

  function addTransaction(event) {
    event.preventDefault();
    const amount = Number(els.amount.value || 0);
    if (!amount || amount <= 0) {
      toast('Enter an amount greater than zero.');
      return;
    }

    const tx = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: state.currentType,
      amount: Number(amount),
      date: els.date.value || formatDate(new Date()),
      category: els.category.value || 'General',
      note: els.note.value.trim(),
      createdAt: new Date().toISOString()
    };

    state.transactions.push(tx);
    saveState();
    renderAll();
    resetForm();
    show('home');
    toast('Transaction saved');
  }

  function addCategory() {
    const name = (els.newCat.value || '').trim();
    const type = els.newType.value || 'expense';
    if (!name) {
      toast('Enter a category name.');
      return;
    }

    const exists = state.categories.some((cat) => cat.name.toLowerCase() === name.toLowerCase() && cat.type === type);
    if (exists) {
      toast('Category already exists.');
      return;
    }

    state.categories.push({ name, type });
    saveState();
    renderCategories();
    populateCategories();
    if (els.newCat) els.newCat.value = '';
    toast('Category added');
  }

  function removeCategory(index) {
    const category = state.categories[index];
    if (!category) return;
    state.categories.splice(index, 1);
    state.transactions = state.transactions.filter((tx) => tx.category !== category.name);
    saveState();
    renderAll();
    toast('Category removed');
  }

  function removeTransaction(id) {
    state.transactions = state.transactions.filter((tx) => tx.id !== id);
    saveState();
    renderAll();
    toast('Transaction removed');
  }

  function exportBackup() {
    const payload = JSON.stringify({ transactions: state.transactions, categories: state.categories, settings: state.settings }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'moneyflow-backup.json';
    link.click();
    URL.revokeObjectURL(url);
    toast('Backup exported');
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.transactions)) state.transactions = parsed.transactions;
      if (Array.isArray(parsed.categories) && parsed.categories.length) state.categories = parsed.categories;
      if (parsed.settings) state.settings = Object.assign(state.settings, parsed.settings);
      saveState();
      renderAll();
      toast('Backup imported');
    } catch (error) {
      console.error(error);
      toast('Invalid backup file');
    }
  }

  async function api(action, payload = {}) {
    const syncUrl = (state.settings.syncUrl || '').trim();
    if (!syncUrl) throw new Error('Add a Google Apps Script web app URL in Settings first.');

    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });

    if (!response.ok) {
      throw new Error(`Network error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.message || 'Sync request failed.');
    }
    return data;
  }

  async function syncData(type) {
    try {
      if (type === 'test') {
        const result = await api('ping');
        toast(result.message || 'Connected');
        return;
      }

      if (type === 'push') {
        const result = await api('replaceAll', {
          transactions: state.transactions,
          categories: state.categories
        });
        toast(`Synced ${result.count || 0} rows`);
        return;
      }

      if (type === 'pull') {
        const result = await api('getAll');
        if (Array.isArray(result.data?.transactions)) state.transactions = result.data.transactions;
        if (Array.isArray(result.data?.categories)) state.categories = result.data.categories;
        saveState();
        renderAll();
        toast('Pulled from sheet');
        return;
      }
    } catch (error) {
      toast(error.message || 'Sync failed');
    }
  }

  function show(pageId) {
    document.querySelectorAll('.page').forEach((page) => page.classList.toggle('active', page.id === pageId));
    document.querySelectorAll('[data-page]').forEach((button) => {
      button.classList.toggle('active', button.dataset.page === pageId);
    });
  }

  function initEvents() {
    document.addEventListener('click', (event) => {
      const pageButton = event.target.closest('[data-page]');
      if (pageButton) {
        show(pageButton.dataset.page);
        return;
      }

      const addButton = event.target.closest('[data-add]');
      if (addButton) {
        const type = addButton.dataset.add;
        setType(type || 'expense');
        show('add');
        return;
      }

      const typeButton = event.target.closest('[data-type]');
      if (typeButton) {
        setType(typeButton.dataset.type);
        populateCategories();
        return;
      }

      const deleteRow = event.target.closest('[data-del]');
      if (deleteRow) {
        removeTransaction(deleteRow.dataset.del);
        return;
      }

      const removeCat = event.target.closest('[data-cat-remove]');
      if (removeCat) {
        removeCategory(Number(removeCat.dataset.catRemove));
      }
    });

    if (els.form) {
      els.form.addEventListener('submit', addTransaction);
    }

    if (els.theme) {
      els.theme.addEventListener('click', () => {
        state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
        applyTheme(state.settings.theme);
        saveState();
      });
    }

    if (els.switch) {
      els.switch.addEventListener('click', () => {
        state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
        applyTheme(state.settings.theme);
        saveState();
      });
    }

    if (els.addCat) {
      els.addCat.addEventListener('click', addCategory);
    }

    if (els.clear) {
      els.clear.addEventListener('click', () => {
        if (!window.confirm('Delete all local transactions?')) return;
        state.transactions = [];
        saveState();
        renderAll();
        toast('All transactions cleared');
      });
    }

    if (els.syncUrl) {
      els.syncUrl.addEventListener('input', (event) => {
        state.settings.syncUrl = event.target.value.trim();
        saveState();
        renderSettings();
      });
    }

    if (els.test) els.test.addEventListener('click', () => syncData('test'));
    if (els.pull) els.pull.addEventListener('click', () => syncData('pull'));
    if (els.push) els.push.addEventListener('click', () => syncData('push'));
    if (els.export) els.export.addEventListener('click', exportBackup);
    if (els.import) {
      els.import.addEventListener('change', (event) => {
        const [file] = event.target.files || [];
        importBackup(file);
      });
    }
  }

  function renderAll() {
    renderGreeting();
    renderHomeSummary();
    renderBreakdown();
    renderRecent();
    renderDashboard();
    renderTransactions();
    renderCategories();
    renderSettings();
    populateCategories();
    if (els.txCount) {
      els.txCount.textContent = `Activity (${state.transactions.length})`;
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker registration failed:', error));
    });
  }

  if (els.date) els.date.value = formatDate(new Date());
  initEvents();
  applyTheme(state.settings.theme);
  setType(state.currentType || 'expense');
  renderAll();
  show('home');
})();
