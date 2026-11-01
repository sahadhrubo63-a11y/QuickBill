/**
 * Dedicated Portal Registration & Admin Verification Controller
 */
const AdminPortal = (function() {
    let currentModalUsername = null;

    function getRegisteredUsers() {
        return JSON.parse(localStorage.getItem('admin_registered_users')) || {};
    }

    function saveRegisteredUsers(users) {
        localStorage.setItem('admin_registered_users', JSON.stringify(users));
    }

    function readFileAsBase64(fileInputId) {
        return new Promise((resolve) => {
            const file = document.getElementById(fileInputId).files[0];
            if (!file) { resolve(""); return; }
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    return {
        init: function() {
            this.renderAdminTables();
        },

        switchTab: function(tabId) {
            document.getElementById('portal-reg').classList.add('hidden');
            document.getElementById('admin-dashboard').classList.add('hidden');
            document.getElementById(tabId).classList.remove('hidden');

            document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.replace('bg-indigo-600', 'bg-slate-800'));
            document.getElementById(`tab-btn-${tabId}`).classList.replace('bg-slate-800', 'bg-indigo-600');
        },

        switchAdminSubTab: function(subTabId) {
            document.querySelectorAll('.admin-subtab-content').forEach(t => t.classList.add('hidden'));
            document.querySelectorAll('.admin-subtab-btn').forEach(b => {
                b.classList.remove('border-b-2', 'border-indigo-600', 'text-indigo-600');
                b.classList.add('text-slate-500');
            });

            document.getElementById(subTabId).classList.remove('hidden');
            document.getElementById(`btn-${subTabId}`).classList.add('border-b-2', 'border-indigo-600', 'text-indigo-600');
        },

        calculateAge: function() {
            const dob = document.getElementById('p-dob').value;
            if (!dob) return;
            const birthDate = new Date(dob);
            const diff = Date.now() - birthDate.getTime();
            const ageDate = new Date(diff);
            const age = Math.abs(ageDate.getUTCFullYear() - 1970);
            document.getElementById('p-age').value = `${age} Years`;
        },

        submitUserRegistration: async function() {
            const name = document.getElementById('p-name').value.trim();
            const username = document.getElementById('p-username').value.trim();
            const companyName = document.getElementById('p-company').value.trim();
            const category = document.getElementById('p-category').value.trim();
            const homeAddress = document.getElementById('p-address').value.trim();
            const permAddress = document.getElementById('p-perm-address').value.trim();
            const district = document.getElementById('p-district').value.trim();
            const nationality = document.getElementById('p-nationality').value.trim();
            const dob = document.getElementById('p-dob').value;
            const age = document.getElementById('p-age').value;
            const phone = document.getElementById('p-phone').value.trim();
            const email = document.getElementById('p-email').value.trim();

            let users = getRegisteredUsers();
            if (users[username]) {
                alert('Username is already registered!');
                return;
            }

            // Convert Files to Base64
            const nidPic = await readFileAsBase64('p-file-nid');
            const userPic = await readFileAsBase64('p-file-pic');
            const tradePic = await readFileAsBase64('p-file-trade');
            const logoPic = await readFileAsBase64('p-file-logo');

            users[username] = {
                name, username, companyName, category, homeAddress, permAddress,
                district, nationality, dob, age, phone, email,
                nidPic, userPic, tradePic, logoPic,
                status: 'pending', password: '',
                activeSeconds: 0, viewCount: 0, isOnline: false, lastSeen: ''
            };

            saveRegisteredUsers(users);

            // Show Receipt Animation
            document.getElementById('reg-form-card').classList.add('hidden');
            document.getElementById('memo-tracking-id').innerText = 'REG-' + Math.floor(1000 + Math.random() * 9000);
            document.getElementById('memo-time').innerText = new Date().toLocaleString();
            document.getElementById('reg-success-card').classList.remove('hidden');

            this.renderAdminTables();
        },

        renderAdminTables: function() {
            const users = getRegisteredUsers();
            const tableCame = document.getElementById('table-came-body');
            const tableApproved = document.getElementById('table-approved-body');
            const tableRejected = document.getElementById('table-rejected-body');
            const tableDelisted = document.getElementById('table-delisted-body');

            tableCame.innerHTML = ''; tableApproved.innerHTML = '';
            tableRejected.innerHTML = ''; tableDelisted.innerHTML = '';

            let countCame = 0, countApproved = 0, countRejected = 0, countDelisted = 0;

            Object.values(users).forEach(u => {
                if (u.status === 'pending') {
                    countCame++;
                    tableCame.innerHTML += `
                        <tr class="hover:bg-slate-50">
                            <td class="p-4 font-bold">${u.name}</td>
                            <td class="p-4">${u.companyName}</td>
                            <td class="p-4">${u.phone}<br><span class="text-xs text-slate-400">${u.email}</span></td>
                            <td class="p-4">${u.age} / ${u.district}</td>
                            <td class="p-4 text-center">
                                <button onclick="AdminPortal.openProfileModal('${u.username}')" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700">Audit & Verify</button>
                            </td>
                        </tr>`;
                } else if (u.status === 'approved') {
                    countApproved++;
                    const minutes = Math.floor((u.activeSeconds || 0) / 60);
                    tableApproved.innerHTML += `
                        <tr class="hover:bg-slate-50">
                            <td class="p-4 font-bold flex items-center space-x-2">
                                <img src="${u.userPic}" class="w-8 h-8 rounded-full object-cover">
                                <span>${u.name}</span>
                            </td>
                            <td class="p-4 font-mono font-bold text-indigo-600">${u.username}</td>
                            <td class="p-4">
                                ${u.isOnline ? '<span class="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-bold">● Active Online</span>' : '<span class="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">Offline</span>'}
                            </td>
                            <td class="p-4 font-medium">${minutes} mins (${u.activeSeconds || 0}s)</td>
                            <td class="p-4 font-bold text-center">${u.viewCount || 0} times</td>
                            <td class="p-4 text-center space-x-2">
                                <button onclick="AdminPortal.delistUser('${u.username}')" class="bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1 rounded text-xs font-bold hover:bg-rose-100">Delist Account</button>
                            </td>
                        </tr>`;
                } else if (u.status === 'rejected') {
                    countRejected++;
                    tableRejected.innerHTML += `
                        <tr class="hover:bg-slate-50">
                            <td class="p-4 font-bold">${u.name}</td>
                            <td class="p-4">${u.companyName}</td>
                            <td class="p-4">${u.phone}</td>
                            <td class="p-4 text-center">
                                <button onclick="AdminPortal.deleteUserDirect('${u.username}')" class="text-rose-600 text-xs font-bold hover:underline">Delete Record</button>
                            </td>
                        </tr>`;
                } else if (u.status === 'delisted') {
                    countDelisted++;
                    tableDelisted.innerHTML += `
                        <tr class="hover:bg-slate-50">
                            <td class="p-4 font-bold">${u.companyName}</td>
                            <td class="p-4 font-mono">${u.username}</td>
                            <td class="p-4"><span class="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded font-bold">Delisted (Inactive)</span></td>
                            <td class="p-4 text-center">
                                <button onclick="AdminPortal.enlistUser('${u.username}')" class="bg-emerald-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-emerald-700">Enlist (Re-approve)</button>
                            </td>
                        </tr>`;
                }
            });

            document.getElementById('count-came').innerText = countCame;
            document.getElementById('count-approved').innerText = countApproved;
            document.getElementById('count-rejected').innerText = countRejected;
            document.getElementById('count-delisted').innerText = countDelisted;
        },

        openProfileModal: function(username) {
            const users = getRegisteredUsers();
            const u = users[username];
            if (!u) return;

            currentModalUsername = username;
            document.getElementById('m-name').innerText = u.name;
            document.getElementById('m-company').innerText = u.companyName;
            document.getElementById('m-category').innerText = u.category;
            document.getElementById('m-username').innerText = u.username;
            document.getElementById('m-phone').innerText = u.phone;
            document.getElementById('m-email').innerText = u.email;
            document.getElementById('m-dob-age').innerText = `${u.dob} (${u.age})`;
            document.getElementById('m-nat-dist').innerText = `${u.nationality}, ${u.district}`;
            document.getElementById('m-address').innerText = u.homeAddress;
            document.getElementById('m-perm-address').innerText = u.permAddress;

            document.getElementById('m-user-pic').src = u.userPic || 'https://via.placeholder.com/150';
            document.getElementById('m-img-nid').src = u.nidPic || '';
            document.getElementById('m-img-trade').src = u.tradePic || '';
            document.getElementById('m-img-logo').src = u.logoPic || '';

            document.getElementById('assign-username').value = u.username;
            document.getElementById('assign-password').value = 'Pass' + Math.floor(1000 + Math.random() * 9000);

            document.getElementById('profile-modal').classList.remove('hidden');
        },

        closeProfileModal: function() {
            document.getElementById('profile-modal').classList.add('hidden');
        },

        approveUserRecord: function() {
            const assignedUsername = document.getElementById('assign-username').value.trim();
            const assignedPassword = document.getElementById('assign-password').value.trim();

            if (!assignedUsername || !assignedPassword) {
                alert('Please assign Username and Password!');
                return;
            }

            let users = getRegisteredUsers();
            if (users[currentModalUsername]) {
                users[currentModalUsername].username = assignedUsername;
                users[currentModalUsername].password = assignedPassword;
                users[currentModalUsername].status = 'approved';
                saveRegisteredUsers(users);
                
                alert(`[SMS & Email Notification Sent]\nUsername: ${assignedUsername}\nPassword: ${assignedPassword}`);
                this.closeProfileModal();
                this.renderAdminTables();
            }
        },

        rejectUserRecord: function() {
            const card = document.getElementById('profile-modal-card');
            card.classList.add('cut-out-anim');
            setTimeout(() => {
                let users = getRegisteredUsers();
                if (users[currentModalUsername]) {
                    users[currentModalUsername].status = 'rejected';
                    saveRegisteredUsers(users);
                }
                card.classList.remove('cut-out-anim');
                this.closeProfileModal();
                this.renderAdminTables();
            }, 550);
        },

        deleteUserRecord: function() {
            if (confirm('Are you sure you want to permanently delete this user record?')) {
                let users = getRegisteredUsers();
                delete users[currentModalUsername];
                saveRegisteredUsers(users);
                this.closeProfileModal();
                this.renderAdminTables();
            }
        },

        deleteUserDirect: function(username) {
            if (confirm('Permanently remove this rejected application?')) {
                let users = getRegisteredUsers();
                delete users[username];
                saveRegisteredUsers(users);
                this.renderAdminTables();
            }
        },

        delistUser: function(username) {
            let users = getRegisteredUsers();
            if (users[username]) {
                users[username].status = 'delisted';
                saveRegisteredUsers(users);
                this.renderAdminTables();
            }
        },

        enlistUser: function(username) {
            let users = getRegisteredUsers();
            if (users[username]) {
                users[username].status = 'approved';
                saveRegisteredUsers(users);
                this.renderAdminTables();
            }
        }
    };
})();

window.addEventListener('DOMContentLoaded', () => {
    AdminPortal.init();
});
