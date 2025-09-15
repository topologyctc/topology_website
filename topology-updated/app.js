
// topology app - static + localStorage DB + role-based views + small chart
const DB_KEY='topology_ctc_v2';

function defaultDB(){
  return {
    users:[
      {id:'u_admin',name:'Admin',email:'admin@topology.edu',password:'admin',role:'admin'},
      {id:'u_teacher',name:'Teacher',email:'teacher@topology.edu',password:'teacher',role:'teacher'},
      {id:'u_student',name:'Student',email:'student@topology.edu',password:'student',role:'student',studentId:'s_default'}
    ],
    students:[
      {id:'s_default',fullName:'Default Student',course:'Intro to IT',phone:'0911000000'}
    ],
    payments:[
      {id:1,studentId:'s_default',studentName:'Default Student',amount:1500,method:'cash',date:new Date().toISOString()}
    ]
  };
}

function loadDB(){ try{ return JSON.parse(localStorage.getItem(DB_KEY)) || defaultDB(); }catch(e){ return defaultDB(); } }
function saveDB(db){ localStorage.setItem(DB_KEY,JSON.stringify(db)); }

// state
let currentUser=null;

// helpers
function el(id){ return document.getElementById(id); }
function formatCurrency(n){ return 'ETB '+(Number(n)||0); }

// navigation building by role
const navLinksDef = [
  {id:'dashboard',label:'Dashboard',roles:['admin','teacher','student']},
  {id:'students',label:'Students',roles:['admin','teacher']},
  {id:'payments',label:'Payments',roles:['admin','teacher','student']},
  {id:'accounts',label:'Accounts',roles:['admin']},
  {id:'profile',label:'Profile',roles:['student']},
  {id:'login',label:'Login',roles:[]}
];

function buildNav(){
  const nav = document.getElementById('nav-links');
  nav.innerHTML='';
  const db = loadDB();
  const role = currentUser? currentUser.role : null;
  navLinksDef.forEach(link=>{
    if(link.roles.length===0 || (role && link.roles.includes(role)) || (!currentUser && link.id==='login')){
      const btn = document.createElement('button');
      btn.textContent = link.label;
      btn.dataset.target = link.id;
      btn.addEventListener('click', ()=> navigateTo(link.id));
      nav.appendChild(btn);
    }
  });
}

function setUserDisplay(){
  const cu = el('current-user');
  if(currentUser) cu.textContent = currentUser.name + ' ('+currentUser.role+')';
  else cu.textContent = 'Not logged in';
  el('logoutBtn').style.display = currentUser ? 'block' : 'none';
}

// navigation & rendering
function navigateTo(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const target = document.getElementById(page);
  if(target) target.classList.add('active');
  document.getElementById('page-title').textContent = page.charAt(0).toUpperCase()+page.slice(1);
  renderPage(page);
}

function renderPage(page){
  if(page==='dashboard') renderDashboard();
  if(page==='students') renderStudents();
  if(page==='payments') renderPayments();
  if(page==='accounts') renderAccounts();
  if(page==='login') renderLogin();
  if(page==='profile') renderProfile();
}

// DASHBOARD
function renderDashboard(){
  const db = loadDB();
  const cardsRow = el('cardsRow');
  cardsRow.innerHTML = `
    <div class="card"><div class="label">Students</div><div class="value">${db.students.length}</div></div>
    <div class="card"><div class="label">Payments (total)</div><div class="value">${formatCurrency(db.payments.reduce((s,p)=>s+p.amount,0))}</div></div>
    <div class="card"><div class="label">Users</div><div class="value">${db.users.length}</div></div>
  `;
  // recent students
  const recent = db.students.slice(-5).reverse();
  el('recentStudents').innerHTML = recent.map(s=>`<li>${s.fullName} — ${s.course}</li>`).join('') || '<li class="muted">No students</li>';
  drawPaymentsChart();
}

// small payments chart (canvas simple bar chart grouped by month)
function drawPaymentsChart(){
  const db = loadDB();
  const canvas = el('paymentsChart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // prepare months data for last 6 months
  const months = [];
  const now = new Date();
  for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i,1); months.push({key: d.toISOString().slice(0,7), label: d.toLocaleString('default',{month:'short'})}); }
  const sums = months.map(m=>0);
  db.payments.forEach(p=>{
    const key = p.date.slice(0,7);
    const idx = months.findIndex(m=>m.key===key);
    if(idx>=0) sums[idx]+=p.amount;
  });
  // draw bars
  const max = Math.max(...sums,1);
  const pad=20; const w=canvas.width; const h=canvas.height;
  const barW = (w - pad*2) / sums.length * 0.7;
  sums.forEach((v,i)=>{
    const x = pad + i * ((w-pad*2)/sums.length) + ((w-pad*2)/sums.length - barW)/2;
    const barH = (v / max) * (h - 40);
    const y = h - pad - barH;
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(x,y,barW,barH);
    ctx.fillStyle = '#222';
    ctx.font = '12px Arial';
    ctx.fillText(months[i].label, x, h - 4);
  });
}

// STUDENTS
function renderStudents(){
  const db = loadDB();
  const wrap = el('studentsTableWrap');
  let html = '<table class="table"><thead><tr><th>Name</th><th>Course</th><th>Phone</th><th>Actions</th></tr></thead><tbody>';
  db.students.forEach(s=>{
    html+=`<tr><td>${s.fullName}</td><td>${s.course}</td><td>${s.phone}</td><td><button class="btn small" data-edit="${s.id}">Edit</button> <button class="btn small" data-del="${s.id}">Delete</button></td></tr>`;
  });
  html+='</tbody></table>';
  wrap.innerHTML = html;
  // fill form handlers
  const form = document.getElementById('studentForm');
  form.onsubmit = function(e){ e.preventDefault(); const f=Object.fromEntries(new FormData(form).entries()); const db=loadDB(); const id='s'+Date.now(); db.students.push({id, ...f}); saveDB(db); renderStudents(); renderDashboard(); form.reset(); };
  // edit / delete handlers
  wrap.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click', ()=>{ const id=btn.dataset.del; const db=loadDB(); db.students=db.students.filter(s=>s.id!==id); // also remove payments of that student
    db.payments=db.payments.filter(p=>p.studentId!==id); saveDB(db); renderStudents(); renderDashboard(); }));
  wrap.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click', ()=>{
    const id=btn.dataset.edit; const db=loadDB(); const s=db.students.find(x=>x.id===id);
    if(!s) return; // populate form for quick edit (simple)
    document.querySelector('#studentForm input[name="fullName"]').value = s.fullName;
    document.querySelector('#studentForm input[name="course"]').value = s.course;
    document.querySelector('#studentForm input[name="phone"]').value = s.phone;
    // on submit, if editing existing id, replace - for simplicity we will delete old and re-add new with same id
    document.getElementById('studentForm').onsubmit = function(ev){ ev.preventDefault(); const f=Object.fromEntries(new FormData(ev.target).entries()); s.fullName=f.fullName; s.course=f.course; s.phone=f.phone; saveDB(db); renderStudents(); renderDashboard(); ev.target.reset(); // restore default handler
      document.getElementById('studentForm').onsubmit = null; renderStudents();
    };
  }));
}

// PAYMENTS
function renderPayments(){
  const db = loadDB();
  const select = el('payStudent');
  select.innerHTML = db.students.map(s=>`<option value="${s.id}">${s.fullName} — ${s.course}</option>`).join('') || '<option value="">No students</option>';
  const paymentsList = el('paymentsList');
  paymentsList.innerHTML = db.payments.slice().reverse().map(p=>`<li>${p.studentName} — ${formatCurrency(p.amount)} — ${new Date(p.date).toLocaleString()}</li>`).join('') || '<li class="muted">No payments</li>';
  const form = el('paymentForm');
  form.onsubmit = function(e){ e.preventDefault(); const f=Object.fromEntries(new FormData(form).entries()); const db=loadDB(); const student=db.students.find(s=>s.id===f.studentId); if(!student){ alert('Select a student'); return;} const rec={id:'p'+Date.now(), studentId:f.studentId, studentName:student.fullName, amount: Number(f.amount), method:f.method, date:new Date().toISOString()}; db.payments.push(rec); saveDB(db); renderPayments(); renderDashboard(); form.reset(); };
}

// ACCOUNTS
function renderAccounts(){
  const db = loadDB();
  const wrap = el('usersTableWrap');
  let html = '<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead><tbody>';
  db.users.forEach(u=> html+=`<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.role!=='admin'?'<button class="btn small" data-remove="'+u.id+'">Remove</button>':''}</td></tr>`);
  html+='</tbody></table>';
  wrap.innerHTML = html;
  // register handler
  const form = document.getElementById('registerForm');
  form.onsubmit = function(e){ e.preventDefault(); const f=Object.fromEntries(new FormData(form).entries()); const db=loadDB(); if(db.users.find(x=>x.email===f.email)){ alert('Email exists'); return;} const id='u'+Date.now(); const user={id,name:f.name,email:f.email,password:f.password,role:f.role}; db.users.push(user); saveDB(db); renderAccounts(); form.reset(); };
  // remove handlers
  wrap.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click', ()=>{ const id=btn.dataset.remove; const db=loadDB(); db.users=db.users.filter(u=>u.id!==id); saveDB(db); renderAccounts(); }));
}

// PROFILE (student)
function renderProfile(){
  if(!currentUser) { el('profileInfo').innerHTML='<p class="muted">Login as student to see profile</p>'; return; }
  if(currentUser.role!=='student'){ el('profileInfo').innerHTML='<p class="muted">Profile available for students only</p>'; return; }
  const db=loadDB(); const student = db.students.find(s=>s.id===currentUser.studentId);
  if(!student) { el('profileInfo').innerHTML='<p class="muted">No student profile found</p>'; return; }
  el('profileInfo').innerHTML = `<p><strong>${student.fullName}</strong></p><p>Course: ${student.course}</p><p>Phone: ${student.phone}</p><h4>Payments</h4><ul>${db.payments.filter(p=>p.studentId===student.id).map(p=>'<li>'+formatCurrency(p.amount)+' — '+new Date(p.date).toLocaleDateString()+'</li>').join('')||'<li class="muted">No payments</li>'}</ul>`;
}

// LOGIN / AUTH
function renderLogin(){
  // nothing special here, login form handled below
}

// init / auth handlers
function init(){
  // set year
  el('year').textContent = new Date().getFullYear();
  // logout
  el('logoutBtn').addEventListener('click', ()=>{ currentUser=null; saveSession(); buildNav(); setUserDisplay(); navigateTo('login'); });
  // login form
  document.getElementById('loginForm').onsubmit = function(e){ e.preventDefault(); const f=Object.fromEntries(new FormData(e.target).entries()); const db=loadDB(); const user=db.users.find(u=>u.email===f.email && u.password===f.password); if(!user){ alert('Invalid credentials'); return; } currentUser=user; saveSession(); buildNav(); setUserDisplay(); navigateTo('dashboard'); };
  // global search
  el('globalSearch').addEventListener('input', (e)=>{ const q=e.target.value.toLowerCase(); if(!q){ renderStudents(); return;} const db=loadDB(); const filtered=db.students.filter(s=> (s.fullName||'').toLowerCase().includes(q) || (s.course||'').toLowerCase().includes(q)); const wrap=el('studentsTableWrap'); wrap.innerHTML = '<table class="table"><thead><tr><th>Name</th><th>Course</th><th>Phone</th></tr></thead><tbody>' + filtered.map(s=>`<tr><td>${s.fullName}</td><td>${s.course}</td><td>${s.phone}</td></tr>`).join('') + '</tbody></table>'; });
  // register form & account maintenance handled in renderAccounts
  // payment form handled in renderPayments
  // restore session
  restoreSession();
  buildNav();
  setUserDisplay();
  // default route
  navigateTo(currentUser? 'dashboard' : 'login');
  // ensure first renders
  renderDashboard();
}

// session save/restore (simple)
function saveSession(){ if(currentUser) localStorage.setItem('topo_user', JSON.stringify(currentUser)); else localStorage.removeItem('topo_user'); }
function restoreSession(){ try{ const s=localStorage.getItem('topo_user'); if(s){ currentUser=JSON.parse(s); } }catch(e){ currentUser=null; } }

// initial DOM wiring for nav clicks to change pages
document.addEventListener('click', function(e){
  if(e.target.matches('[data-nav]')){ e.preventDefault(); navigateTo(e.target.dataset.nav); }
});

// start
init();
