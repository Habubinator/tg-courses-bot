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
let authToken = localStorage.getItem('bot_admin_token');

export class APIClient {
    static async request(endpoint, options = {}) {
        const url = API_CONFIG.BASE_URL + endpoint;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            ...options
        };

        try {
            const response = await fetch(url, config);

            if (response.status === 401) {
                this.handleUnauthorized();
                throw new Error('Unauthorized');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || 'API Error');
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    static async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url);
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
        authToken = null;
        currentUser = null;

        // Показываем форму входа
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('loginContainer').style.display = 'flex';

        // Показываем ошибку
        const errorElement = document.getElementById('loginError');
        if (errorElement) {
            errorElement.textContent = 'Сессия истекла. Пожалуйста, войдите снова.';
            errorElement.style.display = 'block';
        }
    }
}

export { API_CONFIG, authToken, currentUser };