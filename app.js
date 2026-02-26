class App {
    constructor() {
        this.transactions = [];
        this.receipts = [];
        this.currentView = 'dashboard';
        this.currentImageData = null;
        this.currentImageDate = null;
        this.hasSeenNotifs = false;

        const now = new Date();
        this.currentCalYear = now.getFullYear();
        this.currentCalMonth = now.getMonth();

        this.dirHandle = null;

        // Customization
        this.quickEntries = ['ガソリン代', '仕入高 (牛乳)', '消耗品費', '車両費'];
        this.customCategories = [];

        // --- Firebase Initial Site-Wide ID ---
        const urlParams = new URLSearchParams(window.location.search);
        this.storeId = urlParams.get('id') || 'morita_milk';

        this.db = null;
        this.initFirebase();
        this.checkAuth();
        this.init();
    }

    checkAuth() {
        // Local storage to remember login even after closing browser
        if (localStorage.getItem('isLoggedIn')) {
            document.getElementById('auth-overlay').classList.add('hidden');
        }
    }

    checkPassword() {
        const passInput = document.getElementById('auth-password');
        const errorMsg = document.getElementById('auth-error');

        // --- 設定したいパスワードをここに入力してください ---
        const correctPassword = "Hisako0728";

        if (passInput.value === correctPassword) {
            localStorage.setItem('isLoggedIn', 'true');
            document.getElementById('auth-overlay').classList.add('hidden');
            this.showToast('ログインに成功しました。');
        } else {
            errorMsg.classList.remove('hidden');
            passInput.value = "";
            passInput.focus();
        }
    }

    initFirebase() {
        // --- ⚠️ 重要 ⚠️ ---
        // ここにご自身のFirebase プロジェクト情報を貼り付けてください。
        // 未設定のままでもLocal（自分だけ）では動きます。
        const firebaseConfig = {
            apiKey: "AIzaSyCLc5DcMBA-AH_T_5UZw4UvmrDkF1NY_M",
            authDomain: "moritagyunyuu.firebaseapp.com",
            projectId: "moritagyunyuu",
            storageBucket: "moritagyunyuu.firebasestorage.app",
            messagingSenderId: "1061403006399",
            appId: "1:1061403006399:web:298771b1fc8ed3144abd0a",
            measurementId: "G-7001E59H4K"
        };

        try {
            if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
                firebase.initializeApp(firebaseConfig);
                this.db = firebase.firestore();
            }
        } catch (e) {
            console.error("Firebase Init Error:", e);
        }
    }

    init() {
        this.setupNavigation();
        this.setupDropZone();
        this.setupForm();
        this.loadData();
    }

    loadData() {
        // First try local to show something fast
        const saved = localStorage.getItem('milkKeepData');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.transactions = parsed.transactions || [];
                this.receipts = this.transactions.filter(t => t.image);
                this.hasSeenNotifs = !!parsed.hasSeenNotifs;
                this.quickEntries = parsed.quickEntries || this.quickEntries;
                this.customCategories = parsed.customCategories || this.customCategories;
                this.updateUI();
            } catch (e) {
                console.error('Local Load Error:', e);
            }
        }

        // Then, sync with Remote (Firebase)
        this.syncFromRemote();
    }

    async syncFromRemote() {
        if (!this.db) return;

        try {
            const doc = await this.db.collection('stores').doc(this.storeId).get();
            if (doc.exists) {
                const remoteData = doc.data();
                if (remoteData.transactions) {
                    this.transactions = remoteData.transactions;
                    this.receipts = this.transactions.filter(t => t.image);
                    this.hasSeenNotifs = !!remoteData.hasSeenNotifs;
                    this.quickEntries = remoteData.quickEntries || this.quickEntries;
                    this.customCategories = remoteData.customCategories || this.customCategories;

                    // Save to local for offline use
                    this.saveData(true); // pass true to skip infinite loop if exists
                    this.updateUI();
                }
            }
        } catch (e) {
            console.error("Remote Sync Load Error:", e);
        }
    }

    async saveData(isSync = false) {
        // 1. Save to Local
        try {
            localStorage.setItem('milkKeepData', JSON.stringify({
                transactions: this.transactions,
                hasSeenNotifs: this.hasSeenNotifs,
                quickEntries: this.quickEntries,
                customCategories: this.customCategories
            }));
        } catch (e) {
            console.error("Local Save Error:", e);
            this.showToast('データの保存に失敗しました。', 'error');
        }

        // 2. Save to Remote (Firebase) if not already a sync call
        if (!isSync && this.db) {
            try {
                await this.db.collection('stores').doc(this.storeId).set({
                    transactions: this.transactions,
                    hasSeenNotifs: this.hasSeenNotifs,
                    quickEntries: this.quickEntries,
                    customCategories: this.customCategories,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log("Remote Save Success: " + this.storeId);
            } catch (e) {
                console.error("Remote Save Error:", e);
            }
        }
    }

    navigate(viewId) {
        // Update DOM sections
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.add('active');

        // Update nav links
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active');
            if (nav.dataset.target === viewId) {
                nav.classList.add('active');
            }
        });

        // Update page title
        const titles = {
            'dashboard': 'ホーム',
            'receipts': 'レシート登録 (AI読み取り)',
            'transactions': '取引一覧',
            'reports': '決算・申告 (青色申告決算書)'
        };
        document.getElementById('page-title').textContent = titles[viewId] || '';

        this.currentView = viewId;
    }

    // Expose for HTML inline handlers
    navigateTo(viewId) {
        this.navigate(viewId);
    }

    clearNotifs() {
        this.hasSeenNotifs = true;
        this.saveData();
        this.renderNotifs();
        document.getElementById('notif-dropdown').classList.add('hidden');
    }

    renderNotifs() {
        if (this.hasSeenNotifs) {
            document.getElementById('notif-list').innerHTML = '<li style="text-align:center; color:#64748B; padding:1rem;">新しい通知はありません</li>';
            document.getElementById('notif-badge').style.display = 'none';
            document.getElementById('notif-count').textContent = '0';
        } else {
            // Restore default html (assuming 2 notifications in original layout)
            document.getElementById('notif-badge').style.display = 'block';
            document.getElementById('notif-count').textContent = '2';
        }
    }

    changeMonth(offset) {
        this.currentCalMonth += offset;
        if (this.currentCalMonth > 11) {
            this.currentCalMonth = 0;
            this.currentCalYear++;
        } else if (this.currentCalMonth < 0) {
            this.currentCalMonth = 11;
            this.currentCalYear--;
        }
        this.renderCalendar();
    }

    async selectSaveDirectory() {
        try {
            // Request user to select a base directory
            this.dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            this.showToast('保存先フォルダを設定しました。');
            document.getElementById('save-dir-status').textContent = '✅ 自動保存オン (サブフォルダに仕分け表示)';
            document.getElementById('save-dir-status').style.color = 'var(--success)';
        } catch (e) {
            console.error('Folder selection cancelled or failed:', e);
            if (e.name !== 'AbortError') {
                this.showToast('お使いのブラウザはフォルダ選択に対応していません。別のブラウザ(Chrome等)をお試しください。', 'error');
            }
        }
    }

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate(nav.dataset.target);
            });
        });
    }

    setupDropZone() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                this.handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.handleFileUpload(e.target.files[0]);
            }
        });
    }

    handleFileUpload(file) {
        if (!file.type.startsWith('image/')) {
            this.showToast('画像ファイルを選択してください。', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            // Get mock metadata (simulating EXIF)
            const now = new Date();
            this.currentImageDate = now.toLocaleString('ja-JP', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            // Compress image to save localStorage space
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedData = canvas.toDataURL('image/jpeg', 0.8);
                this.currentImageData = compressedData;
                this.showPreview(this.currentImageData);
                this.performRealOCR(this.currentImageData);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    showPreview(src) {
        const preview = document.getElementById('preview-image');
        preview.src = src;
        preview.classList.remove('hidden');
    }

    async performRealOCR(imageSrc) {
        const overlay = document.getElementById('processing-overlay');
        const overlayText = overlay.querySelector('p');
        overlay.classList.remove('hidden');
        overlayText.textContent = 'AIが文字を読み取っています（10秒ほどかかります）...';

        try {
            // Tesseract.js usage
            const worker = await Tesseract.createWorker('jpn');
            const ret = await worker.recognize(imageSrc);
            const text = ret.data.text;
            console.log("OCR Result:", text);

            await worker.terminate();

            this.processOCRText(text);
            this.showToast('読み取りが完了しました！内容に不備がないか確認してください。');
        } catch (e) {
            console.error("OCR Error:", e);
            this.showToast('読み取りに失敗しました。手動で入力してください。', 'error');
        } finally {
            overlay.classList.add('hidden');
        }
    }

    processOCRText(text) {
        const dateInput = document.getElementById('t-date');
        const catInput = document.getElementById('t-category');
        const amountInput = document.getElementById('t-amount');
        const memoInput = document.getElementById('t-memo');
        const hintTime = document.getElementById('hint-datetime');

        // 1. Extract Amount (Search for Yen symbol or numbers near "合計" or "税込")
        // Simple regex to find numbers that look like prices
        const amountMatch = text.replace(/,/g, '').match(/合計\s*(\d+)円?|金額\s*(\d+)円?|(\d+)\s*円/);
        if (amountMatch) {
            amountInput.value = amountMatch[1] || amountMatch[2] || amountMatch[3];
        } else {
            // Fallback: look for the largest number found in the text (often the total)
            const numbers = text.replace(/,/g, '').match(/\d{3,}/g);
            if (numbers) {
                const maxNum = Math.max(...numbers.map(n => parseInt(n)));
                if (maxNum < 1000000) amountInput.value = maxNum; // cap to avoid phone numbers etc
            }
        }

        // 2. Extract Date (YYYY/MM/DD or YY/MM/DD)
        const dateMatch = text.match(/20\d{2}[-/年]\d{1,2}[-/月]\d{1,2}/) || text.match(/\d{2}[-/月]\d{1,2}[-/日]/);
        if (dateMatch) {
            let d = dateMatch[0].replace(/[年月]/g, '-').replace(/日/g, '');
            if (d.length < 10) d = `2026-${d}`; // handle 2026-02-26 style
            dateInput.value = d;
        } else {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // 3. Category Heuristic
        if (text.includes('ENEOS') || text.includes('ガソリン') || text.includes('給油')) {
            catInput.value = '旅費交通費';
            memoInput.value = 'エネオス ガソリン代';
        } else if (text.includes('コンビニ') || text.includes('セブン') || text.includes('ローソン')) {
            catInput.value = '消耗品費';
        }

        hintTime.textContent = `撮影日時: ${this.currentImageDate}`;
    }

    fillQuickEntry(category) {
        this.navigate('receipts');
        this.resetForm();

        const catInput = document.getElementById('t-category');
        catInput.value = category;

        document.getElementById('t-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('t-memo').value = category === '仕入高 (牛乳)' ? '明治牛乳 仕入れ' : '';
    }

    resetForm() {
        document.getElementById('transaction-form').reset();
        document.getElementById('preview-image').classList.add('hidden');
        document.getElementById('preview-image').src = '';
        document.getElementById('hint-datetime').textContent = '';
        this.currentImageData = null;
        this.currentImageDate = null;
    }

    setupForm() {
        document.getElementById('transaction-form').addEventListener('submit', (e) => {
            e.preventDefault();

            const date = document.getElementById('t-date').value;
            const category = document.getElementById('t-category').value;
            const amount = parseInt(document.getElementById('t-amount').value, 10);
            const memo = document.getElementById('t-memo').value;

            if (!date || !category || !amount) return;

            const newTx = {
                id: Date.now(),
                date,
                category,
                amount,
                memo,
                type: category.includes('売上') ? 'income' : 'expense',
                image: this.currentImageData,
                imageDate: this.currentImageDate
            };

            this.transactions.unshift(newTx);
            if (newTx.image) {
                this.receipts.unshift(newTx);
                this.downloadReceiptLocally(newTx);
            }

            this.saveData();
            this.updateUI();
            this.showToast('取引を登録し、レシート画像を保存しました。');
            this.resetForm();
            this.navigate('transactions');
        });
    }

    async downloadReceiptLocally(tx) {
        // [YYYY, MM, DD]
        const [year, month, day] = tx.date.split('-');
        const folderName = `${year}${month}`; // e.g., 202602
        const filename = `${year}${month}${day}_${tx.category}_${tx.amount}円.jpg`;

        if (this.dirHandle) {
            await this.saveDirectToFileSystem(tx, folderName, filename);
        } else {
            this.fallbackDownload(tx, folderName, filename);
        }
    }

    async saveDirectToFileSystem(tx, folderName, filename) {
        try {
            // Get or create the YYYYMM subfolder
            const monthDirHandle = await this.dirHandle.getDirectoryHandle(folderName, { create: true });

            // Create the file
            const fileHandle = await monthDirHandle.getFileHandle(filename, { create: true });

            // Create writable stream
            const writable = await fileHandle.createWritable();

            // Convert base64 data to Blob
            const response = await fetch(tx.image);
            const blob = await response.blob();

            // Write and close file
            await writable.write(blob);
            await writable.close();

            this.showToast(`${folderName} フォルダ内に画像保存しました！`);
        } catch (e) {
            console.error('File System Access API failed', e);
            // Fallback if writing failed (e.g. permission lost)
            this.fallbackDownload(tx, folderName, filename);
        }
    }

    fallbackDownload(tx, folderName, filename) {
        // Browser will download it straight to their Downloads folder
        const a = document.createElement('a');
        a.href = tx.image;
        a.download = `MILK_KEEP_${folderName}_${filename}`; // Prefix with folder name to indicate intent
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.showToast(`${filename} をダウンロードしました。保存先を選んで自動仕分けも可能です。`);
    }

    deleteTransaction(id) {
        if (!confirm('この取引を削除してもよろしいですか？')) return;

        this.transactions = this.transactions.filter(t => t.id !== id);
        this.receipts = this.transactions.filter(t => t.image);
        this.saveData();
        this.updateUI();
        this.showToast('取引を削除しました。');
    }

    updateUI() {
        this.renderKPIs();
        this.renderRecentTransactions();
        this.renderTransactionsTable();
        this.renderReceiptGallery();
        this.renderCalendar();
        this.renderCharts();
        this.renderReportPreview();
        this.renderNotifs();
        this.renderQuickEntries();
        this.renderCategories();
    }

    // --- Customization Logic ---
    renderQuickEntries() {
        const grid = document.getElementById('quick-action-grid');
        const list = document.getElementById('quick-entry-list');
        if (!grid) return;

        // Icons map
        const icons = {
            'ガソリン代': 'ph-gas-pump',
            '仕入高 (牛乳)': 'ph-package',
            '消耗品費': 'ph-shopping-cart',
            '車両費': 'ph-car'
        };

        grid.innerHTML = '';
        list.innerHTML = '';

        this.quickEntries.forEach(entry => {
            const icon = icons[entry] || 'ph-tag';
            // Grid buttons
            grid.innerHTML += `
                <button class="quick-btn" onclick="window.app.fillQuickEntry('${entry}')">
                    <i class="ph ${icon}"></i>
                    <span>${entry}</span>
                </button>
            `;
            // Manager items
            list.innerHTML += `
                <div class="manager-item">
                    <span>${entry}</span>
                    <button class="icon-btn text-danger" onclick="window.app.removeQuickEntry('${entry}')">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
            `;
        });
    }

    toggleQuickEntryManager() {
        const mgr = document.getElementById('quick-entry-manager');
        mgr.classList.toggle('hidden');
    }

    addQuickEntry() {
        const input = document.getElementById('new-quick-name');
        const name = input.value.trim();
        if (!name) return;
        if (this.quickEntries.includes(name)) {
            this.showToast('既に追加されています。', 'error');
            return;
        }
        this.quickEntries.push(name);
        input.value = '';
        this.saveData();
        this.renderQuickEntries();
        this.showToast('ボタンを追加しました。');
    }

    removeQuickEntry(name) {
        this.quickEntries = this.quickEntries.filter(e => e !== name);
        this.saveData();
        this.renderQuickEntries();
    }

    renderCategories() {
        const optgroup = document.getElementById('expense-optgroup');
        const list = document.getElementById('custom-category-list');
        if (!optgroup) return;

        // 1. Update Dropdown
        const defaults = ['仕入高', '旅費交通費', '車両費', '消耗品費', '通信費', '接待交際費'];
        let html = '';
        defaults.forEach(cat => {
            html += `<option value="${cat}">${cat}</option>`;
        });
        this.customCategories.forEach(cat => {
            html += `<option value="${cat}">${cat} (カスタム)</option>`;
        });
        optgroup.innerHTML = html;

        // 2. Update Manager List
        if (list) {
            list.innerHTML = '';
            this.customCategories.forEach(cat => {
                list.innerHTML += `
                    <div class="manager-item">
                        <span>${cat}</span>
                        <button type="button" class="icon-btn text-danger" onclick="window.app.removeCustomCategory('${cat}')">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                `;
            });
            if (this.customCategories.length === 0) {
                list.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); padding: 8px;">カスタム項目はありません。</p>';
            }
        }
    }

    toggleCategoryManager() {
        const mgr = document.getElementById('category-manager');
        if (mgr) mgr.classList.toggle('hidden');
    }

    removeCustomCategory(name) {
        if (confirm(`「${name}」を削除してもよろしいですか？`)) {
            this.customCategories = this.customCategories.filter(c => c !== name);
            this.saveData();
            this.renderCategories();
            this.showToast('項目を削除しました。');
        }
    }

    addNewCategoryPrompt() {
        const name = prompt('追加したい勘定項目名を入力してください:');
        if (name && name.trim()) {
            const trimmed = name.trim();
            if (this.customCategories.includes(trimmed)) {
                alert('その項目は既に存在します。');
                return;
            }
            this.customCategories.push(trimmed);
            this.saveData();
            this.renderCategories();
            this.showToast('勘定項目を追加しました。');
        }
    }

    renderReportPreview() {
        const year = this.currentCalYear; // or a specific year selector, default to current
        const yearlyTxs = this.transactions.filter(t => t.date.startsWith(`${year}-`));

        // Sums
        let sales = 0;
        let purchases = 0;
        let transport = 0;
        let communication = 0;
        let entertainment = 0;
        let supplies = 0;
        let vehicle = 0;
        let otherExpenses = 0;

        yearlyTxs.forEach(tx => {
            if (tx.type === 'income') {
                sales += tx.amount;
            } else {
                switch (tx.category) {
                    case '仕入高': purchases += tx.amount; break;
                    case '旅費交通費': transport += tx.amount; break;
                    case '通信費': communication += tx.amount; break;
                    case '接待交際費': entertainment += tx.amount; break;
                    case '消耗品費': supplies += tx.amount; break;
                    case '車両費': vehicle += tx.amount; break;
                    default: otherExpenses += tx.amount; break;
                }
            }
        });

        const gross = sales - purchases;
        const totalExpenses = transport + communication + entertainment + supplies + vehicle + otherExpenses;
        const netIncome = gross - totalExpenses;

        // Update DOM if elements exist
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = `¥${val.toLocaleString()}`;
        };

        setVal('rep-sales', sales);
        setVal('rep-purchases', purchases);
        setVal('rep-gross', gross);
        setVal('rep-transport', transport);
        setVal('rep-communication', communication);
        setVal('rep-entertainment', entertainment);
        setVal('rep-supplies', supplies);
        setVal('rep-vehicle', vehicle);
        setVal('rep-total-expenses', totalExpenses);
        setVal('rep-net-income', netIncome);
    }

    renderKPIs() {
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7); // yyyy-mm

        // Filter transactions for current month
        const monthlyTxs = this.transactions.filter(t => t.date.startsWith(currentMonth));

        let income = 0;
        let expense = 0;

        monthlyTxs.forEach(tx => {
            if (tx.type === 'income') {
                income += tx.amount;
            } else if (tx.type === 'expense') {
                expense += tx.amount;
            }
        });

        const profit = income - expense;

        document.getElementById('kpi-income').textContent = `¥${income.toLocaleString()}`;
        document.getElementById('kpi-expense').textContent = `¥${expense.toLocaleString()}`;
        document.getElementById('kpi-profit').textContent = `¥${profit.toLocaleString()}`;
    }

    renderCalendar() {
        const calendarEl = document.getElementById('calendar-grid');
        if (!calendarEl) return;

        const year = this.currentCalYear;
        const month = this.currentCalMonth;
        const now = new Date(); // for checking actual today

        document.getElementById('calendar-month').textContent = `${year}年 ${month + 1}月`;

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay(); // 0 (Sun) to 6 (Sat)

        let html = '';

        // Blank leading days
        for (let i = 0; i < startingDay; i++) {
            html += `<div class="calendar-day empty"></div>`;
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

            // Find transactions on this day
            const dayTxs = this.transactions.filter(t => t.date === dateStr);
            let indicators = '';

            if (dayTxs.length > 0) {
                let hasIncome = false;
                let hasExpense = false;

                dayTxs.forEach(t => {
                    if (t.type === 'income') hasIncome = true;
                    if (t.type === 'expense') hasExpense = true;
                });

                if (hasIncome) indicators += `<div class="cal-dot income"></div>`;
                if (hasExpense) indicators += `<div class="cal-dot expense"></div>`;
            }

            const isToday = dateStr === now.toISOString().split('T')[0] ? 'today' : '';

            html += `
                <div class="calendar-day ${isToday}">
                    <span class="day-num">${d}</span>
                    <div class="cal-dots">${indicators}</div>
                </div>
            `;
        }

        calendarEl.innerHTML = html;
    }

    renderRecentTransactions() {
        const list = document.getElementById('home-recent-list');
        list.innerHTML = '';

        const recent = this.transactions.slice(0, 5);
        if (recent.length === 0) {
            list.innerHTML = '<li style="color:#64748B;">最近の取引はありません</li>';
            return;
        }

        recent.forEach(tx => {
            const isIncome = tx.type === 'income';
            list.innerHTML += `
                <li>
                    <div class="t-info">
                        <div class="t-icon">
                            <i class="ph ${isIncome ? 'ph-arrow-down-left text-success' : 'ph-arrow-up-right text-danger'}"></i>
                        </div>
                        <div class="t-details">
                            <span class="t-title">${tx.category} ${tx.memo ? `- ${tx.memo}` : ''}</span>
                            <span class="t-date">${tx.date}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <span class="t-amount ${tx.type}">
                            ${isIncome ? '+' : '-'}¥${tx.amount.toLocaleString()}
                        </span>
                        <button class="icon-btn tooltip text-muted" onclick="window.app.deleteTransaction(${tx.id})" title="削除">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </li>
            `;
        });
    }

    renderTransactionsTable() {
        const tbody = document.getElementById('transactions-tbody');
        tbody.innerHTML = '';

        this.transactions.forEach(tx => {
            const hasImage = tx.image ? `<img src="${tx.image}" class="thumb" alt="レシート">` : '<span style="color:#CBD5E1;">-</span>';
            const incomeStr = tx.type === 'income' ? `¥${tx.amount.toLocaleString()}` : '-';
            const expenseStr = tx.type === 'expense' ? `¥${tx.amount.toLocaleString()}` : '-';

            tbody.innerHTML += `
                <tr>
                    <td>${tx.date}</td>
                    <td><span class="gallery-category">${tx.category}</span></td>
                    <td>${tx.memo}</td>
                    <td class="text-success fw-bold">${incomeStr}</td>
                    <td class="text-danger fw-bold">${expenseStr}</td>
                    <td>${hasImage}</td>
                    <td>
                        <button class="btn btn-outline" style="padding: 4px 8px; color: var(--danger); border-color: var(--danger);" onclick="window.app.deleteTransaction(${tx.id})">
                            <i class="ph ph-trash"></i> 削除
                        </button>
                    </td>
                </tr>
            `;
        });
    }

    renderReceiptGallery() {
        const grid = document.getElementById('receipt-gallery-grid');
        grid.innerHTML = '';

        if (this.receipts.length === 0) {
            grid.innerHTML = '<p style="color:#64748B;">まだアップロードされたレシートはありません。</p>';
            return;
        }

        this.receipts.forEach(rcpt => {
            grid.innerHTML += `
                <div class="gallery-item">
                    <span class="timestamp-badge">撮影: ${rcpt.imageDate || rcpt.date}</span>
                    <img src="${rcpt.image}" class="gallery-img" alt="レシート">
                    <div class="gallery-info">
                        <span class="gallery-date">${rcpt.date}</span>
                        <div class="gallery-amount">¥${rcpt.amount.toLocaleString()}</div>
                        <span class="gallery-category">${rcpt.category}</span>
                    </div>
                </div>
            `;
        });
    }

    showToast(msg, type = 'success') {
        const toast = document.getElementById('toast');
        const icon = toast.querySelector('i');

        toast.querySelector('#toast-message').textContent = msg;

        if (type === 'error') {
            toast.style.borderLeftColor = 'var(--danger)';
            icon.className = 'ph ph-x-circle text-danger';
        } else {
            toast.style.borderLeftColor = 'var(--success)';
            icon.className = 'ph ph-check-circle text-success';
        }

        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    renderCharts() {
        // Destroy existing charts if they exist (to avoid memory leaks / overlaps when redrawing)
        if (this.expenseChart) this.expenseChart.destroy();
        if (this.barChart) this.barChart.destroy();

        const pieCtx = document.getElementById('expensePieChart');
        const barCtx = document.getElementById('monthlyBarChart');
        if (!pieCtx || !barCtx) return;

        // 1. Prepare data for Pie Chart (Expenses by Category)
        const expenseTxs = this.transactions.filter(t => t.type === 'expense');
        const categoryTotals = {};
        expenseTxs.forEach(t => {
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
        });
        const pieLabels = Object.keys(categoryTotals);
        const pieData = Object.values(categoryTotals);

        // 2. Prepare data for Bar Chart (Income vs Expense over months)
        const monthlyData = {};
        this.transactions.forEach(t => {
            const m = t.date.substring(0, 7); // yyyy-mm
            if (!monthlyData[m]) monthlyData[m] = { income: 0, expense: 0 };
            if (t.type === 'income') monthlyData[m].income += t.amount;
            else monthlyData[m].expense += t.amount;
        });

        // Sort months ascending
        const sortedMonths = Object.keys(monthlyData).sort();
        const incomes = sortedMonths.map(m => monthlyData[m].income);
        const expenses = sortedMonths.map(m => monthlyData[m].expense);

        // Chart defaults
        Chart.defaults.font.family = "'Outfit', 'M PLUS Rounded 1c', sans-serif";

        this.expenseChart = new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: pieLabels.length ? pieLabels : ['データなし'],
                datasets: [{
                    data: pieData.length ? pieData : [1],
                    backgroundColor: ['#F87171', '#60A5FA', '#FBBF24', '#34D399', '#A78BFA', '#FBB6CE', '#E5E7EB']
                }]
            },
            options: { maintainAspectRatio: false }
        });

        this.barChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: sortedMonths.length ? sortedMonths : ['データなし'],
                datasets: [
                    { label: '売上 (収入)', data: incomes, backgroundColor: '#34D399' },
                    { label: '経費 (支出)', data: expenses, backgroundColor: '#F87171' }
                ]
            },
            options: {
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    loadMockData() {
        // Load initial mock transactions related to milk delivery
        this.transactions = [
            { id: 1, date: '2026-02-25', category: '車両費', amount: 5400, memo: 'ガソリン代', type: 'expense', image: null },
            { id: 2, date: '2026-02-23', category: '売上高', amount: 45000, memo: 'A地区 集金', type: 'income', image: null },
            { id: 3, date: '2026-02-20', category: '仕入高', amount: 120000, memo: '明治乳業 仕入れ', type: 'expense', image: null },
            { id: 4, date: '2026-02-18', category: '消耗品費', amount: 3500, memo: '保冷剤・梱包材', type: 'expense', image: null },
            { id: 5, date: '2026-02-15', category: '通信費', amount: 8000, memo: '携帯電話代', type: 'expense', image: null }
        ];
        this.updateUI();
    }

    // --- Backup & Restore ---
    exportBackup() {
        const dataStr = JSON.stringify({ transactions: this.transactions });
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');

        const a = document.createElement('a');
        a.href = url;
        a.download = `milk_keep_backup_${now.getFullYear()}${mm}${dd}.json`;
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('バックアップデータをダウンロードしました。');
    }

    importBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (parsed && Array.isArray(parsed.transactions)) {
                    this.transactions = parsed.transactions;
                    this.receipts = this.transactions.filter(t => t.image);
                    this.saveData();
                    this.updateUI();

                    this.showToast('データを復元 (引き継ぎ) しました！');

                    // Reset input so it can be used again
                    event.target.value = '';
                } else {
                    throw new Error('Invalid format');
                }
            } catch (err) {
                console.error('Import Error:', err);
                this.showToast('データファイルの形式が正しくありません。', 'error');
            }
        };
        reader.readAsText(file);
    }

    // --- CSV Export (Excel Compatible) ---
    exportCSV() {
        if (this.transactions.length === 0) {
            this.showToast('出力する取引データがありません。', 'error');
            return;
        }

        // CSV Header
        let csvContent = '取引日,勘定科目,摘要,金額(円),収支区分\n';

        // Add Transactions
        // Sort chronologically if needed, or keep current order (newest first)
        this.transactions.forEach(tx => {
            const typeStr = tx.type === 'income' ? '収入(売上)' : '支出(経費)';
            // Wrap text fields in quotes to prevent issues with commas in memo
            const safeMemo = tx.memo ? `"${tx.memo}"` : '';
            csvContent += `${tx.date},${tx.category},${safeMemo},${tx.amount},${typeStr}\n`;
        });

        // Add BOM so Excel opens UTF-8 Japanese characters correctly
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');

        const a = document.createElement('a');
        a.href = url;
        a.download = `取引一覧_${yyyy}${mm}${dd}.csv`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
        this.showToast('Excel用(CSV)を出力しました。');
    }

}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
