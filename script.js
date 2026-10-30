/**
 * Enterprise POS Engine Namespace with Vouchers, Challans, OTP & Audit Ledgers
 */
const POSApp = (function() {
    let activeUser = null;
    let dbUsers = JSON.parse(localStorage.getItem('pos_users')) || {};
    let cart = [];
    let tempProfileDpBase64 = "";

    let tempSignupData = null;
    let signupGeneratedOTP = "";
    let forgotPasswordOTP = "";
    let forgotEmailAccount = "";

    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

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
            console.log('Audio Context suppressed or not allowed.');
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
            document.getElementById('forgot-card').classList.add('hidden');
            document.getElementById(screenId).classList.remove('hidden');

            if(screenId === 'signup-card') {
                document.getElementById('signup-form-step1').classList.remove('hidden');
                document.getElementById('signup-form-step2').classList.add('hidden');
            } else if(screenId === 'forgot-card') {
                document.getElementById('forgot-form-step1').classList.remove('hidden');
                document.getElementById('forgot-form-step2').classList.add('hidden');
            }
        },

        togglePasswordVisibility: function(inputId) {
            const input = document.getElementById(inputId);
            input.type = input.type === "password" ? "text" : "password";
        },

        checkPasswordStrength: function(inputId, indicatorId) {
            const password = document.getElementById(inputId).value;
            const ind = document.getElementById(indicatorId);
            ind.innerHTML = `
                <div class="${/[A-Z]/.test(password) ? 'text-emerald-600' : 'text-slate-400'}">✓ At least 1 Uppercase letter</div>
                <div class="${/[a-z]/.test(password) ? 'text-emerald-600' : 'text-slate-400'}">✓ At least 1 Lowercase letter</div>
                <div class="${/\d/.test(password) ? 'text-emerald-600' : 'text-slate-400'}">✓ At least 1 Number</div>
                <div class="${password.length >= 8 ? 'text-emerald-600' : 'text-slate-400'}">✓ Min 8 characters</div>
            `;
        },

        initiateSignupOTP: function() {
            const company = document.getElementById('reg-company').value.trim();
            const email = document.getElementById('reg-email').value.trim().toLowerCase();
            const category = document.getElementById('reg-category').value.trim();
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value;

            if (!company || !email || !username || !password) {
                alert('All required fields must be completed!');
                return;
            }

            if (dbUsers[username]) {
                alert('Username is already taken!');
                return;
            }

            tempSignupData = { company, email, category, username, password };
            signupGeneratedOTP = Math.floor(100000 + Math.random() * 900000).toString();

            alert(`[EMAIL INBOX SIMULATION]\n\nOTP sent to ${email}.\nYour Verification Code is: ${signupGeneratedOTP}`);

            document.getElementById('otp-sent-email-display').innerText = email;
            document.getElementById('signup-form-step1').classList.add('hidden');
            document.getElementById('signup-form-step2').classList.remove('hidden');
        },

        verifySignupOTP: function() {
            const enteredOTP = document.getElementById('reg-otp-input').value.trim();
            if (enteredOTP !== signupGeneratedOTP) {
                alert('Invalid OTP code!');
                return;
            }

            const { username, password, company, category, email } = tempSignupData;
            dbUsers[username] = {
                username, email, password, company, category, inventory: [], statements: [],
                vouchers: [], address: "", helpline: "", dp: "", documents: []
            };

            saveToLocalStorage();
            alert('Account created successfully! Please Login.');
            tempSignupData = null;
            this.showAuthScreen('login-card');
        },

        sendForgotOTP: function() {
            const email = document.getElementById('forgot-email').value.trim().toLowerCase();
            const userEntry = Object.values(dbUsers).find(u => u.email === email);

            if (!userEntry) {
                alert('No registered account found with this email!');
                return;
            }

            forgotEmailAccount = email;
            forgotPasswordOTP = Math.floor(100000 + Math.random() * 900000).toString();

            alert(`[EMAIL INBOX SIMULATION]\n\nPassword recovery requested for ${email}.\nYour Reset OTP is: ${forgotPasswordOTP}`);

            document.getElementById('forgot-email-display').innerText = email;
            document.getElementById('forgot-form-step1').classList.add('hidden');
            document.getElementById('forgot-form-step2').classList.remove('hidden');
        },

        resetPassword: function() {
            const enteredOTP = document.getElementById('forgot-otp-input').value.trim();
            const newPassword = document.getElementById('forgot-new-password').value;

            if (enteredOTP !== forgotPasswordOTP) {
                alert('Invalid Reset OTP code!');
                return;
            }

            const username = Object.keys(dbUsers).find(key => dbUsers[key].email === forgotEmailAccount);
            if (username && dbUsers[username]) {
                dbUsers[username].password = newPassword;
                saveToLocalStorage();
                alert('Password reset successful! Please login.');
                this.showAuthScreen('login-card');
            }
        },

        handleLogin: function() {
            const userOrEmail = document.getElementById('login-username').value.trim().toLowerCase();
            const pass = document.getElementById('login-password').value;

            const usernameKey = Object.keys(dbUsers).find(u => u.toLowerCase() === userOrEmail || (dbUsers[u].email && dbUsers[u].email.toLowerCase() === userOrEmail));

            if (usernameKey && dbUsers[usernameKey].password === pass) {
                activeUser = usernameKey;
                localStorage.setItem('pos_active_user', activeUser);
                this.loadApplication();
            } else { 
                alert('Invalid authentication credentials!'); 
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

        /* BUSINESS DOCUMENTS MANAGEMENT */
        uploadBusinessDocument: function() {
            const titleInput = document.getElementById('doc-title');
            const fileInput = document.getElementById('doc-file-input');
            const title = titleInput.value.trim();
            const file = fileInput.files[0];

            if (!title || !file) {
                alert('Please provide a document title and select a file!');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const base64Data = e.target.result;
                if (!dbUsers[activeUser].documents) {
                    dbUsers[activeUser].documents = [];
                }
                dbUsers[activeUser].documents.push({
                    title: title,
                    fileData: base64Data,
                    fileType: file.type,
                    fileName: file.name
                });
                saveToLocalStorage();
                this.renderBusinessDocuments();
                
                titleInput.value = '';
                fileInput.value = '';
                alert('Document successfully uploaded!');
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
                        <td class="p-3 text-xs text-slate-500 uppercase">${doc.fileType.includes('pdf') ? 'PDF Document' : 'JPG/Image'}</td>
                        <td class="p-3 text-center space-x-2">
                            <button onclick="POSApp.viewDocument(${index})" class="text-indigo-600 font-semibold hover:underline text-xs">👁 View</button>
                            <button onclick="POSApp.downloadDocument(${index})" class="text-emerald-600 font-semibold hover:underline text-xs">📥 Download</button>
                            <button onclick="POSApp.deleteDocument(${index})" class="text-red-500 font-semibold hover:underline text-xs">Delete</button>
                        </td>
                    </tr>`;
            });

            if (docs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400 text-xs">No documents uploaded yet.</td></tr>`;
            }
        },

        viewDocument: function(index) {
            const doc = dbUsers[activeUser].documents[index];
            if (!doc) return;

            document.getElementById('modal-doc-title').innerText = doc.title;
            const contentDiv = document.getElementById('modal-doc-content');
            contentDiv.innerHTML = '';

            if (doc.fileType.includes('pdf')) {
                contentDiv.innerHTML = `<iframe src="${doc.fileData}" class="w-full h-[60vh] border rounded"></iframe>`;
            } else {
                contentDiv.innerHTML = `<img src="${doc.fileData}" class="max-w-full h-auto rounded object-contain" alt="${escapeHTML(doc.title)}">`;
            }
            document.getElementById('doc-modal').classList.remove('hidden');
        },

        closeDocModal: function() {
            document.getElementById('doc-modal').classList.add('hidden');
        },

        downloadDocument: function(index) {
            const doc = dbUsers[activeUser].documents[index];
            if (!doc) return;

            const a = document.createElement('a');
            a.href = doc.fileData;
            a.download = doc.fileName || `Business_Doc_${index + 1}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        },

        deleteDocument: function(index) {
            if (confirm('Are you sure you want to delete this document?')) {
                dbUsers[activeUser].documents.splice(index, 1);
                saveToLocalStorage();
                this.renderBusinessDocuments();
            }
        },

        /* VOUCHERS & CHALLAN SYSTEM */
        openVoucherModal: function() {
            document.getElementById('voucher-modal').classList.remove('hidden');
            this.renderVoucherFormFields();
        },

        closeVoucherModal: function() {
            document.getElementById('voucher-modal').classList.add('hidden');
        },

        renderVoucherFormFields: function() {
            const type = document.getElementById('v-type-select').value;
            const container = document.getElementById('voucher-dynamic-fields');
            const defaultBusName = dbUsers[activeUser].company || '';
            const uniqueNum = type === 'Challan' ? 'CH-' + Math.floor(1000 + Math.random() * 9000) : (type === 'Credit Voucher' ? 'CR-' + Math.floor(1000 + Math.random() * 9000) : 'DR-' + Math.floor(1000 + Math.random() * 9000));
            const todayStr = new Date().toISOString().split('T')[0];

            if (type === 'Credit Voucher') {
                container.innerHTML = `
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Business Name</label><input type="text" id="cv-bus" class="w-full border p-2 rounded text-sm" value="${defaultBusName}"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Voucher Number</label><input type="text" id="cv-num" class="w-full border p-2 rounded text-sm bg-slate-50 font-mono font-bold" value="${uniqueNum}" readonly></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Date</label><input type="date" id="cv-date" class="w-full border p-2 rounded text-sm" value="${todayStr}"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Received From</label><input type="text" id="cv-received" class="w-full border p-2 rounded text-sm" placeholder="Payer Name"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Account Name</label><input type="text" id="cv-account" class="w-full border p-2 rounded text-sm" placeholder="e.g., Cash / Bank"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label><select id="cv-method" class="w-full border p-2 rounded text-sm"><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>Mobile Banking</option></select></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Transaction Reference</label><input type="text" id="cv-ref" class="w-full border p-2 rounded text-sm" placeholder="Txn ID or Cheque No"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Description / Narration</label><input type="text" id="cv-desc" class="w-full border p-2 rounded text-sm" placeholder="Narration"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Amount (৳)</label><input type="number" step="any" id="cv-amount" class="w-full border p-2 rounded text-sm" placeholder="0.00"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Amount in Words</label><input type="text" id="cv-words" class="w-full border p-2 rounded text-sm" placeholder="Taka in words"></div>
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Prepared By</label><input type="text" id="cv-prep" class="w-full border p-2 rounded text-sm" value="${dbUsers[activeUser].username}"></div>
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Authorized By</label><input type="text" id="cv-auth" class="w-full border p-2 rounded text-sm" placeholder="Manager Name"></div>
                    </div>
                `;
            } else if (type === 'Debit Voucher') {
                container.innerHTML = `
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Business Name</label><input type="text" id="dv-bus" class="w-full border p-2 rounded text-sm" value="${defaultBusName}"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Voucher Number</label><input type="text" id="dv-num" class="w-full border p-2 rounded text-sm bg-slate-50 font-mono font-bold" value="${uniqueNum}" readonly></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Date</label><input type="date" id="dv-date" class="w-full border p-2 rounded text-sm" value="${todayStr}"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Paid To</label><input type="text" id="dv-paidto" class="w-full border p-2 rounded text-sm" placeholder="Payee Name"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Account Name</label><input type="text" id="dv-account" class="w-full border p-2 rounded text-sm" placeholder="e.g., Expense Account"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Expense Category</label><input type="text" id="dv-expcat" class="w-full border p-2 rounded text-sm" placeholder="e.g., Utilities, Salary"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label><select id="dv-method" class="w-full border p-2 rounded text-sm"><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>Mobile Banking</option></select></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Transaction Reference</label><input type="text" id="dv-ref" class="w-full border p-2 rounded text-sm" placeholder="Reference ID"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Description / Narration</label><input type="text" id="dv-desc" class="w-full border p-2 rounded text-sm" placeholder="Narration"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Amount (৳)</label><input type="number" step="any" id="dv-amount" class="w-full border p-2 rounded text-sm" placeholder="0.00"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Amount in Words</label><input type="text" id="dv-words" class="w-full border p-2 rounded text-sm" placeholder="Taka in words"></div>
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Prepared By</label><input type="text" id="dv-prep" class="w-full border p-2 rounded text-sm" value="${dbUsers[activeUser].username}"></div>
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Authorized By</label><input type="text" id="dv-auth" class="w-full border p-2 rounded text-sm" placeholder="Manager Name"></div>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Business Name</label><input type="text" id="ch-bus" class="w-full border p-2 rounded text-sm" value="${defaultBusName}"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Challan Number</label><input type="text" id="ch-num" class="w-full border p-2 rounded text-sm bg-slate-50 font-mono font-bold" value="${uniqueNum}" readonly></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Challan Date</label><input type="date" id="ch-date" class="w-full border p-2 rounded text-sm" value="${todayStr}"></div>
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Customer Name</label><input type="text" id="ch-cname" class="w-full border p-2 rounded text-sm" placeholder="Customer Name"></div>
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Customer Phone</label><input type="text" id="ch-cphone" class="w-full border p-2 rounded text-sm" placeholder="Phone Number"></div>
                    </div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Customer Address</label><input type="text" id="ch-caddr" class="w-full border p-2 rounded text-sm" placeholder="Address"></div>
                    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Delivery Address</label><input type="text" id="ch-daddr" class="w-full border p-2 rounded text-sm" placeholder="Delivery Location"></div>
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Reference Invoice Number</label><input type="text" id="ch-inv" class="w-full border p-2 rounded text-sm" placeholder="Invoice No"></div>
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Delivery Person</label><input type="text" id="ch-dperson" class="w-full border p-2 rounded text-sm" placeholder="Courier/Person"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Vehicle Number</label><input type="text" id="ch-vehicle" class="w-full border p-2 rounded text-sm" placeholder="Truck/Bike No"></div>
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Delivery Status</label><select id="ch-status" class="w-full border p-2 rounded text-sm"><option>Dispatched</option><option>Delivered</option><option>Pending</option></select></div>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Product Name</label><input type="text" id="ch-pname" class="w-full border p-2 rounded text-sm" placeholder="Product"></div>
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Product Code / SKU</label><input type="text" id="ch-psku" class="w-full border p-2 rounded text-sm" placeholder="SKU"></div>
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Unit</label><input type="text" id="ch-punit" class="w-full border p-2 rounded text-sm" placeholder="PCs/Kg"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Quantity</label><input type="number" step="any" id="ch-qty" class="w-full border p-2 rounded text-sm" placeholder="0"></div>
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Remarks</label><input type="text" id="ch-remarks" class="w-full border p-2 rounded text-sm" placeholder="Optional remarks"></div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 pt-2 border-t">
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Received By</label><input type="text" id="ch-recby" class="w-full border p-2 rounded text-sm" placeholder="Receiver"></div>
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Delivered By</label><input type="text" id="ch-delby" class="w-full border p-2 rounded text-sm" placeholder="Deliverer"></div>
                        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Authorized By</label><input type="text" id="ch-auth" class="w-full border p-2 rounded text-sm" placeholder="Authority"></div>
                    </div>
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
                record.accountName = document.getElementById('cv-account').value;
                record.paymentMethod = document.getElementById('cv-method').value;
                record.ref = document.getElementById('cv-ref').value;
                record.desc = document.getElementById('cv-desc').value;
                record.amount = document.getElementById('cv-amount').value;
                record.words = document.getElementById('cv-words').value;
                record.prep = document.getElementById('cv-prep').value;
                record.auth = document.getElementById('cv-auth').value;
            } else if (type === 'Debit Voucher') {
                record.businessName = document.getElementById('dv-bus').value;
                record.uniqueNum = document.getElementById('dv-num').value;
                record.date = document.getElementById('dv-date').value;
                record.paidTo = document.getElementById('dv-paidto').value;
                record.accountName = document.getElementById('dv-account').value;
                record.expCat = document.getElementById('dv-expcat').value;
                record.paymentMethod = document.getElementById('dv-method').value;
                record.ref = document.getElementById('dv-ref').value;
                record.desc = document.getElementById('dv-desc').value;
                record.amount = document.getElementById('dv-amount').value;
                record.words = document.getElementById('dv-words').value;
                record.prep = document.getElementById('dv-prep').value;
                record.auth = document.getElementById('dv-auth').value;
            } else {
                record.businessName = document.getElementById('ch-bus').value;
                record.uniqueNum = document.getElementById('ch-num').value;
                record.date = document.getElementById('ch-date').value;
                record.cname = document.getElementById('ch-cname').value;
                record.cphone = document.getElementById('ch-cphone').value;
                record.caddr = document.getElementById('ch-caddr').value;
                record.daddr = document.getElementById('ch-daddr').value;
                record.inv = document.getElementById('ch-inv').value;
                record.dperson = document.getElementById('ch-dperson').value;
                record.vehicle = document.getElementById('ch-vehicle').value;
                record.status = document.getElementById('ch-status').value;
                record.pname = document.getElementById('ch-pname').value;
                record.psku = document.getElementById('ch-psku').value;
                record.punit = document.getElementById('ch-punit').value;
                record.qty = document.getElementById('ch-qty').value;
                record.remarks = document.getElementById('ch-remarks').value;
                record.recby = document.getElementById('ch-recby').value;
                record.delby = document.getElementById('ch-delby').value;
                record.auth = document.getElementById('ch-auth').value;
            }

            dbUsers[activeUser].vouchers.push(record);
            saveToLocalStorage();
            this.closeVoucherModal();
            this.renderVouchersTable();
            this.previewVoucherObject(record);
        },

        renderVouchersTable: function(filteredList = null) {
            const vouchers = filteredList || dbUsers[activeUser].vouchers || [];
            const tbody = document.getElementById('vouchers-table-body');
            tbody.innerHTML = '';

            vouchers.forEach((v, index) => {
                const entity = v.type === 'Challan' ? v.cname : (v.type === 'Credit Voucher' ? v.receivedFrom : v.paidTo);
                const amtOrQty = v.type === 'Challan' ? `${v.qty || 0} ${v.punit || ''}` : `${parseFloat(v.amount || 0).toFixed(2)} TK`;

                tbody.innerHTML += `
                    <tr class="text-sm">
                        <td class="p-4 font-mono font-bold text-indigo-600">${escapeHTML(v.uniqueNum)}</td>
                        <td class="p-4"><span class="px-2 py-1 rounded text-xs font-semibold ${v.type==='Challan'?'bg-amber-100 text-amber-800':(v.type==='Credit Voucher'?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800')}">${escapeHTML(v.type)}</span></td>
                        <td class="p-4">${escapeHTML(v.date)}</td>
                        <td class="p-4">${escapeHTML(entity)}</td>
                        <td class="p-4 font-bold">${escapeHTML(amtOrQty)}</td>
                        <td class="p-4 text-center space-x-2">
                            <button onclick="POSApp.previewVoucherByIndex(${index})" class="text-indigo-600 font-semibold hover:underline">👁 View</button>
                            <button onclick="POSApp.deleteVoucher(${index})" class="text-red-500 font-semibold hover:underline">Delete</button>
                        </td>
                    </tr>
                `;
            });

            if (vouchers.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No vouchers or challans found.</td></tr>`;
            }
        },

        filterVouchers: function() {
            const searchNum = document.getElementById('voucher-search-num').value.trim().toLowerCase();
            const filterType = document.getElementById('voucher-filter-type').value;
            const searchDate = document.getElementById('voucher-search-date').value;

            const allVouchers = dbUsers[activeUser].vouchers || [];
            const filtered = allVouchers.filter(v => {
                const matchNum = searchNum === '' || v.uniqueNum.toLowerCase().includes(searchNum);
                const matchType = filterType === 'All' || v.type === filterType;
                const matchDate = searchDate === '' || v.date === searchDate;
                return matchNum && matchType && matchDate;
            });

            this.renderVouchersTable(filtered);
        },

        previewVoucherByIndex: function(index) {
            const v = dbUsers[activeUser].vouchers[index];
            if (v) this.previewVoucherObject(v);
        },

        previewVoucherObject: function(v) {
            document.getElementById('pv-business-name').innerText = v.businessName;
            document.getElementById('pv-voucher-title').innerText = v.type;
            document.getElementById('pv-voucher-number').innerText = v.uniqueNum;
            document.getElementById('pv-date').innerText = v.date;

            // Load Shop Logo reliably
            const logoElement = document.getElementById('pv-shop-logo');
            if (activeUser && dbUsers[activeUser] && dbUsers[activeUser].dp) {
                logoElement.src = dbUsers[activeUser].dp;
                logoElement.classList.remove('hidden');
            } else {
                logoElement.classList.add('hidden');
            }

            const grid = document.getElementById('pv-details-grid');
            grid.innerHTML = '';

            if (v.type === 'Credit Voucher') {
                document.getElementById('pv-amount-label').innerText = 'Received Amount:';
                document.getElementById('pv-amount-value').innerText = `${parseFloat(v.amount || 0).toFixed(2)} TK`;
                document.getElementById('pv-amount-words').innerText = v.words || '-';
                grid.innerHTML = `
                    <div><strong>Received From:</strong> ${escapeHTML(v.receivedFrom)}</div>
                    <div><strong>Account Name:</strong> ${escapeHTML(v.accountName)}</div>
                    <div><strong>Payment Method:</strong> ${escapeHTML(v.paymentMethod)}</div>
                    <div><strong>Reference:</strong> ${escapeHTML(v.ref)}</div>
                    <div class="col-span-2"><strong>Narration:</strong> ${escapeHTML(v.desc)}</div>
                `;
            } else if (v.type === 'Debit Voucher') {
                document.getElementById('pv-amount-label').innerText = 'Paid Amount:';
                document.getElementById('pv-amount-value').innerText = `${parseFloat(v.amount || 0).toFixed(2)} TK`;
                document.getElementById('pv-amount-words').innerText = v.words || '-';
                grid.innerHTML = `
                    <div><strong>Paid To:</strong> ${escapeHTML(v.paidTo)}</div>
                    <div><strong>Account Name:</strong> ${escapeHTML(v.accountName)}</div>
                    <div><strong>Expense Category:</strong> ${escapeHTML(v.expCat)}</div>
                    <div><strong>Payment Method:</strong> ${escapeHTML(v.paymentMethod)}</div>
                    <div><strong>Reference:</strong> ${escapeHTML(v.ref)}</div>
                    <div class="col-span-2"><strong>Narration:</strong> ${escapeHTML(v.desc)}</div>
                `;
            } else {
                document.getElementById('pv-amount-label').innerText = 'Total Quantity:';
                document.getElementById('pv-amount-value').innerText = `${v.qty} ${v.punit}`;
                document.getElementById('pv-amount-words').innerText = `Status: ${v.status}`;
                grid.innerHTML = `
                    <div><strong>Customer Name:</strong> ${escapeHTML(v.cname)} (${v.cphone})</div>
                    <div><strong>Customer Address:</strong> ${escapeHTML(v.caddr)}</div>
                    <div><strong>Delivery Address:</strong> ${escapeHTML(v.daddr)}</div>
                    <div><strong>Ref Invoice:</strong> ${escapeHTML(v.inv)}</div>
                    <div><strong>Product:</strong> ${escapeHTML(v.pname)} [${v.psku}]</div>
                    <div><strong>Vehicle / Person:</strong> ${escapeHTML(v.vehicle)} / ${escapeHTML(v.dperson)}</div>
                    <div class="col-span-2"><strong>Remarks:</strong> ${escapeHTML(v.remarks)}</div>
                `;
            }

            document.getElementById('pv-prepared').innerText = `Prepared By: ${v.prep || v.recby || 'N/A'}`;
            document.getElementById('pv-authorized').innerText = `Authorized By: ${v.auth || 'N/A'}`;
            document.getElementById('pv-signature').innerText = 'Signature / Stamp';

            document.getElementById('voucher-preview-modal').classList.remove('hidden');
        },

        closeVoucherPreview: function() {
            document.getElementById('voucher-preview-modal').classList.add('hidden');
        },

        // 🖨️ Safe Printable Engine via Hidden Iframe (Does not mess up main DOM)
        printVoucher: function() {
            const printContent = document.getElementById('printable-voucher-box').outerHTML;
            
            let printFrame = document.getElementById('print-iframe');
            if (!printFrame) {
                printFrame = document.createElement('iframe');
                printFrame.id = 'print-iframe';
                printFrame.style.position = 'absolute';
                printFrame.style.top = '-9999px';
                printFrame.style.left = '-9999px';
                document.body.appendChild(printFrame);
            }

            const frameDoc = printFrame.contentWindow || printFrame.contentDocument.document || printFrame.contentDocument;
            frameDoc.document.open();
            frameDoc.document.write(`
                <html>
                    <head>
                        <title>Print Voucher</title>
                        <script src="https://cdn.tailwindcss.com"></script>
                        <style>
                            body { font-family: 'Inter', sans-serif; padding: 20px; }
                        </style>
                    </head>
                    <body>
                        ${printContent}
                    </body>
                </html>
            `);
            frameDoc.document.close();

            setTimeout(() => {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
            }, 500);
        },

        // 📥 PDF Generation Engine
        downloadVoucherPDF: function() {
            const element = document.getElementById('printable-voucher-box');
            const opt = {
                margin:       10,
                filename:     'Voucher_Challan.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, allowTaint: true },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            if (typeof html2pdf !== 'undefined') {
                html2pdf().set(opt).from(element).save();
            } else {
                alert('PDF Generator library is loading. Please try again in 2 seconds.');
            }
        },

        deleteVoucher: function(index) {
            if (confirm('Are you sure you want to delete this record?')) {
                dbUsers[activeUser].vouchers.splice(index, 1);
                saveToLocalStorage();
                this.renderVouchersTable();
            }
        },

        /* POS CORE LOGIC */
        updatePOSUnitDisplay: function() {
            const select = document.getElementById('bill-product-select');
            const badge = document.getElementById('pos-unit-badge');
            if (select.value === "") { badge.innerText = "Unit"; return; }
            badge.innerText = dbUsers[activeUser].inventory[select.value].unit;
            this.calculateLivePOSBreakdown();
        },

        calculateLivePOSBreakdown: function() {
            const select = document.getElementById('bill-product-select');
            const qty = parseFloat(document.getElementById('bill-qty-input').value) || 0;
            const panel = document.getElementById('live-calculation-panel');
            if (select.value === "" || qty <= 0) { panel.classList.add('hidden'); return; }
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
            this.executeAddToCartProcessing(select.value, qty);
            document.getElementById('bill-qty-input').value = '';
            select.value = '';
        },

        executeAddToCartProcessing: function(invIndex, quantitativeVolume) {
            const item = dbUsers[activeUser].inventory[invIndex];
            if (!item) return;

            if (quantitativeVolume > item.qty) { 
                alert(`Insufficient stock level inside [${item.name}]!`); 
                return; 
            }

            let finalUnitPrice = (item.sell - item.discount) * (1 + (item.vat / 100));
            const cartIndex = cart.findIndex(c => c.inventoryIndex == invIndex);
            
            if (cartIndex > -1) {
                if ((cart[cartIndex].qty + quantitativeVolume) > item.qty) { 
                    alert("Cumulative value exceeds available stock level."); 
                    return; 
                }
                cart[cartIndex].qty += quantitativeVolume;
                cart[cartIndex].total = cart[cartIndex].qty * finalUnitPrice;
            } else {
                cart.push({
                    inventoryIndex: invIndex, name: item.name, qty: quantitativeVolume, unit: item.unit,
                    price: finalUnitPrice, rawSell: item.sell, rawDiscount: item.discount, rawVat: item.vat,
                    gift: item.gift, total: quantitativeVolume * finalUnitPrice
                });
            }
            this.renderCart();
            document.getElementById('live-calculation-panel').classList.add('hidden');
        },

        initBarcodeScannerListener: function() {
            const self = this;
            window.addEventListener('keydown', function(e) {
                if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
                    if (document.activeElement.id === 'reg-otp-input' || document.activeElement.id === 'forgot-otp-input') return;
                }

                const currentTime = Date.now();
                if (currentTime - lastKeyTime > 50) barcodeBuffer = '';
                lastKeyTime = currentTime;

                if (e.key === 'Enter') {
                    if (barcodeBuffer.length >= 3) {
                        self.processHardwareScannerStroke(barcodeBuffer.trim());
                        barcodeBuffer = '';
                        e.preventDefault();
                    }
                } else if (e.key.length === 1) {
                    barcodeBuffer += e.key;
                }
            });
        },

        processHardwareScannerStroke: function(scannedSkuCode) {
            if (!activeUser || !dbUsers[activeUser]) return;
            const inventory = dbUsers[activeUser].inventory || [];
            const index = inventory.findIndex(item => item.barcode === scannedSkuCode);

            if (index === -1) {
                alert(`Scanned SKU/Barcode [${scannedSkuCode}] not found in inventory!`);
                return;
            }

            this.executeAddToCartProcessing(index, 1);
            playBeepSound();
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
                        <td class="p-4"><strong>${escapeHTML(item.name)}</strong><br><span class="text-xs text-emerald-600">${item.gift ? '🎁 '+escapeHTML(item.gift) : ''}</span></td>
                        <td class="p-4">${item.qty} ${escapeHTML(item.unit)}</td>
                        <td class="p-4">${item.rawSell.toFixed(2)} TK</td>
                        <td class="p-4">-${item.rawDiscount.toFixed(2)}TK / +${item.rawVat}%</td>
                        <td class="p-4 font-bold text-indigo-600">${item.total.toFixed(2)} TK</td>
                        <td class="p-4 text-center"><button onclick="POSApp.removeFromCart(${index})" class="text-red-500 font-semibold hover:underline">Remove</button></td>
                    </tr>`;
            });

            if(cart.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">Your cart is empty. Scan barcode directly from your scanner hardware!</td></tr>`;
            }

            document.getElementById('cart-item-count').innerText = `${cart.length} Items`;
            document.getElementById('summary-items-qty').innerText = totalQty;
            document.getElementById('summary-discount').innerText = `${totalDiscount.toFixed(2)} TK`;
            document.getElementById('summary-vat').innerText = `${totalVat.toFixed(2)} TK`;
            document.getElementById('summary-total').innerText = `${grandTotal.toFixed(2)} TK`;
            
            if(document.getElementById('bill-receive-status').value === 'Paid') {
                document.getElementById('bill-paid-input').value = grandTotal.toFixed(2);
            }
        },

        removeFromCart: function(index) {
            cart.splice(index, 1);
            this.renderCart();
        },

        renderInventory: function() {
            const items = dbUsers[activeUser].inventory || [];
            const tbody = document.getElementById('inventory-table-body');
            tbody.innerHTML = '';
            
            const select = document.getElementById('bill-product-select');
            select.innerHTML = '<option value="">Select Product Manually</option>';

            items.forEach((item, index) => {
                const threshold = item.minStock || 5;
                const isLowStock = item.qty <= threshold;

                select.innerHTML += `<option value="${index}">${escapeHTML(item.name)} (${item.qty} ${escapeHTML(item.unit)})</option>`;
                
                tbody.innerHTML += `
                    <tr class="text-sm ${isLowStock ? 'bg-rose-50/50' : ''}">
                        <td class="p-4">
                            <strong>${escapeHTML(item.name)}</strong>
                            <br><span class="text-xs text-slate-400 font-mono">SKU: ${escapeHTML(item.barcode)}</span>
                            ${isLowStock ? '<span class="ml-2 bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded text-[10px]">LOW STOCK</span>' : ''}
                        </td>
                        <td class="p-4"><span class="${isLowStock ? 'text-rose-600 font-bold' : 'text-slate-700'}">${item.qty} ${escapeHTML(item.unit)}</span></td>
                        <td class="p-4">${item.buy.toFixed(2)} TK</td>
                        <td class="p-4 font-semibold text-indigo-600">${item.sell.toFixed(2)} TK</td>
                        <td class="p-4 text-red-500">-${item.discount.toFixed(2)} TK</td>
                        <td class="p-4 text-amber-500">+${item.vat}%</td>
                        <td class="p-4 text-emerald-600">${escapeHTML(item.gift) || '-'}</td>
                        <td class="p-4 text-center">
                            <div class="flex flex-col items-center bg-white p-1 rounded border border-slate-100">
                                <svg id="barcode-${item.barcode}"></svg>
                                <button onclick="POSApp.downloadBarcodeImage('${item.barcode}')" class="text-[11px] text-indigo-600 mt-1 hover:underline font-bold">📥 Download</button>
                            </div>
                        </td>
                        <td class="p-4 text-center">
                            <button onclick="POSApp.deleteInventoryItem(${index})" class="text-red-500 font-semibold hover:underline">Delete</button>
                        </td>
                    </tr>`;
                
                setTimeout(() => {
                    JsBarcode(`#barcode-${item.barcode}`, item.barcode, { format: "CODE128", width: 1.1, height: 28, displayValue: false });
                }, 10);
            });

            if(items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400">No products inside the inventory database.</td></tr>`;
            }

            this.checkLowStockAlerts();
        },

        checkLowStockAlerts: function() {
            if (!activeUser || !dbUsers[activeUser]) return;
            const items = dbUsers[activeUser].inventory || [];
            const lowStockItems = items.filter(item => item.qty <= (item.minStock || 5));
            const banner = document.getElementById('low-stock-alert-banner');
            const msgElement = document.getElementById('low-stock-alert-message');

            if (banner && msgElement) {
                if (lowStockItems.length > 0) {
                    banner.classList.remove('hidden');
                    const itemNames = lowStockItems.map(i => `${i.name} (${i.qty} ${i.unit})`).join(', ');
                    msgElement.innerText = `${lowStockItems.length} item(s) running low: ${itemNames}`;
                } else {
                    banner.classList.add('hidden');
                }
            }
        },

        deleteInventoryItem: function(index) {
            if (confirm('Are you sure you want to delete this product?')) {
                dbUsers[activeUser].inventory.splice(index, 1);
                saveToLocalStorage();
                this.renderInventory();
            }
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
            const minStock = parseFloat(document.getElementById('inv-min-stock').value) || 5;

            if (!name || isNaN(qty) || isNaN(buy) || isNaN(sell)) { 
                alert('Fill out required fields accurately!'); 
                return; 
            }
            const barcode = skuInput ? skuInput : "SKU" + Math.floor(10000 + Math.random() * 90000);

            dbUsers[activeUser].inventory.push({ name, qty, unit, buy, sell, discount, vat, gift, barcode, minStock });
            saveToLocalStorage();
            this.renderInventory();
            
            document.getElementById('inv-name').value = ''; 
            document.getElementById('inv-sku').value = ''; 
            document.getElementById('inv-qty').value = '';
            document.getElementById('inv-buy').value = ''; 
            document.getElementById('inv-sell').value = '';
            document.getElementById('inv-discount').value = '0'; 
            document.getElementById('inv-vat').value = '0'; 
            document.getElementById('inv-gift').value = '';
            document.getElementById('inv-min-stock').value = '5';
        },

        downloadBarcodeImage: function(barcodeValue) {
            const svg = document.getElementById(`barcode-${barcodeValue}`);
            if(!svg) return;
            const svgString = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
            
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();
            
            img.onload = function() {
                canvas.width = img.width + 20;
                canvas.height = img.height + 30;
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 10, 10);
                
                ctx.fillStyle = "black";
                ctx.font = "bold 12px monospace";
                ctx.textAlign = "center";
                ctx.fillText(barcodeValue, canvas.width / 2, canvas.height - 8);
                
                const a = document.createElement("a");
                a.download = `Barcode-${barcodeValue}.png`;
                a.href = canvas.toDataURL("image/png");
                a.click();
            };
            img.src = URL.createObjectURL(svgBlob);
        },

        processFinalInvoice: function() {
            if (cart.length === 0) { alert('Cart is currently empty!'); return; }
            const payMethod = document.getElementById('bill-pay-method').value;
            const receiveStatus = document.getElementById('bill-receive-status').value;
            let paidAmount = parseFloat(document.getElementById('bill-paid-input').value) || 0;
            const totalBill = cart.reduce((sum, item) => sum + item.total, 0);

            if (receiveStatus === 'Unpaid') paidAmount = 0;
            const dueAmount = Math.max(0, totalBill - paidAmount);

            cart.forEach(item => { 
                if(dbUsers[activeUser].inventory[item.inventoryIndex]) {
                    dbUsers[activeUser].inventory[item.inventoryIndex].qty -= item.qty; 
                }
            });

            const newStatement = {
                date: new Date().toLocaleString().split(',')[0], total: totalBill, paid: paidAmount, due: dueAmount,
                method: receiveStatus === 'Unpaid' ? 'Unpaid Ledger' : payMethod
            };
            dbUsers[activeUser].statements.push(newStatement);
            saveToLocalStorage();

            const shopProfile = dbUsers[activeUser];
            document.getElementById('bill-shop-name').innerText = shopProfile.company;
            document.getElementById('bill-shop-cat').innerText = shopProfile.category || "Retail Counter";
            document.getElementById('bill-shop-address').innerText = shopProfile.address || "";
            document.getElementById('bill-shop-helpline').innerText = shopProfile.helpline ? `Helpline: ${shopProfile.helpline}` : "";
            document.getElementById('bill-date').innerText = newStatement.date;
            document.getElementById('bill-payment-type').innerText = newStatement.method;

            const tbody = document.getElementById('bill-items-body');
            tbody.innerHTML = '';
            let totalDiscountCalculated = 0, totalVatCalculated = 0;

            cart.forEach(item => {
                totalDiscountCalculated += (item.rawDiscount * item.qty);
                totalVatCalculated += ((item.rawSell - item.rawDiscount) * (item.rawVat / 100) * item.qty);
                tbody.innerHTML += `
                    <tr class="border-b border-slate-200">
                        <td class="py-1 text-left">${escapeHTML(item.name)}<br><span class="text-[9px] text-slate-500">${item.gift ? '*Gift: '+escapeHTML(item.gift) : ''}</span></td>
                        <td class="py-1 text-right">${item.qty} ${escapeHTML(item.unit)}</td>
                        <td class="py-1 text-right">${item.rawSell.toFixed(2)}</td>
                        <td class="py-1 text-right">${item.total.toFixed(2)}</td>
                    </tr>`;
            });

            document.getElementById('bill-total-price').innerHTML = `
                <div>Total Discount: -${totalDiscountCalculated.toFixed(2)} TK</div>
                <div>Total VAT: +${totalVatCalculated.toFixed(2)} TK</div>
                <div class="text-xs font-bold text-black border-t border-dotted border-black pt-1 mt-1">Grand Total: ${totalBill.toFixed(2)} TK</div>`;
            
            document.getElementById('bill-paid-price').innerText = paidAmount.toFixed(2);
            document.getElementById('bill-due-price').innerText = dueAmount.toFixed(2);

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
