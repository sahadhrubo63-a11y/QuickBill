/**
 * Dedicated Portal & Admin Management Engine
 */
const AdminPortal = (function() {
    let pendingRequests = JSON.parse(localStorage.getItem('pos_pending_requests')) || [];
    let approvedUsers = JSON.parse(localStorage.getItem('pos_approved_users')) || [];
    let rejectedUsers = JSON.parse(localStorage.getItem('pos_rejected_users')) || [];
    let delistedUsers = JSON.parse(localStorage.getItem('pos_delisted_users')) || [];
    let dbUsers = JSON.parse(localStorage.getItem('pos_users')) || {};

    let selectedAppId = null;
    let tempFiles = { dp: '', nid: '', trade: '', logo: '' };

    function saveState() {
        localStorage.setItem('pos_pending_requests', JSON.stringify(pendingRequests));
        localStorage.setItem('pos_approved_users', JSON.stringify(approvedUsers));
        localStorage.setItem('pos_rejected_users', JSON.stringify(rejectedUsers));
        localStorage.setItem('pos_delisted_users', JSON.stringify(delistedUsers));
        localStorage.setItem('pos_users', JSON.stringify(dbUsers));
    }

    return {
        init: function() {
            this.setupFileReaders();
            this.renderAdminTables();
        },

        switchView: function(viewName) {
            document.getElementById('view-user-portal').classList.add('hidden');
            document.getElementById('view-admin-auth').classList.add('hidden');
            document.getElementById('view-admin-dashboard').classList.add('hidden');

            document.getElementById('nav-btn-portal').className = "bg-slate-800 text-slate-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition";
            document.getElementById('nav-btn-admin').className = "bg-slate-800 text-slate-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition";

            if (viewName === 'user-portal') {
                document.getElementById('view-user-portal').classList.remove('hidden');
                document.getElementById('nav-btn-portal').className = "bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition";
            } else if (viewName === 'admin-login') {
                const isAdminLoggedIn = sessionStorage.getItem('pos_admin_logged');
                if (isAdminLoggedIn) {
                    document.getElementById('view-admin-dashboard').classList.remove('hidden');
                } else {
                    document.getElementById('view-admin-auth').classList.remove('hidden');
                }
                document.getElementById('nav-btn-admin').className = "bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition";
            }
        },

        calculateAge: function() {
            const dob = document.getElementById('p-dob').value;
            if (!dob) return;
            const diff = Date.now() - new Date(dob).getTime();
            const ageDate = new Date(diff);
            const age = Math.abs(ageDate.getUTCFullYear() - 1970);
            document.getElementById('p-age-display').value = `${age} Years`;
        },

        setupFileReaders: function() {
            const handleFile = (inputId, key) => {
                const el = document.getElementById(inputId);
                if (el) {
                    el.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => { tempFiles[key] = evt.target.result; };
                            reader.readAsDataURL(file);
                        }
                    });
                }
            };
            handleFile('p-file-pic', 'dp');
            handleFile('p-file-nid', 'nid');
            handleFile('p-file-trade', 'trade');
            handleFile('p-file-logo', 'logo');
        },

        submitUserRegistration: function() {
            const name = document.getElementById('p-name').value.trim();
            const username = document.getElementById('p-username').value.trim();
            const company = document.getElementById('p-company').value.trim();
            const category = document.getElementById('p-category').value.trim();
            const phone = document.getElementById('p-phone').value.trim();
            const email = document.getElementById('p-email').value.trim().toLowerCase();
            const dob = document.getElementById('p-dob').value;
            const age = document.getElementById('p-age-display').value;
            const nationality = document.getElementById('p-nationality').value.trim();
            const district = document.getElementById('p-district').value.trim();
            const address = document.getElementById('p-address').value.trim();
            const homeAddress = document.getElementById('p-home-address').value.trim();
            const permAddress = document.getElementById('p-permanent-address').value.trim();

            if (!tempFiles.dp || !tempFiles.nid || !tempFiles.trade || !tempFiles.logo) {
                alert('All mandatory documents and pictures must be uploaded!');
                return;
            }

            const newApp = {
                id: 'APP-' + Math.floor(100000 + Math.random() * 900000),
                name, username, company, category, phone, email, dob, age,
                nationality, district, address, homeAddress, permAddress,
                files: { ...tempFiles },
                timestamp: new Date().toLocaleString()
            };

            pendingRequests.push(newApp);
            saveState();

            document.getElementById('reg-form-wrapper').classList.add('hidden');
            document.getElementById('reg-success-box').classList.remove('hidden');
        },

        handleAdminLogin: function() {
            const u = document.getElementById('admin-user').value.trim();
            const p = document.getElementById('admin-pass').value;

            if (u === 'admin' && p === 'admin123') {
                sessionStorage.setItem('pos_admin_logged', 'true');
                document.getElementById('view-admin-auth').classList.add('hidden');
                document.getElementById('view-admin-dashboard').classList.remove('hidden');
                this.renderAdminTables();
            } else {
                alert('Invalid Admin Credentials! (Use admin / admin123)');
            }
        },

        handleAdminLogout: function() {
            sessionStorage.removeItem('pos_admin_logged');
            this.switchView('user-portal');
        },

        switchAdminTab: function(tabId) {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
            document.querySelectorAll('[id^="adm-btn-"]').forEach(b => {
                b.className = "px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition";
            });
            document.getElementById(tabId).classList.remove('hidden');
            document.getElementById(`adm-btn-${tabId.replace('tab-', '')}`).className = "px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white transition";
        },

        renderAdminTables: function() {
            document.getElementById('count-incoming').innerText = pendingRequests.length;
            document.getElementById('count-approved').innerText = approvedUsers.length;
            document.getElementById('count-rejected').innerText = rejectedUsers.length;
            document.getElementById('count-delisted').innerText = delistedUsers.length;

            // Incoming Table
            const tbInc = document.getElementById('table-incoming-body');
            tbInc.innerHTML = '';
            pendingRequests.forEach((app, index) => {
                tbInc.innerHTML += `
                    <tr class="text-sm">
                        <td class="p-3 font-semibold">${app.name}</td>
                        <td class="p-3">${app.company}</td>
                        <td class="p-3 text-xs">${app.phone}<br>${app.email}</td>
                        <td class="p-3 text-xs">${app.category} <br>(${app.district})</td>
                        <td class="p-3 text-center">
                            <button onclick="AdminPortal.openProfileModal(${index})" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700">Review Profile 👤</button>
                        </td>
                    </tr>`;
            });
            if (pendingRequests.length === 0) tbInc.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400">No incoming registration requests.</td></tr>`;

            // Approved Table
            const tbApp = document.getElementById('table-approved-body');
            tbApp.innerHTML = '';
            approvedUsers.forEach((usr, index) => {
                tbApp.innerHTML += `
                    <tr class="text-sm">
                        <td class="p-3 font-semibold">${usr.name}<br><span class="text-xs text-slate-500">${usr.company}</span></td>
                        <td class="p-3 font-mono text-indigo-600 font-bold">${usr.username}</td>
                        <td class="p-3"><span class="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-bold">Active ✓</span></td>
                        <td class="p-3 text-xs">2 Hours 14 Min</td>
                        <td class="p-3 text-xs font-bold">48 Views</td>
                        <td class="p-3 text-center space-x-2">
                            <button onclick="AdminPortal.toggleUserStatus(${index})" class="text-amber-600 font-semibold text-xs hover:underline">Set Inactive / Delist</button>
                            <button onclick="AdminPortal.deleteTotalRecord(${index}, 'approved')" class="text-red-500 font-semibold text-xs hover:underline">Delete 🗑️</button>
                        </td>
                    </tr>`;
            });
            if (approvedUsers.length === 0) tbApp.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">No approved users.</td></tr>`;

            // Rejected Table
            const tbRej = document.getElementById('table-rejected-body');
            tbRej.innerHTML = '';
            rejectedUsers.forEach((rej, index) => {
                tbRej.innerHTML += `
                    <tr class="text-sm transition-all duration-300 animate-pulse bg-rose-50/50">
                        <td class="p-3 font-semibold">${rej.name}</td>
                        <td class="p-3">${rej.company}</td>
                        <td class="p-3 text-xs">${rej.email}<br>${rej.phone}</td>
                        <td class="p-3 text-center">
                            <button onclick="AdminPortal.deleteTotalRecord(${index}, 'rejected')" class="text-red-500 font-semibold text-xs hover:underline">Remove Permanently 🗑️</button>
                        </td>
                    </tr>`;
            });
            if (rejectedUsers.length === 0) tbRej.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">No rejected applications.</td></tr>`;

            // Delisted Table
            const tbDel = document.getElementById('table-delisted-body');
            tbDel.innerHTML = '';
            delistedUsers.forEach((del, index) => {
                tbDel.innerHTML += `
                    <tr class="text-sm">
                        <td class="p-3 font-semibold">${del.name}<br><span class="text-xs text-slate-500">${del.company}</span></td>
                        <td class="p-3 font-mono text-slate-600">${del.username}</td>
                        <td class="p-3 text-center">
                            <button onclick="AdminPortal.enlistUser(${index})" class="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700">Enlist & Approve Again ✓</button>
                        </td>
                    </tr>`;
            });
            if (delistedUsers.length === 0) tbDel.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-400">No delisted users.</td></tr>`;
        },

        openProfileModal: function(index) {
            selectedAppId = index;
            const app = pendingRequests[index];

            document.getElementById('modal-user-dp').src = app.files.dp;
            document.getElementById('modal-user-name').innerText = app.name;
            document.getElementById('modal-user-company').innerText = app.company;

            document.getElementById('m-username').innerText = app.username;
            document.getElementById('m-phone').innerText = app.phone;
            document.getElementById('m-email').innerText = app.email;
            document.getElementById('m-dob').innerText = app.dob;
            document.getElementById('m-age').innerText = app.age;
            document.getElementById('m-nationality').innerText = app.nationality;
            document.getElementById('m-district').innerText = app.district;
            document.getElementById('m-category').innerText = app.category;
            document.getElementById('m-address').innerText = app.address;
            document.getElementById('m-perm').innerText = app.permAddress;

            document.getElementById('assign-username').value = app.username;
            document.getElementById('assign-password').value = 'Pass@' + Math.floor(1000 + Math.random() * 9000);

            document.getElementById('m-doc-nid-preview').innerHTML = `<img src="${app.files.nid}" class="h-full object-contain">`;
            document.getElementById('m-doc-trade-preview').innerHTML = `<img src="${app.files.trade}" class="h-full object-contain">`;
            document.getElementById('m-doc-logo-preview').innerHTML = `<img src="${app.files.logo}" class="h-full object-contain">`;

            document.getElementById('profile-fullscreen-modal').classList.remove('hidden');
        },

        closeProfileModal: function() {
            document.getElementById('profile-fullscreen-modal').classList.add('hidden');
            selectedAppId = null;
        },

        approveCurrentApplication: function() {
            if (selectedAppId === null) return;
            const app = pendingRequests[selectedAppId];
            const assignedUser = document.getElementById('assign-username').value.trim();
            const assignedPass = document.getElementById('assign-password').value.trim();

            if (!assignedUser || !assignedPass) {
                alert('Please assign a valid username and password!');
                return;
            }

            // Create account in POS database for software login linkage
            dbUsers[assignedUser] = {
                username: assignedUser,
                password: assignedPass,
                email: app.email,
                company: app.company,
                category: app.category,
                address: app.address,
                helpline: app.phone,
                dp: app.files.logo,
                inventory: [],
                statements: [],
                vouchers: [],
                documents: [
                    { title: 'NID / Passport', fileData: app.files.nid, fileType: 'image/jpeg' },
                    { title: 'Trade License', fileData: app.files.trade, fileType: 'image/jpeg' }
                ]
            };

            approvedUsers.push({ ...app, username: assignedUser, password: assignedPass });
            pendingRequests.splice(selectedAppId, 1);
            saveState();

            alert(`[VERIFICATION SUCCESSFUL]\n\nUsername (${assignedUser}) and Password have been approved and simulated SMS/Email sent to:\nPhone: ${app.phone}\nEmail: ${app.email}`);
            this.closeProfileModal();
            this.renderAdminTables();
        },

        rejectCurrentApplication: function() {
            if (selectedAppId === null) return;
            const app = pendingRequests[selectedAppId];
            
            // Animation style cut simulation via confirmation
            if (confirm('Are you sure you want to reject this registration? The record will be sliced with animation style.')) {
                rejectedUsers.push(app);
                pendingRequests.splice(selectedAppId, 1);
                saveState();
                this.closeProfileModal();
                this.renderAdminTables();
            }
        },

        toggleUserStatus: function(index) {
            const usr = approvedUsers[index];
            if (confirm(`Do you want to delist ${usr.company}? They will no longer be able to log in to the software.`)) {
                approvedUsers.splice(index, 1);
                delistedUsers.push(usr);
                // Also remove active credentials from POS db or mark inactive
                if (dbUsers[usr.username]) {
                    delete dbUsers[usr.username];
                }
                saveState();
                this.renderAdminTables();
            }
        },

        enlistUser: function(index) {
            const del = delistedUsers[index];
            delistedUsers.splice(index, 1);
            approvedUsers.push(del);

            // Restore in POS db
            dbUsers[del.username] = {
                username: del.username,
                password: del.password,
                email: del.email,
                company: del.company,
                category: del.category,
                address: del.address,
                helpline: del.phone,
                dp: del.files.logo,
                inventory: [], statements: [], vouchers: [], documents: []
            };

            saveState();
            this.renderAdminTables();
            alert(`User ${del.username} has been re-enlisted and approved successfully!`);
        },

        deleteTotalRecord: function(index, type) {
            if (confirm('Are you sure you want to permanently remove this total information from database?')) {
                if (type === 'approved') approvedUsers.splice(index, 1);
                if (type === 'rejected') rejectedUsers.splice(index, 1);
                saveState();
                this.renderAdminTables();
            }
        }
    };
})();

window.addEventListener('DOMContentLoaded', () => {
    AdminPortal.init();
});
