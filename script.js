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

    goScreen('login');


    const roleSelect = document.getElementById('r-role');
    if (roleSelect) {
        roleSelect.value = role;
    }
}
async function quickLogin(role) {
    const prefix = role === 'student' ? 's' : (role === 'teacher' ? 't' : 'h');
    const email = document.getElementById(`ql-${prefix}-email`).value;
    let pw = document.getElementById(`ql-${prefix}-pw`).value;

    const btn = event.target;
    const originalText = btn.innerHTML;

    // 🔥 ล็อคปุ่มตรงนี้! ไม่ให้กดซ้ำ
    btn.innerHTML = 'กำลังเข้าสู่ระบบ... ⏳';
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });

    if (error) {
        alert('เข้าสู่ระบบล้มเหลว: ' + error.message);
        // ปลดล็อคปุ่มถ้าล็อกอินพลาด ให้กดใหม่ได้
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    } else {
        await fetchUserProfileAndRoute(data.user);
    }
}
async function fetchUserProfileAndRoute(user) {
    // โยนหน้าที่ให้ checkUserSession จัดการดึงข้อมูลทั้งหมด
    await checkUserSession();
}



// ═══════════════════════════════════════════
//  3. ระบบ LOGIN / AUTH
// ═══════════════════════════════════════════
function switchLoginTab(tab) {
    document.getElementById('lt-login').classList.toggle('active', tab === 'login');
    document.getElementById('lt-reg').classList.toggle('active', tab === 'register');
    document.getElementById('form-login').style.display = tab === 'login' ? '' : 'none';
    document.getElementById('form-register').style.display = tab === 'register' ? '' : 'none';
}
function togglePw(id, btn) {
    const inp = document.getElementById(id);
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}
function showLoginError(msg) {
    const errBox = document.getElementById('login-err');
    if (errBox) {
        errBox.textContent = msg;
        errBox.style.display = 'block';
        setTimeout(() => errBox.style.display = 'none', 3000);
    } else {
        alert(msg);
    }
}
async function doLogin() {
    const email = document.getElementById('l-email').value;
    let pw = document.getElementById('l-pw').value;

    if (!email || !pw) {
        showLoginError('กรุณากรอกอีเมลและรหัสผ่าน');
        return;
    }
    if (pw === '1234') pw = '123456';

    const btn = document.querySelector('#form-login .l-submit');
    const originalText = btn.innerHTML;

    // 🔥 ล็อคปุ่ม
    btn.innerHTML = 'กำลังตรวจสอบ... ⏳';
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });

    if (error) {
        showLoginError('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่');
        // ปลดล็อคปุ่ม
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    } else {
        await fetchUserProfileAndRoute(data.user);
    }
}
async function doLogout() {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('it_user');
    localStorage.removeItem('it_role');
    currentUser = null;
    currentRole = null;
    window.location.reload(); // กลับไปหน้า Landing
}

// ═══════════════════════════════════════════
// โหลดข้อมูลสำหรับหน้า "นักศึกษา" (Student Data)
// ═══════════════════════════════════════════
async function loadStudentData() {
    if (!currentUser) return;

    try {
        // 1. ดึงข้อมูลบันทึกประจำวัน
        const { data: dData } = await supabaseClient
            .from('diaries')
            .select('*')
            .eq('student_id', currentUser.id)
            .order('date', { ascending: false });
        diaries = dData || [];

        // 2. ดึงข้อมูลเวลาเข้า-ออกงาน
        const { data: aData } = await supabaseClient
            .from('attendance')
            .select('*')
            .eq('student_id', currentUser.id)
            .order('date', { ascending: false });
        
        // 🚀 Map ข้อมูลให้ตรงกับตัวแปรที่ใช้ใน UI ฝั่งนักศึกษา
        attendances = (aData || []).map(a => ({
            id: a.id,
            date: a.date,
            inTime: a.check_in,
            outTime: a.check_out,
            hours: a.total_hours,
            late: a.is_late,
            note: a.note
        }));

        // 3. ดึงผลการประเมิน
        const { data: evalData } = await supabaseClient
            .from('evaluations')
            .select('*')
            .eq('intern_id', currentUser.id) 
            .order('date', { ascending: false });

        evaluations = (evalData || []).map(e => ({
            id: e.id,
            internId: e.intern_id,
            overall: e.overall_score || 0,
            comment: e.comment || '',
            round: e.eval_round || 'ประเมินผล',
            date: e.date,
            teacherName: e.teacher_name || 'อาจารย์ที่ปรึกษา',
            criteria: {
                skill: e.skill_score || 0,
                responsibility: e.responsibility_score || 0,
                teamwork: e.teamwork_score || 0,
                communication: e.communication_score || 0,
                creativity: e.creativity_score || 0,
                punctuality: e.punctuality_score || 0
            }
        }));

        // 4. สั่งวาด UI ใหม่
        renderStudentDash();
        renderStudentEval(); 
        if (typeof renderDiaryPanel === 'function') renderDiaryPanel();
        if (typeof renderAttPanel === 'function') renderAttPanel();
        startClock();

    } catch (err) {
        console.error("❌ loadStudentData Error:", err.message);
    }
}

function updateUserUI() {
    const u = currentUser || { name: 'ผู้ใช้', role: 'student' };
    const ava = u.name ? u.name[0] : '?';
    document.getElementById('sb-ava').textContent = ava;
    document.getElementById('sb-uname').textContent = u.name;
    document.getElementById('sb-urole').textContent = currentRole === 'teacher' ? 'อาจารย์ที่ปรึกษา' : 'นักศึกษา';
    const badge = document.getElementById('sb-badge');
    if (currentRole === 'teacher') {
        badge.className = 'sb-role-badge rb-t'; badge.textContent = '👨‍🏫 อาจารย์ที่ปรึกษา';
        document.getElementById('sb-ava').className = 'sb-ava ava-b';
    } else {
        badge.className = 'sb-role-badge rb-s'; badge.textContent = '🎒 นักศึกษา';
        document.getElementById('sb-ava').className = 'sb-ava ava-t';
    }
    if (document.getElementById('s-welcome-msg')) {
        document.getElementById('s-welcome-msg').textContent = `สวัสดี ${u.name}! ดูภาพรวมการฝึกงานของคุณ`;
    }
}

function buildSidebar() {
    const nav = document.getElementById('sb-nav');
    if (currentRole === 'student') {
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
        const pendingCount = diaries.filter(d => d.status === 'pending').length;
        const badgeHtml = pendingCount > 0 ? `<span class="sb-bdg w">${pendingCount}</span>` : '';

        nav.innerHTML = `
  <div class="sb-sec"><div class="sb-sec-lbl">ภาพรวม</div>
    <button class="sb-item" onclick="switchPanel('t-dash')"><span class="sb-icon">🏠</span>Dashboard</button>
    <button class="sb-item" onclick="switchPanel('t-interns')"><span class="sb-icon">👥</span>รายชื่อนักศึกษา <span class="sb-bdg">${interns.length}</span></button>
  </div>
  <div class="sb-sec"><div class="sb-sec-lbl">ติดตาม</div>
    <button class="sb-item" onclick="switchPanel('t-review')"><span class="sb-icon">📝</span>ตรวจบันทึก ${badgeHtml}</button>
    <button class="sb-item" onclick="switchPanel('t-att')"><span class="sb-icon">⏰</span>เวลาเข้างาน</button>
  </div>
  ...`;
    }
}

function switchPanel(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + id);
    if (panel) panel.classList.add('active');
    currentPanel = id;

    // Sidebar active
    document.querySelectorAll('.sb-item').forEach(btn => {
        btn.classList.remove('active', 't-active');
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes("'" + id + "'")) {
            btn.classList.add(currentRole === 'teacher' ? 't-active' : 'active');
        }
    });

    // Title
    const titles = { 's-dash': 'Dashboard', 's-diary': 'บันทึกประจำวัน', 's-att': 'เวลาเข้า-ออกงาน', 's-eval': 'ผลการประเมิน', 's-profile': 'ข้อมูลส่วนตัว', 't-dash': 'Dashboard อาจารย์', 't-interns': 'รายชื่อนักศึกษา', 't-review': 'ตรวจบันทึกประจำวัน', 't-att': 'ติดตามเวลาเข้างาน', 't-eval': 'ประเมินผล', 't-reports': 'รายงานสรุป' };
    document.getElementById('tb-title').textContent = titles[id] || id;

    // Topbar action
    const actionBtn = document.getElementById('tb-action-btn');
    if (id === 's-diary') { actionBtn.textContent = '+ บันทึกวันนี้'; actionBtn.style.display = ''; }
    else if (id === 't-interns') { actionBtn.textContent = '+ เพิ่มนักศึกษา'; actionBtn.style.display = ''; }
    else { actionBtn.style.display = 'none'; }

    // Render per panel
    const renders = { 's-dash': renderStudentDash, 's-diary': renderDiaryPanel, 's-att': renderAttPanel, 's-eval': renderStudentEval, 't-dash': renderTeacherDash, 't-interns': renderInternList, 't-review': renderReviewPanel, 't-att': renderTeacherAtt, 't-eval': renderEvalPanel, 't-reports': renderReports, 's-profile': loadProfile };
    if (renders[id]) renders[id]();
}

function tbAction() {
    if (currentPanel === 's-diary') { document.getElementById('d-title').focus(); showToast('📝 กรอกบันทึกในแบบฟอร์มด้านซ้าย'); }
    else if (currentPanel === 't-interns') openAddInternModal();
}
function handleSearch() { }

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
    const ds = now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    ['d-clock', 'cw-clock'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ts; });
    ['d-date-lbl', 'cw-date-lbl'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ds; });
    if (checkedIn && sessionStart) {
        const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
        const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
        const hStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        const el = document.getElementById('att-sess'); if (el) el.textContent = '⏱ ' + hStr;
        const we = document.getElementById('d-worked'); if (we) we.textContent = h + 'ชม. ' + m + 'น.';
    }
}
function checkTodayAttendance() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayAtt = attendances.find(a => a.date === todayStr);
    
    if (todayAtt) {
        ['d-in-t'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = todayAtt.inTime || '—'; });
        
        if (todayAtt.outTime) {
            // กรณีเช็คเอาท์แล้ว
            ['d-out-t'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = todayAtt.outTime; });
            ['d-worked'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = (todayAtt.hours || '0') + ' ชม.'; });
            setCheckoutState(true);
        } else {
            // กรณีเช็คอินแล้ว แต่ยังทำงานอยู่
            checkedIn = true; 
            if (todayAtt.inTime) {
                const [h, m] = todayAtt.inTime.split(':');
                const start = new Date();
                start.setHours(parseInt(h), parseInt(m), 0, 0);
                sessionStart = start.getTime(); // เริ่มนับเวลาจากตอนที่เช็คอินจริง
            } else {
                sessionStart = Date.now();
            }
            setCheckinState(false);
        }
    }
}
function setCheckinState(justIn) {
    ['d-ci-btn', 'att-ci-btn'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    ['d-co-btn', 'att-co-btn'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
}
function setCheckoutState(done) {
    ['d-ci-btn', 'att-ci-btn'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    ['d-co-btn', 'att-co-btn'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const el2 = document.getElementById('att-sess'); if (el2) el2.textContent = '✅ เช็คเอาท์แล้ว';
}

// ═══════════════════════════════════════════
//  ATTENDANCE
// ═══════════════════════════════════════════
async function checkIn() {
    if (checkedIn) { showToast('คุณเช็คอินแล้ว!'); return; }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (attendances.find(a => a.date === todayStr)) { showToast('เช็คอินแล้ววันนี้!'); return; }

    const timeStr = now.toTimeString().substring(0, 5);
    const late = now.getHours() >= 9; // หลัง 9 โมงถือว่าสาย

    // 🚀 ยิงข้อมูลเข้า Supabase
    const { error } = await supabaseClient.from('attendance').insert({
        student_id: currentUser.id,
        date: todayStr,
        check_in: timeStr,
        is_late: late,
        note: ''
    });

    if (error) { showToast('❌ เช็คอินไม่สำเร็จ: ' + error.message, 'err'); return; }

    checkedIn = true; sessionStart = Date.now(); todayInTime = timeStr;
    ['d-in-t'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = timeStr; });
    setCheckinState(true);
    showToast(`🟢 เช็คอินสำเร็จ! เวลา ${timeStr} ${late ? '⚠ มาสาย' : ''}`);

    await loadStudentData(); // โหลดข้อมูลใหม่มาอัปเดตตาราง
}
async function checkOut() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const att = attendances.find(a => a.date === todayStr);

    if (!att || !att.inTime) { showToast('ยังไม่ได้เช็คอิน!', 'err'); return; }

    const timeStr = now.toTimeString().substring(0, 5);
    const inParts = att.inTime.split(':');
    const outParts = timeStr.split(':');
    const hrs = ((parseInt(outParts[0]) * 60 + parseInt(outParts[1])) - (parseInt(inParts[0]) * 60 + parseInt(inParts[1]))) / 60;

    // 🚀 อัปเดตข้อมูลเวลาออกงานใน Supabase
    const { error } = await supabaseClient.from('attendance').update({
        check_out: timeStr,
        total_hours: hrs.toFixed(1)
    }).eq('student_id', currentUser.id).eq('date', todayStr);

    if (error) { showToast('❌ เช็คเอาท์ไม่สำเร็จ: ' + error.message, 'err'); return; }

    checkedIn = false; sessionStart = null;
    ['d-out-t'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = timeStr; });
    ['d-worked'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = hrs.toFixed(1) + ' ชม.'; });
    setCheckoutState(true);
    showToast(`🔴 เช็คเอาท์สำเร็จ! ${hrs.toFixed(1)} ชั่วโมงวันนี้`);

    await loadStudentData();
}

async function addManualEntry() {
    const d = document.getElementById('man-d').value;
    const inT = document.getElementById('man-in').value;
    const outT = document.getElementById('man-out').value;
    const note = document.getElementById('man-note').value;

    if (!d || !inT || !outT) { showToast('กรุณากรอกข้อมูลให้ครบ', 'err'); return; }

    const inP = inT.split(':');
    const outP = outT.split(':');
    const hrs = ((parseInt(outP[0]) * 60 + parseInt(outP[1])) - (parseInt(inP[0]) * 60 + parseInt(inP[1]))) / 60;
    const late = parseInt(inP[0]) >= 9;

    const btn = event.target;
    btn.disabled = true;

    // 🚀 ใช้ Upsert (ถ้ามีข้อมูลวันนั้นอยู่แล้วให้ทับ ถ้าไม่มีให้สร้างใหม่)
    const { error } = await supabaseClient.from('attendance').upsert({
        student_id: currentUser.id,
        date: d,
        check_in: inT,
        check_out: outT,
        total_hours: hrs.toFixed(1),
        is_late: late,
        note: note
    }, { onConflict: 'student_id, date' });

    btn.disabled = false;
    if (error) { showToast('❌ บันทึกไม่สำเร็จ: ' + error.message, 'err'); return; }

    document.getElementById('man-d').value = ''; document.getElementById('man-note').value = '';
    showToast('✅ บันทึกเวลาสำเร็จ!');
    await loadStudentData();
}

// ═══════════════════════════════════════════
//  DIARY
// ═══════════════════════════════════════════
function updateDiaryCount() {
    const v = document.getElementById('d-work').value;
    const el = document.getElementById('d-char'); if (el) el.textContent = v.length + ' ตัวอักษร';
}
function pickMood(btn, mood) {
    document.querySelectorAll('.mood-opt').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel'); selectedMood = mood;
}
function addSkill() {
    const inp = document.getElementById('skill-inp'); const v = inp.value.trim();
    if (!v) return;
    const chip = document.createElement('div'); chip.className = 'skill-chip';
    chip.innerHTML = v + ' <span class="rm" onclick="this.parentElement.remove()">×</span>';
    document.getElementById('skill-tags').appendChild(chip);
    inp.value = '';
}
function saveDraft() { showToast('💾 บันทึกร่างแล้ว'); }
async function submitDiary() {
    const title = document.getElementById('d-title').value.trim();
    const work = document.getElementById('d-work').value.trim();
    if (!title || !work) { showToast('กรุณากรอกหัวข้อและรายละเอียดงาน', 'err'); return; }

    const date = document.getElementById('diary-date').value || new Date().toISOString().split('T')[0];
    const skills = Array.from(document.querySelectorAll('#skill-tags .skill-chip')).map(c => c.textContent.replace('×', '').trim());
    const learn = document.getElementById('d-learn').value;
    const prob = document.getElementById('d-prob').value;
    const hrs = document.getElementById('d-hrs').value;
    const diff = document.getElementById('d-diff').value;

    const btn = event.target;
    const origText = btn.innerHTML;
    btn.innerHTML = 'กำลังส่ง... ⏳';
    btn.disabled = true;

    // 🚀 ส่งข้อมูลเข้า Supabase (รวมข้อมูลเรียนรู้และปัญหาเข้าด้วยกัน)
    const { error } = await supabaseClient.from('diaries').upsert({
        student_id: currentUser.id,
        date: date,
        title: title,
        work_detail: work,
        learning_detail: learn + (prob ? `\n\n[อุปสรรค/แผน] : ${prob}` : ''),
        hours_worked: parseInt(hrs),
        difficulty: diff,
        mood: selectedMood,
        skills: skills,
        status: 'pending' // รอกลับไปให้สถานะรอตรวจเสมอ
    }, { onConflict: 'student_id, date' });

    btn.innerHTML = origText;
    btn.disabled = false;

    if (error) { showToast('❌ ส่งบันทึกไม่สำเร็จ: ' + error.message, 'err'); return; }

    showToast('✅ ส่งบันทึกสำเร็จ! อาจารย์จะตรวจสอบเร็วๆ นี้');

    // ล้างค่าฟอร์ม
    document.getElementById('d-title').value = '';
    document.getElementById('d-work').value = '';
    document.getElementById('d-learn').value = '';
    document.getElementById('d-prob').value = '';
    document.getElementById('skill-tags').innerHTML = '';

    // โหลดข้อมูลใหม่เพื่อโชว์ทางขวา
    await loadStudentData();
}

// ═══════════════════════════════════════════
//  RENDER: STUDENT DASHBOARD
// ═══════════════════════════════════════════
function renderStudentDash() {
    // 📊 คำนวณชั่วโมงรวม
    const totalHrs = attendances.reduce((s, a) => s + (parseFloat(a.hours) || 0), 0);
    
    // 📊 ดึงคะแนนประเมินล่าสุด (แก้บั๊ก internId === 0)
    const lastEval = [...evaluations].sort((a, b) => b.date.localeCompare(a.date))[0];

    // อัปเดตตัวเลขใน Dashboard
    const el1 = document.getElementById('sd-diaries'); if (el1) el1.textContent = diaries.length;
    const el2 = document.getElementById('sd-hours'); if (el2) el2.textContent = Math.round(totalHrs);
    const el3 = document.getElementById('sd-score'); if (el3) el3.textContent = lastEval ? lastEval.overall.toFixed(1) : '—';

    // 📋 วาดรายการบันทึกล่าสุด
    const recentEl = document.getElementById('sd-recent');
    if (recentEl) {
        if (!diaries.length) { 
            recentEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:12px">📭 ยังไม่มีบันทึก</div>'; 
        } else {
            recentEl.innerHTML = diaries.slice(0, 3).map(d => {
                const statusCls = d.status === 'approved' ? 'dcc-ok' : d.status === 'commented' ? 'dcc-c' : 'dcc-p';
                const statusTxt = d.status === 'approved' ? 'อนุมัติ' : d.status === 'commented' ? 'มี comment' : 'รอตรวจ';
                const borderCls = d.status === 'approved' ? 'dc-ok' : d.status === 'commented' ? 'dc-cmt' : 'dc-pend';
                return `<div class="diary-card ${borderCls}">
                    <div class="dc-top"><span>${d.mood || '😐'}</span><span class="dc-date">${d.date}</span><span class="dc-chip ${statusCls}">${statusTxt}</span></div>
                    <div class="dc-title" style="font-weight:bold">${d.title || 'ไม่มีหัวข้อ'}</div>
                    <div class="dc-preview" style="font-size:12px; color:var(--text2); margin-top:5px">${d.work_detail || d.work || ''}</div>
                </div>`;
            }).join('');
        }
    }

    // 📅 วาดตารางสัปดาห์ (ส่งบันทึกครบไหม)
    renderWeekGrid('s-week-grid', 'wk-sent', 'wk-left');
}

function renderWeekGrid(gridId, sentId, leftId) {
    const grid = document.getElementById(gridId); if (!grid) return;
    const today = new Date(); const todayStr = today.toISOString().split('T')[0];
    const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const days = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']; let sent = 0; let cells = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(mon); d.setDate(mon.getDate() + i);
        const str = d.toISOString().split('T')[0];
        const isToday = str === todayStr, isWE = i >= 5, hasEntry = diaries.some(e => e.date === str);
        if (hasEntry && !isWE) sent++;
        const cls = isWE ? 'ad-off' : hasEntry ? 'ad-ok' : isToday ? 'ad-today' : '';
        cells += `<div class="att-day ${cls}">${days[i]}</div>`;
    }
    grid.innerHTML = cells;
    const se = document.getElementById(sentId); if (se) se.textContent = sent;
    const le = document.getElementById(leftId); if (le) le.textContent = Math.max(0, 5 - sent);
}

function diaryMini(d) {
    const statusCls = d.status === 'approved' ? 'dcc-ok' : d.status === 'commented' ? 'dcc-c' : 'dcc-p';
    const statusTxt = d.status === 'approved' ? 'อนุมัติ' : d.status === 'commented' ? 'มี comment' : 'รอตรวจ';
    const borderCls = d.status === 'approved' ? 'dc-ok' : d.status === 'commented' ? 'dc-cmt' : 'dc-pend';
    return `<div class="diary-card ${borderCls}">
    <div class="dc-top"><span>${d.mood}</span><span class="dc-date">${d.date}</span><span class="dc-chip ${statusCls}">${statusTxt}</span></div>
    <div class="dc-title">${d.title}</div>
    <div class="dc-preview">${d.work}</div>
    ${d.skills && d.skills.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:7px">${d.skills.map(s => `<span class="skill-chip" style="font-size:10px;padding:2px 7px">${s}</span>`).join('')}</div>` : ''}
    ${d.comment ? `<div class="dc-cmt-box"><div class="dc-cmt-from">💬 ${d.commenter}</div>${d.comment}</div>` : ''}
  </div>`;
}

// ═══════════════════════════════════════════
//  RENDER: DIARY PANEL
// ═══════════════════════════════════════════
function renderDiaryPanel() {
    const todayStr = new Date().toISOString().split('T')[0];
    const dateInp = document.getElementById('diary-date');
    if (dateInp && !dateInp.value) dateInp.value = todayStr;
    updateWeekday();

    const hist = document.getElementById('diary-hist'); if (!hist) return;
    const cnt = document.getElementById('diary-cnt'); if (cnt) cnt.textContent = diaries.length + ' รายการ';
    if (!diaries.length) { hist.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:12px">📭 ยังไม่มีบันทึก</div>'; return; }
    hist.innerHTML = diaries.map(d => diaryMini(d)).join('');
}
function updateWeekday() {
    const dateInp = document.getElementById('diary-date'); if (!dateInp) return;
    const d = new Date(dateInp.value || new Date());
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const el = document.getElementById('diary-wday'); if (el) el.textContent = 'วัน' + days[d.getDay()];
}

// ═══════════════════════════════════════════
//  RENDER: ATTENDANCE PANEL
// ═══════════════════════════════════════════
function renderAttPanel() {
    const totalHrs = attendances.reduce((s, a) => s + (parseFloat(a.hours) || 0), 0);
    const totalDays = attendances.filter(a => a.outTime).length;
    const lateDays = attendances.filter(a => a.late).length;
    ['att-days', 'td-days'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = totalDays; });
    ['att-hrs', 'td-hrs'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = Math.round(totalHrs); });
    const el3 = document.getElementById('att-late'); if (el3) el3.textContent = lateDays;
    const el4 = document.getElementById('att-abs'); if (el4) el4.textContent = 0;

    const monHours = Math.min(Math.round(totalHrs), 168);
    const el5 = document.getElementById('att-mon-h'); if (el5) el5.textContent = monHours + '/168';
    const el6 = document.getElementById('att-mon-pb'); if (el6) el6.style.width = Math.round(monHours / 168 * 100) + '%';
    const pct = totalDays > 0 ? Math.round(totalDays / (totalDays + 0) * 100) : 100;
    const el7 = document.getElementById('att-pct'); if (el7) el7.textContent = pct + '%';
    const el8 = document.getElementById('att-pct-pb'); if (el8) el8.style.width = pct + '%';

    // History
    const hist = document.getElementById('att-hist'); if (!hist) return;
    if (!attendances.length) { hist.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:12px">ยังไม่มีข้อมูล</div>'; return; }
    hist.innerHTML = attendances.slice(0, 20).map(a => `
    <div class="time-row">
      <div class="t-date">${a.date}</div>
      <div class="t-in">${a.inTime || '—'}</div>
      <div class="t-out">${a.outTime || '—'}</div>
      <div class="t-hrs">${a.hours ? a.hours + ' ชม.' : 'กำลังทำงาน'}</div>
      <div>${a.late ? '<span class="status s-warn">มาสาย</span>' : '<span class="status s-ok">ปกติ</span>'}</div>
      <div class="t-note">${a.note || ''}</div>
    </div>`).join('');

    // Bar chart
    renderAttBars();
}

function renderAttBars() {
    const bars = document.getElementById('att-bars'); if (!bars) return;
    const today = new Date(); const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const days = ['จ', 'อ', 'พ', 'พฤ', 'ศ']; let cells = '';
    for (let i = 0; i < 5; i++) {
        const d = new Date(mon); d.setDate(mon.getDate() + i);
        const str = d.toISOString().split('T')[0];
        const att = attendances.find(a => a.date === str);
        const hrs = att && att.hours ? parseFloat(att.hours) : 0;
        const h = Math.round(hrs / 9 * 100);
        cells += `<div class="bc"><div class="bbar" style="height:${h}%"></div><div class="blbl">${days[i]}</div></div>`;
    }
    bars.innerHTML = cells;
}

// ═══════════════════════════════════════════
//  RENDER: STUDENT EVAL
// ═══════════════════════════════════════════
function renderStudentEval(selectedId = null) {
    const wrap = document.getElementById('s-eval-wrap');
    if (!wrap) return;

    if (!evaluations || evaluations.length === 0) {
        wrap.innerHTML = `<div style="text-align:center;padding:56px;color:var(--text3)">ยังไม่มีผลประเมิน</div>`;
        return;
    }

    // เรียงลำดับจากใหม่ไปเก่า
    const sortedEvals = [...evaluations].sort((a, b) => b.date.localeCompare(a.date));
    
    // 🚀 เลือกอันที่ถูกคลิก หรือถ้าไม่ได้คลิกให้เอาอันล่าสุด
    const currentEval = selectedId ? sortedEvals.find(e => e.id === selectedId) : sortedEvals[0];

    if (!currentEval) return;

    const grade = currentEval.overall >= 4.5 ? 'A' : currentEval.overall >= 4 ? 'B+' : currentEval.overall >= 3.5 ? 'B' : 'C';

    const critNames = { 
        skill: '🔧 ทักษะวิชาชีพ', responsibility: '📋 ความรับผิดชอบ', teamwork: '🤝 ทีมเวิร์ค', 
        communication: '💬 สื่อสาร', creativity: '💡 ความคิดสร้างสรรค์', punctuality: '⏰ ตรงต่อเวลา' 
    };

    wrap.innerHTML = `
        <div class="score-hero">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--text2);margin-bottom:8px">คะแนนรวม (${currentEval.round})</div>
            <div class="score-big-num">${currentEval.overall.toFixed(1)}<span style="font-size:24px;color:var(--text2);font-weight:400">/5.0</span></div>
            <div class="score-grade">เกรด ${grade}</div>
        </div>
        <div class="grid2">
            <div class="card">
                <div class="card-head"><div class="card-title">📊 คะแนนรายเกณฑ์</div></div>
                <div class="card-body">
                    ${Object.entries(currentEval.criteria).map(([k, v]) => `
                        <div style="margin-bottom:12px">
                            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                                <span style="font-size:12px">${critNames[k] || k}</span>
                                <span style="font-size:12px;font-weight:700;color:${v >= 4 ? 'var(--teal)' : 'var(--amber)'}">${v}/5</span>
                            </div>
                            <div class="pb" style="height:6px"><div class="pf pf-t" style="width:${(v / 5) * 100}%"></div></div>
                        </div>`).join('')}
                </div>
            </div>
            <div class="card">
                <div class="card-head"><div class="card-title">💬 Feedback จากอาจารย์</div></div>
                <div class="card-body">
                    <div style="font-size:13px;line-height:1.8;color:var(--text2)">${currentEval.comment || 'ไม่มีความเห็น'}</div>
                    <div style="font-size:11px;color:var(--text3);margin-top:10px">โดย: ${currentEval.teacherName}</div>
                </div>
            </div>
        </div>
        
        <div class="card" style="margin-top:20px">
            <div class="card-head">
                <div class="card-title">📜 ประวัติการประเมินทั้งหมด</div>
                <span style="font-size:11px;color:var(--text3)">คลิกเพื่อดูรายละเอียด</span>
            </div>
            <div class="card-body">
                ${sortedEvals.map(e => `
                    <div onclick="renderStudentEval(${e.id})" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border); cursor:pointer; border-radius:8px; transition:0.2s; background:${e.id === currentEval.id ? 'rgba(0, 201, 167, 0.05)' : 'transparent'}; border-left:${e.id === currentEval.id ? '3px solid var(--teal)' : '3px solid transparent'}">
                        <div>
                            <div style="font-weight:700; font-size:13px; color:${e.id === currentEval.id ? 'var(--teal)' : 'var(--text)'}">${e.round}</div>
                            <div style="font-size:11px; color:var(--text3)">${e.date}</div>
                        </div>
                        <div style="font-weight:800; color:var(--text)">${parseFloat(e.overall).toFixed(1)}/5.0</div>
                    </div>`).join('')}
            </div>
        </div>`;
}

// ═══════════════════════════════════════════
//  RENDER: TEACHER DASHBOARD
// ═══════════════════════════════════════════


function statusBadge(s) {
    const map = { active: '<span class="status s-ok">กำลังฝึกงาน</span>', pending: '<span class="status s-warn">ต้องติดตาม</span>', done: '<span class="status s-done">เสร็จสิ้น</span>' };
    return map[s] || s;
}

// ═══════════════════════════════════════════
//  RENDER: INTERN LIST
// ═══════════════════════════════════════════
// ตัวแปรเก็บสถานะ Filter ปัจจุบัน (เพิ่มไว้ด้านบนของไฟล์หรือก่อนฟังก์ชันก็ได้)
let currentInternFilter = 'all';

function renderInternList(filter) {
    const tbl = document.getElementById('t-intern-list');
    if (!tbl) return;

    tbl.innerHTML = interns.map(i => {
        // คำนวณ Progress (ป้องกัน undefined)
        const myAtt = allInternsAttendance.filter(a => a.student_id === i.id).length;
        const progress = Math.min(100, Math.round((myAtt / 60) * 100)) || 0; 

        return `
        <tr>
          <td>
            <div class="nm">
              <div class="ava-sm ${i.color}">${i.name[0]}</div>
              <div><div class="nm-main">${i.name}</div><div class="nm-sub">${i.email}</div></div>
            </div>
          </td>
          <td>${i.uni}</td>
          <td>${i.dept}</td>
          <td>
            <div class="pw">
              <div class="pb"><div class="pf ${progress >= 80 ? 'pf-e' : progress >= 50 ? 'pf-t' : 'pf-r'}" style="width:${progress}%"></div></div>
              <div class="pt">${progress}%</div>
            </div>
          </td>
          <td><span class="status s-ok">กำลังฝึกงาน</span></td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm btn-outline" onclick="goEvalIntern('${i.id}')">⭐ ประเมิน</button>
              <button class="btn btn-sm btn-danger" onclick="removeIntern('${i.id}')">🗑 เอาออก</button>
            </div>
          </td>
        </tr>`;
    }).join('');
}
// แก้ฟังก์ชัน filterInterns ให้เรียกใช้งานได้ถูกต้อง
function filterInterns(btn, filter) {
    document.querySelectorAll('#panel-t-interns .fchip').forEach(c => c.classList.remove('fa'));
    btn.classList.add('fa');
    renderInternList(filter); // ส่งค่า filter ไปบันทึกและวาดใหม่
}
function goEvalIntern(id) {
    switchPanel('t-eval');
    const sel = document.getElementById('eval-intern-sel'); if (sel) { sel.value = id; loadEvalForm(); }
}
async function removeIntern(studentId) {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบนักศึกษาคนนี้ออกจากการดูแล?')) return;

    // 🚀 ลบข้อมูลออกจากตาราง student_profiles
    const { error } = await supabaseClient
        .from('student_profiles')
        .delete()
        .eq('student_id', studentId);

    if (error) {
        showToast('❌ ลบไม่สำเร็จ: ' + error.message, 'err');
    } else {
        showToast('🗑 ลบนักศึกษาเรียบร้อยแล้ว');
        await loadTeacherData(); // โหลดข้อมูลตารางใหม่ทันที
    }
}
function openAddInternModal() { document.getElementById('modal-add-intern').classList.add('open'); }
// ฟังก์ชันดึงนักศึกษาที่มีอยู่แล้วในระบบเข้ามาในการดูแล
// 1. ฟังก์ชันค้นหาชื่อนักศึกษาสำหรับอาจารย์
async function searchStudentForTeacher(val) {
    const list = document.getElementById('t-search-results');
    if (!val || val.length < 2) { list.style.display = 'none'; return; }

    // ค้นหาจากตาราง profiles โดยกรองเฉพาะ role student
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'student')
        .ilike('full_name', `%${val}%`)
        .limit(5);

    if (data && data.length > 0) {
        list.innerHTML = data.map(s => `
            <div class="search-item" onclick="selectStudentForTeacher('${s.id}', '${s.full_name}', '${s.email}')">
                <strong>${s.full_name}</strong><br>
                <small>${s.email}</small>
            </div>
        `).join('');
        list.style.display = 'block';
    } else {
        list.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--text3)">ไม่พบรายชื่อนักศึกษา</div>';
        list.style.display = 'block';
    }
}

// 2. ฟังก์ชันเมื่อกดเลือกนักศึกษาจากรายการค้นหา
function selectStudentForTeacher(id, name, email) {
    document.getElementById('ai-selected-id').value = id;
    document.getElementById('ai-name').value = name;
    document.getElementById('ai-email').value = email;
    document.getElementById('t-search-input').value = name;
    document.getElementById('t-search-results').style.display = 'none';
}

// 3. ปรับปรุงฟังก์ชันบันทึกข้อมูล (addInternConfirm)
async function addInternConfirm() {
    const studentId = document.getElementById('ai-selected-id').value;
    const uni = document.getElementById('ai-uni').value.trim();
    const dept = document.getElementById('ai-dept').value;
    const start = document.getElementById('ai-start').value;
    const end = document.getElementById('ai-end').value;

    if (!studentId) {
        showToast('⚠️ กรุณาพิมพ์ค้นหา และ "คลิกเลือกรายชื่อ" ก่อนบันทึก', 'err');
        return;
    }

    // 2. 🚀 เช็คว่าเลือกวันเริ่ม-วันสิ้นสุดหรือยัง (เพิ่มตรงนี้)
    if (!start || !end) {
        showToast('⚠️ กรุณาระบุ "วันเริ่ม" และ "วันสิ้นสุด" ให้ครบถ้วน', 'err');
        return;
    }

    const btn = document.querySelector('#modal-add-intern .btn-blue');
    btn.disabled = true; btn.innerHTML = 'กำลังบันทึก... ⏳';

    // 🚀 พิมพ์ค่าออกมาดูใน Console ว่ามีอะไรผิดปกติไหม
    console.log("=== ข้อมูลที่จะบันทึก ===");
    console.log("รหัสนักศึกษา (student_id):", studentId);
    console.log("รหัสอาจารย์ (teacher_id):", currentUser ? currentUser.id : "ไม่มีข้อมูล!!");
    console.log("======================");

    try {
        if (!currentUser || !currentUser.id) {
            throw new Error("ไม่พบ ID ของอาจารย์ในระบบ กรุณา Logout แล้ว Login ใหม่");
        }

        // 1. เช็คก่อนว่าอาจารย์คนนี้เคยเพิ่มเด็กคนนี้หรือยัง
        const { data: existing } = await supabaseClient
            .from('student_profiles')
            .select('id')
            .eq('student_id', studentId)
            .eq('teacher_id', currentUser.id)
            .maybeSingle(); // ใช้ maybeSingle เพื่อไม่ให้เกิด Error ถ้าหาไม่เจอ

        let actionError;

        if (existing) {
            // 2. ถ้ามีแล้วให้อัปเดต
            const { error } = await supabaseClient
                .from('student_profiles')
                .update({ university: uni, department: dept, start_date: start || null, end_date: end || null })
                .eq('id', existing.id);
            actionError = error;
        } else {
            // 3. ถ้ายังไม่มีให้สร้างแถวใหม่เลย
            const { error } = await supabaseClient
                .from('student_profiles')
                .insert({
                    student_id: studentId,
                    teacher_id: currentUser.id,
                    university: uni,
                    department: dept,
                    start_date: start || null,
                    end_date: end || null
                });
            actionError = error;
        }

        if (actionError) throw actionError;

        showToast('✅ เพิ่มนักศึกษาเรียบร้อย!');
        closeModalById('modal-add-intern');
        await loadTeacherData();

    } catch (err) {
        console.error("🔥 พังตรงนี้:", err);
        showToast('❌ เพิ่มไม่สำเร็จ: ' + err.message, 'err');
    } finally {
        btn.disabled = false; btn.innerHTML = '✅ บันทึก';
        document.getElementById('ai-selected-id').value = '';
        document.getElementById('t-search-input').value = '';
    }
}

// ═══════════════════════════════════════════
//  RENDER: REVIEW DIARIES
// ═══════════════════════════════════════════
function renderReviewPanel() {
    populateReviewSelect();
    const list = document.getElementById('review-list');
    if (!list) return;

    // กรองเอาเฉพาะบันทึกที่รอตรวจ (status === 'pending')
    const pendingDiaries = diaries.filter(d => d.status === 'pending');

    if (pendingDiaries.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:12px">ไม่มีบันทึกที่รอตรวจ</div>';
        return;
    }

    list.innerHTML = pendingDiaries.map(d => {
        // หาชื่อนักศึกษาจาก ID เพื่อมาโชว์ในการ์ด
        const student = interns.find(i => i.id === d.student_id) || { name: 'นักศึกษา', color: 'c1' };
        return `
        <div class="diary-card dc-pend" onclick="showReviewDetail(${d.id})">
            <div class="dc-top">
                <div class="nm">
                    <div class="ava-sm ${student.color}">${student.name[0]}</div>
                    <span style="font-size:12px; font-weight:600">${student.name}</span>
                </div>
                <span class="dc-date">${d.date}</span>
                <span class="dc-chip dcc-p">รอตรวจ</span>
            </div>
            <div class="dc-title">${d.title}</div>
            <div class="dc-preview">${d.work}</div>
        </div>`;
    }).join('');
}
function populateReviewSelect() {
    const sel = document.getElementById('review-intern-sel'); if (!sel) return;
    sel.innerHTML = '<option value="all">— นักศึกษาทั้งหมด —</option>' + interns.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
}
function loadReviewDiaries() {
    const list = document.getElementById('review-list'); if (!list) return;
    if (!diaries.length) { list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:12px">ไม่มีบันทึกที่รอตรวจ</div>'; return; }
    list.innerHTML = diaries.map(d => {
        const bc = d.status === 'approved' ? 'dc-ok' : d.status === 'commented' ? 'dc-cmt' : 'dc-pend';
        const chip = d.status === 'approved' ? '<span class="dc-chip dcc-ok">อนุมัติ</span>' : d.status === 'commented' ? '<span class="dc-chip dcc-c">commented</span>' : '<span class="dc-chip dcc-p">รอตรวจ</span>';
        return `<div class="diary-card ${bc}" onclick="showReviewDetail(${d.id})">
      <div class="dc-top"><span>${d.mood}</span><span class="dc-date">${d.date}</span>${chip}</div>
      <div class="dc-title">${d.title}</div>
      <div class="dc-preview">${d.work}</div>
    </div>`;
    }).join('');
}
function showReviewDetail(id) {
    const d = diaries.find(x => x.id === id); if (!d) return;
    selectedReviewDiary = d;
    document.getElementById('review-placeholder').style.display = 'none';
    const card = document.getElementById('review-detail-card'); card.style.display = '';
    const body = document.getElementById('review-detail-body');
    body.innerHTML = `
    <div style="margin-bottom:14px"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">วันที่ ${d.date} ${d.mood}</div>
    <div style="font-size:15px;font-weight:800;margin-bottom:8px">${d.title}</div>
    <div style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:12px">${d.work}</div>
    ${d.learn ? `<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px">สิ่งที่เรียนรู้</div><div style="font-size:12px;color:var(--text2)">${d.learn}</div></div>` : ''}
    ${d.skills && d.skills.length ? `<div class="skill-tags" style="margin-bottom:12px">${d.skills.map(s => `<span class="skill-chip">${s}</span>`).join('')}</div>` : ''}
    <div style="display:flex;gap:10px;font-size:11px;color:var(--text3)"><span>⏰ ${d.hrs} ชั่วโมง</span><span>📊 ${d.diff}</span></div></div>
    ${d.comment ? `<div class="dc-cmt-box" style="margin-bottom:14px"><div class="dc-cmt-from">💬 ${d.commenter}</div>${d.comment}</div>` : ''}
    <div style="border-top:1px solid var(--border);padding-top:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:8px">เพิ่ม Comment / Feedback</div>
      <textarea class="fi3" id="review-cmt-input" rows="3" placeholder="ระบุความคิดเห็น คำแนะนำ..." style="margin-bottom:10px">${d.comment || ''}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-success btn-sm" onclick="approveOneDiary(${d.id})">✅ อนุมัติ</button>
        <button class="btn btn-blue btn-sm" onclick="commentDiary(${d.id})">💬 บันทึก Comment</button>
      </div>
    </div>`;
}
async function approveOneDiary(diaryId) {
    // 🚀 อัปเดตสถานะใน Supabase เป็น 'approved'
    const { error } = await supabaseClient
        .from('diaries')
        .update({ status: 'approved' })
        .eq('id', diaryId);

    if (error) { showToast('❌ อนุมัติไม่สำเร็จ', 'err'); return; }

    showToast('✅ อนุมัติบันทึกแล้ว!');
    await loadTeacherData(); // ดึงข้อมูลใหม่
    if (selectedReviewDiary && selectedReviewDiary.id === diaryId) {
        showReviewDetail(diaryId); // รีเฟรชหน้าต่างแสดงรายละเอียด
    }
}
async function commentDiary(diaryId) {
    const cmt = document.getElementById('review-cmt-input').value.trim();
    if (!cmt) { showToast('กรุณากรอกข้อความก่อนกดส่ง', 'err'); return; }

    // 🚀 อัปเดต Comment และเปลี่ยนสถานะเป็น 'commented'
    const { error } = await supabaseClient
        .from('diaries')
        .update({
            status: 'commented',
            teacher_comment: cmt,
            commenter_name: currentUser.name
        })
        .eq('id', diaryId);

    if (error) { showToast('❌ บันทึก Comment ไม่สำเร็จ', 'err'); return; }

    showToast('💬 บันทึก comment สำเร็จ!');
    await loadTeacherData();
    if (selectedReviewDiary && selectedReviewDiary.id === diaryId) {
        showReviewDetail(diaryId);
    }
}
function approveAllDiaries() {
    diaries.forEach(d => { if (d.status === 'pending') d.status = 'approved'; });
    localStorage.setItem('it_diaries', JSON.stringify(diaries));
    loadReviewDiaries(); showToast('✅ อนุมัติทั้งหมดแล้ว!');
}
function notifyAll() { showToast('📧 ส่งแจ้งเตือนนักศึกษาทุกคนแล้ว'); }

// ═══════════════════════════════════════════
//  RENDER: TEACHER ATTENDANCE
// ═══════════════════════════════════════════


// ═══════════════════════════════════════════
//  RENDER: EVAL FORM
// ═══════════════════════════════════════════
const CRITERIA = [
    { key: 'skill', icon: '🔧', label: 'ทักษะวิชาชีพ' },
    { key: 'responsibility', icon: '📋', label: 'ความรับผิดชอบ' },
    { key: 'teamwork', icon: '🤝', label: 'ทีมเวิร์ค' },
    { key: 'communication', icon: '💬', label: 'การสื่อสาร' },
    { key: 'creativity', icon: '💡', label: 'ความคิดสร้างสรรค์' },
    { key: 'punctuality', icon: '⏰', label: 'ตรงต่อเวลา' },
];
let evalRatings = {};

function populateTeacherSelects() {
    ['eval-intern-sel', 'review-intern-sel'].forEach(id => {
        const sel = document.getElementById(id); if (!sel) return;
        const isReview = id === 'review-intern-sel';
        sel.innerHTML = (isReview ? '<option value="all">— ทั้งหมด —</option>' : '') + interns.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    });
}
function renderEvalPanel() {
    populateTeacherSelects();
    const grid = document.getElementById('eval-criteria-grid'); if (!grid) return;
    grid.innerHTML = CRITERIA.map(c => `
    <div class="eval-item">
      <div class="eval-lbl">${c.icon} ${c.label}</div>
      <div class="star-grp" id="stars-${c.key}">
        ${[1, 2, 3, 4, 5].map(n => `<button class="star-btn" data-val="${n}" onclick="setStar('${c.key}',${n})">★</button>`).join('')}
        <span style="font-size:11px;color:var(--text2);margin-left:4px" id="sv-${c.key}">—</span>
      </div>
    </div>`).join('');

    renderEvalHistory();
    loadEvalForm();
}
function setStar(key, val) {
    evalRatings[key] = val;
    document.querySelectorAll(`#stars-${key} .star-btn`).forEach(b => { b.classList.toggle('on', parseInt(b.dataset.val) <= val); });
    document.getElementById('sv-' + key).textContent = val + '/5';
    const avg = Object.values(evalRatings).length ? Object.values(evalRatings).reduce((s, v) => s + v, 0) / Object.values(evalRatings).length : 0;
    document.getElementById('eval-overall').value = avg.toFixed(1);
    document.getElementById('eval-overall-val').textContent = avg.toFixed(1);
}
function loadEvalForm() {
    const sel = document.getElementById('eval-intern-sel'); if (!sel || !sel.value) return;
    const intern = interns.find(i => i.id == sel.value);
    const info = document.getElementById('eval-intern-info'); if (!info) return;
    if (intern) {
        info.style.display = 'flex';
        document.getElementById('ei-ava').textContent = intern.name[0];
        document.getElementById('ei-ava').className = 'ipb-ava ' + intern.color;
        document.getElementById('ei-name').textContent = intern.name;
        document.getElementById('ei-meta').innerHTML = `<span class="tag tag-b">${intern.uni}</span> &nbsp; <span class="tag tag-t">${intern.dept}</span>`;
        const prevEvals = evaluations.filter(e => e.internId == intern.id);
        const prev = document.getElementById('ei-prev-score');
        if (prev) prev.innerHTML = prevEvals.length ? `<div style="font-size:10px;color:var(--text2)">ประเมินแล้ว ${prevEvals.length} ครั้ง</div><div style="font-family:'Kanit';font-size:20px;font-weight:800;color:var(--teal)">${prevEvals[prevEvals.length - 1].overall}</div>` : '<div style="font-size:11px;color:var(--text3)">ยังไม่มีประวัติ</div>';
    }
}
function renderEvalHistory() {
    const hist = document.getElementById('eval-history');
    if (!hist) return;
    if (!evaluations.length) {
        hist.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:12px">ยังไม่มีประวัติการประเมิน</div>';
        return;
    }

    hist.innerHTML = evaluations.sort((a, b) => b.date.localeCompare(a.date)).map(e => {
        const intern = interns.find(i => i.id == e.internId);
        return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="ava-sm ${intern ? intern.color : 'c1'}">${intern ? intern.name[0] : '?'}</div>
        <div>
            <div style="font-weight:700;font-size:12px">${intern ? intern.name : 'นักศึกษา'}</div>
            <div style="font-size:10px;color:var(--text2)">${e.round || ''} · ${e.date}</div>
        </div>
        <div style="margin-left:auto;font-family:'Kanit';font-size:20px;font-weight:900;color:var(--teal)">
            ${e.overall || '0.0'} 
        </div>
      </div>
      <div style="font-size:11px;color:var(--text2);line-height:1.6">${e.comment || ''}</div>
    </div>`;
    }).join('');
}
function saveDraftEval() { showToast('💾 บันทึกร่างการประเมินแล้ว'); }
// ฟังก์ชันส่งผลการประเมินนักศึกษา (ฝั่งอาจารย์)
// แก้ไขคอลัมน์ให้ตรงกับฐานข้อมูล (overall -> overall_score และ student_id -> intern_id)
// ฟังก์ชันส่งผลการประเมินนักศึกษา (ฝั่งอาจารย์)
async function submitEval() {
    const sel = document.getElementById('eval-intern-sel');
    const comment = document.getElementById('eval-comment').value.trim();
    const score = parseFloat(document.getElementById('eval-overall').value);

    if (!sel.value || !comment) {
        showToast('⚠️ กรุณาเลือกนักศึกษาและกรอกความคิดเห็น', 'err');
        return;
    }

    const btn = event.target;
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'กำลังบันทึก... ⏳';

    try {
        const { error } = await supabaseClient.from('evaluations').insert({
            intern_id: sel.value,
            evaluator_id: currentUser.id,
            evaluator_role: currentRole || 'teacher', // 🚀 เพิ่มคอลัมน์นี้เพื่อแก้ Error!
            overall_score: score,
            comment: comment,
            eval_round: document.getElementById('eval-round').value,
            date: new Date().toISOString().split('T')[0],
            // คะแนนรายข้อ
            skill_score: evalRatings.skill || 0,
            responsibility_score: evalRatings.responsibility || 0,
            teamwork_score: evalRatings.teamwork || 0,
            communication_score: evalRatings.communication || 0,
            creativity_score: evalRatings.creativity || 0,
            punctuality_score: evalRatings.punctuality || 0
        });
        
        if (error) throw error;
        
        showToast('✅ บันทึกผลการประเมินสำเร็จ!');
        
        // ล้างฟอร์ม
        document.getElementById('eval-comment').value = '';
        evalRatings = {}; 
        document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('on'));
        
        // ดึงข้อมูลมาอัปเดตหน้าจอทันที
        await loadTeacherData(); 
        
    } catch (e) { 
        showToast('❌ พัง: ' + e.message, 'err'); 
        console.error("Eval Error:", e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
}

// ═══════════════════════════════════════════
//  RENDER: REPORTS
// ═══════════════════════════════════════════
function renderReports() {
    const tbl = document.getElementById('t-report-tbl'); if (!tbl) return;
    if (!evaluations.length) {
        tbl.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">ยังไม่มีข้อมูลการประเมิน</td></tr>';
        // Add sample data
        const sampleEvals = [
            { internId: 1, overall: '4.5', criteria: { skill: 5, responsibility: 4, teamwork: 4, communication: 4, creativity: 5, punctuality: 4 }, teacherName: 'ผศ.ดร.อรรถพล', date: '2026-02-10' },
            { internId: 2, overall: '4.1', criteria: { skill: 4, responsibility: 4, teamwork: 4, communication: 4, creativity: 4, punctuality: 4 }, teacherName: 'ผศ.ดร.อรรถพล', date: '2026-02-11' },
            { internId: 3, overall: '3.8', criteria: { skill: 4, responsibility: 3, teamwork: 4, communication: 4, creativity: 4, punctuality: 3 }, teacherName: 'ผศ.ดร.อรรถพล', date: '2026-02-12' },
        ];
        tbl.innerHTML = sampleEvals.map(e => {
            const intern = interns.find(i => i.id === e.internId);
            const grade = parseFloat(e.overall) >= 4.5 ? 'A' : parseFloat(e.overall) >= 4 ? 'B+' : parseFloat(e.overall) >= 3.5 ? 'B' : 'B-';
            return `<tr>
        <td><div class="nm"><div class="ava-sm ${intern ? intern.color : 'c1'}">${intern ? intern.name[0] : '?'}</div><div class="nm-main">${intern ? intern.name : '?'}</div></div></td>
        <td>${e.criteria.skill || '—'}/5</td><td>${e.criteria.responsibility || '—'}/5</td>
        <td>${e.criteria.teamwork || '—'}/5</td><td>${e.criteria.communication || '—'}/5</td>
        <td><span style="font-family:'Kanit';font-size:15px;font-weight:800;color:var(--teal)">${e.overall}</span></td>
        <td><span style="font-weight:700;color:${parseFloat(e.overall) >= 4.5 ? 'var(--emerald)' : 'var(--amber)'}">${grade}</span></td>
        <td style="font-size:11px;color:var(--text2)">${e.teacherName}</td>
      </tr>`;
        }).join('');
        return;
    }
    tbl.innerHTML = evaluations.map(e => {
        const intern = interns.find(i => i.id === e.internId);
        const grade = parseFloat(e.overall) >= 4.5 ? 'A' : parseFloat(e.overall) >= 4 ? 'B+' : parseFloat(e.overall) >= 3.5 ? 'B' : 'B-';
        return `<tr>
      <td><div class="nm"><div class="ava-sm ${intern ? intern.color : 'c1'}">${intern ? intern.name[0] : '?'}</div><div class="nm-main">${intern ? intern.name : '?'}</div></div></td>
      <td>${e.criteria.skill || '—'}/5</td><td>${e.criteria.responsibility || '—'}/5</td>
      <td>${e.criteria.teamwork || '—'}/5</td><td>${e.criteria.communication || '—'}/5</td>
      <td><span style="font-family:'Kanit';font-size:15px;font-weight:800;color:var(--teal)">${e.overall}</span></td>
      <td><span style="font-weight:700;color:${parseFloat(e.overall) >= 4.5 ? 'var(--emerald)' : 'var(--amber)'}">${grade}</span></td>
      <td style="font-size:11px;color:var(--text2)">${e.teacherName || 'อาจารย์'}</td>
    </tr>`;
    }).join('');
}
function exportCSV() { showToast('📥 Export ข้อมูล CSV แล้ว'); }

// ═══════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  PROFILE (เชื่อมต่อ Supabase)
// ═══════════════════════════════════════════
async function loadProfile() {
    if (!currentUser) return;
    
    // 1. ใส่ชื่อเบื้องต้นจากข้อมูลผู้ใช้ปัจจุบันก่อน
    if (document.getElementById('p-name')) document.getElementById('p-name').value = currentUser.name || '';

    try {
        // 2. ดึงข้อมูลจากฐานข้อมูล Supabase
        const { data: studentInfo, error } = await supabaseClient
            .from('student_profiles')
            .select('*')
            .eq('student_id', currentUser.id)
            .maybeSingle();

        if (studentInfo) {
            if (document.getElementById('p-sid')) document.getElementById('p-sid').value = studentInfo.student_code || '';
            if (document.getElementById('p-uni')) document.getElementById('p-uni').value = studentInfo.university || '';
            if (document.getElementById('p-fac')) document.getElementById('p-fac').value = studentInfo.faculty || '';
            if (document.getElementById('p-major')) document.getElementById('p-major').value = studentInfo.major || '';
            if (document.getElementById('p-dept')) document.getElementById('p-dept').value = studentInfo.department || '';
            if (document.getElementById('p-sup')) document.getElementById('p-sup').value = studentInfo.supervisor_name || '';
            if (document.getElementById('p-start')) document.getElementById('p-start').value = studentInfo.start_date || '';
            if (document.getElementById('p-end')) document.getElementById('p-end').value = studentInfo.end_date || '';
        }

        // 3. ช่องที่ไม่มีใน Database (เช่น เบอร์โทร, ชื่อบริษัทแบบ Text) ให้ดึงจาก LocalStorage มาโชว์พลางๆ ก่อน
        const savedLocal = JSON.parse(localStorage.getItem('it_profile') || '{}');
        if (document.getElementById('p-tel') && savedLocal['p-tel']) document.getElementById('p-tel').value = savedLocal['p-tel'];
        if (document.getElementById('p-comp') && savedLocal['p-comp']) document.getElementById('p-comp').value = savedLocal['p-comp'];

    } catch (error) {
        console.error("Load Profile Error:", error);
    }
}

// ═══════════════════════════════════════════
//  PROFILE (เชื่อมต่อ Supabase)
// ═══════════════════════════════════════════
async function loadProfile() {
    if (!currentUser) return;
    
    // 1. ใส่ชื่อเบื้องต้นจากข้อมูลผู้ใช้ปัจจุบันก่อน
    if (document.getElementById('p-name')) document.getElementById('p-name').value = currentUser.name || '';

    try {
        // 2. ดึงข้อมูลจากฐานข้อมูล Supabase
        const { data: studentInfo, error } = await supabaseClient
            .from('student_profiles')
            .select('*')
            .eq('student_id', currentUser.id)
            .maybeSingle();

        if (studentInfo) {
            if (document.getElementById('p-sid')) document.getElementById('p-sid').value = studentInfo.student_code || '';
            if (document.getElementById('p-uni')) document.getElementById('p-uni').value = studentInfo.university || '';
            if (document.getElementById('p-fac')) document.getElementById('p-fac').value = studentInfo.faculty || '';
            if (document.getElementById('p-major')) document.getElementById('p-major').value = studentInfo.major || '';
            if (document.getElementById('p-dept')) document.getElementById('p-dept').value = studentInfo.department || '';
            if (document.getElementById('p-sup')) document.getElementById('p-sup').value = studentInfo.supervisor_name || '';
            if (document.getElementById('p-start')) document.getElementById('p-start').value = studentInfo.start_date || '';
            if (document.getElementById('p-end')) document.getElementById('p-end').value = studentInfo.end_date || '';
        }

        // 3. ช่องที่ไม่มีใน Database (เช่น เบอร์โทร, ชื่อบริษัทแบบ Text) ให้ดึงจาก LocalStorage มาโชว์พลางๆ ก่อน
        const savedLocal = JSON.parse(localStorage.getItem('it_profile') || '{}');
        if (document.getElementById('p-tel') && savedLocal['p-tel']) document.getElementById('p-tel').value = savedLocal['p-tel'];
        if (document.getElementById('p-comp') && savedLocal['p-comp']) document.getElementById('p-comp').value = savedLocal['p-comp'];

    } catch (error) {
        console.error("Load Profile Error:", error);
    }
}

async function saveProfile() {
    if (!currentUser) return;

    // ดึงค่าจากหน้าฟอร์ม
    const name = document.getElementById('p-name').value.trim();
    const sid = document.getElementById('p-sid').value.trim();
    const tel = document.getElementById('p-tel').value.trim(); 
    const uni = document.getElementById('p-uni').value.trim();
    const fac = document.getElementById('p-fac').value.trim();
    const major = document.getElementById('p-major').value.trim();
    const comp = document.getElementById('p-comp').value.trim(); 
    const dept = document.getElementById('p-dept').value.trim();
    const start = document.getElementById('p-start').value;
    const end = document.getElementById('p-end').value;
    const sup = document.getElementById('p-sup').value.trim();

    const btn = event.target;
    const origText = btn.innerHTML;
    btn.innerHTML = 'กำลังบันทึก... ⏳';
    btn.disabled = true;

    try {
        // 1. อัปเดต "ชื่อ-นามสกุล" ไปที่ตาราง profiles
        if (name) {
            await supabaseClient.from('profiles').update({ full_name: name }).eq('id', currentUser.id);
            currentUser.name = name;
            localStorage.setItem('it_user', JSON.stringify(currentUser));
            updateUserUI(); // อัปเดตชื่อที่เมนูด้านซ้าย
        }

        // 2. เช็คว่าเคยมีข้อมูลในตาราง student_profiles หรือยัง
        const { data: existingProfile } = await supabaseClient
            .from('student_profiles')
            .select('id')
            .eq('student_id', currentUser.id)
            .maybeSingle();

        // 3. เตรียมข้อมูลที่จะบันทึก
        const profileData = {
            student_id: currentUser.id,
            student_code: sid,
            university: uni,
            faculty: fac,
            major: major,
            department: dept,
            supervisor_name: sup,
            start_date: start || null,
            end_date: end || null
        };

        let dbError;
        if (existingProfile) {
            // ถ้ามีแล้ว -> อัปเดต
            const { error } = await supabaseClient.from('student_profiles').update(profileData).eq('id', existingProfile.id);
            dbError = error;
        } else {
            // ถ้ายังไม่มี -> สร้างใหม่
            const { error } = await supabaseClient.from('student_profiles').insert([profileData]);
            dbError = error;
        }

        if (dbError) throw dbError;

        // 4. บันทึกข้อมูลที่ไม่มีในตารางฐานข้อมูลไว้ในเครื่อง (LocalStorage)
        const localData = {
            'p-name': name, 'p-sid': sid, 'p-tel': tel, 'p-uni': uni, 'p-fac': fac, 'p-major': major, 
            'p-comp': comp, 'p-dept': dept, 'p-start': start, 'p-end': end, 'p-sup': sup
        };
        localStorage.setItem('it_profile', JSON.stringify(localData));

        showToast('✅ บันทึกข้อมูลลงฐานข้อมูลสำเร็จ!');
    } catch (error) {
        console.error("Save Profile Error:", error);
        showToast('❌ บันทึกไม่สำเร็จ: ' + error.message, 'err');
    } finally {
        // ปลดล็อกปุ่ม
        btn.innerHTML = origText;
        btn.disabled = false;
    }
}

// ═══════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════
function closeModal(id, e) { if (e.target === document.getElementById(id)) closeModalById(id); }
function closeModalById(id) { document.getElementById(id).classList.remove('open'); }

// ═══════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════
function showToast(msg, type = 'ok') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast' + (type === 'err' ? ' err' : '');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
}

// ═══════════════════════════════════════════
//  HR / COMPANY SYSTEM (Clean & Final Version)
// ═══════════════════════════════════════════
let hrInterns = [];
let hrEvaluations = [];
let hrAttendances = [];
let hrDiaries = [];
let hrEvalRatings = {};
let hrFilterStatus = 'all';
let currentHRPage = 'hr-dashboard';

async function loadHRData() {
    if (!currentUser) return;
    try {
        const { data: students, error: stuErr } = await supabaseClient
            .from('student_profiles')
            .select(`student_id, university, department, start_date, end_date, profiles!fk_student(full_name, email)`);
        if (stuErr) throw stuErr;
        if (students) {
            const colors = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
            hrInterns = students.map((s, i) => ({
                id: s.student_id, name: s.profiles?.full_name || 'ไม่ทราบชื่อ', email: s.profiles?.email || '',
                uni: s.university || 'ไม่ระบุ', dept: s.department || 'ไม่ระบุ', start: s.start_date || '-', end: s.end_date || '-',
                color: colors[i % 6], status: 'active'
            }));
            const studentIds = hrInterns.map(i => i.id);
            if (studentIds.length > 0) {
                const [attRes, diaRes, evRes] = await Promise.all([
                    supabaseClient.from('attendance').select('*').in('student_id', studentIds),
                    supabaseClient.from('diaries').select('*').in('student_id', studentIds).order('date', { ascending: false }),
                    supabaseClient.from('evaluations').select('*').in('intern_id', studentIds)
                ]);
                hrAttendances = attRes.data || []; hrDiaries = diaRes.data || []; hrEvaluations = evRes.data || [];
            }
        }
        const cntEl = document.getElementById('hr-intern-cnt'); if(cntEl) cntEl.textContent = hrInterns.length;
        if (currentHRPage === 'hr-dashboard') renderHRDashboard();
        else if(currentHRPage === 'hr-interns') renderHRInterns();
        else if(currentHRPage === 'hr-tracking') renderHRTracking();
        else if(currentHRPage === 'hr-evaluation') renderHREval();
        else if(currentHRPage === 'hr-reports') renderHRReports();
    } catch (err) { console.error("❌ โหลดข้อมูล HR ล้มเหลว:", err.message); }
}

function launchHR() {
    goScreen('hr');
    const u = currentUser || { name: 'HR Admin' };
    document.getElementById('hr-ava').textContent = u.name ? u.name[0] : 'H';
    document.getElementById('hr-uname').textContent = u.name || 'HR Admin';
    switchHRPage('hr-dashboard');
}

function switchHRPage(name) {
    document.querySelectorAll('#screen-hr .panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + name); if (panel) panel.classList.add('active');
    currentHRPage = name;
    document.querySelectorAll('#sidebar-hr .sb-item').forEach(btn => {
        btn.classList.remove('h-active');
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes("'" + name + "'")) btn.classList.add('h-active');
    });
    const titles = { 'hr-dashboard': 'Dashboard สถานประกอบการ', 'hr-interns': 'นักศึกษาฝึกงาน', 'hr-tracking': 'ติดตามความก้าวหน้า', 'hr-evaluation': 'ประเมินผล', 'hr-reports': 'รายงาน', 'hr-settings': 'ตั้งค่า' };
    document.getElementById('hr-page-title').textContent = titles[name] || name;
    if (name === 'hr-dashboard') renderHRDashboard();
    else if (name === 'hr-interns') renderHRInterns();
    else if (name === 'hr-tracking') renderHRTracking();
    else if (name === 'hr-evaluation') renderHREval();
    else if (name === 'hr-reports') renderHRReports();
}

function hrGetStatusHtml(status) {
    const map = { active: '<span class="status s-ok">กำลังฝึกงาน</span>', pending: '<span class="status s-warn">ต้องติดตาม</span>', review: '<span class="status s-rev">รอประเมิน</span>', done: '<span class="status s-done">เสร็จสิ้น</span>' };
    return map[status] || '<span class="status s-ok">กำลังฝึกงาน</span>';
}

function hrGetProgressHtml(p) {
    const cls = p >= 80 ? 'pf-e' : p >= 50 ? 'pf-t' : 'pf-a';
    return `<div class="pw"><div class="pb" style="flex:1;height:5px"><div class="pf ${cls}" style="width:${p}%"></div></div><span class="pt">${p}%</span></div>`;
}

function renderHRDashboard() {
    try {
        const totalEl = document.getElementById('hr-stat-total'); if(totalEl) totalEl.textContent = hrInterns.length;
        const activeEl = document.getElementById('hr-stat-active'); if(activeEl) activeEl.textContent = hrInterns.length;
        const pending = hrDiaries.filter(d => d.status === 'pending').length;
        const pendEl = document.getElementById('hr-stat-pending'); if(pendEl) pendEl.textContent = pending;

        const actBody = document.querySelector('#panel-hr-dashboard .grid2 .card:nth-child(1) .card-body');
        if (actBody) {
            let activities = [];
            hrDiaries.forEach(d => {
                const intern = hrInterns.find(i => i.id === d.student_id);
                if(intern) activities.push({ date: d.date, text: `<strong>${intern.name}</strong> ส่งบันทึก: ${d.title || 'ไม่มีหัวข้อ'}`, icon: '📝', color: 'ai-t' });
            });
            hrEvaluations.forEach(e => {
                const intern = hrInterns.find(i => i.id === e.intern_id);
                if(intern) activities.push({ date: e.date, text: `ประเมินผล <strong>${intern.name}</strong> เสร็จสิ้น — ${parseFloat(e.overall_score).toFixed(1)}/5`, icon: '⭐', color: 'ai-b' });
            });
            activities.sort((a, b) => new Date(b.date) - new Date(a.date));
            const recentActs = activities.slice(0, 4);
            if (recentActs.length > 0) {
                actBody.innerHTML = recentActs.map(a => `<div class="act-item"><div class="act-ico ${a.color}">${a.icon}</div><div><div class="act-text">${a.text}</div><div class="act-time">วันที่ ${a.date}</div></div></div>`).join('');
            } else {
                actBody.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3)">ไม่มีกิจกรรมล่าสุด</div>';
            }
        }

        const chart = document.getElementById('hr-chart');
        if (chart) {
            chart.style.height = '180px'; chart.style.display = 'flex'; chart.style.alignItems = 'flex-end'; chart.style.justifyContent = 'space-around'; chart.style.marginTop = '30px';
            if (chart.nextElementSibling && chart.nextElementSibling.tagName.toLowerCase() === 'div') chart.nextElementSibling.style.display = 'none';
            const months = [], counts = [], monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            const today = new Date(); let hasValidDates = false;
            for (let i = 5; i >= 0; i--) {
                const targetMonth = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const m = targetMonth.getMonth(), y = targetMonth.getFullYear();
                months.push(monthNames[m]);
                const count = hrInterns.filter(intern => {
                    if (!intern.start || !intern.end || intern.start === '-' || intern.end === '-') return false;
                    hasValidDates = true; 
                    const sDate = new Date(intern.start), eDate = new Date(intern.end), startOfThisMonth = new Date(y, m, 1), endOfThisMonth = new Date(y, m + 1, 0);
                    return sDate <= endOfThisMonth && eDate >= startOfThisMonth;
                }).length;
                counts.push(count);
            }
            const maxCount = Math.max(...counts, 5);
            chart.innerHTML = counts.map((v, i) => {
                const h = v > 0 ? (v / maxCount) * 100 : 2;
                return `<div class="bc" style="flex:1; display:flex; flex-direction:column; align-items:center;">
                    <div class="bbar" style="height:${h}%; width:30px; min-height:4px; position:relative; border-radius:4px 4px 0 0; background: ${i % 2 !== 0 ? 'var(--blue)' : 'var(--teal)'}; transition:0.3s;">
                        <span style="position:absolute; top:-20px; left:50%; transform:translateX(-50%); font-size:11px; font-weight:bold; color:var(--text)">${v > 0 ? v : '0'}</span>
                    </div>
                    <div class="blbl" style="margin-top:12px; font-size:11px; color:var(--text2)">${months[i]}</div>
                </div>`;
            }).join('');
            if(!hasValidDates && hrInterns.length > 0) chart.innerHTML += `<div style="position:absolute; top:40%; left:50%; transform:translate(-50%,-50%); text-align:center; color:var(--text3); font-size:12px; background:rgba(0,0,0,0.6); padding:8px 16px; border-radius:6px; backdrop-filter:blur(4px); white-space:nowrap;">⚠️ ระบุ 'วันเริ่ม-สิ้นสุด' ของนักศึกษาเพื่อแสดงกราฟ</div>`;
        }

        const qt = document.getElementById('hr-quick-table'); 
        if (qt) {
            qt.innerHTML = hrInterns.slice(0, 5).map(i => {
                const myAtt = hrAttendances.filter(a => a.student_id === i.id).length;
                const progress = Math.min(100, Math.round((myAtt / 60) * 100)) || 0;
                return `<tr><td><div class="nm"><div class="ava-sm ${i.color}">${i.name[0]}</div><div><div class="nm-main">${i.name}</div><div style="font-size:10px;color:var(--text2)">${i.uni}</div></div></div></td><td style="font-size:12px">${i.dept}</td><td style="font-size:12px">${i.end !== '-' ? i.end : '<span style="color:var(--text3)">ยังไม่ระบุ</span>'}</td><td>${hrGetProgressHtml(progress)}</td><td>${hrGetStatusHtml(i.status)}</td></tr>`;
            }).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3)">ไม่พบข้อมูลนักศึกษา</td></tr>';
        }
    } catch (error) { console.error("🔥 Render HR Dashboard Error:", error); }
}

function hrFilterByStatus(el, status) {
    hrFilterStatus = status;
    document.querySelectorAll('#panel-hr-interns .fchip').forEach(c => c.classList.remove('fa'));
    el.classList.add('fa'); renderHRInterns();
}
function hrFilterInterns() { renderHRInterns(); }

function renderHRInterns() {
    const searchInput = document.getElementById('hr-search');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    
    // กรองข้อมูลจาก hrInterns
    const filtered = hrInterns.filter(i => {
        const ms = hrFilterStatus === 'all' || i.status === hrFilterStatus;
        const mq = i.name.toLowerCase().includes(search) || i.dept.toLowerCase().includes(search) || i.uni.toLowerCase().includes(search);
        return ms && mq;
    });

    const tbody = document.getElementById('hr-intern-table'); // ตรวจสอบ ID นี้ใน HTML
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">ไม่พบข้อมูลนักศึกษา</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(i => {
        // คำนวณความก้าวหน้า
        const myAtt = hrAttendances.filter(a => a.student_id === i.id).length;
        const progress = Math.min(100, Math.round((myAtt / 60) * 100)) || 0;
        
        return `<tr>
            <td>
                <div class="nm">
                    <div class="ava-sm ${i.color}">${i.name[0]}</div>
                    <div><div class="nm-main">${i.name}</div><div style="font-size:10px;color:var(--text2)">${i.email}</div></div>
                </div>
            </td>
            <td style="font-size:12px">${i.uni}</td>
            <td style="font-size:12px">${i.dept}</td>
            <td style="font-size:12px">${i.start}</td>
            <td style="font-size:12px">${i.end}</td>
            <td>${hrGetProgressHtml(progress)}</td>
            <td>${hrGetStatusHtml(i.status)}</td>
            <td><button class="btn btn-sm btn-outline" onclick="showToast('👁 ระบบกำลังพัฒนา')">👁 ดู</button></td>
        </tr>`;
    }).join('');
}

function renderHRTracking() {
    const tbody = document.getElementById('hr-tracking-table'); if (!tbody) return;
    const thead = tbody.closest('table').querySelector('thead tr');
    if(thead) {
        thead.innerHTML = `<th>นักศึกษา</th><th style="text-align:center">2 สัปดาห์ก่อน</th><th style="text-align:center">สัปดาห์ที่แล้ว</th><th style="text-align:center">สัปดาห์นี้</th><th>โดยรวม</th><th>หมายเหตุ</th>`;
    }
    const now = new Date();
    tbody.innerHTML = hrInterns.map(i => {
        const myAtt = hrAttendances.filter(a => a.student_id === i.id).length;
        const progress = Math.min(100, Math.round((myAtt / 60) * 100)) || 0;
        const getCheckmark = (daysAgoStart, daysAgoEnd) => {
            const hasDiary = hrDiaries.some(d => {
                if(d.student_id !== i.id) return false;
                const dDate = new Date(d.date);
                const diffTime = Math.abs(now - dDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays >= daysAgoStart && diffDays <= daysAgoEnd;
            });
            return hasDiary ? '<span style="color:var(--emerald)" title="ส่งบันทึกแล้ว">✅</span>' : '<span style="color:var(--rose)" title="ขาดส่ง">❌</span>';
        };
        const w3 = getCheckmark(15, 21), w2 = getCheckmark(8, 14), w1 = getCheckmark(0, 7);
        const note = progress >= 50 ? '✓ ปกติ' : (progress > 0 ? '⚠️ ต้องติดตาม' : '❌ ยังไม่เริ่ม');
        return `<tr><td><div class="nm"><div class="ava-sm ${i.color}">${i.name[0]}</div><div class="nm-main">${i.name}</div></div></td><td style="text-align:center">${w3}</td><td style="text-align:center">${w2}</td><td style="text-align:center">${w1}</td><td>${hrGetProgressHtml(progress)}</td><td style="font-size:12px;color:var(--text2)">${note}</td></tr>`;
    }).join('');
}

function renderHREval() {
    const tbody = document.getElementById('hr-eval-table'); if (!tbody) return;
    const stars = n => '⭐'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
    tbody.innerHTML = hrInterns.map(intern => {
        const evals = hrEvaluations.filter(e => e.intern_id === intern.id);
        const latestEval = evals.sort((a, b) => {
            if (a.evaluator_role === 'hr' && b.evaluator_role !== 'hr') return -1;
            if (a.evaluator_role !== 'hr' && b.evaluator_role === 'hr') return 1;
            return new Date(b.date) - new Date(a.date);
        })[0];
        if (latestEval) {
            return `<tr><td><div class="nm"><div class="ava-sm ${intern.color}">${intern.name[0]}</div><div class="nm-main">${intern.name}</div></div></td><td>${stars(latestEval.skill_score||0)}</td><td>${stars(latestEval.responsibility_score||0)}</td><td>${stars(latestEval.teamwork_score||0)}</td><td>${stars(latestEval.communication_score||0)}</td><td><span style="font-weight:800;color:${parseFloat(latestEval.overall_score) >= 4.5 ? 'var(--emerald)' : 'var(--blue)'}">${parseFloat(latestEval.overall_score).toFixed(1)}/5.0</span></td><td style="font-size:11px;color:var(--text2)">${latestEval.evaluator_role === 'hr' ? 'สถานประกอบการ' : (latestEval.teacher_name || 'อาจารย์')}</td></tr>`;
        } else {
            return `<tr><td><div class="nm"><div class="ava-sm ${intern.color}">${intern.name[0]}</div><div class="nm-main">${intern.name}</div></div></td><td colspan="5" style="text-align:center; color:var(--amber); font-size:12px;">⏳ ยังไม่มีผลการประเมิน</td><td><button class="btn btn-sm btn-outline" onclick="switchHREvalTab('form'); document.getElementById('hr-eval-intern-sel').value='${intern.id}';">ประเมินเลย</button></td></tr>`;
        }
    }).join('') || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">ไม่พบข้อมูลนักศึกษา</td></tr>';
    
    const sel = document.getElementById('hr-eval-intern-sel'); 
    if (sel) sel.innerHTML = '<option value="">-- เลือกนักศึกษา --</option>' + hrInterns.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    
    const wrap = document.getElementById('hr-eval-criteria'); if (!wrap) return;
    const criteria = [{ key: 'skill', label: '🔧 ทักษะวิชาชีพ' }, { key: 'responsibility', label: '📋 ความรับผิดชอบ' }, { key: 'teamwork', label: '🤝 การทำงานทีม' }, { key: 'communication', label: '💬 การสื่อสาร' }, { key: 'creativity', label: '💡 ความคิดสร้างสรรค์' }];
    wrap.innerHTML = criteria.map(c => `<div class="eval-item"><div class="eval-lbl">${c.label}</div><div class="star-grp" id="hr-stars-${c.key}">${[1, 2, 3, 4, 5].map(n => `<button class="star-btn" data-val="${n}" onclick="setHRStar('${c.key}',${n})">★</button>`).join('')}<span style="font-size:11px;color:var(--text2);margin-left:4px" id="hr-sv-${c.key}">—</span></div></div>`).join('');
}

function setHRStar(key, val) {
    hrEvalRatings[key] = val;
    document.querySelectorAll(`#hr-stars-${key} .star-btn`).forEach(b => b.classList.toggle('on', parseInt(b.dataset.val) <= val));
    document.getElementById('hr-sv-' + key).textContent = val + '/5';
}

async function saveHREval() {
    const sel = document.getElementById('hr-eval-intern-sel');
    const comment = document.getElementById('hr-eval-comment').value.trim();
    if (!sel.value) { showToast('⚠ กรุณาเลือกนักศึกษา', 'err'); return; }
    const score = ((hrEvalRatings.skill || 0) + (hrEvalRatings.responsibility || 0) + (hrEvalRatings.teamwork || 0) + (hrEvalRatings.communication || 0) + (hrEvalRatings.creativity || 0)) / 5;
    const btn = event.target; const origText = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'กำลังบันทึก... ⏳';
    try {
        const { error } = await supabaseClient.from('evaluations').insert({
            intern_id: sel.value, evaluator_id: currentUser.id, evaluator_role: 'hr',
            overall_score: score.toFixed(1), comment: comment || 'ไม่มีความเห็น', eval_round: 'ประเมินจากสถานประกอบการ', date: new Date().toISOString().split('T')[0],
            skill_score: hrEvalRatings.skill || 0, responsibility_score: hrEvalRatings.responsibility || 0, teamwork_score: hrEvalRatings.teamwork || 0, communication_score: hrEvalRatings.communication || 0, creativity_score: hrEvalRatings.creativity || 0, punctuality_score: 0
        });
        if (error) throw error;
        showToast('✅ บันทึกผลการประเมินเรียบร้อยแล้ว!');
        hrEvalRatings = {}; document.getElementById('hr-eval-comment').value = ''; document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('on'));
        await loadHRData(); switchHREvalTab('list');
    } catch(e) { showToast('❌ พัง: ' + e.message, 'err'); } 
    finally { btn.disabled = false; btn.innerHTML = origText; }
}

function switchHREvalTab(tab) {
    document.getElementById('hr-eval-list').style.display = tab === 'list' ? '' : 'none'; document.getElementById('hr-eval-form').style.display = tab === 'form' ? '' : 'none';
    document.getElementById('hr-eval-tab-list').style.background = tab === 'list' ? 'var(--indigo)' : ''; document.getElementById('hr-eval-tab-list').style.color = tab === 'list' ? '#fff' : '';
    document.getElementById('hr-eval-tab-form').style.background = tab === 'form' ? 'var(--indigo)' : ''; document.getElementById('hr-eval-tab-form').style.color = tab === 'form' ? '#fff' : '';
    if (tab === 'list') renderHREval();
}

function openHRAddModal() { showToast('⚠️ ฟังก์ชันนี้สงวนไว้ โดยให้นักศึกษาสมัครผ่านเมนู "สมัครสมาชิก" ด้วยตนเอง', 'err'); }
function hrExportCSV() {
    const headers = ['ชื่อ', 'มหาวิทยาลัย', 'แผนก', 'เริ่ม', 'สิ้นสุด', 'สถานะ'];
    const rows = hrInterns.map(i => [i.name, i.uni, i.dept, i.start, i.end, i.status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csv);
    a.download = 'interns_report.csv'; a.click(); showToast('⬇ ดาวน์โหลด CSV สำเร็จ!');
}

function renderHRReports() {
    const tbody = document.querySelector('#panel-hr-reports table tbody'); if (!tbody) return;
    const depts = {};
    hrInterns.forEach(intern => {
        const d = intern.dept || 'ไม่ระบุ';
        if (!depts[d]) depts[d] = { interns: [], totalScore: 0, evalCount: 0, totalProgress: 0 };
        depts[d].interns.push(intern);
        const evals = hrEvaluations.filter(e => e.intern_id === intern.id);
        if (evals.length > 0) {
            const latest = evals.sort((a,b) => new Date(b.date) - new Date(a.date))[0];
            depts[d].totalScore += parseFloat(latest.overall_score || 0); depts[d].evalCount++;
        }
        const myAtt = hrAttendances.filter(a => a.student_id === intern.id).length;
        const progress = Math.min(100, Math.round((myAtt / 60) * 100)) || 0;
        depts[d].totalProgress += progress;
    });
    if (Object.keys(depts).length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3)">ไม่พบข้อมูล</td></tr>'; return; }
    tbody.innerHTML = Object.keys(depts).map(d => {
        const data = depts[d], count = data.interns.length;
        const avgScore = data.evalCount > 0 ? (data.totalScore / data.evalCount).toFixed(1) : '—';
        const avgProgress = Math.round(data.totalProgress / count);
        const scoreColor = avgScore >= 4.5 ? 'var(--emerald)' : (avgScore >= 4.0 ? 'var(--blue)' : (avgScore === '—' ? 'var(--text3)' : 'var(--amber)'));
        const progClass = avgProgress >= 80 ? 'pf-e' : (avgProgress >= 50 ? 'pf-t' : 'pf-a');
        let status = '<span class="status s-ok">ปกติ</span>';
        if (avgScore >= 4.5 && avgProgress >= 80) status = '<span class="status s-ok" style="background:rgba(16,185,129,0.1);color:var(--emerald)">ดีเยี่ยม</span>';
        else if (avgProgress < 50 || (avgScore !== '—' && avgScore < 3.5)) status = '<span class="status s-warn">ต้องติดตาม</span>';
        return `<tr><td><strong>${d}</strong></td><td>${count}</td><td><span style="font-weight:700;color:${scoreColor}">${avgScore}</span></td><td><div class="pw"><div class="pb" style="height:6px;flex:1"><div class="pf ${progClass}" style="width:${avgProgress}%"></div></div><span class="pt">${avgProgress}%</span></div></td><td>${status}</td></tr>`;
    }).join('');
}


document.addEventListener('DOMContentLoaded', function () {
    // Set diary date default
    const diaryDate = document.getElementById('diary-date');
    if (diaryDate) diaryDate.value = new Date().toISOString().split('T')[0];
    const manD = document.getElementById('man-d');
    if (manD) manD.value = new Date().toISOString().split('T')[0];
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
// ฟังก์ชันสมัครสมาชิก (บันทึก Role ลงตาราง Profiles ทันที)
async function doRegister() {
    const role = document.getElementById('r-role').value;
    const fn = document.getElementById('r-fn').value.trim();
    const ln = document.getElementById('r-ln').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const pw = document.getElementById('r-pw').value;

    if (!fn || !ln || !email || !pw) {
        showLoginError('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
    }
    if (pw.length < 6) {
        showLoginError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
        return;
    }

    const btn = document.querySelector('#form-register .l-submit');
    const origText = btn.innerHTML;
    btn.innerHTML = 'กำลังสมัครสมาชิก... ⏳';
    btn.disabled = true;

    // 1. สมัครสมาชิกในระบบความปลอดภัยของ Supabase
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: pw,
        options: {
            data: { full_name: `${fn} ${ln}`, role: role }
        }
    });

    if (error) {
        showLoginError('เกิดข้อผิดพลาด: ' + error.message);
        btn.innerHTML = origText;
        btn.disabled = false;
        return;
    }

    // 2. 🚀 บังคับบันทึกข้อมูลลงตาราง Profiles โดยตรง (แก้ปัญหา Role ไม่ยอมเปลี่ยน)
    if (data && data.user) {
        await supabaseClient.from('profiles').upsert({
            id: data.user.id,
            email: email,
            full_name: `${fn} ${ln}`,
            role: role
        });
    }

    alert('✅ สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');

    // คืนค่าปุ่ม ล้างฟอร์ม และสลับไปหน้าล็อกอิน
    btn.innerHTML = origText;
    btn.disabled = false;
    document.getElementById('r-fn').value = '';
    document.getElementById('r-ln').value = '';
    document.getElementById('r-email').value = '';
    document.getElementById('r-pw').value = '';

    switchLoginTab('login');
}
// ═══════════════════════════════════════════
//  LOAD TEACHER DATA (ดึงข้อมูลสำหรับหน้าอาจารย์)
// ═══════════════════════════════════════════
// 1. ประกาศตัวแปรเก็บข้อมูลหลังบ้านให้ครบ (วางไว้บนสุด)
let allInternsAttendance = []; 

// 2. ฟังก์ชันโหลดข้อมูลหลัก: ดึงมาครบจบในรอบเดียว
async function loadTeacherData() {
    if (!currentUser) return;
    try {
        // ดึงรายชื่อนักศึกษาในความดูแล
        const { data: students, error: stuErr } = await supabaseClient
            .from('student_profiles')
            .select(`student_id, university, department, start_date, end_date, profiles!fk_student(full_name, email)`)
            .eq('teacher_id', currentUser.id);

        if (stuErr) throw stuErr;
        
        if (students) {
            const colors = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
            interns = students.map((s, i) => ({
                id: s.student_id,
                name: s.profiles?.full_name || 'ไม่ทราบชื่อ',
                email: s.profiles?.email || '',
                uni: s.university || 'ไม่ระบุ',
                dept: s.department || 'ไม่ระบุ',
                color: colors[i % 6],
                status: 'active'
            }));

            const studentIds = interns.map(i => i.id);

            // 🚀 โหลด Attendance, Diaries และ Evaluations พร้อมกัน (เร็วกว่าและชัวร์กว่า)
            const [attRes, diaRes, evRes] = await Promise.all([
                supabaseClient.from('attendance').select('*').in('student_id', studentIds),
                supabaseClient.from('diaries').select('*').in('student_id', studentIds).order('date', { ascending: false }),
                supabaseClient.from('evaluations').select('*').in('intern_id', studentIds)
            ]);

            allInternsAttendance = attRes.data || [];
            diaries = diaRes.data || [];
            evaluations = evRes.data || [];
        }

        // 3. เรียกใช้ฟังก์ชันวาดหน้าจอ (Render) ทั้งหมด
        renderTeacherDash();
        renderInternList();
        renderTeacherAtt();
       if (typeof renderReviewPanel === 'function') renderReviewPanel();
        

        if (typeof buildSidebar === 'function') buildSidebar(); 

    } catch (err) {
        console.error("❌ โหลดข้อมูลล้มเหลว:", err.message);
    }
}

// 4. ฟังก์ชันวาด Dashboard: คำนวณสถิติจริง และวาดตารางความก้าวหน้า
function renderTeacherDash() {
    const tbl = document.getElementById('td-intern-tbl');
    if (!tbl) return;

    // 📊 คำนวณสถิติ 4 กล่องด้านบนจาก Database 
    const total = interns.length;
    
    // วันจันทร์ของสัปดาห์นี้
    const today = new Date();
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const monStr = mon.toISOString().split('T')[0];
    
    // นับคนส่งครบสัปดาห์นี้
    const sentThisWeek = interns.filter(i => diaries.some(d => d.student_id === i.id && d.date >= monStr)).length;
    // นับคนที่รอประเมิน (ไม่มีประวัติการประเมิน)
    const pendingEval = interns.filter(i => !evaluations.some(e => e.intern_id === i.id || e.internId === i.id)).length;
    // นับคนที่ไม่ส่งบันทึกใน 3 วันล่าสุด
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
    const missed = interns.filter(i => !diaries.some(d => d.student_id === i.id && d.date >= threeDaysAgoStr)).length;

    // อัปเดตตัวเลขเข้า HTML
    if (document.getElementById('td-total')) document.getElementById('td-total').textContent = total;
    if (document.getElementById('td-ok')) document.getElementById('td-ok').textContent = sentThisWeek;
    if (document.getElementById('td-eval')) document.getElementById('td-eval').textContent = pendingEval;
    if (document.getElementById('td-miss')) document.getElementById('td-miss').textContent = missed;

    // 📋 วาดตารางนักศึกษาพร้อม Progress จริง (ป้องกันการขึ้น undefined)
    tbl.innerHTML = interns.slice(0, 5).map(i => {
        const myAtt = allInternsAttendance.filter(a => a.student_id === i.id).length;
        const progress = Math.min(100, Math.round((myAtt / 60) * 100)) || 0; // 60 วันคือเป้าหมาย

        return `<tr>
            <td>
                <div class="nm">
                    <div class="ava-sm ${i.color}">${i.name[0]}</div>
                    <div><div class="nm-main">${i.name}</div><div class="nm-sub">${i.uni}</div></div>
                </div>
            </td>
            <td>
                <div class="pw">
                    <div class="pb"><div class="pf ${progress >= 50 ? 'pf-t' : 'pf-a'}" style="width:${progress}%"></div></div>
                    <div class="pt">${progress}%</div>
                </div>
            </td>
            <td><span class="status s-ok">กำลังฝึกงาน</span></td>
            <td><button class="btn btn-sm btn-outline" onclick="goEvalIntern('${i.id}')">ประเมิน</button></td>
        </tr>`;
    }).join('');

    // เรียกฟังก์ชันวาดกล่องข้างๆ
    renderTeacherActivity();
    renderTeacherPending();
}

// 5. วาด "กิจกรรมล่าสุด"
function renderTeacherActivity() {
    const actContainer = document.querySelector('#panel-t-dash .card-body');
    if (!actContainer) return;
    
    if (!diaries.length) {
        actContainer.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3)">ไม่มีกิจกรรมล่าสุด</div>';
        return;
    }

    actContainer.innerHTML = diaries.slice(0, 4).map(d => {
        const intern = interns.find(i => i.id === d.student_id);
        return `<div class="act-item">
            <div class="act-ico ai-t">📝</div>
            <div>
                <div class="act-text"><strong>${intern ? intern.name : 'นักศึกษา'}</strong> ส่งบันทึกประจำวัน</div>
                <div class="act-time">${d.date}</div>
            </div>
        </div>`;
    }).join('');
}

// 6. วาด "บันทึกที่รอตรวจ"
function renderTeacherPending() {
    const pend = document.getElementById('td-pending');
    if (!pend) return;
    
    const pendDiaries = diaries.filter(d => d.status === 'pending');
    if (!pendDiaries.length) {
        pend.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">ไม่มีบันทึกรอตรวจ ✅</td></tr>';
        return;
    }
    
    pend.innerHTML = pendDiaries.slice(0, 5).map(d => {
        const intern = interns.find(i => i.id === d.student_id);
        const name = intern ? intern.name : 'นักศึกษา';
        const color = intern ? intern.color : 'c1';
        return `<tr>
            <td><div class="nm"><div class="ava-sm ${color}">${name[0]}</div><div class="nm-main">${name}</div></div></td>
            <td>${d.date}</td>
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.title}</td>
            <td>${d.mood || '😐'}</td>
            <td><span class="status s-warn">รอตรวจ</span></td>
            <td><button class="btn btn-sm btn-outline" onclick="switchPanel('t-review')">ตรวจ</button></td>
        </tr>`;
    }).join('');
}

// 7. วาด "ติดตามเวลาเข้างาน" แบบดึงข้อมูลจริง
function renderTeacherAtt() {
    const tbl = document.getElementById('t-att-tbl');
    if (!tbl) return;

    if (!interns.length) {
        tbl.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">ไม่พบข้อมูล</td></tr>';
        return;
    }

    tbl.innerHTML = interns.map(i => {
        const myAtt = allInternsAttendance.filter(a => a.student_id === i.id);
        const days = myAtt.length;
        const hrs = myAtt.reduce((sum, a) => sum + (parseFloat(a.total_hours) || 0), 0);
        const late = myAtt.filter(a => a.is_late).length;
        const pct = Math.min(100, Math.round((days / 60) * 100)) || 0;

        return `<tr>
            <td><div class="nm"><div class="ava-sm ${i.color}">${i.name[0]}</div><div class="nm-main">${i.name}</div></div></td>
            <td>${days} วัน</td>
            <td>${hrs.toFixed(1)} ชม.</td>
            <td style="color:${late > 0 ? 'var(--rose)' : 'inherit'}">${late} ครั้ง</td>
            <td>0</td>
            <td>
                <div class="pw">
                    <div class="pb" style="width:80px"><div class="pf ${pct >= 80 ? 'pf-t' : pct >= 50 ? 'pf-a' : 'pf-r'}" style="width:${pct}%"></div></div>
                    <span style="font-size:11px;color:var(--text2)">${pct}%</span>
                </div>
            </td>
            <td>${pct >= 80 ? '<span class="status s-ok">ปกติ</span>' : '<span class="status s-warn">ต้องติดตาม</span>'}</td>
        </tr>`;
    }).join('');
}

// ═══════════════════════════════════════════
// AUTH STATE & SESSION CHECK
// ═══════════════════════════════════════════
// ดักจับเวลาล็อกเอาท์
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        localStorage.clear();
        goScreen('landing');
    }
});

// ฟังก์ชันหลักที่รันตอนโหลดหน้าเว็บ
async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session && session.user) {

        // 🚀 ดึงข้อมูล Role จากฐานข้อมูลโดยตรง
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('id, email, full_name, role')
            .eq('id', session.user.id)
            .single();

        if (profile) {
            currentRole = profile.role;
            currentUser = { id: profile.id, email: profile.email, name: profile.full_name };
            localStorage.setItem('it_user', JSON.stringify(currentUser));
            localStorage.setItem('it_role', currentRole);
        } else {
            currentRole = localStorage.getItem('it_role') || 'student';
        }

        // 🚀 พาไปหน้า Dashboard ที่ถูกต้อง
        if (currentRole === 'hr') {
            await loadHRData();
            launchHR(); // ฟังก์ชันนี้จะเรียก goScreen('hr') ให้ข้างใน
        } else {
            goScreen('app'); // สลับไปหน้า App
            if (typeof buildSidebar === 'function') buildSidebar();
            if (typeof updateUserUI === 'function') updateUserUI();

            try {
                if (currentRole === 'teacher') {
                    if (typeof loadTeacherData === 'function') await loadTeacherData();
                    if (typeof switchPanel === 'function') switchPanel('t-dash');
                } else if (currentRole === 'student') {
                    if (typeof loadStudentData === 'function') await loadStudentData();
                    if (typeof switchPanel === 'function') switchPanel('s-dash');
                }
            } catch (error) {
                console.error("เกิดข้อผิดพลาดตอนดึงข้อมูล:", error);
            }
        }
    } else {
        // ถ้าไม่มีคนล็อกอิน ให้กลับไปหน้า Landing
        goScreen('landing');
    }
}

// 🚀 เริ่มทำงานทันที
checkUserSession();
