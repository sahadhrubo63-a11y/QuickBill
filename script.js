/**
 * Merged Consolidated Backend: POS System (script.js) & Admin Portal (admin.js)
 * Linked via shared localStorage ('admin_registered_users')
 */

const MergedApp = (function() {
    let activeUser = null;
    let cart = [];
    let tempProfileDpBase64 = "";

    function getDBUsers() {
        return JSON.parse(localStorage.getItem('admin_registered_users')) || {};
    }

    function saveDBUsers(users) {
        localStorage.setItem('admin_registered_users', JSON.stringify(users));
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function startUserSessionTracker() {
        if (!activeUser) return;
        let users = getDBUsers();
        if (users[activeUser]) {
            users[activeUser].viewCount = (users[activeUser].viewCount || 0) + 1;
            users[activeUser].isOnline = true;
            users[activeUser].lastSeen = new Date().toISOString();
            saveDBUsers(users);
        }

        setInterval(() => {
            if (!activeUser) return;
            let currentUsers = getDBUsers();
            if (currentUsers[activeUser]) {
                currentUsers[activeUser].activeSeconds = (currentUsers[activeUser].activeSeconds || 0) + 10;
                currentUsers[activeUser].isOnline = true;
                currentUsers[activeUser].lastSeen = new Date().toISOString();
                saveDBUsers(currentUsers);
            }
        }, 10000);

        window.addEventListener('beforeunload', () => {
            if (!activeUser) return;
            let currentUsers = getDBUsers();
            if (currentUsers[activeUser]) {
                currentUsers[activeUser].isOnline = false;
                saveDBUsers(currentUsers);
            }
        });
    }

    return {
        init: function() {
            this.checkAutoLogin();
            if (window.AdminPortal && typeof AdminPortal.init === 'function') {
                AdminPortal.init();
            }
        },

        switchMainView: function(viewId) {
            document.getElementById('view-pos-system').classList.add('hidden');
            document.getElementById('view-admin-portal').classList.add('hidden');
            document.getElementById(viewId).classList.remove('hidden');

            document.getElementById('btn-view-pos').className = viewId === 'view-pos-system' ? 'px-3 py-1.5 rounded text-xs font-bold bg-indigo-600 text-white transition' : 'px-3 py-1.5 rounded text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition';
            document.getElementById('btn-view-admin').className = viewId === 'view-admin-portal' ? 'px-3 py-1.5 rounded text-xs font-bold bg-indigo-600 text-white transition' : 'px-3 py-1.5 rounded text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition';
        },

        togglePasswordVisibility: function(inputId) {
            const input = document.getElementById(inputId);
            input.type = input.type === "password" ? "text" : "password";
        },

        handleLogin: function() {
            const usernameInput = document.getElementById('login-username').value.trim();
            const passwordInput = document.getElementById('login-password').value;

            const dbUsers = getDBUsers();
            const user = dbUsers[usernameInput];

            if (!user) {
                alert('Account not found or pending admin approval!');
                return;
            }

            if (user.status !== 'approved') {
                if (user.status === 'delisted') {
                    alert('Your account is currently delisted. Please contact Admin.');
                } else if (user.status === 'rejected') {
                    alert('Your registration request was rejected by admin.');
                } else {
                    alert('Your registration request is still pending verification.');
                }
                return;
            }

            if (user.password === passwordInput) {
                activeUser = usernameInput;
                localStorage.setItem('pos_active_user', activeUser);
                startUserSessionTracker();
                this.loadApplication();
            } else {
                alert('Invalid Password!');
            }
        },

        checkAutoLogin: function() {
            const savedUser = localStorage.getItem('pos_active_user');
            const dbUsers = getDBUsers();
            if (savedUser && dbUsers[savedUser] && dbUsers[savedUser].status === 'approved') {
                activeUser = savedUser;
                startUserSessionTracker();
                this.loadApplication();
            }
        },

        handleLogout: function() {
            if (activeUser) {
                let currentUsers = getDBUsers();
                if (currentUsers[activeUser]) {
                    currentUsers[activeUser].isOnline = false;
                    saveDBUsers(currentUsers);
                }
            }
            activeUser = null;
            localStorage.removeItem('pos_active_user');
            document.getElementById('app-container').classList.add('hidden');
            document.getElementById('auth-container').classList.remove('hidden');
        },

        loadApplication: function() {
            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            const dbUsers = getDBUsers();
            const userData = dbUsers[activeUser];

            if (!userData.inventory) userData.inventory = [];
            if (!userData.statements) userData.statements = [];

            document.getElementById('app-company-name').innerText = userData.companyName || userData.name;
            document.getElementById('app-username').innerText = `User: ${userData.username}`;

            if(userData.userPic) {
                document.getElementById('sidebar-dp').src = userData.userPic;
                document.getElementById('sidebar-dp').classList.remove('hidden');
                document.getElementById('sidebar-initial-logo').classList.add('hidden');
                document.getElementById('profile-preview-img').src = userData.userPic;
            } else {
                document.getElementById('sidebar-dp').classList.add('hidden');
                document.getElementById('sidebar-initial-logo').classList.remove('hidden');
                document.getElementById('sidebar-initial-logo').innerText = (userData.companyName || userData.name).substring(0, 1).toUpperCase();
            }

            document.getElementById('prof-address').value = userData.homeAddress || "";
            document.getElementById('prof-helpline').value = userData.phone || "";

            this.switchTab('tab-pos');
            this.renderInventory();
            this.renderStatements();
        },

        switchTab: function(tabId) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
            document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('bg-indigo-600', 'text-white'));
            document.getElementById(tabId).classList.remove('hidden');
            document.getElementById(`btn-${tabId}`).classList.add('bg-indigo-600', 'text-white');
        },

        previewProfileDp: function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    tempProfileDpBase64 = e.target.result;
                    document.getElementById('profile-preview-img').src = tempProfileDpBase64;
                };
                reader.readAsDataURL(file);
            }
        },

        saveProfileConfiguration: function() {
            let dbUsers = getDBUsers();
            dbUsers[activeUser].homeAddress = document.getElementById('prof-address').value.trim();
            dbUsers[activeUser].phone = document.getElementById('prof-helpline').value.trim();
            if (tempProfileDpBase64) {
                dbUsers[activeUser].userPic = tempProfileDpBase64;
            }
            saveDBUsers(dbUsers);
            alert('Settings updated!');
            this.loadApplication();
        },

        updatePOSUnitDisplay: function() {
            const select = document.getElementById('bill-product-select');
            const badge = document.getElementById('pos-unit-badge');
            if (select.value === "") { badge.innerText = "Unit"; return; }
            const dbUsers = getDBUsers();
            badge.innerText = dbUsers[activeUser].inventory[select.value].unit;
            this.calculateLivePOSBreakdown();
        },

        calculateLivePOSBreakdown: function() {
            const select = document.getElementById('bill-product-select');
            const qty = parseFloat(document.getElementById('bill-qty-input').value) || 0;
            const panel = document.getElementById('live-calculation-panel');
            if (select.value === "" || qty <= 0) { panel.classList.add('hidden'); return; }
            const dbUsers = getDBUsers();
            const item = dbUsers[activeUser].inventory[select.value];
            panel.classList.remove('hidden');
            document.getElementById('live-unit-price').innerText = `${item.sell.toFixed(2)} TK`;
            document.getElementById('live-subtotal').innerText = `${(item.sell * qty).toFixed(2)} TK`;
            document.getElementById('live-vat-dis').innerText = `Dis: -${(item.discount * qty).toFixed(2)} TK | VAT: +${item.vat}%`;
            document.getElementById('live-gift').innerText = item.gift || 'None';
        },

        togglePaidInputDisplay: function() {
            const status = document.getElementById('bill-receive-status').value;
            const container = document.getElementById('paid-amount-input-container');
            const input = document.getElementById('bill-paid-input');
            if (status === 'Unpaid') {
                container.classList.add('hidden');
                input.value = '0';
            } else {
                container.classList.remove('hidden');
                const totalBill = cart.reduce((sum, item) => sum + item.total, 0);
                input.value = totalBill.toFixed(2);
            }
        },

        addToCart: function() {
            const select = document.getElementById('bill-product-select');
            const qty = parseFloat(document.getElementById('bill-qty-input').value);
            if (select.value === "" || isNaN(qty) || qty <= 0) { alert('Enter valid entries!'); return; }
            
            const dbUsers = getDBUsers();
            const item = dbUsers[activeUser].inventory[select.value];

            if (qty > item.qty) { alert('Stock insufficient!'); return; }
            let finalUnitPrice = (item.sell - item.discount) * (1 + (item.vat / 100));

            cart.push({
                inventoryIndex: select.value, name: item.name, qty: qty, unit: item.unit,
                price: finalUnitPrice, rawSell: item.sell, rawDiscount: item.discount, rawVat: item.vat,
                gift: item.gift, total: qty * finalUnitPrice
            });

            this.renderCart();
            document.getElementById('bill-qty-input').value = '';
            select.value = '';
        },

        renderCart: function() {
            const tbody = document.getElementById('cart-table-body');
            tbody.innerHTML = '';
            let grandTotal = 0, totalDiscount = 0, totalVat = 0, totalQty = 0;

            cart.forEach((item, index) => {
                grandTotal += item.total;
                totalDiscount += item.rawDiscount * item.qty;
                totalVat += (item.rawSell - item.rawDiscount) * (item.rawVat / 100) * item.qty;
                totalQty += item.qty;

                tbody.innerHTML += `
                    <tr class="text-sm">
                        <td class="p-4"><strong>${escapeHTML(item.name)}</strong></td>
                        <td class="p-4">${item.qty} ${escapeHTML(item.unit)}</td>
                        <td class="p-4">${item.rawSell.toFixed(2)} TK</td>
                        <td class="p-4">-${item.rawDiscount.toFixed(2)}TK / +${item.rawVat}%</td>
                        <td class="p-4 font-bold text-indigo-600">${item.total.toFixed(2)} TK</td>
                        <td class="p-4 text-center"><button onclick="MergedApp.removeFromCart(${index})" class="text-red-500 font-semibold">Remove</button></td>
                    </tr>`;
            });

            document.getElementById('cart-item-count').innerText = `${cart.length} Items`;
            document.getElementById('summary-items-qty').innerText = totalQty;
            document.getElementById('summary-discount').innerText = `${totalDiscount.toFixed(2)} TK`;
            document.getElementById('summary-vat').innerText = `${totalVat.toFixed(2)} TK`;
            document.getElementById('summary-total').innerText = `${grandTotal.toFixed(2)} TK`;
        },

        removeFromCart: function(index) {
            cart.splice(index, 1);
            this.renderCart();
        },

        renderInventory: function() {
            const dbUsers = getDBUsers();
            const items = dbUsers[activeUser].inventory || [];
            const tbody = document.getElementById('inventory-table-body');
            tbody.innerHTML = '';
            
            const select = document.getElementById('bill-product-select');
            select.innerHTML = '<option value="">Select Product Manually</option>';

            items.forEach((item, index) => {
                select.innerHTML += `<option value="${index}">${escapeHTML(item.name)} (${item.qty} ${escapeHTML(item.unit)})</option>`;
                tbody.innerHTML += `
                    <tr class="text-sm">
                        <td class="p-4"><strong>${escapeHTML(item.name)}</strong><br><span class="text-xs text-slate-400 font-mono">SKU: ${escapeHTML(item.barcode)}</span></td>
                        <td class="p-4">${item.qty} ${escapeHTML(item.unit)}</td>
                        <td class="p-4">${item.buy.toFixed(2)} TK</td>
                        <td class="p-4 font-semibold text-indigo-600">${item.sell.toFixed(2)} TK</td>
                        <td class="p-4 text-red-500">-${item.discount.toFixed(2)} TK</td>
                        <td class="p-4 text-amber-500">+${item.vat}%</td>
                        <td class="p-4 text-emerald-600">${escapeHTML(item.gift) || '-'}</td>
                        <td class="p-4 text-center"><svg id="barcode-${item.barcode}"></svg></td>
                        <td class="p-4 text-center"><button onclick="MergedApp.deleteInventoryItem(${index})" class="text-red-500 font-semibold">Delete</button></td>
                    </tr>`;
                setTimeout(() => {
                    JsBarcode(`#barcode-${item.barcode}`, item.barcode, { format: "CODE128", width: 1, height: 25, displayValue: false });
                }, 10);
            });
        },

        handleSaveProduct: function() {
            const name = document.getElementById('inv-name').value.trim();
            const skuInput = document.getElementById('inv-sku').value.trim();
            const qty = parseFloat(document.getElementById('inv-qty').value);
            const unit = document.getElementById('inv-unit').value;
            const buy = parseFloat(document.getElementById('inv-buy').value);
            const sell = parseFloat(document.getElementById('inv-sell').value);
            const discount = parseFloat(document.getElementById('inv-discount').value) || 0;
            const vat = parseFloat(document.getElementById('inv-vat').value) || 0;
            const gift = document.getElementById('inv-gift').value.trim();

            if (!name || isNaN(qty) || isNaN(buy) || isNaN(sell)) { alert('Fill out required fields!'); return; }
            const barcode = skuInput ? skuInput : "SKU" + Math.floor(10000 + Math.random() * 90000);

            let dbUsers = getDBUsers();
            if (!dbUsers[activeUser].inventory) dbUsers[activeUser].inventory = [];
            dbUsers[activeUser].inventory.push({ name, qty, unit, buy, sell, discount, vat, gift, barcode });
            saveDBUsers(dbUsers);
            this.renderInventory();
        },

        deleteInventoryItem: function(index) {
            let dbUsers = getDBUsers();
            dbUsers[activeUser].inventory.splice(index, 1);
            saveDBUsers(dbUsers);
            this.renderInventory();
        },

        processFinalInvoice: function() {
            if (cart.length === 0) { alert('Cart empty!'); return; }
            let dbUsers = getDBUsers();
            const totalBill = cart.reduce((sum, item) => sum + item.total, 0);

            const newStatement = {
                date: new Date().toLocaleString(), total: totalBill, paid: totalBill, due: 0, method: 'Cash'
            };
            if (!dbUsers[activeUser].statements) dbUsers[activeUser].statements = [];
            dbUsers[activeUser].statements.push(newStatement);
            saveDBUsers(dbUsers);

            document.getElementById('bill-shop-name').innerText = dbUsers[activeUser].companyName || dbUsers[activeUser].name;
            document.getElementById('bill-date').innerText = newStatement.date;
            
            cart = [];
            this.renderCart();
            this.renderInventory();
            this.renderStatements();
            document.getElementById('app-container').classList.add('hidden');
            document.getElementById('print-area').classList.remove('hidden');
        },

        closeInvoiceView: function() {
            document.getElementById('print-area').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
        },

        renderStatements: function() {
            const dbUsers = getDBUsers();
            const statements = dbUsers[activeUser].statements || [];
            const tbody = document.getElementById('statement-table-body');
            tbody.innerHTML = '';
            let s=0, r=0, d=0;
            statements.forEach(st => {
                s+=st.total; r+=st.paid; d+=st.due;
                tbody.innerHTML += `
                    <tr class="text-sm">
                        <td class="p-4">${escapeHTML(st.date)}</td>
                        <td class="p-4 font-bold">${st.total.toFixed(2)} TK</td>
                        <td class="p-4 text-emerald-600">${st.paid.toFixed(2)} TK</td>
                        <td class="p-4 text-rose-500">${st.due.toFixed(2)} TK</td>
                        <td class="p-4"><span class="px-2 py-0.5 rounded text-xs font-bold bg-slate-100">${escapeHTML(st.method)}</span></td>
                    </tr>`;
            });
            document.getElementById('widget-total-sales').innerText = `${s.toFixed(2)} TK`;
            document.getElementById('widget-total-received').innerText = `${r.toFixed(2)} TK`;
            document.getElementById('widget-total-due').innerText = `${d.toFixed(2)} TK`;
        },

        handleDownloadCSV: function() {
            const dbUsers = getDBUsers();
            let csv = 'Timestamp,Gross Total,Paid Amount,Due,Method\n';
            (dbUsers[activeUser].statements || []).forEach(st => { 
                csv += `\"${st.date}\",${st.total},${st.paid},${st.due},\"${st.method}\"\n`; 
            });
            const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;' });
            const lnk = document.createElement("a"); 
            lnk.href = URL.createObjectURL(blob); 
            lnk.download = 'Statement.csv'; 
            lnk.click();
        }
    };
})();


/**
 * Admin Portal Verification & Registration Sub-Controller (Merged from admin.js)
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

            document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.className = 'admin-tab-btn bg-slate-700 px-3 py-1.5 rounded text-xs font-bold transition');
            document.getElementById(`tab-btn-${tabId}`).className = 'admin-tab-btn bg-indigo-600 px-3 py-1.5 rounded text-xs font-bold transition text-white';
        },

        switchAdminSubTab: function(subTabId) {
            document.querySelectorAll('.admin-subtab-content').forEach(t => t.classList.add('hidden'));
            document.querySelectorAll('.admin-subtab-btn').forEach(b => {
                b.className = 'admin-subtab-btn font-semibold text-sm py-2 text-slate-500 hover:text-indigo-600';
            });

            document.getElementById(subTabId).classList.remove('hidden');
            document.getElementById(`btn-${subTabId}`).className = 'admin-subtab-btn font-bold text-sm py-2 border-b-2 border-indigo-600 text-indigo-600';
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

            if (!tableCame) return;

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
                
                alert(`✓ Approved! Credentials sent to user email/phone.\nUsername: ${assignedUsername}\nPassword: ${assignedPassword}`);
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
    MergedApp.init();
});
