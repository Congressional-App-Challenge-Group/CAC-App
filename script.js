// FinSpark JavaScript

// Authentication Check
function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('finspark_authenticated');
    if (!isAuthenticated || isAuthenticated !== 'true') {
        window.location.href = 'landing.html';
        return false;
    }
    return true;
}

// Get User Data
function getUserData() {
    const userData = localStorage.getItem('finspark_user');
    return userData ? JSON.parse(userData) : null;
}

// Save User Data
function saveUserData(userData) {
    const users = JSON.parse(localStorage.getItem('finspark_users') || '{}');
    if (userData.email) {
        users[userData.email] = userData;
        localStorage.setItem('finspark_users', JSON.stringify(users));
        localStorage.setItem('finspark_user', JSON.stringify(userData));
    }
}

// Initialize App
function initApp() {
    if (!checkAuthentication()) return;
    
    const userData = getUserData();
    if (userData) {
        personalizeDashboard(userData);
        loadUserData(userData);
    }
    
    initDarkMode();
    initTabs();
    updateTime();
    setInterval(updateTime, 1000);
}

// Load User Data (expenses, goals, etc.)
function loadUserData(userData) {
    // Load transactions
    const transactions = localStorage.getItem(`finspark_transactions_${userData.email}`);
    if (transactions) {
        window.userTransactions = JSON.parse(transactions);
    } else {
        window.userTransactions = [];
    }
    
    // Load savings goals
    const goals = localStorage.getItem(`finspark_goals_${userData.email}`);
    if (goals) {
        window.userGoals = JSON.parse(goals);
    } else {
        window.userGoals = [];
    }
    
    // Load spending limits
    const limits = localStorage.getItem(`finspark_limits_${userData.email}`);
    if (limits) {
        window.userLimits = JSON.parse(limits);
    } else {
        window.userLimits = [];
    }
}

// Save User Data (expenses, goals, etc.)
function saveUserTransaction(transaction) {
    const userData = getUserData();
    if (!userData) return;
    
    if (!window.userTransactions) window.userTransactions = [];
    window.userTransactions.push(transaction);
    localStorage.setItem(`finspark_transactions_${userData.email}`, JSON.stringify(window.userTransactions));
}

// Save User Goal
function saveUserGoal(goal) {
    const userData = getUserData();
    if (!userData) return;
    
    if (!window.userGoals) window.userGoals = [];
    window.userGoals.push(goal);
    localStorage.setItem(`finspark_goals_${userData.email}`, JSON.stringify(window.userGoals));
}

// Save User Limit
function saveUserLimit(limit) {
    const userData = getUserData();
    if (!userData) return;
    
    if (!window.userLimits) window.userLimits = [];
    window.userLimits.push(limit);
    localStorage.setItem(`finspark_limits_${userData.email}`, JSON.stringify(window.userLimits));
}

// Personalize Dashboard
function personalizeDashboard(userData) {
    // Update header with user name
    const headerTitle = document.querySelector('header h1');
    if (headerTitle) {
        headerTitle.textContent = `FinSpark`;
    }
    
    // Update greeting
    const greeting = document.getElementById('userGreeting');
    if (greeting) {
        greeting.textContent = `Welcome back, ${userData.name}!`;
    }
    
    // Update grade display
    const gradeDisplay = document.getElementById('userGrade-display');
    if (gradeDisplay) {
        const gradeLabels = {
            '6': '6th Grade',
            '7': '7th Grade',
            '8': '8th Grade',
            '9': 'Freshman',
            '10': 'Sophomore',
            '11': 'Junior',
            '12': 'Senior',
            'college': 'College'
        };
        gradeDisplay.textContent = gradeLabels[userData.grade] || '';
    }
    
    // Load profile data
    loadProfileData(userData);
    
    // Set initial balance based on allowance
    const totalBalance = document.getElementById('totalBalance');
    if (totalBalance && userData.monthlyAllowance) {
        totalBalance.textContent = `$${parseFloat(userData.monthlyAllowance).toFixed(2)}`;
    }
    
    // Set monthly income based on allowance
    const monthlyIncome = document.getElementById('monthlyIncome');
    if (monthlyIncome && userData.monthlyAllowance) {
        const frequencyMultiplier = userData.allowanceFrequency === 'weekly' ? 4 : 
                                    userData.allowanceFrequency === 'biweekly' ? 2 : 1;
        monthlyIncome.textContent = `$${(parseFloat(userData.monthlyAllowance) * frequencyMultiplier).toFixed(2)}`;
    }
}

// Load Profile Data
function loadProfileData(userData) {
    document.getElementById('profileName').value = userData.name || '';
    document.getElementById('profileEmail').value = userData.email || '';
    document.getElementById('profileGrade').value = userData.grade || '';
    document.getElementById('profileAllowance').value = userData.monthlyAllowance || '';
    document.getElementById('profileFrequency').value = userData.allowanceFrequency || 'monthly';
    
    if (userData.hasJob === 'yes') {
        document.getElementById('profileHasJob').value = 'yes';
        document.getElementById('jobFields').classList.remove('hidden');
        document.getElementById('profileJobTitle').value = userData.jobTitle || '';
        document.getElementById('profileHourlyWage').value = userData.hourlyWage || '';
        document.getElementById('profileHoursPerWeek').value = userData.hoursPerWeek || '';
    }
}

// Save Profile
function saveProfile(e) {
    e.preventDefault();
    
    const userData = getUserData();
    if (!userData) return;
    
    userData.name = document.getElementById('profileName').value;
    userData.grade = document.getElementById('profileGrade').value;
    
    saveUserData(userData);
    personalizeDashboard(userData);
    
    alert('Profile updated successfully!');
}

// Save Financial Info
function saveFinancialInfo(e) {
    e.preventDefault();
    
    const userData = getUserData();
    if (!userData) return;
    
    userData.monthlyAllowance = document.getElementById('profileAllowance').value;
    userData.allowanceFrequency = document.getElementById('profileFrequency').value;
    userData.hasJob = document.getElementById('profileHasJob').value;
    
   if (userData.hasJob === 'yes') {
        userData.jobTitle = document.getElementById('profileJobTitle').value;
        userData.hourlyWage = document.getElementById('profileHourlyWage').value;
        userData.hoursPerWeek = document.getElementById('profileHoursPerWeek').value;
    }
    
    saveUserData(userData);
    personalizeDashboard(userData);
    
    alert('Financial information updated successfully!');
}

// Toggle Job Fields
function toggleJobFields() {
    const hasJob = document.getElementById('profileHasJob').value;
    const jobFields = document.getElementById('jobFields');
    
    if (hasJob === 'yes') {
        jobFields.classList.remove('hidden');
    } else {
        jobFields.classList.add('hidden');
    }
}

// Change Password
function changePassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }
    
    if (newPassword.length < 8) {
        alert('Password must be at least 8 characters!');
        return;
    }
    
    const userData = getUserData();
    if (!userData) return;
    
    userData.password = newPassword;
    saveUserData(userData);
    
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    
    alert('Password updated successfully!');
}

// Delete Account
function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        return;
    }
    
    if (!confirm('This will permanently delete all your data including transactions, goals, and settings. Continue?')) {
        return;
    }
    
    const userData = getUserData();
    if (!userData) return;
    
    // Remove user from users database
    const users = JSON.parse(localStorage.getItem('finspark_users') || '{}');
    delete users[userData.email];
    localStorage.setItem('finspark_users', JSON.stringify(users));
    
    // Remove user-specific data
    localStorage.removeItem(`finspark_transactions_${userData.email}`);
    localStorage.removeItem(`finspark_goals_${userData.email}`);
    localStorage.removeItem(`finspark_limits_${userData.email}`);
    
    // Logout
    logout();
}

// Logout Function
function logout() {
    localStorage.removeItem('finspark_authenticated');
    localStorage.removeItem('finspark_user');
    window.location.href = 'index.html';
}

// Dark mode functionality
function toggleDarkMode() {
    const body = document.body;
    const themeIconHeader = document.getElementById('theme-icon-header');
    const themeIconNav = document.getElementById('theme-icon');
    
    body.classList.toggle('dark-mode');
    
    if (body.classList.contains('dark-mode')) {
        if (themeIconHeader) {
            themeIconHeader.classList.remove('fa-moon');
            themeIconHeader.classList.add('fa-sun');
        }
        if (themeIconNav) {
            themeIconNav.classList.remove('fa-moon');
            themeIconNav.classList.add('fa-sun');
        }
        localStorage.setItem('darkMode', 'true');
    } else {
        if (themeIconHeader) {
            themeIconHeader.classList.remove('fa-sun');
            themeIconHeader.classList.add('fa-moon');
        }
        if (themeIconNav) {
            themeIconNav.classList.remove('fa-sun');
            themeIconNav.classList.add('fa-moon');
        }
        localStorage.setItem('darkMode', 'false');
    }
}

// Check for saved dark mode preference
function initDarkMode() {
    const darkMode = localStorage.getItem('darkMode');
    const themeIconHeader = document.getElementById('theme-icon-header');
    const themeIconNav = document.getElementById('theme-icon');
    
    if (darkMode === 'true') {
        document.body.classList.add('dark-mode');
        if (themeIconHeader) {
            themeIconHeader.classList.remove('fa-moon');
            themeIconHeader.classList.add('fa-sun');
        }
        if (themeIconNav) {
            themeIconNav.classList.remove('fa-moon');
            themeIconNav.classList.add('fa-sun');
        }
    }
}

// Data storage
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let budgets = JSON.parse(localStorage.getItem('budgets')) || {};
let goals = JSON.parse(localStorage.getItem('goals')) || [];
let monthlyIncome = parseFloat(localStorage.getItem('monthlyIncome')) || 200; // Default teen allowance

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initDarkMode(); // Initialize dark mode
    updateDateTime();
    loadDashboard();
    loadExpenses();
    loadBudgets();
    loadGoals();
    initializeCharts();
    
    // Initialize blog functionality
    initializeBlogSearch();
    
    // Update time every second
    setInterval(updateDateTime, 1000);
});

// Tab navigation
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.vercel-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Update buttons
            tabBtns.forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            
            // Update content
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            const targetElement = document.getElementById(targetTab);
            if (targetElement) {
                targetElement.classList.add('active');
            }
        });
    });
}

// Update current date and time
let dateFormat = 'full'; // 'full', 'short', 'numeric'
let timeFormat = '12'; // '12' or '24'

function updateDateTime() {
    const dateElementHeader = document.getElementById('currentDate-header');
    const dateElementNav = document.getElementById('currentDate');
    const timeElement = document.getElementById('currentTime');
    const now = new Date();
    
    // Update date based on format
    let dateText = '';
    switch(dateFormat) {
        case 'full':
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateText = now.toLocaleDateString('en-US', options);
            break;
        case 'short':
            dateText = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            break;
        case 'numeric':
            dateText = now.toLocaleDateString('en-US');
            break;
    }
    
    // Update both date elements
    if (dateElementHeader) {
        dateElementHeader.textContent = dateText;
    }
    if (dateElementNav) {
        dateElementNav.textContent = dateText;
    }
    
    // Update time based on format
    if (timeElement) {
        let timeText = '';
        if (timeFormat === '12') {
            timeText = now.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                second: '2-digit',
                hour12: true 
            });
        } else {
            timeText = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: false 
            });
        }
        timeElement.textContent = timeText;
    }
}

function toggleDateFormat() {
    const formats = ['full', 'short', 'numeric'];
    const currentIndex = formats.indexOf(dateFormat);
    dateFormat = formats[(currentIndex + 1) % formats.length];
    updateDateTime();
    
    // Add a little animation feedback
    const dateElementNav = document.getElementById('currentDate');
    if (dateElementNav) {
        dateElementNav.classList.add('animate-pulse');
        setTimeout(() => dateElementNav.classList.remove('animate-pulse'), 500);
    }
}

function toggleTimeFormat() {
    timeFormat = timeFormat === '12' ? '24' : '12';
    updateDateTime();
    
    // Add a little animation feedback
    const timeElement = document.getElementById('currentTime');
    timeElement.classList.add('animate-pulse');
    setTimeout(() => timeElement.classList.remove('animate-pulse'), 500);
}

// Edit value function
function editValue(elementId, label) {
    const element = document.getElementById(elementId);
    const currentValue = element.textContent.replace('$', '').replace(',', '');
    
    // Create input modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 class="text-lg font-semibold mb-4">Edit ${label}</h3>
            <input type="number" id="editInput" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                   value="${currentValue}" step="0.01" min="0">
            <div class="flex justify-end space-x-2 mt-4">
                <button onclick="closeEditModal()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button onclick="saveEditValue('${elementId}')" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
        </div>
    `;
    
    // Add to body and focus input
    document.body.appendChild(modal);
    document.getElementById('editInput').focus();
    document.getElementById('editInput').select();
    
    // Handle Enter key
    document.getElementById('editInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveEditValue(elementId);
        }
    });
    
    // Handle Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
            closeEditModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    });
}

function saveEditValue(elementId) {
    const input = document.getElementById('editInput');
    const value = parseFloat(input.value);
    
    if (!isNaN(value) && value >= 0) {
        const element = document.getElementById(elementId);
        element.textContent = formatCurrency(value);
        
        // Save to localStorage
        if (elementId === 'totalBalance') {
            localStorage.setItem('totalBalance', value.toString());
        } else if (elementId === 'monthlyIncome') {
            localStorage.setItem('monthlyIncome', value.toString());
            monthlyIncome = value; // Update global variable
            loadDashboard(); // Refresh dashboard
            initializeCharts(); // Update charts
        }
        
        // Add success animation
        element.classList.add('animate-pulse');
        setTimeout(() => element.classList.remove('animate-pulse'), 1000);
    }
    
    closeEditModal();
}

function closeEditModal() {
    const modal = document.querySelector('.fixed.inset-0');
    if (modal) {
        modal.remove();
    }
}

// Dashboard functions
function loadDashboard() {
    // Load saved values or use defaults
    const savedTotalBalance = localStorage.getItem('totalBalance');
    const savedMonthlyIncome = localStorage.getItem('monthlyIncome');
    
    const totalBalance = savedTotalBalance ? parseFloat(savedTotalBalance) : calculateTotalBalance();
    const monthlyExpenses = calculateMonthlyExpenses();
    const savingsRate = calculateSavingsRate(monthlyIncome, monthlyExpenses);

    // Animate value updates
    animateValue('totalBalance', totalBalance);
    animateValue('monthlyIncome', monthlyIncome);
    animateValue('monthlyExpenses', monthlyExpenses);
    animateValue('savingsRate', savingsRate, '%');
}

function animateValue(elementId, endValue, suffix = '') {
    const element = document.getElementById(elementId);
    const startValue = parseFloat(element.textContent.replace(/[^0-9.-]/g, '')) || 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = startValue + (endValue - startValue) * easeOutQuart;
        
        element.textContent = formatCurrency(currentValue) + suffix;
        
        // Add pulse effect at the end
        if (progress === 1) {
            element.classList.add('animate-pulse-once');
            setTimeout(() => element.classList.remove('animate-pulse-once'), 300);
        }
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function calculateTotalBalance() {
    return monthlyIncome - calculateMonthlyExpenses();
}

function calculateMonthlyExpenses() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return expenses
        .filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
        })
        .reduce((total, expense) => total + expense.amount, 0);
}

function calculateSavingsRate(income, expenses) {
    if (income === 0) return 0;
    return Math.round(((income - expenses) / income) * 100);
}

// Expense functions
document.getElementById('expenseForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Add loading state to button
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '⏳ Adding...';
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    setTimeout(() => {
        const expense = {
            id: Date.now(),
            description: document.getElementById('expenseName').value,
            amount: parseFloat(document.getElementById('expenseAmount').value),
            category: document.getElementById('expenseCategory').value,
            date: new Date().toISOString()
        };
        
        expenses.push(expense);
        localStorage.setItem('expenses', JSON.stringify(expenses));
        
        // Reset button with success animation
        submitBtn.innerHTML = '✅ Added!';
        submitBtn.classList.remove('loading');
        submitBtn.classList.add('success-animation');
        
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.remove('success-animation');
        }, 1000);
        
        this.reset();
        loadExpenses();
        loadDashboard();
        initializeCharts();
        
        // Animate the new expense row
        setTimeout(() => {
            const firstRow = document.querySelector('#expensesList tr');
            if (firstRow) {
                firstRow.classList.add('animate-scale-in', 'success-animation');
            }
        }, 100);
    }, 500);
});

function loadExpenses() {
    const expensesList = document.getElementById('expensesList');
    expensesList.innerHTML = '';
    
    const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedExpenses.slice(-10).reverse().forEach(expense => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
        row.innerHTML = `
            <td class="py-3 px-4 text-gray-900 text-sm">${new Date(expense.date).toLocaleDateString()}</td>
            <td class="py-3 px-4 text-gray-900 text-sm">${expense.description}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                    ${expense.category}
                </span>
            </td>
            <td class="py-3 px-4 text-right text-gray-900 font-semibold text-sm">${formatCurrency(expense.amount)}</td>
            <td class="py-3 px-4 text-center">
                <button onclick="deleteExpense(${expense.id})" class="text-gray-400 hover:text-red-600 transition-colors p-1 hover:bg-red-50 rounded">
                    <i class="fas fa-trash text-sm"></i>
                </button>
            </td>
        `;
        expensesList.appendChild(row);
    });
}

function deleteExpense(id) {
    const row = document.querySelector(`button[onclick="deleteExpense(${id})"]`).closest('tr');
    
    // Add fade out animation
    row.style.transition = 'all 0.3s ease';
    row.style.opacity = '0';
    row.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
        expenses = expenses.filter(expense => expense.id !== id);
        localStorage.setItem('expenses', JSON.stringify(expenses));
        loadExpenses();
        loadDashboard();
        updateCharts();
    }, 300);
}

function getCategoryColor(category) {
    const colors = {
        food: 'yellow',
        transport: 'blue',
        entertainment: 'purple',
        shopping: 'pink',
        friends: 'green',
        other: 'gray'
    };
    return colors[category] || 'gray';
}

// Budget functions
document.getElementById('budgetForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const category = document.getElementById('budgetCategory').value;
    const amount = parseFloat(document.getElementById('budgetAmount').value);
    
    budgets[category] = amount;
    localStorage.setItem('budgets', JSON.stringify(budgets));
    
    this.reset();
    loadBudgets();
    loadDashboard();
});

function loadBudgets() {
    const budgetList = document.getElementById('budgetList');
    budgetList.innerHTML = '';
    
    Object.entries(budgets).forEach(([category, budgetAmount]) => {
        const spent = calculateCategorySpending(category);
        const percentage = (spent / budgetAmount) * 100;
        const isOverBudget = spent > budgetAmount;
        
        const budgetItem = document.createElement('div');
        budgetItem.className = 'border rounded-lg p-4';
        budgetItem.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-semibold capitalize">${category}</h4>
                <span class="text-sm ${isOverBudget ? 'text-red-600' : 'text-green-600'}">
                    ${formatCurrency(spent)} / ${formatCurrency(budgetAmount)}
                </span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="progress-bar bg-${isOverBudget ? 'red' : 'green'}-500 h-2 rounded-full" 
                     style="width: ${Math.min(percentage, 100)}%"></div>
            </div>
            <div class="text-xs text-gray-500 mt-1">${Math.round(percentage)}% used</div>
        `;
        budgetList.appendChild(budgetItem);
    });
}

function calculateCategorySpending(category) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return expenses
        .filter(expense => {
            const expenseDate = new Date(expense.date);
            return expense.category === category && 
                   expenseDate.getMonth() === currentMonth && 
                   expenseDate.getFullYear() === currentYear;
        })
        .reduce((total, expense) => total + expense.amount, 0);
}

// Goals functions
document.getElementById('goalForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nameInput = document.getElementById('goalName');
    const targetInput = document.getElementById('goalTarget');
    const categorySelect = document.getElementById('goalCategory');
    
    const goal = {
        id: Date.now(),
        name: nameInput.value,
        target: parseFloat(targetInput.value),
        current: 0, // Start at 0 for new goals
        category: categorySelect.value,
        createdAt: new Date().toISOString()
    };
    
    goals.push(goal);
    localStorage.setItem('goals', JSON.stringify(goals));
    
    nameInput.value = '';
    targetInput.value = '';
    categorySelect.value = '';
    
    loadGoals();
    loadDashboard();
    initializeCharts(); // Refresh charts with new goal
});

function loadGoals() {
    const goalsList = document.getElementById('goalsList');
    goalsList.innerHTML = '';
    
    goals.forEach(goal => {
        const percentage = (goal.current / goal.target) * 100;
        const isCompleted = goal.current >= goal.target;
        
        const goalItem = document.createElement('div');
        goalItem.className = 'border rounded-lg p-4';
        goalItem.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-semibold">${goal.name}</h4>
                <button onclick="deleteGoal(${goal.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="flex justify-between text-sm text-gray-600 mb-2">
                <span>${formatCurrency(goal.current)}</span>
                <span>${formatCurrency(goal.target)}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="progress-bar bg-${isCompleted ? 'green' : 'blue'}-500 h-2 rounded-full" 
                     style="width: ${Math.min(percentage, 100)}%"></div>
            </div>
            <div class="text-xs text-gray-500 mt-1">${Math.round(percentage)}% complete</div>
            <div class="mt-2">
                <input type="number" placeholder="Add amount" step="0.01" 
                       class="px-2 py-1 border rounded text-sm mr-2" id="goalAmount-${goal.id}">
                <button onclick="updateGoalProgress(${goal.id})" 
                        class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                    Add Progress
                </button>
            </div>
        `;
        goalsList.appendChild(goalItem);
    });
}

function updateGoalProgress(goalId) {
    const amountInput = document.getElementById(`goalAmount-${goalId}`);
    const amount = parseFloat(amountInput.value);
    
    if (amount > 0) {
        const goal = goals.find(g => g.id === goalId);
        goal.current += amount;
        localStorage.setItem('goals', JSON.stringify(goals));
        
        amountInput.value = '';
        loadGoals();
        loadDashboard();
    }
}

function deleteGoal(id) {
    goals = goals.filter(goal => goal.id !== id);
}
let expenseChart, trendChart;

function initializeCharts() {
    // Expense Chart - Pie Chart with Categories
    const expenseCtx = document.getElementById('expenseChart').getContext('2d');
    const categoryTotals = {};
    
    expenses.forEach(expense => {
        if (!categoryTotals[expense.category]) {
            categoryTotals[expense.category] = 0;
        }
        categoryTotals[expense.category] += expense.amount;
    });

    const categoryColors = {
        'Food': '#FF6384',
        'Drinks': '#36A2EB', 
        'Restaurant': '#FFCE56',
        'Clothes': '#9966FF',
        'Electronics': '#FF9F40',
        'Accessories': '#FF6384',
        'Movies': '#4BC0C0',
        'Games': '#9966FF',
        'Events': '#FF9F40',
        'Gas': '#FF6384',
        'Transit': '#36A2EB',
        'Uber': '#FFCE56',
        'Gifts': '#9966FF',
        'School': '#4BC0C0',
        'Health': '#FF9F40',
        'Other': '#C9CBCF'
    };

    // Destroy existing chart if it exists
    if (window.expenseChartInstance) {
        window.expenseChartInstance.destroy();
    }

    window.expenseChartInstance = new Chart(expenseCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryTotals).map(cat => {
                const emoji = {
                    'Food': '🍕', 'Drinks': '🥤', 'Restaurant': '🍔',
                    'Clothes': '👕', 'Electronics': '📱', 'Accessories': '⌚',
                    'Movies': '🎬', 'Games': '🎮', 'Events': '🎪',
                    'Gas': '⛽', 'Transit': '🚌', 'Uber': '🚗',
                    'Gifts': '🎁', 'School': '📚', 'Health': '💊', 'Other': '📦'
                }[cat] || '📊';
                return `${emoji} ${cat}`;
            }),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: Object.keys(categoryTotals).map(cat => categoryColors[cat] || '#C9CBCF'),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = formatCurrency(context.parsed);
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Create custom legend
    const expenseLegend = document.getElementById('expenseLegend');
    if (expenseLegend) {
        expenseLegend.innerHTML = '';
        Object.keys(categoryTotals).forEach(cat => {
            const percentage = ((categoryTotals[cat] / Object.values(categoryTotals).reduce((a, b) => a + b, 0)) * 100).toFixed(1);
            const legendItem = document.createElement('div');
            legendItem.className = 'flex items-center';
            legendItem.innerHTML = `
                <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${categoryColors[cat] || '#C9CBCF'}"></div>
                <span>${cat}: ${percentage}%</span>
            `;
            expenseLegend.appendChild(legendItem);
        });
    }

    // Savings Goals Chart - Doughnut Chart
    const savingsCtx = document.getElementById('savingsChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.savingsChartInstance) {
        window.savingsChartInstance.destroy();
    }

    if (goals.length > 0) {
        window.savingsChartInstance = new Chart(savingsCtx, {
            type: 'doughnut',
            data: {
                labels: goals.map(goal => goal.name),
                datasets: [{
                    data: goals.map(goal => goal.current),
                    backgroundColor: [
                        '#4BC0C0',
                        '#9966FF',
                        '#FF9F40',
                        '#FF6384',
                        '#36A2EB'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const goal = goals[context.dataIndex];
                                const percentage = ((goal.current / goal.target) * 100).toFixed(1);
                                return `${goal.name}: ${formatCurrency(goal.current)} of ${formatCurrency(goal.target)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Create savings progress legend
        const savingsLegend = document.getElementById('savingsLegend');
        if (savingsLegend) {
            savingsLegend.innerHTML = '';
            goals.forEach(goal => {
                const percentage = Math.min((goal.current / goal.target) * 100, 100);
                const legendItem = document.createElement('div');
                legendItem.className = 'flex items-center justify-between';
                legendItem.innerHTML = `
                    <span class="flex items-center">
                        <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${['#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#36A2EB'][goals.indexOf(goal)]}"></div>
                        ${goal.name}
                    </span>
                    <span class="font-medium">${percentage.toFixed(1)}%</span>
                `;
                savingsLegend.appendChild(legendItem);
            });
        }
    }

    // Allowance Breakdown Chart - Pie Chart
    const allowanceCtx = document.getElementById('allowanceChart').getContext('2d');
    const allowanceData = {
        labels: ['Spent', 'Saved', 'Available'],
        datasets: [{
            data: [
                calculateMonthlyExpenses(),
                monthlyIncome * 0.2, // Assume 20% savings rate
                Math.max(0, monthlyIncome - calculateMonthlyExpenses() - (monthlyIncome * 0.2))
            ],
            backgroundColor: ['#FF6384', '#36A2EB', '#4BC0C0'],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };

    // Destroy existing chart if it exists
    if (window.allowanceChartInstance) {
        window.allowanceChartInstance.destroy();
    }

    window.allowanceChartInstance = new Chart(allowanceCtx, {
        type: 'pie',
        data: allowanceData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = formatCurrency(context.parsed);
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Top Categories Chart - Bar Chart
    const topCategoriesCtx = document.getElementById('topCategoriesChart').getContext('2d');
    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Destroy existing chart if it exists
    if (window.topCategoriesChartInstance) {
        window.topCategoriesChartInstance.destroy();
    }

    window.topCategoriesChartInstance = new Chart(topCategoriesCtx, {
        type: 'bar',
        data: {
            labels: sortedCategories.map(([cat]) => cat),
            datasets: [{
                label: 'Amount',
                data: sortedCategories.map(([, amount]) => amount),
                backgroundColor: '#FF9F40',
                borderColor: '#FF6384',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            }
        }
    });

    // Monthly Trend Chart - Line Chart
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    const last6Months = [];
    const monthlyData = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        last6Months.push(monthName);
        
        // Simulate some trend data (in real app, this would come from actual data)
        monthlyData.push(Math.floor(Math.random() * 500) + 200);
    }

    // Destroy existing chart if it exists
    if (window.trendChartInstance) {
        window.trendChartInstance.destroy();
    }

    window.trendChartInstance = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: last6Months,
            datasets: [{
                label: 'Monthly Spending',
                data: monthlyData,
                borderColor: '#9966FF',
                backgroundColor: 'rgba(153, 102, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            }
        }
    });
}

function updateCharts() {
    // Update expense breakdown chart
    const categoryTotals = {};
    expenses.forEach(expense => {
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });
    
    expenseChart.data.labels = Object.keys(categoryTotals);
    expenseChart.data.datasets[0].data = Object.values(categoryTotals);
    expenseChart.update();
    
    // Update trend chart (last 6 months)
    const months = [];
    const incomeData = [];
    const expenseData = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        months.push(monthName);
        
        const monthExpenses = expenses
            .filter(expense => {
                const expenseDate = new Date(expense.date);
                return expenseDate.getMonth() === date.getMonth() && 
                       expenseDate.getFullYear() === date.getFullYear();
            })
            .reduce((total, expense) => total + expense.amount, 0);
        
        incomeData.push(monthlyIncome);
        expenseData.push(monthExpenses);
    }
    
    trendChart.data.labels = months;
    trendChart.data.datasets[0].data = incomeData;
    trendChart.data.datasets[1].data = expenseData;
    trendChart.update();
}

// Blog Articles Data
const blogArticles = {
    'investing-101': {
        title: 'Investing 101 for Teens',
        category: 'investing',
        readTime: '8 min read',
        content: `
            <h2>Think You're Too Young to Invest? Think Again!</h2>
            <p>Ever heard adults talking about stocks and investments and thought it was something only "grown-ups" do? Wrong! You can start investing right now, even as a teenager, and the best part is - you don't need thousands of dollars to begin.</p>
            
            <h3>What Even IS Investing?</h3>
            <p>Investing is basically making your money work for you. Instead of just letting your money sit in a piggy bank (where it actually loses value over time because of inflation), you put it into things that can grow in value.</p>
            
            <h3>Start Small - Really Small</h3>
            <p>You don't need $1,000 to start investing. Many apps let you start with just $5-20:</p>
            <ul>
                <li><strong>Acorns</strong> - Rounds up your purchases and invests the spare change</li>
                <li><strong>Stash</strong> - Lets you buy pieces of stocks for as little as $5</li>
                <li><strong>Fidelity Youth Account</strong> - Designed specifically for teens (with parent approval)</li>
            </ul>
            
            <h3>The Magic of Compound Interest</h3>
            <p>Here's why starting young is your superpower: If you invest $1,000 at age 15 and earn 8% per year, by age 65 you'll have over $46,000. If you wait until age 25 to start, you'd only have about $21,000. That's the power of compound interest!</p>
            
            <h3>What Should You Invest In?</h3>
            <p><strong>ETFs (Exchange Traded Funds)</strong> are perfect for beginners. Instead of buying one company's stock, you're buying a little piece of hundreds of companies. It's like buying a variety pack instead of just one flavor.</p>
            
            <p>Popular ETFs for teens:</p>
            <ul>
                <li>VTI - Total stock market (owns a piece of almost every US company)</li>
                <li>QQQ - Tech companies (Apple, Google, Facebook, etc.)</li>
                <li>VOO - Top 500 biggest US companies</li>
            </ul>
            
            <h3>Risks vs. Rewards</h3>
            <p>Investing isn't guaranteed - you can lose money too. That's why you should:</p>
            <ul>
                <li>Only invest money you won't need for at least 5 years</li>
                <li>Don't panic if the market goes down (it always recovers)</li>
                <li>Keep investing regularly (dollar-cost averaging)</li>
            </ul>
            
            <h3>Getting Started Checklist</h3>
            <ol>
                <li>Talk to your parents about opening a custodial account</li>
                <li>Choose an investment app that allows teens</li>
                <li>Start with $20-50 per month</li>
                <li>Pick a simple ETF to begin with</li>
                <li>Set up automatic investments if possible</li>
            </ol>
            
            <h3>The Bottom Line</h3>
            <p>Investing as a teen isn't about getting rich quick. It's about building good habits and letting time be your best friend. Even small amounts invested now can grow into serious money by the time you're ready for college, your first car, or moving out.</p>
            
            <p><strong>Remember:</strong> The best time to start investing was yesterday. The second best time is today!</p>
        `
    },
    'saving-hacks': {
        title: '15 Saving Hacks for Teens',
        category: 'saving',
        readTime: '6 min read',
        content: `
            <h2>Save Money Without Feeling Like You're Missing Out</h2>
            <p>Saving money as a teen can feel impossible when your friends are always doing fun stuff that costs money. But what if you could save money AND still have a social life? These hacks actually work!</p>
            
            <h3>🎯 The 50/30/20 Rule (Teen Version)</h3>
            <p>Split your money like this:</p>
            <ul>
                <li><strong>50%</strong> - Needs (lunch money, bus fare, phone bill)</li>
                <li><strong>30%</strong> - Wants (movies, games, clothes)</li>
                <li><strong>20%</strong> - Savings (for bigger goals)</li>
            </ul>
            
            <h3>💡 15 Teen-Approved Saving Hacks</h3>
            
            <h4>1. The 24-Hour Rule</h4>
            <p>See something you want online? Put it in your cart but don't buy for 24 hours. After a day, you'll know if you really want it or if it was just impulse.</p>
            
            <h4>2. Pack Lunch Twice a Week</h4>
            <p>School lunch costs about $3-5 per day. Packing lunch just twice a week saves you $6-10 weekly = $24-40 per month!</p>
            
            <h4>3. Student Discount Everything</h4>
            <p>Always ask "Do you have a student discount?" Movie theaters, restaurants, clothing stores, even Apple gives student discounts.</p>
            
            <h4>4. Round-Up Savings</h4>
            <p>Spend $4.50 on something? Round up and put $0.50 in savings. Apps like Acorns do this automatically.</p>
            
            <h4>5. The Envelope Method</h4>
            <p>Put cash in envelopes for different categories (food, fun, savings). When the envelope's empty, you're done spending in that category.</p>
            
            <h4>6. Sell Stuff You Don't Use</h4>
            <p>Old video games, clothes you've outgrown, that skateboard gathering dust - sell it on Depop, Poshmark, or Facebook Marketplace.</p>
            
            <h4>7. Free Fun Challenge</h4>
            <p>Challenge your friends to find free activities: parks, hiking, home movie nights, game nights. You'd be surprised how much fun you can have for $0.</p>
            
            <h4>8. Cancel Unused Subscriptions</h4>
            <p>That streaming service you haven't watched in 3 months? Cancel it. Even $10/month adds up to $120/year.</p>
            
            <h4>9. Buy Secondhand First</h4>
            <p>Need new clothes or shoes? Check thrift stores, Depop, or Poshmark first. You can find brand-name stuff for way less.</p>
            
            <h4>10. DIY Gifts</h4>
            <p>Instead of buying expensive gifts for friends' birthdays, make something personal. A photo album, baked goods, or a handwritten card often means more.</p>
            
            <h4>11. Water Bottle Life</h4>
            <p>Stop buying bottled drinks. A reusable water bottle saves you $2-3 per day at school.</p>
            
            <h4>12. Split Costs with Friends</h4>
            <p>Going to the movies? Split popcorn. Getting pizza? split the cost. Don't be the one always paying for everything.</p>
            
            <h4>13. Wait for Sales</h4>
            <p>Want a new video game or pair of shoes? Wait for holiday sales, Black Friday, or back-to-school deals.</p>
            
            <h4>14. Learn to Cook Basic Stuff</h4>
            <p>Instead of ordering delivery or going out, learn to make 3-4 simple meals. It's way cheaper and impressive.</p>
            
            <h4>15. Set Up Automatic Savings</h4>
            <p>If you have a bank account, set up automatic transfers to savings. Even $5/week adds up to $260/year.</p>
            
            <h3>🔥 Pro Tips</h3>
            <ul>
                <li>Track your spending for one week - you'll be surprised where money goes</li>
                <li>Use apps like Mint or YNAB to see your money patterns</li>
                <li>Start a savings challenge with friends to stay motivated</li>
                <li>Remember: saving isn't about never having fun - it's about choosing what's worth it</li>
            </ul>
            
            <h3>💪 Making It Stick</h3>
            <p>Start with 2-3 of these hacks. Don't try to do all 15 at once or you'll get overwhelmed. Pick the ones that seem easiest and build from there.</p>
            
            <p>The goal isn't to never spend money - it's to spend intentionally on things that actually matter to you!</p>
        `
    },
    'teen-jobs': {
        title: '10 Jobs You Can Get as a Teen',
        category: 'earning',
        readTime: '7 min read',
        content: `
            <h2>Make Your Own Money (Without Ruining Your Grades)</h2>
            <p>Want your own spending money but stuck wondering how to earn it while juggling school, homework, and actually having a life? Here are 10 realistic jobs that work with a teen schedule.</p>
            
            <h3>🏪 Traditional Jobs (with set schedules)</h3>
            
            <h4>1. Retail Worker</h4>
            <p><strong>What you'll do:</strong> Help customers, stock shelves, work the cash register</p>
            <p><strong>Pay:</strong> $12-16/hour plus employee discounts</p>
            <p><strong>Best for:</strong> People who like talking to others and can work weekends</p>
            <p><strong>Where to look:</strong> Mall stores, grocery stores, big box retailers</p>
            
            <h4>2. Food Service</h4>
            <p><strong>What you'll do:</strong> Take orders, make food, clean up, work drive-thru</p>
            <p><strong>Pay:</strong> $11-15/hour plus tips (sometimes)</p>
            <p><strong>Best for:</strong> Fast-paced environments, flexible evening shifts</p>
            <p><strong>Where to look:</strong> Fast food chains, local restaurants, ice cream shops</p>
            
            <h4>3. Movie Theater</h4>
            <p><strong>What you'll do:</strong> Sell tickets, serve concessions, clean theaters</p>
            <p><strong>Pay:</strong> $12-14/hour plus free movies!</p>
            <p><strong>Best for:</strong> Weekend and evening work, social environment</p>
            
            <h3>💻 Side Hustles (work when you want)</h3>
            
            <h4>4. Tutoring</h4>
            <p><strong>What you'll do:</strong> Help younger kids with subjects you're good at</p>
            <p><strong>Pay:</strong> $15-30/hour (depending on subject)</p>
            <p><strong>Best for:</strong> Good students who can explain concepts well</p>
            <p><strong>How to start:</strong> Post on neighborhood apps, tell parents, make flyers</p>
            
            <h4>5. Pet Sitting/Dog Walking</h4>
            <p><strong>What you'll do:</strong> Watch pets when owners are away, walk dogs</p>
            <p><strong>Pay:</strong> $15-25 per walk, $25-50 per day for pet sitting</p>
            <p><strong>Best for:</strong> Animal lovers with flexible schedules</p>
            <p><strong>How to start:</strong> Rover app, neighborhood social media, word of mouth</p>
            
            <h4>6. Babysitting</h4>
            <p><strong>What you'll do:</strong> Watch kids, help with homework, play games</p>
            <p><strong>Pay:</strong> $12-20/hour depending on experience and number of kids</p>
            <p><strong>Best for:</strong> Responsible teens who like working with kids</p>
            <p><strong>How to start:</strong> Care.com, neighborhood groups, family friends</p>
            
            <h4>7. Lawn Care/Snow Removal</h4>
            <p><strong>What you'll do:</strong> Mow lawns, rake leaves, shovel snow</p>
            <p><strong>Pay:</strong> $20-50 per lawn, $25-50 per snow removal</p>
            <p><strong>Best for:</strong> Physical work, seasonal income</p>
            <p><strong>How to start:</strong> Door-to-door flyers, neighborhood apps</p>
            
            <h4>8. Social Media Management</h4>
            <p><strong>What you'll do:</strong> Manage Instagram/TikTok for small businesses</p>
            <p><strong>Pay:</strong> $15-30/hour or per-project basis</p>
            <p><strong>Best for:</strong> Social media savvy teens</p>
            <p><strong>How to start:</strong> Offer to local businesses, build a portfolio</p>
            
            <h4>9. Content Creation</h4>
            <p><strong>What you'll do:</strong> YouTube videos, TikTok content, streaming</p>
            <p><strong>Pay:</strong> Varies widely (could be $0 to thousands)</p>
            <p><strong>Best for:</strong> Creative teens who are comfortable on camera</p>
            <p><strong>Reality check:</strong> Takes time to build an audience</p>
            
            <h4>10. Freelance Skills</h4>
            <p><strong>What you'll do:</strong> Graphic design, writing, video editing, coding</p>
            <p><strong>Pay:</strong> $20-50/hour depending on skill level</p>
            <p><strong>Best for:</strong> Teens with specific creative or technical skills</p>
            <p><strong>Where to find work:</strong> Fiverr, Upwork, local businesses</p>
            
            <h3>📋 Getting Started Checklist</h3>
            <ol>
                <li><strong>Figure out your availability</strong> - How many hours can you realistically work?</li>
                <li><strong>Get working papers</strong> - Most states require work permits for under 18</li>
                <li><strong>Make a simple resume</strong> - Include any volunteer work, good grades, skills</li>
                <li><strong>Practice interview questions</strong> - "Why do you want to work here?" etc.</li>
                <li><strong>Start applying</strong> - Apply to 5-10 places to increase your chances</li>
            </ol>
            
            <h3>⚖️ Balancing Work & School</h3>
            <ul>
                <li>Don't work more than 15-20 hours per week during school</li>
                <li>Choose jobs with flexible schedules if your workload varies</li>
                <li>Communicate with your boss about school commitments</li>
                <li>Remember: school comes first - don't let work hurt your grades</li>
            </ul>
            
            <h3>💰 Making the Most of Your Money</h3>
            <p>Once you start earning:</p>
            <ul>
                <li>Open a checking and savings account</li>
                <li>Save at least 20% of everything you earn</li>
                <li>Track your income and expenses</li>
                <li>Learn about taxes (yes, you might have to pay them!)</li>
            </ul>
            
            <h3>🎯 The Bottom Line</h3>
            <p>Having a job as a teen isn't just about money - it's about learning responsibility, time management, and skills that will help you later. Start small, stay consistent, and don't be afraid to try different things until you find what works for you!</p>
        `
    },
    'smart-spending': {
        title: 'Smart Spending Guide',
        category: 'spending',
        readTime: '5 min read',
        content: `
            <h2>Buy What You Want Without Going Broke</h2>
            <p>Being smart with money isn't about never buying fun stuff - it's about making sure your money goes further and you actually get things you'll love. Here's how to spend smart.</p>
            
            <h3>🧠 The Psychology of Spending</h3>
            <p>Stores spend millions figuring out how to make you buy stuff. Fight back by understanding their tricks:</p>
            <ul>
                <li><strong>"Limited time offers"</strong> create urgency - walk away</li>
                <li><strong>"Buy one, get one"</strong> makes you spend more than planned</li>
                <li><strong>End caps</strong> (displays at aisle ends) have impulse items</li>
                <li><strong>Eye-level products</strong> are usually the most expensive</li>
            </ul>
            
            <h3>💳 The Cash Envelope Challenge</h3>
            <p>Try this for one month: Use cash for everything fun (movies, games, food out). When the cash is gone, you're done spending until next month. You'll spend 20-30% less, guaranteed.</p>
            
            <h3>📱 Apps That Save You Money</h3>
            <ul>
                <li><strong>Rakuten</strong> - Get cash back for online shopping</li>
                <li><strong>Honey</strong> - Automatically finds coupon codes</li>
                <li><strong>Fluz</strong> - Cash back at popular stores</li>
                <li><strong>GasBuddy</strong> - Find cheapest gas near you</li>
            </ul>
            
            <h3>🛍️ Smart Shopping Strategies</h3>
            
            <h4>Before You Buy Anything</h4>
            <ol>
                <li><strong>Wait 24 hours</strong> for purchases over $20</li>
                <li><strong>Check three places</strong> for the best price</li>
                <li><strong>Ask yourself:</strong> "Do I need this or just want it?"</li>
                <li><strong>Calculate cost per use</strong> - expensive but used often = worth it</li>
            </ol>
            
            <h4>Clothes Shopping Smart</h4>
            <ul>
                <li>Buy basics that mix and match</li>
                <li>Check thrift stores first</li>
                <li>Follow brands on social media for sale announcements</li>
                <li>Shop off-season (buy winter coats in spring)</li>
            </ul>
            
            <h4>Video Games & Tech</h4>
            <ul>
                <li>Wait 3 months after release - prices drop</li>
                <li>Buy used games (GameStop, eBay)</li>
                <li>Share digital games with family members</li>
                <li>Consider if you'll really play it before buying</li>
            </ul>
            
            <h4>Food & Drinks</h4>
            <ul>
                <li>Pack lunch 2-3 times per week</li>
                <li>Get a reusable water bottle</li>
                <li>Split meals with friends when eating out</li>
                <li>Happy hour deals and student discounts</li>
            </ul>
            
            <h3>🎯 The Value Calculator</h3>
            <p>Before buying something, calculate its "value score":</p>
            <p><strong>(How many times you'll use it) × (How much you'll enjoy it) ÷ (Cost)</strong></p>
            <p>A $50 gaming console you'll use daily = high value score.</p>
            <p>A $50 trendy shirt you'll wear once = low value score.</p>
            
            <h3>🚫 Things to Avoid</h3>
            <ul>
                <li><strong>Buy Now, Pay Later</strong> - sounds good but leads to overspending</li>
                <li><strong>Store credit cards</strong> - high interest rates</li>
                <li><strong>Impulse subscriptions</strong> - free trials that auto-renew</li>
                <li><strong>"Influencer" purchases</strong> - buying because someone else has it</li>
            </ul>
            
            <h3>💡 Pro Spending Tips</h3>
            <ol>
                <li><strong>Unsubscribe from marketing emails</strong> - less temptation</li>
                <li><strong>Use the "one in, one out" rule</strong> - buy something new, something old goes</li>
                <li><strong>Price match</strong> - many stores will match competitors' prices</li>
                <li><strong>Buy quality over quantity</strong> - one good pair of shoes vs 3 cheap ones</li>
                <li><strong>Share purchases with friends</strong> - split costs on games, movies, tools</li>
            </ol>
            
            <h3>🔄 The Return Policy Game</h3>
            <p>Always check return policies BEFORE buying. Some places make returns impossible or charge restocking fees. Good return policies = Amazon, Costco, Target. Bad policies = final sale items, customized products.</p>
            
            <h3>🎊 When Splurging Makes Sense</h3>
            <p>Sometimes spending more is actually smarter:</p>
            <ul>
                <li>Quality items that last years vs cheap replacements</li>
                <li>Things that save you money long-term (good backpack, quality shoes)</li>
                <li>Experiences vs stuff (concerts, trips with friends)</li>
                <li>Investing in skills or education</li>
            </ul>
            
            <h3>📈 Track Your Spending</h3>
            <p>For one month, track EVERY purchase. You'll be shocked where money goes. Most teens find they're spending way more on small stuff (snacks, apps, random purchases) than they realize.</p>
            
            <h3>🏆 The Goal</h3>
            <p>Smart spending isn't about being cheap - it's about getting maximum value and enjoyment from your money. Buy what matters to you, skip what doesn't, and always think before you swipe.</p>
        `
    },
    'future-planning': {
        title: 'Planning for College & Cars',
        category: 'future',
        readTime: '9 min read',
        content: `
            <h2>Big Goals, Small Steps</h2>
            <p>College, cars, moving out... these feel like huge, impossible goals when you're in high school. But here's the secret: big goals are just small steps repeated over time. Let's break down how to actually save for these major life goals.</p>
            
            <h3>🎓 College Savings: The Reality Check</h3>
            
            <h4>How Much Does College Actually Cost?</h4>
            <p><strong>In-state public college:</strong> $10,000-25,000 per year</p>
            <p><strong>Out-of-state public:</strong> $25,000-40,000 per year</p>
            <p><strong>Private college:</strong> $35,000-60,000 per year</p>
            <p><strong>But don't panic!</strong> Most students don't pay full price.</p>
            
            <h4>Ways to Reduce College Costs</h4>
            <ul>
                <li><strong>Scholarships</strong> - Apply for everything, even small ones</li>
                <li><strong>Community college first</strong> - 2 years at CC, then transfer</li>
                <li><strong>In-state schools</strong> - Usually 1/3 the cost of private</li>
                <li><strong>AP/IB classes</strong> - College credit in high school = less tuition</li>
                <li><strong>FAFSA</strong> - Federal aid, grants, work-study programs</li>
            </ul>
            
            <h4>Realistic College Savings Goals</h4>
            <p>As a teen, aim to save:</p>
            <ul>
                <li><strong>Freshman year:</strong> $500-1,000 total</li>
                <li><strong>Sophomore year:</strong> $1,500-2,500 total</li>
                <li><strong>Junior year:</strong> $3,000-5,000 total</li>
                <li><strong>Senior year:</strong> $5,000-10,000 total</li>
            </ul>
            <p>Even $5,000 saved by graduation is huge - that's textbooks for a year or a semester's tuition at community college.</p>
            
            <h3>🚗 Car Savings: Freedom on Wheels</h3>
            
            <h4>The Real Cost of a Car</h4>
            <p>It's not just the purchase price:</p>
            <ul>
                <li><strong>Car payment:</strong> $200-400/month</li>
                <li><strong>Insurance:</strong> $100-300/month (higher for teens)</li>
                <li><strong>Gas:</strong> $100-200/month</li>
                <li><strong>Maintenance:</strong> $50-100/month average</li>
                <li><strong>Total:</strong> $450-1,000 per month!</li>
            </ul>
            
            <h4>Smart First Car Strategy</h4>
            <ol>
                <li><strong>Save for a reliable used car</strong> ($5,000-8,000)</li>
                <li><strong>Pay cash if possible</strong> - avoid car loans</li>
                <li><strong>Get insurance quotes BEFORE buying</strong></li>
                <li><strong>Have a mechanic inspect used cars</strong></li>
                <li><strong>Factor in ALL costs</strong> before deciding</li>
            </ol>
            
            <h4>Car Savings Timeline</h4>
            <p>Want a $6,000 car by age 17?</p>
            <ul>
                <li>Starting at 15: Save $250/month = $6,000 in 2 years</li>
                <li>Starting at 16: Save $500/month = $6,000 in 1 year</li>
                <li>Summer job focus: Save $2,000 each summer</li>
            </ul>
            
            <h3>🏠 Moving Out: The Ultimate Goal</h3>
            
            <h4>What Moving Out Actually Costs</h4>
            <p><strong>One-time costs:</strong></p>
            <ul>
                <li>Security deposit: $500-1,500</li>
                <li>First month rent: $800-2,000</li>
                <li>Furniture: $1,000-3,000</li>
                <li>Utilities setup: $200-500</li>
                <li><strong>Total startup:</strong> $2,500-7,000</li>
            </ul>
            
            <p><strong>Monthly costs:</strong></p>
            <ul>
                <li>Rent: $800-2,000</li>
                <li>Utilities: $150-300</li>
                <li>Groceries: $200-400</li>
                <li>Internet/phone: $100-150</li>
                <li>Transportation: $150-400</li>
                <li><strong>Total monthly:</strong> $1,400-3,250</li>
            </ul>
            
            <h4>Realistic Moving Out Plan</h4>
            <p>Most people need 3-6 months of expenses saved before moving out. That's $4,200-19,500 depending on where you live.</p>
            
            <h3>💡 Smart Saving Strategies for Big Goals</h3>
            
            <h4>The 50/30/20 Rule (Big Goals Version)</h4>
            <ul>
                <li><strong>50%</strong> - Current needs (food, transport, phone)</li>
                <li><strong>30%</strong> - Current wants (fun, social life)</li>
                <li><strong>20%</strong> - Big goals (college, car, moving out)</li>
            </ul>
            
            <h4>Automated Savings</h4>
            <p>Set up automatic transfers to separate savings accounts:</p>
            <ul>
                <li>College Fund</li>
                <li>Car Fund</li>
                <li>Emergency Fund (for unexpected stuff)</li>
            </ul>
            
            <h4>Make Your Money Work for You</h4>
            <ul>
                <li>High-yield savings accounts (better interest than regular)</li>
                <li>CDs (Certificates of Deposit) for money you won't need soon</li>
                <li>Consider conservative investments for long-term goals</li>
            </ul>
            
            <h3>🎯 Breaking Down Big Goals</h3>
            
            <h4>College Fund Example</h4>
            <p><strong>Goal:</strong> $5,000 by graduation</p>
            <p><strong>Starting sophomore year (3 years):</strong></p>
            <ul>
                <li>$140/month from allowance/job</li>
                <li>$1,000 from summer job</li>
                <li>$500 from birthday/holiday money</li>
                <li>$200 from selling stuff you don't need</li>
                <li><strong>Total:</strong> $5,040</li>
            </ul>
            
            <h4>Car Fund Example</h4>
            <p><strong>Goal:</strong> $6,000 by age 17</p>
            <p><strong>Starting at 15 (2 years):</strong></p>
            <ul>
                <li>$200/month from part-time job</li>
                <li>$1,500 each summer</li>
                <li>$500 from side hustles</li>
                <li><strong>Total:</strong> $6,300</li>
            </ul>
            
            <h3>🔥 Motivation Strategies</h3>
            <ol>
                <li><strong>Visual reminders</strong> - Put pictures of your goals where you'll see them</li>
                <li><strong>Track progress</strong> - Use apps or spreadsheets to watch savings grow</li>
                <li><strong>Celebrate milestones</strong> - Every $1,000 saved, do something small to celebrate</li>
                <li><strong>Find an accountability partner</strong> - Friend saving for similar goals</li>
                <li><strong>Remember your "why"</strong> - Freedom, independence, less stress later</li>
            </ol>
            
            <h3>⚠️ Reality Check</h3>
            <p>Some truths about big goals:</p>
            <ul>
                <li>You won't reach every goal exactly as planned - that's okay</li>
                <li>Sometimes life happens (car breaks, unexpected expenses)</li>
                <li>Goals change - you might want different things in 2 years</li>
                <li>Starting small is better than not starting at all</li>
            </ul>
            
            <h3>🏁 The Bottom Line</h3>
            <p>Big financial goals aren't about being perfect - they're about being consistent. Save what you can, when you can, and adjust as needed. Every dollar saved toward your future is a win, no matter how small the amount.</p>
            
            <p><strong>Remember:</strong> The best time to start saving for big goals was yesterday. The second best time is right now.</p>
        `
    },
    'teen-budgeting': {
        title: 'Budgeting That Actually Works',
        category: 'budgeting',
        readTime: '6 min read',
        content: `
            <h2>Budgeting Without the Headache</h2>
            <p>Most budgeting advice is made for adults with jobs and bills. As a teen, your money situation is totally different. Here's how to budget in a way that actually works for your life.</p>
            
            <h3>🎯 Why Most Teen Budgets Fail</h3>
            <ul>
                <li>They're too complicated (spreadsheets with 50 categories)</li>
                <li>They don't account for irregular income (birthday money, side hustles)</li>
                <li>They're too strict (no fun money = you'll quit)</li>
                <li>They don't match your actual spending patterns</li>
            </ul>
            
            <h3>💡 The 3-Category Budget</h3>
            <p>Forget complicated systems. Start with just three categories:</p>
            <ul>
                <li><strong>Needs (50%)</strong> - Things you absolutely have to buy</li>
                <li><strong>Wants (30%)</strong> - Fun stuff, social life, entertainment</li>
                <li><strong>Savings (20%)</strong> - Future goals, emergency fund</li>
            </ul>
            
            <h4>What goes in each category?</h4>
            <p><strong>Needs (50%):</strong></p>
            <ul>
                <li>Lunch money (if you don't pack)</li>
                <li>Transportation (bus fare, gas for family car)</li>
                <li>Phone bill (if you pay it)</li>
                <li>School supplies</li>
                <li>Essential clothes (when stuff wears out)</li>
            </ul>
            
            <p><strong>Wants (30%):</strong></p>
            <ul>
                <li>Games, apps, in-app purchases</li>
                <li>Movies, concerts, events</li>
                <li>Clothes shopping (beyond basics)</li>
                <li>Eating out with friends</li>
                <li>Snacks, drinks, treats</li>
            </ul>
            
            <p><strong>Savings (20%):</strong></p>
            <ul>
                <li>College fund</li>
                <li>Car savings</li>
                <li>Emergency fund</li>
                <li>Big purchases (phone, laptop)</li>
            </ul>
            
            <h3>📱 Apps That Make Budgeting Easy</h3>
            
            <h4>For Beginners</h4>
            <ul>
                <li><strong>GoHenry/Current</strong> - Debit cards for teens with spending tracking</li>
                <li><strong>Greenlight</strong> - Parent-controlled with savings goals</li>
                <li><strong>FamZoo</strong> - Family banking with chore tracking</li>
            </ul>
            
            <h4>For More Advanced Users</h4>
            <ul>
                <li><strong>Mint</strong> - Free, connects to bank accounts, shows spending patterns</li>
                <li><strong>YNAB</strong> - More detailed, subscription but powerful</li>
                <li><strong>Personal Capital</strong> - Good for tracking savings goals</li>
            </ul>
            
            <h3>📓 The Low-Tech Method</h3>
            <p>Apps aren't for everyone. Try this:</p>
            <ol>
                <li>Get 3 envelopes: Needs, Wants, Savings</li>
                <li>When you get money, split it 50/30/20 into envelopes</li>
                <li>Only spend from the right envelope</li>
                <li>When envelope is empty, you're done for that category</li>
            </ol>
            
            <h3>⚡ Quick Budget Methods</h3>
            
            <h4>The Weekly Reset</h4>
            <p>Every Sunday, decide how you'll spend your money for the week. This works well if you get allowance weekly or have a part-time job.</p>
            
            <h4>The "Pay Yourself First" Method</h4>
            <p>The moment you get money, put 20% in savings BEFORE spending anything. Then budget what's left.</p>
            
            <h4>The Zero-Based Budget</h4>
            <p>Every dollar has a job. Income minus expenses equals zero. Good for when you have consistent income from a job.</p>
            
            <h3>🔄 Adjusting Your Budget</h3>
            
            <h4>When Life Changes</h4>
            <p>Your budget should change when:</p>
            <ul>
                <li>You get a job (more income)</li>
                <li>School starts (different expenses)</li>
                <li>Summer break (more social spending)</li>
                <li>You get a car (gas, insurance costs)</li>
            </ul>
            
            <h4>Monthly Check-ins</h4>
            <p>Once a month, ask yourself:</p>
            <ul>
                <li>Did this budget work for me?</li>
                <li>Where did I overspend?</li>
                <li>What categories need adjusting?</li>
                <li>Am I saving enough for my goals?</li>
            </ul>
            
            <h3>💸 Handling Irregular Money</h3>
            
            <h4>Birthday/Holiday Money</h4>
            <ul>
                <li>50% to long-term savings (college, car)</li>
                <li>30% to something fun you want now</li>
                <li>20% to emergency fund</li>
            </ul>
            
            <h4>Side Hustle Income</h4>
            <ul>
                <li>Save 30% for taxes (yes, teens might owe taxes)</li>
                <li>40% to specific goals</li>
                <li>30% to current wants</li>
            </ul>
            
            <h3>🚫 Budgeting Mistakes to Avoid</h3>
            
            <h4>Common Teen Budget Fails</h4>
            <ul>
                <li><strong>Forgetting small purchases</strong> - snacks, apps, random stuff adds up</li>
                <li><strong>Being too strict</strong> - no fun budget = you'll give up entirely</li>
                <li><strong>Not tracking</strong> - you can't budget if you don't know where money goes</li>
                <li><strong>Comparing to friends</strong> - everyone's situation is different</li>
                <li><strong>Giving up after one mistake</strong> - budgets take time to perfect</li>
            </ul>
            
            <h3>🎯 Making Your Budget Stick</h3>
            
            <h4>Week 1: Track Everything</h4>
            <p>Write down EVERY purchase for one week. No judgment, just data. You'll be surprised where money actually goes.</p>
            
            <h4>Week 2: Set Up Your System</h4>
            <p>Choose your method (app, envelope, spreadsheet) and set up your 50/30/20 categories.</p>
            
            <h4>Week 3: Test Drive</h4>
            <p>Try following your budget. Don't worry if it's perfect - just see how it feels.</p>
            
            <h4>Week 4: Adjust and Continue</h4>
            <p>Tweak what's not working and keep going. Budgeting gets easier with time.</p>
            
            <h3>💪 Pro Tips</h3>
            <ol>
                <li><strong>Use cash for fun spending</strong> - you'll spend less when you see the money leave</li>
                <li><strong>Automate savings</strong> - set up transfers so you don't have to think about it</li>
                <li><strong>Have a "splurge fund"</strong> - guilt-free spending money</li>
                <li><strong>Review with parents</strong> - they can help spot things you're missing</li>
                <li><strong>Celebrate small wins</strong> - stuck to your budget for a month? Do something fun</li>
            </ol>
            
            <h3>🏆 The Goal</h3>
            <p>A good teen budget isn't about restriction - it's about control. When you budget, you're telling your money where to go instead of wondering where it went. Start simple, stay consistent, and adjust as needed.</p>
            
            <p><strong>Remember:</strong> The perfect budget doesn't exist. The best budget is the one you'll actually stick with.</p>
        `
    },
    'college-apps': {
        title: 'College Applications Without Breaking the Bank',
        category: 'future',
        readTime: '10 min read',
        content: `
            <h2>Smart Ways to Apply to College</h2>
            <p>College applications can cost hundreds of dollars if you're not careful. But there are ways to apply to multiple schools without going broke. Here's how to navigate the college application process on a budget.</p>
            
            <h3>💰 The Real Cost of College Applications</h3>
            
            <h4>Application Fees</h4>
            <p>Most colleges charge between $50-100 per application:</p>
            <ul>
                <li><strong>State schools:</strong> $50-75</li>
                <li><strong>Private schools:</strong> $75-100</li>
                <li><strong>Prestigious schools:</strong> $90-100+</li>
            </ul>
            
            <p>Applying to 10 schools could cost $500-1000 just in fees!</p>
            
            <h4>Other Hidden Costs</h4>
            <ul>
                <li>SAT/ACT test fees: $55-65 each</li>
               >SAT score reports: $12 per school</li>
               >ACT score reports: $16 per school</li>
                <li>Portfolio fees (for art/design schools): $10-30</li>
                <li>Transcript fees: $2-5 per school</li>
            </ul>
            
            <h3>🎯 How to Save Money on Applications</h3>
            
            <h4>Fee Waivers</h4>
            <p>Many colleges offer application fee waivers if you qualify:</p>
            <ul>
                <li><strong>Family income requirements:</strong> Usually under $65,000-80,000</li>
                <li><strong>First-generation student:</strong> First in family to attend college</li>
                <li><strong>Participate in fee waiver programs:</strong> College Board, NACAC</li>
                <li><strong>Meet specific criteria:</strong> Each school has different requirements</li>
            </ul>
            
            <h4>How to Get Fee Waivers</h4>
            <ol>
                <li>Check the Common Application fee waiver section</li>
                <li>Ask your school counselor (they can often help)</li>
                <li>Contact college admissions offices directly</li>
                <li>Look for "fee waiver eligible" on college websites</li>
            </ol>
            
            <h4>Free Application Days</h4>
            <p>Some states offer free application days:</p>
            <ul>
                <li><strong>Georgia:</strong> Georgia Apply to College Month</li>
                <li><strong>North Carolina:</strong> CFNC Free Application Week</li>
                <li><strong>Michigan:</strong> Michigan College Month</li>
                <li><strong>Check your state's education website</strong> for similar programs</li>
            </ul>
            
            <h3>📝 Smart Application Strategy</h3>
            
            <h4>Target Schools vs. Reach Schools</h4>
            <p>Instead of applying to 15+ schools, be strategic:</p>
            <ul>
                <li><strong>2-3 Safety schools:</strong> Where you're almost guaranteed admission</li>
                <li><strong>3-5 target schools:</strong> Where you have a good chance</li>
                <li><strong>2-3 reach schools:</strong> Where admission is possible but not guaranteed</li>
            </ul>
            
            <h4>Use the Common Application</h4>
            <p>Over 900 schools accept the Common App:</p>
            <ul>
                <li><strong>One application for multiple schools</strong></li>
                <li><strong>Reuse essays and recommendations</strong></li>
                <li><strong>Track all deadlines in one place</strong></li>
                <li><strong>Some schools waive fees for Common App users</strong></li>
            </ul>
            
            <h3>🧪 Test Score Strategies</h3>
            
            <h4>SAT/ACT Score Choice</h4>
            <p>Both tests let you choose which scores to send:</p>
            <ul>
                <li><strong>Only send your best scores</strong></li>
                <li><strong>Don't send scores that hurt your application</strong></li>
                <li><strong>Some schools are test-optional</strong> - check before paying to send scores</li>
            </ul>
            
            <h4>Free Test Prep Resources</h4>
            <ul>
                <li><strong>Khan Academy</strong> - Free SAT prep</li>
                <li><strong>ACT Academy</strong> - Free ACT prep</li>
                <li><strong>Your school's test prep programs</strong></li>
                <li><strong>Library resources</strong> - Many have test prep books</li>
            </ul>
            
            <h3>📚 Essay and Portfolio Tips</h3>
            
            <h4>Reuse Essays When Possible</h4>
            <ul>
                <li><strong>Common App essay</strong> - Goes to all Common App schools</li>
                <li><strong>Prompt variations</strong> - Adapt one essay for multiple prompts</li>
                <li><strong>Supplemental essays</strong> - These usually need to be unique</li>
            </ul>
            
            <h4>Free Essay Help</h4>
            <ul>
                <li><strong>English teachers</strong> - They often help students with college essays</li>
                <li><strong>School counselors</strong> - Can review and provide feedback</li>
                <li><strong>Writing centers</strong> - Some colleges offer free essay reviews</li>
                <li><strong>Peer review</strong> - Exchange essays with friends</li>
            </ul>
            
            <h3>🎓 Scholarship Applications</h3>
            
            <h4>Apply for Scholarships Early</h4>
            <ul>
                <li><strong>Many scholarships have early deadlines</strong></li>
                <li><strong>Some require separate applications</strong></li>
                <li><strong>Local scholarships often have less competition</strong></li>
                <li><strong>Apply for small scholarships too</strong> - they add up!</li>
            </ul>
            
            <h4>Free Scholarship Search</h4>
            <ul>
                <li><strong>Scholarships.com</strong> - Free database</li>
                <li><strong>Fastweb</strong> - Free, but requires registration</li>
                <li><strong>Your school's counseling office</strong> - Local scholarships</li>
                <li><strong>Community organizations</strong> - Rotary, Elks, etc.</li>
            </ul>
            
            <h3>💡 Money-Saving Application Timeline</h3>
            
            <h4>Junior Year (Spring)</h4>
            <ul>
                <li>Research schools and costs</li>
                <li>Start preparing for SAT/ACT</li>
                <li>Begin scholarship search</li>
                <li>Visit colleges if possible</li>
            </ul>
            
            <h4>Summer Before Senior Year</h4>
            <ul>
                <li>Take SAT/ACT if needed</li>
                <li>Start drafting essays</li>
                <li>Ask for recommendation letters</li>
                <li>Apply for early scholarships</li>
            </ul>
            
            <h4>Senior Year (Fall)</h4>
            <ul>
                <li>Submit applications (use fee waivers when possible)</li>
                <li>Apply for FAFSA (opens October 1)</li>
                <li>Continue scholarship applications</li>
                <li>Send test scores strategically</li>
            </ul>
            
            <h4>Senior Year (Spring)</h4>
            <ul>
                <li>Compare financial aid packages</li>
                <li>Apply for additional scholarships</li>
                <li>Make your final decision</li>
                <li>Notify schools by May 1</li>
            </ul>
            
            <h3>🚫 Application Mistakes to Avoid</h3>
            
            <h4>Costly Mistakes</h4>
            <ul>
                <li><strong>Applying to too many schools</strong> - Focus on quality over quantity</li>
                <li><strong>Not checking for fee waivers</strong> - You might qualify!</li>
                <li><strong>Missing deadlines</strong> - Some schools don't accept late applications</li>
                <li><strong>Paying for services you don't need</strong> - Essay editing, application coaching</li>
                <li><strong>Not applying for scholarships</strong> - Free money you're leaving on the table</li>
            </ul>
            
            <h3>🏆 The Bottom Line</h3>
            <p>College applications don't have to break the bank. With strategic planning, fee waivers, and smart choices, you can apply to multiple schools for under $100 in total fees.</p>
            
            <p><strong>Remember:</strong> The money you save on applications can go toward your college education itself!</p>
        `
    },
    'side-hustles': {
        title: 'Side Hustles That Actually Work for Teens',
        category: 'earning',
        readTime: '8 min read',
        content: `
            <h2>Make Money Without a Traditional Job</h2>
            <p>Not everyone can get a traditional part-time job. Maybe you don't have transportation, or your schedule is too packed with sports and homework. But there are plenty of ways to make money on your own schedule. Here are side hustles that actually work for teens.</p>
            
            <h3>💻 Digital Side Hustles</h3>
            
            <h4>1. Social Media Management</h4>
            <p>Local businesses need help with Instagram, TikTok, and Facebook:</p>
            <ul>
                <li><strong>What you'll do:</strong> Create posts, respond to comments, run small ad campaigns</li>
                <li><strong>Skills needed:</strong> Good with social media, basic marketing knowledge</li>
                <li><strong>Earnings:</strong> $15-30/hour or $200-500/month per client</li>
                <li><strong>How to start:</strong> Offer to manage a local business's social media for free for a month, then charge</li>
            </ul>
            
            <h4>2. Content Creation</h4>
            <p>YouTube, TikTok, Instagram can make money if you build an audience:</p>
            <ul>
                <li><strong>Popular niches for teens:</strong> Gaming, study tips, comedy, fashion, tech reviews</li>
                <li><strong>Monetization:</strong> Ads, sponsorships, affiliate links (after building audience)</li>
                <li><strong>Reality check:</strong> Takes 6-12 months to start earning money</li>
                <li><strong>Start small:</strong> Post consistently, focus on quality over quantity</li>
            </ul>
            
            <h4>3. Freelance Writing</h4>
            <p>If you're good at writing, you can get paid for it:</p>
            <ul>
                <li><strong>Types of writing:</strong> Blog posts, social media content, product descriptions</li>
                <li><strong>Where to find work:</strong> Upwork, Fiverr, local businesses</li>
                <li><strong>Earnings:</strong> $20-50/hour depending on experience</li>
                <li><strong>Build a portfolio:</strong> Write sample articles to show clients</li>
            </ul>
            
            <h4>4. Graphic Design</h4>
            <p>Design logos, social media graphics, posters:</p>
            <ul>
                <li><strong>Tools to learn:</strong> Canva (free), Adobe Express (free), GIMP (free)</li>
                <li><strong>Skills needed:</strong> Good eye for design, basic computer skills</li>
                <li><strong>Where to find work:</strong> Fiverr, 99designs, local businesses</li>
                <li><strong>Earnings:</strong> $25-75 per design</li>
            </ul>
            
            <h3>🏠 Local Services</h3>
            
            <h4>5. Tech Support for Seniors</h4>
            <p>Help older adults with technology:</p>
            <ul>
                <li><strong>Services:</strong> Setting up smartphones, teaching Zoom, fixing computer issues</li>
                <li><strong>Marketing:</strong> Post flyers at community centers, libraries</li>
                <li><strong>Earnings:</strong> $20-40/hour</li>
                <li><strong>Benefits:</strong> Flexible schedule, helping people, building references</li>
            </ul>
            
            <h4>6. Academic Tutoring</h4>
            <p>Help younger students with schoolwork:</p>
            <ul>
                <li><strong>Subjects in demand:</strong> Math, science, English, foreign languages</li>
                <li><strong>Earnings:</strong> $15-30/hour depending on subject and location</li>
                <li><strong>How to start:</strong> Tell parents, post on neighborhood apps, ask teachers for referrals</li>
                <li><strong>Requirements:</strong> Good grades in subjects you want to tutor</li>
            </ul>
            
            <h4>7. Music Lessons</h4>
            <p>If you play an instrument, teach beginners:</p>
            <ul>
                <li><strong>Popular instruments:</strong> Piano, guitar, ukulele, violin</li>
                <li><strong>Earnings:</strong> $20-40/hour for 30-minute lessons</li>
                <li><strong>Teach what you know:</strong> You don't need to be an expert, just better than beginners</li>
                <li><strong>Location:</strong> Your house, their house, or online via Zoom</li>
            </ul>
            
            <h4>8. Pet Services</h4>
            <p>Beyond basic dog walking:</p>
            <ul>
                <li><strong>Pet sitting:</strong> $25-50/day for overnight care</li>
                <li><strong>Dog training:</strong> Basic obedience training, $30-50/hour</li>
                <li><strong>Pet photography:</strong> $20-40 per session for pet owners</li>
                <li><strong>Grooming basics:</strong> Bathing, nail trimming for small dogs</li>
            </ul>
            
            <h3>🛍️ Creative Ventures</h3>
            
            <h4>9. Custom Crafts</h4>
            <p>Make and sell things people want:</p>
            <ul>
                <li><strong>Popular items:</strong> Jewelry, custom t-shirts, phone cases, art prints</li>
                <li><strong>Where to sell:</strong> Etsy, Instagram, local craft fairs, school events</li>
                <li><strong>Startup costs:</strong> Usually under $50 for materials</li>
                <li><strong>Tips:</strong> Start with one product, get good at it, then expand</li>
            </ul>
            
            <h4>10. Photography Services</h4>
            <p>Take photos for people and events:</p>
            <ul>
                <li><strong>Types:</strong> Senior photos, family portraits, event photography</li>
                <li><strong>Equipment needed:</strong> Decent smartphone or basic DSLR camera</li>
                <li><strong>Earnings:</strong> $50-200 per session depending on type</li>
                <li><strong>Build portfolio:</strong> Offer free sessions to friends first</li>
            </ul>
            
            <h4>11. Reselling Flips</h4>
            <p>Buy low, sell high:</p>
            <ul>
                <li><strong>What to flip:</strong> Clothes from thrift stores, furniture, electronics, sports equipment</li>
                <li><strong>Where to sell:</strong> Facebook Marketplace, Depop, Poshmark, eBay</li>
                <li><strong>Strategy:</strong> Clean items well, take good photos, research prices</li>
                <li><strong>Earnings:</strong> Varies widely, but can make $100-500/month</li>
            </ul>
            
            <h4>12. Event Help</h4>
            <p>Help with parties and events:</p>
            <ul>
                <li><strong>Services:</strong> Setup, cleanup, serving food, basic photography</li>
                <li><strong>Types of events:</strong> Birthday parties, family gatherings, community events</li>
                <li><strong>Earnings:</strong> $15-25/hour plus tips</li>
                <li><strong>How to find work:</strong> Word of mouth, local Facebook groups</li>
            </ul>
            
            <h3>💰 Managing Your Side Hustle Money</h3>
            
            <h4>Track Your Income</h4>
            <ul>
                <li><strong>Separate bank account</strong> - Keep business money separate</li>
                <li><strong>Save receipts</strong> - For tax deductions</li>
                <li><strong>Track expenses</strong> - Materials, transportation, software</li>
                <li><strong>Set aside money for taxes</strong> - 25-30% of earnings</li>
            </ul>
            
            <h4>Price Your Services</h4>
            <ul>
                <li><strong>Research competitors</strong> - See what others charge locally</li>
                <li><strong>Start slightly lower</strong> - Build reputation, then raise prices</li>
                <li><strong>Offer packages</strong> - Bundle services for better value</li>
                <li><strong>Be confident</strong> - Don't undervalue your skills</li>
            </ul>
            
            <h3>📱 Marketing Your Side Hustle</h3>
            
            <h4>Build Your Brand</h4>
            <ul>
                <li><strong>Professional social media</strong> - Create business accounts</li>
                <li><strong>Simple website or portfolio</strong> - Show off your work</li>
                <li><strong>Business cards</strong> - Hand out to potential clients</li>
                <li><strong>Ask for reviews</strong> - Build social proof</li>
            </ul>
            
            <h4>Find Your First Clients</h4>
            <ul>
                <li><strong>Start with friends and family</strong> - They're your first customers</li>
                <li><strong>Ask for referrals</strong> - Word of mouth is powerful</li>
                <li><strong>Join local groups</strong> - Facebook groups, community centers</li>
                <li><strong>Partner with complementary businesses</strong> - Photographers with event planners</li>
            </ul>
            
            <h3>⚖️ Legal and Safety Considerations</h3>
            
            <h4>Stay Legal</h4>
            <ul>
                <li><strong>Check local regulations</strong> - Some areas require business licenses</li>
                <li><strong>Parental permission</strong> - Make sure your parents approve</li>
                <li><strong>Written agreements</strong> - Simple contracts for bigger jobs</li>
                <li><strong>Insurance considerations</strong> - For activities with risk</li>
            </ul>
            
            <h4>Stay Safe</h4>
            <ul>
                <li><strong>Meet in public places</strong> - Coffee shops, libraries</li>
                <li><strong>Let parents know where you are</strong> - Share location and time</li>
                <li><strong>Trust your instincts</strong> - If something feels wrong, it probably is</li>
                <li><strong>Bring a friend</strong> - For jobs with new clients</li>
            </ul>
            
            <h3>🎯 Tips for Success</h3>
            
            <h4>Start Small</h4>
            <ul>
                <li><strong>Don't quit your day job</strong> - Keep school as priority</li>
                <li><strong>Choose one side hustle</strong> - Master it before adding others</li>
                <li><strong>Be reliable</strong> - Show up on time, do quality work</li>
                <li><strong>Communicate well</strong> - Keep clients updated</li>
            </ul>
            
            <h4>Scale Up</h4>
            <ul>
                <li><strong>Reinvest earnings</strong> - Better equipment, marketing</li>
                <li><strong>Build systems</strong> - Templates, processes for efficiency</li>
                <li><strong>Outsource when possible</strong> - Focus on your strengths</li>
                <li><strong>Network constantly</strong> - Your next client comes from your last one</li>
            </ul>
            
            <h3>🏆 The Bottom Line</h3>
            <p>Side hustles can teach you valuable business skills while making good money. Start small, be professional, and don't be afraid to charge what you're worth. The experience you gain now will help you throughout your career.</p>
            
            <p><strong>Remember:</strong> The best side hustle is one you enjoy and can do consistently. Pick something that interests you and give it your best effort!</p>
        `
    },
    'credit-cards': {
        title: 'Credit Cards for Teens: What You Need to Know',
        category: 'future',
        readTime: '7 min read',
        content: `
            <h2>Understanding Credit Cards Before You Turn 18</h2>
            <p>Credit cards can be powerful tools or dangerous traps. Learning how they work now can save you from expensive mistakes later. Here's everything teens need to know about credit cards.</p>
            
            <h3>💳 What Actually Is a Credit Card?</h3>
            
            <h4>The Basics</h4>
            <p>A credit card is basically a short-term loan from a bank:</p>
            <ul>
                <li><strong>You borrow money</strong> to make purchases</li>
                <li><strong>You have a grace period</strong> (usually 21-25 days) to pay it back</li>
                <li><strong>If you pay in full</strong> during grace period, no interest charged</li>
                <li><strong>If you carry a balance</strong>, you pay high interest on remaining amount</li>
            </ul>
            
            <h4>Credit Limit</h4>
            <p>This is the maximum amount you can borrow:</p>
            <ul>
                <li><strong>Student cards:</strong> Usually $500-2,000</li>
                <li><strong>Secured cards:</strong> Equals your security deposit</li>
                <li><strong>Au</strong> <strong>thorized user cards:</strong> Limit set by primary cardholder</li>
            </ul>
            
            <h3>📋 Types of Credit Cards Available to Teens</h3>
            
            <h4>Authorized User Cards</h4>
            <p>Most common option for teens under 18:</p>
            <ul>
                <li><strong>How it works:</strong> Added to parent's existing credit card</li>
                <li><strong>Pros:</strong> No credit check, builds credit history, parent controls</li>
                <li><strong>Cons:</strong> Parent responsible for charges, limited independence</li>
                <li><strong>Best for:</strong> Learning responsible credit use with parental guidance</li>
            </ul>
            
            <h4>Student Credit Cards</h4>
            <p>Available to college students (18+):</p>
            <ul>
                <li><strong>Requirements:</strong> Proof of enrollment, income (part-time job, allowance)</li>
                <li><strong>Benefits:</strong> Cash back, rewards, lower interest rates</li>
                <li><strong>Popular options:</strong> Discover Student, Chase Freedom Student, Capital One Journey</li>
                <li><strong>Credit limits:</strong> Usually start at $500-1,000</li>
            </ul>
            
            <h4>Secured Credit Cards</h4>
            <p>Available to anyone 18+ with security deposit:</p>
            <ul>
                <li><strong>How it works:</strong> You deposit $200-500, that becomes your credit limit</li>
                <li><strong>Benefits:</strong> Builds credit, graduates to unsecured cards after 6-12 months</li>
                <li><strong>Security deposit:</strong> Refundable when you close account or upgrade</li>
                <li><strong>Good option:</strong> If you can't get approved for regular cards</li>
            </ul>
            
            <h3>💰 Understanding Interest and Fees</h3>
            
            <h4>Interest Rates (APR)</h4>
            <p>This is what you pay if you don't pay in full:</p>
            <ul>
                <li><strong>Student cards:</strong> 15-25% APR</li>
                <li><strong>Regular cards:</strong> 18-30% APR for most people</li>
                <li><strong>Store cards:</strong> Often 25-30% APR</li>
                <li><strong>Cash advances:</strong> Even higher rates + fees</li>
            </ul>
            
            <h4>Common Fees</h4>
            <ul>
                <li><strong>Annual fee:</strong> $0-95 (many student cards have no annual fee)</li>
                <li><strong>Late payment fee:</strong> $25-40</li>
                <li><strong>Cash advance fee:</strong> 3-5% of amount</li>
                <li><strong>Foreign transaction fee:</strong> 3% of purchases abroad</li>
            </ul>
            
            <h3>📈 How Credit Cards Affect Your Credit Score</h3>
            
            <h4>What Builds Good Credit</h4>
            <ul>
                <li><strong>Pay on time</strong> - Payment history is 35% of your score</li>
                <li><strong>Keep balances low</strong> - Use less than 30% of your limit</li>
                <li><strong>Keep old accounts open</strong> - Length of credit history matters</li>
                <li><strong>Apply sparingly</strong> - Too many applications hurts your score</li>
            </ul>
            
            <h4>What Hurts Your Credit</h4>
            <ul>
                <li><strong>Late payments</strong> - Can stay on your report for 7 years</li>
                <li><strong>High credit utilization</strong> - Using too much of your available credit</li>
                <li><strong>Too many inquiries</strong> - Multiple applications in short time</li>
                <li><strong>Maxed out cards</strong> - Using 90%+ of your limit</li>
            </ul>
            
            <h3>🎯 Smart Credit Card Strategies</h3>
            
            <h4>The Golden Rule</h4>
            <p><strong>Never charge more than you can pay off in full each month.</strong></p>
            <ul>
                <li><strong>Use for planned purchases only</strong> - Not impulse buys</li>
                <li><strong>Track your spending</strong> - Know what you're charging</li>
                <li><strong>Set up autopay</strong> - Never miss a payment</li>
                <li><strong>Pay statement balance in full</strong> - Avoid interest completely</li>
            </ul>
            
            <h4>Building Credit Safely</h4>
            <ul>
                <li><strong>Start with one card</strong> - Don't apply for multiple at once</li>
                <li><strong>Use it regularly</strong> - Make small purchases each month</li>
                <li><strong>Pay in full</strong> - Set up automatic payments</li>
                <li><strong>Monitor statements</strong> - Check for errors or fraud</li>
                <li><strong>Keep utilization low</strong> - Use less than 30% of limit</li>
            </ul>
            
            <h3>⚠️ Warning Signs of Credit Trouble</h3>
            
            <h4>Danger Signals</h4>
            <ul>
                <li><strong>Using credit cards for everyday expenses</strong> - Like food, gas, bills</li>
                <li><strong>Making only minimum payments</strong> - Interest adds up fast</li>
                <li><strong>Applying for new cards to pay off old ones</strong> - Dangerous cycle</li>
                <li><strong>Hiding purchases from parents</strong> - Sign of financial trouble</li>
                <li><strong>Maxing out cards</strong> - Can't afford current lifestyle</li>
            </ul>
            
            <h4>What to Do If You're in Trouble</h4>
            <ul>
                <li><strong>Stop using cards immediately</strong> - Cut them up if needed</li>
                <li><strong>Talk to your parents</strong> - They can help you make a plan</li>
                <li><strong>Create a budget</strong> - Figure out where your money is going</li>
                <li><strong>Focus on paying off highest interest cards first</strong></li>
                <li><strong>Consider a part-time job</strong> - Extra income helps pay down debt</li>
            </ul>
            
            <h3>🔒 Protecting Yourself from Fraud</h3>
            
            <h4>Security Tips</h4>
            <ul>
                <li><strong>Never share card details</strong> - Not even with friends</li>
                <li><strong>Use secure websites</strong> - Look for https:// in address bar</li>
                <li><strong>Monitor statements</strong> - Check for charges you didn't make</li>
                <li><strong>Report lost cards immediately</strong> - Call the card company right away</li>
                <li><strong>Use strong passwords</strong> - For online accounts</li>
            </ul>
            
            <h4>Common Scams Targeting Teens</h4>
            <ul>
                <li><strong>"Free trial" offers</strong> - That auto-renew into expensive subscriptions</li>
                <li><strong>"Get rich quick" schemes</strong> - Require upfront fees</li>
                <li><strong>Phishing emails</strong> - Fake emails asking for card information</li>
                <li><strong>Too-good-to-be-true deals</strong> - Usually scams</li>
            </ul>
            
            <h3>💡 Credit Card Alternatives</h3>
            
            <h4>Debit Cards</h4>
            <ul>
                <li><strong>How they work:</strong> Money comes directly from your bank account</li>
                <li><strong>Pros:</strong> Can't overspend, no interest, accepted everywhere</li>
                <li><strong>Cons:</strong> Don't build credit, fewer fraud protections</li>
                <li><strong>Best for:</strong> Everyday spending, learning to manage money</li>
            </ul>
            
            <h4>Prepaid Cards</h4>
            <ul>
                <li><strong>How they work:</strong> Load money onto card, spend until it's empty</li>
                <li><strong>Pros:</strong> Can't overspend, no credit check required</li>
                <li><strong>Cons:</strong> Often have fees, don't build credit</li>
                <li><strong>Best for:</strong> Teens who want plastic without credit risks</li>
            </ul>
            
            <h3>🎓 Preparing for Future Credit</h3>
            
            <h4>Before You Get Your First Card</h4>
            <ul>
                <li><strong>Open a checking account</strong> - Learn to manage bank account</li>
                <li><strong>Get a debit card</strong> - Practice responsible plastic use</li>
                <li><strong>Learn to budget</strong> - Track income and expenses</li>
                <li><strong>Save regularly</strong> - Build emergency fund first</li>
                <li><strong>Understand interest</strong> - Learn how compound interest works</li>
            </ul>
            
            <h4>When You're Ready for Credit</h4>
            <ul>
                <li><strong>Start with secured card</strong> - Safest way to build credit</li>
                <li><strong>Keep credit utilization low</strong> - Use only for small purchases</li>
                <li><strong>Set up automatic payments</strong> - Never miss due dates</li>
                <li><strong>Monitor your credit</strong> - Use free credit monitoring services</li>
                <li><strong>Graduate to better cards</strong> - As your credit improves</li>
            </ul>
            
            <h3>🏆 The Bottom Line</h3>
            <p>Credit cards are powerful financial tools that can help you build credit or lead to serious debt. The difference is knowledge and discipline. Use them responsibly, pay in full each month, and they'll help you achieve your financial goals faster.</p>
            
            <p><strong>Remember:</strong> The best credit card strategy is to treat it like a debit card - only spend what you have, and pay it off completely each month.</p>
        `
    },
    'scholarships': {
        title: 'Scholarship Guide: Finding Free Money for College',
        category: 'future',
        readTime: '9 min read',
        content: `
            <h2>How to Find and Win Scholarships</h2>
            <p>College is expensive, but there's billions of dollars in scholarships available. Most scholarships go unclaimed because students don't know where to look or don't apply correctly. Here's how to find and win scholarships for college.</p>
            
            <h3>💰 The Scholarship Landscape</h3>
            
            <h4>How Much Money is Available?</h4>
            <ul>
                <li><strong>Total available:</strong> Over $6 billion in scholarships annually</li>
                <li><strong>Average award:</strong> $2,000-10,000 per scholarship</li>
                <li><strong>Unclaimed money:</strong> Millions go unused each year</li>
                <li><strong>Your competition:</strong> Most students don't apply for many scholarships</li>
            </ul>
            
            <h4>Types of Scholarships</h4>
            <ul>
                <li><strong>Merit-based:</strong> Academic, athletic, artistic achievements</li>
                <li><strong>Need-based:</strong> Family income and financial need</li>
                <li><strong>Identity-based:</strong> Ethnicity, gender, religion, background</li>
                <li><strong>Career-specific:</strong> STEM, healthcare, teaching, etc.</li>
                <li><strong>Community-based:</strong> Local organizations, businesses</li>
            </ul>
            
            <h3>🔍 Where to Find Scholarships</h3>
            
            <h4>Online Scholarship Databases</h4>
            <ul>
                <li><strong>Scholarships.com</strong> - Largest database, free to use</li>
                <li><strong>Fastweb</strong> - Good matching algorithm, requires registration</li>
                <li><strong>Scholly</strong> - Mobile-first, AI-powered matching</li>
                <li><strong>Cappex</strong> - Comprehensive database with college info</li>
                <li><strong>Niche.com</strong> - Scholarship finder with college reviews</li>
            </ul>
            
            <h4>Local Sources</h4>
            <ul>
                <li><strong>Your high school counseling office</strong> - Local scholarships</li>
                <li><strong>Community foundations</strong> - Often less competitive</li>
                <li><strong>Local businesses</strong> - Companies in your area</li>
                <li><strong>Religious organizations</strong> - Churches, temples, mosques</li>
                <li><strong>Civic groups</strong> - Rotary, Elks, Kiwanis, Lions Club</li>
            </ul>
            
            <h4>College-Specific Scholarships</h4>
            <ul>
                <li><strong>Academic merit scholarships</strong> - Based on GPA/test scores</li>
                <li><strong>Talent scholarships</strong> - Music, art, theater, athletics</li>
                <li><strong>Departmental scholarships</strong> - For specific majors</li>
                <li><strong>Alumni scholarships</strong> - For children of graduates</li>
                <li><strong>Regional scholarships</strong> - Students from specific areas</li>
            </ul>
            
            <h3>📝 Scholarship Application Strategy</h3>
            
            <h4>Create a Scholarship Resume</h4>
            <p>Keep track of your achievements:</p>
            <ul>
                <li><strong>Academic:</strong> GPA, class rank, test scores, AP/IB classes</li>
                <li><strong>Extracurricular:</strong> Clubs, sports, volunteer work, leadership</li>
                <li><strong>Work experience:</strong> Jobs, internships, babysitting, lawn care</li>
                <li><strong>Awards:</strong> Academic, athletic, community service</li>
                <li><strong>Skills:</strong> Languages, computer skills, artistic talents</li>
            </ul>
            
            <h4>Master the Essay</h4>
            <ul>
                <li><strong>Read the prompt carefully</strong> - Address every part</li>
                <li><strong>Tell your story</strong> - Be authentic and personal</li>
                <li><strong>Focus on growth</strong> - How challenges shaped you</li>
                <li><strong>Connect to the scholarship</strong> - Why you're a good fit</li>
                <li><strong>Proofread carefully</strong> - No grammar or spelling errors</li>
            </ul>
            
            <h4>Get Great Recommendations</h4>
            <ul>
                <li><strong>Choose wisely:</strong> Teachers who know you well</li>
                <li><strong>Ask early</strong> - Give recommenders plenty of time</li>
                <li><strong>Provide materials:</strong> Resume, essay, achievements list</li>
                <li><strong>Follow up</strong> - Thank recommenders afterwards</li>
                <li><strong>Waive your right to see</strong> - Recs are more honest this way</li>
            </ul>
            
            <h3>🎯 Scholarship Application Timeline</h3>
            
            <h4>Freshman/Sophomore Year</h4>
            <ul>
                <li><strong>Focus on grades</strong> - Most important factor</li>
                <li><strong>Join clubs</strong> - Build leadership experience</li>
                <li><strong>Volunteer regularly</strong> - Community service looks great</li>
                <li><strong>Start saving achievements</strong> - Document everything</li>
                <li><strong>Practice writing</strong> - Essays get better with practice</li>
            </ul>
            
            <h4>Junior Year</h4>
            <ul>
                <li><strong>Take PSAT/NMSQT</strong> - Opens scholarship opportunities</li>
                <li><strong>Start scholarship search</strong> - Create list of opportunities</li>
                <li><strong>Ask for recommendations</strong> - From junior year teachers</li>
                <li><strong>Write practice essays</strong> - Common scholarship prompts</li>
                <li><strong>Apply for early deadlines</strong> - Some scholarships have junior year deadlines</li>
            </ul>
            
            <h4>Summer Before Senior Year</h4>
            <ul>
                <li><strong>Finalize scholarship list</strong> - Prioritize by deadline and amount</li>
                <li><strong>Write essays</strong> - Create templates, customize for each</li>
                <li><strong>Request transcripts</strong> - Get multiple copies</li>
                <li><strong>Ask for recommendations</strong> - From senior year teachers</li>
                <li><strong>Apply for early scholarships</strong> - Many have October/November deadlines</li>
            </ul>
            
            <h4>Senior Year Fall</h4>
            <ul>
                <li><strong>Apply for FAFSA</strong> - Opens October 1st, do it early</li>
                <li><strong>Submit applications</strong> - Aim for 10-15 per week</li>
                <li><strong>Track deadlines</strong> - Use spreadsheet or calendar</li>
                <li><strong>Follow up</strong> - Confirm applications were received</li>
                <li><strong>Apply for local scholarships</strong> - Often less competitive</li>
            </ul>
            
            <h4>Senior Year Spring</h4>
            <ul>
                <li><strong>Continue applying</strong> - Many deadlines in February/March</li>
                <li><strong>Accept awards</strong> - Notify schools of scholarships received</li>
                <li><strong>Thank donors</strong> - Send thank-you notes to scholarship providers</li>
                <li><strong>Report external scholarships</strong> - To colleges for financial aid</li>
            </ul>
            
            <h3>🏆 Scholarship Categories to Target</h3>
            
            <h4>Academic Merit Scholarships</h4>
            <ul>
                <li><strong>National Merit Scholarship</strong> - PSAT-based, up to $2,500</li>
                <li><strong>Coca-Cola Scholars</strong> - Leadership, community service</li>
                <li><strong>Gates Millennium</strong> - For minority students, full ride</li>
                <li><strong>Dell Scholars</strong> - For students with financial need</li>
                <li><strong>Horatio Alger</strong> - Overcoming adversity</li>
            </ul>
            
            <h4>Talent-Based Scholarships</h4>
            <ul>
                <li><strong>Athletic scholarships</strong> - NCAA Division I, II, III</li>
                <li><strong>Music scholarships</strong> - Instrumental, vocal</li>
                <li><strong>Art scholarships</strong> - Visual arts, design</li>
                <li><strong>Theater scholarships</strong> - Acting, technical theater</li>
                <li><strong>Dance scholarships</strong> - Various dance styles</li>
            </ul>
            
            <h4>Identity-Based Scholarships</h4>
            <ul>
                <li><strong>UNCF scholarships</strong> - African American students</li>
                <li><strong>HSF scholarships</strong> - Hispanic students</li>
                <li><strong>APIASF scholarships</strong> - Asian Pacific Islander</li>
                <li><strong>Point Foundation</strong> - LGBTQ+ students</li>
                <li><strong>Women's scholarships</strong> - Various fields of study</li>
            </ul>
            
            <h4>Career-Specific Scholarships</h4>
            <ul>
                <li><strong>STEM scholarships</strong> - Science, tech, engineering, math</li>
                <li><strong>Healthcare scholarships</strong> - Nursing, pre-med, allied health</li>
                <li><strong>Teaching scholarships</strong> - Education majors</li>
                <li><strong>Business scholarships</strong> - Business, finance, economics</li>
                <li><strong>Environmental scholarships</strong> - Conservation, sustainability</li>
            </ul>
            
            <h3>💡 Scholarship Application Tips</h3>
            
            <h4>Stand Out from the Crowd</h4>
            <ul>
                <li><strong>Be specific</strong> - Use numbers and examples in essays</li>
                <li><strong>Show, don't tell</strong> - Demonstrate qualities through stories</li>
                <li><strong>Be authentic</strong> - Don't write what you think they want to hear</li>
                <li><strong>Follow directions</strong> - Read all instructions carefully</li>
                <li><strong>Proofread everything</strong> - Typos can eliminate you</li>
            </ul>
            
            <h4>Avoid Common Mistakes</h4>
            <ul>
                <li><strong>One-size-fits-all essays</strong> - Customize for each scholarship</li>
                <li><strong>Missing deadlines</strong> - No exceptions, ever</li>
                <li><strong>Incomplete applications</strong> - Double-check all requirements</li>
                <li><strong>Poor grammar/spelling</strong> - Use spell check and grammar tools</li>
                <li><strong>Not following instructions</strong> - Page limits, formatting, etc.</li>
            </ul>
            
            <h4>Maximize Your Chances</h4>
            <ul>
                <li><strong>Apply for everything</strong> - Even small scholarships add up</li>
                <li><strong>Apply locally</strong> - Less competition than national awards</li>
                <li><strong>Apply early</strong> - Some scholarships give priority to early applicants</li>
                <li><strong>Apply annually</strong> - Many scholarships can be renewed</li>
                <li><strong>Apply for weird scholarships</strong> - Less competition, fun stories</li>
            </ul>
            
            <h3>🚫 Scholarship Scams to Avoid</h3>
            
            <h4>Red Flags</h4>
            <ul>
                <li><strong>Application fees</strong> - Legitimate scholarships don't charge to apply</li>
                <li><strong>Guaranteed awards</strong> - No scholarship is guaranteed</li>
                <li><strong>"You've won!" notifications</strong> - Unsolicited award notifications</li>
                <li><strong>Requests for personal info</strong> - Social security numbers, bank info</li>
                <li><strong>Pressure tactics</strong> - "Apply now or lose your spot"</li>
            </ul>
            
            <h4>How to Verify Legitimacy</h4>
                <ul>
                    <li><strong>Check with school counselor</strong> - They know legitimate scholarships</li>
                    <li><strong>Research the organization</strong> - Look for website, contact info</li>
                    <li><strong>Never pay application fees</strong> - Real scholarships are free</li>
                    <li><strong>Use reputable databases</strong> - Stick to well-known scholarship sites</li>
                    <li><strong>Trust your instincts</strong> - If it seems too good to be true, it probably is</li>
                </ul>
            
            <h3>📊 Scholarship Success Stories</h3>
            
            <h4>Real Examples</h4>
            <ul>
                <li><strong>Student A:</strong> Applied for 50 scholarships, won 12 totaling $45,000</li>
                <li><strong>Student B:</strong> Focused on local scholarships, won $15,000</li>
                <li><strong>Student C:</strong> Won full ride through combination of merit and need-based aid</li>
                <li><strong>Student D:</strong> Applied for weird scholarships, won $8,000 in unusual awards</li>
            </ul>
            
            <h4>What Worked for Them</h4>
            <ul>
                <li><strong>Started early</strong> - Began researching in sophomore year</li>
                <li><strong>Applied consistently</strong> - Treated it like a part-time job</li>
                <li><strong>Wrote compelling essays</strong> - Told authentic stories</li>
                <li><strong>Followed directions</strong> - Met all requirements perfectly</li>
                <li><strong>Applied broadly</strong> - Didn't limit themselves</li>
            </ul>
            
            <h3>🏆 The Bottom Line</h3>
            <p>Scholarships are essentially free money for college, but they require work and strategy. Start early, apply consistently, and don't get discouraged by rejections. Every scholarship you win is money you don't have to borrow or earn.</p>
            
            <p><strong>Remember:</strong> The scholarship search is a marathon, not a sprint. Stay organized, be persistent, and celebrate every win - even the small ones!</p>
        `
    },
    'crypto-basics': {
        title: 'Cryptocurrency for Teens: What You Need to Know',
        category: 'investing',
        readTime: '8 min read',
        content: `
            <h2>Crypto Explained for Beginners</h2>
            <p>Everyone's talking about Bitcoin, Ethereum, and NFTs, but what actually is cryptocurrency? Should teens invest in crypto? Here's what you need to know before jumping in.</p>
            
            <h3>🪙 What is Cryptocurrency?</h3>
            
            <h4>The Basic Idea</h4>
            <p>Cryptocurrency is digital money that uses special math (cryptography) to secure transactions. Unlike regular money, it's not controlled by any government or bank.</p>
            
            <h4>Key Features</h4>
            <ul>
                <li><strong>Decentralized:</strong> No single person or company controls it</li>
                <li><strong>Digital only:</strong> No physical coins or bills</li>
                <li><strong>Global:</strong> Can be sent anywhere in the world instantly</li>
                <li><strong>Limited supply:</strong> Most cryptos have a fixed maximum amount</li>
            </ul>
            
            <h3>📈 Popular Cryptocurrencies</h3>
            
            <h4>Bitcoin (BTC)</h4>
            <ul>
                <li><strong>The original:</strong> Created in 2009 by someone called Satoshi Nakamoto</li>
                <li><strong>Digital gold:</strong> Often seen as a store of value</li>
                <li><strong>Limited supply:</strong> Only 21 million Bitcoin will ever exist</li>
                <li><strong>Price:</strong> Has gone from pennies to over $60,000 per Bitcoin</li>
            </ul>
            
            <h4>Ethereum (ETH)</h4>
            <ul>
                <li><strong>More than money:</strong> Can run smart contracts and apps</li>
                <li><strong>NFTs:</strong> Most NFTs are built on Ethereum</li>
                <li><strong>DeFi:</strong> Home to decentralized finance applications</li>
                <li><strong>Second largest:</strong> After Bitcoin by market value</li>
            </ul>
            
            <h4>Other Popular Ones</h4>
            <ul>
                <li><strong>Cardano (ADA):</strong> Focus on sustainability and low fees</li>
                <li><strong>Solana (SOL):</strong> Very fast and cheap transactions</li>
                <li><strong>Polkadot (DOT):</strong> Connects different blockchains</li>
                <li><strong>Dogecoin (DOGE):</strong> Started as a joke, now very popular</li>
            </ul>
            
            <h3>🛒 How to Buy Crypto</h3>
            
            <h4>Crypto Exchanges</h4>
            <p>These are like stock markets for cryptocurrency:</p>
            <ul>
                <li><strong>Coinbase:</strong> Most beginner-friendly, good for teens with parental permission</li>
                <li><strong>Binance:</strong> Largest exchange, lots of options</li>
                <li><strong>Kraken:</strong> Good security, reputable</li>
                <li><strong>Robinhood:</strong> Easy if you already use it for stocks</li>
            </ul>
            
            <h4>Step-by-Step Process</h4>
            <ol>
                <li><strong>Get parental permission</strong> - Most exchanges require 18+</li>
                <li><strong>Choose an exchange</strong> - Research fees and security</li>
                <li><strong>Verify identity</strong> - Usually need ID and sometimes parent's help</li>
                <li><strong>Add money</strong> - Bank transfer or debit card</li>
                <li><strong>Buy crypto</strong> - Start with small amounts</li>
                <li><strong>Store safely</strong> - Keep in secure wallet</li>
            </ol>
            
            <h3>🔒 Keeping Your Crypto Safe</h3>
            
            <h4>Hot Wallets (Online)</h4>
            <ul>
                <li><strong>Exchange wallets:</strong> Convenient but less secure</li>
                <li><strong>Software wallets:</strong> Apps on your phone (Trust Wallet, MetaMask)</li>
                <li><strong>Good for:</strong> Small amounts, frequent trading</li>
                <li><strong>Risks:</strong> Can be hacked if your phone is compromised</li>
            </ul>
            
            <h4>Cold Wallets (Offline)</h4>
            <ul>
                <li><strong>Hardware wallets:</strong> Physical devices (Ledger, Trezor)</li>
                <li><strong>Paper wallets:</strong> Private keys printed on paper</li>
                <li><strong>Good for:</strong> Large amounts, long-term storage</li>
                <li><strong>Pros:</strong> Much more secure, can't be hacked online</li>
            </ul>
            
            <h4>Security Tips</h4>
            <ul>
                <li><strong>Never share private keys</strong> - Not with anyone, ever</li>
                <li><strong>Use two-factor authentication</strong> - On all accounts</li>
                <li><strong>Watch out for scams</strong> - "Send me crypto and I'll double it"</li>
                <li><strong>Keep backups</strong> - Write down recovery phrases securely</li>
                <li><strong>Start small</strong> - Only invest what you can afford to lose</li>
            </ul>
            
            <h3>💰 Should Teens Invest in Crypto?</h3>
            
            <h4>The Pros</h4>
            <ul>
                <li><strong>High potential returns</strong> - Some cryptos have grown 100x+</li>
                <li><strong>Learn about technology</strong> - Understanding blockchain is valuable</li>
                <li><strong>Financial independence</strong> - Control your own money</li>
                <li><strong>Global access</strong> - Can send money anywhere instantly</li>
            </ul>
            
            <h4>The Cons (Important!)</h4>
            <ul>
                <li><strong>Extremely volatile</strong> - Prices can drop 50% in one day</li>
                <li><strong>No regulations</strong> - If you get scammed, there's no protection</li>
                <li><strong>Technical complexity</strong> - Easy to make expensive mistakes</li>
                <li><strong>Age restrictions</strong> - Most platforms require 18+</li>
            </ul>
            
            <h4>Smart Approach for Teens</h4>
            <ul>
                <li><strong>Start with education</strong> - Learn before investing</li>
                <li><strong>Use parental accounts</strong> - With permission and supervision</li>
                <li><strong>Invest tiny amounts</strong> - $10-50 to start</li>
                <li><strong>Focus on learning</strong> - Not getting rich quick</li>
                <li><strong>Never invest more than you can lose</strong> - Seriously</li>
            </ul>
            
            <h3>🎯 Crypto Investment Strategies</h3>
            
            <h4>Dollar Cost Averaging</h4>
            <p>Invest the same amount regularly, regardless of price:</p>
            <ul>
                <li><strong>Reduces risk</strong> - Don't try to time the market</li>
                <li><strong>Builds discipline</strong> - Regular investing habits</li>
                <li><strong>Example:</strong> $10 every week, no matter the price</li>
            </ul>
            
            <h4>Long-Term Holding</h4>
            <ul>
                <li><strong>HODL:</strong> Crypto slang for holding long-term</li>
                <li><strong>Reduces stress</strong> - Don't panic during price drops</li>
                <li><strong>Historically works</strong> - Long-term crypto trends are generally up</li>
            </ul>
            
            <h4>Diversification</h4>
            <ul>
                <li><strong>Don't go all-in on one crypto</strong> - Spread risk</li>
                <li><strong>Consider Bitcoin + Ethereum</strong> - As foundation</li>
                <li><strong>Small positions in others</strong> - For higher risk/reward</li>
                <li><strong>Balance with traditional investments</strong> - Don't forget stocks</li>
            </ul>
            
            <h3>⚠️ Common Crypto Mistakes</h3>
            
            <h4>Beginner Errors</h4>
            <ul>
                <li><strong>FOMO buying</strong> - Fear of missing out, buying at the top</li>
                <li><strong>Panic selling</strong> - Selling during price drops</li>
                <li><strong>Following hype</strong> - Buying because of social media buzz</li>
                <li><strong>Ignoring security</strong> - Losing crypto to hacks</li>
                <li><strong>Investing too much</strong> - More than you can afford to lose</li>
            </ul>
            
            <h4>How to Avoid These</h4>
            <ul>
                <li><strong>Have a plan</strong> - Know when to buy and sell</li>
                <li><strong>Do your own research</strong> - Don't just follow influencers</li>
                <li><strong>Use proper security</strong> - Two-factor auth, secure wallets</li>
                <li><strong>Start small</strong> - Learn with small amounts</li>
                <li><strong>Think long-term</strong> - Don't expect overnight riches</li>
            </ul>
            
            <h3>🔮 The Future of Crypto</h3>
            
            <h4>What's Coming</h4>
            <ul>
                <li><strong>More adoption</strong> - Companies and countries using crypto</li>
                <li><strong>Better regulations</strong> - Government rules to protect investors</li>
                <li><strong>New technology</strong> - Faster, cheaper, more efficient</li>
                <li><strong>Integration</strong> - Crypto becoming part of everyday life</li>
            </ul>
            
            <h4>Careers in Crypto</h4>
            <ul>
                <li><strong>Blockchain developer</strong> - Building crypto applications</li>
                <li><strong>Crypto analyst</strong> - Researching and analyzing projects</li>
                <li><strong>Security expert</strong> - Protecting crypto assets</li>
                <li><strong>Crypto journalist</strong> - Writing about the industry</li>
            </ul>
            
            <h3>🏆 The Bottom Line</h3>
            <p>Cryptocurrency is exciting technology with huge potential, but it's also very risky. As a teen, focus on learning and investing small amounts you can afford to lose. The knowledge you gain now could be valuable for your future career, regardless of crypto prices.</p>
            
            <p><strong>Remember:</strong> Never invest more than you're willing to lose, and always get parental guidance when dealing with money and investments.</p>
        `
    },
    'first-job': {
        title: 'Your First Job: A Teen\'s Complete Guide',
        category: 'earning',
        readTime: '10 min read',
        content: `
            <h2>Landing Your First Job</h2>
            <p>Getting your first job is exciting and nerve-wracking. Whether you're 14 or 17, this guide will help you find, apply for, and succeed at your first job.</p>
            
            <h3>🔍 Finding Job Opportunities</h3>
            
            <h4>Age-Appropriate Jobs</h4>
            <ul>
                <li><strong>Age 14-15:</strong> Babysitting, pet sitting, lawn mowing, retail (limited hours)</li>
                <li><strong>Age 16-17:</strong> Retail, food service, movie theaters, tutoring, office work</li>
                <li><strong>Age 18+:</strong> Almost any job, plus tips for younger teens</li>
            </ul>
            
            <h4>Where to Look</h4>
            <ul>
                <li><strong>Local businesses</strong> - Restaurants, shops, offices</li>
                <li><strong>Chain stores</strong> - McDonald's, Target, grocery stores</li>
                <li><strong>Online job sites</strong> - Indeed, Snagajob (teen-friendly)</li>
                <li><strong>School resources</strong> - Job board, career counselor</li>
                <li><strong>Word of mouth</strong> - Tell everyone you're looking</li>
            </ul>
            
            <h4>Hidden Job Market</h4>
            <ul>
                <li><strong>Walk in and ask</strong> - Many places hire on the spot</li>
                <li><strong>Family connections</strong> - Parents' friends, relatives</li>
                <li><strong>Community events</strong> - Job fairs, local festivals</li>
                <li><strong>Social media</strong> - Local Facebook groups, Nextdoor</li>
            </ul>
            
            <h3>📝 Creating Your First Resume</h3>
            
            <h4>What to Include</h4>
            <ul>
                <li><strong>Contact info</strong> - Name, phone, email (professional address)</li>
                <li><strong>Education</strong> - School name, graduation year, GPA if good</li>
                <li><strong>Skills</strong> - Computer skills, languages, certifications</li>
                <li><strong>Experience</strong> - Even volunteer work counts</li>
                <li><strong>Activities</strong> - Sports, clubs, volunteer work</li>
            </ul>
            
            <h4>No Experience? No Problem!</h4>
            <ul>
                <li><strong>School projects</strong> - Leadership, teamwork, deadlines</li>
                <li><strong>Volunteer work</strong> - Shows responsibility and work ethic</li>
                <li><strong>Household responsibilities</strong> - Chores show reliability</li>
                <li><strong>Skills from hobbies</strong> - Gaming (problem-solving), sports (teamwork)</li>
            </ul>
            
            <h4>Resume Tips</h4>
            <ul>
                <li><strong>Keep it to one page</strong> - You don't have enough experience for more</li>
                <li><strong>Use action verbs</strong> - "Led," "Created," "Managed"</li>
                <li><strong>Quantify when possible</strong> - "Managed 5 kids," "Raised $500"</li>
                <li><strong>Proofread carefully</strong> - Ask parents or teachers to review</li>
            </ul>
            
            <h3>📋 The Application Process</h3>
            
            <h4>Filling Out Applications</h4>
            <ul>
                <li><strong>Be honest</strong> - Don't lie about experience or availability</li>
                <li><strong>Be thorough</strong> - Fill out every section</li>
                <li><strong>Be neat</strong> - Write clearly or type if possible</li>
                <li><strong>Follow instructions</strong> - If they say "apply in person," do it</li>
            </ul>
            
            <h4>Getting References</h4>
            <ul>
                <li><strong>Teachers</strong> - Most common for teens</li>
                <li><strong>Coaches</strong> - Show leadership and dedication</li>
                <li><strong>Volunteer coordinators</strong> - If you've volunteered</li>
                <li><strong>Family friends</strong> - If they know your work ethic</li>
                <li><strong>NEVER use parents</strong> - They're biased</li>
            </ul>
            
            <h4>Permission Forms</h4>
            <ul>
                <li><strong>Work permits</strong> - Required in some states for under 18</li>
                <li><strong>Parental consent</strong> - Some jobs need parent signature</li>
                <li><strong>School forms</strong> - Some schools require approval</li>
                <li><strong>Check local laws</strong> - Age restrictions vary by state</li>
            </ul>
            
            <h3>🎤 Nailing the Interview</h3>
            
            <h4>Before the Interview</h4>
            <ul>
                <li><strong>Research the company</strong> - Know what they do</li>
                <li><strong>Practice common questions</strong> - "Why do you want to work here?"</li>
                <li><strong>Prepare your own questions</strong> - Shows interest</li>
                <li><strong>Plan your outfit</strong> - Business casual is usually safe</li>
                <li><strong>Arrive early</strong> - 10-15 minutes before interview time</li>
            </ul>
            
            <h4>Common Interview Questions</h4>
            <ul>
                <li><strong>"Tell me about yourself"</strong> - Keep it 1-2 minutes, focus on strengths</li>
                <li><strong>"Why do you want this job?"</strong> - Show enthusiasm and research</li>
                <li><strong>"What are your strengths?"</strong> - Relate to job requirements</li>
                <li><strong>"What are your weaknesses?"</strong> - Choose something you're improving</li>
                <li><strong>"When can you work?"</strong> - Be honest about school/sports schedule</li>
            </ul>
            
            <h4>During the Interview</h4>
            <ul>
                <li><strong>Make eye contact</strong> - Shows confidence</li>
                <li><strong>Sit up straight</strong> - Body language matters</li>
                <li><strong>Speak clearly</strong> - Don't mumble or rush</li>
                <li><strong>Be enthusiastic</strong> - Show you actually want the job</li>
                <li><strong>Ask questions</strong> - Shows you're engaged</li>
            </ul>
            
            <h4>After the Interview</h4>
            <ul>
                <li><strong>Send thank-you note</strong> - Email or handwritten within 24 hours</li>
                <li><strong>Be patient</strong> - Don't call every day</li>
                <li><strong>Follow up once</strong> - If you don't hear back in a week</li>
                <li><strong>Keep applying</strong> - Don't wait for one response</li>
            </ul>
            
            <h3>💼 Succeeding at Your First Job</h3>
            
            <h4>First Week Tips</h4>
            <ul>
                <li><strong>Arrive early</strong> - At least 10 minutes before shift</li>
                <li><strong>Take notes</strong> - Write down procedures and names</li>
                <li><strong>Ask questions</strong> - Better to ask than to mess up</li>
                <li><strong>Be friendly</strong> - Introduce yourself to coworkers</li>
                <li><strong>Stay positive</strong> - Even when tasks are boring</li>
            </ul>
            
            <h4>Building Good Habits</h4>
            <ul>
                <li><strong>Be reliable</strong> - Never be late or call in sick unnecessarily</li>
                <li><strong>Be proactive</strong> - Look for tasks without being asked</li>
                <li><strong>Be teachable</strong> - Accept feedback gracefully</li>
                <li><strong>Be professional</strong> - No phone during work, appropriate language</li>
                <li><strong>Be honest</strong> - Admit mistakes immediately</li>
            </ul>
            
            <h4>Getting Along with Coworkers</h4>
            <ul>
                <li><strong>Respect everyone</strong> - Even coworkers younger than you</li>
                <li><strong>Avoid drama</strong> - Don't gossip or get involved in conflicts</li>
                <li><strong>Help others</strong> - If you finish your work, offer to help</li>
                <li><strong>Learn names quickly</strong> - Shows you care about the team</li>
                <li><strong>Be a good listener</strong> - Experienced workers know things</li>
            </ul>
            
            <h3>💸 Understanding Your Paycheck</h3>
            
            <h4>Types of Payment</h4>
            <ul>
                <li><strong>Hourly wage</strong> - Most common for teens</li>
                <li><strong>Salary</strong> - Rare for first jobs</li>
                <li><strong>Tips</strong> - Restaurant, delivery, service jobs</li>
                <li><strong>Commission</strong> - Sales jobs, rare for teens</li>
            </ul>
            
            <h4>Understanding Deductions</h4>
            <ul>
                <li><strong>Federal taxes</strong> - Usually 10-15% for most teens</li>
                <li><strong>State taxes</strong> - Varies by state</li>
                <li><strong>Social Security</strong> - 6.2% (you'll get this back later)</li>
                <li><strong>Medicare</strong> - 1.45% (healthcare for seniors)</li>
            </ul>
            
            <h4>Direct Deposit vs. Check</h4>
            <ul>
                <li><strong>Direct deposit</strong> - Goes straight to bank account</li>
                <li><strong>Physical check</strong> - You have to deposit it yourself</li>
                <li><strong>Cash tips</strong> - Take home immediately</li>
                <li><strong>Pay stub</strong> - Keep for taxes and records</li>
            </ul>
            
            <h3>⚖️ Balancing Work and School</h3>
            
            <h4>Time Management</h4>
            <ul>
                <li><strong>Prioritize school</strong> - Grades come first</li>
                <li><strong>Use a calendar</strong> - Track work, homework, activities</li>
                <li><strong>Study efficiently</strong> - Make the most of study time</li>
                <li><strong>Get enough sleep</strong> - Don't sacrifice health for work</li>
                <li><strong>Learn to say no</strong> - Don't overcommit</li>
            </ul>
            
            <h4>Legal Limits</h4>
            <ul>
                <li><strong>Age restrictions</strong> - When and how much you can work</li>
                <li><strong>School night limits</strong> - Usually can't work late on school nights</li>
                <li><strong>Break requirements</strong> - Must get breaks for longer shifts</li>
                <li><strong>Forbidden jobs</strong> - Some jobs too dangerous for teens</li>
                <li><strong>Check your state</strong> - Rules vary significantly</li>
            </ul>
            
            <h3>🚫 Common First Job Mistakes</h3>
            
            <h4>What Not to Do</h4>
            <ul>
                <li><strong>Calling in sick too often</strong> - Managers notice patterns</li>
                <li><strong>Being on your phone</strong> - Unless it's work-related</li>
                <li><strong>Gossiping about coworkers</strong> - Creates toxic environment</li>
                <li><strong>Arguing with customers</strong> - Stay professional always</li>
                <li><strong>Not asking for help</strong> - Better to ask than to fail</li>
            </ul>
            
            <h4>How to Recover from Mistakes</h4>
            <ul>
                <li><strong>Admit immediately</strong> - Don't try to hide errors</li>
                <li><strong>Apologize sincerely</strong> - Take responsibility</li>
                <li><strong>Fix the problem</strong> - Do what you can to make it right</li>
                <li><strong>Learn from it</strong> - Don't repeat the same mistake</li>
                <li><strong>Move on</strong> - Don't dwell on past errors</li>
            </ul>
            
            <h3>🏆 Making the Most of Your First Job</h3>
            
            <h4>Beyond the Paycheck</h4>
            <ul>
                <li><strong>Skills development</strong> - Communication, teamwork, time management</li>
                <li><strong>Networking</strong> - References and future opportunities</li>
                <li><strong>Work ethic</strong> - Building habits for future success</li>
                <li><strong>Financial literacy</strong> - Learning to manage money</li>
                <li><strong>Career exploration</strong> - Discover what you like/don't like</li>
            </ul>
            
            <h4>Planning for the Future</h4>
            <ul>
                <li><strong>Save for goals</strong> - College, car, other big purchases</li>
                <li><strong>Build resume</strong> - Each job makes you more employable</li>
                <li><strong>Get recommendations</strong> - Ask managers for LinkedIn recommendations</li>
                <li><strong>Consider promotions</strong> - Show initiative and ask about advancement</li>
                <li><strong>Explore careers</strong> - See if you like the industry</li>
            </ul>
            
            <h3>🎓 When to Move On</h3>
            
            <h4>Signs It's Time to Leave</h4>
            <ul>
                <li><strong>No growth opportunities</strong> - Can't advance or learn new skills</li>
                <li><strong>Toxic environment</strong> - Bad management or coworkers</li>
                <li><strong>Better opportunity</strong> - Higher pay or better hours elsewhere</li>
                <li><strong>Schedule conflicts</strong> - Can't balance with school anymore</li>
                <li><strong>Found your passion</strong> - Want to try a different field</li>
            </ul>
            
            <h4>How to Quit Professionally</h4>
            <ul>
                <li><strong>Give two weeks' notice</strong> - Standard professional courtesy</li>
                <li><strong>Write a resignation letter</strong> - Simple and professional</li>
                <li><strong>Offer to train replacement</strong> - Shows responsibility</li>
                <li><strong>Finish strong</strong> - Work hard until your last day</li>
                <li><strong>Stay in touch</strong> - Good references are valuable</li>
            </ul>
            
            <h3>🏆 The Bottom Line</h3>
            <p>Your first job is more than just a paycheck - it's a learning experience that teaches responsibility, time management, and valuable life skills. Focus on doing your best, learning as much as you can, and building relationships that will help you in future careers.</p>
            
            <p><strong>Remember:</strong> Everyone starts somewhere. Be patient with yourself, work hard, and your first job will open doors to many opportunities in the future!</p>
        `
    },
    'car-buying': {
        title: 'Buying Your First Car: A Teen\'s Guide',
        category: 'future',
        readTime: '12 min read',
        content: `
            <h2>Your First Car: The Complete Guide</h2>
            <p>Getting your first car is a huge milestone. But between finding the right car, getting insurance, and figuring out payments, it can be overwhelming. Here's everything you need to know about buying your first car as a teen.</p>
            
            <h3>💰 How Much Car Can You Afford?</h3>
            
            <h4>The 20% Rule</h4>
            <p>Financial experts recommend spending no more than 20% of your monthly income on car expenses:</p>
            <ul>
                <li><strong>Car payment</strong> - If financing</li>
                <li><strong>Insurance</strong> - Usually $100-300/month for teens</li>
                <li><strong>Gas</strong> - Depends on driving habits</li>
                <li><strong>Maintenance</strong> - Budget $50-100/month</li>
                <li><strong>Registration/taxes</strong> - Annual costs</li>
            </ul>
            
            <h4>Realistic Budget Example</h4>
            <p>If you earn $500/month from a part-time job:</p>
            <ul>
                <li><strong>Maximum car budget:</strong> $100/month (20% of income)</li>
                <li><strong>Insurance alone:</strong> $150-200/month (often more than the car!)</li>
                <li><strong>Reality check:</strong> Most teens need parent help with insurance</li>
            </ul>
            
            <h4>Hidden Costs to Consider</h4>
            <ul>
                <li><strong>Sales tax</strong> - 6-10% depending on state</li>
                <li><strong>Registration fees</strong> - $50-200 annually</li>
                <li><strong>Emissions testing</strong> - $20-50 in some states</li>
                <li><strong>Initial repairs</strong> - Budget $500-1,000 for used cars</li>
                <li><strong>Winter tires</strong> - If you live in cold climates</li>
            </ul>
            
            <h3>🚗 New vs. Used Cars</h3>
            
            <h4>Used Cars: The Smart Choice for Most Teens</h4>
            <ul>
                <li><strong>Lower price</strong> - More car for your money</li>
                <li><strong>Slower depreciation</strong> - Less value lost over time</li>
                <li><strong>Lower insurance</strong> - Cheaper to insure</li>
                <li><strong>Less worry</strong> - First ding isn't as painful</li>
                <li><strong>More options</strong> - Larger selection in your budget</li>
            </ul>
            
            <h4>When to Consider New</h4>
                <ul>
                    <li><strong>Great warranty</strong> - Peace of mind</li>
                    <li><strong>Latest safety features</strong> - Important for new drivers</li>
                    <li><strong>Better financing</strong> - Sometimes 0% deals available</li>
                    <li><strong>Known history</strong> - No previous owners or accidents</li>
                    <li><strong>Parent help</strong> - If parents are helping significantly</li>
                </ul>
            
            <h4>Best First Cars for Teens</h4>
            <ul>
                <li><strong>Honda Civic/Toyota Corolla</strong> - Reliable, good gas mileage</li>
                <li><strong>Honda Accord/Toyota Camry</strong> - Slightly larger, still reliable</li>
                <li><strong>Mazda3</strong> - Fun to drive, good safety ratings</li>
                <li><strong>Subaru Impreza</strong> - All-wheel drive, good safety</li>
                <li><strong>Ford Focus</strong> - Affordable, decent reliability</li>
            </ul>
            
            <h3>🔍 Finding the Right Car</h3>
            
            <h4>Where to Look</h4>
            <ul>
                <li><strong>Cars.com, Autotrader</strong> - Largest selection online</li>
                <li><strong>Craigslist</strong> - Local sellers, good deals, but be careful</li>
                <li><strong>Facebook Marketplace</strong> - Local, often good prices</li>
                <li><strong>Used car lots</strong> - Can test drive immediately</li>
                <li><strong>Family/friends</strong> - Often the best deals</li>
            </ul>
            
            <h4>Red Flags to Avoid</h4>
            <ul>
                <li><strong>Too good to be true prices</strong> - Probably scams or major issues</li>
                <li><strong>Sellers who pressure you</strong> - Take your time deciding</li>
                <li><strong>No maintenance records</strong> - Could indicate neglect</li>
                <li><strong>Salvage titles</strong> - Previously totaled cars</li>
                <li><strong>Multiple owners in short time</strong> - Problem car</li>
            </ul>
            
            <h4>Questions to Ask Sellers</h4>
            <ul>
                <li><strong>"Why are you selling?"</strong> - Reveals potential issues</li>
                <li><strong>"Has it been in any accidents?"</strong> - Check CarFax report</li>
                <li><strong>"Do you have maintenance records?"</strong> - Shows how well cared for</li>
                <li><strong>"What work has been done recently?"</strong> - Recent repairs</li>
                <li><strong>"Are there any issues I should know about?"</strong> - Honesty test</li>
            </ul>
            
            <h3>🔧 Inspecting and Test Driving</h3>
            
            <h4>Pre-Purchase Inspection</h4>
            <ul>
                <li><strong>Always get a mechanic's inspection</strong> - $100-200 well spent</li>
                <li><strong>Check CarFax/AutoCheck reports</strong> - Accident history, odometer</li>
                <li><strong>Look for rust</strong> - Especially in northern states</li>
                <li><strong>Check fluids</strong> - Oil, coolant, transmission fluid</li>
                <li><strong>Tire condition</strong> - Even wear, good tread</li>
            </ul>
            
            <h4>Test Drive Checklist</h4>
            <ul>
                <li><strong>Drive in different conditions</strong> - City, highway, hills</li>
                <li><strong>Test all features</strong> - AC, heat, radio, windows</li>
                <li><strong>Listen for strange noises</strong> - Brakes, engine, suspension</li>
                <li><strong>Check handling</strong> - Pulling to one side, vibrations</li>
                <li><strong>Park it</strong> - Test parking, backup camera if equipped</li>
            </ul>
            
            <h4>What to Look For</h4>
            <ul>
                <li><strong>Check engine light</strong> - Should be off when running</li>
                <li><strong>Exhaust smoke</strong> - Blue or white smoke indicates problems</li>
                <li><strong>Fluid leaks</strong> - Any drips under the car</li>
                <li><strong>Tire wear</strong> - Uneven wear indicates alignment issues</li>
                <li><strong>Brake performance</strong> - No squealing or pulling</li>
            </ul>
            
            <h3>💳 Paying for Your Car</h3>
            
            <h4>Cash Purchase</h4>
            <ul>
                <li><strong>No interest payments</strong> - Save money over time</li>
                <li><strong>Full ownership immediately</strong> - Can sell anytime</li>
                <li><strong>Limited options</strong> - Only what you can afford</li>
                <li><strong>Good discipline</strong> - Forces you to save</li>
            </ul>
            
            <h4>Financing Options</h4>
            <ul>
                <li><strong>Bank loan</strong> - Often better rates than dealer financing</li>
                <li><strong>Credit union</strong> - Usually best rates for members</li>
                <li><strong>Dealer financing</strong> - Convenient but often more expensive</li>
                <li><strong>Parent co-signer</strong> - Usually required for teens</li>
                <li><strong>Down payment</strong> - 20% recommended to avoid being underwater</li>
            </ul>
            
            <h4>Understanding Interest</h4>
            <ul>
                <li><strong>Higher rates for teens</strong> - Less credit history = higher risk</li>
                <li><strong>Shop around</strong> - Don't accept first offer</li>
                <li><strong>Shorter terms better</strong> - Less total interest paid</li>
                <li><strong>Read the fine print</strong> - Watch for prepayment penalties</li>
                <li><strong>Consider total cost</strong> - Not just monthly payment</li>
            </ul>
            
            <h3>🛡️ Car Insurance for Teens</h3>
            
            <h4>Why It's So Expensive</h4>
            <ul>
                <li><strong>Statistics</strong> - Teens have highest accident rates</li>
                <li><strong>Inexperience</strong> - New drivers are higher risk</li>
                <li><strong>Age factor</strong> - Insurance companies charge more for teens</li>
                <li><strong>Gender</strong> - Males typically pay more than females</li>
                <li><strong>Location</strong> - Urban areas cost more than rural</li>
            </ul>
            
            <h4>Ways to Save on Insurance</h4>
            <ul>
                <li><strong>Good student discount</strong> - 3.0 GPA or higher</li>
                <li><strong>Driver's ed course</strong> - Shows responsibility</li>
                <li><strong>Safe car</strong> - Newer cars with safety features</li>
                <li><strong>Higher deductible</strong> - Lower monthly payments</li>
                <li><strong>Parent's policy</strong> - Usually cheapest option</li>
            </ul>
            
            <h4>Types of Coverage</h4>
            <ul>
                <li><strong>Liability only</strong> - Cheapest, covers damage you cause</li>
                <li><strong>Collision</strong> - Covers damage to your car</li>
                <li><strong>Comprehensive</strong> - Theft, vandalism, weather damage</li>
                <li><strong>Uninsured motorist</strong> - If someone hits you without insurance</li>
                <li><strong>Full coverage</strong> - All of the above</li>
            </ul>
            
            <h3>📋 Paperwork and Legal Stuff</h3>
            
            <h4>Required Documents</h4>
            <ul>
                <li><strong>Title</strong> - Proof of ownership</li>
                <li><strong>Bill of sale</strong> - Receipt of purchase</li>
                <li><strong>Registration</strong> - Required to drive legally</li>
                <li><strong>Insurance card</strong> - Must be in car at all times</li>
                <li><strong>Driver's license</strong> - Obviously!</li>
            </ul>
            
            <h4>Transfer Process</h4>
            <ul>
                <li><strong>Sign title over</strong> - Both buyer and seller signatures</li>
                <li><strong>Get bill of sale</strong> - Protects both parties</li>
                <li><strong>Register within deadline</strong> - Usually 10-30 days</li>
                <li><strong>Get new plates</strong> - Or transfer existing plates</li>
                <li><strong>Pay sales tax</strong> - Usually done during registration</li>
            </ul>
            
            <h4>What NOT to Do</h4>
            <ul>
                <li><strong>Don't skip the title transfer</strong> - Illegal and risky</li>
                <li><strong>Don't drive without insurance</strong> - Huge fines and consequences</li>
                <li><strong>Don't pay in cash without receipt</strong> - No proof of purchase</li>
                <li><strong>Don't ignore registration deadlines</strong> - Late fees apply</li>
                <li><strong>Don't buy "as is" without inspection</strong> - No recourse if problems</li>
            </ul>
            
            <h3>🛠️ Maintaining Your First Car</h3>
            
            <h4>Regular Maintenance Schedule</h4>
            <ul>
                <li><strong>Oil changes</strong> - Every 3,000-5,000 miles</li>
                <li><strong>Tire rotation</strong> - Every 6,000-8,000 miles</li>
                <li><strong>Brake inspection</strong> - Every 12,000 miles</li>
                <li><strong>Fluid checks</strong> - Monthly</li>
                <li><strong>Annual inspection</strong> - Required in most states</li>
            </ul>
            
            <h4>Emergency Kit Essentials</h4>
            <ul>
                <li><strong>Jumper cables</strong> - Dead batteries happen</li>
                <li><strong>Spare tire</strong> - And jack to change it</li>
                <li><strong>Basic tools</strong> - Screwdriver, pliers, wrench</li>
                <li><strong>Flashlight</strong> - For nighttime issues</li>
                <li><strong>First aid kit</strong> - Always good to have</li>
            </ul>
            
            <h4>Learning Basic Repairs</h4>
            <ul>
                <li><strong>Change a tire</strong> - Essential skill</li>
                <li><strong>Jump start a battery</strong> - Common issue</li>
                <li><strong>Check oil level</strong> - Prevent engine damage</li>
                <li><strong>Replace wipers</strong> - Easy and important</li>
                <li><strong>Change air filter</strong> - Improves gas mileage</li>
            </ul>
            
            <h3>🚫 Common First Car Mistakes</h3>
            
            <h4>Financial Mistakes</h4>
            <ul>
                <li><strong>Buying too much car</strong> - Can't afford insurance and maintenance</li>
                <li><strong>Not budgeting for insurance</strong> - Often costs more than payment</li>
                <li><strong>Ignoring maintenance</strong> - Leads to expensive repairs</li>
                <li><strong>Modifying immediately</strong> - Expensive and can void warranty</li>
                <li><strong>Not shopping insurance rates</strong> - Can save hundreds</li>
            </ul>
            
            <h4>Safety Mistakes</h4>
            <ul>
                <li><strong>Distracted driving</strong> - Phones, friends, music</li>
                <li><strong>Driving too fast</strong> - Speeding tickets are expensive</li>
                <li><strong>Not wearing seatbelt</strong> - Obvious but crucial</li>
                <li><strong>Driving with too many friends</strong> - Increases distraction</li>
                <li><strong>Driving tired or emotional</strong> - Impairs judgment</li>
            </ul>
            
            <h4>Maintenance Mistakes</h4>
            <ul>
                <li><strong>Ignoring warning lights</strong> - Check engine means stop driving</li>
                <li><strong>Skipping oil changes</strong> - Destroys engines</li>
                <li><strong>Driving on bald tires</strong> - Dangerous and illegal</li>
                <li><strong>Ignoring strange noises</strong> - Small problems become big ones</li>
                <li><strong>Not washing car</strong> - Rust and paint damage</li>
            </ul>
            
            <h3>🎓 Building a Good Driving Record</h3>
            
            <h4>Why It Matters</h4>
            <ul>
                <li><strong>Insurance rates</strong> - Good record = lower premiums</li>
                <li><strong>Job opportunities</strong> - Some jobs require clean driving record</li>
                <li><strong>Future car purchases</strong> - Better financing rates</li>
                <li><strong>Safety</strong> - Most importantly, staying alive</li>
            </ul>
            
            <h4>Tips for Safe Driving</h4>
            <ul>
                <li><strong>Follow speed limits</strong> - They exist for a reason</li>
                <li><strong>No phone while driving</strong> - Not even at red lights</li>
                <li><strong>Limit passengers</strong> - Many states have teen passenger limits</li>
                <li><strong>Avoid night driving</strong> - Higher risk for new drivers</li>
                <li><strong>Take defensive driving</strong> - Can lower insurance rates</li>
            </ul>
            
            <h3>🏆 The Bottom Line</h3>
            <p>Your first car is a huge responsibility that teaches valuable life lessons about money, maintenance, and safety. Take your time finding the right car, budget for all costs, and prioritize safety over style. The freedom of having your own car is amazing, but it comes with serious responsibilities.</p>
            
            <p><strong>Remember:</strong> A reliable, paid-for car is always better than a fancy car with huge payments. Focus on getting something safe and dependable that you can actually afford!</p>
        `
    },
    'tax-guide': {
        title: 'Teen Tax Guide: What You Need to Know',
        category: 'future',
        readTime: '7 min read',
        content: `
            <h2>Taxes for Teens: The Complete Guide</h2>
            <p>Think you're too young to worry about taxes? Think again! If you have a job, earn money from side hustles, or have investment income, you might need to file taxes. Here's everything teens need to know about taxes.</p>
            
            <h3>📋 Do I Need to File Taxes?</h3>
            
            <h4>General Rules</h4>
            <p>You need to file if you meet ANY of these conditions:</p>
            <ul>
                <li><strong>Earned income over $13,850</strong> (2024 limit for single filers)</li>
                <li><strong>Unearned income over $1,250</strong> (from investments, savings interest)</li>
                <li><strong>Self-employment income over $400</strong> - This is important for side hustles!</li>
                <li><strong>Combined earned and unearned income</strong> over certain thresholds</li>
                <li><strong>Federal income tax withheld</strong> - You might get a refund!</li>
            </ul>
            
            <h4>Common Teen Scenarios</h4>
            <ul>
                <li><strong>Part-time job earning $5,000</strong> - Probably need to file</li>
                <li><strong>Babysitting earning $2,000</strong> - Need to file if over $400 self-employment</li>
                <li><strong>Summer job earning $1,500</strong> - Might not need to file, but could get refund</li>
                <li><strong>Investment income $500</strong> - Probably don't need to file</li>
                <li><strong>Combined income $3,000</strong> - Need to check specific rules</li>
            </ul>
            
            <h4>When You SHOULD File Even If Not Required</h4>
            <ul>
                <li><strong>To get a refund</strong> - If federal tax was withheld from paycheck</li>
                <li><strong>To claim education credits</strong> - If paying college expenses</li>
                <li><strong>To establish tax history</strong> - Good for future loans</li>
                <li><strong>To claim stimulus payments</strong> - If you missed any</li>
                <li><strong>To claim earned income credit</strong> - If you qualify</li>
            </ul>
            
            <h3>💰 Understanding Different Types of Income</h3>
            
            <h4>Earned Income</h4>
            <ul>
                <li><strong>Wages from jobs</strong> - Regular employment</li>
                <li><strong>Self-employment</strong> - Side hustles, freelancing</li>
                <li><strong>Tips</strong> - If you report them</li>
                <li><strong>Commissions</strong> - Sales jobs</li>
                <li><strong>Scholarships for room and board</strong> - Taxable portion</li>
            </ul>
            
            <h4>Unearned Income</h4>
            <ul>
                <li><strong>Bank interest</strong> - From savings accounts</li>
                <li><strong>Investment dividends</strong> - From stocks/ETFs</li>
                <li><strong>Capital gains</strong> - From selling investments</li>
                <li><strong>Trust distributions</strong> - From family trusts</li>
                <li><strong>Gift money</strong> - Generally not taxable to recipient</li>
            </ul>
            
            <h4>Self-Employment Income</h4>
            <ul>
                <li><strong>Mowing lawns</strong> - Cash payments</li>
                <li><strong>Babysitting</strong> - Regular gigs</li>
                <li><strong>Freelance work</strong> - Design, writing, tutoring</li>
                <li><strong>Selling crafts</strong> - Online or local</li>
                <li><strong>Gig economy</strong> - DoorDash, Uber (if 18+)</li>
            </ul>
            
            <h3>📝 Tax Forms You'll Encounter</h3>
            
            <h4>W-2: Wage and Tax Statement</h4>
            <ul>
                <li><strong>From employers</strong> - By January 31st each year</li>
                <li><strong>Shows wages earned</strong> - Box 1</li>
                <li><strong>Federal tax withheld</strong> - Box 2</li>
                <li><strong>Social Security/Medicare</strong> - Boxes 3-6</li>
                <li><strong>State tax info</strong> - Boxes 15-17</li>
            </ul>
            
            <h4>1099-INT: Interest Income</h4>
            <ul>
                <li><strong>From banks</strong> - If you earned $10+ in interest</li>
                <li><strong>Shows interest earned</strong> - Box 1</li>
                <li><strong>Usually for savings accounts</strong> - Or CDs</li>
            </ul>
            
            <h4>1099-MISC: Miscellaneous Income</h4>
            <ul>
                <li><strong>From clients</strong> - For freelance work</li>
                <li><strong>Shows non-employee compensation</strong> - Box 7</li>
                <li><strong>Common for side hustles</strong> - If paid $600+</li>
            </ul>
            
            <h4>1099-NEC: Nonemployee Compensation</h4>
            <ul>
                <li><strong>Newer form</strong> - Separates from 1099-MISC</li>
                <li><strong>For self-employment</strong> - Independent contractor work</li>
                <li><strong>Triggers self-employment tax</strong> - Even if under $400</li>
            </ul>
            
            <h3>🧮 Understanding Tax Deductions</h3>
            
            <h4>Standard Deduction</h4>
            <ul>
                <li><strong>2024 amount:</strong> $14,600 for single filers</li>
                <li><strong>Most teens take this</strong> - Simpler than itemizing</li>
                <li><strong>Reduces taxable income</strong> - Dollar for dollar</li>
                <li><strong>Automatic</strong> - No need to track expenses</li>
            </ul>
            
            <h4>Itemized Deductions</h4>
            <ul>
                <li><strong>Must exceed standard deduction</strong> - Rare for teens</li>
                <li><strong>Medical expenses</strong> - Over 7.5% of AGI</li>
                <li><strong>State and local taxes</strong> - Up to $10,000</li>
                <li><strong>Mortgage interest</strong> - Not relevant for most teens</li>
                <li><strong>Charitable donations</strong> - If you itemize</li>
            </ul>
            
            <h4>Business Expenses</h4>
            <ul>
                <li><strong>For self-employment</strong> - Deduct from business income</li>
                <li><strong>Supplies and materials</strong> - For your side hustle</li>
                <li><strong>Home office</strong> - If you have dedicated workspace</li>
                <li><strong>Vehicle expenses</strong> - Mileage for business use</li>
                <li><strong>Advertising</strong> - Promoting your services</li>
            </ul>
            
            <h3🧾 How to File Your Taxes</h3>
            
            <h4>Free Filing Options</h4>
            <ul>
                <li><strong>IRS Free File</strong> - If income under $79,000</li>
                <li><strong>TurboTax Free Edition</strong> - Simple returns only</li>
                <li><strong>H&R Block Free</strong> - Good for basic returns</li>
                <li><strong>Cash App Taxes</strong> - Completely free federal and state</li>
                <li><strong>Local VITA sites</strong> - Free help from volunteers</li>
            </ul>
            
            <h4>What You'll Need</h4>
            <ul>
                <li><strong>Social Security number</strong> - Or ITIN if you have one</li>
                <li><strong>Previous year's return</strong> - If you filed before</li>
                <li><strong>All income forms</strong> - W-2s, 1099s</li>
                <li><strong>Records of expenses</strong> - For self-employment</li>
                <li><strong>Bank account info</strong> - For direct deposit refunds</li>
            </ul>
            
            <h4>Step-by-Step Process</h4>
            <ol>
                <li><strong>Gather all documents</strong> - Income forms, expense records</li>
                <li><strong>Choose filing method</strong> - Software, professional, or paper</li>
                <li><strong>Fill out personal info</strong> - Name, address, SSN</li>
                <li><strong>Enter income</strong> - From all your W-2s and 1099s</li>
                <li><strong>Claim deductions</strong> - Usually standard deduction</li>
                <li><strong>Calculate taxes</strong> - Software does this automatically</li>
                <li><strong>File by deadline</strong> - Usually April 15th</li>
            </ol>
            
            <h3>💸 Understanding Self-Employment Tax</h3>
            
            <h4>What It Is</h4>
            <ul>
                <li><strong>Social Security tax</strong> - 12.4% of net earnings</li>
                <li><strong>Medicare tax</strong> - 2.9% of net earnings</li>
                <li><strong>Total: 15.3%</strong> - On self-employment income over $400</li>
                <li><strong>Employers normally pay half</strong> - Self-employed pay full amount</li>
            </ul>
            
            <h4>How to Calculate</h4>
            <ul>
                <li><strong>Net earnings = 92.35%</strong> - Of self-employment income</li>
                <li><strong>Pay tax on amount over $400</strong> - First $400 is exempt</li>
                <li><strong>Can deduct half</strong> - As "above-the-line" deduction</li>
                <li><strong>Example:</strong> $1,000 in freelance work = ~$140 in self-employment tax</li>
            </ul>
            
            <h4>Ways to Reduce It</h4>
            <ul>
                <li><strong>Track all expenses</strong> - Reduces net earnings</li>
                <li><strong>Home office deduction</strong> - If you have dedicated space</li>
                <li><strong>Retirement contributions</strong> - SEP-IRA for self-employed</li>
                <li><strong>Health insurance deduction</strong> - If you pay your own</li>
            </ul>
            
            <h3>🎓 Tax Benefits for Students</h3>
            
            <h4>American Opportunity Credit</h4>
            <ul>
                <li><strong>Up to $2,500 per student</strong> - Per year</li>
                <li><strong>100% of first $2,000</strong> - In expenses</li>
                <li><strong>25% of next $2,000</strong> - In expenses</li>
                <li><strong>40% refundable</strong> - Even if you owe no tax</li>
                <li><strong>Requirements:</strong> Undergraduate, enrolled at least half-time</li>
            </ul>
            
            <h4>Lifetime Learning Credit</h4>
            <ul>
                <li><strong>Up to $2,000 per return</strong> - 20% of first $10,000</li>
                <li><strong>For any education</strong> - Graduate, professional, or courses</li>
                <li><strong>No limit on years</strong> - Can claim every year</li>
                <li><strong>Not refundable</strong> - Can only reduce tax to zero</li>
            </ul>
            
            <h4>Student Loan Interest Deduction</h4>
            <ul>
                <li><strong>Up to $2,500</strong> - In interest paid</li>
                <li><strong>Above-the-line deduction</strong> - Don't need to itemize</li>
                <li><strong>Income limits apply</strong> - Phaseout starts at $75,000</li>
                <li><strong>Parents usually claim</strong> - If they paid the interest</li>
            </ul>
            
            <h3>💡 Tax Tips for Teens</h3>
            
            <h4>Smart Tax Planning</h4>
            <ul>
                <li><strong>Save for taxes</strong> - Set aside 25-30% of self-employment income</li>
                <li><strong>Track expenses</strong> - Use apps like QuickBooks Self-Employed</li>
                <li><strong>Make quarterly payments</strong> - If you'll owe $1,000+</li>
                <li><strong>Contribute to retirement</strong> - Reduces taxable income</li>
                <li><strong>Keep good records</strong> - For 3 years in case of audit</li>
            </ul>
            
            <h4>Common Mistakes to Avoid</h4>
            <ul>
                <li><strong>Not filing when required</strong> - Penalties and interest</li>
                <li><strong>Forgetting side hustle income</strong> - Common mistake</li>
                <li><strong>Not tracking expenses</strong> - Overpaying taxes</li>
                <li><strong>Missing deadlines</strong> - April 15th is usually the deadline</li>
                <li><strong>Throwing away records</strong> - Keep for 3 years</li>
            </ul>
            
            <h4>Getting Help</h4>
            <ul>
                <li><strong>Parents</strong> - Often can help with first return</li>
                <li><strong>School counselors</strong> - Sometimes offer tax help</li>
                <li><strong>VITA/TCE sites</strong> - Free tax help for low-income</li>
                <li><strong>Professional tax preparer</strong> - If situation is complex</li>
                <li><strong>IRS website</strong> - Lots of free resources</li>
            </ul>
            
            <h3>📊 Tax Planning for the Future</h3>
            
            <h4>Building Good Habits</h4>
            <ul>
                <li><strong>File every year</strong> - Even if not required</li>
                <li><strong>Keep organized records</strong> - Digital or paper system</li>
                <li><strong>Understand your bracket</strong> - Helps with planning</li>
                <li><strong>Plan for estimated taxes</strong> - If self-employed</li>
                <li><strong>Stay informed</strong> - Tax laws change regularly</li>
            </ul>
            
            <h4>Tax-Advantaged Accounts</h4>
            <ul>
                <li><strong>Roth IRA</strong> - Tax-free growth for teens</li>
                <li><strong>529 Plan</strong> - Tax-free college savings</li>
                <li><strong>Health Savings Account</strong> - If you have high-deductible plan</li>
                <li><strong>SEP-IRA</strong> - For self-employed teens</li>
            </ul>
            
            <h3>🏆 The Bottom Line</h3>
            <p>Taxes might seem complicated, but understanding them as a teen sets you up for financial success. Start simple, keep good records, and don't be afraid to ask for help. The skills you learn now will help you throughout your life.</p>
            
            <p><strong>Remember:</strong> When in doubt, file anyway. You might get a refund, and it's better to file and not owe than to not file and owe with penalties!</p>
        `
    }
};

// Enhanced Financial Insights functionality
function updateSpendingInsights() {
    const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
    
    if (expenses.length === 0) {
        document.getElementById('avgDailySpend').textContent = '$0.00';
        document.getElementById('biggestExpense').textContent = '$0.00';
        document.getElementById('frequentCategory').textContent = '-';
        document.getElementById('daysSinceLast').textContent = '0';
        return;
    }

    // Calculate average daily spend
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const daysSinceFirst = Math.max(1, Math.floor((Date.now() - new Date(expenses[expenses.length - 1].date)) / (1000 * 60 * 60 * 24)));
    const avgDaily = totalSpent / daysSinceFirst;
    document.getElementById('avgDailySpend').textContent = `$${avgDaily.toFixed(2)}`;

    // Find biggest expense
    const biggestExpense = expenses.reduce((max, exp) => exp.amount > max.amount ? exp : max, expenses[0]);
    document.getElementById('biggestExpense').textContent = `$${biggestExpense.amount.toFixed(2)}`;

    // Find most frequent category
    const categoryCounts = {};
    expenses.forEach(exp => {
        categoryCounts[exp.category] = (categoryCounts[exp.category] || 0) + 1;
    });
    const mostFrequent = Object.keys(categoryCounts).reduce((a, b) => categoryCounts[a] > categoryCounts[b] ? a : b);
    document.getElementById('frequentCategory').textContent = mostFrequent.charAt(0).toUpperCase() + mostFrequent.slice(1);

    // Days since last expense
    const lastExpense = expenses[0];
    const daysSinceLast = Math.floor((Date.now() - new Date(lastExpense.date)) / (1000 * 60 * 60 * 24));
    document.getElementById('daysSinceLast').textContent = daysSinceLast.toString();
}

// Savings Goals functionality
function addNewGoal() {
    const goalName = prompt('What are you saving for?');
    if (!goalName) return;

    const targetAmount = prompt('What is your target amount?');
    if (!targetAmount || isNaN(targetAmount)) return;

    const currentAmount = prompt('How much have you saved so far?');
    if (currentAmount === null || isNaN(currentAmount)) return;

    const goal = {
        name: goalName,
        target: parseFloat(targetAmount),
        current: parseFloat(currentAmount) || 0,
        created: new Date().toISOString()
    };

    let goals = JSON.parse(localStorage.getItem('savingsGoals') || '[]');
    goals.push(goal);
    localStorage.setItem('savingsGoals', JSON.stringify(goals));
    
    updateSavingsGoalsDisplay();
    showNotification('New savings goal added! 💰', 'success');
}

function updateSavingsGoalsDisplay() {
    const goals = JSON.parse(localStorage.getItem('savingsGoals') || '[]');
    const goalsContainer = document.getElementById('savingsGoals');
    
    if (goals.length === 0) {
        goalsContainer.innerHTML = '<p class="text-gray-500 text-center">No savings goals yet. Start by adding your first goal!</p>';
        return;
    }

    goalsContainer.innerHTML = goals.map((goal, index) => {
        const percentage = (goal.current / goal.target) * 100;
        const progressColor = percentage >= 75 ? 'bg-green-600' : percentage >= 50 ? 'bg-blue-600' : percentage >= 25 ? 'bg-yellow-600' : 'bg-red-600';
        
        return `
            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${goal.name}</span>
                    <span class="text-sm text-gray-600 dark:text-gray-400">$${goal.current.toFixed(2)} / $${goal.target.toFixed(2)}</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div class="${progressColor} h-2 rounded-full transition-all duration-500" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500">${percentage.toFixed(0)}% complete</span>
                    <button onclick="deleteGoal(${index})" class="text-xs text-red-600 hover:text-red-800">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function deleteGoal(index) {
    if (confirm('Are you sure you want to delete this goal?')) {
        let goals = JSON.parse(localStorage.getItem('savingsGoals') || '[]');
        goals.splice(index, 1);
        localStorage.setItem('savingsGoals', JSON.stringify(goals));
        updateSavingsGoalsDisplay();
        showNotification('Goal deleted', 'info');
    }
}

// Financial Health Score calculation
function updateFinancialHealthScore() {
    const financialData = JSON.parse(localStorage.getItem('financialData') || '{}');
    const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
    
    let score = 50; // Base score
    
    // Budget adherence (up to 25 points)
    const monthlyIncome = financialData.monthlyIncome || 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyExpenses = expenses
        .filter(exp => {
            const expDate = new Date(exp.date);
            return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);
    
    const budgetRatio = monthlyIncome > 0 ? monthlyExpenses / monthlyIncome : 1;
    if (budgetRatio <= 0.8) score += 25;
    else if (budgetRatio <= 0.9) score += 15;
    else if (budgetRatio <= 1.0) score += 5;
    
    // Savings rate (up to 15 points)
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
    if (savingsRate >= 20) score += 15;
    else if (savingsRate >= 10) score += 10;
    else if (savingsRate >= 5) score += 5;
    
    // Consistency (up to 10 points)
    const daysSinceFirst = expenses.length > 0 ? Math.floor((Date.now() - new Date(expenses[expenses.length - 1].date)) / (1000 * 60 * 60 * 24)) : 0;
    if (daysSinceFirst >= 30 && expenses.length >= 10) score += 10;
    else if (daysSinceFirst >= 14 && expenses.length >= 5) score += 5;
    
    // Update display
    const scoreElement = document.getElementById('healthScore');
    const scoreText = scoreElement.querySelector('.text-3xl') || scoreElement;
    const statusText = scoreElement.querySelector('.text-sm') || scoreElement.nextElementSibling;
    
    if (scoreText) {
        scoreText.textContent = score.toString();
    }
    
    if (statusText) {
        let status = 'Poor';
        let color = 'text-red-600';
        if (score >= 80) {
            status = 'Excellent';
            color = 'text-green-600';
        } else if (score >= 60) {
            status = 'Good';
            color = 'text-blue-600';
        } else if (score >= 40) {
            status = 'Fair';
            color = 'text-yellow-600';
        }
        statusText.textContent = status;
        statusText.className = `text-sm ${color} block`;
    }
    
    // Update progress circle
    const circle = document.querySelector('.text-green-500');
    if (circle) {
        const circumference = 2 * Math.PI * 56;
        const offset = circumference - (score / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }
}

// Enhanced article functionality
function loadMoreArticles() {
    showNotification('Loading more articles...', 'info');
    setTimeout(() => {
        showNotification('All articles loaded! 📚', 'success');
    }, 1000);
}

function openArticle(articleId) {
    showNotification(`Opening article: ${articleId}`, 'info');
    // In a real app, this would navigate to the full article
}

// Enhanced notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        type === 'warning' ? 'bg-yellow-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    notification.innerHTML = `
        <div class="flex items-center">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white/80 hover:text-white">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('animate-fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize all enhanced features
document.addEventListener('DOMContentLoaded', function() {
    // Update insights when expenses change
    const originalAddExpense = window.addExpense;
    window.addExpense = function() {
        originalAddExpense.apply(this, arguments);
        setTimeout(() => {
            updateSpendingInsights();
            updateFinancialHealthScore();
        }, 100);
    };
    
    const originalDeleteExpense = window.deleteExpense;
    window.deleteExpense = function() {
        originalDeleteExpense.apply(this, arguments);
        setTimeout(() => {
            updateSpendingInsights();
            updateFinancialHealthScore();
        }, 100);
    };
    
    // Initialize displays
    updateSpendingInsights();
    updateSavingsGoalsDisplay();
    updateFinancialHealthScore();
    
    // Add search functionality for articles
    document.getElementById('blogSearch')?.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const articles = document.querySelectorAll('#tips article');
        
        articles.forEach(article => {
            const title = article.querySelector('h3').textContent.toLowerCase();
            const description = article.querySelector('p').textContent.toLowerCase();
            
            if (title.includes(searchTerm) || description.includes(searchTerm)) {
                article.style.display = 'block';
            } else {
                article.style.display = 'none';
            }
        });
    });
    
    // Add category filter functionality
    document.getElementById('blogCategory')?.addEventListener('change', function(e) {
        const category = e.target.value;
        const articles = document.querySelectorAll('#tips article');
        
        articles.forEach(article => {
            const articleCategory = article.querySelector('.bg-red-100, .bg-yellow-100, .bg-green-100, .bg-purple-100, .bg-blue-100, .bg-indigo-100');
            
            if (!category || articleCategory.textContent.toLowerCase().includes(category.toLowerCase())) {
                article.style.display = 'block';
            } else {
                article.style.display = 'none';
            }
        });
    });
});
const financialTips = [
    "Save 10% of everything you get: Whether it's allowance, birthday money, or job earnings - put 10% away before spending anything!",
    "The 50/30/20 rule: 50% for needs (food, transport), 30% for wants (games, clothes), 20% for savings.",
    "Wait 24 hours before buying something expensive. If you still want it tomorrow, it's probably worth it.",
    "Pack your lunch instead of buying school lunch. You can save $20-30 per week!",
    "Look for student discounts everywhere - movies, restaurants, apps, and clothes stores often have them.",
    "Sell stuff you don't use anymore: old games, clothes, or electronics can make you quick cash.",
    "Start a small business: mow lawns, babysit, or walk dogs in your neighborhood.",
    "Use cash for fun spending. When the cash is gone, you're done spending for the week.",
    "Compare prices before buying. Check online and at least 2 stores before making big purchases.",
    "Put your savings in a separate bank account so you're not tempted to spend it.",
    "Learn to cook! Making meals at home is way cheaper than eating out or ordering delivery.",
    "Track your spending for one week. You'll be surprised where your money really goes!"
];

let currentTipIndex = 0;

// Tip rotation
function nextTip() {
    currentTipIndex = (currentTipIndex + 1) % financialTips.length;
    const featuredArticle = document.querySelector('.enhanced-card p');
    if (featuredArticle) {
        featuredArticle.textContent = financialTips[currentTipIndex];
    }
}
// Blog functionality
function openArticle(articleId) {
    const article = blogArticles[articleId];
    if (!article) {
        return;
    }
    
    const modal = document.getElementById('articleModal');
    const titleElement = document.getElementById('articleTitle');
    const contentElement = document.getElementById('articleContent');
    
    if (modal && titleElement && contentElement) {
        titleElement.textContent = article.title;
        contentElement.innerHTML = article.content;
        
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeArticle() {
    const modal = document.getElementById('articleModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// Blog search functionality
function initializeBlogSearch() {
    const searchInput = document.getElementById('blogSearch');
    const categorySelect = document.getElementById('blogCategory');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterArticles);
    }
    if (categorySelect) {
        categorySelect.addEventListener('change', filterArticles);
    }
}

function filterArticles() {
    const searchTerm = document.getElementById('blogSearch').value.toLowerCase();
    const category = document.getElementById('blogCategory').value;
    
    const articles = document.querySelectorAll('article');
    
    articles.forEach(article => {
        const title = article.querySelector('h3').textContent.toLowerCase();
        const description = article.querySelector('p').textContent.toLowerCase();
        const categoryBadge = article.querySelector('span[class*="bg-"]');
        const articleCategory = categoryBadge ? categoryBadge.textContent.toLowerCase() : '';
        
        const matchesSearch = !searchTerm || title.includes(searchTerm) || description.includes(searchTerm);
        const matchesCategory = !category || articleCategory.includes(category.toLowerCase());
        
        if (matchesSearch && matchesCategory) {
            article.style.display = 'block';
        } else {
            article.style.display = 'none';
        }
    });
}

// Teen-focused calculators
function calculateSavingsTime() {
    const goalAmount = parseFloat(document.getElementById('savingsGoal').value);
    const resultElement = document.getElementById('savingsResult');
    if (goalAmount && resultElement) {
        const weeklySavings = goalAmount / 52; // Save over 1 year
        resultElement.innerHTML = 
            `<strong>Save ${formatCurrency(weeklySavings)} per week</strong><br>
             Or ${formatCurrency(weeklySavings/7)} per day to reach your goal in 1 year`;
    }
}

function calculateWeeklySavings() {
    const allowance = parseFloat(document.getElementById('weeklyAllowance').value);
    const resultElement = document.getElementById('weeklyResult');
    if (allowance && resultElement) {
        const save10 = allowance * 0.1;
        const save20 = allowance * 0.2;
        const save50 = allowance * 0.5;
        
        resultElement.innerHTML = 
            `<strong>Savings Options:</strong><br>
             10%: ${formatCurrency(save10)} per week<br>
             20%: ${formatCurrency(save20)} per week<br>
             50%: ${formatCurrency(save50)} per week`;
    }
}

function calculateJobEarnings() {
    const hours = parseFloat(document.getElementById('jobHours').value);
    const resultElement = document.getElementById('jobResult');
    if (hours && resultElement) {
        const minWage = 15; // Federal minimum wage for teens
        const weeklyEarnings = hours * minWage;
        const monthlyEarnings = weeklyEarnings * 4.33; // Average weeks per month
        
        resultElement.innerHTML = 
            `<strong>At $15/hour:</strong><br>
             Weekly: ${formatCurrency(weeklyEarnings)}<br>
             Monthly: ${formatCurrency(monthlyEarnings)}<br>
             Yearly: ${formatCurrency(monthlyEarnings * 12)}`;
    }
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}
