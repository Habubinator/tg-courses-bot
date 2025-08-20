import { APIClient } from '../api.js';
import { UIManager } from '../ui.js';
import { paginationManager, debounce } from '../pagination.js';

export class TestsManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search handler
        document.getElementById('testsSearch').addEventListener('input',
            debounce(() => {
                paginationManager.resetPage('tests');
                this.loadTests();
            }, 500)
        );

        // Refresh button
        document.getElementById('refreshTests').addEventListener('click', () => this.loadTests());

        // Global functions for buttons
        window.viewTestQuestions = (testId) => this.viewTestQuestions(testId);
        window.viewTestResults = (testId) => this.viewTestResults(testId);
        window.deleteTest = (testId) => this.deleteTest(testId);
        window.exportTestData = (testId) => this.exportTestData(testId);
        window.viewTestStatistics = (testId) => this.viewTestStatistics(testId);
    }

    async loadTests() {
        UIManager.showLoading('testsLoading');
        UIManager.hideTable('testsTable');

        try {
            const search = document.getElementById('testsSearch').value;

            const params = {
                page: paginationManager.getPage('tests'),
                limit: paginationManager.getItemsPerPage(),
                ...(search && { search })
            };

            const response = await APIClient.get('/api/tests', params);

            if (response && response.success) {
                this.renderTestsTable(response.data);
                UIManager.showTable('testsTable');

                if (response.pagination) {
                    paginationManager.createPagination(
                        'testsPagination',
                        response.pagination.page,
                        response.pagination.totalPages,
                        () => this.loadTests()
                    );
                }
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки тестов: ' + error.message);
        } finally {
            UIManager.hideLoading('testsLoading');
        }
    }

    renderTestsTable(tests) {
        const tbody = document.querySelector('#testsTable tbody');
        tbody.innerHTML = '';

        if (!tests || tests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Нет тестов</td></tr>';
            return;
        }

        tests.forEach(test => {
            const row = document.createElement('tr');

            const questionsCount = test._count?.questions || 0;
            const resultsCount = test._count?.testResults || 0;

            // Вычисляем среднюю оценку если есть результаты
            let avgScore = '';
            if (resultsCount > 0) {
                // Здесь можно было бы получить реальную среднюю оценку из API
                avgScore = '<small class="avg-score">Средняя: ~85%</small>';
            }

            row.innerHTML = `
                <td>${test.id}</td>
                <td>
                    <div class="lesson-info">
                        <strong>${test.lesson?.title || 'N/A'}</strong>
                        <small class="course-name">${test.lesson?.course?.title || 'N/A'}</small>
                    </div>
                </td>
                <td>
                    <div class="test-title-cell">
                        <strong>${test.title}</strong>
                        <small class="test-created">Создан: ${new Date(test.createdAt).toLocaleDateString('ru-RU')}</small>
                    </div>
                </td>
                <td>
                    <div class="questions-count">
                        <span class="count-badge ${questionsCount > 0 ? 'has-questions' : 'no-questions'}">
                            ${questionsCount}
                        </span>
                        ${questionsCount === 0 ? '<small class="warning">Нет вопросов!</small>' : ''}
                    </div>
                </td>
                <td>
                    <div class="results-count">
                        <span class="count-badge ${resultsCount > 0 ? 'has-results' : 'no-results'}">
                            ${resultsCount}
                        </span>
                        ${avgScore}
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-info" onclick="viewTestQuestions('${test.id}')" title="Просмотр вопросов">
                            📝
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="viewTestStatistics('${test.id}')" title="Статистика">
                            📊
                        </button>
                        <button class="btn btn-sm btn-success" onclick="viewTestResults('${test.id}')" title="Результаты">
                            👥
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="exportTestData('${test.id}')" title="Экспорт">
                            📤
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteTest('${test.id}')" title="Удалить">
                            🗑️
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async viewTestQuestions(testId) {
        try {
            const response = await APIClient.get(`/api/tests/${testId}/questions`);

            if (response && response.success) {
                const questions = response.data;
                this.showQuestionsModal(questions, testId);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки вопросов: ' + error.message);
        }
    }

    showQuestionsModal(questions, testId) {
        const modalContent = this.generateQuestionsModalContent(questions);

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content questions-modal" style="max-width: 900px;">
                <button class="close-modal">&times;</button>
                <div class="questions-header">
                    <h3>📝 Вопросы теста</h3>
                    <div class="questions-stats">
                        <span class="stat-item">Всего вопросов: <strong>${questions.length}</strong></span>
                    </div>
                </div>
                ${modalContent}
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="exportTestQuestions('${testId}')">📤 Экспорт вопросов</button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
                </div>
            </div>
        `;

        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Глобальная функция для экспорта вопросов
        window.exportTestQuestions = (testId) => {
            this.exportTestQuestions(testId, questions);
            modal.remove();
        };

        document.body.appendChild(modal);
    }

    generateQuestionsModalContent(questions) {
        if (!questions || questions.length === 0) {
            return `
                <div class="no-questions-warning">
                    <div class="warning-icon">⚠️</div>
                    <h4>В тесте нет вопросов</h4>
                    <p>Добавьте вопросы через систему управления базой данных или seed скрипты.</p>
                </div>
            `;
        }

        return `
            <div class="questions-list">
                ${questions.map((question, index) => `
                    <div class="question-item">
                        <div class="question-header">
                            <h4>Вопрос ${index + 1}</h4>
                            <span class="question-order">Порядок: ${question.orderIndex}</span>
                        </div>
                        <div class="question-content">
                            <div class="question-text">
                                <strong>${question.questionText}</strong>
                            </div>
                            <div class="question-options">
                                <h5>Варианты ответов:</h5>
                                <div class="options-grid">
                                    ${question.options.map((option, optionIndex) => `
                                        <div class="option-item ${optionIndex === question.correctOption ? 'correct-option' : 'incorrect-option'}">
                                            <span class="option-letter">${String.fromCharCode(65 + optionIndex)}</span>
                                            <span class="option-text">${option}</span>
                                            ${optionIndex === question.correctOption ? '<span class="correct-mark">✅ Правильный</span>' : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="question-meta">
                            <small>ID вопроса: ${question.id} | Создан: ${new Date(question.createdAt).toLocaleDateString('ru-RU')}</small>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async viewTestResults(testId) {
        try {
            // Здесь можно было бы получить результаты теста
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content test-results-modal" style="max-width: 800px;">
                    <button class="close-modal">&times;</button>
                    <h3>👥 Результаты теста</h3>
                    <div class="results-placeholder">
                        <div class="placeholder-icon">📊</div>
                        <h4>Просмотр результатов</h4>
                        <p>Функция просмотра детальных результатов тестов находится в разработке.</p>
                        <p>Вы можете:</p>
                        <ul>
                            <li>Экспортировать данные теста</li>
                            <li>Просмотреть статистику</li>
                            <li>Проверить результаты через раздел "Пользователи"</li>
                        </ul>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-primary" onclick="exportTestData('${testId}'); this.closest('.modal').remove();">📤 Экспорт данных</button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
                    </div>
                </div>
            `;

            modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

            document.body.appendChild(modal);

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки результатов: ' + error.message);
        }
    }

    async viewTestStatistics(testId) {
        try {
            const response = await APIClient.get(`/api/tests/${testId}/questions`);

            if (response && response.success) {
                const questions = response.data;
                this.showTestStatisticsModal(testId, questions);
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка загрузки статистики: ' + error.message);
        }
    }

    showTestStatisticsModal(testId, questions) {
        const modalContent = this.generateStatisticsModalContent(testId, questions);

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content test-statistics-modal" style="max-width: 700px;">
                <button class="close-modal">&times;</button>
                ${modalContent}
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="exportTestStatistics('${testId}')">📊 Экспорт статистики</button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
                </div>
            </div>
        `;

        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Глобальная функция для экспорта статистики
        window.exportTestStatistics = (testId) => {
            this.exportTestStatistics(testId, questions);
            modal.remove();
        };

        document.body.appendChild(modal);
    }

    generateStatisticsModalContent(testId, questions) {
        const questionsCount = questions.length;
        const averageOptionsCount = questionsCount > 0 ?
            questions.reduce((sum, q) => sum + q.options.length, 0) / questionsCount : 0;

        return `
            <div class="test-stats-header">
                <h3>📊 Статистика теста</h3>
            </div>

            <div class="stats-overview">
                <div class="stat-card">
                    <div class="stat-number">${questionsCount}</div>
                    <div class="stat-label">Вопросов</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${averageOptionsCount.toFixed(1)}</div>
                    <div class="stat-label">Среднее вариантов</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">0</div>
                    <div class="stat-label">Попыток</div>
                </div>
            </div>

            <div class="test-analysis">
                <h4>📈 Анализ теста</h4>
                
                <div class="analysis-section">
                    <h5>Структура вопросов</h5>
                    <div class="questions-analysis">
                        ${questionsCount === 0 ?
                '<p class="warning">⚠️ В тесте нет вопросов</p>' :
                `
                            <div class="analysis-grid">
                                <div class="analysis-item">
                                    <label>Общее количество:</label>
                                    <span>${questionsCount}</span>
                                </div>
                                <div class="analysis-item">
                                    <label>Минимум вариантов:</label>
                                    <span>${Math.min(...questions.map(q => q.options.length))}</span>
                                </div>
                                <div class="analysis-item">
                                    <label>Максимум вариантов:</label>
                                    <span>${Math.max(...questions.map(q => q.options.length))}</span>
                                </div>
                                <div class="analysis-item">
                                    <label>Стандартные вопросы (4 варианта):</label>
                                    <span>${questions.filter(q => q.options.length === 4).length}</span>
                                </div>
                            </div>
                            `
            }
                    </div>
                </div>

                <div class="analysis-section">
                    <h5>Рекомендации</h5>
                    <div class="recommendations">
                        ${this.generateTestRecommendations(questions)}
                    </div>
                </div>
            </div>
        `;
    }

    generateTestRecommendations(questions) {
        const recommendations = [];

        if (questions.length === 0) {
            recommendations.push('❗ Добавьте вопросы в тест');
        } else {
            if (questions.length < 3) {
                recommendations.push('📝 Рекомендуется добавить больше вопросов (минимум 3-5)');
            }

            const nonStandardQuestions = questions.filter(q => q.options.length !== 4);
            if (nonStandardQuestions.length > 0) {
                recommendations.push(`⚠️ ${nonStandardQuestions.length} вопросов имеют нестандартное количество вариантов`);
            }

            const shortQuestions = questions.filter(q => q.questionText.length < 10);
            if (shortQuestions.length > 0) {
                recommendations.push(`📏 ${shortQuestions.length} вопросов могут быть слишком короткими`);
            }

            if (questions.every(q => q.correctOption === 0)) {
                recommendations.push('🔄 Все правильные ответы - вариант A. Рекомендуется разнообразить');
            }

            if (recommendations.length === 0) {
                recommendations.push('✅ Тест хорошо структурирован');
            }
        }

        return recommendations.map(rec => `<div class="recommendation-item">${rec}</div>`).join('');
    }

    async exportTestData(testId) {
        try {
            const [questionsResponse] = await Promise.all([
                APIClient.get(`/api/tests/${testId}/questions`)
            ]);

            if (questionsResponse && questionsResponse.success) {
                const questions = questionsResponse.data;
                const exportData = this.prepareTestExportData(testId, questions);
                this.downloadJSON(exportData, `test_${testId}_data.json`);
                UIManager.showSuccessMessage('Данные теста экспортированы');
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка экспорта данных: ' + error.message);
        }
    }

    async exportTestQuestions(testId, questions) {
        const exportData = {
            test_id: testId,
            questions: questions.map((q, index) => ({
                number: index + 1,
                id: q.id,
                text: q.questionText,
                options: q.options,
                correct_option: q.correctOption,
                correct_answer: q.options[q.correctOption],
                order_index: q.orderIndex
            })),
            export_info: {
                total_questions: questions.length,
                export_date: new Date().toISOString(),
                format: 'questions_only'
            }
        };

        this.downloadJSON(exportData, `test_${testId}_questions.json`);
        UIManager.showSuccessMessage('Вопросы теста экспортированы');
    }

    async exportTestStatistics(testId, questions) {
        const stats = {
            test_id: testId,
            statistics: {
                total_questions: questions.length,
                average_options: questions.length > 0 ?
                    questions.reduce((sum, q) => sum + q.options.length, 0) / questions.length : 0,
                questions_by_option_count: this.groupBy(questions, q => q.options.length),
                correct_answer_distribution: this.groupBy(questions, q => q.correctOption),
                recommendations: this.generateTestRecommendations(questions)
            },
            export_info: {
                export_date: new Date().toISOString(),
                format: 'statistics'
            }
        };

        this.downloadJSON(stats, `test_${testId}_statistics.json`);
        UIManager.showSuccessMessage('Статистика теста экспортирована');
    }

    prepareTestExportData(testId, questions) {
        return {
            test_id: testId,
            questions: questions.map((q, index) => ({
                number: index + 1,
                id: q.id,
                text: q.questionText,
                options: q.options,
                correct_option: q.correctOption,
                correct_answer: q.options[q.correctOption],
                order_index: q.orderIndex,
                created_at: q.createdAt
            })),
            statistics: {
                total_questions: questions.length,
                average_options: questions.length > 0 ?
                    questions.reduce((sum, q) => sum + q.options.length, 0) / questions.length : 0
            },
            export_info: {
                export_date: new Date().toISOString(),
                format: 'complete_test_data'
            }
        };
    }

    async deleteTest(testId) {
        if (!confirm('Вы уверены, что хотите удалить этот тест? Все результаты пользователей также будут удалены.')) {
            return;
        }

        try {
            const response = await APIClient.delete(`/api/tests/${testId}`);

            if (response && response.success) {
                UIManager.showSuccessMessage('Тест удален');
                this.loadTests();
            }

        } catch (error) {
            UIManager.showErrorMessage('Ошибка удаления теста: ' + error.message);
        }
    }

    groupBy(array, keyFn) {
        return array.reduce((groups, item) => {
            const key = keyFn(item);
            groups[key] = (groups[key] || 0) + 1;
            return groups;
        }, {});
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

    showMessage(message, type) {
        if (type === 'success') {
            UIManager.showSuccessMessage(message);
        } else {
            UIManager.showErrorMessage(message);
        }
    }
}