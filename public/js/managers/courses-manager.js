import { APIClient } from '../api.js';
import { UIManager } from '../ui.js';
import { paginationManager, debounce } from '../pagination.js';

export class CoursesManager {
    constructor() {
        this.currentEditingCourse = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add course button
        document.getElementById('addCourseBtn').addEventListener('click', () => {
            this.currentEditingCourse = null;
            document.getElementById('courseModalTitle').textContent = 'Добавить курс';
            document.getElementById('courseForm').reset();
            document.getElementById('courseIsActive').checked = true;
            UIManager.openModal('courseModal');
        });

        // Course form submit
        document.getElementById('courseForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCourseSubmit(e);
        });

        // Search handler
        document.getElementById('coursesSearch').addEventListener('input',
            debounce(() => {
                paginationManager.resetPage('courses');
                this.loadCourses();
            }, 500)
        );

        // Refresh button
        document.getElementById('refreshCourses').addEventListener('click', () => this.loadCourses());

        // Global functions for buttons
        window.editCourse = (courseId) => this.editCourse(courseId);
        window.deleteCourse = (courseId) => this.deleteCourse(courseId);
        window.toggleCourseStatus = (courseId) => this.toggleCourseStatus(courseId);
        window.duplicateCourse = (courseId) => this.duplicateCourse(courseId);
        window.viewCourseStatistics = (courseId) => this.viewCourseStatistics(courseId);
    }

    async handleCourseSubmit(e) {
        const formData = new FormData(e.target);
        const courseData = {
            title: formData.get('title'),
            description: formData.get('description'),
            orderIndex: parseInt(formData.get('orderIndex')) || 0,
            isActive: formData.has('isActive')
        };

        try {
            let response;
            if (this.currentEditingCourse) {
                response = await APIClient.put(`/api/courses/${this.currentEditingCourse}`, courseData);
            } else {
                response = await APIClient.post('/api/courses', courseData);
            }

            if (response && response.success) {
                UIManager.closeModal('courseModal');
                this.loadCourses();
                UIManager.showSuccessMessage(
                    this.currentEditingCourse ? 'Курс обновлен' : 'Курс создан'
                );
                this.currentEditingCourse = null;
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка сохранения курса: ' + error.message);
        }
    }

    async loadCourses() {
        UIManager.showLoading('coursesLoading');
        UIManager.hideTable('coursesTable');

        try {
            const search = document.getElementById('coursesSearch').value;

            const params = {
                page: paginationManager.getPage('courses'),
                limit: paginationManager.getItemsPerPage(),
                ...(search && { search })
            };

            const response = await APIClient.get('/api/courses', params);

            if (response && response.success) {
                this.renderCoursesTable(response.data);
                UIManager.showTable('coursesTable');

                if (response.pagination) {
                    paginationManager.createPagination(
                        'coursesPagination',
                        response.pagination.page,
                        response.pagination.totalPages,
                        () => this.loadCourses()
                    );
                }

                // Обновляем фильтры курсов в других модулях
                this.updateCourseFilters(response.data);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки курсов: ' + error.message);
        } finally {
            UIManager.hideLoading('coursesLoading');
        }
    }

    renderCoursesTable(courses) {
        const tbody = document.querySelector('#coursesTable tbody');
        tbody.innerHTML = '';

        if (!courses || courses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет курсов</td></tr>';
            return;
        }

        courses.forEach(course => {
            const row = document.createElement('tr');

            // Подсчет статистики
            const lessonsCount = course._count?.lessons || 0;
            const usersCount = course._count?.userCourses || 0;

            row.innerHTML = `
                <td>${course.id}</td>
                <td>
                    <div class="course-title-cell">
                        <strong>${course.title}</strong>
                        <div class="course-stats">
                            <span class="stat-badge">📖 ${lessonsCount} уроков</span>
                            <span class="stat-badge">👥 ${usersCount} студентов</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="course-description">
                        ${course.description ?
                    (course.description.length > 100 ?
                        course.description.substring(0, 100) + '...' :
                        course.description
                    ) :
                    'Нет описания'
                }
                    </div>
                </td>
                <td>
                    <span class="status-${course.isActive ? 'active' : 'inactive'}">
                        ${course.isActive ? '✅ Активен' : '❌ Неактивен'}
                    </span>
                </td>
                <td>
                    <span class="order-badge">${course.orderIndex}</span>
                </td>
                <td>
                    <span class="lesson-count">${lessonsCount}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-info" onclick="viewCourseStatistics('${course.id}')" title="Статистика">
                            📊
                        </button>
                        <button class="btn btn-sm" onclick="editCourse('${course.id}')" title="Редактировать">
                            ✏️
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="duplicateCourse('${course.id}')" title="Дублировать">
                            📋
                        </button>
                        <button class="btn btn-sm ${course.isActive ? 'btn-warning' : 'btn-success'}" 
                                onclick="toggleCourseStatus('${course.id}')" 
                                title="${course.isActive ? 'Деактивировать' : 'Активировать'}">
                            ${course.isActive ? '⏸️' : '▶️'}
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCourse('${course.id}')" title="Удалить">
                            🗑️
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async editCourse(courseId) {
        try {
            const response = await APIClient.get(`/api/courses/${courseId}`);

            if (response && response.success) {
                const course = response.data;
                this.currentEditingCourse = courseId;

                document.getElementById('courseModalTitle').textContent = 'Редактировать курс';
                document.getElementById('courseTitle').value = course.title;
                document.getElementById('courseDescription').value = course.description || '';
                document.getElementById('courseOrderIndex').value = course.orderIndex;
                document.getElementById('courseIsActive').checked = course.isActive;

                UIManager.openModal('courseModal');
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки данных курса: ' + error.message);
        }
    }

    async deleteCourse(courseId) {
        if (!confirm('Вы уверены, что хотите удалить этот курс? Все связанные уроки, тесты и прогресс пользователей также будут удалены.')) {
            return;
        }

        try {
            const response = await APIClient.delete(`/api/courses/${courseId}`);

            if (response && response.success) {
                UIManager.showSuccessMessage('Курс удален');
                this.loadCourses();
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка удаления курса: ' + error.message);
        }
    }

    async toggleCourseStatus(courseId) {
        try {
            const response = await APIClient.put(`/api/courses/${courseId}/toggle`);

            if (response && response.success) {
                UIManager.showSuccessMessage('Статус курса изменен');
                this.loadCourses();
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка изменения статуса курса: ' + error.message);
        }
    }

    async duplicateCourse(courseId) {
        if (!confirm('Создать копию этого курса?')) {
            return;
        }

        try {
            const response = await APIClient.get(`/api/courses/${courseId}`);

            if (response && response.success) {
                const originalCourse = response.data;

                const duplicateData = {
                    title: `${originalCourse.title} (копия)`,
                    description: originalCourse.description,
                    orderIndex: (originalCourse.orderIndex || 0) + 1,
                    isActive: false
                };

                const createResponse = await APIClient.post('/api/courses', duplicateData);

                if (createResponse && createResponse.success) {
                    UIManager.showSuccessMessage('Копия курса создана');
                    this.loadCourses();
                }
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка дублирования курса: ' + error.message);
        }
    }

    async viewCourseStatistics(courseId) {
        try {
            const response = await APIClient.get(`/api/courses/${courseId}`);

            if (response && response.success) {
                const course = response.data;
                this.showCourseStatisticsModal(course);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки статистики курса: ' + error.message);
        }
    }

    showCourseStatisticsModal(course) {
        const modalContent = this.generateStatisticsModalContent(course);

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content course-stats-modal" style="max-width: 800px;">
                <button class="close-modal">&times;</button>
                ${modalContent}
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
                    <button class="btn btn-primary" onclick="exportCourseStats('${course.id}')">Экспорт статистики</button>
                </div>
            </div>
        `;

        // Добавляем обработчики закрытия
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Глобальная функция для экспорта
        window.exportCourseStats = (courseId) => {
            this.exportCourseStatistics(courseId);
            modal.remove();
        };

        document.body.appendChild(modal);
    }

    generateStatisticsModalContent(course) {
        const lessonsCount = course.lessons?.length || 0;
        const testsCount = course.lessons?.filter(lesson => lesson.test).length || 0;

        return `
            <div class="course-stats-header">
                <h3>📊 Статистика курса: ${course.title}</h3>
                <div class="stats-overview">
                    <div class="stat-card">
                        <div class="stat-number">${lessonsCount}</div>
                        <div class="stat-label">Уроков</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${testsCount}</div>
                        <div class="stat-label">Тестов</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${course._count?.userCourses || 0}</div>
                        <div class="stat-label">Студентов</div>
                    </div>
                </div>
            </div>

            <div class="course-details-section">
                <h4>📝 Информация о курсе</h4>
                <div class="course-info-grid">
                    <div class="info-item">
                        <label>ID курса:</label>
                        <span>${course.id}</span>
                    </div>
                    <div class="info-item">
                        <label>Статус:</label>
                        <span class="status-${course.isActive ? 'active' : 'inactive'}">
                            ${course.isActive ? '✅ Активен' : '❌ Неактивен'}
                        </span>
                    </div>
                    <div class="info-item">
                        <label>Порядок:</label>
                        <span>${course.orderIndex}</span>
                    </div>
                    <div class="info-item">
                        <label>Создан:</label>
                        <span>${new Date(course.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div class="info-item">
                        <label>Обновлен:</label>
                        <span>${new Date(course.updatedAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                </div>
                ${course.description ? `
                <div class="course-description-full">
                    <label>Описание:</label>
                    <p>${course.description}</p>
                </div>
                ` : ''}
            </div>

            <div class="lessons-overview-section">
                <h4>📖 Обзор уроков</h4>
                ${this.generateLessonsOverviewContent(course.lessons)}
            </div>
        `;
    }

    generateLessonsOverviewContent(lessons) {
        if (!lessons || lessons.length === 0) {
            return '<p class="no-data">В курсе пока нет уроков</p>';
        }

        return `
            <div class="lessons-grid">
                ${lessons.map((lesson, index) => `
                    <div class="lesson-card">
                        <div class="lesson-header">
                            <span class="lesson-number">${index + 1}</span>
                            <span class="media-type-badge media-type-${lesson.mediaType.toLowerCase()}">
                                ${lesson.mediaType === 'PHOTO' ? '📷' : '🎬'}
                            </span>
                        </div>
                        <div class="lesson-content">
                            <h5>${lesson.title}</h5>
                            <div class="lesson-features">
                                ${lesson.test ? '<span class="feature-badge has-test">📝 Тест</span>' : '<span class="feature-badge no-test">Без теста</span>'}
                                ${lesson.buttonText ? '<span class="feature-badge has-button">🔗 Кнопка</span>' : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async exportCourseStatistics(courseId) {
        try {
            const response = await APIClient.get(`/api/courses/${courseId}`);

            if (response && response.success) {
                const course = response.data;
                const exportData = this.prepareCourseExportData(course);
                this.downloadJSON(exportData, `course_${course.id}_statistics.json`);
                UIManager.showSuccessMessage('Статистика курса экспортирована');
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка экспорта статистики: ' + error.message);
        }
    }

    prepareCourseExportData(course) {
        return {
            course_info: {
                id: course.id,
                title: course.title,
                description: course.description,
                is_active: course.isActive,
                order_index: course.orderIndex,
                created_at: course.createdAt,
                updated_at: course.updatedAt
            },
            statistics: {
                total_lessons: course.lessons?.length || 0,
                lessons_with_tests: course.lessons?.filter(l => l.test).length || 0,
                total_students: course._count?.userCourses || 0,
                photo_lessons: course.lessons?.filter(l => l.mediaType === 'PHOTO').length || 0,
                video_lessons: course.lessons?.filter(l => l.mediaType === 'VIDEO').length || 0
            },
            lessons: course.lessons?.map((lesson, index) => ({
                order: index + 1,
                id: lesson.id,
                title: lesson.title,
                media_type: lesson.mediaType,
                has_test: !!lesson.test,
                has_button: !!lesson.buttonText,
                order_index: lesson.orderIndex
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

    updateCourseFilters(courses) {
        // Обновляем селекты курсов в других модулях
        const selectors = [
            '#courseFilter', // для фильтра уроков
            '#lessonCourseId', // для создания уроков
            '#notificationCourseId' // для уведомлений
        ];

        selectors.forEach(selector => {
            const select = document.querySelector(selector);
            if (!select) return;

            const currentValue = select.value;
            const isFilter = selector === '#courseFilter';
            const isNotification = selector === '#notificationCourseId';

            // Очищаем и заполняем заново
            if (isNotification) {
                select.innerHTML = '<option value="">Для всех курсов</option>';
            } else if (isFilter) {
                select.innerHTML = '<option value="">Все курсы</option>';
            } else {
                select.innerHTML = '<option value="">Выберите курс</option>';
            }

            courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = course.title;
                option.disabled = !course.isActive && !isFilter && !isNotification;
                select.appendChild(option);
            });

            // Восстанавливаем значение
            select.value = currentValue;
        });
    }

    showMessage(message, type) {
        if (type === 'success') {
            UIManager.showSuccessMessage(message);
        } else {
            UIManager.showErrorMessage(message);
        }
    }
}