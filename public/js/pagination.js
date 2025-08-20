export class PaginationManager {
    constructor() {
        this.currentPages = {};
        this.itemsPerPage = 20;
    }

    createPagination(containerId, currentPage, totalPages, loadFunction) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (totalPages <= 1) return;

        const paginationWrapper = document.createElement('div');
        paginationWrapper.className = 'pagination-wrapper';

        // Main pagination controls
        const controls = document.createElement('div');
        controls.className = 'pagination-controls';
        controls.style.display = 'flex';
        controls.style.alignItems = 'center';
        controls.style.gap = '10px';
        controls.style.marginBottom = '10px';

        // Previous button
        if (currentPage > 1) {
            const prevBtn = this.createButton('‹ Назад', () => {
                this.setPage(containerId.replace('Pagination', ''), currentPage - 1);
                loadFunction();
            });
            controls.appendChild(prevBtn);
        }

        // Page info
        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
        pageInfo.style.margin = '0 10px';
        pageInfo.style.fontWeight = 'bold';
        pageInfo.style.fontSize = '14px';
        controls.appendChild(pageInfo);

        // Next button
        if (currentPage < totalPages) {
            const nextBtn = this.createButton('Вперед ›', () => {
                this.setPage(containerId.replace('Pagination', ''), currentPage + 1);
                loadFunction();
            });
            controls.appendChild(nextBtn);
        }

        // Go to page section
        const goToWrapper = document.createElement('div');
        goToWrapper.style.display = 'flex';
        goToWrapper.style.alignItems = 'center';
        goToWrapper.style.gap = '5px';
        goToWrapper.style.marginLeft = '20px';

        const goToLabel = document.createElement('label');
        goToLabel.textContent = 'Перейти:';
        goToLabel.style.fontSize = '14px';

        const goToInput = document.createElement('input');
        goToInput.type = 'number';
        goToInput.min = '1';
        goToInput.max = totalPages.toString();
        goToInput.value = currentPage.toString();
        goToInput.style.width = '60px';
        goToInput.style.padding = '4px 8px';
        goToInput.style.border = '1px solid #ddd';
        goToInput.style.borderRadius = '4px';
        goToInput.style.textAlign = 'center';

        const goToBtn = this.createButton('→', () => {
            const targetPage = parseInt(goToInput.value, 10);
            if (targetPage >= 1 && targetPage <= totalPages && targetPage !== currentPage) {
                this.setPage(containerId.replace('Pagination', ''), targetPage);
                loadFunction();
            }
        }, 'pagination-btn-sm');

        // Handle Enter key
        goToInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                goToBtn.click();
            }
        });

        // Input validation
        goToInput.addEventListener('input', () => {
            const value = parseInt(goToInput.value, 10);
            if (value < 1) goToInput.value = '1';
            if (value > totalPages) goToInput.value = totalPages.toString();
        });

        goToWrapper.appendChild(goToLabel);
        goToWrapper.appendChild(goToInput);
        goToWrapper.appendChild(goToBtn);
        controls.appendChild(goToWrapper);

        paginationWrapper.appendChild(controls);

        // Items per page section
        const perPageWrapper = document.createElement('div');
        perPageWrapper.style.display = 'flex';
        perPageWrapper.style.alignItems = 'center';
        perPageWrapper.style.gap = '10px';

        const perPageLabel = document.createElement('label');
        perPageLabel.textContent = 'Элементов на странице:';
        perPageLabel.style.fontSize = '14px';

        const perPageSelect = document.createElement('select');
        perPageSelect.style.padding = '4px 8px';
        perPageSelect.style.border = '1px solid #ddd';
        perPageSelect.style.borderRadius = '4px';
        perPageSelect.style.fontSize = '14px';

        [10, 20, 50, 100].forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            if (value === this.itemsPerPage) {
                option.selected = true;
            }
            perPageSelect.appendChild(option);
        });

        perPageSelect.addEventListener('change', () => {
            this.setItemsPerPage(parseInt(perPageSelect.value, 10));
            this.setPage(containerId.replace('Pagination', ''), 1);
            loadFunction();
        });

        perPageWrapper.appendChild(perPageLabel);
        perPageWrapper.appendChild(perPageSelect);
        paginationWrapper.appendChild(perPageWrapper);

        container.appendChild(paginationWrapper);
    }

    createButton(text, onClick, extraClass = '') {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = `pagination-btn ${extraClass}`;
        button.addEventListener('click', onClick);
        return button;
    }

    setPage(section, page) {
        this.currentPages[section] = page;
    }

    getPage(section) {
        return this.currentPages[section] || 1;
    }

    setItemsPerPage(count) {
        this.itemsPerPage = count;
    }

    getItemsPerPage() {
        return this.itemsPerPage;
    }

    resetPage(section) {
        this.currentPages[section] = 1;
    }

    // Quick pagination for simple cases
    createSimplePagination(containerId, currentPage, totalPages, loadFunction) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (totalPages <= 1) return;

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.gap = '5px';
        wrapper.style.padding = '10px';

        // Show page numbers with ellipsis for large page counts
        const maxVisible = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        // First page
        if (startPage > 1) {
            wrapper.appendChild(this.createPageButton(1, currentPage, loadFunction));
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '8px';
                wrapper.appendChild(ellipsis);
            }
        }

        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            wrapper.appendChild(this.createPageButton(i, currentPage, loadFunction));
        }

        // Last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '8px';
                wrapper.appendChild(ellipsis);
            }
            wrapper.appendChild(this.createPageButton(totalPages, currentPage, loadFunction));
        }

        container.appendChild(wrapper);
    }

    createPageButton(pageNum, currentPage, loadFunction) {
        const button = document.createElement('button');
        button.textContent = pageNum;
        button.className = `pagination-btn ${pageNum === currentPage ? 'active' : ''}`;

        if (pageNum !== currentPage) {
            button.addEventListener('click', () => {
                this.setPage('simple', pageNum);
                loadFunction();
            });
        }

        return button;
    }
}

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

export function formatDate(date, includeTime = false) {
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }

    return new Date(date).toLocaleDateString('ru-RU', options);
}

export function formatRelativeTime(date) {
    const now = new Date();
    const target = new Date(date);
    const diffMs = now - target;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'только что';
    if (diffMinutes < 60) return `${diffMinutes} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед назад`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} мес назад`;
    return `${Math.floor(diffDays / 365)} г назад`;
}

export function truncateText(text, maxLength = 50) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function validateUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

export function validateTelegramId(id) {
    return /^\d{5,}$/.test(id);
}

export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

export function copyToClipboard(text) {
    if (navigator.clipboard) {
        return navigator.clipboard.writeText(text);
    }

    // Fallback for older browsers
    return new Promise((resolve, reject) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
                resolve();
            } else {
                reject(new Error('Copy command failed'));
            }
        } catch (err) {
            document.body.removeChild(textArea);
            reject(err);
        }
    });
}

export function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function downloadCSV(data, filename, headers = null) {
    let csvContent = '';

    if (headers) {
        csvContent += headers.join(',') + '\n';
    }

    data.forEach(row => {
        const values = Array.isArray(row) ? row : Object.values(row);
        const escapedValues = values.map(val => {
            const stringVal = String(val || '');
            return stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('"')
                ? `"${stringVal.replace(/"/g, '""')}"`
                : stringVal;
        });
        csvContent += escapedValues.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];

            if (char === '"') {
                if (inQuotes && line[j + 1] === '"') {
                    current += '"';
                    j++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current);

        result.push(values);
    }

    return result;
}

export function groupBy(array, keyFn) {
    return array.reduce((groups, item) => {
        const key = keyFn(item);
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {});
}

export function sortBy(array, keyFn, direction = 'asc') {
    return [...array].sort((a, b) => {
        const aVal = keyFn(a);
        const bVal = keyFn(b);

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

export function unique(array, keyFn = null) {
    if (!keyFn) {
        return [...new Set(array)];
    }

    const seen = new Set();
    return array.filter(item => {
        const key = keyFn(item);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

export function chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

export const paginationManager = new PaginationManager();