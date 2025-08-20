import { APIClient } from '../api.js';
import { UIManager } from '../ui.js';
import { paginationManager, debounce } from '../pagination.js';

export class UsersManager {
    constructor() {
        this.currentEditingUser = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search handler
        document.getElementById('usersSearch').addEventListener('input',
            debounce(() => {
                paginationManager.resetPage('users');
                this.loadUsers();
            }, 500)
        );

        // Course progress filter
        document.getElementById('courseProgressFilter').addEventListener('change', () => {
            paginationManager.resetPage('users');
            this.loadUsers();
        });

        // Clear filters button
        document.getElementById('clearUserFilters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Refresh button
        document.getElementById('refreshUsers').addEventListener('click', () => this.loadUsers());

        // Global functions for buttons
        window.viewUserProgress = (userId) => this.viewUserProgress(userId);
        window.deleteUser = (userId) => this.deleteUser(userId);
        window.exportUserData = (userId) => this.exportUserData(userId);
    }

    clearAllFilters() {
        document.getElementById('usersSearch').value = '';
        document.getElementById('courseProgressFilter').value = '';
        paginationManager.resetPage('users');
        this.loadUsers();
    }

    async loadUsers() {
        UIManager.showLoading('usersLoading');
        UIManager.hideTable('usersTable');

        try {
            const search = document.getElementById('usersSearch').value;
            const courseStatus = document.getElementById('courseProgressFilter').value;

            const params = {
                page: paginationManager.getPage('users'),
                limit: paginationManager.getItemsPerPage(),
                ...(search && { search }),
                ...(courseStatus && { courseStatus })
            };

            const response = await APIClient.get('/api/users', params);

            if (response && response.success) {
                this.renderUsersTable(response.data);
                UIManager.showTable('usersTable');

                if (response.pagination) {
                    paginationManager.createPagination(
                        'usersPagination',
                        response.pagination.page,
                        response.pagination.totalPages,
                        () => this.loadUsers()
                    );
                }

                this.updateFiltersInfo(response.pagination?.total || 0);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки пользователей: ' + error.message);
        } finally {
            UIManager.hideLoading('usersLoading');
        }
    }

    renderUsersTable(users) {
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';

        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет пользователей</td></tr>';
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');

            // Определяем статус прогресса
            let progressStatus = this.getUserProgressStatus(user);
            let progressText = this.getUserProgressText(user);

            // Добавляем класс для стилизации
            row.className = `user-${progressStatus.status}`;

            // Форматируем результаты тестов
            const testResults = this.formatTestResults(user.testResults);

            row.innerHTML = `
                <td>${user.telegramId}</td>
                <td>
                    <div class="user-info">
                        <span class="user-name">${this.getDisplayName(user)}</span>
                        ${user.phoneNumber ? '<span class="phone-verified">📱</span>' : ''}
                    </div>
                </td>
                <td>@${user.username || 'N/A'}</td>
                <td>${user.phoneNumber || 'Не указан'}</td>
                <td>
                    <span class="status-${progressStatus.status}">${progressText}</span>
                    ${testResults ? `<br><small class="test-results">${testResults}</small>` : ''}
                </td>
                <td>${new Date(user.createdAt).toLocaleDateString('ru-RU')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-info" onclick="viewUserProgress('${user.id}')" title="Просмотр прогресса">
                            👁️
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="exportUserData('${user.id}')" title="Экспорт данных">
                            📊
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')" title="Удалить">
                            🗑️
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    getUserProgressStatus(user) {
        if (!user.userCourses || user.userCourses.length === 0) {
            return { status: 'not-started', state: null };
        }

        const activeCourse = user.userCourses.find(uc => !uc.completedAt) || user.userCourses[0];

        if (activeCourse.completedAt) {
            return { status: 'completed', state: activeCourse.state };
        } else if (activeCourse.currentLessonIndex > 0) {
            return { status: 'in-progress', state: activeCourse.state };
        } else {
            return { status: 'not-started', state: activeCourse.state };
        }
    }

    getUserProgressText(user) {
        const progressStatus = this.getUserProgressStatus(user);

        if (progressStatus.status === 'not-started') {
            return 'Не начинал';
        }

        if (progressStatus.status === 'completed') {
            return 'Завершен';
        }

        const activeCourse = user.userCourses.find(uc => !uc.completedAt);
        if (activeCourse) {
            let text = `Урок ${activeCourse.currentLessonIndex + 1}`;

            // Добавляем информацию о состоянии
            const stateLabels = {
                'WATCHING_LESSON': 'Смотрит урок',
                'TAKING_TEST': 'Проходит тест',
                'COMPLETED_COURSE': 'Завершил курс'
            };

            if (progressStatus.state && stateLabels[progressStatus.state]) {
                text += ` (${stateLabels[progressStatus.state]})`;
            }

            return text;
        }

        return 'В процессе';
    }

    getDisplayName(user) {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        return fullName || 'Без имени';
    }

    formatTestResults(testResults) {
        if (!testResults || testResults.length === 0) {
            return null;
        }

        const avgScore = testResults.reduce((acc, tr) => acc + tr.score, 0) / testResults.length;
        const gradeEmojis = {
            'A': '🏆',
            'B': '🥈',
            'C': '🥉',
            'D': '📚',
            'F': '📖'
        };

        const lastResult = testResults[testResults.length - 1];
        const emoji = gradeEmojis[lastResult.grade] || '';

        return `${emoji} ${Math.round(avgScore)}% (${testResults.length} тест${testResults.length > 1 ? 'ов' : ''})`;
    }

    async viewUserProgress(userId) {
        try {
            const response = await APIClient.get(`/api/users/${userId}`);

            if (response && response.success) {
                const user = response.data;
                this.showUserProgressModal(user);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки прогресса пользователя: ' + error.message);
        }
    }

    showUserProgressModal(user) {
        const modalContent = this.generateProgressModalContent(user);

        // Создаем модальное окно динамически
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content user-progress-modal" style="max-width: 900px;">
                <button class="close-modal">&times;</button>
                ${modalContent}
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
                    <button class="btn btn-primary" onclick="exportUserData('${user.id}')">Экспорт данных</button>
                </div>
            </div>
        `;

        // Добавляем обработчики закрытия
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        document.body.appendChild(modal);
    }

    generateProgressModalContent(user) {
        let content = `
            <div class="user-progress-header">
                <h3>👤 Профиль пользователя</h3>
                <div class="user-basic-info">
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Имя:</label>
                            <span>${this.getDisplayName(user)}</span>
                        </div>
                        <div class="info-item">
                            <label>Telegram ID:</label>
                            <span>${user.telegramId}</span>
                        </div>
                        <div class="info-item">
                            <label>Username:</label>
                            <span>@${user.username || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <label>Телефон:</label>
                            <span>${user.phoneNumber || 'Не указан'}</span>
                        </div>
                        <div class="info-item">
                            <label>Дата регистрации:</label>
                            <span>${new Date(user.createdAt).toLocaleDateString('ru-RU')}</span>
                        </div>
                        <div class="info-item">
                            <label>Последнее обновление:</label>
                            <span>${new Date(user.updatedAt).toLocaleDateString('ru-RU')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="user-progress-courses">
                <h4>📚 Прогресс по курсам</h4>
                ${this.generateCoursesProgressContent(user.userCourses)}
            </div>

            <div class="user-progress-tests">
                <h4>📝 Результаты тестов</h4>
                ${this.generateTestResultsContent(user.testResults)}
            </div>
        `;

        return content;
    }

    generateCoursesProgressContent(userCourses) {
        if (!userCourses || userCourses.length === 0) {
            return '<p class="no-data">Пользователь еще не начинал курсы</p>';
        }

        return userCourses.map(uc => {
            const completionStatus = uc.completedAt ? '✅ Завершен' : '🔄 В процессе';
            const completionDate = uc.completedAt ? new Date(uc.completedAt).toLocaleDateString('ru-RU') : '';

            const stateLabels = {
                'WATCHING_LESSON': 'Просмотр урока',
                'TAKING_TEST': 'Прохождение теста',
                'COMPLETED_COURSE': 'Курс завершен'
            };

            return `
                <div class="course-progress-item">
                    <div class="course-header">
                        <h5>${uc.course?.title || 'N/A'}</h5>
                        <span class="completion-status ${uc.completedAt ? 'completed' : 'in-progress'}">${completionStatus}</span>
                    </div>
                    <div class="course-details">
                        <div class="detail-item">
                            <label>Текущий урок:</label>
                            <span>${uc.currentLessonIndex + 1}</span>
                        </div>
                        <div class="detail-item">
                            <label>Состояние:</label>
                            <span>${stateLabels[uc.state] || uc.state}</span>
                        </div>
                        ${completionDate ? `
                        <div class="detail-item">
                            <label>Дата завершения:</label>
                            <span>${completionDate}</span>
                        </div>
                        ` : ''}
                        <div class="detail-item">
                            <label>Последняя активность:</label>
                            <span>${new Date(uc.lastActivity).toLocaleString('ru-RU')}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    generateTestResultsContent(testResults) {
        if (!testResults || testResults.length === 0) {
            return '<p class="no-data">Тесты еще не проходились</p>';
        }

        const gradeLabels = {
            'A': '🏆 Отлично',
            'B': '🥈 Хорошо',
            'C': '🥉 Удовлетворительно',
            'D': '📚 Слабо',
            'F': '📖 Неудовлетворительно'
        };

        return testResults.map(tr => `
            <div class="test-result-item">
                <div class="test-header">
                    <h5>${tr.test?.title || 'N/A'}</h5>
                    <span class="grade grade-${tr.grade.toLowerCase()}">${gradeLabels[tr.grade]} (${tr.score}%)</span>
                </div>
                <div class="test-details">
                    <div class="detail-item">
                        <label>Дата прохождения:</label>
                        <span>${new Date(tr.createdAt).toLocaleString('ru-RU')}</span>
                    </div>
                    <div class="detail-item">
                        <label>Урок:</label>
                        <span>${tr.test?.lesson?.title || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async exportUserData(userId) {
        try {
            const response = await APIClient.get(`/api/users/${userId}`);

            if (response && response.success) {
                const user = response.data;
                const exportData = this.prepareExportData(user);
                this.downloadJSON(exportData, `user_${user.telegramId}_data.json`);
                UIManager.showSuccessMessage('Данные пользователя экспортированы');
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка экспорта данных: ' + error.message);
        }
    }

    prepareExportData(user) {
        return {
            user_info: {
                telegram_id: user.telegramId,
                name: this.getDisplayName(user),
                username: user.username,
                phone: user.phoneNumber,
                registration_date: user.createdAt,
                last_update: user.updatedAt
            },
            course_progress: user.userCourses?.map(uc => ({
                course_title: uc.course?.title,
                current_lesson: uc.currentLessonIndex + 1,
                state: uc.state,
                completed: !!uc.completedAt,
                completion_date: uc.completedAt,
                last_activity: uc.lastActivity
            })) || [],
            test_results: user.testResults?.map(tr => ({
                test_title: tr.test?.title,
                lesson_title: tr.test?.lesson?.title,
                score: tr.score,
                grade: tr.grade,
                date: tr.createdAt
            })) || [],
            export_date: new Date().toISOString()
        };
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async deleteUser(userId) {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя? Все связанные данные также будут удалены.')) {
            return;
        }

        try {
            const response = await APIClient.delete(`/api/users/${userId}`);

            if (response && response.success) {
                UIManager.showSuccessMessage('Пользователь удален');
                this.loadUsers();
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка удаления пользователя: ' + error.message);
        }
    }

    updateFiltersInfo(total) {
        const element = document.getElementById('usersFiltersInfo');
        if (!element) return;

        const search = document.getElementById('usersSearch').value;
        const courseStatus = document.getElementById('courseProgressFilter').value;

        let infoText = `Показано пользователей: ${total}`;

        const activeFilters = [];
        if (search) activeFilters.push(`поиск: "${search}"`);
        if (courseStatus) {
            const filterLabels = {
                'completed': 'завершили курс',
                'in_progress': 'в процессе',
                'not_started': 'не начинали'
            };
            activeFilters.push(`статус: ${filterLabels[courseStatus]}`);
        }

        if (activeFilters.length > 0) {
            infoText += ` (фильтры: ${activeFilters.join(', ')})`;
        }

        element.textContent = infoText;
    }

    showMessage(message, type) {
        if (type === 'success') {
            UIManager.showSuccessMessage(message);
        } else {
            UIManager.showErrorMessage(message);
        }
    }
}