import { APIClient } from '../api.js';
import { UIManager } from '../ui.js';
import { paginationManager, debounce } from '../pagination.js';

export class NotificationsManager {
    constructor() {
        this.currentEditingNotification = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add notification button
        document.getElementById('addNotificationBtn').addEventListener('click', () => {
            this.currentEditingNotification = null;
            document.getElementById('notificationModalTitle').textContent = 'Добавить уведомление';
            document.getElementById('notificationForm').reset();
            document.getElementById('notificationIsActive').checked = true;
            UIManager.openModal('notificationModal');
        });

        // Notification form submit
        document.getElementById('notificationForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleNotificationSubmit(e);
        });

        // Refresh button
        document.getElementById('refreshNotifications').addEventListener('click', () => this.loadNotifications());

        // Global functions for buttons
        window.editNotification = (notificationId) => this.editNotification(notificationId);
        window.deleteNotification = (notificationId) => this.deleteNotification(notificationId);
        window.toggleNotificationStatus = (notificationId) => this.toggleNotificationStatus(notificationId);
        window.duplicateNotification = (notificationId) => this.duplicateNotification(notificationId);
        window.previewNotification = (notificationId) => this.previewNotification(notificationId);
        window.testNotification = (notificationId) => this.testNotification(notificationId);
    }

    async handleNotificationSubmit(e) {
        const formData = new FormData(e.target);
        const notificationData = {
            courseId: formData.get('courseId') || null,
            state: formData.get('state'),
            mediaType: formData.get('mediaType'),
            mediaUrl: formData.get('mediaUrl'),
            caption: formData.get('caption'),
            buttonText: formData.get('buttonText') || null,
            buttonUrl: formData.get('buttonUrl') || null,
            delayMinutes: parseInt(formData.get('delayMinutes')) || 0,
            isActive: formData.has('isActive')
        };

        // Валидация
        if (!notificationData.mediaUrl) {
            UIManager.showErrorMessage('Укажите URL медиа файла');
            return;
        }

        if (!notificationData.caption) {
            UIManager.showErrorMessage('Укажите текст уведомления');
            return;
        }

        if (notificationData.buttonText && !notificationData.buttonUrl) {
            UIManager.showErrorMessage('Если указан текст кнопки, укажите также URL кнопки');
            return;
        }

        if (notificationData.delayMinutes < 1) {
            UIManager.showErrorMessage('Задержка должна быть не менее 1 минуты');
            return;
        }

        try {
            let response;
            if (this.currentEditingNotification) {
                response = await APIClient.put(`/api/notifications/${this.currentEditingNotification}`, notificationData);
            } else {
                response = await APIClient.post('/api/notifications', notificationData);
            }

            if (response && response.success) {
                UIManager.closeModal('notificationModal');
                this.loadNotifications();
                UIManager.showSuccessMessage(
                    this.currentEditingNotification ? 'Уведомление обновлено' : 'Уведомление создано'
                );
                this.currentEditingNotification = null;
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка сохранения уведомления: ' + error.message);
        }
    }

    async loadNotifications() {
        UIManager.showLoading('notificationsLoading');
        UIManager.hideTable('notificationsTable');

        try {
            const params = {
                page: paginationManager.getPage('notifications'),
                limit: paginationManager.getItemsPerPage()
            };

            const response = await APIClient.get('/api/notifications', params);

            if (response && response.success) {
                this.renderNotificationsTable(response.data);
                UIManager.showTable('notificationsTable');

                if (response.pagination) {
                    paginationManager.createPagination(
                        'notificationsPagination',
                        response.pagination.page,
                        response.pagination.totalPages,
                        () => this.loadNotifications()
                    );
                }
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки уведомлений: ' + error.message);
        } finally {
            UIManager.hideLoading('notificationsLoading');
        }
    }

    renderNotificationsTable(notifications) {
        const tbody = document.querySelector('#notificationsTable tbody');
        tbody.innerHTML = '';

        if (!notifications || notifications.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет уведомлений</td></tr>';
            return;
        }

        notifications.forEach(notification => {
            const row = document.createElement('tr');

            const stateLabels = {
                'WATCHING_LESSON': 'Просмотр урока',
                'TAKING_TEST': 'Прохождение теста',
                'COMPLETED_COURSE': 'Завершен курс'
            };

            const stateColors = {
                'WATCHING_LESSON': 'info',
                'TAKING_TEST': 'warning',
                'COMPLETED_COURSE': 'success'
            };

            row.innerHTML = `
                <td>${notification.id}</td>
                <td>
                    <div class="course-info">
                        ${notification.course ?
                    `<strong>${notification.course.title}</strong>` :
                    '<span class="all-courses">🌐 Все курсы</span>'
                }
                    </div>
                </td>
                <td>
                    <span class="state-badge state-${stateColors[notification.state]}">
                        ${stateLabels[notification.state] || notification.state}
                    </span>
                </td>
                <td>
                    <span class="media-type-badge media-type-${notification.mediaType.toLowerCase()}">
                        ${notification.mediaType === 'PHOTO' ? '📷 Фото' : '🎬 Видео'}
                    </span>
                </td>
                <td>
                    <div class="delay-info">
                        <strong>${notification.delayMinutes}</strong>
                        <small>мин</small>
                    </div>
                </td>
                <td>
                    <span class="status-${notification.isActive ? 'active' : 'inactive'}">
                        ${notification.isActive ? '✅ Активно' : '❌ Неактивно'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-info" onclick="previewNotification('${notification.id}')" title="Предпросмотр">
                            👁️
                        </button>
                        <button class="btn btn-sm btn-success" onclick="testNotification('${notification.id}')" title="Тест">
                            🧪
                        </button>
                        <button class="btn btn-sm" onclick="editNotification('${notification.id}')" title="Редактировать">
                            ✏️
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="duplicateNotification('${notification.id}')" title="Дублировать">
                            📋
                        </button>
                        <button class="btn btn-sm ${notification.isActive ? 'btn-warning' : 'btn-success'}" 
                                onclick="toggleNotificationStatus('${notification.id}')" 
                                title="${notification.isActive ? 'Деактивировать' : 'Активировать'}">
                            ${notification.isActive ? '⏸️' : '▶️'}
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteNotification('${notification.id}')" title="Удалить">
                            🗑️
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async editNotification(notificationId) {
        try {
            const response = await APIClient.get(`/api/notifications/${notificationId}`);

            if (response && response.success) {
                const notification = response.data;
                this.currentEditingNotification = notificationId;

                document.getElementById('notificationModalTitle').textContent = 'Редактировать уведомление';
                document.getElementById('notificationCourseId').value = notification.courseId || '';
                document.getElementById('notificationState').value = notification.state;
                document.getElementById('notificationMediaType').value = notification.mediaType;
                document.getElementById('notificationMediaUrl').value = notification.mediaUrl;
                document.getElementById('notificationCaption').value = notification.caption;
                document.getElementById('notificationButtonText').value = notification.buttonText || '';
                document.getElementById('notificationButtonUrl').value = notification.buttonUrl || '';
                document.getElementById('notificationDelayMinutes').value = notification.delayMinutes;
                document.getElementById('notificationIsActive').checked = notification.isActive;

                UIManager.openModal('notificationModal');
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки данных уведомления: ' + error.message);
        }
    }

    async deleteNotification(notificationId) {
        if (!confirm('Вы уверены, что хотите удалить это уведомление?')) {
            return;
        }

        try {
            const response = await APIClient.delete(`/api/notifications/${notificationId}`);

            if (response && response.success) {
                UIManager.showSuccessMessage('Уведомление удалено');
                this.loadNotifications();
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка удаления уведомления: ' + error.message);
        }
    }

    async toggleNotificationStatus(notificationId) {
        try {
            const response = await APIClient.put(`/api/notifications/${notificationId}/toggle`);

            if (response && response.success) {
                UIManager.showSuccessMessage('Статус уведомления изменен');
                this.loadNotifications();
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка изменения статуса уведомления: ' + error.message);
        }
    }

    async duplicateNotification(notificationId) {
        if (!confirm('Создать копию этого уведомления?')) {
            return;
        }

        try {
            const response = await APIClient.get(`/api/notifications/${notificationId}`);

            if (response && response.success) {
                const originalNotification = response.data;

                const duplicateData = {
                    courseId: originalNotification.courseId,
                    state: originalNotification.state,
                    mediaType: originalNotification.mediaType,
                    mediaUrl: originalNotification.mediaUrl,
                    caption: `${originalNotification.caption} (копия)`,
                    buttonText: originalNotification.buttonText,
                    buttonUrl: originalNotification.buttonUrl,
                    delayMinutes: originalNotification.delayMinutes,
                    isActive: false // Деактивируем копию по умолчанию
                };

                const createResponse = await APIClient.post('/api/notifications', duplicateData);

                if (createResponse && createResponse.success) {
                    UIManager.showSuccessMessage('Копия уведомления создана');
                    this.loadNotifications();
                }
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка дублирования уведомления: ' + error.message);
        }
    }

    async previewNotification(notificationId) {
        try {
            const response = await APIClient.get(`/api/notifications/${notificationId}`);

            if (response && response.success) {
                const notification = response.data;
                this.showNotificationPreviewModal(notification);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки данных уведомления: ' + error.message);
        }
    }

    showNotificationPreviewModal(notification) {
        const modalContent = this.generatePreviewModalContent(notification);

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content notification-preview-modal" style="max-width: 700px;">
                <button class="close-modal">&times;</button>
                ${modalContent}
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
                    <button class="btn btn-primary" onclick="editNotification('${notification.id}'); this.closest('.modal').remove();">Редактировать</button>
                </div>
            </div>
        `;

        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        document.body.appendChild(modal);
    }

    generatePreviewModalContent(notification) {
        const stateLabels = {
            'WATCHING_LESSON': 'Просмотр урока',
            'TAKING_TEST': 'Прохождение теста',
            'COMPLETED_COURSE': 'Завершен курс'
        };

        const mediaContent = notification.mediaType === 'PHOTO' ?
            `<img src="${notification.mediaUrl}" alt="Уведомление" class="notification-preview-media" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Ошибка загрузки</text></svg>'">` :
            `<video controls class="notification-preview-media" preload="metadata">
                <source src="${notification.mediaUrl}" type="video/mp4">
                <p>Ваш браузер не поддерживает видео. <a href="${notification.mediaUrl}">Скачать видео</a></p>
            </video>`;

        return `
            <div class="notification-preview-header">
                <h3>🔔 Предпросмотр уведомления</h3>
                <div class="notification-meta">
                    <span class="media-type-badge media-type-${notification.mediaType.toLowerCase()}">
                        ${notification.mediaType === 'PHOTO' ? '📷 Фото' : '🎬 Видео'}
                    </span>
                    <span class="state-badge">${stateLabels[notification.state]}</span>
                    <span class="status-badge status-${notification.isActive ? 'active' : 'inactive'}">
                        ${notification.isActive ? '✅ Активно' : '❌ Неактивно'}
                    </span>
                </div>
            </div>

            <div class="notification-preview-content">
                <div class="notification-media-container">
                    ${mediaContent}
                </div>

                <div class="notification-text">
                    <h4>📝 Текст уведомления:</h4>
                    <div class="message-preview">
                        ${notification.caption}
                    </div>
                </div>

                ${notification.buttonText && notification.buttonUrl ? `
                <div class="notification-button-preview">
                    <h5>🔗 Кнопка:</h5>
                    <a href="${notification.buttonUrl}" target="_blank" class="btn btn-primary" rel="noopener noreferrer">
                        ${notification.buttonText}
                    </a>
                    <small class="button-url">URL: ${notification.buttonUrl}</small>
                </div>
                ` : ''}

                <div class="notification-settings">
                    <h5>⚙️ Настройки:</h5>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <label>Курс:</label>
                            <span>${notification.course?.title || 'Все курсы'}</span>
                        </div>
                        <div class="setting-item">
                            <label>Триггер:</label>
                            <span>${stateLabels[notification.state]}</span>
                        </div>
                        <div class="setting-item">
                            <label>Задержка:</label>
                            <span>${notification.delayMinutes} минут</span>
                        </div>
                        <div class="setting-item">
                            <label>Создано:</label>
                            <span>${new Date(notification.createdAt).toLocaleDateString('ru-RU')}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async testNotification(notificationId) {
        try {
            const response = await APIClient.get(`/api/notifications/${notificationId}`);

            if (response && response.success) {
                const notification = response.data;
                this.showTestNotificationModal(notification);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки данных уведомления: ' + error.message);
        }
    }

    showTestNotificationModal(notification) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content test-notification-modal" style="max-width: 600px;">
                <button class="close-modal">&times;</button>
                <div class="test-notification-header">
                    <h3>🧪 Тест уведомления</h3>
                    <p>Проверка настроек и валидация уведомления</p>
                </div>

                <div class="test-results">
                    ${this.generateTestResults(notification)}
                </div>

                <div class="test-simulation">
                    <h4>📱 Симуляция отправки</h4>
                    <div class="simulation-info">
                        <p>Это уведомление будет отправлено пользователям при следующих условиях:</p>
                        <ul>
                            <li><strong>Триггер:</strong> ${this.getStateDescription(notification.state)}</li>
                            <li><strong>Задержка:</strong> ${notification.delayMinutes} минут после триггера</li>
                            <li><strong>Целевая аудитория:</strong> ${notification.course ? `Пользователи курса "${notification.course.title}"` : 'Все пользователи'}</li>
                            <li><strong>Статус:</strong> ${notification.isActive ? '✅ Активно (будет отправляться)' : '❌ Неактивно (не будет отправляться)'}</li>
                        </ul>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-success" onclick="sendTestNotification('${notification.id}')">
                        📤 Отправить тестовое уведомление
                    </button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
                </div>
            </div>
        `;

        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Глобальная функция для отправки тестового уведомления
        window.sendTestNotification = (notificationId) => {
            this.sendTestNotification(notificationId);
            modal.remove();
        };

        document.body.appendChild(modal);
    }

    generateTestResults(notification) {
        const checks = [];

        // Проверка медиа URL
        checks.push({
            name: 'URL медиа файла',
            status: notification.mediaUrl ? 'success' : 'error',
            message: notification.mediaUrl ? 'URL указан' : 'URL не указан'
        });

        // Проверка текста
        checks.push({
            name: 'Текст уведомления',
            status: notification.caption && notification.caption.length > 0 ? 'success' : 'error',
            message: notification.caption ? `${notification.caption.length} символов` : 'Текст не указан'
        });

        // Проверка кнопки
        if (notification.buttonText || notification.buttonUrl) {
            const buttonValid = notification.buttonText && notification.buttonUrl;
            checks.push({
                name: 'Кнопка',
                status: buttonValid ? 'success' : 'warning',
                message: buttonValid ? 'Кнопка настроена правильно' : 'Неполные данные кнопки'
            });
        }

        // Проверка задержки
        checks.push({
            name: 'Задержка отправки',
            status: notification.delayMinutes >= 1 ? 'success' : 'warning',
            message: notification.delayMinutes >= 1 ? `${notification.delayMinutes} минут` : 'Слишком маленькая задержка'
        });

        // Проверка статуса
        checks.push({
            name: 'Статус активности',
            status: notification.isActive ? 'success' : 'warning',
            message: notification.isActive ? 'Активно' : 'Неактивно - уведомления не отправляются'
        });

        return `
            <div class="test-checks">
                ${checks.map(check => `
                    <div class="test-check test-${check.status}">
                        <div class="check-icon">
                            ${check.status === 'success' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'}
                        </div>
                        <div class="check-content">
                            <strong>${check.name}</strong>
                            <span>${check.message}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    getStateDescription(state) {
        const descriptions = {
            'WATCHING_LESSON': 'Пользователь просматривает урок, но не переходит к следующему действию',
            'TAKING_TEST': 'Пользователь начал тест, но не завершил его',
            'COMPLETED_COURSE': 'Пользователь завершил курс'
        };
        return descriptions[state] || state;
    }

    async sendTestNotification(notificationId) {
        try {
            // Здесь можно было бы отправить тестовое уведомление
            // Пока что показываем заглушку
            UIManager.showSuccessMessage('Функция отправки тестовых уведомлений в разработке');

        } catch (error) {
            UIManager.showErrorMessage('Ошибка отправки тестового уведомления: ' + error.message);
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