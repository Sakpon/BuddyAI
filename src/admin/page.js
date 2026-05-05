// Single-page admin portal for FinBot. Served from /admin on the worker.
// Vanilla JS + Tailwind via CDN — no build step, no framework.
// Auth: prompts the operator for CRON_KEY on load and stores it in
// sessionStorage. Every fetch sends Authorization: Bearer <key>.

export function adminPage() {
  return /* html */ `<!doctype html>
<html lang="en" class="h-full bg-slate-100">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>buddyAI · admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; }
    .truncate-userid { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
  </style>
</head>
<body class="h-full text-slate-800">
<div class="max-w-6xl mx-auto p-4">
  <header class="flex items-center justify-between mb-4">
    <div>
      <h1 class="text-xl font-bold text-slate-900">buddyAI · admin</h1>
      <p class="text-xs text-slate-500" id="env-line">loading…</p>
    </div>
    <div class="flex gap-2">
      <button id="refresh-btn" class="px-3 py-1.5 text-xs font-medium rounded bg-slate-900 text-white hover:bg-slate-700">Refresh</button>
      <button id="logout-btn" class="px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 hover:bg-slate-50">Logout</button>
    </div>
  </header>

  <nav class="flex gap-1 border-b border-slate-200 mb-4 text-sm">
    <button data-tab="overview"   class="tab px-3 py-2 font-medium border-b-2 border-transparent">Overview</button>
    <button data-tab="users"      class="tab px-3 py-2 font-medium border-b-2 border-transparent">Users</button>
    <button data-tab="portfolios" class="tab px-3 py-2 font-medium border-b-2 border-transparent">Portfolios</button>
    <button data-tab="journey"    class="tab px-3 py-2 font-medium border-b-2 border-transparent">Journey</button>
    <button data-tab="crons"      class="tab px-3 py-2 font-medium border-b-2 border-transparent">Cron logs</button>
  </nav>

  <main>
    <section id="tab-overview" class="tab-panel"></section>
    <section id="tab-users"      class="tab-panel hidden"></section>
    <section id="tab-portfolios" class="tab-panel hidden"></section>
    <section id="tab-journey"    class="tab-panel hidden"></section>
    <section id="tab-crons"      class="tab-panel hidden"></section>
  </main>
</div>

<script>
const KEY_STORAGE = 'finbot-admin-key';
function getKey() {
  let k = sessionStorage.getItem(KEY_STORAGE);
  if (!k) {
    k = prompt('Enter CRON_KEY (your Cloudflare secret):');
    if (!k) return null;
    sessionStorage.setItem(KEY_STORAGE, k.trim());
  }
  return sessionStorage.getItem(KEY_STORAGE);
}
async function api(path) {
  const k = getKey();
  if (!k) throw new Error('No key');
  const res = await fetch(path, { headers: { authorization: 'Bearer ' + k } });
  if (res.status === 403) {
    sessionStorage.removeItem(KEY_STORAGE);
    throw new Error('Forbidden — wrong CRON_KEY. Reload to retry.');
  }
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text().catch(() => '')));
  return res.json();
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function fmtTs(unix) {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtMoney(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function shortId(id, len = 8) {
  if (!id) return '—';
  return id.length <= len + 3 ? id : id.slice(0, len) + '…' + id.slice(-4);
}

// ─── tabs ────────────────────────────────────────────────────────────
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');
function activate(name) {
  tabs.forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('border-sky-500', on);
    t.classList.toggle('text-sky-600', on);
    t.classList.toggle('text-slate-600', !on);
  });
  panels.forEach((p) => p.classList.toggle('hidden', p.id !== 'tab-' + name));
  if (name === 'overview') loadOverview();
  if (name === 'users') loadUsers();
  if (name === 'portfolios') loadPortfolios();
  if (name === 'journey') renderJourneyForm();
  if (name === 'crons') loadCronLogs();
}
tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.tab)));

document.getElementById('refresh-btn').addEventListener('click', () => {
  const active = [...tabs].find((t) => t.classList.contains('border-sky-500'));
  activate(active ? active.dataset.tab : 'overview');
});
document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem(KEY_STORAGE);
  location.reload();
});

document.getElementById('env-line').textContent = location.host;

// ─── overview ────────────────────────────────────────────────────────
async function loadOverview() {
  const el = document.getElementById('tab-overview');
  el.innerHTML = '<div class="text-sm text-slate-500">Loading…</div>';
  try {
    const data = await api('/admin/api/overview');
    const c = data.counts || {};
    const cards = [
      ['Users',       c.users],
      ['Portfolios',  c.portfolios],
      ['Holdings',    c.holdings],
      ['Messages',    c.messages],
      ['Events',      c.events],
    ];
    el.innerHTML = \`
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        \${cards.map(([k, v]) => \`
          <div class="bg-white rounded shadow-sm p-3">
            <div class="text-xs text-slate-500">\${escapeHtml(k)}</div>
            <div class="text-2xl font-bold text-slate-900">\${escapeHtml(v ?? '—')}</div>
          </div>
        \`).join('')}
      </div>
      <div class="bg-white rounded shadow-sm p-4 text-sm text-slate-600">
        <p class="mb-1"><span class="font-semibold">Latest cron runs</span> — see the <button data-tab="crons" class="tab text-sky-600 underline">Cron logs</button> tab.</p>
        <p>Most-recent events sit at the top of the <button data-tab="users" class="tab text-sky-600 underline">Users</button> table (sorted by last_event_at).</p>
      </div>\`;
    // Re-bind any tab buttons we just rendered.
    el.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => activate(t.dataset.tab)));
  } catch (err) {
    el.innerHTML = \`<div class="text-sm text-red-600">\${escapeHtml(err.message)}</div>\`;
  }
}

// ─── users ───────────────────────────────────────────────────────────
async function loadUsers() {
  const el = document.getElementById('tab-users');
  el.innerHTML = '<div class="text-sm text-slate-500">Loading…</div>';
  try {
    const data = await api('/admin/api/users');
    const rows = (data.users || []).map((u) => \`
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="py-2 px-3"><span class="truncate-userid">\${escapeHtml(shortId(u.user_id, 10))}</span></td>
        <td class="py-2 px-3">\${escapeHtml(u.display_name || '—')}</td>
        <td class="py-2 px-3 text-center">
          \${u.alert_subscribed ? '<span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">alert</span>' : ''}
          \${u.news_subscribed  ? '<span class="px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-xs ml-1">news</span>' : ''}
        </td>
        <td class="py-2 px-3 text-right tabular-nums">\${u.portfolio_count}</td>
        <td class="py-2 px-3 text-right tabular-nums">\${u.message_count}</td>
        <td class="py-2 px-3 text-right tabular-nums">\${u.event_count}</td>
        <td class="py-2 px-3 text-xs text-slate-500">\${escapeHtml(fmtTs(u.last_event_at || u.updated_at))}</td>
        <td class="py-2 px-3 text-right">
          <button class="open-journey text-sky-600 hover:underline text-xs" data-uid="\${escapeHtml(u.user_id)}">journey →</button>
        </td>
      </tr>
    \`).join('');
    el.innerHTML = \`
      <div class="bg-white rounded shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th class="text-left py-2 px-3">User</th>
              <th class="text-left py-2 px-3">Name</th>
              <th class="text-center py-2 px-3">Subs</th>
              <th class="text-right py-2 px-3">Pf</th>
              <th class="text-right py-2 px-3">Msgs</th>
              <th class="text-right py-2 px-3">Events</th>
              <th class="text-left py-2 px-3">Last activity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>\${rows || '<tr><td colspan="8" class="py-4 px-3 text-center text-slate-500">No users</td></tr>'}</tbody>
        </table>
      </div>\`;
    el.querySelectorAll('.open-journey').forEach((b) =>
      b.addEventListener('click', () => {
        document.getElementById('journey-userid').value = b.dataset.uid;
        activate('journey');
        loadJourney(b.dataset.uid);
      }),
    );
  } catch (err) {
    el.innerHTML = \`<div class="text-sm text-red-600">\${escapeHtml(err.message)}</div>\`;
  }
}

// ─── portfolios ──────────────────────────────────────────────────────
async function loadPortfolios() {
  const el = document.getElementById('tab-portfolios');
  el.innerHTML = '<div class="text-sm text-slate-500">Loading…</div>';
  try {
    const data = await api('/admin/api/portfolios');
    const rows = (data.portfolios || []).map((p) => \`
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="py-2 px-3 tabular-nums text-xs text-slate-500">#\${p.id}</td>
        <td class="py-2 px-3 font-medium">\${escapeHtml(p.name || '—')} \${p.is_active ? '<span class="ml-1 px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-xs">active</span>' : ''}</td>
        <td class="py-2 px-3 text-xs text-slate-500">\${escapeHtml(p.source || '—')}</td>
        <td class="py-2 px-3 text-right tabular-nums">\${escapeHtml(fmtMoney(p.total_value))}</td>
        <td class="py-2 px-3 text-right tabular-nums">\${p.holding_count}</td>
        <td class="py-2 px-3 text-xs text-slate-600 max-w-xs truncate" title="\${escapeHtml((p.symbols || []).join(', '))}">\${escapeHtml((p.symbols || []).slice(0, 6).join(' · ')) || '—'}</td>
        <td class="py-2 px-3 text-xs text-slate-500">\${escapeHtml(fmtTs(p.taken_at))}</td>
        <td class="py-2 px-3"><span class="truncate-userid text-slate-500">\${escapeHtml(shortId(p.user_id, 8))}</span></td>
      </tr>
    \`).join('');
    el.innerHTML = \`
      <div class="bg-white rounded shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th class="text-left py-2 px-3">ID</th>
              <th class="text-left py-2 px-3">Name</th>
              <th class="text-left py-2 px-3">Source</th>
              <th class="text-right py-2 px-3">Total</th>
              <th class="text-right py-2 px-3">Hold</th>
              <th class="text-left py-2 px-3">Symbols</th>
              <th class="text-left py-2 px-3">Taken</th>
              <th class="text-left py-2 px-3">User</th>
            </tr>
          </thead>
          <tbody>\${rows || '<tr><td colspan="8" class="py-4 px-3 text-center text-slate-500">No portfolios</td></tr>'}</tbody>
        </table>
      </div>\`;
  } catch (err) {
    el.innerHTML = \`<div class="text-sm text-red-600">\${escapeHtml(err.message)}</div>\`;
  }
}

// ─── journey ─────────────────────────────────────────────────────────
function renderJourneyForm() {
  const el = document.getElementById('tab-journey');
  el.innerHTML = \`
    <div class="bg-white rounded shadow-sm p-3 mb-3 flex gap-2 items-center">
      <input id="journey-userid" type="text" class="flex-1 px-3 py-1.5 border rounded text-sm font-mono" placeholder="LINE userId (Uxxxxxxxxxxxx…)">
      <button id="journey-load" class="px-3 py-1.5 text-xs font-medium rounded bg-sky-600 text-white hover:bg-sky-500">Load</button>
    </div>
    <div id="journey-output" class="text-sm text-slate-500">Pick a user from the Users tab, or paste a userId above.</div>
  \`;
  document.getElementById('journey-load').addEventListener('click', () => {
    const v = document.getElementById('journey-userid').value.trim();
    if (v) loadJourney(v);
  });
  document.getElementById('journey-userid').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('journey-load').click();
  });
}
async function loadJourney(userId) {
  const out = document.getElementById('journey-output');
  out.innerHTML = '<div class="text-sm text-slate-500">Loading…</div>';
  try {
    const data = await api('/admin/api/journey?userId=' + encodeURIComponent(userId) + '&limit=200');
    const events = data.events || [];
    if (!events.length) {
      out.innerHTML = '<div class="text-sm text-slate-500">No events for this user.</div>';
      return;
    }
    const items = events.map((e) => \`
      <div class="flex gap-3 py-2 border-b border-slate-100">
        <div class="text-xs text-slate-500 w-32 shrink-0 tabular-nums">\${escapeHtml(fmtTs(e.created_at))}</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-slate-900">\${escapeHtml(e.type)}</div>
          \${e.payload ? \`<pre class="mt-1 text-xs text-slate-600 bg-slate-50 rounded p-2 overflow-x-auto whitespace-pre-wrap">\${escapeHtml(JSON.stringify(e.payload, null, 2))}</pre>\` : ''}
        </div>
      </div>
    \`).join('');
    out.innerHTML = \`
      <div class="bg-white rounded shadow-sm p-3">
        <div class="text-xs text-slate-500 mb-2">\${events.length} events for <span class="font-mono">\${escapeHtml(shortId(userId, 14))}</span></div>
        \${items}
      </div>\`;
  } catch (err) {
    out.innerHTML = \`<div class="text-sm text-red-600">\${escapeHtml(err.message)}</div>\`;
  }
}

// ─── cron logs ───────────────────────────────────────────────────────
async function loadCronLogs() {
  const el = document.getElementById('tab-crons');
  el.innerHTML = '<div class="text-sm text-slate-500">Loading…</div>';
  try {
    const data = await api('/admin/api/cron-logs');
    const block = (label, blob) => \`
      <div class="bg-white rounded shadow-sm p-4">
        <h3 class="font-semibold text-slate-900 mb-2">\${escapeHtml(label)}</h3>
        \${blob ? \`<pre class="text-xs text-slate-700 bg-slate-50 rounded p-2 overflow-x-auto whitespace-pre-wrap">\${escapeHtml(JSON.stringify(blob, null, 2))}</pre>\` : '<div class="text-sm text-slate-500">no run logged yet</div>'}
      </div>\`;
    el.innerHTML = \`
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        \${block('Daily alert (09:00 BKK)', data.alert)}
        \${block('Daily news (08:00 BKK)', data.news)}
      </div>\`;
  } catch (err) {
    el.innerHTML = \`<div class="text-sm text-red-600">\${escapeHtml(err.message)}</div>\`;
  }
}

// boot
activate('overview');
</script>
</body>
</html>`;
}
