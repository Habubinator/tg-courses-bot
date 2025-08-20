import { APIClient, API_CONFIG } from './api.js';
import { UIManager } from './ui.js';
import { paginationManager } from './pagination.js';
import { UsersManager } from './managers/users-manager.js';
import { CoursesManager } from './managers/courses-manager.js';
import { LessonsManager } from './managers/lessons-manager.js';
import { TestsManager } from './managers/tests-manager.js';
import { AdminsManager } from './managers/admins-manager.js';
import { NotificationsManager } from './managers/notifications-manager.js';

// Утилиты
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function formatDate(date) {
    return new Date(date).toLocaleDateString('ru-RU');
}

export function truncateText(text, maxLength = 50) {
    return text && text.length > maxLength
        ? text.substring(0, maxLength) + '...'
        : text || '';
}

// Управление вкладками
class TabManager {
    constructor(managers) {
        this.managers = managers;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                this.switchTab(targetTab);
            });
        });
    }

    switchTab(targetTab) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-tab="${targetTab}"]`).classList.add('active');

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`${targetTab}Tab`).classList.add('active');

        // Load data for the active tab
        switch (targetTab) {
            case 'users':
                this.managers.users.loadUsers();
                break;
            case 'courses':
                this.managers.courses.loadCourses();
                break;
            case 'lessons':
                this.managers.lessons.loadLessons();
                break;
            case 'tests':
                this.managers.tests.loadTests();
                break;
            case 'admins':
                this.managers.admins.loadAdmins();
                break;
            case 'notifications':
                this.managers.notifications.loadNotifications();
                break;
        }
    }
}

// Основное приложение
class AdminApp {
    constructor() {
        this.managers = {
            users: new UsersManager(),
            courses: new CoursesManager(),
            lessons: new LessonsManager(),
            tests: new TestsManager(),
            admins: new AdminsManager(),
            notifications: new NotificationsManager()
        };

        this.tabManager = new TabManager(this.managers);
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupModalHandlers();

        // Проверка авторизации
        const token = localStorage.getItem('bot_admin_token');
        if (token) {
            try {
                await this.loadInitialData();
                UIManager.showAdminPanel();
            } catch (error) {
                if (error.message === 'Unauthorized') {
                    UIManager.showLoginPanel();
                }
            }
        } else {
            UIManager.showLoginPanel();
        }
    }

    setupEventListeners() {
        // Login form - FIXED: Prevent default form submission
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin(e);
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }

        // Global modal close function
        window.closeModal = (modalId) => UIManager.closeModal(modalId);
    }

    setupModalHandlers() {
        // Setup modal close handlers
        UIManager.setupModalCloseHandlers();
    }

    async handleLogin(e) {
        console.log('Login form submitted'); // Debug log

        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        try {
            // Disable submit button and show loading
            submitButton.disabled = true;
            submitButton.textContent = 'Вход...';

            // Clear any previous errors
            UIManager.showError('', 'loginError');

            const formData = new FormData(e.target);
            const loginData = {
                login: formData.get('login'),
                password: formData.get('password')
            };

            console.log('Sending login request with:', loginData); // Debug log

            const response = await APIClient.post(API_CONFIG.ENDPOINTS.LOGIN, loginData);
            console.log('Login response:', response); // Debug log

            if (response.token) {
                localStorage.setItem('bot_admin_token', response.token);

                // Update global auth token in api.js
                window.location.reload(); // Simple reload to refresh auth state

            } else {
                throw new Error(response.message || 'Ошибка авторизации');
            }

        } catch (error) {
            console.error('Login error:', error); // Debug log
            UIManager.showError(error.message || 'Ошибка подключения к серверу', 'loginError');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }

    handleLogout() {
        localStorage.removeItem('bot_admin_token');

        // Clear all data
        this.clearAllTables();

        // Show login panel
        UIManager.showLoginPanel();
        UIManager.showSuccessMessage('Вы вышли из системы');
    }

    async loadInitialData() {
        try {
            // Load statistics
            await this.loadStatistics();

            // Load initial tab data (users by default)
            await this.managers.users.loadUsers();

            // Load courses for filters
            await this.managers.courses.loadCourses();

        } catch (error) {
            console.error('Error loading initial data:', error);
            throw error;
        }
    }

    async loadStatistics() {
        try {
            const response = await APIClient.get(API_CONFIG.ENDPOINTS.STATS);

            if (response && response.success) {
                const stats = response.data;

                // Animate numbers
                UIManager.animateNumber('totalUsers', stats.totalUsers || 0);
                UIManager.animateNumber('totalCourses', stats.totalCourses || 0);
                UIManager.animateNumber('totalAdmins', stats.totalAdmins || 0);
            }

        } catch (error) {
            console.error('Error loading statistics:', error);
            // Set default values
            document.getElementById('totalUsers').textContent = '—';
            document.getElementById('totalCourses').textContent = '—';
            document.getElementById('totalAdmins').textContent = '—';
        }
    }

    clearAllTables() {
        const tables = ['usersTable', 'coursesTable', 'lessonsTable', 'testsTable', 'adminsTable', 'notificationsTable'];
        tables.forEach(tableId => {
            const tbody = document.querySelector(`#${tableId} tbody`);
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет данных</td></tr>';
            }
        });

        // Clear statistics
        document.getElementById('totalUsers').textContent = '—';
        document.getElementById('totalCourses').textContent = '—';
        document.getElementById('totalAdmins').textContent = '—';
    }

    // Utility methods for global access
    static showError(message) {
        UIManager.showErrorMessage(message);
    }

    static showSuccess(message) {
        UIManager.showSuccessMessage(message);
    }

    static openModal(modalId) {
        UIManager.openModal(modalId);
    }

    static closeModal(modalId) {
        UIManager.closeModal(modalId);
    }
}

// Error handling
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    UIManager.showErrorMessage('Произошла неожиданная ошибка. Проверьте консоль для деталей.');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    UIManager.showErrorMessage('Ошибка при выполнении запроса: ' + (e.reason?.message || e.reason));
});

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        const app = new AdminApp();

        window.adminApp = app;
        window.managers = app.managers;

        console.log('🎓 School Bot Admin Panel initialized successfully!');
        console.log('Available managers:', Object.keys(app.managers));

    } catch (error) {
        console.error('Failed to initialize admin app:', error);
        UIManager.showErrorMessage('Не удалось инициализировать приложение. Перезагрузите страницу.');
    }
});