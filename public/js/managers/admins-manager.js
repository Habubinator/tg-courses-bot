import { APIClient } from '../api.js';
import { UIManager } from '../ui.js';
import { paginationManager } from '../pagination.js';
import { debounce } from '../utils.js';

export class AdminsManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add admin button
        document.getElementById('addAdminBtn').addEventListener('click', () => {
            document.getElementById('adminModalTitle').textContent = 'Добавить администратора';
            document.getElementById('adminForm').reset();
            UIManager.openModal('adminModal');
        });

        // Admin form submit
        document.getElementById('adminForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAdminSubmit(e);
        });

        // Search handler
        document.getElementById('adminsSearch').addEventListener('input',
            debounce(() => {
                paginationManager.resetPage('admins');
                this.loadAdmins();
            }, 500)
        );

        // Refresh button
        document.getElementById('refreshAdmins').addEventListener('click', () => this.loadAdmins());

        // Global functions for buttons
        window.deleteAdmin = (adminId) => this.deleteAdmin(adminId);
        window.viewAdminActivity = (adminId) => this.viewAdminActivity(adminId);
    }

    async handleAdminSubmit(e) {
        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Добавление...';

            const formData = new FormData(e.target);
            const telegramId = formData.get('telegramId').trim();

            // Валидация Telegram ID
            if (!telegramId) {
                throw new Error('Введите Telegram ID');
            }

            if (!/^\d+$/.test(telegramId)) {
                throw new Error('Telegram ID должен содержать только цифры');
            }

            if (telegramId.length < 5) {
                throw new Error('Telegram ID слишком короткий');
            }

            const adminData = { telegramId };
            const response = await APIClient.post('/api/admins', adminData);

            if (response && response.success) {
                UIManager.closeModal('adminModal');
                this.loadAdmins();
                UIManager.showSuccessMessage('Администратор добавлен');
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка добавления администратора: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }

    async loadAdmins() {
        UIManager.showLoading('adminsLoading');
        UIManager.hideTable('adminsTable');

        try {
            const search = document.getElementById('adminsSearch').value;

            const params = {
                page: paginationManager.getPage('admins'),
                limit: paginationManager.getItemsPerPage(),
                ...(search && { search })
            };

            const response = await APIClient.get('/api/admins', params);

            if (response && response.success) {
                this.renderAdminsTable(response.data);
                UIManager.showTable('adminsTable');

                if (response.pagination) {
                    paginationManager.createPagination(
                        'adminsPagination',
                        response.pagination.page,
                        response.pagination.totalPages,
                        () => this.loadAdmins()
                    );
                }
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки администраторов: ' + error.message);
        } finally {
            UIManager.hideLoading('adminsLoading');
        }
    }

    renderAdminsTable(admins) {
        const tbody = document.querySelector('#adminsTable tbody');
        tbody.innerHTML = '';

        if (!admins || admins.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Нет администраторов</td></tr>';
            return;
        }

        admins.forEach(admin => {
            const row = document.createElement('tr');

            // Проверяем, является ли этот админ текущим пользователем
            const isCurrentUser = this.isCurrentAdmin(admin.telegramId);

            row.innerHTML = `
                <td>${admin.id}</td>
                <td>
                    <div class="admin-telegram-info">
                        <strong>${admin.telegramId}</strong>
                        ${isCurrentUser ? '<span class="current-user-badge">👤 Вы</span>' : ''}
                        <small class="telegram-link">
                            <a href="https://t.me/${admin.telegramId}" target="_blank" rel="noopener noreferrer">
                                Открыть в Telegram
                            </a>
                        </small>
                    </div>
                </td>
                <td>
                    <div class="admin-dates">
                        <div class="created-date">
                            <strong>${new Date(admin.createdAt).toLocaleDateString('ru-RU')}</strong>
                        </div>
                        <small class="relative-date">${this.getRelativeDate(admin.createdAt)}</small>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-info" onclick="viewAdminActivity('${admin.id}')" title="Активность">
                            📊
                        </button>
                        <button class="btn btn-sm btn-danger" 
                                onclick="deleteAdmin('${admin.id}')" 
                                title="Удалить"
                                ${isCurrentUser ? 'disabled' : ''}>
                            🗑️
                        </button>
                    </div>
                </td>
            `;

            // Добавляем класс для текущего пользователя
            if (isCurrentUser) {
                row.classList.add('current-admin-row');
            }

            tbody.appendChild(row);
        });
    }

    async deleteAdmin(adminId) {
        if (!confirm('Вы уверены, что хотите удалить этого администратора? Он потеряет доступ к админ панели.')) {
            return;
        }

        try {
            const response = await APIClient.delete(`/api/admins/${adminId}`);

            if (response && response.success) {
                UIManager.showSuccessMessage('Администратор удален');
                this.loadAdmins();
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка удаления администратора: ' + error.message);
        }
    }

    async viewAdminActivity(adminId) {
        try {
            // Пока что показываем заглушку, так как у нас нет системы логирования
            this.showAdminActivityModal(adminId);

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки активности: ' + error.message);
        }
    }

    showAdminActivityModal(adminId) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content admin-activity-modal" style="max-width: 600px;">
                <button class="close-modal">&times;</button>
                <div class="activity-header">
                    <h3>📊 Активность администратора</h3>
                    <p>ID: ${adminId}</p>
                </div>

                <div class="activity-placeholder">
                    <div class="placeholder-icon">📈</div>
                    <h4>Система мониторинга активности</h4>
                    <p>Функция отслеживания активности администраторов находится в разработке.</p>
                    
                    <div class="planned-features">
                        <h5>Планируемый функционал:</h5>
                        <ul>
                            <li>📅 История входов в систему</li>
                            <li>⚡ Последние действия</li>
                            <li>📊 Статистика активности</li>
                            <li>🕒 Время проведенное в системе</li>
                            <li>📝 Журнал изменений</li>
                        </ul>
                    </div>

                    <div class="current-info">
                        <h5>Текущая информация:</h5>
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Статус:</label>
                                <span class="status-active">✅ Активен</span>
                            </div>
                            <div class="info-item">
                                <label>Последний вход:</label>
                                <span>Сейчас</span>
                            </div>
                            <div class="info-item">
                                <label>Права доступа:</label>
                                <span>🔑 Полный доступ</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
                </div>
            </div>
        `;

        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        document.body.appendChild(modal);
    }

    isCurrentAdmin(telegramId) {
        // Здесь можно было бы проверить текущего пользователя
        // Пока что возвращаем false, так как у нас простая авторизация
        return false;
    }

    getRelativeDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Сегодня';
        } else if (diffDays === 1) {
            return 'Вчера';
        } else if (diffDays < 7) {
            return `${diffDays} дней назад`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} ${weeks === 1 ? 'неделю' : 'недель'} назад`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `${months} ${months === 1 ? 'месяц' : 'месяцев'} назад`;
        } else {
            const years = Math.floor(diffDays / 365);
            return `${years} ${years === 1 ? 'год' : 'лет'} назад`;
        }
    }

    showMessage(message, type) {
        if (type === 'success') {
            UIManager.showSuccessMessage(message);
        } else {
            UIManager.showErrorMessage(message);
        }
    }
}