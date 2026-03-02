// ═══════════════════════════════════════════
//  1. ตั้งค่า SUPABASE & STATE
// ═══════════════════════════════════════════
const supabaseUrl = 'https://tqxiqzjcixmgnsnklhnh.supabase.co';
const supabaseKey = 'sb_publishable_pciWxrBuNenHo4Dq3fTZ6g_b9NwNk2a';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('it_user') || 'null');
let currentRole = localStorage.getItem('it_role') || 'student';
let diaries = [];
let attendances = [];
let evaluations = []; 
let interns = [];

let selectedMood = '🙂';
let currentPanel = '';
let clockInterval, sessionStart = null;
let checkedIn = false;
let todayInTime = null;
let selectedReviewDiary = null;

// ═══════════════════════════════════════════
//  2. ระบบเปลี่ยนหน้า (Navigation)
// ═══════════════════════════════════════════
function goScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + name);
    if (target) target.classList.add('active');
}
function goLogin() { goScreen('login'); }
function goLoginAs(role) {
    const roleSelect = document.getElementById('l-role');
    if(roleSelect) roleSelect.value = role;
    goScreen('login');
}
function quickLogin(role) {
    const roleSelect = document.getElementById('l-role');
    if(roleSelect) roleSelect.value = role;
    const emails = { student: 'student@test.com', teacher: 'teacher@test.com', hr: 'hr@test.com' };
    const emailField = document.getElementById('l-email');
    const pwField = document.getElementById('l-pw');
    if(emailField) emailField.value = emails[role];
    if(pwField) pwField.value = '123456';
    goScreen('login');
}

// ═══════════════════════════════════════════
//  3. ระบบ LOGIN / AUTH
// ═══════════════════════════════════════════
function switchLoginTab(tab) {
    document.getElementById('lt-login').classList.toggle('active', tab==='login');
    document.getElementById('lt-reg').classList.toggle('active', tab==='register');
    document.getElementById('form-login').style.display = tab==='login' ? '' : 'none';
    document.getElementById('form-register').style.display = tab==='register' ? '' : 'none';
}
function togglePw(id, btn) {
    const inp = document.getElementById(id);
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

async function doLogin() {
    const email = document.getElementById('l-email').value.trim();
    const pw = document.getElementById('l-pw').value;
    const role = document.getElementById('l-role').value; // ดึงบทบาทที่เลือก
    const errBox = document.getElementById('login-err');

    console.log("Attempting login with:", email, pw); // ลองเช็คดูว่าค่ามาไหม
    
    if (!email || !pw) return;

    // 1. ล็อกอินผ่าน Supabase
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password: pw });

    if (authError) {
        if(errBox) { errBox.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'; errBox.style.display = 'block'; }
        return;
    }

    // 2. ดึงข้อมูล Profile เพิ่มเติม (ถ้ามีตาราง profiles)
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', authData.user.id).single();

    // 3. เก็บข้อมูลลง LocalStorage เพื่อให้ระบบจำได้
    currentUser = {
        id: authData.user.id,
        email: authData.user.email,
        name: profile?.full_name || authData.user.user_metadata.full_name || 'ผู้ใช้',
    };
    currentRole = role;

    localStorage.setItem('it_user', JSON.stringify(currentUser));
    localStorage.setItem('it_role', currentRole);

    // 4. ไปที่หน้า App ตามบทบาท
    if (currentRole === 'hr') {
        launchHR();
    } else {
        launchApp(); // ฟังก์ชันสำหรับเปิดหน้า Student/Teacher
    }
}
async function doLogout() {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('it_user'); 
    localStorage.removeItem('it_role');
    currentUser = null; currentRole = 'student';
    goScreen('landing');
}

async function loadStudentData() {
    if (!currentUser) return;
    const { data: dData } = await supabaseClient.from('diaries').select('*').eq('student_id', currentUser.id).order('date', {ascending: false});
    if (dData) {
        diaries = dData.map(d => ({
            id: d.id, date: d.date, title: d.title, work: d.work_detail, learn: d.learning_detail, mood: d.mood, hrs: d.hours_worked, status: d.status, comment: d.comment, commenter: d.commenter_name
        }));
    }
    const { data: aData } = await supabaseClient.from('attendance').select('*').eq('student_id', currentUser.id).order('date', {ascending: false});
    if (aData) {
        attendances = aData.map(a => ({
            date: a.date, inTime: a.check_in, outTime: a.check_out, hours: a.total_hours, late: a.is_late, note: a.note
        }));
    }
    if(typeof renderStudentDash === 'function') renderStudentDash();
    if(typeof renderDiaryPanel === 'function') renderDiaryPanel();
    if(typeof renderAttPanel === 'function') renderAttPanel();
}

function updateUserUI() {
  const u = currentUser || {name:'ผู้ใช้', role:'student'};
  const ava = u.name ? u.name[0] : '?';
  document.getElementById('sb-ava').textContent = ava;
  document.getElementById('sb-uname').textContent = u.name;
  document.getElementById('sb-urole').textContent = currentRole==='teacher' ? 'อาจารย์ที่ปรึกษา' : 'นักศึกษา';
  const badge = document.getElementById('sb-badge');
  if(currentRole==='teacher') {
    badge.className='sb-role-badge rb-t'; badge.textContent='👨‍🏫 อาจารย์ที่ปรึกษา';
    document.getElementById('sb-ava').className='sb-ava ava-b';
  } else {
    badge.className='sb-role-badge rb-s'; badge.textContent='🎒 นักศึกษา';
    document.getElementById('sb-ava').className='sb-ava ava-t';
  }
  if(document.getElementById('s-welcome-msg')) {
    document.getElementById('s-welcome-msg').textContent = `สวัสดี ${u.name}! ดูภาพรวมการฝึกงานของคุณ`;
  }
}

function buildSidebar() {
  const nav = document.getElementById('sb-nav');
  if(currentRole==='student') {
    nav.innerHTML = `
      <div class="sb-sec"><div class="sb-sec-lbl">นักศึกษา</div>
        <button class="sb-item" onclick="switchPanel('s-dash')"><span class="sb-icon">🏠</span>Dashboard</button>
        <button class="sb-item" onclick="switchPanel('s-diary')"><span class="sb-icon">📝</span>บันทึกประจำวัน</button>
        <button class="sb-item" onclick="switchPanel('s-att')"><span class="sb-icon">⏰</span>เวลาเข้า-ออกงาน</button>
        <button class="sb-item" onclick="switchPanel('s-eval')"><span class="sb-icon">⭐</span>ผลการประเมิน</button>
      </div>
      <div class="sb-sec"><div class="sb-sec-lbl">บัญชี</div>
        <button class="sb-item" onclick="switchPanel('s-profile')"><span class="sb-icon">👤</span>ข้อมูลส่วนตัว</button>
      </div>`;
  } else {
    nav.innerHTML = `
      <div class="sb-sec"><div class="sb-sec-lbl">ภาพรวม</div>
        <button class="sb-item" onclick="switchPanel('t-dash')"><span class="sb-icon">🏠</span>Dashboard</button>
        <button class="sb-item" onclick="switchPanel('t-interns')"><span class="sb-icon">👥</span>รายชื่อนักศึกษา <span class="sb-bdg">${interns.length}</span></button>
      </div>
      <div class="sb-sec"><div class="sb-sec-lbl">ติดตาม</div>
        <button class="sb-item" onclick="switchPanel('t-review')"><span class="sb-icon">📝</span>ตรวจบันทึก <span class="sb-bdg w">${diaries.filter(d=>d.status==='pending').length||''}</span></button>
        <button class="sb-item" onclick="switchPanel('t-att')"><span class="sb-icon">⏰</span>เวลาเข้างาน</button>
      </div>
      <div class="sb-sec"><div class="sb-sec-lbl">ประเมิน</div>
        <button class="sb-item" onclick="switchPanel('t-eval')"><span class="sb-icon">⭐</span>ประเมินผล</button>
        <button class="sb-item" onclick="switchPanel('t-reports')"><span class="sb-icon">📄</span>รายงาน</button>
      </div>`;
  }
}

function switchPanel(id) {
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  const panel = document.getElementById('panel-'+id);
  if(panel) panel.classList.add('active');
  currentPanel = id;

  // Sidebar active
  document.querySelectorAll('.sb-item').forEach(btn=>{
    btn.classList.remove('active','t-active');
    if(btn.getAttribute('onclick')&&btn.getAttribute('onclick').includes("'"+id+"'")) {
      btn.classList.add(currentRole==='teacher' ? 't-active' : 'active');
    }
  });

  // Title
  const titles = {'s-dash':'Dashboard','s-diary':'บันทึกประจำวัน','s-att':'เวลาเข้า-ออกงาน','s-eval':'ผลการประเมิน','s-profile':'ข้อมูลส่วนตัว','t-dash':'Dashboard อาจารย์','t-interns':'รายชื่อนักศึกษา','t-review':'ตรวจบันทึกประจำวัน','t-att':'ติดตามเวลาเข้างาน','t-eval':'ประเมินผล','t-reports':'รายงานสรุป'};
  document.getElementById('tb-title').textContent = titles[id]||id;

  // Topbar action
  const actionBtn = document.getElementById('tb-action-btn');
  if(id==='s-diary') { actionBtn.textContent='+ บันทึกวันนี้'; actionBtn.style.display=''; }
  else if(id==='t-interns') { actionBtn.textContent='+ เพิ่มนักศึกษา'; actionBtn.style.display=''; }
  else { actionBtn.style.display='none'; }

  // Render per panel
  const renders = {'s-dash':renderStudentDash,'s-diary':renderDiaryPanel,'s-att':renderAttPanel,'s-eval':renderStudentEval,'t-dash':renderTeacherDash,'t-interns':renderInternList,'t-review':renderReviewPanel,'t-att':renderTeacherAtt,'t-eval':renderEvalPanel,'t-reports':renderReports,'s-profile':loadProfile};
  if(renders[id]) renders[id]();
}

function tbAction() {
  if(currentPanel==='s-diary') { document.getElementById('d-title').focus(); showToast('📝 กรอกบันทึกในแบบฟอร์มด้านซ้าย'); }
  else if(currentPanel==='t-interns') openAddInternModal();
}
function handleSearch() {}

// ═══════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════
function startClock() {
  clearInterval(clockInterval);
  clockInterval = setInterval(updateClocks, 1000);
  updateClocks();
  checkTodayAttendance();
}
function updateClocks() {
  const now = new Date();
  const ts = now.toTimeString().split(' ')[0];
  const ds = now.toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  ['d-clock','cw-clock'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=ts; });
  ['d-date-lbl','cw-date-lbl'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=ds; });
  if(checkedIn && sessionStart) {
    const elapsed = Math.floor((Date.now()-sessionStart)/1000);
    const h = Math.floor(elapsed/3600), m = Math.floor((elapsed%3600)/60), s = elapsed%60;
    const hStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const el = document.getElementById('att-sess'); if(el) el.textContent = '⏱ '+hStr;
    const we = document.getElementById('d-worked'); if(we) we.textContent = h+'ชม. '+m+'น.';
  }
}
function checkTodayAttendance() {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAtt = attendances.find(a=>a.date===todayStr);
  if(todayAtt) {
    ['d-in-t','dash-in-t'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=todayAtt.inTime; });
    if(todayAtt.outTime) {
      ['d-out-t','dash-out-t'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=todayAtt.outTime; });
      setCheckoutState(true);
    } else {
      checkedIn=true; sessionStart = Date.now();
      setCheckinState(false);
    }
  }
}
function setCheckinState(justIn) {
  ['d-ci-btn','att-ci-btn'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display='none'; });
  ['d-co-btn','att-co-btn'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display=''; });
}
function setCheckoutState(done) {
  ['d-ci-btn','att-ci-btn'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display='none'; });
  ['d-co-btn','att-co-btn'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display='none'; });
  const el2=document.getElementById('att-sess'); if(el2) el2.textContent='✅ เช็คเอาท์แล้ว';
}

// ═══════════════════════════════════════════
//  ATTENDANCE
// ═══════════════════════════════════════════
function checkIn() {
  if(checkedIn) { showToast('คุณเช็คอินแล้ว!'); return; }
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  if(attendances.find(a=>a.date===todayStr)) { showToast('เช็คอินแล้ววันนี้!'); return; }
  const timeStr = now.toTimeString().substring(0,5);
  const late = now.getHours()>=9;
  attendances.unshift({ date:todayStr, inTime:timeStr, outTime:null, hours:null, late, note:'' });
  localStorage.setItem('it_att', JSON.stringify(attendances));
  checkedIn=true; sessionStart=Date.now(); todayInTime=timeStr;
  ['d-in-t'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=timeStr; });
  setCheckinState(true);
  showToast(`🟢 เช็คอินสำเร็จ! เวลา ${timeStr} ${late?'⚠ มาสาย':''}`);
  if(currentPanel==='s-att') renderAttPanel();
}
function checkOut() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const idx = attendances.findIndex(a=>a.date===todayStr);
  if(idx<0) { showToast('ยังไม่ได้เช็คอิน!','err'); return; }
  const timeStr = now.toTimeString().substring(0,5);
  const inParts = attendances[idx].inTime.split(':');
  const outParts = timeStr.split(':');
  const hrs = ((parseInt(outParts[0])*60+parseInt(outParts[1]))-(parseInt(inParts[0])*60+parseInt(inParts[1])))/60;
  attendances[idx].outTime = timeStr;
  attendances[idx].hours = hrs.toFixed(1);
  localStorage.setItem('it_att', JSON.stringify(attendances));
  checkedIn=false; sessionStart=null;
  ['d-out-t'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=timeStr; });
  ['d-worked'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=hrs.toFixed(1)+' ชม.'; });
  setCheckoutState(true);
  showToast(`🔴 เช็คเอาท์สำเร็จ! ${hrs.toFixed(1)} ชั่วโมงวันนี้`);
  if(currentPanel==='s-att') renderAttPanel();
  if(currentPanel==='s-dash') renderStudentDash();
}
function addManualEntry() {
  const d=document.getElementById('man-d').value, inT=document.getElementById('man-in').value, outT=document.getElementById('man-out').value, note=document.getElementById('man-note').value;
  if(!d||!inT||!outT) { showToast('กรุณากรอกข้อมูลให้ครบ','err'); return; }
  const inP=inT.split(':'), outP=outT.split(':');
  const hrs=((parseInt(outP[0])*60+parseInt(outP[1]))-(parseInt(inP[0])*60+parseInt(inP[1])))/60;
  attendances = attendances.filter(a=>a.date!==d);
  attendances.unshift({ date:d, inTime:inT, outTime:outT, hours:hrs.toFixed(1), late:parseInt(inP[0])>=9, note });
  attendances.sort((a,b)=>b.date.localeCompare(a.date));
  localStorage.setItem('it_att', JSON.stringify(attendances));
  document.getElementById('man-d').value=''; document.getElementById('man-note').value='';
  showToast('✅ บันทึกเวลาสำเร็จ!');
  renderAttPanel();
}

// ═══════════════════════════════════════════
//  DIARY
// ═══════════════════════════════════════════
function updateDiaryCount() {
  const v=document.getElementById('d-work').value;
  const el=document.getElementById('d-char'); if(el) el.textContent=v.length+' ตัวอักษร';
}
function pickMood(btn, mood) {
  document.querySelectorAll('.mood-opt').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel'); selectedMood=mood;
}
function addSkill() {
  const inp=document.getElementById('skill-inp'); const v=inp.value.trim();
  if(!v) return;
  const chip=document.createElement('div'); chip.className='skill-chip';
  chip.innerHTML=v+' <span class="rm" onclick="this.parentElement.remove()">×</span>';
  document.getElementById('skill-tags').appendChild(chip);
  inp.value='';
}
function saveDraft() { showToast('💾 บันทึกร่างแล้ว'); }
function submitDiary() {
  const title=document.getElementById('d-title').value.trim();
  const work=document.getElementById('d-work').value.trim();
  if(!title||!work) { showToast('กรุณากรอกหัวข้อและรายละเอียด','err'); return; }
  const date=document.getElementById('diary-date').value || new Date().toISOString().split('T')[0];
  const skills=Array.from(document.querySelectorAll('#skill-tags .skill-chip')).map(c=>c.textContent.replace('×','').trim());
  const entry={id:Date.now(),date,title,work,learn:document.getElementById('d-learn').value,prob:document.getElementById('d-prob').value,mood:selectedMood,skills,hrs:document.getElementById('d-hrs').value,diff:document.getElementById('d-diff').value,status:'pending',comment:null,commenter:null};
  const existIdx=diaries.findIndex(d=>d.date===date);
  if(existIdx>=0) { if(!confirm('มีบันทึกวันนี้แล้ว ต้องการแทนที่?')) return; diaries[existIdx]=entry; }
  else diaries.unshift(entry);
  localStorage.setItem('it_diaries', JSON.stringify(diaries));
  showToast('✅ ส่งบันทึกสำเร็จ! อาจารย์จะตรวจสอบเร็วๆ นี้');
  document.getElementById('d-title').value=''; document.getElementById('d-work').value='';
  document.getElementById('d-learn').value=''; document.getElementById('d-prob').value='';
  renderDiaryPanel();
  if(currentPanel==='s-dash') renderStudentDash();
}

// ═══════════════════════════════════════════
//  RENDER: STUDENT DASHBOARD
// ═══════════════════════════════════════════
function renderStudentDash() {
  const totalHrs = attendances.reduce((s,a)=>s+(parseFloat(a.hours)||0),0);
  const el1=document.getElementById('sd-diaries'); if(el1) el1.textContent=diaries.length;
  const el2=document.getElementById('sd-hours'); if(el2) el2.textContent=Math.round(totalHrs);
  const lastEval = evaluations.filter(e=>e.internId===0).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const el3=document.getElementById('sd-score'); if(el3) el3.textContent=lastEval ? lastEval.overall : '—';

  // Recent diaries
  const recentEl=document.getElementById('sd-recent');
  if(recentEl) {
    if(!diaries.length) { recentEl.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3);font-size:12px">📭 ยังไม่มีบันทึก</div>'; }
    else recentEl.innerHTML=diaries.slice(0,3).map(d=>diaryMini(d)).join('');
  }

  // Week grid
  renderWeekGrid('s-week-grid','wk-sent','wk-left');
}

function renderWeekGrid(gridId, sentId, leftId) {
  const grid=document.getElementById(gridId); if(!grid) return;
  const today=new Date(); const todayStr=today.toISOString().split('T')[0];
  const mon=new Date(today); mon.setDate(today.getDate()-((today.getDay()+6)%7));
  const days=['จ','อ','พ','พฤ','ศ','ส','อา']; let sent=0; let cells='';
  for(let i=0;i<7;i++) {
    const d=new Date(mon); d.setDate(mon.getDate()+i);
    const str=d.toISOString().split('T')[0];
    const isToday=str===todayStr, isWE=i>=5, hasEntry=diaries.some(e=>e.date===str);
    if(hasEntry&&!isWE) sent++;
    const cls=isWE?'ad-off':hasEntry?'ad-ok':isToday?'ad-today':'';
    cells+=`<div class="att-day ${cls}">${days[i]}</div>`;
  }
  grid.innerHTML=cells;
  const se=document.getElementById(sentId); if(se) se.textContent=sent;
  const le=document.getElementById(leftId); if(le) le.textContent=Math.max(0,5-sent);
}

function diaryMini(d) {
  const statusCls=d.status==='approved'?'dcc-ok':d.status==='commented'?'dcc-c':'dcc-p';
  const statusTxt=d.status==='approved'?'อนุมัติ':d.status==='commented'?'มี comment':'รอตรวจ';
  const borderCls=d.status==='approved'?'dc-ok':d.status==='commented'?'dc-cmt':'dc-pend';
  return `<div class="diary-card ${borderCls}">
    <div class="dc-top"><span>${d.mood}</span><span class="dc-date">${d.date}</span><span class="dc-chip ${statusCls}">${statusTxt}</span></div>
    <div class="dc-title">${d.title}</div>
    <div class="dc-preview">${d.work}</div>
    ${d.skills&&d.skills.length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:7px">${d.skills.map(s=>`<span class="skill-chip" style="font-size:10px;padding:2px 7px">${s}</span>`).join('')}</div>`:''}
    ${d.comment?`<div class="dc-cmt-box"><div class="dc-cmt-from">💬 ${d.commenter}</div>${d.comment}</div>`:''}
  </div>`;
}

// ═══════════════════════════════════════════
//  RENDER: DIARY PANEL
// ═══════════════════════════════════════════
function renderDiaryPanel() {
  const todayStr=new Date().toISOString().split('T')[0];
  const dateInp=document.getElementById('diary-date');
  if(dateInp&&!dateInp.value) dateInp.value=todayStr;
  updateWeekday();

  const hist=document.getElementById('diary-hist'); if(!hist) return;
  const cnt=document.getElementById('diary-cnt'); if(cnt) cnt.textContent=diaries.length+' รายการ';
  if(!diaries.length) { hist.innerHTML='<div style="text-align:center;padding:32px;color:var(--text3);font-size:12px">📭 ยังไม่มีบันทึก</div>'; return; }
  hist.innerHTML=diaries.map(d=>diaryMini(d)).join('');
}
function updateWeekday() {
  const dateInp=document.getElementById('diary-date'); if(!dateInp) return;
  const d=new Date(dateInp.value||new Date());
  const days=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const el=document.getElementById('diary-wday'); if(el) el.textContent='วัน'+days[d.getDay()];
}

// ═══════════════════════════════════════════
//  RENDER: ATTENDANCE PANEL
// ═══════════════════════════════════════════
function renderAttPanel() {
  const totalHrs=attendances.reduce((s,a)=>s+(parseFloat(a.hours)||0),0);
  const totalDays=attendances.filter(a=>a.outTime).length;
  const lateDays=attendances.filter(a=>a.late).length;
  ['att-days','td-days'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=totalDays; });
  ['att-hrs','td-hrs'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=Math.round(totalHrs); });
  const el3=document.getElementById('att-late'); if(el3) el3.textContent=lateDays;
  const el4=document.getElementById('att-abs'); if(el4) el4.textContent=0;

  const monHours=Math.min(Math.round(totalHrs),168);
  const el5=document.getElementById('att-mon-h'); if(el5) el5.textContent=monHours+'/168';
  const el6=document.getElementById('att-mon-pb'); if(el6) el6.style.width=Math.round(monHours/168*100)+'%';
  const pct=totalDays>0?Math.round(totalDays/(totalDays+0)*100):100;
  const el7=document.getElementById('att-pct'); if(el7) el7.textContent=pct+'%';
  const el8=document.getElementById('att-pct-pb'); if(el8) el8.style.width=pct+'%';

  // History
  const hist=document.getElementById('att-hist'); if(!hist) return;
  if(!attendances.length) { hist.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3);font-size:12px">ยังไม่มีข้อมูล</div>'; return; }
  hist.innerHTML=attendances.slice(0,20).map(a=>`
    <div class="time-row">
      <div class="t-date">${a.date}</div>
      <div class="t-in">${a.inTime||'—'}</div>
      <div class="t-out">${a.outTime||'—'}</div>
      <div class="t-hrs">${a.hours?a.hours+' ชม.':'กำลังทำงาน'}</div>
      <div>${a.late?'<span class="status s-warn">มาสาย</span>':'<span class="status s-ok">ปกติ</span>'}</div>
      <div class="t-note">${a.note||''}</div>
    </div>`).join('');

  // Bar chart
  renderAttBars();
}

function renderAttBars() {
  const bars=document.getElementById('att-bars'); if(!bars) return;
  const today=new Date(); const mon=new Date(today); mon.setDate(today.getDate()-((today.getDay()+6)%7));
  const days=['จ','อ','พ','พฤ','ศ']; let cells='';
  for(let i=0;i<5;i++) {
    const d=new Date(mon); d.setDate(mon.getDate()+i);
    const str=d.toISOString().split('T')[0];
    const att=attendances.find(a=>a.date===str);
    const hrs=att&&att.hours?parseFloat(att.hours):0;
    const h=Math.round(hrs/9*100);
    cells+=`<div class="bc"><div class="bbar" style="height:${h}%"></div><div class="blbl">${days[i]}</div></div>`;
  }
  bars.innerHTML=cells;
}

// ═══════════════════════════════════════════
//  RENDER: STUDENT EVAL
// ═══════════════════════════════════════════
function renderStudentEval() {
  const wrap=document.getElementById('s-eval-wrap'); if(!wrap) return;
  const myEvals=evaluations.filter(e=>e.internId===0||e.studentEmail===(currentUser&&currentUser.email));
  if(!myEvals.length) {
    wrap.innerHTML='<div style="text-align:center;padding:56px;color:var(--text3)"><div style="font-size:44px;margin-bottom:14px">📋</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">ยังไม่มีผลประเมิน</div><div style="font-size:12px">อาจารย์ยังไม่ได้ประเมิน</div></div>';
    return;
  }
  const latest=myEvals.sort((a,b)=>b.date.localeCompare(a.date))[0];
  const grade=latest.overall>=4.5?'A — ดีเยี่ยม 🏆':latest.overall>=4?'B+ — ดีมาก':latest.overall>=3.5?'B — ดี':latest.overall>=3?'C+ — พอใช้':'C — ผ่าน';
  const critNames={skill:'🔧 ทักษะวิชาชีพ',responsibility:'📋 ความรับผิดชอบ',teamwork:'🤝 ทีมเวิร์ค',communication:'💬 สื่อสาร',creativity:'💡 ความคิดสร้างสรรค์',punctuality:'⏰ ตรงต่อเวลา'};
  wrap.innerHTML=`
    <div class="score-hero">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--text2);margin-bottom:8px">คะแนนรวม</div>
      <div class="score-big-num">${latest.overall}<span style="font-size:24px;color:var(--text2);font-weight:400">/5.0</span></div>
      <div class="score-grade">เกรด ${grade}</div>
    </div>
    <div class="grid2">
      <div class="card">
        <div class="card-head"><div class="card-title">📊 คะแนนรายเกณฑ์</div></div>
        <div class="card-body">
          ${Object.entries(latest.criteria||{}).map(([k,v])=>`
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <span style="font-size:12px">${critNames[k]||k}</span>
                <span style="font-size:12px;font-weight:700;color:${v>=4.5?'var(--emerald)':v>=4?'var(--teal)':'var(--amber)'}">${v}/5</span>
              </div>
              <div class="pb" style="height:6px"><div class="pf pf-t" style="width:${v/5*100}%"></div></div>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">💬 Feedback จากอาจารย์</div></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:12px;background:rgba(59,130,246,.06);border-radius:9px;border:1px solid rgba(59,130,246,.15)">
            <div class="ava-sm ava-b" style="width:36px;height:36px;font-size:13px">อ</div>
            <div><div style="font-weight:700;font-size:13px">${latest.teacherName||'อาจารย์'}</div><div style="font-size:11px;color:var(--text2)">${latest.round||''} · ${latest.date}</div></div>
          </div>
          <div style="font-size:13px;line-height:1.8;color:var(--text2)">${latest.comment||'ไม่มีความคิดเห็น'}</div>
        </div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════
//  RENDER: TEACHER DASHBOARD
// ═══════════════════════════════════════════
function renderTeacherDash() {
  const total=interns.length;
  const pending=interns.filter(i=>i.status==='pending').length;
  const dEl=document.getElementById('td-total'); if(dEl) dEl.textContent=total;
  const pEl=document.getElementById('td-eval'); if(pEl) pEl.textContent=pending;
  const mEl=document.getElementById('td-miss'); if(mEl) mEl.textContent=interns.filter(i=>i.progress<40).length;
  const oEl=document.getElementById('td-ok'); if(oEl) oEl.textContent=interns.filter(i=>i.progress>=60).length;

  const tbl=document.getElementById('td-intern-tbl'); if(!tbl) return;
  tbl.innerHTML=interns.slice(0,5).map(i=>`<tr>
    <td><div class="nm"><div class="ava-sm ${i.color}">${i.name[0]}</div><div><div class="nm-main">${i.name}</div><div class="nm-sub">${i.uni}</div></div></div></td>
    <td><div class="pw"><div class="pb"><div class="pf ${i.progress>=60?'pf-t':i.progress>=40?'pf-a':'pf-r'}" style="width:${i.progress}%"></div></div><div class="pt">${i.progress}%</div></div></td>
    <td>${statusBadge(i.status)}</td>
    <td><button class="btn btn-sm btn-outline" onclick="goEvalIntern(${i.id})">ประเมิน</button></td>
  </tr>`).join('');

  const pend=document.getElementById('td-pending'); if(!pend) return;
  const pendDiaries=diaries.filter(d=>d.status==='pending');
  if(!pendDiaries.length) { pend.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">ไม่มีบันทึกรอตรวจ ✅</td></tr>'; return; }
  pend.innerHTML=pendDiaries.map((d,i)=>`<tr>
    <td><div class="nm"><div class="ava-sm ${['c1','c2','c3','c4','c5','c6'][i%6]}">${'สวกธอพ'[i%6]}</div><div class="nm-main">${interns[i%interns.length]?.name||'นักศึกษา'}</div></div></td>
    <td>${d.date}</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.title}</td>
    <td>${d.mood}</td><td><span class="status s-warn">รอตรวจ</span></td>
    <td><button class="btn btn-sm btn-outline" onclick="switchPanel('t-review')">ตรวจ</button></td>
  </tr>`).join('');
}

function statusBadge(s) {
  const map={active:'<span class="status s-ok">กำลังฝึกงาน</span>',pending:'<span class="status s-warn">ต้องติดตาม</span>',done:'<span class="status s-done">เสร็จสิ้น</span>'};
  return map[s]||s;
}

// ═══════════════════════════════════════════
//  RENDER: INTERN LIST
// ═══════════════════════════════════════════
function renderInternList(filter='all') {
  const tbl=document.getElementById('t-intern-list'); if(!tbl) return;
  const filtered=filter==='all'?interns:interns.filter(i=>i.status===filter);
  tbl.innerHTML=filtered.map(i=>`<tr>
    <td><div class="nm"><div class="ava-sm ${i.color}">${i.name[0]}</div><div><div class="nm-main">${i.name}</div><div class="nm-sub">${i.email||''}</div></div></div></td>
    <td>${i.uni}</td><td>${i.dept}</td>
    <td><div class="pw"><div class="pb"><div class="pf ${i.progress>=60?'pf-t':i.progress>=40?'pf-a':'pf-r'}" style="width:${i.progress}%"></div></div><div class="pt">${i.progress}%</div></div></td>
    <td>${statusBadge(i.status)}</td>
    <td><div style="display:flex;gap:6px">
      <button class="btn btn-sm btn-outline" onclick="goEvalIntern(${i.id})">⭐ ประเมิน</button>
      <button class="btn btn-sm btn-danger" onclick="removeIntern(${i.id})">✕</button>
    </div></td>
  </tr>`).join('');
}
function filterInterns(btn, filter) {
  document.querySelectorAll('.fchip').forEach(c=>c.classList.remove('fa'));
  btn.classList.add('fa');
  renderInternList(filter);
}
function goEvalIntern(id) {
  switchPanel('t-eval');
  const sel=document.getElementById('eval-intern-sel'); if(sel) { sel.value=id; loadEvalForm(); }
}
function removeIntern(id) {
  if(!confirm('ลบนักศึกษาออกจากรายการ?')) return;
  interns=interns.filter(i=>i.id!==id);
  localStorage.setItem('it_interns',JSON.stringify(interns));
  renderInternList(); showToast('ลบเรียบร้อย');
}
function openAddInternModal() { document.getElementById('modal-add-intern').classList.add('open'); }
function addInternConfirm() {
  const name=document.getElementById('ai-name').value.trim();
  if(!name) { showToast('กรุณากรอกชื่อ','err'); return; }
  const colors=['c1','c2','c3','c4','c5','c6'];
  const newIntern={id:Date.now(),name,uni:document.getElementById('ai-uni').value||'—',dept:document.getElementById('ai-dept').value,email:document.getElementById('ai-email').value,start:document.getElementById('ai-start').value,end:document.getElementById('ai-end').value,progress:0,status:'active',color:colors[interns.length%6]};
  interns.push(newIntern);
  localStorage.setItem('it_interns',JSON.stringify(interns));
  closeModalById('modal-add-intern');
  renderInternList(); populateTeacherSelects(); renderTeacherDash();
  showToast('✅ เพิ่มนักศึกษาเรียบร้อย!');
}

// ═══════════════════════════════════════════
//  RENDER: REVIEW DIARIES
// ═══════════════════════════════════════════
function renderReviewPanel() {
  populateReviewSelect();
  loadReviewDiaries();
}
function populateReviewSelect() {
  const sel=document.getElementById('review-intern-sel'); if(!sel) return;
  sel.innerHTML='<option value="all">— นักศึกษาทั้งหมด —</option>'+interns.map(i=>`<option value="${i.id}">${i.name}</option>`).join('');
}
function loadReviewDiaries() {
  const list=document.getElementById('review-list'); if(!list) return;
  if(!diaries.length) { list.innerHTML='<div style="text-align:center;padding:32px;color:var(--text3);font-size:12px">ไม่มีบันทึกที่รอตรวจ</div>'; return; }
  list.innerHTML=diaries.map(d=>{
    const bc=d.status==='approved'?'dc-ok':d.status==='commented'?'dc-cmt':'dc-pend';
    const chip=d.status==='approved'?'<span class="dc-chip dcc-ok">อนุมัติ</span>':d.status==='commented'?'<span class="dc-chip dcc-c">commented</span>':'<span class="dc-chip dcc-p">รอตรวจ</span>';
    return `<div class="diary-card ${bc}" onclick="showReviewDetail(${d.id})">
      <div class="dc-top"><span>${d.mood}</span><span class="dc-date">${d.date}</span>${chip}</div>
      <div class="dc-title">${d.title}</div>
      <div class="dc-preview">${d.work}</div>
    </div>`;
  }).join('');
}
function showReviewDetail(id) {
  const d=diaries.find(x=>x.id===id); if(!d) return;
  selectedReviewDiary=d;
  document.getElementById('review-placeholder').style.display='none';
  const card=document.getElementById('review-detail-card'); card.style.display='';
  const body=document.getElementById('review-detail-body');
  body.innerHTML=`
    <div style="margin-bottom:14px"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">วันที่ ${d.date} ${d.mood}</div>
    <div style="font-size:15px;font-weight:800;margin-bottom:8px">${d.title}</div>
    <div style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:12px">${d.work}</div>
    ${d.learn?`<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px">สิ่งที่เรียนรู้</div><div style="font-size:12px;color:var(--text2)">${d.learn}</div></div>`:''}
    ${d.skills&&d.skills.length?`<div class="skill-tags" style="margin-bottom:12px">${d.skills.map(s=>`<span class="skill-chip">${s}</span>`).join('')}</div>`:''}
    <div style="display:flex;gap:10px;font-size:11px;color:var(--text3)"><span>⏰ ${d.hrs} ชั่วโมง</span><span>📊 ${d.diff}</span></div></div>
    ${d.comment?`<div class="dc-cmt-box" style="margin-bottom:14px"><div class="dc-cmt-from">💬 ${d.commenter}</div>${d.comment}</div>`:''}
    <div style="border-top:1px solid var(--border);padding-top:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:8px">เพิ่ม Comment / Feedback</div>
      <textarea class="fi3" id="review-cmt-input" rows="3" placeholder="ระบุความคิดเห็น คำแนะนำ..." style="margin-bottom:10px">${d.comment||''}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-success btn-sm" onclick="approveOneDiary(${d.id})">✅ อนุมัติ</button>
        <button class="btn btn-blue btn-sm" onclick="commentDiary(${d.id})">💬 บันทึก Comment</button>
      </div>
    </div>`;
}
function approveOneDiary(id) {
  const idx=diaries.findIndex(d=>d.id===id); if(idx<0) return;
  diaries[idx].status='approved';
  localStorage.setItem('it_diaries',JSON.stringify(diaries));
  loadReviewDiaries(); showReviewDetail(id); showToast('✅ อนุมัติบันทึกแล้ว!');
}
function commentDiary(id) {
  const cmt=document.getElementById('review-cmt-input').value.trim();
  if(!cmt) { showToast('กรุณากรอก comment','err'); return; }
  const idx=diaries.findIndex(d=>d.id===id); if(idx<0) return;
  diaries[idx].comment=cmt; diaries[idx].status='commented';
  diaries[idx].commenter=(currentUser&&currentUser.name)||'อาจารย์';
  localStorage.setItem('it_diaries',JSON.stringify(diaries));
  loadReviewDiaries(); showReviewDetail(id); showToast('💬 บันทึก comment สำเร็จ!');
}
function approveAllDiaries() {
  diaries.forEach(d=>{ if(d.status==='pending') d.status='approved'; });
  localStorage.setItem('it_diaries',JSON.stringify(diaries));
  loadReviewDiaries(); showToast('✅ อนุมัติทั้งหมดแล้ว!');
}
function notifyAll() { showToast('📧 ส่งแจ้งเตือนนักศึกษาทุกคนแล้ว'); }

// ═══════════════════════════════════════════
//  RENDER: TEACHER ATTENDANCE
// ═══════════════════════════════════════════
function renderTeacherAtt() {
  const tbl=document.getElementById('t-att-tbl'); if(!tbl) return;
  tbl.innerHTML=interns.map((i,idx)=>{
    const days=8+idx; const hrs=days*7.5; const late=idx===2?2:0; const pct=Math.round(days/20*100);
    return `<tr>
      <td><div class="nm"><div class="ava-sm ${i.color}">${i.name[0]}</div><div class="nm-main">${i.name}</div></div></td>
      <td>${days}</td><td>${hrs.toFixed(0)}</td><td>${late}</td><td>0</td>
      <td><div class="pw"><div class="pb" style="width:80px"><div class="pf ${pct>=80?'pf-t':pct>=60?'pf-a':'pf-r'}" style="width:${pct}%"></div></div><span style="font-size:11px;color:var(--text2)">${pct}%</span></div></td>
      <td>${pct>=80?'<span class="status s-ok">ปกติ</span>':pct>=60?'<span class="status s-warn">ต้องติดตาม</span>':'<span class="status s-bad">ขาดงานมาก</span>'}</td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════
//  RENDER: EVAL FORM
// ═══════════════════════════════════════════
const CRITERIA=[
  {key:'skill',icon:'🔧',label:'ทักษะวิชาชีพ'},
  {key:'responsibility',icon:'📋',label:'ความรับผิดชอบ'},
  {key:'teamwork',icon:'🤝',label:'ทีมเวิร์ค'},
  {key:'communication',icon:'💬',label:'การสื่อสาร'},
  {key:'creativity',icon:'💡',label:'ความคิดสร้างสรรค์'},
  {key:'punctuality',icon:'⏰',label:'ตรงต่อเวลา'},
];
let evalRatings={};

function populateTeacherSelects() {
  ['eval-intern-sel','review-intern-sel'].forEach(id=>{
    const sel=document.getElementById(id); if(!sel) return;
    const isReview=id==='review-intern-sel';
    sel.innerHTML=(isReview?'<option value="all">— ทั้งหมด —</option>':'')+interns.map(i=>`<option value="${i.id}">${i.name}</option>`).join('');
  });
}
function renderEvalPanel() {
  populateTeacherSelects();
  const grid=document.getElementById('eval-criteria-grid'); if(!grid) return;
  grid.innerHTML=CRITERIA.map(c=>`
    <div class="eval-item">
      <div class="eval-lbl">${c.icon} ${c.label}</div>
      <div class="star-grp" id="stars-${c.key}">
        ${[1,2,3,4,5].map(n=>`<button class="star-btn" data-val="${n}" onclick="setStar('${c.key}',${n})">★</button>`).join('')}
        <span style="font-size:11px;color:var(--text2);margin-left:4px" id="sv-${c.key}">—</span>
      </div>
    </div>`).join('');

  renderEvalHistory();
  loadEvalForm();
}
function setStar(key, val) {
  evalRatings[key]=val;
  document.querySelectorAll(`#stars-${key} .star-btn`).forEach(b=>{ b.classList.toggle('on',parseInt(b.dataset.val)<=val); });
  document.getElementById('sv-'+key).textContent=val+'/5';
  const avg=Object.values(evalRatings).length?Object.values(evalRatings).reduce((s,v)=>s+v,0)/Object.values(evalRatings).length:0;
  document.getElementById('eval-overall').value=avg.toFixed(1);
  document.getElementById('eval-overall-val').textContent=avg.toFixed(1);
}
function loadEvalForm() {
  const sel=document.getElementById('eval-intern-sel'); if(!sel||!sel.value) return;
  const intern=interns.find(i=>i.id==sel.value);
  const info=document.getElementById('eval-intern-info'); if(!info) return;
  if(intern) {
    info.style.display='flex';
    document.getElementById('ei-ava').textContent=intern.name[0];
    document.getElementById('ei-ava').className='ipb-ava '+intern.color;
    document.getElementById('ei-name').textContent=intern.name;
    document.getElementById('ei-meta').innerHTML=`<span class="tag tag-b">${intern.uni}</span> &nbsp; <span class="tag tag-t">${intern.dept}</span>`;
    const prevEvals=evaluations.filter(e=>e.internId==intern.id);
    const prev=document.getElementById('ei-prev-score');
    if(prev) prev.innerHTML=prevEvals.length?`<div style="font-size:10px;color:var(--text2)">ประเมินแล้ว ${prevEvals.length} ครั้ง</div><div style="font-family:'Kanit';font-size:20px;font-weight:800;color:var(--teal)">${prevEvals[prevEvals.length-1].overall}</div>`:'<div style="font-size:11px;color:var(--text3)">ยังไม่มีประวัติ</div>';
  }
}
function renderEvalHistory() {
  const hist=document.getElementById('eval-history'); if(!hist) return;
  if(!evaluations.length) { hist.innerHTML='<div style="text-align:center;padding:32px;color:var(--text3);font-size:12px">ยังไม่มีประวัติการประเมิน</div>'; return; }
  hist.innerHTML=evaluations.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>{
    const intern=interns.find(i=>i.id==e.internId);
    return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="ava-sm ${intern?intern.color:'c1'}">${intern?intern.name[0]:'?'}</div>
        <div><div style="font-weight:700;font-size:12px">${intern?intern.name:'นักศึกษา'}</div><div style="font-size:10px;color:var(--text2)">${e.round||''} · ${e.date}</div></div>
        <div style="margin-left:auto;font-family:'Kanit';font-size:20px;font-weight:900;color:var(--teal)">${e.overall}</div>
      </div>
      <div style="font-size:11px;color:var(--text2);line-height:1.6">${e.comment||''}</div>
    </div>`;
  }).join('');
}
function saveDraftEval() { showToast('💾 บันทึกร่างการประเมินแล้ว'); }
function submitEval() {
  const comment=document.getElementById('eval-comment').value.trim();
  const overall=parseFloat(document.getElementById('eval-overall').value);
  const sel=document.getElementById('eval-intern-sel');
  if(!comment) { showToast('กรุณากรอก feedback','err'); return; }
  if(!sel.value) { showToast('กรุณาเลือกนักศึกษา','err'); return; }
  const newEval={id:Date.now(),internId:parseInt(sel.value)||sel.value,overall:overall.toFixed(1),criteria:{...evalRatings},comment,round:document.getElementById('eval-round').value,date:new Date().toISOString().split('T')[0],teacherName:(currentUser&&currentUser.name)||'อาจารย์'};
  evaluations.push(newEval);
  localStorage.setItem('it_evals',JSON.stringify(evaluations));
  document.getElementById('eval-comment').value='';
  evalRatings={};
  CRITERIA.forEach(c=>{ document.querySelectorAll(`#stars-${c.key} .star-btn`).forEach(b=>b.classList.remove('on')); document.getElementById('sv-'+c.key).textContent='—'; });
  renderEvalHistory(); showToast('✅ ส่งผลการประเมินสำเร็จ! นักศึกษาจะได้รับแจ้ง');
}

// ═══════════════════════════════════════════
//  RENDER: REPORTS
// ═══════════════════════════════════════════
function renderReports() {
  const tbl=document.getElementById('t-report-tbl'); if(!tbl) return;
  if(!evaluations.length) {
    tbl.innerHTML='<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">ยังไม่มีข้อมูลการประเมิน</td></tr>';
    // Add sample data
    const sampleEvals=[
      {internId:1,overall:'4.5',criteria:{skill:5,responsibility:4,teamwork:4,communication:4,creativity:5,punctuality:4},teacherName:'ผศ.ดร.อรรถพล',date:'2026-02-10'},
      {internId:2,overall:'4.1',criteria:{skill:4,responsibility:4,teamwork:4,communication:4,creativity:4,punctuality:4},teacherName:'ผศ.ดร.อรรถพล',date:'2026-02-11'},
      {internId:3,overall:'3.8',criteria:{skill:4,responsibility:3,teamwork:4,communication:4,creativity:4,punctuality:3},teacherName:'ผศ.ดร.อรรถพล',date:'2026-02-12'},
    ];
    tbl.innerHTML=sampleEvals.map(e=>{
      const intern=interns.find(i=>i.id===e.internId);
      const grade=parseFloat(e.overall)>=4.5?'A':parseFloat(e.overall)>=4?'B+':parseFloat(e.overall)>=3.5?'B':'B-';
      return `<tr>
        <td><div class="nm"><div class="ava-sm ${intern?intern.color:'c1'}">${intern?intern.name[0]:'?'}</div><div class="nm-main">${intern?intern.name:'?'}</div></div></td>
        <td>${e.criteria.skill||'—'}/5</td><td>${e.criteria.responsibility||'—'}/5</td>
        <td>${e.criteria.teamwork||'—'}/5</td><td>${e.criteria.communication||'—'}/5</td>
        <td><span style="font-family:'Kanit';font-size:15px;font-weight:800;color:var(--teal)">${e.overall}</span></td>
        <td><span style="font-weight:700;color:${parseFloat(e.overall)>=4.5?'var(--emerald)':'var(--amber)'}">${grade}</span></td>
        <td style="font-size:11px;color:var(--text2)">${e.teacherName}</td>
      </tr>`;
    }).join('');
    return;
  }
  tbl.innerHTML=evaluations.map(e=>{
    const intern=interns.find(i=>i.id===e.internId);
    const grade=parseFloat(e.overall)>=4.5?'A':parseFloat(e.overall)>=4?'B+':parseFloat(e.overall)>=3.5?'B':'B-';
    return `<tr>
      <td><div class="nm"><div class="ava-sm ${intern?intern.color:'c1'}">${intern?intern.name[0]:'?'}</div><div class="nm-main">${intern?intern.name:'?'}</div></div></td>
      <td>${e.criteria.skill||'—'}/5</td><td>${e.criteria.responsibility||'—'}/5</td>
      <td>${e.criteria.teamwork||'—'}/5</td><td>${e.criteria.communication||'—'}/5</td>
      <td><span style="font-family:'Kanit';font-size:15px;font-weight:800;color:var(--teal)">${e.overall}</span></td>
      <td><span style="font-weight:700;color:${parseFloat(e.overall)>=4.5?'var(--emerald)':'var(--amber)'}">${grade}</span></td>
      <td style="font-size:11px;color:var(--text2)">${e.teacherName||'อาจารย์'}</td>
    </tr>`;
  }).join('');
}
function exportCSV() { showToast('📥 Export ข้อมูล CSV แล้ว'); }

// ═══════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════
function loadProfile() {
  const saved=JSON.parse(localStorage.getItem('it_profile')||'{}');
  ['p-name','p-sid','p-tel','p-uni','p-fac','p-major','p-comp','p-dept','p-start','p-end','p-sup'].forEach(id=>{
    const el=document.getElementById(id); if(el&&saved[id]) el.value=saved[id];
  });
  const u=currentUser; if(u&&document.getElementById('p-name')&&!saved['p-name']) document.getElementById('p-name').value=u.name||'';
}
function saveProfile() {
  const data={};
  ['p-name','p-sid','p-tel','p-uni','p-fac','p-major','p-comp','p-dept','p-start','p-end','p-sup'].forEach(id=>{
    const el=document.getElementById(id); if(el) data[id]=el.value;
  });
  localStorage.setItem('it_profile',JSON.stringify(data));
  if(data['p-name']&&currentUser) { currentUser.name=data['p-name']; localStorage.setItem('it_user',JSON.stringify(currentUser)); updateUserUI(); }
  showToast('✅ บันทึกข้อมูลสำเร็จ!');
}

// ═══════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════
function closeModal(id, e) { if(e.target===document.getElementById(id)) closeModalById(id); }
function closeModalById(id) { document.getElementById(id).classList.remove('open'); }

// ═══════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════
function showToast(msg, type='ok') {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast'+(type==='err'?' err':'');
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3200);
}

// ═══════════════════════════════════════════
//  DIARY DATE LISTENER
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  HR / COMPANY SYSTEM
// ═══════════════════════════════════════════
let hrInterns = [
  {id:1,name:'สมชาย ใจดี',uni:'จุฬาลงกรณ์มหาวิทยาลัย',dept:'IT / Development',start:'2025-11-01',end:'2026-01-31',progress:75,status:'active',supervisor:'นายอรรถพล ไชยมงคล',email:'somchai@cu.ac.th',color:'c1'},
  {id:2,name:'นางสาววิภา สว่าง',uni:'ม.เกษตรศาสตร์',dept:'Marketing',start:'2025-11-01',end:'2026-01-31',progress:60,status:'active',supervisor:'นางสาวปิยะมาศ ทองดี',email:'wipa@ku.ac.th',color:'c2'},
  {id:3,name:'กิตติพงษ์ ลมเย็น',uni:'ม.ธรรมศาสตร์',dept:'Finance',start:'2025-10-15',end:'2026-01-15',progress:45,status:'pending',supervisor:'นายวิชัย สุขสม',email:'kitti@tu.ac.th',color:'c3'},
  {id:4,name:'ธนภัทร มีสุข',uni:'ม.เชียงใหม่',dept:'IT / Development',start:'2025-12-01',end:'2026-03-01',progress:30,status:'active',supervisor:'นายอรรถพล ไชยมงคล',email:'tana@cmu.ac.th',color:'c4'},
  {id:5,name:'นางสาวพิมพ์ใจ รักษา',uni:'ม.ขอนแก่น',dept:'HR / Admin',start:'2025-11-15',end:'2026-02-15',progress:85,status:'review',supervisor:'นางสาวปรียา สดใส',email:'pim@kku.ac.th',color:'c5'},
  {id:6,name:'ณัฐวุฒิ แก้วใส',uni:'ม.มหิดล',dept:'IT / Development',start:'2025-09-01',end:'2025-11-30',progress:100,status:'done',supervisor:'นายอรรถพล ไชยมงคล',email:'nat@mahidol.ac.th',color:'c6'},
  {id:7,name:'นางสาวพัชรา ดีงาม',uni:'ม.สงขลานครินทร์',dept:'Marketing',start:'2025-11-01',end:'2026-01-31',progress:55,status:'active',supervisor:'นางสาวปิยะมาศ ทองดี',email:'pat@psu.ac.th',color:'c1'},
  {id:8,name:'อภิสิทธิ์ ชัยมงคล',uni:'ม.รังสิต',dept:'Finance',start:'2025-12-01',end:'2026-03-01',progress:20,status:'active',supervisor:'นายวิชัย สุขสม',email:'api@rsu.ac.th',color:'c2'},
];
let hrEvaluations = [
  {internId:1,skill:5,responsibility:4,teamwork:5,communication:4,creativity:4,evaluator:'นางสาวปิยะมาศ ทองดี'},
  {internId:2,skill:4,responsibility:5,teamwork:4,communication:5,creativity:3,evaluator:'นางสาวปิยะมาศ ทองดี'},
  {internId:5,skill:5,responsibility:5,teamwork:4,communication:5,creativity:5,evaluator:'นางสาวปรียา สดใส'},
  {internId:6,skill:4,responsibility:4,teamwork:5,communication:4,creativity:4,evaluator:'นายอรรถพล ไชยมงคล'},
];
let hrEvalRatings = {};
let hrFilterStatus = 'all';
let currentHRPage = 'hr-dashboard';

function launchHR() {
  goScreen('hr');
  const u = currentUser || { name:'HR Admin' };
  document.getElementById('hr-ava').textContent = u.name ? u.name[0] : 'H';
  document.getElementById('hr-uname').textContent = u.name || 'HR Admin';
  document.getElementById('hr-intern-cnt').textContent = hrInterns.length;
  switchHRPage('hr-dashboard');
}

function switchHRPage(name) {
  document.querySelectorAll('#screen-hr .panel').forEach(p=>p.classList.remove('active'));
  const panel = document.getElementById('panel-'+name);
  if(panel) panel.classList.add('active');
  currentHRPage = name;
  document.querySelectorAll('#sidebar-hr .sb-item').forEach(btn=>{
    btn.classList.remove('h-active');
    if(btn.getAttribute('onclick')&&btn.getAttribute('onclick').includes("'"+name+"'")) btn.classList.add('h-active');
  });
  const titles = {'hr-dashboard':'Dashboard สถานประกอบการ','hr-interns':'นักศึกษาฝึกงาน','hr-tracking':'ติดตามความก้าวหน้า','hr-evaluation':'ประเมินผล','hr-reports':'รายงาน','hr-settings':'ตั้งค่า'};
  document.getElementById('hr-page-title').textContent = titles[name]||name;
  // Render content
  if(name==='hr-dashboard') renderHRDashboard();
  else if(name==='hr-interns') renderHRInterns();
  else if(name==='hr-tracking') renderHRTracking();
  else if(name==='hr-evaluation') renderHREval();
}

function hrGetStatusHtml(status) {
  const map = {active:'<span class="status s-ok">กำลังฝึกงาน</span>',pending:'<span class="status s-warn">ต้องติดตาม</span>',review:'<span class="status s-rev">อยู่ระหว่างประเมิน</span>',done:'<span class="status s-done">เสร็จสิ้น</span>'};
  return map[status]||'';
}
function hrGetProgressHtml(p) {
  const cls = p>70?'pf-e':p>40?'pf-t':'pf-a';
  return `<div class="pw"><div class="pb" style="flex:1;height:5px"><div class="pf ${cls}" style="width:${p}%"></div></div><span class="pt">${p}%</span></div>`;
}

function renderHRDashboard() {
  document.getElementById('hr-stat-total').textContent = hrInterns.length;
  document.getElementById('hr-stat-active').textContent = hrInterns.filter(i=>i.status==='active').length;
  document.getElementById('hr-stat-pending').textContent = hrInterns.filter(i=>i.status==='pending'||i.status==='review').length;
  // Quick table
  const qt = document.getElementById('hr-quick-table'); if(!qt) return;
  qt.innerHTML = hrInterns.slice(0,5).map(i=>`<tr>
    <td><div class="nm"><div class="ava-sm ${i.color}">${i.name[0]}</div><div><div class="nm-main">${i.name}</div><div style="font-size:10px;color:var(--text2)">${i.uni}</div></div></div></td>
    <td style="font-size:12px">${i.dept}</td><td style="font-size:12px">${i.end}</td>
    <td>${hrGetProgressHtml(i.progress)}</td><td>${hrGetStatusHtml(i.status)}</td></tr>`).join('');
  // Chart
  const chart = document.getElementById('hr-chart'); if(!chart) return;
  const data=[5,8,10,12,12,8]; const days=['ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.','ม.ค.'];
  chart.innerHTML = data.map((v,i)=>`<div class="bc"><div class="bbar ${i%2?'bb':''}" style="height:${v/12*100}%"></div><div class="blbl">${days[i]}</div></div>`).join('');
}

function hrFilterByStatus(el, status) {
  hrFilterStatus = status;
  document.querySelectorAll('#panel-hr-interns .fchip').forEach(c=>c.classList.remove('fa'));
  el.classList.add('fa');
  renderHRInterns();
}
function hrFilterInterns() { renderHRInterns(); }

function renderHRInterns() {
  const search = (document.getElementById('hr-search').value||'').toLowerCase();
  const filtered = hrInterns.filter(i=>{
    const ms = hrFilterStatus==='all'||i.status===hrFilterStatus;
    const mq = i.name.toLowerCase().includes(search)||i.dept.toLowerCase().includes(search)||i.uni.toLowerCase().includes(search);
    return ms && mq;
  });
  const tbody = document.getElementById('hr-intern-table'); if(!tbody) return;
  tbody.innerHTML = filtered.map(i=>`<tr>
    <td><div class="nm"><div class="ava-sm ${i.color}">${i.name[0]}</div><div><div class="nm-main">${i.name}</div><div style="font-size:10px;color:var(--text2)">${i.email}</div></div></div></td>
    <td style="font-size:12px">${i.uni}</td><td style="font-size:12px">${i.dept}</td>
    <td style="font-size:12px">${i.start}</td><td style="font-size:12px">${i.end}</td>
    <td>${hrGetProgressHtml(i.progress)}</td><td>${hrGetStatusHtml(i.status)}</td>
    <td><div style="display:flex;gap:5px">
      <button class="btn btn-sm btn-outline" onclick="hrOpenDetail(${i.id})">👁 ดู</button>
      <button class="btn btn-sm btn-danger" onclick="hrDeleteIntern(${i.id})">🗑</button>
    </div></td></tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">ไม่พบข้อมูล</td></tr>';
}

function renderHRTracking() {
  const tbody = document.getElementById('hr-tracking-table'); if(!tbody) return;
  const reports=[[true,true,true],[true,false,true],[true,true,false],[false,true,true],[true,true,true],[true,false,false],[true,true,true],[false,true,true]];
  tbody.innerHTML = hrInterns.map((i,idx)=>{
    const rep=reports[idx]||[true,true,true];
    const icon=ok=>ok?'<span style="color:var(--emerald)">✅</span>':'<span style="color:var(--rose)">❌</span>';
    const total=rep.filter(Boolean).length;
    return `<tr><td><div class="nm"><div class="ava-sm ${i.color}">${i.name[0]}</div><div class="nm-main">${i.name}</div></div></td>
    <td style="text-align:center">${icon(rep[0])}</td><td style="text-align:center">${icon(rep[1])}</td><td style="text-align:center">${icon(rep[2])}</td>
    <td>${hrGetProgressHtml(i.progress)}</td>
    <td style="font-size:12px;color:${total<2?'var(--amber)':'var(--text2)'}">${total<2?'⚠ ต้องติดตาม':total===3?'✓ ปกติ':'— ใกล้ครบ'}</td></tr>`;
  }).join('');
}

function renderHREval() {
  const tbody = document.getElementById('hr-eval-table'); if(!tbody) return;
  const stars=n=>'⭐'.repeat(n)+'☆'.repeat(5-n);
  tbody.innerHTML = hrEvaluations.map(e=>{
    const intern=hrInterns.find(i=>i.id===e.internId); if(!intern) return '';
    const avg=((e.skill+e.responsibility+e.teamwork+e.communication)/4).toFixed(1);
    return `<tr><td><div class="nm"><div class="ava-sm ${intern.color}">${intern.name[0]}</div><div class="nm-main">${intern.name}</div></div></td>
    <td>${stars(e.skill)}</td><td>${stars(e.responsibility)}</td><td>${stars(e.teamwork)}</td><td>${stars(e.communication)}</td>
    <td><span style="font-weight:800;color:${parseFloat(avg)>=4.5?'var(--emerald)':'var(--blue)'}">${avg}/5</span></td>
    <td style="font-size:11px;color:var(--text2)">${e.evaluator}</td></tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">ยังไม่มีผลการประเมิน</td></tr>';
  // Populate select
  const sel = document.getElementById('hr-eval-intern-sel'); if(!sel) return;
  sel.innerHTML = '<option value="">-- เลือกนักศึกษา --</option>'+hrInterns.map(i=>`<option value="${i.id}">${i.name}</option>`).join('');
  // Criteria
  const wrap = document.getElementById('hr-eval-criteria'); if(!wrap) return;
  const criteria=[{key:'skill',label:'🔧 ทักษะวิชาชีพ'},{key:'responsibility',label:'📋 ความรับผิดชอบ'},{key:'teamwork',label:'🤝 การทำงานทีม'},{key:'communication',label:'💬 การสื่อสาร'},{key:'creativity',label:'💡 ความคิดสร้างสรรค์'}];
  wrap.innerHTML = criteria.map(c=>`<div class="eval-item"><div class="eval-lbl">${c.label}</div>
    <div class="star-grp" id="hr-stars-${c.key}">
      ${[1,2,3,4,5].map(n=>`<button class="star-btn" data-val="${n}" onclick="setHRStar('${c.key}',${n})">★</button>`).join('')}
      <span style="font-size:11px;color:var(--text2);margin-left:4px" id="hr-sv-${c.key}">—</span>
    </div></div>`).join('');
}

function setHRStar(key,val) {
  hrEvalRatings[key]=val;
  document.querySelectorAll(`#hr-stars-${key} .star-btn`).forEach(b=>b.classList.toggle('on',parseInt(b.dataset.val)<=val));
  document.getElementById('hr-sv-'+key).textContent=val+'/5';
}

function saveHREval() {
  const sel=document.getElementById('hr-eval-intern-sel');
  if(!sel.value){showToast('⚠ กรุณาเลือกนักศึกษา','err');return;}
  hrEvaluations.push({internId:parseInt(sel.value),skill:hrEvalRatings.skill||3,responsibility:hrEvalRatings.responsibility||3,teamwork:hrEvalRatings.teamwork||3,communication:hrEvalRatings.communication||3,creativity:hrEvalRatings.creativity||3,evaluator:(currentUser&&currentUser.name)||'HR'});
  hrEvalRatings={};
  showToast('✅ บันทึกผลการประเมินเรียบร้อยแล้ว!');
  switchHREvalTab('list');
}

function switchHREvalTab(tab) {
  document.getElementById('hr-eval-list').style.display = tab==='list'?'':'none';
  document.getElementById('hr-eval-form').style.display = tab==='form'?'':'none';
  document.getElementById('hr-eval-tab-list').style.background = tab==='list'?'var(--indigo)':'';
  document.getElementById('hr-eval-tab-list').style.color = tab==='list'?'#fff':'';
  document.getElementById('hr-eval-tab-form').style.background = tab==='form'?'var(--indigo)':'';
  document.getElementById('hr-eval-tab-form').style.color = tab==='form'?'#fff':'';
  if(tab==='list') renderHREval();
}

function openHRAddModal() {
  const today=new Date().toISOString().split('T')[0];
  document.getElementById('hr-ai-start').value=today;
  document.getElementById('modal-hr-add').classList.add('open');
}

function addHRIntern() {
  const name=document.getElementById('hr-ai-name').value.trim();
  const uni=document.getElementById('hr-ai-uni').value.trim();
  if(!name||!uni){showToast('⚠ กรุณากรอกชื่อและมหาวิทยาลัย','err');return;}
  const colors=['c1','c2','c3','c4','c5','c6'];
  hrInterns.push({id:Date.now(),name,uni,dept:document.getElementById('hr-ai-dept').value,start:document.getElementById('hr-ai-start').value,end:document.getElementById('hr-ai-end').value,progress:0,status:'active',supervisor:document.getElementById('hr-ai-sup').value,email:document.getElementById('hr-ai-email').value,color:colors[hrInterns.length%6]});
  document.getElementById('modal-hr-add').classList.remove('open');
  showToast('✅ เพิ่มนักศึกษาเรียบร้อยแล้ว!');
  document.getElementById('hr-intern-cnt').textContent=hrInterns.length;
  renderHRDashboard(); renderHRInterns();
}

function hrDeleteIntern(id) {
  if(!confirm('ยืนยันการลบ?')) return;
  hrInterns = hrInterns.filter(i=>i.id!==id);
  showToast('🗑 ลบข้อมูลนักศึกษาแล้ว');
  renderHRInterns();
}

function hrOpenDetail(id) {
  const i=hrInterns.find(x=>x.id===id); if(!i) return;
  showToast(`👁 ${i.name} — ${i.dept} · ความก้าวหน้า ${i.progress}%`);
}

function hrExportCSV() {
  const headers=['ชื่อ','มหาวิทยาลัย','แผนก','เริ่ม','สิ้นสุด','ความก้าวหน้า','สถานะ'];
  const rows=hrInterns.map(i=>[i.name,i.uni,i.dept,i.start,i.end,i.progress+'%',i.status]);
  const csv=[headers,...rows].map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent('\uFEFF'+csv);
  a.download='hr_interns.csv'; a.click();
  showToast('⬇ ดาวน์โหลด CSV แล้ว!');
}

// Auto-restore session
if(currentUser && currentRole) {
  if(currentRole==='hr') { setTimeout(launchHR, 0); }
  else { setTimeout(launchApp, 0); }
}

document.addEventListener('DOMContentLoaded', function() {
  // Set diary date default
  const diaryDate = document.getElementById('diary-date');
  if(diaryDate) diaryDate.value = new Date().toISOString().split('T')[0];
  const manD = document.getElementById('man-d');
  if(manD) manD.value = new Date().toISOString().split('T')[0];
});

// Function to update the extra field label based on the selected role
function updateRegFields() {
    const role = document.getElementById('r-role').value;
    const extraFg = document.getElementById('r-extra-fg');
    const extraLbl = document.getElementById('r-extra-lbl');
    const extraInp = document.getElementById('r-extra');
    
    if (role === 'student') {
        extraFg.style.display = 'block';
        extraLbl.textContent = 'มหาวิทยาลัย';
        extraInp.placeholder = 'ชื่อมหาวิทยาลัย';
    } else if (role === 'hr') {
        extraFg.style.display = 'block';
        extraLbl.textContent = 'บริษัท / องค์กร';
        extraInp.placeholder = 'ชื่อบริษัท';
    } else {
        // Teacher
        extraFg.style.display = 'block';
        extraLbl.textContent = 'คณะ / ภาควิชา';
        extraInp.placeholder = 'ชื่อคณะ';
    }
}

// Function to handle the registration process via Supabase
async function doRegister() {
    const role = document.getElementById('r-role').value;
    const fn = document.getElementById('r-fn').value.trim();
    const ln = document.getElementById('r-ln').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const pw = document.getElementById('r-pw').value;
    const extra = document.getElementById('r-extra').value.trim();

    // 1. Basic Validation
    if (!fn || !ln || !email || !pw) {
        // Assuming you have a toast notification or you can use standard alert()
        alert('กรุณากรอกข้อมูลบังคับให้ครบถ้วน (ชื่อ, นามสกุล, อีเมล, รหัสผ่าน)');
        return;
    }

    if (pw.length < 6) {
        alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
        return;
    }

    // 2. Register user with Supabase
    // Note: Make sure you use 'supabaseClient' if you applied the fix from our previous step!
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: pw,
        options: {
            data: {
                full_name: `${fn} ${ln}`,
                role: role,
                organization: extra
            }
        }
    });

    // 3. Handle response
    if (error) {
        alert('เกิดข้อผิดพลาดในการสมัครสมาชิก: ' + error.message);
        return;
    }

    // Success! Switch them back to the login tab
    alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
    switchLoginTab('login');
}
// ตรวจสอบ Session ทันทีที่เปิดหน้าเว็บ
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        // ถ้ามี Session ใน Supabase แต่ในตัวแปร currentUser ว่าง (เกิดจากการ Refresh หน้าจอ)
        if (!currentUser) {
            currentUser = JSON.parse(localStorage.getItem('it_user'));
            currentRole = localStorage.getItem('it_role');
        }

        if (currentUser) {
            if (currentRole === 'hr') launchHR();
            else launchApp();
        }
    } else {
        // ถ้าไม่มี Session ให้เด้งไปหน้า Landing
        goScreen('landing');
    }
}

// เรียกใช้ฟังก์ชันตรวจสอบ
checkSession();

// เพิ่ม Listener สำหรับตรวจจับการเปลี่ยนแปลงของ Auth (เช่น ล็อกเอาท์จาก Tab อื่น)
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        localStorage.clear();
        goScreen('landing');
    }
});

async function launchApp() {
    goScreen('app');
    updateUserUI();
    buildSidebar();
    
    if (currentRole === 'student') {
        await loadStudentData(); // ดึงข้อมูลจาก Supabase มาโชว์
        switchPanel('s-dash');
    } else {
        // Logic สำหรับอาจารย์
        switchPanel('t-dash');
    }
}

// แก้ไขโค้ดส่วนตรวจสอบ Session เดิมของคุณให้เป็นแบบนี้
async function checkUserSession() {
    // ดึง session ปัจจุบันจาก Supabase SDK
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (session && session.user) {
        console.log("Session found for:", session.user.email);
        
        // ดึงข้อมูลที่เคยเก็บไว้ใน localStorage
        currentUser = JSON.parse(localStorage.getItem('it_user'));
        currentRole = localStorage.getItem('it_role');

        // หากใน localStorage หายไป แต่ใน Supabase ยังอยู่ ให้สร้างใหม่จาก Metadata
        if (!currentUser) {
            currentUser = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata.full_name || 'User'
            };
            currentRole = session.user.user_metadata.role || 'student';
            localStorage.setItem('it_user', JSON.stringify(currentUser));
            localStorage.setItem('it_role', currentRole);
        }

        // นำเข้าสู่หน้าจอที่เหมาะสม
        if (currentRole === 'hr') {
            launchHR();
        } else {
            // ฟังก์ชันเดิมที่คุณใช้เปิดหน้า Student/Teacher
            goScreen('app');
            updateUserUI();
            buildSidebar();
            if (currentRole === 'student') {
                await loadStudentData();
                switchPanel('s-dash');
            } else {
                switchPanel('t-dash');
            }
        }
    } else {
        console.log("No session found, staying on landing page.");
        goScreen('landing');
    }
}

// เรียกใช้ทันทีที่โหลดหน้าเว็บ
checkUserSession();
