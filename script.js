/**
 * Enterprise POS Engine Namespace linked with Central Admin Portal Data
 */
const POSApp = (function() {
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

    // Tracker for Active session, view count and duration
    function startUserSessionTracker() {
        if (!activeUser) return;
        let users = getDBUsers();
        if (users[activeUser]) {
            users[activeUser].viewCount = (users[activeUser].viewCount || 0) + 1;
            users[activeUser].isOnline = true;
            users[activeUser].lastSeen = new Date().toISOString();
            saveDBUsers(users);
        }

        // Heartbeat every 10s
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

        /* POS CORE LOGIC & INVENTORY */
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
                        <td class="p-4 text-center"><button onclick="POSApp.removeFromCart(${index})" class="text-red-500 font-semibold">Remove</button></td>
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
                        <td class="p-4 text-center"><button onclick="POSApp.deleteInventoryItem(${index})" class="text-red-500 font-semibold">Delete</button></td>
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
                csv += `"${st.date}",${st.total},${st.paid},${st.due},"${st.method}"\n`; 
            });
            const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;' });
            const lnk = document.createElement("a"); 
            lnk.href = URL.createObjectURL(blob); 
            lnk.download = 'Statement.csv'; 
            lnk.click();
        }
    };
})();

window.addEventListener('DOMContentLoaded', () => {
    POSApp.init();
});
