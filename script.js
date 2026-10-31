const POSApp = (function() {
    let activeUser = null;
    let dbUsers = JSON.parse(localStorage.getItem('pos_users')) || {};
    let approvedApps = JSON.parse(localStorage.getItem('pos_approved_apps')) || [];
    let cart = [];
    let tempProfileDpBase64 = "";

    function saveToLocalStorage() {
        localStorage.setItem('pos_users', JSON.stringify(dbUsers));
        localStorage.setItem('pos_approved_apps', JSON.stringify(approvedApps));
    }

    return {
        init: function() { this.checkAutoLogin(); },

        showAuthScreen: function(screenId) {
            document.getElementById('login-card').classList.add('hidden');
            document.getElementById('signup-card').classList.add('hidden');
            document.getElementById('portal-form-element').classList.remove('hidden');
            document.getElementById('portal-success-receipt').classList.add('hidden');
            document.getElementById(screenId).classList.remove('hidden');
        },

        togglePasswordVisibility: function(inputId) {
            const input = document.getElementById(inputId);
            input.type = input.type === "password" ? "text" : "password";
        },

        calculateAgeFromDOB: function() {
            const dobVal = document.getElementById('portal-dob').value;
            if (!dobVal) return;
            const dob = new Date(dobVal);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
            document.getElementById('portal-age').value = age >= 0 ? `${age} Years` : 'Invalid';
        },

        submitRegistrationPortal: async function() {
            const name = document.getElementById('portal-name').value.trim();
            const username = document.getElementById('portal-username').value.trim();
            const company = document.getElementById('portal-company').value.trim();
            const category = document.getElementById('portal-category').value.trim();
            const phone = document.getElementById('portal-phone').value.trim();
            const email = document.getElementById('portal-email').value.trim().toLowerCase();
            const dob = document.getElementById('portal-dob').value;
            const age = document.getElementById('portal-age').value;
            const address = document.getElementById('portal-address').value.trim();
            const homeAddress = document.getElementById('portal-home-address').value.trim();
            const permAddress = document.getElementById('portal-perm-address').value.trim();
            const district = document.getElementById('portal-district').value.trim();
            const nationality = document.getElementById('portal-nationality').value.trim();

            if (dbUsers[username]) { alert('Username already exists!'); return; }

            const fileToBase64 = (id) => new Promise((res) => {
                const f = document.getElementById(id).files[0];
                if(f) { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(f); } else res('');
            });

            const pendingApps = JSON.parse(localStorage.getItem('pos_pending_apps')) || [];
            pendingApps.push({
                id: 'APP-' + Math.floor(1000 + Math.random() * 9000),
                name, username, company, category, phone, email, dob, age,
                address, homeAddress, permAddress, district, nationality,
                nidFile: await fileToBase64('portal-file-nid'),
                picFile: await fileToBase64('portal-file-pic'),
                tradeFile: await fileToBase64('portal-file-trade'),
                logoFile: await fileToBase64('portal-file-logo'),
                status: 'Pending'
            });

            localStorage.setItem('pos_pending_apps', JSON.stringify(pendingApps));
            document.getElementById('portal-form-element').classList.add('hidden');
            document.getElementById('portal-success-receipt').classList.remove('hidden');
        },

        handleLogin: function() {
            const username = document.getElementById('login-username').value.trim();
            const pass = document.getElementById('login-password').value;

            let appRecord = approvedApps.find(a => a.username === username);
            if (appRecord && appRecord.status === 'Inactive') {
                alert('Your account is currently Inactive / Delisted by Admin.');
                return;
            }

            if (dbUsers[username] && dbUsers[username].password === pass) {
                activeUser = username;
                localStorage.setItem('pos_active_user', activeUser);
                if (appRecord) { appRecord.viewCount = (appRecord.viewCount || 0) + 1; saveToLocalStorage(); }
                this.loadApplication();
            } else { alert('Invalid credentials or approval pending.'); }
        },

        checkAutoLogin: function() {
            const savedUser = localStorage.getItem('pos_active_user');
            if (savedUser && dbUsers[savedUser]) {
                let appRecord = approvedApps.find(a => a.username === savedUser);
                if (appRecord && appRecord.status === 'Inactive') { this.handleLogout(); return; }
                activeUser = savedUser; this.loadApplication();
            }
        },

        handleLogout: function() {
            activeUser = null; localStorage.removeItem('pos_active_user');
            document.getElementById('app-container').classList.add('hidden');
            document.getElementById('auth-container').classList.remove('hidden');
            this.showAuthScreen('login-card');
        },

        loadApplication: function() {
            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            const userData = dbUsers[activeUser];
            document.getElementById('app-company-name').innerText = userData.company;
            document.getElementById('app-username').innerText = `User: ${userData.username}`;
            if(userData.dp) {
                document.getElementById('sidebar-dp').src = userData.dp;
                document.getElementById('sidebar-dp').classList.remove('hidden');
                document.getElementById('sidebar-initial-logo').classList.add('hidden');
                document.getElementById('profile-preview-img').src = userData.dp;
            }
            this.switchTab('tab-pos');
            this.renderInventory();
            this.renderStatements();
            this.renderVouchersTable();
        },

        switchTab: function(tabId) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
            document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('bg-indigo-600', 'text-white'));
            document.getElementById(tabId).classList.remove('hidden');
            document.getElementById(`btn-${tabId}`).classList.add('bg-indigo-600', 'text-white');
        },

        previewProfileDp: function(event) {
            const f = event.target.files[0];
            if(f) { const r = new FileReader(); r.onload = e => { tempProfileDpBase64 = e.target.result; document.getElementById('profile-preview-img').src = tempProfileDpBase64; }; r.readAsDataURL(f); }
        },

        saveProfileConfiguration: function() {
            dbUsers[activeUser].address = document.getElementById('prof-address').value.trim();
            dbUsers[activeUser].helpline = document.getElementById('prof-helpline').value.trim();
            if(tempProfileDpBase64) dbUsers[activeUser].dp = tempProfileDpBase64;
            saveToLocalStorage(); alert('Saved!'); this.loadApplication();
        },

        openVoucherModal: function() { document.getElementById('voucher-modal').classList.remove('hidden'); this.renderVoucherFormFields(); },
        closeVoucherModal: function() { document.getElementById('voucher-modal').classList.add('hidden'); },
        renderVoucherFormFields: function() {
            document.getElementById('voucher-dynamic-fields').innerHTML = `
                <input type="text" id="v-num" value="V-${Math.floor(1000+Math.random()*9000)}" readonly class="w-full border p-2 rounded text-sm bg-slate-50">
                <input type="text" id="v-entity" class="w-full border p-2 rounded text-sm" placeholder="Entity Name">
                <input type="number" id="v-amount" class="w-full border p-2 rounded text-sm" placeholder="Amount">
            `;
        },
        saveAndGenerateVoucher: function() {
            dbUsers[activeUser].vouchers = dbUsers[activeUser].vouchers || [];
            dbUsers[activeUser].vouchers.push({
                type: document.getElementById('v-type-select').value,
                uniqueNum: document.getElementById('v-num').value,
                date: new Date().toLocaleDateString(),
                entity: document.getElementById('v-entity').value,
                amount: document.getElementById('v-amount').value
            });
            saveToLocalStorage(); this.closeVoucherModal(); this.renderVouchersTable();
        },
        renderVouchersTable: function() {
            const tbody = document.getElementById('vouchers-table-body'); tbody.innerHTML = '';
            (dbUsers[activeUser].vouchers || []).forEach((v, i) => {
                tbody.innerHTML += `<tr class="text-sm"><td class="p-4">${v.uniqueNum}</td><td class="p-4">${v.type}</td><td class="p-4">${v.date}</td><td class="p-4">${v.amount} TK</td><td class="p-4 text-center"><button onclick="POSApp.delVoucher(${i})" class="text-red-500">Delete</button></td></tr>`;
            });
        },
        delVoucher: function(i) { dbUsers[activeUser].vouchers.splice(i, 1); saveToLocalStorage(); this.renderVouchersTable(); },

        addToCart: function() {
            const sel = document.getElementById('bill-product-select').value;
            const qty = parseFloat(document.getElementById('bill-qty-input').value);
            if(sel === "" || isNaN(qty) || qty <= 0) { alert('Enter valid quantity'); return; }
            const item = dbUsers[activeUser].inventory[sel];
            if(qty > item.qty) { alert('Insufficient stock'); return; }
            cart.push({ inventoryIndex: sel, name: item.name, qty, price: item.sell, total: qty * item.sell });
            this.renderCart(); document.getElementById('bill-qty-input').value = '';
        },
        renderCart: function() {
            const tbody = document.getElementById('cart-table-body'); tbody.innerHTML = ''; let gt = 0;
            cart.forEach((c, i) => { gt += c.total; tbody.innerHTML += `<tr class="text-sm"><td class="p-4">${c.name}</td><td class="p-4">${c.qty}</td><td class="p-4">${c.price}</td><td class="p-4">${c.total}</td><td class="p-4 text-center"><button onclick="POSApp.remCart(${i})" class="text-red-500">Remove</button></td></tr>`; });
            document.getElementById('summary-total').innerText = `${gt.toFixed(2)} TK`;
        },
        remCart: function(i) { cart.splice(i, 1); this.renderCart(); },

        renderInventory: function() {
            const items = dbUsers[activeUser].inventory || [];
            const tbody = document.getElementById('inventory-table-body'); tbody.innerHTML = '';
            const sel = document.getElementById('bill-product-select'); sel.innerHTML = '<option value="">Select Product</option>';
            items.forEach((it, i) => {
                sel.innerHTML += `<option value="${i}">${it.name} (${it.qty})</option>`;
                tbody.innerHTML += `<tr class="text-sm"><td class="p-4">${it.name}<br><span class="text-xs font-mono">SKU: ${it.barcode}</span></td><td class="p-4">${it.qty}</td><td class="p-4">${it.sell} TK</td><td class="p-4 text-center"><svg id="bc-${it.barcode}"></svg></td><td class="p-4 text-center"><button onclick="POSApp.delInv(${i})" class="text-red-500">Delete</button></td></tr>`;
                setTimeout(() => { if(document.getElementById(`bc-${it.barcode}`)) JsBarcode(`#bc-${it.barcode}`, it.barcode, {format:"CODE128", width:1, height:25, displayValue:false}); }, 10);
            });
        },
        delInv: function(i) { dbUsers[activeUser].inventory.splice(i, 1); saveToLocalStorage(); this.renderInventory(); },
        handleSaveProduct: function() {
            const name = document.getElementById('inv-name').value.trim();
            const sku = document.getElementById('inv-sku').value.trim() || "SKU" + Math.floor(1000+Math.random()*9000);
            const qty = parseFloat(document.getElementById('inv-qty').value);
            const sell = parseFloat(document.getElementById('inv-sell').value);
            if(!name || isNaN(qty) || isNaN(sell)) { alert('Fill fields'); return; }
            dbUsers[activeUser].inventory = dbUsers[activeUser].inventory || [];
            dbUsers[activeUser].inventory.push({ name, sku, qty, sell, barcode: sku });
            saveToLocalStorage(); this.renderInventory();
            document.getElementById('inv-name').value = ''; document.getElementById('inv-sku').value = ''; document.getElementById('inv-qty').value = ''; document.getElementById('inv-sell').value = '';
        },
        processFinalInvoice: function() {
            if(cart.length === 0) { alert('Cart empty'); return; }
            let gt = 0; cart.forEach(c => { gt += c.total; dbUsers[activeUser].inventory[c.inventoryIndex].qty -= c.qty; });
            dbUsers[activeUser].statements = dbUsers[activeUser].statements || [];
            dbUsers[activeUser].statements.push({ date: new Date().toLocaleDateString(), total: gt, paid: gt, method: 'Cash' });
            saveToLocalStorage(); cart = []; this.renderCart(); this.renderInventory(); this.renderStatements(); alert('Bill created!');
        },
        renderStatements: function() {
            const tbody = document.getElementById('statement-table-body'); tbody.innerHTML = '';
            (dbUsers[activeUser].statements || []).forEach(st => {
                tbody.innerHTML += `<tr class="text-sm"><td class="p-4">${st.date}</td><td class="p-4">${st.total} TK</td><td class="p-4">${st.paid} TK</td><td class="p-4">${st.method}</td></tr>`;
            });
        }
    };
})();
window.addEventListener('DOMContentLoaded', () => POSApp.init());
