/**
 * Enterprise POS Engine Namespace
 */
const POSApp = (function() {
    // Private State Storage
    let activeUser = null;
    let dbUsers = JSON.parse(localStorage.getItem('pos_users')) || {};
    let captchaCode = '';
    let cart = [];
    let tempProfileDpBase64 = "";

    // Hardware Barcode Scan Buffer State
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    // Utility: Escape HTML to prevent XSS Security Issues
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

    // Audio Feedback Engine
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
            this.generateCaptcha();
            this.checkAutoLogin();
            this.initBarcodeScannerListener();
        },

        toggleAuth: function(showLogin) {
            document.getElementById('login-card').classList.toggle('hidden', !showLogin);
            document.getElementById('signup-card').classList.toggle('hidden', showLogin);
            if (!showLogin) this.generateCaptcha();
        },

        generateCaptcha: function() {
            const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            captchaCode = '';
            for (let i = 0; i < 4; i++) captchaCode += chars[Math.floor(Math.random() * chars.length)];
            document.getElementById('captcha-display').innerText = captchaCode;
        },

        handleSignup: function() {
            const company = document.getElementById('reg-company').value.trim();
            const category = document.getElementById('reg-category').value.trim();
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value.trim();
            const captchaInput = document.getElementById('captcha-input').value.trim().toUpperCase();

            if (!company || !username || !password) { 
                alert('Required fields cannot be left blank!'); 
                return; 
            }
            if (captchaInput !== captchaCode) { 
                alert('Captcha validation failed!'); 
                this.generateCaptcha(); 
                return; 
            }
            if (dbUsers[username]) { 
                alert('Account profile already exists.'); 
                return; 
            }

            dbUsers[username] = {
                username, password, company, category, inventory: [], statements: [],
                address: "", helpline: "", dp: ""
            };
            saveToLocalStorage();
            alert('Registration complete! Please login.');
            this.toggleAuth(true);
        },

        handleLogin: function() {
            const user = document.getElementById('login-username').value.trim();
            const pass = document.getElementById('login-password').value.trim();
            if (dbUsers[user] && dbUsers[user].password === pass) {
                activeUser = user;
                localStorage.setItem('pos_active_user', user);
                this.loadApplication();
            } else { 
                alert('Authentication credentials rejected!'); 
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
                document.getElementById('bill-shop-logo').src = userData.dp;
                document.getElementById('bill-shop-logo').classList.remove('hidden');
            } else {
                document.getElementById('sidebar-dp').classList.add('hidden');
                document.getElementById('sidebar-initial-logo').classList.remove('hidden');
                document.getElementById('sidebar-initial-logo').innerText = userData.company.substring(0, 1).toUpperCase();
                document.getElementById('profile-preview-img').src = "https://via.placeholder.com/150";
                document.getElementById('bill-shop-logo').classList.add('hidden');
            }
            document.getElementById('prof-address').value = userData.address || "";
            document.getElementById('prof-helpline').value = userData.helpline || "";

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
            dbUsers[activeUser].address = document.getElementById('prof-address').value.trim();
            dbUsers[activeUser].helpline = document.getElementById('prof-helpline').value.trim();
            if (tempProfileDpBase64) { 
                dbUsers[activeUser].dp = tempProfileDpBase64; 
            }
            saveToLocalStorage();
            alert('Profile Settings successfully operationalized!');
            this.loadApplication();
        },

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
                    if (document.activeElement.id === 'captcha-input') return;
                }

                const currentTime = Date.now();
                if (currentTime - lastKeyTime > 50) { barcodeBuffer = ''; }
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

            if (!name || isNaN(qty) || isNaN(buy) || isNaN(sell)) { 
                alert('Fill out required fields accurately!'); 
                return; 
            }
            const barcode = skuInput ? skuInput : "SKU" + Math.floor(10000 + Math.random() * 90000);

            dbUsers[activeUser].inventory.push({ name, qty, unit, buy, sell, discount, vat, gift, barcode });
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

            // Update Inventory
            cart.forEach(item => { 
                if(dbUsers[activeUser].inventory[item.inventoryIndex]) {
                    dbUsers[activeUser].inventory[item.inventoryIndex].qty -= item.qty; 
                }
            });

            const newStatement = {
                date: new Date().toLocaleString(), total: totalBill, paid: paidAmount, due: dueAmount,
                method: receiveStatus === 'Unpaid' ? 'Unpaid Ledger' : payMethod
            };
            dbUsers[activeUser].statements.push(newStatement);
            saveToLocalStorage();

            // Print Area Setup
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

// Initialize App on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
    POSApp.init();
});
