const POSApp = (function() {
    let activeUser = null;
    let dbUsers = JSON.parse(localStorage.getItem('pos_users')) || {};
    let tempSignupData = null;
    let signupGeneratedOTP = "";
    let forgotPasswordOTP = "";
    let forgotEmailAccount = "";

    return {
        init: function() {
            this.checkAutoLogin();
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

        validateStrongPassword: function(password) {
            return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
        },

        checkPasswordStrength: function(inputId, indicatorId) {
            const password = document.getElementById(inputId).value;
            const valid = this.validateStrongPassword(password);
            document.getElementById(indicatorId).innerHTML = `<div class="${valid ? 'text-emerald-600' : 'text-slate-400'}">✓ Min 8 chars, Uppercase, Lowercase & Number required</div>`;
        },

        sendEmailJS: function(toEmail, username, password, otpCode, btnId, callback) {
            const btn = document.getElementById(btnId);
            const oldText = btn.innerText;
            btn.innerText = "Sending Email via EmailJS...";
            btn.disabled = true;

            const serviceID = "service_e466jkh";[cite: 9]
            const templateID = "template_ucndyiy";[cite: 10]

            const templateParams = {
                to_email: toEmail,
                username: username,
                password: password,
                otp: otpCode
            };

            emailjs.send(serviceID, templateID, templateParams)
                .then(function(response) {
                    btn.innerText = oldText;
                    btn.disabled = false;
                    callback(true);
                }, function(error) {
                    btn.innerText = oldText;
                    btn.disabled = false;
                    console.error("EmailJS Error:", error);
                    alert("Email sending failed. Please check your EmailJS dashboard or internet connection.");
                    callback(false);
                });
        },

        initiateSignupOTP: function() {
            const company = document.getElementById('reg-company').value.trim();
            const email = document.getElementById('reg-email').value.trim().toLowerCase();
            const category = document.getElementById('reg-category').value.trim();
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value;

            if (!company || !email || !username || !password) {
                alert('Please fill out all fields!');
                return;
            }

            if (!this.validateStrongPassword(password)) {
                alert('Password does not meet requirements!');
                return;
            }

            if (dbUsers[username]) {
                alert('Username is already taken!');
                return;
            }

            tempSignupData = { company, email, category, username, password };
            signupGeneratedOTP = Math.floor(100000 + Math.random() * 900000).toString();

            // EmailJS এর মাধ্যমে সরাসরি জিমেইলে ওটিপি ও পাসওয়ার্ড পাঠানো হচ্ছে
            this.sendEmailJS(email, username, password, signupGeneratedOTP, 'btn-send-otp', (success) => {
                if (success) {
                    alert('OTP & Login credentials successfully sent to your email inbox!');
                    document.getElementById('otp-sent-email-display').innerText = email;
                    document.getElementById('signup-form-step1').classList.add('hidden');
                    document.getElementById('signup-form-step2').classList.remove('hidden');
                }
            });
        },

        verifySignupOTP: function() {
            const enteredOTP = document.getElementById('reg-otp-input').value.trim();
            if (enteredOTP !== signupGeneratedOTP) {
                alert('Invalid OTP code! Please check your email inbox.');
                return;
            }

            const { username, password, company, category, email } = tempSignupData;
            dbUsers[username] = {
                username, email, password, company, category, inventory: [], statements: []
            };

            localStorage.setItem('pos_users', JSON.stringify(dbUsers));
            alert('Account created and verified successfully! Please login.');
            tempSignupData = null;
            signupGeneratedOTP = "";
            this.showAuthScreen('login-card');
        },

        sendForgotOTP: function() {
            const email = document.getElementById('forgot-email').value.trim().toLowerCase();
            const userEntry = Object.values(dbUsers).find(u => u.email === email);

            if (!userEntry) {
                alert('No account found with this email address!');
                return;
            }

            forgotEmailAccount = email;
            forgotPasswordOTP = Math.floor(100000 + Math.random() * 900000).toString();

            this.sendEmailJS(email, userEntry.username, userEntry.password, forgotPasswordOTP, 'btn-send-forgot-otp', (success) => {
                if (success) {
                    alert('Password reset OTP sent to your email!');
                    document.getElementById('forgot-email-display').innerText = email;
                    document.getElementById('forgot-form-step1').classList.add('hidden');
                    document.getElementById('forgot-form-step2').classList.remove('hidden');
                }
            });
        },

        resetPassword: function() {
            const enteredOTP = document.getElementById('forgot-otp-input').value.trim();
            const newPassword = document.getElementById('forgot-new-password').value;

            if (enteredOTP !== forgotPasswordOTP) {
                alert('Invalid OTP code!');
                return;
            }

            const username = Object.keys(dbUsers).find(key => dbUsers[key].email === forgotEmailAccount);
            if (username && dbUsers[username]) {
                dbUsers[username].password = newPassword;
                localStorage.setItem('pos_users', JSON.stringify(dbUsers));
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
                alert('Invalid username or password!');
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
            document.getElementById('app-company-name').innerText = userData.company;
            document.getElementById('app-username').innerText = `User: ${userData.username}`;
        },

        switchTab: function(tabId) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
            document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('bg-indigo-600'));
            document.getElementById(tabId).classList.remove('hidden');
            document.getElementById(`btn-${tabId}`).classList.add('bg-indigo-600');
        }
    };
})();

window.addEventListener('DOMContentLoaded', () => {
    POSApp.init();
});
