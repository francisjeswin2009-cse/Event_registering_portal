/* =========================================================
   CampusEvents: application logic
   Sections: setup, theme, pictures, accounts, events,
   passes, organizer, modals, help, and event wiring
   ========================================================= */

/* ---------- Setup ---------- */
const KEY = 'campus-events-v4';
const CATS = ['Fest', 'Workshop', 'Seminar', 'Competition'];
const ACCENTS = ['#b4442a', '#1f5f8b', '#2f5d3a', '#7a3e6b', '#c9a24a', '#0ea5e9'];
const PRESETS = {
  Editorial: {accent: '#b4442a', paper: '#f6f3ec'},
  Ocean:     {accent: '#1f5f8b', paper: '#eef4f8'},
  Forest:    {accent: '#2f5d3a', paper: '#f1f5ee'},
  Plum:      {accent: '#7a3e6b', paper: '#f7f1f5'},
  Midnight:  {accent: '#c9a24a', paper: '#0f1220'}
};
const DEFAULTS = {accent: PRESETS.Editorial.accent, paper: null, font: 'serif', dark: false, radius: 6, density: 'comfortable'};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const seatsLeft = e => e.capacity - e.regs.length;
const initials = name => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const findEvent = id => db.events.find(e => e.id === id);
const currentUser = () => db.accounts.find(a => a.email === db.user) || null;

const seed = {
  events: [
    {id: uid(), title: 'TechFest 2026', category: 'Fest', date: '2026-11-14', time: '09:00', venue: 'Main Auditorium', eligibility: 'Open to all students', description: 'Three days of talks, showcases and live demos from student builders.', capacity: 120, regs: [], image: 'images/demo-techfest.svg'},
    {id: uid(), title: 'Intro to Machine Learning', category: 'Workshop', date: '2026-11-20', time: '14:00', venue: 'Lab 3, CS Block', eligibility: 'Second year and above', description: 'A hands-on afternoon with datasets, notebooks and a first model.', capacity: 30, regs: [], image: 'images/demo-ml.svg'},
    {id: uid(), title: 'Careers in Climate Tech', category: 'Seminar', date: '2026-11-26', time: '11:00', venue: 'Seminar Hall B', eligibility: 'All students', description: 'Alumni panel on the roles shaping the clean energy transition.', capacity: 80, regs: [], image: 'images/demo-climate.svg'},
    {id: uid(), title: 'Hackathon Sprint', category: 'Competition', date: '2026-12-02', time: '10:00', venue: 'Innovation Hub', eligibility: 'Teams of two to four', description: 'Twenty-four hours to build something useful, with mentors on hand.', capacity: 40, regs: [], image: 'images/demo-hackathon.svg'}
  ],
  accounts: [{name: 'Campus Admin', email: 'admin@campus.edu', pass: 'admin123', role: 'organizer', sid: 'ORG-001'}],
  user: null,
  settings: {...DEFAULTS}
};

let db;
try { db = JSON.parse(localStorage.getItem(KEY)) || seed; } catch { db = seed; }
db.settings = {...DEFAULTS, ...db.settings};
db.accounts = db.accounts || [];

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };

function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(t.hideTimer);
  t.hideTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Theme and customization ---------- */
// Relative brightness of a #rrggbb color (0 = black, 1 = white)
function brightness(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

function applySettings() {
  const s = db.settings;
  const paper = s.paper || (s.dark ? '#100f0c' : '#f6f3ec');
  const ink = brightness(paper) > 0.55 ? '#1a1814' : '#f1ece1'; // text automatically contrasts with background
  const style = document.documentElement.style;

  style.setProperty('--paper', paper);
  style.setProperty('--ink', ink);
  style.setProperty('--accent', s.accent);
  style.setProperty('--card', `color-mix(in srgb, ${paper} 94%, ${ink})`);
  style.setProperty('--tint', `color-mix(in srgb, ${paper} 88%, ${ink})`);
  style.setProperty('--line', `color-mix(in srgb, ${paper} 80%, ${ink})`);
  style.setProperty('--muted', `color-mix(in srgb, ${ink} 55%, ${paper})`);
  style.setProperty('--radius', s.radius + 'px');
  style.setProperty('--gap', s.density === 'compact' ? '18px' : '28px');
  style.setProperty('--head', {
    serif: "'Fraunces', Georgia, serif",
    sans: "'Inter', system-ui, sans-serif",
    mono: "ui-monospace, Menlo, monospace"
  }[s.font]);

  syncControls(paper);
  renderPreview();
}

// Make the sidebar controls show the current settings
function syncControls(paper) {
  const s = db.settings;
  $('accentPick').value = s.accent;
  $('paperPick').value = paper;
  $('fontSel').value = s.font;
  $('radius').value = s.radius;
  $('radiusVal').textContent = s.radius + 'px';
  $('density').value = s.density;
  $('darkToggle').checked = s.dark;
  document.querySelectorAll('.sw').forEach(el => el.classList.toggle('on', el.dataset.c === s.accent));
  document.querySelectorAll('.preset').forEach(el => {
    const p = PRESETS[el.dataset.preset];
    el.classList.toggle('on', p.accent === s.accent && p.paper === s.paper);
  });
}

function updateSetting(patch) {
  db.settings = {...db.settings, ...patch};
  save();
  applySettings();
}

/* ---------- Event pictures ---------- */
let pendingImage = '';

// Shrinks an uploaded picture to 800px and returns it as a compact JPEG data URL
function readPicture(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, 800 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function setPreview(src) {
  pendingImage = src;
  $('picPreview').innerHTML = src ? `<img src="${src}" alt="Event picture preview">` : '<span>No picture yet</span>';
}

async function pickFile(input, done) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return toast('Please choose an image file.');
  try { done(await readPicture(file)); } catch { toast('That picture could not be read.'); }
}

// Illustration drawn in the category's style and tinted with the accent color
function cover(category, key) {
  const n = key.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const ox = 120 + (n % 160), oy = 90 + (n % 110);
  let art = '';

  if (category === 'Fest') {
    for (let i = 0; i < 36; i++) {
      const a = i * Math.PI / 18;
      art += `<line x1="${ox}" y1="${oy}" x2="${ox + 600 * Math.cos(a)}" y2="${oy + 600 * Math.sin(a)}" stroke="var(--accent)" stroke-width="1.2" opacity=".35"/>`;
    }
    art += `<circle cx="${ox}" cy="${oy}" r="70" fill="var(--accent)"/><circle cx="${ox}" cy="${oy}" r="38" fill="var(--card)"/>`;
  } else if (category === 'Workshop') {
    for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) {
      const filled = (r * 8 + c + n) % 7 === 0;
      art += `<rect x="${20 + c * 48}" y="${20 + r * 42}" width="40" height="34" rx="3" fill="${filled ? 'var(--accent)' : 'none'}" stroke="var(--accent)" stroke-opacity=".45"/>`;
    }
  } else if (category === 'Seminar') {
    for (let r = 20; r < 340; r += 26) art += `<circle cx="${ox}" cy="${oy}" r="${r}" fill="none" stroke="var(--accent)" stroke-opacity="${0.9 - r / 400}"/>`;
    art += `<circle cx="${ox}" cy="${oy}" r="12" fill="var(--accent)"/>`;
  } else {
    for (let i = -6; i < 16; i++) art += `<line x1="${i * 44}" y1="0" x2="${i * 44 + 300}" y2="300" stroke="var(--accent)" stroke-width="${i % 3 ? 1 : 10}" opacity="${i % 3 ? 0.3 : 0.85}"/>`;
  }
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><rect width="400" height="300" fill="var(--tint)"/>${art}</svg>`;
}

// Event picture when one is set, illustration underneath as a fallback
function coverOf(e) {
  return cover(e.category, e.id) + (e.image ? `<img src="${esc(e.image)}" alt="" onerror="this.remove()">` : '');
}

function heroArt() {
  return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
    <rect width="400" height="400" fill="var(--tint)"/>
    <path d="M0 400 A400 400 0 0 1 400 0 L400 400Z" fill="var(--accent)" opacity=".92"/>
    <path d="M0 400 A280 280 0 0 1 280 120 L280 400Z" fill="var(--card)" opacity=".85"/>
    <circle cx="300" cy="300" r="46" fill="var(--ink)"/>
    <path d="M40 360 L120 300 L200 340" stroke="var(--ink)" stroke-width="2" fill="none" opacity=".5"/>
  </svg>`;
}

/* ---------- Accounts and profile ---------- */
function renderProfile() {
  const u = currentUser();
  $('profile').innerHTML = u
    ? `<div class="avatar">${esc(initials(u.name))}</div>
       <div><b>${esc(u.name)}</b><small>${u.role === 'organizer' ? 'Organizer' : 'Student'} · ${esc(u.email)}</small>
       <button class="link" data-act="logout">Sign out</button></div>`
    : `<div class="avatar guest">?</div>
       <div><b>Guest</b><small>Sign in to reserve seats</small>
       <button class="link" data-act="auth">Sign in or create account</button></div>`;
}

function openAuth(mode = 'signin') {
  const signup = mode === 'signup';
  openModal(`<div class="eyebrow">${signup ? 'New account' : 'Welcome back'}</div>
    <h2>${signup ? 'Create your account' : 'Sign in'}</h2>
    <form id="authForm">
      ${signup ? '<div class="field"><label>Full name</label><input name="name" required></div>' : ''}
      <div class="field"><label>Email</label><input name="email" type="email" required></div>
      <div class="field"><label>Password</label><input name="pass" type="password" minlength="6" required></div>
      ${signup
        ? `<div class="row2">
             <div class="field"><label>Role</label><select name="role"><option value="student">Student</option><option value="organizer">Organizer</option></select></div>
             <div class="field"><label>Student ID</label><input name="sid"></div>
           </div>`
        : '<p class="muted" style="font-size:.85rem">Demo organizer: admin@campus.edu / admin123</p>'}
      <div class="actions">
        <button type="button" class="btn ghost" data-act="authSwitch" data-mode="${signup ? 'signin' : 'signup'}">${signup ? 'I already have an account' : 'Create account'}</button>
        <button class="btn">${signup ? 'Create account' : 'Sign in'}</button>
      </div>
    </form>`);

  $('authForm').onsubmit = ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    const email = f.email.trim().toLowerCase();

    if (signup) {
      if (db.accounts.some(a => a.email === email)) return toast('An account with this email already exists.');
      db.accounts.push({name: f.name.trim(), email, pass: f.pass, role: f.role, sid: f.sid.trim() || 'N/A'});
      db.user = email;
      toast(`Welcome, ${f.name.trim()}.`);
    } else {
      const account = db.accounts.find(a => a.email === email && a.pass === f.pass);
      if (!account) return toast('Incorrect email or password.');
      db.user = email;
      toast(`Signed in as ${account.name}.`);
    }
    save();
    closeModal();
    renderAll();
  };
}

function signOut() {
  db.user = null;
  save();
  renderAll();
  toast('You have been signed out.');
}

/* ---------- Rendering: explore ---------- */
let filter = '';

function renderChips() {
  $('chips').innerHTML = ['', ...CATS]
    .map(c => `<button class="chip ${filter === c ? 'on' : ''}" data-cat="${c}">${c || 'All'}</button>`)
    .join('');
}

function eventCard(e) {
  const d = new Date(e.date + 'T' + e.time);
  const left = seatsLeft(e);
  const full = left <= 0;
  const pct = Math.min(100, e.regs.length / e.capacity * 100);

  return `<article class="ev">
    <div class="cover">${coverOf(e)}
      <div class="date-tag"><b>${d.getDate()}</b><span>${d.toLocaleString([], {month: 'short'})}</span></div>
    </div>
    <div class="body">
      <div class="kicker">${esc(e.category)}</div>
      <h3>${esc(e.title)}</h3>
      <div class="info">${esc(e.venue)} · ${d.toLocaleString([], {weekday: 'short', hour: 'numeric', minute: '2-digit'})}<br>${esc(e.eligibility)}</div>
      <div class="info" style="flex:1">${esc(e.description)}</div>
      <div class="info">${full ? 'Fully booked' : left + ' of ' + e.capacity + ' seats open'}</div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <button class="btn block" data-act="reg" data-id="${e.id}" ${full ? 'disabled' : ''}>${full ? 'Fully booked' : 'Reserve a seat →'}</button>
    </div>
  </article>`;
}

function renderEvents() {
  const q = $('search').value.trim().toLowerCase();
  const list = db.events.filter(e =>
    (!filter || e.category === filter) &&
    (!q || [e.title, e.venue, e.category].join(' ').toLowerCase().includes(q)));

  $('eventGrid').innerHTML = list.length
    ? list.map(eventCard).join('')
    : '<div class="locked" style="grid-column:1/-1"><h2>No events match</h2><p class="muted">Try another category or search term.</p></div>';
}

function renderHero() {
  $('heroArt').innerHTML = heroArt() + '<img src="images/hero.jpg" alt="" onerror="this.remove()">';
  $('hEvents').textContent = db.events.length;
  $('hSeats').textContent = db.events.reduce((sum, e) => sum + Math.max(0, seatsLeft(e)), 0);
  $('hRegs').textContent = db.events.reduce((sum, e) => sum + e.regs.length, 0);
}

/* ---------- Rendering: passes ---------- */
function lockedMessage(title, text, buttonLabel = '') {
  return `<div class="locked"><h2>${title}</h2><p class="muted">${text}</p>
    ${buttonLabel ? `<button class="btn" data-act="auth">${buttonLabel}</button>` : ''}</div>`;
}

function renderPasses() {
  const u = currentUser();
  if (!u) {
    $('passWrap').innerHTML = lockedMessage('Sign in to see your passes', 'Your confirmation tickets appear here after you reserve a seat.', 'Sign in');
    return;
  }

  const rows = [];
  db.events.forEach(e => e.regs.forEach(r => { if (r.email === u.email) rows.push({e, r}); }));

  $('passWrap').innerHTML = rows.length
    ? `<table>
        <thead><tr><th>Event</th><th>When</th><th>Code</th><th></th></tr></thead>
        <tbody>${rows.map(({e, r}) => `<tr>
          <td><b style="font-family:var(--head);font-weight:500">${esc(e.title)}</b></td>
          <td class="muted">${esc(new Date(e.date + 'T' + e.time).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'}))}</td>
          <td class="code">${r.code}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn sm ghost" data-act="slip" data-id="${e.id}" data-code="${r.code}">View pass</button>
            <button class="btn sm danger" data-act="cancel" data-id="${e.id}" data-code="${r.code}">Cancel</button>
          </td></tr>`).join('')}</tbody>
      </table>`
    : lockedMessage('No passes yet', 'Reserve a seat on the Explore page and it will appear here.');
}

/* ---------- Rendering: organizer ---------- */
function renderOrganizer() {
  const u = currentUser();
  const isOrganizer = Boolean(u && u.role === 'organizer');
  $('orgLocked').classList.toggle('hidden', isOrganizer);
  $('orgContent').classList.toggle('hidden', !isOrganizer);
  if (!isOrganizer) {
    $('orgLocked').innerHTML = u
      ? lockedMessage('Organizer access only', 'Your account is a student account. Create an organizer account to publish and manage events.')
      : lockedMessage('Organizer sign-in', 'Sign in with an organizer account to publish and manage events.', 'Sign in');
    return;
  }

  const total = db.events.reduce((sum, e) => sum + e.regs.length, 0);
  const capacity = db.events.reduce((sum, e) => sum + e.capacity, 0);
  $('sEvents').textContent = db.events.length;
  $('sRegs').textContent = total;
  $('sFill').textContent = (capacity ? Math.round(total / capacity * 100) : 0) + '%';
  $('sFull').textContent = db.events.filter(e => seatsLeft(e) <= 0).length;

  $('orgRows').innerHTML = db.events.length
    ? db.events.map(e => `<tr>
        <td><div class="title-cell">
          <div class="thumb">${e.image ? `<img src="${esc(e.image)}" alt="">` : ''}</div>
          <div><b style="font-family:var(--head);font-weight:500">${esc(e.title)}</b>
          <div class="muted">${esc(e.category)} · ${esc(e.venue)}</div></div>
        </div></td>
        <td>${e.regs.length} / ${e.capacity}</td>
        <td style="text-align:right;white-space:nowrap">
          <label class="btn sm ghost" style="cursor:pointer">Picture
            <input type="file" accept="image/*" data-pic="${e.id}" hidden>
          </label>
          <button class="btn sm danger" data-act="del" data-id="${e.id}">Delete</button>
        </td></tr>`).join('')
    : '<tr><td colspan="3" class="muted" style="text-align:center;padding:30px">No events yet. Publish your first one.</td></tr>';
}

function renderPreview() {
  const sample = db.events[0];
  $('live').innerHTML = `
    <div>${sample ? eventCard(sample) : '<p class="muted">Publish an event to see it here.</p>'}</div>
    <div class="live-palette">
      <div class="chipcolor" style="background:var(--accent);color:#fff">Accent color</div>
      <div class="chipcolor" style="background:var(--paper);color:var(--ink);border:1px solid var(--line)">Background and text</div>
      <div class="chipcolor" style="background:var(--card);color:var(--ink);border:1px solid var(--line)">Cards and panels</div>
      <div class="chipcolor" style="background:var(--ink);color:var(--paper)">Primary buttons</div>
    </div>`;
}

function renderAll() {
  renderProfile();
  renderChips();
  renderEvents();
  renderHero();
  renderPasses();
  renderOrganizer();
  renderPreview();
}

/* ---------- Modals ---------- */
const openModal = html => { $('modal').innerHTML = html; $('overlay').classList.add('show'); };
const closeModal = () => $('overlay').classList.remove('show');

function openRegister(id) {
  const e = findEvent(id);
  const u = currentUser();
  if (!e) return;
  if (!u) return openAuth('signin');
  if (seatsLeft(e) <= 0) return toast('This event is fully booked.');
  if (e.regs.some(r => r.email === u.email)) return toast('You are already registered for this event.');

  openModal(`<div class="eyebrow">${esc(e.category)}</div>
    <h2>${esc(e.title)}</h2>
    <p class="muted">${esc(new Date(e.date + 'T' + e.time).toLocaleString([], {dateStyle: 'full', timeStyle: 'short'}))} · ${esc(e.venue)}</p>
    <div class="ticket">
      <div class="info">Reserving as</div>
      <div class="big" style="font-family:var(--head);font-size:1.4rem">${esc(u.name)}</div>
      <div class="info">Student ID ${esc(u.sid)} · ${esc(u.email)}</div>
    </div>
    <p class="muted" style="font-size:.85rem">${seatsLeft(e)} of ${e.capacity} seats remain.</p>
    <div class="actions">
      <button class="btn ghost" data-act="close">Back</button>
      <button class="btn" data-act="confirmReg" data-id="${id}">Confirm seat</button>
    </div>`);
}

function confirmRegister(id) {
  const e = findEvent(id);
  const u = currentUser();
  if (!e || !u) return;
  if (seatsLeft(e) <= 0) { toast('Sorry, this event just filled up.'); return closeModal(); }
  if (e.regs.some(r => r.email === u.email)) return toast('You are already registered for this event.');

  const reg = {code: uid(), name: u.name, sid: u.sid, email: u.email};
  e.regs.push(reg);
  save();
  renderAll();
  showSlip(id, reg.code);
  toast('You are registered.');
}

function showSlip(id, code) {
  const e = findEvent(id);
  const r = e && e.regs.find(x => x.code === code);
  if (!r) return;

  openModal(`<div id="slipArea">
      <div class="eyebrow">Confirmation</div>
      <h2>You're in.</h2>
      <div class="ticket">
        <div class="code">${r.code}</div>
        <div style="font-family:var(--head);font-size:1.5rem">${esc(e.title)}</div>
        <div class="info">${esc(r.name)} · ID ${esc(r.sid)}</div>
        <div class="info">${esc(new Date(e.date + 'T' + e.time).toLocaleString([], {dateStyle: 'full', timeStyle: 'short'}))}<br>${esc(e.venue)}</div>
      </div>
    </div>
    <div class="actions">
      <button class="btn ghost" data-act="txt" data-id="${id}" data-code="${code}">Download</button>
      <button class="btn ghost" data-act="print">Print</button>
      <button class="btn" data-act="close">Done</button>
    </div>`);
}

function downloadPass(id, code) {
  const e = findEvent(id);
  const r = e.regs.find(x => x.code === code);
  const text = `CAMPUS EVENT CONFIRMATION\n\nCode: ${r.code}\nEvent: ${e.title}\nName: ${r.name}\nStudent ID: ${r.sid}\nWhen: ${new Date(e.date + 'T' + e.time).toLocaleString()}\nVenue: ${e.venue}\n`;
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([text], {type: 'text/plain'})),
    download: `pass-${r.code}.txt`
  });
  link.click();
}

function cancelRegistration(id, code) {
  if (!confirm('Cancel this registration? Your seat will be released.')) return;
  const e = findEvent(id);
  e.regs = e.regs.filter(r => r.code !== code);
  save();
  renderAll();
  toast('Registration cancelled.');
}

function deleteEvent(id) {
  if (!confirm('Delete this event and all of its registrations?')) return;
  db.events = db.events.filter(e => e.id !== id);
  save();
  renderAll();
  toast('Event removed.');
}

function openHelp() {
  openModal(`<div class="eyebrow">Help center</div>
    <h2>How can we help?</h2>
    <p class="muted" style="margin:8px 0 14px">CampusEvents lets students find and reserve seats at campus events, and lets organizers publish and manage them.</p>

    <details open><summary>What this application does</summary>
      <p>Students browse fests, workshops, seminars and competitions, reserve a seat, and get a confirmation ticket. Organizers publish events, set seat limits, add pictures, and track registrations. Everything runs in your browser.</p>
    </details>

    <details><summary>How do I register for an event?</summary>
      <ul>
        <li>Sign in or create a student account from the profile card on the left.</li>
        <li>Go to Explore, choose an event and click Reserve a seat.</li>
        <li>Confirm the seat. Your ticket appears, and you can download or print it.</li>
        <li>Find all your tickets under My Passes.</li>
      </ul>
    </details>

    <details><summary>How do I publish an event?</summary>
      <ul>
        <li>Sign in with an organizer account. Demo: admin@campus.edu / admin123.</li>
        <li>Open Organizer and complete the four sections: basics, schedule and venue, details, and picture.</li>
        <li>Click Publish event. To change a picture later, use the Picture button in the event table.</li>
      </ul>
    </details>

    <details><summary>How do I customize the look?</summary>
      <ul>
        <li>Open Customize. The options appear in the left panel.</li>
        <li>Pick a theme preset, or choose your own accent and background colors.</li>
        <li>Adjust typography, corner radius, card density and dark mode. Use Reset to return to the default theme.</li>
      </ul>
    </details>

    <details><summary>Something is not working. What should I try?</summary>
      <ul>
        <li><b>Sign-in fails:</b> check the email and password. Passwords are case-sensitive.</li>
        <li><b>Event shows Fully booked:</b> the seat limit has been reached. Cancel an existing pass to free a seat, or ask the organizer to raise the limit.</li>
        <li><b>Already registered:</b> each account can reserve one seat per event.</li>
        <li><b>Pictures do not show:</b> keep the images folder next to index.html, with the same file names. Use JPG or PNG files.</li>
        <li><b>Layout looks plain:</b> keep index.html, style.css, script.js and the images folder together in one folder.</li>
        <li><b>Data disappeared:</b> data is stored in the browser you used. Clearing site data or switching browsers starts fresh.</li>
      </ul>
    </details>

    <details><summary>Is my data secure?</summary>
      <p>No. This is a demonstration. Accounts and passwords are stored in your browser without encryption. A real deployment needs a server, encrypted passwords and a secure login system.</p>
    </details>

    <div class="actions"><button class="btn" data-act="close">Close</button></div>`);
}

/* ---------- Views ---------- */
function switchView(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('show', v.id === name));
  $('app').classList.toggle('custom', name === 'customize');
  window.scrollTo({top: 0, behavior: 'smooth'});
}

/* ---------- Event wiring ---------- */
document.addEventListener('click', e => {
  if (e.target.id === 'overlay') return closeModal();

  const tab = e.target.closest('.tab');
  if (tab) return switchView(tab.dataset.view);

  const chip = e.target.closest('.chip');
  if (chip) { filter = chip.dataset.cat; renderChips(); renderEvents(); return; }

  const preset = e.target.closest('[data-preset]');
  if (preset) {
    const p = PRESETS[preset.dataset.preset];
    return updateSetting({accent: p.accent, paper: p.paper});
  }

  const swatch = e.target.closest('.sw');
  if (swatch) return updateSetting({accent: swatch.dataset.c});

  const button = e.target.closest('[data-act]');
  if (!button) return;
  const {act, id, code, mode} = button.dataset;

  switch (act) {
    case 'reg': return openRegister(id);
    case 'confirmReg': return confirmRegister(id);
    case 'slip': return showSlip(id, code);
    case 'txt': return downloadPass(id, code);
    case 'print': return window.print();
    case 'cancel': return cancelRegistration(id, code);
    case 'del': return deleteEvent(id);
    case 'auth': return openAuth('signin');
    case 'authSwitch': return openAuth(mode);
    case 'logout': return signOut();
    case 'help': return openHelp();
    case 'close': return closeModal();
    case 'resetPaper': return updateSetting({paper: null});
    case 'resetAll':
      db.settings = {...DEFAULTS};
      save();
      applySettings();
      return toast('Theme reset to defaults.');
  }
});

document.addEventListener('change', e => {
  const target = e.target;
  if (target.matches('input[data-pic]')) {
    const id = target.dataset.pic;
    pickFile(target, src => {
      const ev = findEvent(id);
      if (!ev) return;
      ev.image = src;
      save();
      renderAll();
      toast('Event picture updated.');
    });
  }
});

$('picInput').onchange = e => pickFile(e.target, setPreview);

$('createForm').onsubmit = ev => {
  ev.preventDefault();
  const f = Object.fromEntries(new FormData(ev.target));
  const capacity = parseInt(f.capacity, 10);
  if (!(capacity > 0)) return toast('Seat limit must be at least 1.');

  db.events.push({
    id: uid(), title: f.title.trim(), category: f.category, date: f.date, time: f.time,
    venue: f.venue.trim(), eligibility: f.eligibility.trim() || 'Open to all',
    description: f.description.trim(), capacity, regs: [], image: pendingImage
  });
  save();
  ev.target.reset();
  ev.target.capacity.value = 50;
  ev.target.time.value = '10:00';
  setPreview('');
  renderAll();
  toast('Event published.');
};

$('search').oninput = renderEvents;

$('accentPick').addEventListener('input', e => updateSetting({accent: e.target.value}));
$('paperPick').addEventListener('input', e => updateSetting({paper: e.target.value}));
$('radius').addEventListener('input', e => updateSetting({radius: Number(e.target.value)}));
$('fontSel').addEventListener('change', e => updateSetting({font: e.target.value}));
$('density').addEventListener('change', e => updateSetting({density: e.target.value}));
$('darkToggle').addEventListener('change', e => updateSetting({dark: e.target.checked, paper: null}));

// Keep other open tabs in sync
window.addEventListener('storage', e => {
  if (e.key !== KEY) return;
  try { db = JSON.parse(e.newValue); } catch { return; }
  db.settings = {...DEFAULTS, ...db.settings};
  renderAll();
  applySettings();
});

/* ---------- Start ---------- */
$('swatches').innerHTML = ACCENTS.map(c => `<div class="sw" data-c="${c}" style="background:${c}"></div>`).join('');
$('presets').innerHTML = Object.entries(PRESETS)
  .map(([name, p]) => `<button class="preset" data-preset="${name}"><i style="background:${p.accent}"></i>${name}</button>`)
  .join('');

applySettings();
renderAll();