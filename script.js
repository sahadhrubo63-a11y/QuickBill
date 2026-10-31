/**
 * Enterprise POS Engine Namespace with Dedicated Portal Sync & Active Tracking
 */
const POSApp = (function() {
    let activeUser = null;
    let dbUsers = JSON.parse(localStorage.getItem('pos_users')) || {};
    let approvedApps = JSON.parse(localStorage.getItem('pos_approved_apps')) || [];
    let cart = [];
    let tempProfileDpBase64 = "";

    let barcodeBuffer = '';
    let lastKeyTime = Date.now();
    let sessionStartTime = Date.now();

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function saveToLocalStorage() {
        localStorage.setItem('pos_users', JSON.stringify(dbUsers));
        localStorage.setItem('pos_approved_apps', JSON.stringify(approvedApps));
    }

    function playBeepSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                const audioCtx = new AudioCtx();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.08);
            }
        } catch(e) {
            console.log('Audio Context suppressed.');
        }
    }

    return {
        init: function() {
            this.checkAutoLogin();
            this.initBarcodeScannerListener();
        },

        showAuthScreen: function(screenId) {
            document.getElementById('login-card').classList.add('hidden');
            document.getElementById('signup-card').classList.add('hidden');
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
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
                age--;
            }
            document.getElementById('portal-age').value = age >= 0 ? `${age} Years` : 'Invalid DOB';
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

            if (dbUsers[username]) {
                alert('Username already exists!');
                return;
            }

            const fileToBase64 = (fileInputId) => {
                return new Promise((resolve) => {
                    const fileInput = document.getElementById(fileInputId);
                    if (fileInput && fileInput.files[0]) {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(fileInput.files[0]);
                    } else {
                        resolve('');
                    }
                });
            };

            const nidBase64 = await fileToBase64('portal-file-nid');
            const picBase64 = await fileToBase64('portal-file-pic');
            const tradeBase64 = await fileToBase64('portal-file-trade');
            const logoBase64 = await fileToBase64('portal-file-logo');

            let pendingApps = JSON.parse(localStorage.getItem('pos_pending_apps')) || [];
            pendingApps.push({
                id: 'APP-' + Math.floor(1000 + Math.random() * 9000),
                name, username, company, category, phone, email, dob, age,
                address, homeAddress, permAddress, district, nationality,
                nidFile: nidBase64, picFile: picBase64, tradeFile: tradeBase64, logoFile: logoBase64,
                status: 'Pending', submittedAt: new Date().toLocaleString()
            });

            localStorage.setItem('pos_pending_apps', JSON.stringify(pendingApps));
            alert('Registration successfully submitted to Admin Panel! Credentials will be sent after review.');
            location.reload();
        },

        handleLogin: function() {
            const username = document.getElementById('login-username').value.trim();
            const pass = document.getElementById('login-password').value;

            if (dbUsers[username] && dbUsers[username].password === pass) {
                activeUser = username;
                localStorage.setItem('pos_active_user', activeUser);
                
                // Track View count & active session for Admin Analytics
                let appRecord = approvedApps.find(a => a.username === username);
                if (appRecord) {
                    appRecord.viewCount = (appRecord.viewCount || 0) + 1;
                    saveToLocalStorage();
                }

                sessionStartTime = Date.now();
                this.loadApplication();
            } else {
                alert('Invalid credentials or approval pending from admin!');
            }
        },

        checkAutoLogin: function() {
            const savedUser = localStorage.getItem('pos_active_user');
            if (savedUser && dbUsers[savedUser]) { 
                activeUser = savedUser; 
                this.loadApplication(); 
            }
        },

        handleLogout: function() {
            // Update active session duration
            let durationSec = Math.floor((Date.now() - sessionStartTime) / 1000);
            let appRecord = approvedApps.find(a => a.username === activeUser);
            if (appRecord) {
                appRecord.activeDuration = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;
                saveToLocalStorage();
            }

            activeUser = null;
            localStorage.removeItem('pos_active_user');
            document.getElementById('app-container').classList.add('hidden');
            document.getElementById('auth-container').classList.remove('hidden');
            this.showAuthScreen('login-card');
        },

        loadApplication: function() {
            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            const userData = dbUsers[activeUser];

            if (!userData.documents) userData.documents = [];
            if (!userData.vouchers) userData.vouchers = [];

            document.getElementById('app-company-name').innerText = userData.company;
            document.getElementById('app-username').innerText = `User: ${userData.username}`;
            
            if(userData.dp) {
                document.getElementById('sidebar-dp').src = userData.dp;
                document.getElementById('sidebar-dp').classList.remove('hidden');
                document.getElementById('sidebar-initial-logo').classList.add('hidden');
                document.getElementById('profile-preview-img').src = userData.dp;
                document.getElementById('bill-shop-logo').src = userData.dp;
                document.getElementById('bill-shop-logo').classList.remove('hidden');
            } else {
                document.getElementById('sidebar-dp').classList.add('hidden');
                document.getElementById('sidebar-initial-logo').classList.remove('hidden');
                document.getElementById('sidebar-initial-logo').innerText = userData.company.substring(0, 1).toUpperCase();
            }
            document.getElementById('prof-address').value = userData.address || "";
            document.getElementById('prof-helpline').value = userData.helpline || "";

            this.switchTab('tab-pos');
            this.renderInventory();
            this.renderStatements();
            this.renderVouchersTable();
            this.renderBusinessDocuments();
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
            dbUsers[activeUser].address = document.getElementById('prof-address').value.trim();
            dbUsers[activeUser].helpline = document.getElementById('prof-helpline').value.trim();
            if (tempProfileDpBase64) {
                dbUsers[activeUser].dp = tempProfileDpBase64;
            }
            saveToLocalStorage();
            alert('Profile Settings successfully updated!');
            this.loadApplication();
        },

        uploadBusinessDocument: function() {
            const titleInput = document.getElementById('doc-title');
            const fileInput = document.getElementById('doc-file-input');
            const title = titleInput.value.trim();
            const file = fileInput.files[0];

            if (!title || !file) {
                alert('Please provide title and file!');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                dbUsers[activeUser].documents.push({
                    title: title, fileData: e.target.result, fileType: file.type, fileName: file.name
                });
                saveToLocalStorage();
                this.renderBusinessDocuments();
                titleInput.value = ''; fileInput.value = '';
                alert('Document uploaded successfully!');
            };
            reader.readAsDataURL(file);
        },

        renderBusinessDocuments: function() {
            const docs = dbUsers[activeUser].documents || [];
            const tbody = document.getElementById('business-docs-table-body');
            tbody.innerHTML = '';
            docs.forEach((doc, index) => {
                tbody.innerHTML += `
                    <tr class="text-sm">
                        <td class="p-3 font-medium text-slate-700">${escapeHTML(doc.title)}</td>
                        <td class="p-3 text-xs text-slate-500 uppercase">${doc.fileType.includes('pdf') ? 'PDF' : 'Image'}</td>
                        <td class="p-3 text-center space-x-2">
                            <button onclick="POSApp.viewDocument(${index})" class="text-indigo-600 hover:underline text-xs">👁 View</button>
                            <button onclick="POSApp.deleteDocument(${index})" class="text-red-500 hover:underline text-xs">Delete</button>
                        </td>
                    </tr>`;
            });
            if (docs.length === 0) tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400 text-xs">No documents uploaded.</td></tr>`;
        },

        viewDocument: function(index) {
            const doc = dbUsers[activeUser].documents[index];
            if (!doc) return;
            document.getElementById('modal-doc-title').innerText = doc.title;
            const contentDiv = document.getElementById('modal-doc-content');
            contentDiv.innerHTML = doc.fileType.includes('pdf') ? `<iframe src="${doc.fileData}" class="w-full h-[60vh] border rounded"></iframe>` : `<img src="${doc.fileData}" class="max-w-full h-auto rounded object-contain">`;
            document.getElementById('doc-modal').classList.remove('hidden');
        },

        closeDocModal: function() { document.getElementById('doc-modal').classList.add('hidden'); },
        deleteDocument: function(index) { dbUsers[activeUser].documents.splice(index, 1); saveToLocalStorage(); this.renderBusinessDocuments(); },

        openVoucherModal: function() { document.getElementById('voucher-modal').classList.remove('hidden'); this.renderVoucherFormFields(); },
        closeVoucherModal: function() { document.getElementById('voucher-modal').classList.add('hidden'); },

        renderVoucherFormFields: function() {
            const type = document.getElementById('v-type-select').value;
            const container = document.getElementById('voucher-dynamic-fields');
            const defaultBusName = dbUsers[activeUser].company || '';
            const uniqueNum = type === 'Challan' ? 'CH-' + Math.floor(1000 + Math.random() * 9000) : (type === 'Credit Voucher' ? 'CR-' + Math.floor(1000 + Math.random() * 9000) : 'DR-' + Math.floor(1000 + Math.random() * 9000));
            const todayStr = new Date().toISOString().split('T')[0];

            if (type === 'Credit Voucher') {
                container.innerHTML = `
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Business Name</label><input type="text" id="cv-bus" class="w-full border p-2 rounded text-sm" value="${defaultBusName}"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Voucher Number</label><input type="text" id="cv-num" class="w-full border p-2 rounded text-sm bg-slate-50 font-bold" value="${uniqueNum}" readonly></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Date</label><input type="date" id="cv-date" class="w-full border p-2 rounded text-sm" value="${todayStr}"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Received From</label><input type="text" id="cv-received" class="w-full border p-2 rounded text-sm" placeholder="Payer Name"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Account Name</label><input type="text" id="cv-account" class="w-full border p-2 rounded text-sm" placeholder="Cash/Bank"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Amount (৳)</label><input type="number" step="any" id="cv-amount" class="w-full border p-2 rounded text-sm" placeholder="0.00"></div>
                `;
            } else if (type === 'Debit Voucher') {
                container.innerHTML = `
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Business Name</label><input type="text" id="dv-bus" class="w-full border p-2 rounded text-sm" value="${defaultBusName}"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Voucher Number</label><input type="text" id="dv-num" class="w-full border p-2 rounded text-sm bg-slate-50 font-bold" value="${uniqueNum}" readonly></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Date</label><input type="date" id="dv-date" class="w-full border p-2 rounded text-sm" value="${todayStr}"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Paid To</label><input type="text" id="dv-paidto" class="w-full border p-2 rounded text-sm" placeholder="Payee Name"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Amount (৳)</label><input type="number" step="any" id="dv-amount" class="w-full border p-2 rounded text-sm" placeholder="0.00"></div>
                `;
            } else {
                container.innerHTML = `
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Business Name</label><input type="text" id="ch-bus" class="w-full border p-2 rounded text-sm" value="${defaultBusName}"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Challan Number</label><input type="text" id="ch-num" class="w-full border p-2 rounded text-sm bg-slate-50 font-bold" value="${uniqueNum}" readonly></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Customer Name</label><input type="text" id="ch-cname" class="w-full border p-2 rounded text-sm" placeholder="Customer Name"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Product Name & Qty</label><input type="text" id="ch-pname" class="w-full border p-2 rounded text-sm" placeholder="Product & Qty"></div>
                `;
            }
        },

        saveAndGenerateVoucher: function() {
            const type = document.getElementById('v-type-select').value;
            let record = { type };
            if (type === 'Credit Voucher') {
                record.businessName = document.getElementById('cv-bus').value;
                record.uniqueNum = document.getElementById('cv-num').value;
                record.date = document.getElementById('cv-date').value;
                record.receivedFrom = document.getElementById('cv-received').value;
                record.amount = document.getElementById('cv-amount').value;
            } else if (type === 'Debit Voucher') {
                record.businessName = document.getElementById('dv-bus').value;
                record.uniqueNum = document.getElementById('dv-num').value;
                record.date = document.getElementById('dv-date').value;
                record.paidTo = document.getElementById('dv-paidto').value;
                record.amount = document.getElementById('dv-amount').value;
            } else {
                record.businessName = document.getElementById('ch-bus').value;
                record.uniqueNum = document.getElementById('ch-num').value;
                record.cname = document.getElementById('ch-cname').value;
                record.pname = document.getElementById('ch-pname').value;
            }
            dbUsers[activeUser].vouchers.push(record);
            saveToLocalStorage();
            this.closeVoucherModal();
            this.renderVouchersTable();
        },

        renderVouchersTable: function() {
            const vouchers = dbUsers[activeUser].vouchers || [];
            const tbody = document.getElementById('vouchers-table-body');
            tbody.innerHTML = '';
            vouchers.forEach((v, index) => {
                tbody.innerHTML += `
                    <tr class="text-sm">
                        <td class="p-4 font-mono font-bold text-indigo-600">${escapeHTML(v.uniqueNum)}</td>
                        <td class="p-4">${escapeHTML(v.type)}</td>
                        <td class="p-4">${escapeHTML(v.date || 'N/A')}</td>
                        <td class="p-4">${escapeHTML(v.receivedFrom || v.paidTo || v.cname || 'N/A')}</td>
                        <td class="p-4 font-bold">${escapeHTML(v.amount ? v.amount + ' TK' : v.pname)}</td>
                        <td class="p-4 text-center"><button onclick="POSApp.deleteVoucher(${index})" class="text-red-500 hover:underline">Delete</button></td>
                    </tr>`;
            });
            if (vouchers.length === 0) tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No records found.</td></tr>`;
        },

        deleteVoucher: function(index) {
            dbUsers[activeUser].vouchers.splice(index, 1);
            saveToLocalStorage();
            this.renderVouchersTable();
        },

        updatePOSUnitDisplay: function() {
            const select = document.getElementById('bill-product-select');
            const badge = document.getElementById('pos-unit-badge');
            if (select.value === "") { badge.innerText = "Unit"; return; }
            badge.innerText = dbUsers[activeUser].inventory[select.value].unit;
        },

        calculateLivePOSBreakdown: function() {},
        togglePaidInputDisplay: function() {},

        addToCart: function() {
            const select = document.getElementById('bill-product-select');
            const qty = parseFloat(document.getElementById('bill-qty-input').value);
            if (select.value === "" || isNaN(qty) || qty <= 0) { alert('Enter valid entries!'); return; }
            
            const item = dbUsers[activeUser].inventory[select.value];
            if (qty > item.qty) { alert('Insufficient stock!'); return; }

            cart.push({ inventoryIndex: select.value, name: item.name, qty, unit: item.unit, price: item.sell, total: qty * item.sell });
            this.renderCart();
            document.getElementById('bill-qty-input').value = '';
            select.value = '';
        },

        initBarcodeScannerListener: function() {},

        renderCart: function() {
            const tbody = document.getElementById('cart-table-body');
            tbody.innerHTML = '';
            let grandTotal = 0;
            cart.forEach((item, index) => {
                grandTotal += item.total;
                tbody.innerHTML += `
                    <tr class="text-sm">
                        <td class="p-4"><strong>${escapeHTML(item.name)}</strong></td>
                        <td class="p-4">${item.qty} ${escapeHTML(item.unit)}</td>
                        <td class="p-4">${item.price.toFixed(2)} TK</td>
                        <td class="p-4">-</td>
                        <td class="p-4 font-bold text-indigo-600">${item.total.toFixed(2)} TK</td>
                        <td class="p-4 text-center"><button onclick="POSApp.removeFromCart(${index})" class="text-red-500">Remove</button></td>
                    </tr>`;
            });
            if(cart.length === 0) tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">Your cart is empty.</td></tr>`;
            document.getElementById('cart-item-count').innerText = `${cart.length} Items`;
            document.getElementById('summary-total').innerText = `${grandTotal.toFixed(2)} TK`;
        },

        removeFromCart: function(index) { cart.splice(index, 1); this.renderCart(); },

        renderInventory: function() {
            const items = dbUsers[activeUser].inventory || [];
            const tbody = document.getElementById('inventory-table-body');
            tbody.innerHTML = '';
            const select = document.getElementById('bill-product-select');
            select.innerHTML = '<option value="">Select Product Manually</option>';

            items.forEach((item, index) => {
                select.innerHTML += `<option value="${index}">${escapeHTML(item.name)} (${item.qty} ${escapeHTML(item.unit)})</option>`;
                tbody.innerHTML += `
                    <tr class="text-sm">
                        <td class="p-4"><strong>${escapeHTML(item.name)}</strong><br><span class="text-xs font-mono">SKU: ${escapeHTML(item.barcode)}</span></td>
                        <td class="p-4">${item.qty} ${escapeHTML(item.unit)}</td>
                        <td class="p-4">${item.buy.toFixed(2)} TK</td>
                        <td class="p-4 font-semibold text-indigo-600">${item.sell.toFixed(2)} TK</td>
                        <td class="p-4">-</td>
                        <td class="p-4">-</td>
                        <td class="p-4">-</td>
                        <td class="p-4 text-center"><svg id="barcode-${item.barcode}"></svg></td>
                        <td class="p-4 text-center"><button onclick="POSApp.deleteInventoryItem(${index})" class="text-red-500">Delete</button></td>
                    </tr>`;
                setTimeout(() => {
                    if(document.getElementById(`barcode-${item.barcode}`)) {
                        JsBarcode(`#barcode-${item.barcode}`, item.barcode, { format: "CODE128", width: 1.1, height: 28, displayValue: false });
                    }
                }, 10);
            });
            if(items.length === 0) tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400">No products inside inventory.</td></tr>`;
        },

        deleteInventoryItem: function(index) {
            dbUsers[activeUser].inventory.splice(index, 1);
            saveToLocalStorage();
            this.renderInventory();
        },

        handleSaveProduct: function() {
            const name = document.getElementById('inv-name').value.trim();
            const skuInput = document.getElementById('inv-sku').value.trim();
            const qty = parseFloat(document.getElementById('inv-qty').value);
            const unit = document.getElementById('inv-unit').value;
            const buy = parseFloat(document.getElementById('inv-buy').value);
            const sell = parseFloat(document.getElementById('inv-sell').value);

            if (!name || isNaN(qty) || isNaN(buy) || isNaN(sell)) { alert('Fill out required fields!'); return; }
            const barcode = skuInput ? skuInput : "SKU" + Math.floor(10000 + Math.random() * 90000);

            dbUsers[activeUser].inventory.push({ name, qty, unit, buy, sell, barcode });
            saveToLocalStorage();
            this.renderInventory();
            document.getElementById('inv-name').value = '';
            document.getElementById('inv-sku').value = '';
            document.getElementById('inv-qty').value = '';
            document.getElementById('inv-buy').value = '';
            document.getElementById('inv-sell').value = '';
        },

        processFinalInvoice: function() {
            if (cart.length === 0) { alert('Cart is empty!'); return; }
            const totalBill = cart.reduce((sum, item) => sum + item.total, 0);

            cart.forEach(item => { dbUsers[activeUser].inventory[item.inventoryIndex].qty -= item.qty; });

            dbUsers[activeUser].statements.push({
                date: new Date().toLocaleString().split(',')[0], total: totalBill, paid: totalBill, due: 0, method: 'Cash'
            });
            saveToLocalStorage();

            cart = [];
            this.renderCart();
            this.renderInventory();
            this.renderStatements();
            alert('Bill successfully created!');
        },

        closeInvoiceView: function() {},

        renderStatements: function() {
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
                        <td class="p-4">${escapeHTML(st.method)}</td>
                    </tr>`;
            });
            document.getElementById('widget-total-sales').innerText = `${s.toFixed(2)} TK`;
            document.getElementById('widget-total-received').innerText = `${r.toFixed(2)} TK`;
            document.getElementById('widget-total-due').innerText = `${d.toFixed(2)} TK`;
        },

        handleDownloadCSV: function() {}
    };
})();

window.addEventListener('DOMContentLoaded', () => { POSApp.init(); });
