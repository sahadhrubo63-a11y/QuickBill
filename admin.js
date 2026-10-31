const AdminPanel = (function() {
    let pendingApps = JSON.parse(localStorage.getItem('pos_pending_apps')) || [];
    let approvedApps = JSON.parse(localStorage.getItem('pos_approved_apps')) || [];
    let rejectedApps = JSON.parse(localStorage.getItem('pos_rejected_apps')) || [];
    let dbUsers = JSON.parse(localStorage.getItem('pos_users')) || {};

    function saveData() {
        localStorage.setItem('pos_pending_apps', JSON.stringify(pendingApps));
        localStorage.setItem('pos_approved_apps', JSON.stringify(approvedApps));
        localStorage.setItem('pos_rejected_apps', JSON.stringify(rejectedApps));
        localStorage.setItem('pos_users', JSON.stringify(dbUsers));
    }

    return {
        login: function() {
            const u = document.getElementById('admin-user').value.trim();
            const p = document.getElementById('admin-pass').value.trim();
            if(u === 'admin' && p === 'admin123') {
                document.getElementById('admin-login-wrapper').classList.add('hidden');
                document.getElementById('admin-dashboard-wrapper').classList.remove('hidden');
                this.renderAll();
            } else {
                alert('Invalid Admin credentials! (Use admin / admin123)');
            }
        },

        logout: function() {
            document.getElementById('admin-dashboard-wrapper').classList.add('hidden');
            document.getElementById('admin-login-wrapper').classList.remove('hidden');
        },

        switchTab: function(tab) {
            document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="admin-btn-"]').forEach(btn => {
                btn.classList.remove('bg-indigo-600', 'text-white');
                btn.classList.add('bg-white', 'text-slate-600');
            });

            document.getElementById(`admin-tab-${tab}`).classList.remove('hidden');
            const activeBtn = document.getElementById(`admin-btn-${tab}`);
            activeBtn.classList.remove('bg-white', 'text-slate-600');
            activeBtn.classList.add('bg-indigo-600', 'text-white');
        },

        renderAll: function() {
            document.getElementById('count-pending').innerText = pendingApps.length;
            document.getElementById('count-approved').innerText = approvedApps.length;
            document.getElementById('count-rejected').innerText = rejectedApps.length;

            this.renderPending();
            this.renderApproved();
            this.renderRejected();
        },

        renderPending: function() {
            const tbody = document.getElementById('table-pending-body');
            tbody.innerHTML = '';
            pendingApps.forEach((app, index) => {
                tbody.innerHTML += `
                    <tr class="text-sm hover:bg-slate-50 transition">
                        <td class="p-4">
                            <div class="flex items-center space-x-3">
                                <img src="${app.picFile || 'https://via.placeholder.com/150'}" class="w-10 h-10 rounded-full object-cover cursor-pointer border" onclick="AdminPanel.openFullscreenProfile('${app.id}')" alt="Pic">
                                <div>
                                    <strong class="cursor-pointer text-indigo-600 hover:underline" onclick="AdminPanel.openFullscreenProfile('${app.id}')">${app.company}</strong><br>
                                    <span class="text-xs text-slate-500">Owner: ${app.name} | Req: ${app.username}</span>
                                </div>
                            </div>
                        </td>
                        <td class="p-4 text-xs">📞 ${app.phone}<br>✉️ ${app.email}</td>
                        <td class="p-4 text-xs">DOB: ${app.dob}<br><strong class="text-indigo-600">${app.age}</strong></td>
                        <td class="p-4 text-xs space-y-1">
                            <span class="text-indigo-600 cursor-pointer font-semibold hover:underline block" onclick="AdminPanel.viewFile('${app.nidFile}')">📄 View NID</span>
                            <span class="text-indigo-600 cursor-pointer font-semibold hover:underline block" onclick="AdminPanel.viewFile('${app.tradeFile}')">📑 View Trade License</span>
                        </td>
                        <td class="p-4 text-center">
                            <div class="flex items-center justify-center space-x-2">
                                <input type="text" id="pass-inp-${index}" placeholder="Assign Password" class="border p-2 rounded text-xs w-28">
                                <button onclick="AdminPanel.approveApp(${index})" class="bg-emerald-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-emerald-700 transition shadow">✓ Approve & Send</button>
                                <button onclick="AdminPanel.rejectApp(${index})" class="bg-rose-500 text-white px-3 py-2 rounded text-xs font-bold hover:bg-rose-600 transition shadow">✕ Reject</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            if(pendingApps.length === 0) tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">No pending registration requests.</td></tr>`;
        },

        renderApproved: function() {
            const tbody = document.getElementById('table-approved-body');
            tbody.innerHTML = '';
            approvedApps.forEach((app) => {
                tbody.innerHTML += `
                    <tr class="text-sm hover:bg-slate-50 transition">
                        <td class="p-4">
                            <div class="flex items-center space-x-3">
                                <img src="${app.picFile || 'https://via.placeholder.com/150'}" class="w-10 h-10 rounded-full object-cover border" alt="Pic">
                                <div>
                                    <strong>${app.company}</strong><br>
                                    <span class="text-xs text-slate-500">${app.name} (${app.phone})</span>
                                </div>
                            </div>
                        </td>
                        <td class="p-4 font-mono font-bold text-indigo-600">${app.username}</td>
                        <td class="p-4 font-bold text-slate-700">${app.viewCount || 0} Times</td>
                        <td class="p-4 text-xs font-semibold text-emerald-600">${app.activeDuration || 'Active Now'}</td>
                        <td class="p-4 text-center"><span class="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">Approved ✓</span></td>
                    </tr>
                `;
            });
            if(approvedApps.length === 0) tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">No approved users yet.</td></tr>`;
        },

        renderRejected: function() {
            const tbody = document.getElementById('table-rejected-body');
            tbody.innerHTML = '';
            rejectedApps.forEach((app, index) => {
                tbody.innerHTML += `
                    <tr class="text-sm hover:bg-rose-50/40 transition">
                        <td class="p-4">
                            <strong>${app.company}</strong><br>
                            <span class="text-xs text-slate-500">Owner: ${app.name}</span>
                        </td>
                        <td class="p-4 text-xs">📞 ${app.phone}<br>✉️ ${app.email}</td>
                        <td class="p-4 text-xs text-rose-600 font-semibold">Rejected by Admin</td>
                        <td class="p-4 text-center">
                            <button onclick="AdminPanel.deleteRejected(${index})" class="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-700 transition">🗑️ Delete Permanently</button>
                        </td>
                    </tr>
                `;
            });
            if(rejectedApps.length === 0) tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400">No rejected applications.</td></tr>`;
        },

        approveApp: function(index) {
            const app = pendingApps[index];
            const pass = document.getElementById(`pass-inp-${index}`).value.trim();
            if(!pass) { alert('Please assign a password for the user!'); return; }

            app.password = pass;
            app.viewCount = 0;
            app.activeDuration = 'Just Started';
            app.status = 'Approved';

            // Add to software db
            dbUsers[app.username] = {
                username: app.username, email: app.email, password: pass,
                company: app.company, category: app.category, address: app.address,
                helpline: app.phone, dp: app.logoFile || app.picFile,
                inventory: [], statements: [], vouchers: [], documents: []
            };

            approvedApps.push(app);
            pendingApps.splice(index, 1);
            saveData();
            this.renderAll();
            alert(`[SUCCESS] User approved! Username (${app.username}) & Password sent via Email & SMS simulation.`);
        },

        rejectApp: function(index) {
            const app = pendingApps[index];
            app.status = 'Rejected';
            rejectedApps.push(app);
            pendingApps.splice(index, 1);
            saveData();
            this.renderAll();
            alert('Application rejected with smooth transition.');
        },

        deleteRejected: function(index) {
            if(confirm('Are you sure you want to permanently remove this user information from database?')) {
                rejectedApps.splice(index, 1);
                saveData();
                this.renderAll();
            }
        },

        openFullscreenProfile: function(appId) {
            const app = pendingApps.find(a => a.id === appId) || approvedApps.find(a => a.id === appId);
            if(!app) return;

            const modal = document.getElementById('fullscreen-profile-modal');
            const content = document.getElementById('profile-modal-content');

            content.innerHTML = `
                <div class="flex flex-col items-center text-center space-y-3">
                    <img src="${app.picFile || 'https://via.placeholder.com/150'}" class="w-32 h-32 rounded-full object-cover shadow-xl border-4 border-indigo-100" alt="Profile Picture">
                    <h2 class="text-2xl font-bold text-slate-900">${app.name}</h2>
                    <span class="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase">${app.company} (${app.category})</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-6 bg-slate-50 p-6 rounded-2xl border">
                    <div><strong>Username:</strong> ${app.username}</div>
                    <div><strong>Phone:</strong> ${app.phone}</div>
                    <div><strong>Email:</strong> ${app.email}</div>
                    <div><strong>DOB & Age:</strong> ${app.dob} (${app.age})</div>
                    <div><strong>Current Address:</strong> ${app.address}</div>
                    <div><strong>Home Address:</strong> ${app.homeAddress}</div>
                    <div class="sm:col-span-2"><strong>Permanent Address:</strong> ${app.permAddress}, District: ${app.district}</div>
                    <div><strong>Nationality:</strong> ${app.nationality}</div>
                </div>
                <div class="flex justify-center space-x-4 pt-4">
                    <button onclick="AdminPanel.viewFile('${app.nidFile}')" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold">📄 View NID / Passport</button>
                    <button onclick="AdminPanel.viewFile('${app.tradeFile}')" class="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold">📑 View Trade License</button>
                </div>
            `;

            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0', 'scale-95');
                modal.classList.add('opacity-100', 'scale-100');
            }, 10);
        },

        closeFullscreenProfile: function() {
            const modal = document.getElementById('fullscreen-profile-modal');
            modal.classList.remove('opacity-100', 'scale-100');
            modal.classList.add('opacity-0', 'scale-95');
            setTimeout(() => { modal.classList.add('hidden'); }, 300);
        },

        viewFile: function(fileData) {
            if(!fileData) { alert('File not available.'); return; }
            const w = window.open('');
            w.document.write(`<iframe src="${fileData}" style="width:100%; height:100%; border:none;"></iframe>`);
        }
    };
})();
