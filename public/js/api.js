const API_CONFIG = {
    BASE_URL: 'http://localhost:3001',
    ENDPOINTS: {
        LOGIN: '/api/auth/login',
        USERS: '/api/users',
        COURSES: '/api/courses',
        LESSONS: '/api/lessons',
        TESTS: '/api/tests',
        ADMINS: '/api/admins',
        NOTIFICATIONS: '/api/notifications',
        STATS: '/api/stats'
    }
};

let currentUser = null;

function getAuthToken() {
    return localStorage.getItem('bot_admin_token');
}

export class APIClient {
    static async request(endpoint, options = {}) {
        const url = API_CONFIG.BASE_URL + endpoint;
        const authToken = getAuthToken();

        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            ...options
        };

        console.log(`Making ${config.method || 'GET'} request to: ${url}`); // Debug log

        try {
            const response = await fetch(url, config);
            console.log(`Response status: ${response.status}`); // Debug log

            if (response.status === 401) {
                console.log('Unauthorized - clearing token and redirecting to login');
                this.handleUnauthorized();
                throw new Error('Unauthorized');
            }

            const data = await response.json();
            console.log('Response data:', data); // Debug log

            if (!response.ok) {
                throw new Error(data.error || data.message || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);

            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Не удается подключиться к серверу. Проверьте, что сервер запущен.');
            }

            throw error;
        }
    }

    static async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    static async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    static handleUnauthorized() {
        localStorage.removeItem('bot_admin_token');
        currentUser = null;

        // Show login form
        const adminPanel = document.getElementById('adminPanel');
        const loginContainer = document.getElementById('loginContainer');

        if (adminPanel) adminPanel.style.display = 'none';
        if (loginContainer) loginContainer.style.display = 'flex';

        // Show error message
        const errorElement = document.getElementById('loginError');
        if (errorElement) {
            errorElement.textContent = 'Сессия истекла. Пожалуйста, войдите снова.';
            errorElement.style.display = 'block';
        }
    }

    // Helper method to check if user is authenticated
    static isAuthenticated() {
        return !!getAuthToken();
    }

    // Helper method to get current auth token
    static getToken() {
        return getAuthToken();
    }
}

export { API_CONFIG, currentUser };