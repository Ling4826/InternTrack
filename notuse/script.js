// ═══════════════════════════════════════════
// 1. ตั้งค่าการเชื่อมต่อ Supabase
// ═══════════════════════════════════════════
const supabaseUrl = 'https://tqxiqzjcixmgnsnklhnh.supabase.co';
const supabaseKey = 'sb_publishable_pciWxrBuNenHo4Dq3fTZ6g_b9NwNk2a';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ═══════════════════════════════════════════
// 2. ฟังก์ชันเปลี่ยนหน้าเว็บ (Navigation)
// ═══════════════════════════════════════════
function goScreen(pageName) {
    if (pageName === 'landing') window.location.href = 'index.html';
    if (pageName === 'login') window.location.href = 'login.html';
    if (pageName === 'app') window.location.href = 'APP.html';
    if (pageName === 'hr') window.location.href = 'HR.html';
}

function goLogin() {
    window.location.href = 'login.html';
}

function goLoginAs(role) {
    // ฟังก์ชันนี้ถูกเรียกจากหน้า index.html เวลากดเลือกการ์ดบทบาท
    window.location.href = `login.html?role=${role}`;
}

// ═══════════════════════════════════════════
// 3. ระบบเข้าสู่ระบบ (Authentication - Supabase จริง)
// ═══════════════════════════════════════════
async function doLogin() {
    const email = document.getElementById('l-email').value.trim();
    const pw = document.getElementById('l-pw').value;
    const errBox = document.getElementById('login-err');
    if(errBox) errBox.style.display = 'none';

    if (!email || !pw) {
        if(errBox) {
            errBox.textContent = 'กรุณากรอกอีเมลและรหัสผ่าน';
            errBox.style.display = 'block';
        }
        return;
    }

    // 1. ล็อคอินผ่าน Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: pw
    });

    if (authError) {
        if(errBox) {
            errBox.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            errBox.style.display = 'block';
        }
        return;
    }

    // 2. ดึง Role จากตาราง profiles ของผู้ใช้ที่เพิ่งล็อคอิน
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (profileData) {
        // 3. บันทึก Session และแยกหน้าตาม Role
        localStorage.setItem('it_user', JSON.stringify(profileData));
        localStorage.setItem('it_role', profileData.role);
        
        if (profileData.role === 'hr') {
            window.location.href = 'HR.html';
        } else {
            window.location.href = 'APP.html';
        }
    } else {
        alert('เข้าสู่ระบบสำเร็จ แต่ไม่พบข้อมูล Profile ของคุณในระบบ');
    }
}

async function doLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem('it_user');
    localStorage.removeItem('it_role');
    window.location.href = 'login.html';
}

// ═══════════════════════════════════════════
// 4. ฟังก์ชันควบคุมหน้าจอ (UI Controls)
// ═══════════════════════════════════════════
function switchLoginTab(tab) {
    const loginForm = document.getElementById('form-login');
    const regForm = document.getElementById('form-register');
    const loginBtn = document.getElementById('lt-login');
    const regBtn = document.getElementById('lt-reg');

    if (tab === 'login') {
        if(loginForm) loginForm.style.display = 'block';
        if(regForm) regForm.style.display = 'none';
        if(loginBtn) loginBtn.classList.add('active');
        if(regBtn) regBtn.classList.remove('active');
    } else {
        if(loginForm) loginForm.style.display = 'none';
        if(regForm) regForm.style.display = 'block';
        if(loginBtn) loginBtn.classList.remove('active');
        if(regBtn) regBtn.classList.add('active');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('it_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        currentRole = localStorage.getItem('it_role');
    }

    const path = window.location.pathname;
    
    if (path.includes('APP.html')) {
        // เปิดระบบเช็คล็อคอินกลับมาใช้งานตามปกติ
        if (!currentUser) { 
            window.location.href = 'login.html'; 
            return; 
        }
        
        buildSidebar();
        
        // 🚀 เรียกดึงข้อมูลจาก Supabase มาใส่หน้าจอ!
        if (currentRole === 'student') {
            loadStudentData(); // ดึงข้อมูลของนักศึกษา
            switchPanel('s-dash');
        } else {
            switchPanel('t-dash');
        }
    }
});

// ═══════════════════════════════════════════
// 5. ระบบจัดการหน้าจอและเมนู (UI Controls)
// ═══════════════════════════════════════════

// ฟังก์ชันสำหรับสลับหน้าย่อยใน APP.html (เช่น จาก Dashboard ไปหน้าบันทึก)
function switchPanel(panelId) {
    // 1. ซ่อนทุกหน้าจอ
    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    
    // 2. แสดงเฉพาะหน้าที่เลือก
    const activePanel = document.getElementById('panel-' + panelId);
    if(activePanel) activePanel.style.display = 'block';

    // 3. เปลี่ยนสีปุ่มเมนูใน Sidebar ให้เป็นปุ่มที่ถูกกด (active)
    document.querySelectorAll('.sb-item').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[onclick="switchPanel('${panelId}')"]`);
    if(activeBtn) activeBtn.classList.add('active');
}

// ฟังก์ชันสำหรับสร้างเมนูด้านซ้าย (Sidebar) ตามบทบาท
function buildSidebar() {
    const nav = document.getElementById('sb-nav');
    if (!nav) return;
    
    let html = '';
    // ถ้าเป็นนักศึกษา ให้โชว์เมนูของนักศึกษา
    if (currentRole === 'student') {
        html += `<button class="sb-item active" onclick="switchPanel('s-dash')">🏠 Dashboard</button>`;
        html += `<button class="sb-item" onclick="switchPanel('s-diary')">📝 บันทึกประจำวัน</button>`;
        html += `<button class="sb-item" onclick="switchPanel('s-att')">⏰ เวลาเข้าออก</button>`;
        html += `<button class="sb-item" onclick="switchPanel('s-eval')">⭐ ผลการประเมิน</button>`;
    } 
    // ถ้าเป็นอาจารย์ ให้โชว์เมนูของอาจารย์
    else if (currentRole === 'teacher') {
        html += `<button class="sb-item active" onclick="switchPanel('t-dash')">🏠 Dashboard</button>`;
        html += `<button class="sb-item" onclick="switchPanel('t-diaries')">📝 ตรวจบันทึก</button>`;
        html += `<button class="sb-item" onclick="switchPanel('t-evals')">⭐ ประเมินผล</button>`;
        html += `<button class="sb-item" onclick="switchPanel('t-report')">📊 สรุปผล</button>`;
    }
    nav.innerHTML = html;

    // อัปเดตชื่อผู้ใช้และตัวอักษรย่อที่มุมซ้ายล่าง
    if(currentUser) {
        const nameEl = document.getElementById('sb-uname');
        const roleEl = document.getElementById('sb-urole');
        const avaEl = document.getElementById('sb-ava');
        
        // ถ้ามีชื่อเต็มให้ใช้ชื่อเต็ม ถ้าไม่มีให้ใช้อีเมล
        const displayName = currentUser.full_name || currentUser.email || 'ผู้ใช้';
        
        if(nameEl) nameEl.textContent = displayName;
        if(roleEl) roleEl.textContent = currentRole === 'student' ? 'นักศึกษา' : 'อาจารย์';
        if(avaEl) avaEl.textContent = displayName.charAt(0).toUpperCase();
    }
}

// ═══════════════════════════════════════════
// 6. คำสั่งทำงานเมื่อเปิดหน้าเว็บ (Init)
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    // ดึงข้อมูลล็อคอินที่เคยบันทึกไว้ในเครื่อง
    const savedUser = localStorage.getItem('it_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        currentRole = localStorage.getItem('it_role');
    }

    const path = window.location.pathname;
    
    // ถ้ากำลังเปิดหน้า APP.html
    if (path.includes('APP.html')) {
        // ถ้ายังไม่ล็อคอิน ให้เด้งกลับไปหน้า login
        if (!currentUser) { 
            window.location.href = 'login.html'; 
            return; 
        }
        
        // สร้างเมนูซ้ายมือ
        buildSidebar();
        
        // สั่งให้เปิดหน้า Dashboard เป็นหน้าแรก
        if (currentRole === 'student') {
            switchPanel('s-dash');
        } else {
            switchPanel('t-dash');
        }
    }
});

// ═══════════════════════════════════════════
// 7. ฟังก์ชันดึงข้อมูลจาก Supabase และยัดลงหน้าเว็บ
// ═══════════════════════════════════════════

async function loadStudentData() {
    if (!currentUser) return;

    // 📌 1. ดึงข้อมูลบันทึกประจำวัน (Diaries)
    const { data: diariesData, error: diaryErr } = await supabase
        .from('diaries')
        .select('*')
        .eq('student_id', currentUser.id)
        .order('date', { ascending: false }); // เรียงจากวันที่ล่าสุดไปเก่าสุด

    if (diariesData && diariesData.length > 0) {
        // ส่งข้อมูลไปหยอดในตาราง
        renderDiaries(diariesData);
    }

    // 📌 2. ดึงข้อมูลประวัติการเข้างาน (Attendance)
    const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', currentUser.id)
        .order('date', { ascending: false });

    if (attData && attData.length > 0) {
        // ส่งข้อมูลไปหยอดในตาราง
        renderAttendance(attData);
    }
}

// ฟังก์ชันสร้าง HTML ยัดลงตารางบันทึกประจำวัน
function renderDiaries(data) {
    // ⚠️ ตรงนี้คุณต้องเช็คว่าใน APP.html ของคุณ ตารางหรือลิสต์บันทึกใช้ ID อะไร
    // สมมติว่าใช้ id="s-diary-list"
    const tbody = document.getElementById('s-diary-list'); 
    if (!tbody) return;

    let html = '';
    data.forEach(item => {
        // แปลงสถานะเป็นป้ายสีสวยๆ
        let statusBadge = item.status === 'approved' 
            ? '<span style="color:var(--emerald)">✅ อนุมัติแล้ว</span>' 
            : '<span style="color:var(--amber)">⏳ รอตรวจ</span>';

        html += `
            <tr>
                <td>${item.date}</td>
                <td><strong>${item.title}</strong><br><small style="color:var(--text2)">${item.work_detail}</small></td>
                <td>${item.hours_worked || '-'} ชม.</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html; // ยัดโค้ด HTML เข้าไปในตาราง
}

// ฟังก์ชันสร้าง HTML ยัดลงตารางเวลาเข้างาน
function renderAttendance(data) {
    // สมมติว่าตารางเข้างานใช้ id="s-att-tbl"
    const tbody = document.getElementById('s-att-tbl');
    if (!tbody) return;

    let html = '';
    data.forEach(item => {
        let statusText = item.is_late 
            ? '<span style="color:var(--rose)">สาย</span>' 
            : '<span style="color:var(--teal)">ปกติ</span>';

        html += `
            <tr>
                <td>${item.date}</td>
                <td>${item.check_in || '-'}</td>
                <td>${item.check_out || '-'}</td>
                <td>${item.total_hours || '-'} ชม.</td>
                <td>${statusText}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}