'use strict';

/* ---- Constants ---- */
const STORAGE_KEY   = 'sms_students';
const DELETED_KEY   = 'sms_deleted';
const ROWS_PER_PAGE = 7;

/* ---- Avatar gradient palette ---- */
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#7c3aed,#4f46e5)',
  'linear-gradient(135deg,#0891b2,#0d9488)',
  'linear-gradient(135deg,#059669,#10b981)',
  'linear-gradient(135deg,#d97706,#f59e0b)',
  'linear-gradient(135deg,#8b5cf6,#6366f1)',
  'linear-gradient(135deg,#db2777,#ec4899)',
  'linear-gradient(135deg,#dc2626,#ef4444)',
  'linear-gradient(135deg,#0369a1,#0284c7)',
];

/* ---- State ---- */
let students       = [];
let deletedStudents= [];
let currentPage    = 1;
let currentPage2   = 1;
let editingId      = null;
let deleteTargetId = null;
let displayId      = null;
let filteredData   = [];
let filteredData2  = [];
let modalPhotoData  = null;
let inlinePhotoData = null;
let deptChartInstance = null;

/* ================================================================
   UTILITIES
   ================================================================ */
function saveStudents()    { localStorage.setItem(STORAGE_KEY, JSON.stringify(students)); }
function loadStudents()    { try { students = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { students = []; } }
function saveDeleted()     { localStorage.setItem(DELETED_KEY, JSON.stringify(deletedStudents)); }
function loadDeleted()     { try { deletedStudents = JSON.parse(localStorage.getItem(DELETED_KEY)) || []; } catch { deletedStudents = []; } }
function uid()          { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function avatarGrad(n)  { let h=0; for(let c of n) h=(h*31+c.charCodeAt(0))&0xffff; return AVATAR_GRADIENTS[h%AVATAR_GRADIENTS.length]; }
function escHtml(s)     { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function gpaCls(v)      { return +v>=8?'gpa-high':+v>=6?'gpa-mid':'gpa-low'; }
function statusCls(s)   { return 'status-'+s.toLowerCase().replace(/\s+/g,'-'); }

function showToast(msg, type='success') {
  const icons = {
    success:`<svg class="toast-ico" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error:  `<svg class="toast-ico" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    info:   `<svg class="toast-ico" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `${icons[type]}<span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),400); }, 3200);
}

/* ================================================================
   NAVIGATION — section switching
   ================================================================ */
function switchSection(sectionId) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById('section-' + sectionId);
  if (section) section.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  if (navItem) navItem.classList.add('active');

  /* Render dynamic sections on demand */
  if (sectionId === 'students')     { filteredData2=[...students]; applyFilters2(); }
  if (sectionId === 'reports')      renderReports();
  if (sectionId === 'achievements') renderAchievements();
  if (sectionId === 'deleted')      renderDeletedTable();
}

/* ================================================================
   DARK MODE
   ================================================================ */
function toggleDarkMode() {
  const html = document.documentElement;
  const dark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  localStorage.setItem('sms_theme', dark ? 'light' : 'dark');
  document.getElementById('darkLabel').textContent = dark ? 'Dark Mode' : 'Light Mode';
  const icon = document.getElementById('darkIcon');
  if (!dark) {
    icon.innerHTML = `<circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  } else {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
}

/* ================================================================
   STATS
   ================================================================ */
function updateStats() {
  const total = students.length;
  document.getElementById('statTotal').textContent = total;

  const uniqueDepts = new Set(students.map(s => s.dept).filter(Boolean));
  document.getElementById('statDepts').textContent = uniqueDepts.size;

  const active = students.filter(s => s.status === 'Active').length;
  document.getElementById('statActive').textContent = active;

  const avgGPA = total ? (students.reduce((a, s) => a + parseFloat(s.gpa || 0), 0) / total).toFixed(2) : '0.00';
  document.getElementById('statGPA').textContent = avgGPA;

  const maleCount = students.filter(s => s.gender === 'Male').length;
  document.getElementById('statMale').textContent = maleCount;

  const femaleCount = students.filter(s => s.gender === 'Female').length;
  document.getElementById('statFemale').textContent = femaleCount;

  updateChart();
}

function updateChart() {
  const canvas = document.getElementById('deptChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  // Compute department counts
  const deptCounts = {};
  students.forEach(s => {
    if (s.dept) {
      deptCounts[s.dept] = (deptCounts[s.dept] || 0) + 1;
    }
  });

  const labels = Object.keys(deptCounts);
  const data = Object.values(deptCounts);

  // If no data, render empty
  if (labels.length === 0) {
    labels.push('No Data');
    data.push(1);
  }

  if (deptChartInstance) {
    deptChartInstance.destroy();
  }

  deptChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f43f5e'
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#9ca3af', font: { family: 'Inter', size: 13 } }
        }
      },
      cutout: '65%'
    }
  });
}

/* ================================================================
   FILTER & SORT — Dashboard Table
   ================================================================ */
function applyFilters() {
  updateStats();
  // Filter logic for dashboard table is removed since the table is removed.
}

/* ================================================================
   FILTER & SORT — Students Section Table
   ================================================================ */
function applyFilters2() {
  const q    = document.getElementById('searchInput2').value.trim().toLowerCase();
  const dept = document.getElementById('filterDept2').value;
  const stat = document.getElementById('filterStatus2').value;

  filteredData2 = students.filter(s => {
    const mq = !q || s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const md = !dept || s.dept === dept;
    const ms = !stat || s.status === stat;
    return mq && md && ms;
  });
  currentPage2 = 1;
  renderTable2();
}

function sortData(arr, sort) {
  arr.sort((a,b)=>{
    switch(sort) {
      case 'name-az':  return a.name.localeCompare(b.name);
      case 'name-za':  return b.name.localeCompare(a.name);
      case 'gpa-high': return +b.gpa - +a.gpa;
      case 'gpa-low':  return +a.gpa - +b.gpa;
      case 'newest':   return new Date(b.createdAt)-new Date(a.createdAt);
      default:         return 0;
    }
  });
}

/* ================================================================
   RENDER TABLE (shared helper)
   ================================================================ */
function buildRows(page, start) {
  return page.map((s,i) => {
    const initials = s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const avatarHtml = s.photo
      ? `<div class="avatar"><img src="${s.photo}" class="avatar-photo" alt="${escHtml(initials)}"/></div>`
      : `<div class="avatar" style="background:${avatarGrad(s.name)}">${initials}</div>`;
    return `
      <tr data-id="${s._id}">
        <td>${start+i+1}</td>
        <td>
          <div class="student-cell">
            ${avatarHtml}
            <div><div class="s-name">${escHtml(s.name)}</div><div class="s-email">${escHtml(s.email)}</div></div>
          </div>
        </td>
        <td><code style="font-size:12px;color:#6b7280">${escHtml(s.studentId)}</code></td>
        <td>${escHtml(s.dept)}</td>
        <td>${escHtml(s.year)}</td>
        <td><span class="gpa-badge ${gpaCls(s.gpa)}">${parseFloat(s.gpa).toFixed(1)}</span></td>
        <td><span class="status-badge ${statusCls(s.status)}">${escHtml(s.status)}</span></td>
        <td>
          <div class="action-btns">
            <button class="action-label-btn btn-update" onclick="editStudent('${s._id}')">
              <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="2"/></svg>
              Update
            </button>
            <button class="action-label-btn btn-display" onclick="displayStudent('${s._id}')">
              <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              Display
            </button>
            <button class="action-label-btn btn-delete" onclick="openDeleteModal('${s._id}')">
              <svg viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2"/></svg>
              Delete
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ---- Dashboard table ---- */
function renderTable() {
  // Dashboard table has been removed from HTML. Do nothing here.
  return;
}

/* ---- Students section table ---- */
function renderTable2() {
  const tbody = document.getElementById('studentTableBody2');
  const empty = document.getElementById('emptyState2');
  const tbl   = document.getElementById('studentTable2');

  if (filteredData2.length === 0) {
    tbody.innerHTML=''; empty.classList.add('visible'); tbl.style.display='none';
    document.getElementById('paginationBar2').style.display='none'; return;
  }
  empty.classList.remove('visible'); tbl.style.display='';
  const total = Math.ceil(filteredData2.length/ROWS_PER_PAGE);
  if (currentPage2>total) currentPage2=total;
  const start = (currentPage2-1)*ROWS_PER_PAGE;
  tbody.innerHTML = buildRows(filteredData2.slice(start,start+ROWS_PER_PAGE), start);
  renderPagination('paginationBar2','pageInfo2','pageNumbers2','prevPage2','nextPage2', total, start, filteredData2, 2);
}

function renderPagination(barId, infoId, numsId, prevId, nextId, total, start, data, tableNum) {
  const bar=document.getElementById(barId), info=document.getElementById(infoId);
  const nums=document.getElementById(numsId);
  const prev=document.getElementById(prevId), next=document.getElementById(nextId);
  const page = tableNum===1 ? currentPage : currentPage2;
  if (total<=1){bar.style.display='none';return;}
  bar.style.display='flex';
  info.textContent=`Showing ${start+1}–${Math.min(start+ROWS_PER_PAGE,data.length)} of ${data.length} students`;
  prev.disabled=page===1; next.disabled=page===total;
  nums.innerHTML='';
  for(let p=1;p<=total;p++){
    const b=document.createElement('button'); b.className='page-num'+(p===page?' active':''); b.textContent=p;
    const t=tableNum;
    b.addEventListener('click',()=>{if(t===1){currentPage=p;renderTable();}else{currentPage2=p;renderTable2();}});
    nums.appendChild(b);
  }
}

/* ================================================================
   REPORTS SECTION
   ================================================================ */
function renderReports() {
  const container = document.getElementById('reportsContent');
  if (!container) return;

  const byDept = {}, byYear = {}, byStatus = {};
  students.forEach(s => {
    byDept[s.dept]     = (byDept[s.dept]||0)+1;
    byYear[s.year]     = (byYear[s.year]||0)+1;
    byStatus[s.status] = (byStatus[s.status]||0)+1;
  });

  const makeCard = (title, counts) => {
    const max = Math.max(...Object.values(counts), 1);
    const rows = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([label,n]) =>
      `<div class="report-row">
        <span class="report-label" title="${escHtml(label)}">${escHtml(label)}</span>
        <div class="report-bar-wrap"><div class="report-bar" style="width:${Math.round((n/max)*100)}%"></div></div>
        <span class="report-count">${n}</span>
      </div>`).join('');
    return `<div class="report-card"><h3>${title}</h3>${rows||'<p style="color:var(--text-mute);font-size:13px">No data available.</p>'}</div>`;
  };

  container.innerHTML =
    makeCard('Students by Department', byDept) +
    makeCard('Students by Year', byYear) +
    makeCard('Students by Status', byStatus);
}

/* ================================================================
   ACHIEVEMENTS SECTION
   ================================================================ */
function renderAchievements() {
  const container = document.getElementById('achieveContent');
  if (!container) return;
  const achievers = [...students].filter(s=>+s.gpa>=8.0).sort((a,b)=>+b.gpa-+a.gpa);
  if (achievers.length===0) {
    container.innerHTML = `<div class="achieve-empty">🎓 No students with GPA &ge; 8.0 yet. Add students with high GPAs to see them here.</div>`;
    return;
  }
  container.innerHTML = achievers.map((s,i) => {
    const initials = s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    return `<div class="achieve-card">
      <div class="achieve-rank">${i+1}</div>
      <div class="achieve-avatar" style="background:${avatarGrad(s.name)}">${initials}</div>
      <div class="achieve-name">${medal} ${escHtml(s.name)}</div>
      <div class="achieve-dept">${escHtml(s.dept)} &bull; ${escHtml(s.year)}</div>
      <div class="achieve-gpa">⭐ GPA ${parseFloat(s.gpa).toFixed(1)}</div>
    </div>`;
  }).join('');
}

/* ================================================================
   FORM VALIDATION — Modal
   ================================================================ */
function validateForm() {
  let ok = true;
  const rules = [
    {id:'studentName',   err:'nameError',   msg:'Full name required (min 2 chars).',   check:v=>v.trim().length>=2},
    {id:'studentId',     err:'idError',      msg:'Student ID required.',                check:v=>v.trim().length>=3},
    {id:'studentEmail',  err:'emailError',   msg:'Enter a valid email.',                check:v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())},
    {id:'studentPhone',  err:'phoneError',   msg:'Enter a valid 10-digit phone.',       check:v=>/^\d{10}$/.test(v.trim())},
    {id:'studentDeptForm',err:'deptError',   msg:'Please select a department.',         check:v=>v!==''},
    {id:'studentYear',   err:'yearError',    msg:'Please select a year.',               check:v=>v!==''},
    {id:'studentGPA',    err:'gpaError',     msg:'GPA must be between 0 and 10.',       check:v=>v!==''&&+v>=0&&+v<=10},
    {id:'studentStatus', err:'statusError',  msg:'Please select a status.',             check:v=>v!==''},
  ];
  rules.forEach(({id,err,msg,check})=>{
    const el=document.getElementById(id), errEl=document.getElementById(err);
    if(!check(el.value)){el.classList.add('invalid');errEl.textContent=msg;ok=false;}
    else{el.classList.remove('invalid');errEl.textContent='';}
  });
  /* Gender validation */
  const genderVal = document.querySelector('input[name="studentGender"]:checked');
  const genderErr = document.getElementById('genderError');
  if (!genderVal) { genderErr.textContent='Please select a gender.'; ok=false; }
  else genderErr.textContent='';
  const idVal=document.getElementById('studentId').value.trim();
  const dup=students.find(s=>s.studentId===idVal&&s._id!==editingId);
  if(dup){document.getElementById('studentId').classList.add('invalid');document.getElementById('idError').textContent='Student ID already exists.';ok=false;}
  return ok;
}

/* ================================================================
   FORM VALIDATION — Inline Add Student
   ================================================================ */
function validateInlineForm() {
  let ok=true;
  const rules=[
    {id:'iName',  err:'iNameErr',  msg:'Full name required.',             check:v=>v.trim().length>=2},
    {id:'iId',    err:'iIdErr',    msg:'Student ID required.',            check:v=>v.trim().length>=3},
    {id:'iEmail', err:'iEmailErr', msg:'Enter a valid email.',            check:v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())},
    {id:'iPhone', err:'iPhoneErr', msg:'Enter a valid 10-digit phone.',   check:v=>/^\d{10}$/.test(v.trim())},
    {id:'iDept',  err:'iDeptErr',  msg:'Please select a department.',     check:v=>v!==''},
    {id:'iYear',  err:'iYearErr',  msg:'Please select a year.',           check:v=>v!==''},
    {id:'iGPA',   err:'iGPAErr',   msg:'GPA must be between 0 and 10.',   check:v=>v!==''&&+v>=0&&+v<=10},
    {id:'iStatus',err:'iStatusErr',msg:'Please select a status.',         check:v=>v!==''},
  ];
  rules.forEach(({id,err,msg,check})=>{
    const el=document.getElementById(id),errEl=document.getElementById(err);
    if(!check(el.value)){el.classList.add('invalid');errEl.textContent=msg;ok=false;}
    else{el.classList.remove('invalid');errEl.textContent='';}
  });
  /* Gender validation */
  const genderVal = document.querySelector('input[name="iGender"]:checked');
  const genderErr = document.getElementById('iGenderErr');
  if (!genderVal) { genderErr.textContent='Please select a gender.'; ok=false; }
  else genderErr.textContent='';
  const idVal=document.getElementById('iId').value.trim();
  const dup=students.find(s=>s.studentId===idVal);
  if(dup){document.getElementById('iId').classList.add('invalid');document.getElementById('iIdErr').textContent='Student ID already exists.';ok=false;}
  return ok;
}

function clearModal() {
  document.getElementById('studentForm').reset();
  ['nameError','idError','emailError','phoneError','deptError','yearError','gpaError','statusError','genderError','parentNameError','addressError']
    .forEach(id=>{document.getElementById(id).textContent='';});
  ['studentName','studentId','studentEmail','studentPhone','studentDeptForm','studentYear','studentGPA','studentStatus','studentParentName']
    .forEach(id=>{document.getElementById(id).classList.remove('invalid');});
  /* Uncheck all gender radios */
  document.querySelectorAll('input[name="studentGender"]').forEach(r=>r.checked=false);
  /* Reset photo */
  modalPhotoData = null;
  const prevImg = document.getElementById('photoPreviewImg');
  const prevPh  = document.getElementById('photoPlaceholder');
  const prevClr = document.getElementById('photoClearBtn');
  const inp     = document.getElementById('studentPhoto');
  if(prevImg){ prevImg.src=''; prevImg.style.display='none'; }
  if(prevPh)  prevPh.style.display='flex';
  if(prevClr) prevClr.style.display='none';
  if(inp)     inp.value='';
}
function clearInlineForm() {
  document.getElementById('studentFormInline').reset();
  ['iNameErr','iIdErr','iEmailErr','iPhoneErr','iDeptErr','iYearErr','iGPAErr','iStatusErr','iGenderErr','iParentNameErr','iAddressErr']
    .forEach(id=>{document.getElementById(id).textContent='';});
  ['iName','iId','iEmail','iPhone','iDept','iYear','iGPA','iStatus','iParentName']
    .forEach(id=>{document.getElementById(id).classList.remove('invalid');});
  /* Uncheck all gender radios */
  document.querySelectorAll('input[name="iGender"]').forEach(r=>r.checked=false);
  /* Reset photo */
  inlinePhotoData = null;
  const iImg = document.getElementById('iPhotoPreviewImg');
  const iPh  = document.getElementById('iPhotoPlaceholder');
  const iClr = document.getElementById('iPhotoClearBtn');
  const iInp = document.getElementById('iStudentPhoto');
  if(iImg){ iImg.src=''; iImg.style.display='none'; }
  if(iPh)  iPh.style.display='flex';
  if(iClr) iClr.style.display='none';
  if(iInp) iInp.value='';
}

/* ================================================================
   CRUD — Modal Form (Update via modal)
   ================================================================ */
function handleModalSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;
  const data = {
    name:document.getElementById('studentName').value.trim(),
    studentId:document.getElementById('studentId').value.trim(),
    email:document.getElementById('studentEmail').value.trim(),
    phone:document.getElementById('studentPhone').value.trim(),
    dept:document.getElementById('studentDeptForm').value,
    year:document.getElementById('studentYear').value,
    gpa:parseFloat(document.getElementById('studentGPA').value),
    status:document.getElementById('studentStatus').value,
    gender:(document.querySelector('input[name="studentGender"]:checked')||{}).value || '',
    parentName: document.getElementById('studentParentName').value.trim(),
    address:    document.getElementById('studentAddress').value.trim(),
    photo: modalPhotoData,
  };
    if (editingId) {
    const idx=students.findIndex(s=>s._id===editingId);
    if(idx!==-1){students[idx]={...students[idx],...data, updatedAt: new Date().toISOString()};showToast('Student updated successfully','success');}
    closeAddModal();
  } else {
    students.unshift({_id:uid(),createdAt:new Date().toISOString(),...data});
    showToast('Student added successfully','success');
    closeAddModal();
  }
  saveStudents(); applyFilters();
}

/* ================================================================
   CRUD — Inline Form (Add Student section)
   ================================================================ */
function handleInlineSubmit(e) {
  e.preventDefault();
  if (!validateInlineForm()) return;
  const data = {
    name:document.getElementById('iName').value.trim(),
    studentId:document.getElementById('iId').value.trim(),
    email:document.getElementById('iEmail').value.trim(),
    phone:document.getElementById('iPhone').value.trim(),
    dept:document.getElementById('iDept').value,
    year:document.getElementById('iYear').value,
    gpa:parseFloat(document.getElementById('iGPA').value),
    status:document.getElementById('iStatus').value,
    gender:(document.querySelector('input[name="iGender"]:checked')||{}).value || '',
    parentName: document.getElementById('iParentName').value.trim(),
    address:    document.getElementById('iAddress').value.trim(),
    photo: inlinePhotoData,
  };
  students.unshift({_id:uid(),createdAt:new Date().toISOString(),...data});
  saveStudents(); applyFilters();
  clearInlineForm();
  showToast('Student added successfully','success');
}

/* ================================================================
   EDIT — opens modal pre-filled
   ================================================================ */
function editStudent(id) {
  const s=students.find(st=>st._id===id);
  if(!s) return;
  editingId=id;
  document.getElementById('studentName').value    =s.name;
  document.getElementById('studentId').value      =s.studentId;
  document.getElementById('studentEmail').value   =s.email;
  document.getElementById('studentPhone').value   =s.phone;
  document.getElementById('studentDeptForm').value=s.dept;
  document.getElementById('studentYear').value    =s.year;
  document.getElementById('studentGPA').value     =s.gpa;
  document.getElementById('studentStatus').value  =s.status;
  document.getElementById('studentParentName').value = s.parentName || '';
  document.getElementById('studentAddress').value    = s.address    || '';
  /* Restore gender radio */
  document.querySelectorAll('input[name="studentGender"]').forEach(r=>{ r.checked = r.value === s.gender; });
  /* Restore photo preview if student has a photo */
  modalPhotoData = s.photo || null;
  const prevImg  = document.getElementById('photoPreviewImg');
  const prevPh   = document.getElementById('photoPlaceholder');
  const prevClr  = document.getElementById('photoClearBtn');
  if (s.photo) {
    prevImg.src = s.photo; prevImg.style.display='block';
    prevPh.style.display='none'; prevClr.style.display='flex';
  } else {
    prevImg.src=''; prevImg.style.display='none';
    prevPh.style.display='flex'; prevClr.style.display='none';
  }
  document.getElementById('modalTitle').textContent    ='Edit Student';
  document.getElementById('modalSubtitle').textContent ='Update the student information below';
  document.getElementById('submitBtnText').textContent ='Update Student';
  openAddModal();
}

/* ================================================================
   DISPLAY — Full Student Profile Modal
   ================================================================ */
function displayStudent(id) {
  const s = students.find(st => st._id === id);
  if (!s) return;
  displayId = id;
  const initials  = s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const gpaVal    = parseFloat(s.gpa);
  const gpaFull   = gpaVal.toFixed(2);
  const gpaPerc   = Math.round((gpaVal / 10) * 100);
  const regDate   = s.createdAt
    ? new Date(s.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})
    : '—';
  const statusKey = s.status.toLowerCase().replace(/\s+/g,'-');

  const photoHtml = s.photo
    ? `<img src="${s.photo}" alt="${escHtml(s.name)}" style="width:100%;height:100%;object-fit:cover;"/>`
    : initials;

  document.getElementById('displayModalBody').innerHTML = `
    <!-- ── Hero Banner ── -->
    <div class="profile-hero">
      <div class="profile-photo-outer">
        <div class="profile-photo-avatar" style="${s.photo ? '' : 'background:'+avatarGrad(s.name)}">
          ${photoHtml}
        </div>
        <span class="profile-status-ring status-${statusKey}"></span>
      </div>
      <div class="profile-hero-text">
        <div class="profile-hero-name">${escHtml(s.name)}</div>
        <div class="profile-hero-id"># ${escHtml(s.studentId)}</div>
        <div class="profile-hero-chips">
          <span class="profile-hero-chip">${escHtml(s.dept)}</span>
          <span class="profile-hero-chip">${escHtml(s.year)}</span>
          <span class="profile-hero-chip">${escHtml(s.status)}</span>
        </div>
      </div>
    </div>

    <!-- ── GPA Progress ── -->
    <div class="profile-gpa-section">
      <div class="profile-gpa-label">
        <span>GPA / CGPA Performance</span>
        <span class="gpa-badge ${gpaCls(s.gpa)}">${gpaFull} / 10.0</span>
      </div>
      <div class="profile-gpa-track">
        <div class="profile-gpa-fill ${gpaCls(s.gpa)}" style="width:${gpaPerc}%"></div>
      </div>
    </div>

    <!-- ── Info Cards ── -->
    <div class="profile-cards-grid">
      <div class="profile-info-card">
        <h4 class="profile-card-title">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" stroke-width="2"/></svg>
          Contact
        </h4>
        <div class="profile-info-row"><span class="pil">Email</span><span class="piv"><a href="mailto:${escHtml(s.email)}">${escHtml(s.email)}</a></span></div>
        <div class="profile-info-row"><span class="pil">Phone</span><span class="piv">${escHtml(s.phone)}</span></div>
        <div class="profile-info-row"><span class="pil">Gender</span><span class="piv">${s.gender ? escHtml(s.gender) : '<span style="color:var(--text-mute)">—</span>'}</span></div>
        <div class="profile-info-row"><span class="pil">Registered</span><span class="piv">${regDate}</span></div>
        <div class="profile-info-row"><span class="pil">Parent / Guardian</span><span class="piv">${s.parentName ? escHtml(s.parentName) : '<span style="color:var(--text-mute)">—</span>'}</span></div>
        <div class="profile-info-row"><span class="pil">Address</span><span class="piv" style="text-align:right;white-space:pre-line">${s.address ? escHtml(s.address) : '<span style="color:var(--text-mute)">—</span>'}</span></div>
      </div>
      <div class="profile-info-card">
        <h4 class="profile-card-title">
          <svg viewBox="0 0 24 24" fill="none"><path d="M22 10v6M2 10l10-5 10 5-10 5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 12v5c3 3 9 3 12 0v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Academics
        </h4>
        <div class="profile-info-row"><span class="pil">Department</span><span class="piv">${escHtml(s.dept)}</span></div>
        <div class="profile-info-row"><span class="pil">Year</span><span class="piv">${escHtml(s.year)}</span></div>
        <div class="profile-info-row"><span class="pil">GPA</span><span class="piv"><span class="gpa-badge ${gpaCls(s.gpa)}">${gpaFull}</span></span></div>
        <div class="profile-info-row"><span class="pil">Status</span><span class="piv"><span class="status-badge ${statusCls(s.status)}">${escHtml(s.status)}</span></span></div>
      </div>
    </div>

    <!-- ── Footer Actions ── -->
    <div class="profile-modal-footer">
      <button class="btn-cancel" id="closeDisplayBtn">Close</button>
      <button class="btn-submit" id="displayEditBtn">
        <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="2"/></svg>
        Edit Profile
      </button>
    </div>
  `;

  /* Re-wire action buttons rendered inside dynamic HTML */
  document.getElementById('displayModal').classList.add('open');
  document.getElementById('closeDisplayBtn').addEventListener('click', closeDisplayModal);
  document.getElementById('displayEditBtn').addEventListener('click', () => { const did=displayId; closeDisplayModal(); if(did) editStudent(did); });
}
function closeDisplayModal(){ document.getElementById('displayModal').classList.remove('open'); displayId=null; }

/* ================================================================
   DELETED ITEMS — Soft Delete, Restore, Permanent Delete
   ================================================================ */

/** Update the red badge count on the sidebar nav item */
function updateDeletedBadge() {
  const badge = document.getElementById('deletedBadge');
  if (!badge) return;
  const count = deletedStudents.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-block' : 'none';
}

/** Render the Deleted Items table */
function renderDeletedTable() {
  const tbody = document.getElementById('deletedTableBody');
  const empty = document.getElementById('emptyDeleted');
  const tbl   = document.getElementById('deletedTable');
  if (!tbody) return;

  if (deletedStudents.length === 0) {
    tbody.innerHTML = '';
    empty.classList.add('visible');
    tbl.style.display = 'none';
    return;
  }
  empty.classList.remove('visible');
  tbl.style.display = '';

  tbody.innerHTML = deletedStudents.map((s, i) => {
    const initials = s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const deletedDate = s.deletedAt
      ? new Date(s.deletedAt).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})
      : '—';
    return `
      <tr data-id="${s._id}">
        <td>${i+1}</td>
        <td>
          <div class="student-cell">
            <div class="avatar" style="background:${avatarGrad(s.name)};opacity:0.7">${initials}</div>
            <div>
              <div class="s-name" style="opacity:0.75">${escHtml(s.name)}</div>
              <div class="s-email">${escHtml(s.email)}</div>
            </div>
          </div>
        </td>
        <td><code style="font-size:12px;color:#6b7280">${escHtml(s.studentId)}</code></td>
        <td>${escHtml(s.dept)}</td>
        <td>${escHtml(s.year)}</td>
        <td><span class="gpa-badge ${gpaCls(s.gpa)}" style="opacity:0.75">${parseFloat(s.gpa).toFixed(1)}</span></td>
        <td><span class="status-badge ${statusCls(s.status)}" style="opacity:0.75">${escHtml(s.status)}</span></td>
        <td><span class="deleted-date">🗑 ${deletedDate}</span></td>
        <td>
          <div class="action-btns">
            <button class="action-label-btn btn-restore" onclick="restoreStudent('${s._id}')">
              <svg viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.32 2.58" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="3 3 3 9 9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Restore
            </button>
            <button class="action-label-btn btn-perm-delete" onclick="permanentDelete('${s._id}')">
              <svg viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2"/></svg>
              Remove
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/** Restore a deleted student back to the main list */
function restoreStudent(id) {
  const idx = deletedStudents.findIndex(s => s._id === id);
  if (idx === -1) return;
  const s = { ...deletedStudents[idx] };
  delete s.deletedAt;
  deletedStudents.splice(idx, 1);
  students.unshift(s);
  saveStudents();
  saveDeleted();
  updateDeletedBadge();
  applyFilters();
  renderDeletedTable();
  showToast(`${s.name} restored to student list! ✅`, 'success');
}

/** Permanently remove a single deleted record */
function permanentDelete(id) {
  const s = deletedStudents.find(st => st._id === id);
  if (!s) return;
  if (!confirm(`Permanently delete "${s.name}"? This CANNOT be undone.`)) return;
  deletedStudents = deletedStudents.filter(st => st._id !== id);
  saveDeleted();
  updateDeletedBadge();
  renderDeletedTable();
  showToast(`${s.name} permanently deleted.`, 'error');
}

/** Empty entire trash */
function emptyTrash() {
  if (deletedStudents.length === 0) { showToast('Trash is already empty.', 'info'); return; }
  if (!confirm(`Permanently delete all ${deletedStudents.length} records in trash? This CANNOT be undone.`)) return;
  deletedStudents = [];
  saveDeleted();
  updateDeletedBadge();
  renderDeletedTable();
  showToast('Trash emptied permanently.', 'error');
}

/* ================================================================
   DELETE (Soft — moves to deletedStudents)
   ================================================================ */
function openDeleteModal(id) {
  deleteTargetId=id;
  const s=students.find(st=>st._id===id);
  document.getElementById('deleteModalText').textContent=
    s?`Permanently delete "${s.name}"? This cannot be undone.`:'This cannot be undone.';
  document.getElementById('deleteModal').classList.add('open');
}
function closeDeleteModal(){ deleteTargetId=null; document.getElementById('deleteModal').classList.remove('open'); }
function confirmDelete() {
  if (!deleteTargetId) return;
  const idx = students.findIndex(st => st._id === deleteTargetId);
  if (idx === -1) { closeDeleteModal(); return; }
  const s = { ...students[idx], deletedAt: new Date().toISOString() };
  students.splice(idx, 1);
  deletedStudents.unshift(s);
  saveStudents();
  saveDeleted();
  applyFilters();
  /* Also refresh students section if visible */
  const stSec = document.getElementById('section-students');
  if (stSec && stSec.classList.contains('active')) { filteredData2=[...students]; applyFilters2(); }
  updateDeletedBadge();
  closeDeleteModal();
  showToast('Student deleted successfully', 'success');
}

/* ================================================================
   ADD MODAL helpers
   ================================================================ */
function openAddModal() { document.getElementById('addModal').classList.add('open'); }
function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
  editingId=null; clearModal();
  document.getElementById('modalTitle').textContent    ='Add New Student';
  document.getElementById('modalSubtitle').textContent ='Fill in all fields to register a student';
  document.getElementById('submitBtnText').textContent  ='Add Student';
}

/* ================================================================
   SEED DATA
   ================================================================ */
function seedDemo() {
  if(students.length>0) return;
  [
    {name:'Aarav Sharma',    studentId:'STU2024001',email:'aarav@edu.in',   phone:'9876543210',dept:'Computer Science',     year:'3rd Year',gpa:9.1,status:'Active', gender:'Male'},
    {name:'Priya Nair',      studentId:'STU2024002',email:'priya@edu.in',   phone:'9876543211',dept:'Electronics',          year:'2nd Year',gpa:8.4,status:'Active', gender:'Female'},
    {name:'Rahul Verma',     studentId:'STU2024003',email:'rahul@edu.in',   phone:'9876543212',dept:'Mechanical',           year:'4th Year',gpa:7.8,status:'Graduated', gender:'Male'},
    {name:'Sneha Patel',     studentId:'STU2024004',email:'sneha@edu.in',   phone:'9876543213',dept:'Information Technology',year:'1st Year',gpa:8.9,status:'Active', gender:'Female'},
    {name:'Arjun Mehta',     studentId:'STU2024005',email:'arjun@edu.in',   phone:'9876543214',dept:'Civil',                year:'3rd Year',gpa:6.5,status:'Inactive', gender:'Male'},
    {name:'Kavya Reddy',     studentId:'STU2024006',email:'kavya@edu.in',   phone:'9876543215',dept:'Electrical',           year:'2nd Year',gpa:9.4,status:'Active', gender:'Female'},
    {name:'Vikram Singh',    studentId:'STU2024007',email:'vikram@edu.in',  phone:'9876543216',dept:'Chemical',             year:'4th Year',gpa:5.9,status:'Suspended', gender:'Male'},
    {name:'Ananya Krishnan', studentId:'STU2024008',email:'ananya@edu.in',  phone:'9876543217',dept:'Biotechnology',        year:'1st Year',gpa:8.2,status:'Active', gender:'Female'},
  ].forEach(d=>students.push({_id:uid(),createdAt:new Date().toISOString(),...d}));
  saveStudents();
}

function startClock() {
  const timeEl = document.getElementById('topbarTime');
  const dateEl = document.getElementById('topbarDate');
  if (!timeEl || !dateEl) return;

  function update() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  }
  update();
  setInterval(update, 1000);
}

/* ================================================================
   INIT
   ================================================================ */
function init() {
  /* Theme */
  const saved=localStorage.getItem('sms_theme');
  if(saved) document.documentElement.setAttribute('data-theme',saved);
  /* Sync dark label */
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  document.getElementById('darkLabel').textContent=isDark?'Light Mode':'Dark Mode';
  if(isDark){
    document.getElementById('darkIcon').innerHTML=`<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  loadStudents(); loadDeleted(); seedDemo();
  filteredData=[...students];
  renderTable(); updateStats(); updateDeletedBadge();

  // Set welcome message
  const loggedInUser = localStorage.getItem('sms_loggedInUser') || 'Admin';
  const welcomeEl = document.getElementById('welcomeMessage');
  if (welcomeEl) {
    const hour = new Date().getHours();
    let greeting = 'Good Evening';
    if (hour < 12) greeting = 'Good Morning';
    else if (hour < 17) greeting = 'Good Afternoon';
    
    welcomeEl.innerHTML = `${greeting}, ${escHtml(loggedInUser)}! 👋`;
  }

  // Start clock
  startClock();

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure want to logout?')) {
        localStorage.removeItem('sms_loggedInUser');
        window.location.href = 'login.html';
      }
    });
  }

  /* ---- Nav items ---- */
  document.querySelectorAll('.nav-item[data-section]').forEach(item=>{
    item.addEventListener('click', e=>{
      e.preventDefault();
      switchSection(item.getAttribute('data-section'));
    });
  });

  /* ---- Modal Form ---- */
  document.getElementById('studentForm').addEventListener('submit', handleModalSubmit);
  document.getElementById('closeAddModal').addEventListener('click', closeAddModal);
  document.getElementById('cancelFormBtn').addEventListener('click', closeAddModal);
  document.getElementById('addModal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeAddModal();});

  /* Students section "Refresh" button */
  const refreshStudentsBtn = document.getElementById('refreshStudentsBtn');
  if (refreshStudentsBtn) {
    refreshStudentsBtn.addEventListener('click', () => {
      // Reset filters
      document.getElementById('searchInput2').value = '';
      document.getElementById('filterDept2').value = '';
      document.getElementById('filterStatus2').value = '';
      
      // Reload and render
      loadStudents();
      // Sort alphabetically by name
      students.sort((a, b) => a.name.localeCompare(b.name));
      applyFilters2();
      updateStats();
      
      // Optional visual feedback
      refreshStudentsBtn.style.opacity = '0.5';
      setTimeout(() => refreshStudentsBtn.style.opacity = '1', 300);
    });
  }

  /* ---- Inline Form (Add Student section) ---- */
  document.getElementById('studentFormInline').addEventListener('submit', handleInlineSubmit);
  document.getElementById('iClearBtn').addEventListener('click', clearInlineForm);

  /* ---- Display Modal ---- */
  document.getElementById('closeDisplayModal').addEventListener('click', closeDisplayModal);
  document.getElementById('displayModal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeDisplayModal();});

  /* ---- Photo Upload: Modal form ---- */
  (function() {
    const input   = document.getElementById('studentPhoto');
    const prevImg = document.getElementById('photoPreviewImg');
    const prevPh  = document.getElementById('photoPlaceholder');
    const prevClr = document.getElementById('photoClearBtn');
    const box     = document.getElementById('photoPreviewBox');
    function loadPhoto(file) {
      if (!file) return;
      if (file.size > 2*1024*1024) { showToast('Photo must be under 2MB.','error'); return; }
      if (!file.type.startsWith('image/')) { showToast('Please select a valid image.','error'); return; }
      const reader = new FileReader();
      reader.onload = e => {
        modalPhotoData = e.target.result;
        prevImg.src = e.target.result; prevImg.style.display='block';
        prevPh.style.display='none';   prevClr.style.display='flex';
      };
      reader.readAsDataURL(file);
    }
    input.addEventListener('change', e => loadPhoto(e.target.files[0]));
    prevClr.addEventListener('click', e => { e.stopPropagation(); modalPhotoData=null; input.value=''; prevImg.src=''; prevImg.style.display='none'; prevPh.style.display='flex'; prevClr.style.display='none'; });
    box.addEventListener('click', () => input.click());
  })();

  /* ---- Photo Upload: Inline form ---- */
  (function() {
    const input   = document.getElementById('iStudentPhoto');
    const prevImg = document.getElementById('iPhotoPreviewImg');
    const prevPh  = document.getElementById('iPhotoPlaceholder');
    const prevClr = document.getElementById('iPhotoClearBtn');
    const box     = document.getElementById('iPhotoPreviewBox');
    function loadPhoto(file) {
      if (!file) return;
      if (file.size > 2*1024*1024) { showToast('Photo must be under 2MB.','error'); return; }
      if (!file.type.startsWith('image/')) { showToast('Please select a valid image.','error'); return; }
      const reader = new FileReader();
      reader.onload = e => {
        inlinePhotoData = e.target.result;
        prevImg.src = e.target.result; prevImg.style.display='block';
        prevPh.style.display='none';   prevClr.style.display='flex';
      };
      reader.readAsDataURL(file);
    }
    input.addEventListener('change', e => loadPhoto(e.target.files[0]));
    prevClr.addEventListener('click', e => { e.stopPropagation(); inlinePhotoData=null; input.value=''; prevImg.src=''; prevImg.style.display='none'; prevPh.style.display='flex'; prevClr.style.display='none'; });
    box.addEventListener('click', () => input.click());
  })();

  /* ---- Delete Modal ---- */
  document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
  document.getElementById('deleteModal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeDeleteModal();});

  /* ---- Dashboard Filters (Removed) ---- */

  /* ---- Students Section Filters ---- */
  document.getElementById('searchInput2').addEventListener('input', applyFilters2);
  document.getElementById('filterDept2').addEventListener('change', applyFilters2);
  document.getElementById('filterStatus2').addEventListener('change', applyFilters2);

  /* ---- Pagination Dashboard (Removed) ---- */


  /* ---- Pagination Students ---- */
  document.getElementById('prevPage2').addEventListener('click',()=>{currentPage2--;renderTable2();});
  document.getElementById('nextPage2').addEventListener('click',()=>{currentPage2++;renderTable2();});

  /* ---- Settings ---- */
  document.getElementById('clearAllBtn').addEventListener('click',()=>{
    if(!students.length){showToast('No records to clear.','info');return;}
    if(!confirm(`Delete all ${students.length} student records? They will be moved to Deleted Items.`)) return;
    const now = new Date().toISOString();
    students.forEach(s => deletedStudents.unshift({...s, deletedAt: now}));
    students=[];
    saveStudents(); saveDeleted();
    applyFilters(); updateDeletedBadge();
    showToast('All records moved to Deleted Items.','info');
  });

  /* ---- Empty Trash ---- */
  document.getElementById('emptyTrashBtn').addEventListener('click', emptyTrash);

  /* ---- Live clear validation (modal) ---- */
  ['studentName','studentId','studentEmail','studentPhone','studentDeptForm','studentYear','studentGPA','studentStatus']
    .forEach(id=>{document.getElementById(id).addEventListener('input',()=>document.getElementById(id).classList.remove('invalid'));});
  /* ---- Live clear validation (inline) ---- */
  ['iName','iId','iEmail','iPhone','iDept','iYear','iGPA','iStatus']
    .forEach(id=>{document.getElementById(id).addEventListener('input',()=>document.getElementById(id).classList.remove('invalid'));});
}

document.addEventListener('DOMContentLoaded', init);
