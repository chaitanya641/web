
    /* ----------------------------- Simple SPA Router ----------------------------- */
    const App = (() => {
      // Data keys
      const STORAGE_KEY = 'ams_data_v1';

      // Default state
      const state = {
        user: null,
        students: [],
        courses: [],
        attendance: {}, // { courseId: { dateISO: [studentIds...] }}
        exams: []
      };

      // Helpers
      function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
      function load(){
        const raw = localStorage.getItem(STORAGE_KEY);
        if(raw){ try{ const parsed = JSON.parse(raw); Object.assign(state, parsed); }catch(e){ console.error('Failed to parse storage', e); }
        }
      }

      function id(prefix='id'){return prefix+'_'+Math.random().toString(36).slice(2,9)}

      /* safe setter: only set if element exists */
      function setTextIfExists(id, text){
        const el = document.getElementById(id);
        if(el) el.textContent = text;
      }

      /* --------------------------- View rendering --------------------------- */
      const content = document.getElementById('content-area');
      function setActiveMenu(key){
        $('#menu button').removeClass('active');
        $(`#menu button[data-view='${key}']`).addClass('active');
      }

      function render(view){
        setActiveMenu(view);
        content.innerHTML = '';
        const tpl = document.getElementById('tpl-'+view);
        if(!tpl) return content.innerHTML = '<div class="card">View not found</div>';
        const clone = tpl.content.cloneNode(true);
        content.appendChild(clone);
        afterRender(view);
      }

      function afterRender(view){
        // common stat update: only update if the elements exist
        setTextIfExists('current-user', state.user ? state.user.name : 'Guest');
        setTextIfExists('stat-students', String(state.students.length));
        setTextIfExists('stat-courses', String(state.courses.length));
        // average attendance
        let avg = 0;
        const allCounts = [];
        for(const cId of Object.keys(state.attendance)){
          const map = state.attendance[cId];
          if(!map) continue;
          const dates = Object.keys(map);
          for(const d of dates){ allCounts.push(map[d].length); }
        }
        if(allCounts.length) avg = Math.round((allCounts.reduce((a,b)=>a+b,0) / (allCounts.length * Math.max(1,state.students.length))) * 100);
        setTextIfExists('stat-attendance', (isNaN(avg)?0:avg)+'%');

        if(view === 'home'){
          $('#add-student-home').on('click', ()=> openStudentModal());
          $('#sample-data').on('click', ()=>{ loadSampleData(); render('home'); });
        }

        if(view === 'students'){
          renderStudentsTable();
          $('#btn-add-student').on('click', ()=> openStudentModal());
          $('#search-student').on('input', e=> renderStudentsTable(e.target.value));
        }

        if(view === 'courses'){
          renderCourses();
          $('#btn-add-course').on('click', ()=> openCourseModal());
        }

        if(view === 'attendance'){
          populateCourseDropdown();
          $('#btn-mark-attendance').on('click', ()=> openAttendanceModal($('#attendance-course').val()));
        }

        if(view === 'exams'){
          renderExams();
          $('#btn-add-exam').on('click', ()=> openExamModal());
        }

        if(view === 'reports'){
          $('#export-students').on('click', ()=> exportStudentsCSV());
          $('#export-att').on('click', ()=> exportAttendanceCSV());
        }

        if(view === 'settings'){
          $('#theme-select').on('change', (e)=>{ document.body.dataset.theme = e.target.value; });
        }
      }

      /* --------------------------- Students UI --------------------------- */
      function renderStudentsTable(filter=''){
        const wrap = document.getElementById('students-table-wrap');
        let rows = state.students;
        if(filter) rows = rows.filter(s => (s.name + ' ' + s.id + ' ' + (s.email||'')).toLowerCase().includes(filter.toLowerCase()));
        if(rows.length === 0){ wrap.innerHTML = '<div style="color:var(--muted)">No students found.</div>'; return; }
        let html = '<table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Course</th><th>Actions</th></tr></thead><tbody>';
        for(const s of rows){
          const course = state.courses.find(c=>c.id===s.courseId);
          html += `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.email||'-'}</td><td>${course?course.title:'-'}</td><td><button class="btn ghost" data-action="edit" data-id="${s.id}">Edit</button> <button class="btn" data-action="delete" data-id="${s.id}">Delete</button></td></tr>`;
        }
        html += '</tbody></table>';
        wrap.innerHTML = html;
        $(wrap).find('button[data-action="edit"]').on('click', (e)=>{ const id=$(e.currentTarget).data('id'); openStudentModal(id); });
        $(wrap).find('button[data-action="delete"]').on('click', (e)=>{ const id=$(e.currentTarget).data('id'); if(confirm('Delete student?')){ state.students = state.students.filter(s=>s.id!==id); save(); render('students'); } });
      }

      function openStudentModal(studentId=null){
        const student = state.students.find(s=>s.id===studentId) || {id:id('STU'), name:'', email:'', courseId: state.courses[0]?.id || '' };
        const modal = $("<div class='modal'><div class='panel card'>"+
          `<h3>${studentId? 'Edit':'Add'} Student</h3>`+
          `<div style='margin-top:8px'>`+
            `<label>Name<br><input class='input' id='stu-name' value='${escapeHtml(student.name)}'></label><br>`+
            `<label>Email<br><input class='input' id='stu-email' value='${escapeHtml(student.email||'')}'></label><br>`+
            `<label>Course<br><select id='stu-course' class='input'></select></label><br>`+
            `<div style='margin-top:8px'><button class='btn' id='save-stu'>Save</button> <button class='btn ghost' id='cancel-stu'>Cancel</button></div>`+
          `</div></div></div>`);
        $('#modal-root').append(modal);
        // populate courses
        state.courses.forEach(c=>{ $('#stu-course').append(`<option value='${c.id}' ${c.id===student.courseId?'selected':''}>${c.title}</option>`); });
        $('#cancel-stu').on('click', ()=> modal.remove());
        $('#save-stu').on('click', ()=>{
          const name = $('#stu-name').val().trim(); const email = $('#stu-email').val().trim(); const courseId = $('#stu-course').val();
          if(!name){ alert('Name required'); return; }
          if(studentId){
            const s = state.students.find(x=>x.id===studentId); if(s){ s.name=name; s.email=email; s.courseId=courseId; }
          } else {
            state.students.push({id:student.id, name, email, courseId});
          }
          save(); modal.remove(); render('students');
        });
      }

      /* --------------------------- Courses UI --------------------------- */
      function renderCourses(){
        const wrap = document.getElementById('courses-list');
        if(state.courses.length===0) { wrap.innerHTML = '<div style="color:var(--muted)">No courses. Add one.</div>'; return; }
        let html = '<ul style="list-style:none;padding:0;margin:0;display:grid;gap:8px">';
        for(const c of state.courses){ html += `<li style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-radius:8px;background:#fbfdff"><div><strong>${c.title}</strong><div style="font-size:12px;color:var(--muted)">${c.code}</div></div><div><button class="btn ghost" data-act="edit" data-id="${c.id}">Edit</button> <button class="btn" data-act="del" data-id="${c.id}">Delete</button></div></li>`; }
        html += '</ul>';
        wrap.innerHTML = html;
        $(wrap).find('button[data-act="edit"]').on('click', (e)=> openCourseModal($(e.currentTarget).data('id')));
        $(wrap).find('button[data-act="del"]').on('click', (e)=>{ const id=$(e.currentTarget).data('id'); if(confirm('Delete course?')){ state.courses = state.courses.filter(x=>x.id!==id); save(); render('courses'); } });
      }

      function openCourseModal(courseId=null){
        const course = state.courses.find(c=>c.id===courseId) || {id:id('CRS'), title:'', code:''};
        const modal = $("<div class='modal'><div class='panel card'>"+
          `<h3>${courseId? 'Edit':'Add'} Course</h3>`+
          `<div style='margin-top:8px'>`+
            `<label>Title<br><input class='input' id='course-title' value='${escapeHtml(course.title)}'></label><br>`+
            `<label>Code<br><input class='input' id='course-code' value='${escapeHtml(course.code)}'></label><br>`+
            `<div style='margin-top:8px'><button class='btn' id='save-course'>Save</button> <button class='btn ghost' id='cancel-course'>Cancel</button></div>`+
          `</div></div></div>`);
        $('#modal-root').append(modal);
        $('#cancel-course').on('click', ()=> modal.remove());
        $('#save-course').on('click', ()=>{
          const title = $('#course-title').val().trim(); const code = $('#course-code').val().trim();
          if(!title){ alert('Title required'); return; }
          if(courseId){ const c = state.courses.find(x=>x.id===courseId); if(c){ c.title=title; c.code=code; } }
          else state.courses.push({id:course.id, title, code});
          save(); modal.remove(); render('courses');
        });
      }

      /* --------------------------- Attendance UI --------------------------- */
      function populateCourseDropdown(){ const sel = $('#attendance-course'); sel.empty(); state.courses.forEach(c=> sel.append(`<option value='${c.id}'>${c.title}</option>`)); }

      function openAttendanceModal(courseId){
        if(!courseId){ alert('Pick a course'); return; }
        const course = state.courses.find(c=>c.id===courseId);
        if(!course){ alert('Course not found'); return; }
        const modal = $("<div class='modal'><div class='panel card'>"+
          `<h3>Mark Attendance - ${escapeHtml(course.title)}</h3>`+
          `<div style='margin-top:8px' id='att-list-wrap'></div>`+
          `<div style='margin-top:8px'><button class='btn' id='save-att'>Save Attendance</button> <button class='btn ghost' id='close-att'>Close</button></div>`+
          `</div></div>`);
        $('#modal-root').append(modal);
        const students = state.students.filter(s=>s.courseId===courseId);
        let html = '<div style="max-height:300px;overflow:auto">';
        for(const s of students){ html += `<label style="display:block;margin-bottom:6px"><input type='checkbox' class='att-chk' value='${s.id}'> ${s.name} (${s.id})</label>`; }
        html += '</div>';
        $('#att-list-wrap').html(html);
        $('#close-att').on('click', ()=> modal.remove());
        $('#save-att').on('click', ()=>{
          const checked = $('.att-chk:checked').toArray().map(i=>i.value);
          const date = new Date().toISOString().slice(0,10);
          state.attendance[courseId] = state.attendance[courseId] || {};
          state.attendance[courseId][date] = checked;
          save(); modal.remove(); alert('Attendance saved for '+date);
        });
      }

      /* --------------------------- Exams UI --------------------------- */
      function renderExams(){ const wrap = document.getElementById('exams-list'); if(state.exams.length===0){ wrap.innerHTML = '<div style="color:var(--muted)">No exams scheduled.</div>'; return; } let html='<ul style="padding:0">'; for(const ex of state.exams){ html += `<li style="padding:10px;border-radius:8px;background:#fff;margin-bottom:8px;display:flex;justify-content:space-between"><div><strong>${ex.title}</strong><div style="font-size:13px;color:var(--muted)">${ex.courseTitle} — ${ex.date}</div></div><div><button class="btn ghost" data-id='${ex.id}' data-act='view'>View</button> <button class="btn" data-id='${ex.id}' data-act='del'>Delete</button></div></li>`; } html+='</ul>'; wrap.innerHTML = html; $(wrap).find('button[data-act="view"]').on('click', e=>{ const id=$(e.currentTarget).data('id'); openExamResultModal(id); }); $(wrap).find('button[data-act="del"]').on('click', e=>{ const id=$(e.currentTarget).data('id'); state.exams = state.exams.filter(x=>x.id!==id); save(); render('exams'); }); }

      function openExamModal(){ const modal = $("<div class='modal'><div class='panel card'>"+
        `<h3>Create Exam</h3>`+
        `<label>Title<br><input class='input' id='exam-title'></label><br>`+
        `<label>Course<br><select class='input' id='exam-course'></select></label><br>`+
        `<label>Date<br><input class='input' id='exam-date' type='date'></label><br>`+
        `<div style='margin-top:8px'><button class='btn' id='save-exam'>Save</button> <button class='btn ghost' id='cancel-exam'>Cancel</button></div>`+
        `</div></div>`);
      $('#modal-root').append(modal);
      state.courses.forEach(c=>$('#exam-course').append(`<option value='${c.id}'>${c.title}</option>`));
      $('#cancel-exam').on('click', ()=> modal.remove());
      $('#save-exam').on('click', ()=>{
        const title = $('#exam-title').val().trim(); const courseId = $('#exam-course').val(); const date = $('#exam-date').val();
        if(!title||!courseId||!date){ alert('All fields required'); return; }
        const c = state.courses.find(x=>x.id===courseId);
        state.exams.push({id:id('EX'), title, courseId, courseTitle:c?c.title:courseId, date}); save(); modal.remove(); render('exams');
      }); }

      function openExamResultModal(examId){
        const ex = state.exams.find(x=>x.id===examId);
        if(!ex){ alert('Exam not found'); return; }
        const modal = $("<div class='modal'><div class='panel card'>"+
        `<h3>Exam: ${escapeHtml(ex.title)}</h3>`+
        `<div style='margin-top:8px'>Course: ${escapeHtml(ex.courseTitle)}<br>Date: ${ex.date}</div>`+
        `<div style='margin-top:12px'><button class='btn' id='close-exam'>Close</button></div>`+
        `</div></div>`);
        $('#modal-root').append(modal);
        $('#close-exam').on('click', ()=> modal.remove());
      }

      /* --------------------------- Reports & Export --------------------------- */
      function exportStudentsCSV(){
        const rows = [['id','name','email','course']];
        state.students.forEach(s=>{ const c = state.courses.find(x=>x.id===s.courseId); rows.push([s.id, s.name, s.email || '', c?c.title:'']); });
        downloadCSV(rows,'students.csv');
      }
      function exportAttendanceCSV(){
        const rows=[['course','date','presentCount','presentIds']];
        for(const cid of Object.keys(state.attendance)){
          const course = state.courses.find(c=>c.id===cid);
          for(const date of Object.keys(state.attendance[cid])){
            rows.push([course?course.title:cid, date, state.attendance[cid][date].length, state.attendance[cid][date].join('|')]);
          }
        }
        downloadCSV(rows,'attendance.csv');
      }
      function downloadCSV(rows,filename){ const csv = rows.map(r=> r.map(c=> '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n'); const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

      /* --------------------------- Utilities --------------------------- */
      function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

      function loadSampleData(){ state.students = [ {id:'STU_A1', name:'Priya Sharma', email:'priya@example.com', courseId:'CRS_101'}, {id:'STU_A2', name:'Ravi Kumar', email:'ravi@example.com', courseId:'CRS_102'}, {id:'STU_A3', name:'Aisha Khan', email:'aisha@example.com', courseId:'CRS_101'} ]; state.courses = [ {id:'CRS_101', title:'Computer Science', code:'CS101'}, {id:'CRS_102', title:'Mathematics', code:'MA102'} ]; state.attendance = { 'CRS_101': { '2025-10-01': ['STU_A1','STU_A3'] }, 'CRS_102': { '2025-10-01': ['STU_A2'] } }; state.exams = [ {id:'EX_1', title:'Midterm CS', courseId:'CRS_101', courseTitle:'Computer Science', date:'2025-11-10'} ]; save(); }

      /* --------------------------- Initialization --------------------------- */
      function init(){
        load();
        // Menu handlers
        $('#menu button').on('click', function(){ const v = $(this).data('view'); render(v); });
        // top buttons
        $('#btn-login').on('click', ()=> openLoginModal());
        $('#btn-signup').on('click', ()=> openSignupModal());
        // initial view
        render('home');
      }

      /* --------------------------- Auth modals (frontend demo) --------------------------- */
      function openLoginModal(){ const modal = $("<div class='modal'><div class='panel card'>"+
        `<h3>Login</h3>`+
        `<label>Email<br><input class='input' id='login-email'></label><br>`+
        `<label>Password<br><input class='input' id='login-pass' type='password'></label><br>`+
        `<div style='margin-top:8px'><button class='btn' id='do-login'>Login</button> <button class='btn ghost' id='close-login'>Cancel</button></div>`+
        `</div></div>`); $('#modal-root').append(modal); $('#close-login').on('click', ()=> modal.remove()); $('#do-login').on('click', ()=>{ const email=$('#login-email').val().trim(); const pass=$('#login-pass').val(); if(!email||!pass){ alert('Enter credentials'); return; } state.user = {id:id('U'), name: email.split('@')[0], email}; save(); modal.remove(); render('home'); }); }

      function openSignupModal(){ const modal = $("<div class='modal'><div class='panel card'>"+
        `<h3>Sign up</h3>`+
        `<label>Name<br><input class='input' id='su-name'></label><br>`+
        `<label>Email<br><input class='input' id='su-email'></label><br>`+
        `<label>Password<br><input class='input' id='su-pass' type='password'></label><br>`+
        `<div style='margin-top:8px'><button class='btn' id='do-signup'>Create</button> <button class='btn ghost' id='close-signup'>Cancel</button></div>`+
        `</div></div>`); $('#modal-root').append(modal); $('#close-signup').on('click', ()=> modal.remove()); $('#do-signup').on('click', ()=>{ const name=$('#su-name').val().trim(); const email=$('#su-email').val().trim(); const pass=$('#su-pass').val(); if(!name||!email||!pass){ alert('All fields'); return; } state.user = {id:id('U'), name, email}; save(); modal.remove(); render('home'); }); }

      return { init };
    })();

    // start app
    $(document).ready(()=>{ App.init(); });
