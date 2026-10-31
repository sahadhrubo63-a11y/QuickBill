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
            if(document.getElementById('admin-user').value === 'admin' && document.getElementById('admin-pass').value === 'admin123') {
                document.getElementById('admin-login-wrapper').classList.add('hidden');
                document.getElementById('admin-dashboard-wrapper').classList.remove('hidden');
                this.renderAll();
            } else { alert('Invalid credentials'); }
        },
        logout: function() {
            document.getElementById('admin-dashboard-wrapper').classList.add('hidden');
            document.getElementById('admin-login-wrapper').classList.remove('hidden');
        },
        switchTab: function(tab) {
            document.querySelectorAll('.admin-tab-content').forEach(e => e.classList.add('hidden'));
            document.querySelectorAll('[id^="admin-btn-"]').forEach(b => { b.className = "px-4 py-2 rounded-lg font-bold text-sm bg-white text-slate-600"; });
            document.getElementById(`admin-tab-${tab}`).classList.remove('hidden');
            document.getElementById(`admin-btn-${tab}`).className = "px-4 py-2 rounded-lg font-bold text-sm bg-indigo-600 text-white";
        },
        renderAll: function() {
            document.getElementById('count-pending').innerText = pendingApps.length;
            document.getElementById('count-approved').innerText = approvedApps.length;
            document.getElementById('count-rejected').innerText = rejectedApps.length;
            this.renderPending(); this.renderApproved(); this.renderRejected();
        },
        renderPending: function() {
            const tb = document.getElementById('table-pending-body'); tb.innerHTML = '';
            pendingApps.forEach((a, i) => {
                tb.innerHTML += `<tr class="text-sm">
                    <td class="p-4 flex items-center space-x-3 cursor-pointer" onclick="AdminPanel.openProfile('${a.id}')">
                        <img src="${a.picFile}" class="w-10 h-10 rounded-full object-cover border">
                        <div><strong>${a.company}</strong><br><span class="text-xs text-slate-500">${a.name}</span></div>
                    </td>
                    <td class="p-4 text-xs">${a.phone}<br>${a.email}</td>
                    <td class="p-4 text-xs">${a.dob}<br><strong>${a.age}</strong></td>
                    <td class="p-4 text-center flex items-center justify-center space-x-2">
                        <input type="text" id="pass-${i}" placeholder="Password" class="border p-1.5 rounded text-xs w-24">
                        <button onclick="AdminPanel.approve(${i})" class="bg-emerald-600 text-white px-2.5 py-1.5 rounded text-xs font-bold">Approve</button>
                        <button onclick="AdminPanel.reject(${i})" class="bg-red-500 text-white px-2.5 py-1.5 rounded text-xs font-bold">Reject</button>
                    </td>
                </tr>`;
            });
            if(pendingApps.length === 0) tb.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">No pending requests</td></tr>`;
        },
        renderApproved: function() {
            const tb = document.getElementById('table-approved-body'); tb.innerHTML = '';
            approvedApps.forEach(a => {
                tb.innerHTML += `<tr class="text-sm">
                    <td class="p-4 flex items-center space-x-3"><img src="${a.picFile}" class="w-10 h-10 rounded-full object-cover border"><div><strong>${a.company}</strong><br><span class="text-xs">${a.name}</span></div></td>
                    <td class="p-4 font-mono font-bold text-indigo-600">${a.username}</td>
                    <td class="p-4">${a.viewCount || 0} Times</td>
                    <td class="p-4">
                        <button onclick="AdminPanel.toggleStatus('${a.username}')" class="px-3 py-1 rounded text-xs font-bold ${a.status === 'Inactive' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}">
                            ${a.status === 'Inactive' ? 'Enlist (Activate)' : 'Delist (Deactivate)'}
                        </button>
                    </td>
                </tr>`;
            });
            if(approvedApps.length === 0) tb.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">No approved users</td></tr>`;
        },
        renderRejected: function() {
            const tb = document.getElementById('table-rejected-body'); tb.innerHTML = '';
            rejectedApps.forEach((a, i) => {
                tb.innerHTML += `<tr class="text-sm"><td class="p-4">${a.company} (${a.name})</td><td class="p-4">${a.phone}</td><td class="p-4 text-center"><button onclick="AdminPanel.delRejected(${i})" class="bg-red-600 text-white px-3 py-1 rounded text-xs">Delete Permanently</button></td></tr>`;
            });
            if(rejectedApps.length === 0) tb.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-400">No rejected apps</td></tr>`;
        },
        approve: function(i) {
            const a = pendingApps[i]; const pass = document.getElementById(`pass-${i}`).value.trim();
            if(!pass) { alert('Assign password'); return; }
            a.password = pass; a.status = 'Active'; a.viewCount = 0;
            dbUsers[a.username] = { username: a.username, email: a.email, password: pass, company: a.company, category: a.category, address: a.address, helpline: a.phone, dp: a.logoFile || a.picFile, inventory: [], statements: [], vouchers: [] };
            approvedApps.push(a); pendingApps.splice(i, 1); saveData(); this.renderAll(); alert('Approved & Credentials sent.');
        },
        reject: function(i) {
            const a = pendingApps[i]; a.status = 'Rejected'; rejectedApps.push(a); pendingApps.splice(i, 1); saveData(); this.renderAll();
        },
        delRejected: function(i) { rejectedApps.splice(i, 1); saveData(); this.renderAll(); },
        toggleStatus: function(username) {
            let app = approvedApps.find(a => a.username === username);
            if(app) {
                app.status = app.status === 'Inactive' ? 'Active' : 'Inactive';
                saveData(); this.renderApproved();
            }
        },
        openProfile: function(id) {
            const a = pendingApps.find(x => x.id === id); if(!a) return;
            document.getElementById('profile-modal-content').innerHTML = `
                <div class="text-center space-y-3"><img src="${a.picFile}" class="w-24 h-24 rounded-full mx-auto object-cover border"><h2 class="text-xl font-bold">${a.name}</h2></div>
                <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-4 rounded-xl">
                    <div><strong>Username:</strong> ${a.username}</div><div><strong>Phone:</strong> ${a.phone}</div>
                    <div><strong>Email:</strong> ${a.email}</div><div><strong>DOB:</strong> ${a.dob} (${a.age})</div>
                    <div class="col-span-2"><strong>Address:</strong> ${a.address}</div>
                </div>
            `;
            const m = document.getElementById('fullscreen-profile-modal');
            m.classList.remove('hidden'); setTimeout(() => m.classList.remove('opacity-0', 'scale-95'), 10);
        },
        closeFullscreenProfile: function() {
            const m = document.getElementById('fullscreen-profile-modal');
            m.classList.add('opacity-0', 'scale-95'); setTimeout(() => m.classList.add('hidden'), 300);
        }
    };
})();
