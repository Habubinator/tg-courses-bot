import { APIClient } from '../api.js';
import { UIManager } from '../ui.js';
import { paginationManager, debounce } from '../pagination.js';

export class LessonsManager {
    constructor() {
        this.currentEditingLesson = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add lesson button
        document.getElementById('addLessonBtn').addEventListener('click', () => {
            this.currentEditingLesson = null;
            document.getElementById('lessonModalTitle').textContent = 'Добавить урок';
            document.getElementById('lessonForm').reset();
            UIManager.openModal('lessonModal');
        });

        // Lesson form submit
        document.getElementById('lessonForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLessonSubmit(e);
        });

        // Search handler
        document.getElementById('lessonsSearch').addEventListener('input',
            debounce(() => {
                paginationManager.resetPage('lessons');
                this.loadLessons();
            }, 500)
        );

        // Course filter
        document.getElementById('courseFilter').addEventListener('change', () => {
            paginationManager.resetPage('lessons');
            this.loadLessons();
        });

        // Media type filter
        document.getElementById('mediaTypeFilter').addEventListener('change', () => {
            paginationManager.resetPage('lessons');
            this.loadLessons();
        });

        // Clear filters button
        document.getElementById('clearLessonFilters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Refresh button
        document.getElementById('refreshLessons').addEventListener('click', () => this.loadLessons());

        // Global functions for buttons
        window.editLesson = (lessonId) => this.editLesson(lessonId);
        window.deleteLesson = (lessonId) => this.deleteLesson(lessonId);
        window.duplicateLesson = (lessonId) => this.duplicateLesson(lessonId);
        window.viewLessonDetails = (lessonId) => this.viewLessonDetails(lessonId);
        window.previewLesson = (lessonId) => this.previewLesson(lessonId);
        window.createTestForLesson = (lessonId) => this.createTestForLesson(lessonId);
        window.viewLessonTest = (lessonId) => this.viewLessonTest(lessonId);
    }

    clearAllFilters() {
        document.getElementById('lessonsSearch').value = '';
        document.getElementById('courseFilter').value = '';
        document.getElementById('mediaTypeFilter').value = '';
        paginationManager.resetPage('lessons');
        this.loadLessons();
    }

    async handleLessonSubmit(e) {
        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        try {
            submitButton.disabled = true;
            submitButton.textContent = this.currentEditingLesson ? 'Обновление...' : 'Создание...';

            const formData = new FormData(e.target);
            const lessonData = {
                courseId: formData.get('courseId'),
                title: formData.get('title'),
                mediaType: formData.get('mediaType'),
                mediaUrl: formData.get('mediaUrl'),
                caption: formData.get('caption'),
                buttonText: formData.get('buttonText') || null,
                buttonUrl: formData.get('buttonUrl') || null,
                orderIndex: parseInt(formData.get('orderIndex')) || 0
            };

            // Валидация
            if (!lessonData.courseId) {
                throw new Error('Выберите курс');
            }

            if (!lessonData.title.trim()) {
                throw new Error('Введите название урока');
            }

            if (!lessonData.mediaUrl.trim()) {
                throw new Error('Введите URL медиа файла');
            }

            if (!lessonData.caption.trim()) {
                throw new Error('Введите описание урока');
            }

            if (lessonData.buttonText && !lessonData.buttonUrl) {
                throw new Error('Если указан текст кнопки, укажите также URL кнопки');
            }

            let response;
            if (this.currentEditingLesson) {
                response = await APIClient.put(`/api/lessons/${this.currentEditingLesson}`, lessonData);
            } else {
                response = await APIClient.post('/api/lessons', lessonData);
            }

            if (response && response.success) {
                UIManager.closeModal('lessonModal');
                this.loadLessons();
                UIManager.showSuccessMessage(
                    this.currentEditingLesson ? 'Урок обновлен' : 'Урок создан'
                );
                this.currentEditingLesson = null;
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка сохранения урока: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }

    async loadLessons() {
        UIManager.showLoading('lessonsLoading');
        UIManager.hideTable('lessonsTable');

        try {
            const search = document.getElementById('lessonsSearch').value;
            const courseId = document.getElementById('courseFilter').value;
            const mediaType = document.getElementById('mediaTypeFilter').value;

            const params = {
                page: paginationManager.getPage('lessons'),
                limit: paginationManager.getItemsPerPage(),
                ...(search && { search }),
                ...(courseId && { courseId }),
                ...(mediaType && { mediaType })
            };

            const response = await APIClient.get('/api/lessons', params);

            if (response && response.success) {
                this.renderLessonsTable(response.data);
                UIManager.showTable('lessonsTable');

                if (response.pagination) {
                    paginationManager.createPagination(
                        'lessonsPagination',
                        response.pagination.page,
                        response.pagination.totalPages,
                        () => this.loadLessons()
                    );
                }

                this.updateFiltersInfo(response.pagination?.total || 0);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки уроков: ' + error.message);
        } finally {
            UIManager.hideLoading('lessonsLoading');
        }
    }

    renderLessonsTable(lessons) {
        const tbody = document.querySelector('#lessonsTable tbody');
        tbody.innerHTML = '';

        if (!lessons || lessons.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Нет уроков</td></tr>';
            return;
        }

        lessons.forEach(lesson => {
            const row = document.createElement('tr');

            // Определяем наличие теста
            const hasTest = lesson.test ? '✅ Есть' : '❌ Нет';
            const testQuestionsCount = lesson.test?._count?.questions || 0;

            // Определяем тип медиа
            const mediaTypeIcon = lesson.mediaType === 'PHOTO' ? '📷' : '🎬';
            const mediaTypeName = lesson.mediaType === 'PHOTO' ? 'Фото' : 'Видео';

            // Определяем наличие кнопки
            const hasButton = lesson.buttonText && lesson.buttonUrl ? '🔗 Да' : '❌ Нет';

            row.innerHTML = `
                <td>${lesson.id}</td>
                <td>
                    <div class="course-info">
                        <strong>${lesson.course?.title || 'N/A'}</strong>
                        <small class="course-status ${lesson.course?.isActive ? 'active' : 'inactive'}">
                            ${lesson.course?.isActive ? '✅ Активен' : '⏸️ Неактивен'}
                        </small>
                    </div>
                </td>
                <td>
                    <div class="lesson-title-cell">
                        <strong>${lesson.title}</strong>
                        <small class="lesson-order">Порядок: ${lesson.orderIndex}</small>
                    </div>
                </td>
                <td>
                    <span class="media-type-badge media-type-${lesson.mediaType.toLowerCase()}">
                        ${mediaTypeIcon} ${mediaTypeName}
                    </span>
                </td>
                <td>
                    <div class="lesson-caption">
                        ${lesson.caption.length > 50 ?
                    lesson.caption.substring(0, 50) + '...' :
                    lesson.caption
                }
                    </div>
                </td>
                <td>
                    <span class="button-status ${lesson.buttonText ? 'has-button' : 'no-button'}">
                        ${hasButton}
                    </span>
                </td>
                <td>
                    <div class="test-status">
                        <span class="test-indicator ${lesson.test ? 'has-test' : 'no-test'}">
                            ${hasTest}
                        </span>
                        ${lesson.test ? `<small class="test-questions">Вопросов: ${testQuestionsCount}</small>` : ''}
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-info" onclick="previewLesson('${lesson.id}')" title="Предпросмотр">
                            👁️
                        </button>
                        <button class="btn btn-sm btn-success" onclick="viewLessonDetails('${lesson.id}')" title="Детали">
                            📋
                        </button>
                        <button class="btn btn-sm" onclick="editLesson('${lesson.id}')" title="Редактировать">
                            ✏️
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="duplicateLesson('${lesson.id}')" title="Дублировать">
                            📋
                        </button>
                        ${lesson.test ?
                    `<button class="btn btn-sm btn-warning" onclick="viewLessonTest('${lesson.id}')" title="Просмотр теста">📝</button>` :
                    `<button class="btn btn-sm btn-primary" onclick="createTestForLesson('${lesson.id}')" title="Создать тест">➕📝</button>`
                }
                        <button class="btn btn-sm btn-danger" onclick="deleteLesson('${lesson.id}')" title="Удалить">
                            🗑️
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async editLesson(lessonId) {
        try {
            const response = await APIClient.get(`/api/lessons/${lessonId}`);

            if (response && response.success) {
                const lesson = response.data;
                this.currentEditingLesson = lessonId;

                document.getElementById('lessonModalTitle').textContent = 'Редактировать урок';
                document.getElementById('lessonCourseId').value = lesson.courseId;
                document.getElementById('lessonTitle').value = lesson.title;
                document.getElementById('lessonMediaType').value = lesson.mediaType;
                document.getElementById('lessonMediaUrl').value = lesson.mediaUrl;
                document.getElementById('lessonCaption').value = lesson.caption;
                document.getElementById('lessonButtonText').value = lesson.buttonText || '';
                document.getElementById('lessonButtonUrl').value = lesson.buttonUrl || '';
                document.getElementById('lessonOrderIndex').value = lesson.orderIndex;

                UIManager.openModal('lessonModal');
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки данных урока: ' + error.message);
        }
    }

    async deleteLesson(lessonId) {
        if (!confirm('Вы уверены, что хотите удалить этот урок? Связанный тест также будет удален.')) {
            return;
        }

        try {
            const response = await APIClient.delete(`/api/lessons/${lessonId}`);

            if (response && response.success) {
                UIManager.showSuccessMessage('Урок удален');
                this.loadLessons();
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка удаления урока: ' + error.message);
        }
    }

    async duplicateLesson(lessonId) {
        if (!confirm('Создать копию этого урока?')) {
            return;
        }

        try {
            const response = await APIClient.get(`/api/lessons/${lessonId}`);

            if (response && response.success) {
                const originalLesson = response.data;

                const duplicateData = {
                    courseId: originalLesson.courseId,
                    title: `${originalLesson.title} (копия)`,
                    mediaType: originalLesson.mediaType,
                    mediaUrl: originalLesson.mediaUrl,
                    caption: originalLesson.caption,
                    buttonText: originalLesson.buttonText,
                    buttonUrl: originalLesson.buttonUrl,
                    orderIndex: (originalLesson.orderIndex || 0) + 1
                };

                const createResponse = await APIClient.post('/api/lessons', duplicateData);

                if (createResponse && createResponse.success) {
                    UIManager.showSuccessMessage('Копия урока создана');
                    this.loadLessons();
                }
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка дублирования урока: ' + error.message);
        }
    }

    async viewLessonDetails(lessonId) {
        try {
            const response = await APIClient.get(`/api/lessons/${lessonId}`);

            if (response && response.success) {
                const lesson = response.data;
                this.showLessonDetailsModal(lesson);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки деталей урока: ' + error.message);
        }
    }

    showLessonDetailsModal(lesson) {
        const modalContent = this.generateDetailsModalContent(lesson);

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content lesson-details-modal" style="max-width: 800px;">
                <button class="close-modal">&times;</button>
                ${modalContent}
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="editLesson('${lesson.id}'); this.closest('.modal').remove();">Редактировать</button>
                    <button class="btn btn-success" onclick="previewLesson('${lesson.id}'); this.closest('.modal').remove();">Предпросмотр</button>
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

    generateDetailsModalContent(lesson) {
        const mediaTypeIcon = lesson.mediaType === 'PHOTO' ? '📷' : '🎬';
        const mediaTypeName = lesson.mediaType === 'PHOTO' ? 'Фото' : 'Видео';

        return `
            <div class="lesson-details-header">
                <h3>📖 Детали урока: ${lesson.title}</h3>
                <div class="lesson-meta">
                    <span class="media-type-badge media-type-${lesson.mediaType.toLowerCase()}">
                        ${mediaTypeIcon} ${mediaTypeName}
                    </span>
                    <span class="order-badge">Порядок: ${lesson.orderIndex}</span>
                </div>
            </div>

            <div class="lesson-details-content">
                <div class="details-section">
                    <h4>📋 Основная информация</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>ID урока:</label>
                            <span>${lesson.id}</span>
                        </div>
                        <div class="info-item">
                            <label>Курс:</label>
                            <span>${lesson.course?.title || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <label>Название:</label>
                            <span>${lesson.title}</span>
                        </div>
                        <div class="info-item">
                            <label>Тип медиа:</label>
                            <span>${mediaTypeIcon} ${mediaTypeName}</span>
                        </div>
                        <div class="info-item">
                            <label>Порядок:</label>
                            <span>${lesson.orderIndex}</span>
                        </div>
                        <div class="info-item">
                            <label>Создан:</label>
                            <span>${new Date(lesson.createdAt).toLocaleDateString('ru-RU')}</span>
                        </div>
                        <div class="info-item">
                            <label>Обновлен:</label>
                            <span>${new Date(lesson.updatedAt).toLocaleDateString('ru-RU')}</span>
                        </div>
                    </div>
                </div>

                <div class="details-section">
                    <h4>📝 Содержание</h4>
                    <div class="content-details">
                        <div class="content-item">
                            <label>URL медиа файла:</label>
                            <div class="media-url">
                                <a href="${lesson.mediaUrl}" target="_blank" rel="noopener noreferrer">${lesson.mediaUrl}</a>
                            </div>
                        </div>
                        <div class="content-item">
                            <label>Описание урока:</label>
                            <div class="lesson-caption-full">
                                ${lesson.caption}
                            </div>
                        </div>
                    </div>
                </div>

                ${lesson.buttonText && lesson.buttonUrl ? `
                <div class="details-section">
                    <h4>🔗 Кнопка действия</h4>
                    <div class="button-details">
                        <div class="content-item">
                            <label>Текст кнопки:</label>
                            <span>${lesson.buttonText}</span>
                        </div>
                        <div class="content-item">
                            <label>URL кнопки:</label>
                            <div class="button-url">
                                <a href="${lesson.buttonUrl}" target="_blank" rel="noopener noreferrer">${lesson.buttonUrl}</a>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="details-section">
                    <h4>📝 Тест</h4>
                    ${this.generateTestSection(lesson.test, lesson.id)}
                </div>
            </div>
        `;
    }

    generateTestSection(test, lessonId) {
        if (!test) {
            return `
                <div class="no-test-info">
                    <p>❌ К этому уроку не привязан тест</p>
                    <button class="btn btn-primary" onclick="createTestForLesson('${lessonId}')">
                        ➕ Создать тест
                    </button>
                </div>
            `;
        }

        const questionsCount = test.questions?.length || 0;

        return `
            <div class="test-info">
                <div class="test-overview">
                    <div class="test-stats">
                        <div class="stat-item">
                            <label>Название теста:</label>
                            <span>${test.title}</span>
                        </div>
                        <div class="stat-item">
                            <label>Количество вопросов:</label>
                            <span>${questionsCount}</span>
                        </div>
                        <div class="stat-item">
                            <label>Создан:</label>
                            <span>${new Date(test.createdAt).toLocaleDateString('ru-RU')}</span>
                        </div>
                    </div>
                </div>
                <div class="test-actions">
                    <button class="btn btn-info" onclick="viewLessonTest('${lessonId}')">
                        📝 Просмотреть тест
                    </button>
                </div>
            </div>
        `;
    }

    async previewLesson(lessonId) {
        try {
            const response = await APIClient.get(`/api/lessons/${lessonId}`);

            if (response && response.success) {
                const lesson = response.data;
                this.showLessonPreviewModal(lesson);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки урока для предпросмотра: ' + error.message);
        }
    }

    showLessonPreviewModal(lesson) {
        const modalContent = this.generatePreviewModalContent(lesson);

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content lesson-preview-modal" style="max-width: 700px;">
                <button class="close-modal">&times;</button>
                ${modalContent}
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="editLesson('${lesson.id}'); this.closest('.modal').remove();">Редактировать</button>
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

    generatePreviewModalContent(lesson) {
        const mediaContent = lesson.mediaType === 'PHOTO' ?
            `<img src="${lesson.mediaUrl}" alt="Урок" class="lesson-preview-media" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Ошибка загрузки</text></svg>'">` :
            `<video controls class="lesson-preview-media" preload="metadata">
                <source src="${lesson.mediaUrl}" type="video/mp4">
                <p>Ваш браузер не поддерживает видео. <a href="${lesson.mediaUrl}">Скачать видео</a></p>
            </video>`;

        return `
            <div class="lesson-preview-header">
                <h3>👁️ Предпросмотр урока</h3>
                <div class="lesson-preview-meta">
                    <span class="course-name">${lesson.course?.title || 'N/A'}</span>
                    <span class="lesson-order">Урок ${lesson.orderIndex}</span>
                </div>
                <h4>${lesson.title}</h4>
            </div>

            <div class="lesson-preview-content">
                <div class="lesson-media-container">
                    ${mediaContent}
                </div>

                <div class="lesson-text">
                    <h5>📝 Описание урока:</h5>
                    <div class="lesson-caption-preview">
                        ${lesson.caption}
                    </div>
                </div>

                ${lesson.buttonText && lesson.buttonUrl ? `
                <div class="lesson-button-preview">
                    <h5>🔗 Кнопка действия:</h5>
                    <a href="${lesson.buttonUrl}" target="_blank" class="btn btn-primary lesson-action-button" rel="noopener noreferrer">
                        ${lesson.buttonText}
                    </a>
                    <small class="button-url">URL: ${lesson.buttonUrl}</small>
                </div>
                ` : ''}

                <div class="lesson-info-preview">
                    <h5>ℹ️ Информация:</h5>
                    <div class="info-preview-grid">
                        <div class="info-preview-item">
                            <label>Курс:</label>
                            <span>${lesson.course?.title || 'N/A'}</span>
                        </div>
                        <div class="info-preview-item">
                            <label>Тип медиа:</label>
                            <span>${lesson.mediaType === 'PHOTO' ? '📷 Фото' : '🎬 Видео'}</span>
                        </div>
                        <div class="info-preview-item">
                            <label>Порядок:</label>
                            <span>${lesson.orderIndex}</span>
                        </div>
                        <div class="info-preview-item">
                            <label>Тест:</label>
                            <span>${lesson.test ? '✅ Есть тест' : '❌ Нет теста'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async createTestForLesson(lessonId) {
        try {
            // Проверяем, есть ли уже тест для этого урока
            const lessonResponse = await APIClient.get(`/api/lessons/${lessonId}`);
            if (!lessonResponse.success) {
                throw new Error('Не удалось загрузить урок');
            }

            const lesson = lessonResponse.data;
            if (lesson.test) {
                UIManager.showErrorMessage('У этого урока уже есть тест');
                return;
            }

            this.showCreateTestModal(lessonId, lesson);

        } catch (error) {
            UIManager.showErrorMessage('Ошибка: ' + error.message);
        }
    }

    showCreateTestModal(lessonId, lesson) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content create-test-modal" style="max-width: 800px;">
                <button class="close-modal">&times;</button>
                <h3>📝 Создание теста для урока: ${lesson.title}</h3>
                
                <form id="createTestForm">
                    <div class="form-group">
                        <label for="testTitle">Название теста</label>
                        <input type="text" id="testTitle" name="title" required 
                               value="Тест по уроку: ${lesson.title}" />
                    </div>

                    <div class="test-questions-section">
                        <h4>Вопросы теста</h4>
                        <div id="questionsContainer">
                            <!-- Вопросы будут добавляться динамически -->
                        </div>
                        <button type="button" class="btn btn-secondary" id="addQuestionBtn">
                            ➕ Добавить вопрос
                        </button>
                    </div>

                    <div class="modal-actions">
                        <button type="submit" class="btn btn-primary">Создать тест</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
                    </div>
                </form>
            </div>
        `;

        // Добавляем обработчики
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Обработчик добавления вопросов
        modal.querySelector('#addQuestionBtn').addEventListener('click', () => {
            this.addQuestionToForm(modal.querySelector('#questionsContainer'));
        });

        // Обработчик отправки формы
        modal.querySelector('#createTestForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCreateTestSubmit(e, lessonId, modal);
        });

        // Добавляем первый вопрос по умолчанию
        this.addQuestionToForm(modal.querySelector('#questionsContainer'));

        document.body.appendChild(modal);
    }

    addQuestionToForm(container) {
        const questionIndex = container.children.length;
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-form-item';
        questionDiv.innerHTML = `
            <div class="question-header">
                <h5>Вопрос ${questionIndex + 1}</h5>
                <button type="button" class="btn btn-sm btn-danger remove-question-btn">🗑️</button>
            </div>
            
            <div class="form-group">
                <label>Текст вопроса</label>
                <textarea name="questions[${questionIndex}][text]" required rows="2" 
                          placeholder="Введите текст вопроса..."></textarea>
            </div>

            <div class="form-group">
                <label>Варианты ответов (отметьте правильный)</label>
                <div class="options-list">
                    ${[0, 1, 2, 3].map(optionIndex => `
                        <div class="option-item">
                            <input type="radio" name="questions[${questionIndex}][correct]" 
                                   value="${optionIndex}" ${optionIndex === 0 ? 'checked' : ''} />
                            <input type="text" name="questions[${questionIndex}][options][${optionIndex}]" 
                                   placeholder="Вариант ${optionIndex + 1}" required />
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Добавляем обработчик удаления вопроса
        questionDiv.querySelector('.remove-question-btn').addEventListener('click', () => {
            if (container.children.length > 1) {
                questionDiv.remove();
                this.updateQuestionNumbers(container);
            } else {
                UIManager.showErrorMessage('Тест должен содержать минимум один вопрос');
            }
        });

        container.appendChild(questionDiv);
    }

    updateQuestionNumbers(container) {
        Array.from(container.children).forEach((questionDiv, index) => {
            questionDiv.querySelector('h5').textContent = `Вопрос ${index + 1}`;

            // Обновляем индексы в именах полей
            const textarea = questionDiv.querySelector('textarea');
            textarea.name = `questions[${index}][text]`;

            const radioButtons = questionDiv.querySelectorAll('input[type="radio"]');
            const textInputs = questionDiv.querySelectorAll('input[type="text"]');

            radioButtons.forEach((radio, optionIndex) => {
                radio.name = `questions[${index}][correct]`;
                radio.value = optionIndex;
            });

            textInputs.forEach((input, optionIndex) => {
                input.name = `questions[${index}][options][${optionIndex}]`;
            });
        });
    }

    async handleCreateTestSubmit(event, lessonId, modal) {
        const submitButton = event.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Создание теста...';

            const formData = new FormData(event.target);

            // Собираем данные теста
            const testData = {
                lessonId: lessonId,
                title: formData.get('title'),
                questions: []
            };

            // Собираем вопросы
            const questionsContainer = modal.querySelector('#questionsContainer');
            const questionItems = questionsContainer.querySelectorAll('.question-form-item');

            questionItems.forEach((questionDiv, questionIndex) => {
                const questionText = formData.get(`questions[${questionIndex}][text]`);
                const correctOption = parseInt(formData.get(`questions[${questionIndex}][correct]`));

                const options = [];
                for (let i = 0; i < 4; i++) {
                    const option = formData.get(`questions[${questionIndex}][options][${i}]`);
                    if (option) {
                        options.push(option);
                    }
                }

                if (questionText && options.length >= 2) {
                    testData.questions.push({
                        questionText,
                        options,
                        correctOption,
                        orderIndex: questionIndex
                    });
                }
            });

            // Валидация
            if (!testData.title.trim()) {
                throw new Error('Введите название теста');
            }

            if (testData.questions.length === 0) {
                throw new Error('Добавьте минимум один вопрос');
            }

            // Проверяем, что у всех вопросов минимум 2 варианта ответа
            for (let i = 0; i < testData.questions.length; i++) {
                if (testData.questions[i].options.length < 2) {
                    throw new Error(`Вопрос ${i + 1} должен содержать минимум 2 варианта ответа`);
                }
            }

            // Отправляем запрос на создание теста
            const response = await APIClient.post('/api/tests', testData);

            if (response && response.success) {
                modal.remove();
                this.loadLessons(); // Обновляем таблицу уроков
                UIManager.showSuccessMessage('Тест успешно создан!');

                // Показываем модальное окно с опцией отправки уведомлений
                this.showTestCreatedNotificationModal(lessonId, response.data);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка создания теста: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }

    showTestCreatedNotificationModal(lessonId, test) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content test-notification-modal" style="max-width: 600px;">
                <button class="close-modal">&times;</button>
                <div class="notification-header">
                    <h3>✅ Тест создан успешно!</h3>
                    <p>Тест "${test.title}" был создан и привязан к уроку.</p>
                </div>

                <div class="notification-options">
                    <h4>📢 Уведомить пользователей</h4>
                    <p>Хотите ли вы отправить уведомление пользователям, которые уже прошли этот урок, о том, что теперь доступен тест?</p>
                    
                    <div class="user-stats" id="userStatsContainer">
                        <div class="loading">Загружаем статистику пользователей...</div>
                    </div>

                    <div class="notification-preview">
                        <h5>Предпросмотр уведомления:</h5>
                        <div class="message-preview">
                            📝 <strong>Новый тест доступен!</strong><br><br>
                            К уроку, который вы уже прошли, был добавлен тест. 
                            Пройдите его, чтобы закрепить полученные знания!<br><br>
                            🎯 Тест: ${test.title}
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-primary" id="sendNotificationsBtn">
                        📤 Отправить уведомления
                    </button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        Пропустить
                    </button>
                </div>
            </div>
        `;

        // Добавляем обработчики
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Загружаем статистику пользователей
        this.loadUsersWhoCompletedLesson(lessonId, modal.querySelector('#userStatsContainer'));

        // Обработчик отправки уведомлений
        modal.querySelector('#sendNotificationsBtn').addEventListener('click', async () => {
            await this.sendTestNotificationsToUsers(lessonId, test, modal);
        });

        document.body.appendChild(modal);
    }

    async loadUsersWhoCompletedLesson(lessonId, container) {
        try {
            const response = await APIClient.get(`/api/lessons/${lessonId}/completed-users`);

            if (response && response.success) {
                const users = response.data;

                if (users.length === 0) {
                    container.innerHTML = `
                        <div class="no-users-info">
                            <p>ℹ️ Пока нет пользователей, которые прошли этот урок.</p>
                        </div>
                    `;
                } else {
                    container.innerHTML = `
                        <div class="users-stats">
                            <div class="stat-item">
                                <strong>${users.length}</strong> пользователей прошли этот урок
                            </div>
                            <details class="users-list">
                                <summary>Показать список пользователей</summary>
                                <div class="users-grid">
                                    ${users.map(user => `
                                        <div class="user-item">
                                            <span class="user-name">${user.firstName || ''} ${user.lastName || ''}</span>
                                            <span class="user-username">@${user.username || 'N/A'}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        </div>
                    `;
                }
            }
        } catch (error) {
            container.innerHTML = `
                <div class="error-info">
                    <p>❌ Ошибка загрузки статистики пользователей</p>
                </div>
            `;
        }
    }

    async sendTestNotificationsToUsers(lessonId, test, modal) {
        const sendButton = modal.querySelector('#sendNotificationsBtn');
        const originalText = sendButton.textContent;

        try {
            sendButton.disabled = true;
            sendButton.textContent = 'Отправка уведомлений...';

            const response = await APIClient.post(`/api/lessons/${lessonId}/notify-test-added`, {
                testId: test.id,
                testTitle: test.title
            });

            if (response && response.success) {
                modal.remove();
                UIManager.showSuccessMessage(
                    `Уведомления отправлены ${response.data.notificationsSent} пользователям`
                );
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка отправки уведомлений: ' + error.message);
        } finally {
            sendButton.disabled = false;
            sendButton.textContent = originalText;
        }
    }

    async viewLessonTest(lessonId) {
        try {
            const response = await APIClient.get(`/api/lessons/${lessonId}`);

            if (response && response.success) {
                const lesson = response.data;
                if (lesson.test) {
                    // Перенаправляем к менеджеру тестов
                    if (window.managers && window.managers.tests) {
                        window.managers.tests.viewTestQuestions(lesson.test.id);
                    } else {
                        UIManager.showErrorMessage('Менеджер тестов недоступен');
                    }
                } else {
                    UIManager.showErrorMessage('У этого урока нет теста');
                }
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки теста: ' + error.message);
        }
    }

    updateFiltersInfo(total) {
        const element = document.getElementById('lessonsFiltersInfo');
        if (!element) return;

        const search = document.getElementById('lessonsSearch').value;
        const courseId = document.getElementById('courseFilter').value;
        const mediaType = document.getElementById('mediaTypeFilter').value;

        let infoText = `Показано уроков: ${total}`;

        const activeFilters = [];
        if (search) activeFilters.push(`поиск: "${search}"`);
        if (courseId) {
            const courseSelect = document.getElementById('courseFilter');
            const selectedOption = courseSelect.options[courseSelect.selectedIndex];
            activeFilters.push(`курс: ${selectedOption.text}`);
        }
        if (mediaType) {
            const typeLabels = {
                'PHOTO': 'фото',
                'VIDEO': 'видео'
            };
            activeFilters.push(`тип: ${typeLabels[mediaType]}`);
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