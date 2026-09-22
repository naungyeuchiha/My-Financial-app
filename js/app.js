(() => {
  const KEY = 'moneyflow-v3';
  const $ = id => document.getElementById(id);
  const d = new Date();
  const today = d.toISOString().slice(0, 10);

  const defaults = [
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

  let state = load();
  state.currentType = state.currentType || 'expense';
  state.reportMonth = state.reportMonth || today.slice(0, 7);

  function load() {
    const fallback = {
      transactions: [],
      categories: defaults.map(([name, type]) => ({ name, type })),
      settings: { theme: 'light', syncUrl: '', syncRevision: '', lastSynced: '' }
    };

    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw) return fallback;
      return {
        transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
        categories: Array.isArray(raw.categories) && raw.categories.length ? raw.categories : fallback.categories,
        settings: Object.assign({}, fallback.settings, raw.settings || {}),
        reportMonth: raw.reportMonth || today.slice(0, 7)
      };
    } catch (_) {
      return fallback;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function money(n) {
    return `${Math.round(Number(n) || 0).toLocaleString()} MMK`;
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function selectedMonth() {
    return state.reportMonth || today.slice(0, 7);
  }

  function monthLabel(month) {
    const date = new Date(`${month}-01T00:00:00`);
    if (Number.isNaN(date.getTime())) return month;
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function monthItems(month = selectedMonth()) {
    return state.transactions.filter(tx => String(tx.date || '').slice(0, 7) === month);
  }

  function totals(items) {
    return items.reduce((acc, tx) => {
      const n = Number(tx.amount) || 0;
      if (tx.type === 'income') acc.income += n;
      else if (tx.type === 'expense') acc.expense += n;
      else if (tx.type === 'loan') acc.loan += n;
      else if (tx.type === 'credit') acc.credit += n;
      return acc;
    }, { income: 0, expense: 0, loan: 0, credit: 0 });
  }

  function renderReports() {
    const month = selectedMonth();
    const items = monthItems(month);
    const t = totals(items);

    if ($('month')) $('month').value = month;

    if ($('cashflow')) {
      $('cashflow').textContent = money(t.income - t.expense - t.loan - t.credit);
    }

    if ($('topSpending')) {
      const byCategory = {};
      items.filter(x => x.type === 'expense').forEach(tx => {
        const key = tx.category || 'General';
        byCategory[key] = (byCategory[key] || 0) + (Number(tx.amount) || 0);
      });

      const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
      const top = sorted[0];
      $('topSpending').textContent = top ? top[0] : 'No expense';
      $('topAmt').textContent = top ? money(top[1]) : '0 MMK';
    }

    if ($('largest')) {
      const biggest = items.slice().sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))[0];
      $('largest').textContent = biggest ? biggest.category : 'No activity';
      $('largestAmt').textContent = biggest ? money(biggest.amount) : '0 MMK';
    }

    if ($('focusBI')) {
      const net = t.income - t.expense - t.loan - t.credit;

      let rows = [];
      if (!items.length) {
        rows.push(`<div class="focusrow"><b>No activity</b><small>No transactions for ${monthLabel(month)}.</small></div>`);
      } else {
        rows.push(`<div class="focusrow"><b>Cash flow</b><small>Net cash flow is ${money(net)}.</small></div>`);
        const byCategory = {};
        items.filter(x => x.type === 'expense').forEach(tx => {
          const key = tx.category || 'General';
          byCategory[key] = (byCategory[key] || 0) + (Number(tx.amount) || 0);
        });
        const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
        const top = sorted[0];
        if (top) {
          rows.push(`<div class="focusrow"><b>Expense focus</b><small>${top[0]} is the largest expense at ${money(top[1])}.</small></div>`);
        }
        if (t.income > 0) {
          const saveRate = Math.max(0, (net / t.income) * 100);
          rows.push(`<div class="focusrow"><b>Savings focus</b><small>${saveRate.toFixed(1)}% of income remains in this period.</small></div>`);
        }
      }

      $('focusBI').innerHTML = rows.join('');
    }

    if ($('pulse')) {
      const byCategory = {};
      items.filter(x => x.type === 'expense').forEach(tx => {
        const key = tx.category || 'General';
        byCategory[key] = (byCategory[key] || 0) + (Number(tx.amount) || 0);
      });

      const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
      const max = sorted[0] ? sorted[0][1] : 1;

      if (!sorted.length) {
        $('pulse').innerHTML = `<p>No expense data for ${esc(monthLabel(month))}.</p>`;
        return;
      }

      $('pulse').innerHTML = sorted.slice(0, 6).map(([name, amount]) => `
        <div class="row">
          <span>${esc(name)}</span>
          <b>${money(amount)}</b>
          <div class="bar"><i style="width:${Math.max(8, (amount / max) * 100)}%"></i></div>
        </div>
      `).join('');
    }
  }

  function theme() {
    const dark = state.settings.theme === 'dark';
    document.body.classList.toggle('dark', dark);
    if ($('switch')) $('switch').classList.toggle('on', dark);
    if ($('theme')) $('theme').textContent = dark ? '☾' : '☀';
  }

  function setType(type) {
    state.currentType = type;
    const titles = {
      expense: 'Add Expense',
      income: 'Add Income',
      loan: 'Add Loan Payment',
      credit: 'Add Credit Payment'
    };

    if ($('formTitle')) $('formTitle').textContent = titles[type] || 'Add Transaction';
    document.querySelectorAll('[data-type]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    populateCategories();
  }

  function populateCategories() {
    const select = $('category');
    if (!select) return;

    const oldValue = select.value;
    const list = state.categories.filter(x => x.type === state.currentType);

    select.innerHTML = list.map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('') || '<option value="">General</option>';

    if (list.some(x => x.name === oldValue)) {
      select.value = oldValue;
    }
  }

  function show(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
    document.querySelectorAll('nav [data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  }

  function render() {
    const month = selectedMonth();
    const items = monthItems(month);
    const totalsForMonth = totals(items);

    [['income', totalsForMonth.income], ['expense', totalsForMonth.expense], ['loan', totalsForMonth.loan], ['credit', totalsForMonth.credit], ['remaining', totalsForMonth.income - totalsForMonth.expense - totalsForMonth.loan - totalsForMonth.credit]].forEach(([id, value]) => {
      if ($(id)) $(id).textContent = money(value);
    });

    if ($('txCount')) $('txCount').textContent = `Activity (${state.transactions.length})`;
    if ($('rows')) {
      $('rows').innerHTML = state.transactions
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .map(tx => `
          <tr>
            <td>${esc(String(tx.date || '').slice(5))}</td>
            <td><b>${esc(tx.category)}</b><small>${esc(tx.type)}</small></td>
            <td class="${tx.type === 'income' ? 'income' : 'expense'}">
              ${tx.type === 'income' ? '+' : '-'}${money(tx.amount)}
            </td>
            <td><button type="button" data-del="${esc(tx.id)}" class="danger">✕</button></td>
          </tr>
        `).join('') || '<tr><td colspan="4">No transactions.</td></tr>';
    }

    if ($('syncUrl')) $('syncUrl').value = state.settings.syncUrl || '';
    if ($('syncStatus')) $('syncStatus').textContent = state.settings.syncUrl ? 'Up to date' : 'Local only';
    if ($('syncText')) $('syncText').textContent = state.settings.lastSynced ? `Last synced: ${state.settings.lastSynced}` : 'Configure Google Apps Script in Settings.';

    theme();
    populateCategories();
    renderReports();
  }

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('on'), 1800);
  }

  document.addEventListener('click', e => {
    const page = e.target.closest('[data-page]');
    if (page) return show(page.dataset.page);

    const add = e.target.closest('[data-add]');
    if (add) {
      setType(add.dataset.add);
      return show('add');
    }

    const type = e.target.closest('[data-type]');
    if (type) {
      setType(type.dataset.type);
      return;
    }

    const del = e.target.closest('[data-del]');
    if (del) {
      state.transactions = state.transactions.filter(x => String(x.id) !== String(del.dataset.del));
      save();
      render();
      return;
    }

    const cat = e.target.closest('[data-cat-remove]');
    if (cat) {
      state.categories.splice(Number(cat.dataset.catRemove), 1);
      save();
      render();
      return;
    }
  });

  if ($('form')) {
    $('form').addEventListener('submit', e => {
      e.preventDefault();
      const amount = Number($('amount')?.value);
      if (!amount || amount <= 0) return toast('Enter an amount greater than zero.');

      state.transactions.push({
        id: `${Date.now()}-${Math.random()}`,
        type: state.currentType,
        amount,
        date: $('date')?.value || today,
        category: $('category')?.value || 'General',
        note: $('note')?.value || '',
        createdAt: new Date().toISOString()
      });

      save();
      e.target.reset();
      if ($('date')) $('date').value = today;
      render();
      show('home');
      toast('Transaction saved');
    });
  }

  if ($('month')) {
    $('month').addEventListener('change', e => {
      state.reportMonth = e.target.value || today.slice(0, 7);
      save();
      render();
    });
  }

  ['theme', 'switch'].forEach(id => {
    if ($(id)) {
      $(id).addEventListener('click', () => {
        state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
        save();
        theme();
      });
    }
  });

  if ($('clear')) {
    $('clear').addEventListener('click', () => {
      if (confirm('Delete all local transactions?')) {
        state.transactions = [];
        save();
        render();
      }
    });
  }

  if ($('addCat')) {
    $('addCat').addEventListener('click', () => {
      const name = $('newCat')?.value.trim();
      if (!name) return toast('Enter a category name.');

      state.categories.push({
        name,
        type: $('newType')?.value || 'expense'
      });

      save();
      render();
      toast('Category added');
    });
  }

  if ($('date')) $('date').value = today;
  setType(state.currentType);
  render();
  show('home');
})();
