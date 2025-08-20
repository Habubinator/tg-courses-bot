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

        // Broadcast notification button
        document.getElementById('broadcastNotificationBtn').addEventListener('click', () => {
            this.showBroadcastModal();
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

    showBroadcastModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content broadcast-modal" style="max-width: 700px;">
                <button class="close-modal">&times;</button>
                <div class="broadcast-header">
                    <h3>📢 Массовая рассылка уведомлений</h3>
                    <p>Отправьте уведомление группе пользователей или всем сразу</p>
                </div>

                <form id="broadcastForm">
                    <div class="broadcast-targeting">
                        <h4>🎯 Целевая аудитория</h4>
                        <div class="targeting-options">
                            <div class="targeting-option">
                                <input type="radio" id="targetAll" name="targetType" value="all" checked>
                                <label for="targetAll">
                                    <strong>Все пользователи</strong>
                                    <small>Отправить всем зарегистрированным пользователям</small>
                                </label>
                            </div>
                            
                            <div class="targeting-option">
                                <input type="radio" id="targetCourse" name="targetType" value="course">
                                <label for="targetCourse">
                                    <strong>Пользователи конкретного курса</strong>
                                    <small>Только пользователи, записанные на выбранный курс</small>
                                </label>
                                <select id="broadcastCourseId" name="courseId" disabled>
                                    <option value="">Выберите курс</option>
                                </select>
                            </div>

                            <div class="targeting-option">
                                <input type="radio" id="targetStatus" name="targetType" value="status">
                                <label for="targetStatus">
                                    <strong>По статусу прохождения</strong>
                                    <small>Пользователи с определенным статусом обучения</small>
                                </label>
                                <select id="broadcastStatus" name="status" disabled>
                                    <option value="">Выберите статус</option>
                                    <option value="completed">Завершили курс</option>
                                    <option value="in_progress">В процессе обучения</option>
                                    <option value="not_started">Не начинали обучение</option>
                                </select>
                            </div>

                            <div class="targeting-option">
                                <input type="radio" id="targetRecent" name="targetType" value="recent">
                                <label for="targetRecent">
                                    <strong>Недавно зарегистрированные</strong>
                                    <small>Пользователи, зарегистрированные за последние дни</small>
                                </label>
                                <select id="broadcastRecentDays" name="recentDays" disabled>
                                    <option value="1">За последний день</option>
                                    <option value="3">За последние 3 дня</option>
                                    <option value="7" selected>За последнюю неделю</option>
                                    <option value="30">За последний месяц</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="broadcast-content">
                        <h4>📝 Содержание сообщения</h4>
                        
                        <div class="form-group">
                            <label for="broadcastMediaType">Тип медиа</label>
                            <select id="broadcastMediaType" name="mediaType" required>
                                <option value="text">Только текст</option>
                                <option value="PHOTO">Фото с текстом</option>
                                <option value="VIDEO">Видео с текстом</option>
                            </select>
                        </div>

                        <div class="form-group media-url-group" style="display: none;">
                            <label for="broadcastMediaUrl">URL медиа файла</label>
                            <input type="url" id="broadcastMediaUrl" name="mediaUrl" 
                                   placeholder="https://example.com/image.jpg">
                        </div>

                        <div class="form-group">
                            <label for="broadcastMessage">Текст сообщения</label>
                            <textarea id="broadcastMessage" name="message" rows="4" required 
                                      placeholder="Введите текст уведомления..."></textarea>
                            <small class="form-help">Поддерживается Markdown форматирование</small>
                        </div>

                        <div class="form-group">
                            <label for="broadcastButtonText">Текст кнопки (необязательно)</label>
                            <input type="text" id="broadcastButtonText" name="buttonText" 
                                   placeholder="Например: Открыть курс">
                        </div>

                        <div class="form-group">
                            <label for="broadcastButtonUrl">URL кнопки (необязательно)</label>
                            <input type="url" id="broadcastButtonUrl" name="buttonUrl" 
                                   placeholder="https://example.com">
                        </div>
                    </div>

                    <div class="broadcast-preview">
                        <h4>👁️ Предпросмотр</h4>
                        <div class="preview-container" id="broadcastPreview">
                            <div class="message-preview">
                                <div class="preview-text">Введите текст сообщения для предпросмотра</div>
                            </div>
                        </div>
                    </div>

                    <div class="broadcast-stats">
                        <h4>📊 Статистика аудитории</h4>
                        <div class="stats-container" id="audienceStats">
                            <div class="loading">Загрузка статистики...</div>
                        </div>
                    </div>

                    <div class="broadcast-actions">
                        <div class="action-buttons">
                            <button type="button" class="btn btn-secondary" id="previewBroadcastBtn">
                                👁️ Предпросмотр
                            </button>
                            <button type="submit" class="btn btn-warning">
                                📤 Отправить рассылку
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                                Отмена
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        `;

        // Добавляем обработчики
        this.setupBroadcastModalHandlers(modal);

        // Загружаем курсы для выбора
        this.loadCoursesForBroadcast(modal);

        // Загружаем начальную статистику
        this.updateAudienceStats(modal);

        document.body.appendChild(modal);
    }

    setupBroadcastModalHandlers(modal) {
        // Закрытие модального окна
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Обработчики изменения типа таргетинга
        const targetingInputs = modal.querySelectorAll('input[name="targetType"]');
        targetingInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.handleTargetingChange(modal);
                this.updateAudienceStats(modal);
            });
        });

        // Обработчики изменения параметров
        const courseSelect = modal.querySelector('#broadcastCourseId');
        const statusSelect = modal.querySelector('#broadcastStatus');
        const recentSelect = modal.querySelector('#broadcastRecentDays');

        [courseSelect, statusSelect, recentSelect].forEach(select => {
            select.addEventListener('change', () => {
                this.updateAudienceStats(modal);
            });
        });

        // Обработчик типа медиа
        modal.querySelector('#broadcastMediaType').addEventListener('change', (e) => {
            const mediaUrlGroup = modal.querySelector('.media-url-group');
            const mediaUrl = modal.querySelector('#broadcastMediaUrl');

            if (e.target.value === 'text') {
                mediaUrlGroup.style.display = 'none';
                mediaUrl.required = false;
            } else {
                mediaUrlGroup.style.display = 'block';
                mediaUrl.required = true;
            }
            this.updateBroadcastPreview(modal);
        });

        // Обработчик изменения текста для предпросмотра
        const messageTextarea = modal.querySelector('#broadcastMessage');
        messageTextarea.addEventListener('input', () => {
            this.updateBroadcastPreview(modal);
        });

        // Обработчик кнопки предпросмотра
        modal.querySelector('#previewBroadcastBtn').addEventListener('click', () => {
            this.showBroadcastPreview(modal);
        });

        // Обработчик отправки формы
        modal.querySelector('#broadcastForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleBroadcastSubmit(e, modal);
        });
    }

    handleTargetingChange(modal) {
        const selectedType = modal.querySelector('input[name="targetType"]:checked').value;

        // Включаем/выключаем соответствующие селекты
        modal.querySelector('#broadcastCourseId').disabled = selectedType !== 'course';
        modal.querySelector('#broadcastStatus').disabled = selectedType !== 'status';
        modal.querySelector('#broadcastRecentDays').disabled = selectedType !== 'recent';
    }

    async loadCoursesForBroadcast(modal) {
        try {
            const response = await APIClient.get('/api/courses', { limit: 100 });

            if (response && response.success) {
                const courseSelect = modal.querySelector('#broadcastCourseId');
                courseSelect.innerHTML = '<option value="">Выберите курс</option>';

                response.data.forEach(course => {
                    const option = document.createElement('option');
                    option.value = course.id;
                    option.textContent = course.title;
                    courseSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading courses:', error);
        }
    }

    async updateAudienceStats(modal) {
        const statsContainer = modal.querySelector('#audienceStats');
        statsContainer.innerHTML = '<div class="loading">Загрузка статистики...</div>';

        try {
            const targetType = modal.querySelector('input[name="targetType"]:checked').value;
            const params = { targetType };

            if (targetType === 'course') {
                params.courseId = modal.querySelector('#broadcastCourseId').value;
            } else if (targetType === 'status') {
                params.status = modal.querySelector('#broadcastStatus').value;
            } else if (targetType === 'recent') {
                params.recentDays = modal.querySelector('#broadcastRecentDays').value;
            }

            const response = await APIClient.get('/api/broadcast/audience-stats', params);

            if (response && response.success) {
                const stats = response.data;
                this.renderAudienceStats(statsContainer, stats);
            }
        } catch (error) {
            statsContainer.innerHTML = '<div class="error-info">❌ Ошибка загрузки статистики</div>';
        }
    }

    renderAudienceStats(container, stats) {
        container.innerHTML = `
            <div class="audience-overview">
                <div class="stat-cards">
                    <div class="stat-card">
                        <div class="stat-number">${stats.totalUsers}</div>
                        <div class="stat-label">Получат уведомление</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.activeUsers || 0}</div>
                        <div class="stat-label">Активные пользователи</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.recentUsers || 0}</div>
                        <div class="stat-label">Активны за неделю</div>
                    </div>
                </div>
                
                ${stats.totalUsers > 0 ? `
                    <div class="audience-breakdown">
                        <h5>Детализация аудитории:</h5>
                        <div class="breakdown-list">
                            ${stats.breakdown ? stats.breakdown.map(item => `
                                <div class="breakdown-item">
                                    <span class="breakdown-label">${item.label}</span>
                                    <span class="breakdown-count">${item.count}</span>
                                </div>
                            `).join('') : ''}
                        </div>
                    </div>
                ` : '<div class="no-audience">Нет пользователей для выбранных критериев</div>'}
            </div>
        `;
    }

    updateBroadcastPreview(modal) {
        const message = modal.querySelector('#broadcastMessage').value;
        const mediaType = modal.querySelector('#broadcastMediaType').value;
        const mediaUrl = modal.querySelector('#broadcastMediaUrl').value;
        const buttonText = modal.querySelector('#broadcastButtonText').value;

        const previewContainer = modal.querySelector('#broadcastPreview');

        let mediaContent = '';
        if (mediaType === 'PHOTO' && mediaUrl) {
            mediaContent = `<img src="${mediaUrl}" alt="Preview" class="preview-media" style="max-width: 100%; max-height: 200px; border-radius: 8px;" onerror="this.style.display='none'">`;
        } else if (mediaType === 'VIDEO' && mediaUrl) {
            mediaContent = `<video controls class="preview-media" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                <source src="${mediaUrl}" type="video/mp4">
            </video>`;
        }

        previewContainer.innerHTML = `
            <div class="message-preview">
                ${mediaContent}
                <div class="preview-text">${message || 'Введите текст сообщения для предпросмотра'}</div>
                ${buttonText ? `<div class="preview-button">
                    <button class="btn btn-primary btn-sm" disabled>${buttonText}</button>
                </div>` : ''}
            </div>
        `;
    }

    async showBroadcastPreview(modal) {
        const formData = new FormData(modal.querySelector('#broadcastForm'));
        const previewData = {
            targetType: formData.get('targetType'),
            message: formData.get('message'),
            mediaType: formData.get('mediaType'),
            mediaUrl: formData.get('mediaUrl'),
            buttonText: formData.get('buttonText'),
            buttonUrl: formData.get('buttonUrl')
        };

        const previewModal = document.createElement('div');
        previewModal.className = 'modal';
        previewModal.style.display = 'block';
        previewModal.innerHTML = `
            <div class="modal-content preview-modal" style="max-width: 500px;">
                <button class="close-modal">&times;</button>
                <h3>👁️ Предпросмотр рассылки</h3>
                
                <div class="preview-telegram-message">
                    ${this.generateTelegramPreview(previewData)}
                </div>

                <div class="preview-info">
                    <h4>ℹ️ Информация о рассылке</h4>
                    <div class="info-list">
                        <div class="info-item">
                            <label>Тип аудитории:</label>
                            <span>${this.getTargetTypeLabel(previewData.targetType)}</span>
                        </div>
                        <div class="info-item">
                            <label>Тип сообщения:</label>
                            <span>${this.getMediaTypeLabel(previewData.mediaType)}</span>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
                </div>
            </div>
        `;

        previewModal.querySelector('.close-modal').addEventListener('click', () => previewModal.remove());
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) previewModal.remove();
        });

        document.body.appendChild(previewModal);
    }

    generateTelegramPreview(data) {
        let content = '<div class="telegram-message">';

        if (data.mediaType === 'PHOTO' && data.mediaUrl) {
            content += `<img src="${data.mediaUrl}" alt="Media" class="telegram-media">`;
        } else if (data.mediaType === 'VIDEO' && data.mediaUrl) {
            content += `<video controls class="telegram-media"><source src="${data.mediaUrl}" type="video/mp4"></video>`;
        }

        content += `<div class="telegram-text">${data.message}</div>`;

        if (data.buttonText && data.buttonUrl) {
            content += `<div class="telegram-button">
                <a href="${data.buttonUrl}" class="btn btn-primary btn-sm" target="_blank">${data.buttonText}</a>
            </div>`;
        }

        content += '</div>';
        return content;
    }

    getTargetTypeLabel(type) {
        const labels = {
            'all': 'Все пользователи',
            'course': 'Пользователи курса',
            'status': 'По статусу обучения',
            'recent': 'Недавно зарегистрированные'
        };
        return labels[type] || type;
    }

    getMediaTypeLabel(type) {
        const labels = {
            'text': 'Только текст',
            'PHOTO': 'Фото с текстом',
            'VIDEO': 'Видео с текстом'
        };
        return labels[type] || type;
    }

    async handleBroadcastSubmit(event, modal) {
        const submitButton = event.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Отправка...';

            const formData = new FormData(event.target);
            const broadcastData = {
                targetType: formData.get('targetType'),
                courseId: formData.get('courseId'),
                status: formData.get('status'),
                recentDays: formData.get('recentDays'),
                mediaType: formData.get('mediaType'),
                mediaUrl: formData.get('mediaUrl'),
                message: formData.get('message'),
                buttonText: formData.get('buttonText'),
                buttonUrl: formData.get('buttonUrl')
            };

            // Валидация
            if (!broadcastData.message.trim()) {
                throw new Error('Введите текст сообщения');
            }

            if (broadcastData.mediaType !== 'text' && !broadcastData.mediaUrl) {
                throw new Error('Укажите URL медиа файла');
            }

            if (broadcastData.buttonText && !broadcastData.buttonUrl) {
                throw new Error('Если указан текст кнопки, укажите также URL кнопки');
            }

            // Подтверждение отправки
            const confirmResult = await this.showBroadcastConfirmation(broadcastData);
            if (!confirmResult) {
                return;
            }

            // Отправляем рассылку
            const response = await APIClient.post('/api/broadcast/send', broadcastData);

            if (response && response.success) {
                modal.remove();
                this.showBroadcastResults(response.data);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка отправки рассылки: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }

    async showBroadcastConfirmation(data) {
        return new Promise((resolve) => {
            const confirmModal = document.createElement('div');
            confirmModal.className = 'modal';
            confirmModal.style.display = 'block';
            confirmModal.innerHTML = `
                <div class="modal-content confirm-broadcast-modal" style="max-width: 500px;">
                    <h3>⚠️ Подтверждение рассылки</h3>
                    
                    <div class="confirmation-content">
                        <p><strong>Вы уверены, что хотите отправить рассылку?</strong></p>
                        
                        <div class="confirmation-details">
                            <div class="detail-item">
                                <label>Аудитория:</label>
                                <span>${this.getTargetTypeLabel(data.targetType)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Тип сообщения:</label>
                                <span>${this.getMediaTypeLabel(data.mediaType)}</span>
                            </div>
                        </div>

                        <div class="warning-message">
                            <p>⚠️ Это действие нельзя отменить. Все выбранные пользователи получат уведомление.</p>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn btn-danger confirm-send-btn">📤 Да, отправить</button>
                        <button class="btn btn-secondary cancel-send-btn">Отмена</button>
                    </div>
                </div>
            `;

            confirmModal.querySelector('.confirm-send-btn').addEventListener('click', () => {
                confirmModal.remove();
                resolve(true);
            });

            confirmModal.querySelector('.cancel-send-btn').addEventListener('click', () => {
                confirmModal.remove();
                resolve(false);
            });

            confirmModal.addEventListener('click', (e) => {
                if (e.target === confirmModal) {
                    confirmModal.remove();
                    resolve(false);
                }
            });

            document.body.appendChild(confirmModal);
        });
    }

    showBroadcastResults(results) {
        const resultsModal = document.createElement('div');
        resultsModal.className = 'modal';
        resultsModal.style.display = 'block';
        resultsModal.innerHTML = `
            <div class="modal-content broadcast-results-modal" style="max-width: 600px;">
                <button class="close-modal">&times;</button>
                <div class="results-header">
                    <h3>📊 Результаты рассылки</h3>
                    <div class="results-summary ${results.sent > 0 ? 'success' : 'warning'}">
                        ${results.sent > 0 ? '✅ Рассылка завершена' : '⚠️ Рассылка выполнена с ошибками'}
                    </div>
                </div>

                <div class="results-stats">
                    <div class="stat-cards">
                        <div class="stat-card success">
                            <div class="stat-number">${results.sent}</div>
                            <div class="stat-label">Отправлено успешно</div>
                        </div>
                        <div class="stat-card ${results.failed > 0 ? 'danger' : 'neutral'}">
                            <div class="stat-number">${results.failed}</div>
                            <div class="stat-label">Ошибки отправки</div>
                        </div>
                        <div class="stat-card neutral">
                            <div class="stat-number">${results.total}</div>
                            <div class="stat-label">Всего пользователей</div>
                        </div>
                    </div>
                </div>

                ${results.details ? `
                    <div class="results-details">
                        <h4>📋 Детальная информация</h4>
                        <div class="details-list">
                            ${results.details.map(detail => `
                                <div class="detail-item ${detail.success ? 'success' : 'error'}">
                                    <span class="detail-icon">${detail.success ? '✅' : '❌'}</span>
                                    <span class="detail-text">${detail.message}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Закрыть</button>
                </div>
            </div>
        `;

        resultsModal.querySelector('.close-modal').addEventListener('click', () => resultsModal.remove());
        resultsModal.addEventListener('click', (e) => {
            if (e.target === resultsModal) resultsModal.remove();
        });

        document.body.appendChild(resultsModal);
    }

    async handleNotificationSubmit(e) {
        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        try {
            submitButton.disabled = true;
            submitButton.textContent = this.currentEditingNotification ? 'Обновление...' : 'Создание...';

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
                throw new Error('Укажите URL медиа файла');
            }

            if (!notificationData.caption) {
                throw new Error('Укажите текст уведомления');
            }

            if (notificationData.buttonText && !notificationData.buttonUrl) {
                throw new Error('Если указан текст кнопки, укажите также URL кнопки');
            }

            if (notificationData.delayMinutes < 1) {
                throw new Error('Задержка должна быть не менее 1 минуты');
            }

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
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
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