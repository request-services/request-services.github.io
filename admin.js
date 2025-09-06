// Admin Panel JavaScript

// -----------------------------
// EmailJS (admin) configuration
// -----------------------------
const ADMIN_EMAILJS_CONFIG = {
    serviceId: 'service_64bmwtd',          // <-- your EmailJS service ID
    statusTemplateId: 'template_imwy85m', // <-- create this template in EmailJS
    publicKey: 'HdQVpdT33jKEojhyW'         // <-- your EmailJS public key
};

// Init EmailJS for admin
(function () {
    try {
        if (typeof emailjs !== 'undefined') {
            emailjs.init({ publicKey: ADMIN_EMAILJS_CONFIG.publicKey });
            console.log('EmailJS (admin) initialized');
        } else {
            console.warn('EmailJS not found on page. Status emails will be skipped.');
        }
    } catch (e) {
        console.error('Failed to init EmailJS (admin):', e);
    }
})();

let currentUser = null;
let allRequests = [];
let filteredRequests = [];
let currentPage = 1;
const requestsPerPage = 10;

// DOM Elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const requestsTableBody = document.getElementById('requestsTableBody');
const statusFilter = document.getElementById('statusFilter');
const languageFilter = document.getElementById('languageFilter');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');
const requestModal = document.getElementById('requestModal');
const closeModal = document.getElementById('closeModal');
const modalBody = document.getElementById('modalBody');
const statusSelect = document.getElementById('statusSelect');
const updateStatusBtn = document.getElementById('updateStatusBtn');
const deleteRequestBtn = document.getElementById('deleteRequestBtn');

// Statistics elements
const totalRequestsEl = document.getElementById('totalRequests');
const pendingRequestsEl = document.getElementById('pendingRequests');
const completedRequestsEl = document.getElementById('completedRequests');

// Pagination elements
const paginationInfo = document.getElementById('paginationInfo');
const pageInfo = document.getElementById('pageInfo');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');

let selectedRequestId = null;

// Authentication Functions
function initAuth() {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            showDashboard();
            loadRequests();
        } else {
            currentUser = null;
            showLogin();
        }
    });
}

async function login(email, password) {
    try {
        setLoginLoading(true);
        await firebase.auth().signInWithEmailAndPassword(email, password);
        showToast("Successfully logged in!", "success");
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = "Login failed. Please check your credentials.";

        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = "No admin account found with this email.";
                break;
            case 'auth/wrong-password':
                errorMessage = "Incorrect password.";
                break;
            case 'auth/invalid-email':
                errorMessage = "Invalid email address.";
                break;
            case 'auth/too-many-requests':
                errorMessage = "Too many failed attempts. Please try again later.";
                break;
        }

        showToast(errorMessage, "error");
    } finally {
        setLoginLoading(false);
    }
}

function logout() {
    firebase.auth().signOut();
}

function setLoginLoading(isLoading) {
    const submitBtn = loginForm.querySelector('.btn-login');
    const btnText = submitBtn.querySelector('.btn-text');
    const loadingSpinner = submitBtn.querySelector('.loading-spinner');

    if (isLoading) {
        btnText.style.display = 'none';
        loadingSpinner.style.display = 'flex';
        submitBtn.disabled = true;
    } else {
        btnText.style.display = 'inline';
        loadingSpinner.style.display = 'none';
        submitBtn.disabled = false;
    }
}

function showLogin() {
    loginSection.style.display = 'flex';
    dashboardSection.style.display = 'none';
    logoutBtn.style.display = 'none';
}

function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    logoutBtn.style.display = 'flex';
}

// Request Management Functions
async function loadRequests() {
    try {
        showTableLoading(true);

        const snapshot = await firebase.firestore()
            .collection('coding-requests')
            .orderBy('timestamp', 'desc')
            .get();

        allRequests = snapshot.docs.map(doc => ({
            id: doc.id,                                    // Firestore doc ID
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate
                ? doc.data().timestamp.toDate()
                : (doc.data().timestamp || new Date())     // be forgiving if timestamp is missing
        }));

        updateStatistics();
        applyFilters();

    } catch (error) {
        console.error('Error loading requests:', error);
        showToast("Error loading requests. Please try again.", "error");
        showTableLoading(false);
    }
}

function updateStatistics() {
    const total = allRequests.length;
    const pending = allRequests.filter(req => req.status === 'pending').length;
    const completed = allRequests.filter(req => req.status === 'completed').length;

    totalRequestsEl.textContent = total;
    pendingRequestsEl.textContent = pending;
    completedRequestsEl.textContent = completed;
}

function applyFilters() {
    let filtered = [...allRequests];

    // Status filter
    const statusFilterValue = statusFilter.value;
    if (statusFilterValue !== 'all') {
        filtered = filtered.filter(req => req.status === statusFilterValue);
    }

    // Language filter
    const languageFilterValue = languageFilter.value;
    if (languageFilterValue !== 'all') {
        filtered = filtered.filter(req => req.language === languageFilterValue);
    }

    // Search filter
    const searchQuery = searchInput.value.toLowerCase().trim();
    if (searchQuery) {
        filtered = filtered.filter(req =>
            (req.name || '').toLowerCase().includes(searchQuery) ||
            (req.email || '').toLowerCase().includes(searchQuery) ||
            (req.description || '').toLowerCase().includes(searchQuery) ||
            (req.projectType || '').toLowerCase().includes(searchQuery)
        );
    }

    filteredRequests = filtered;
    currentPage = 1;
    updateTable();
    updatePagination();
}

function updateTable() {
    const startIndex = (currentPage - 1) * requestsPerPage;
    const endIndex = startIndex + requestsPerPage;
    const pageRequests = filteredRequests.slice(startIndex, endIndex);

    if (pageRequests.length === 0 && filteredRequests.length === 0) {
        requestsTableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="8" class="loading-cell">
                    <div style="text-align: center; padding: 2rem;">
                        <i class="fas fa-inbox" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                        <br>
                        No requests found
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    requestsTableBody.innerHTML = pageRequests.map(request => `
        <tr onclick="viewRequest('${request.id}')" data-request-id="${request.id}">
            <td>${formatDate(request.timestamp)}</td>
            <td>${escapeHtml(request.name || '')}</td>
            <td>${escapeHtml(request.email || request.reply_to || '')}</td>
            <td><span class="language-tag ${request.language}">${formatLanguage(request.language)}</span></td>
            <td>${formatProjectType(request.projectType)}</td>
            <td>${request.budget ? formatBudget(request.budget) : '<span style="color: var(--text-muted);">Not specified</span>'}</td>
            <td><span class="status-badge ${request.status}">${formatStatus(request.status)}</span></td>
            <td onclick="event.stopPropagation();" class="action-buttons">
                <button class="action-btn view" onclick="viewRequest('${request.id}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn delete" onclick="confirmDeleteRequest('${request.id}')" title="Delete Request">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    showTableLoading(false);
}

function updatePagination() {
    const totalPages = Math.ceil(filteredRequests.length / requestsPerPage) || 1;
    const startIndex = filteredRequests.length ? (currentPage - 1) * requestsPerPage + 1 : 0;
    const endIndex = Math.min(currentPage * requestsPerPage, filteredRequests.length);

    paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${filteredRequests.length} requests`;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

function showTableLoading(show) {
    if (show) {
        requestsTableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="8" class="loading-cell">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    Loading requests...
                </td>
            </tr>
        `;
    }
}

// Request Detail Functions
function viewRequest(requestId) {
    const request = allRequests.find(req => req.id === requestId);
    if (!request) return;

    selectedRequestId = requestId;

    modalBody.innerHTML = `
        <div class="request-detail">
            <div class="detail-label">
                <i class="fas fa-calendar"></i>
                Date Submitted
            </div>
            <div class="detail-value">${formatDate(request.timestamp)}</div>
        </div>

        <div class="request-detail">
            <div class="detail-label">
                <i class="fas fa-user"></i>
                Name
            </div>
            <div class="detail-value">${escapeHtml(request.name || '')}</div>
        </div>

        <div class="request-detail">
            <div class="detail-label">
                <i class="fas fa-envelope"></i>
                Email
            </div>
            <div class="detail-value">
                <a href="mailto:${escapeHtml(request.email || request.reply_to || '')}" style="color: var(--accent-primary);">
                    ${escapeHtml(request.email || request.reply_to || '')}
                </a>
            </div>
        </div>

        <div class="request-detail">
            <div class="detail-label">
                <i class="fas fa-code"></i>
                Programming Language
            </div>
            <div class="detail-value">
                <span class="language-tag ${request.language}">${formatLanguage(request.language)}</span>
            </div>
        </div>

        <div class="request-detail">
            <div class="detail-label">
                <i class="fas fa-project-diagram"></i>
                Project Type
            </div>
            <div class="detail-value">${formatProjectType(request.projectType)}</div>
        </div>

        <div class="request-detail">
            <div class="detail-label">
                <i class="fas fa-dollar-sign"></i>
                Budget Range
            </div>
            <div class="detail-value">${request.budget ? formatBudget(request.budget) : '<span style="color: var(--text-muted);">Not specified</span>'}</div>
        </div>

        <div class="request-detail">
            <div class="detail-label">
                <i class="fas fa-file-alt"></i>
                Project Description
            </div>
            <div class="detail-value description">${escapeHtml(request.description || '')}</div>
        </div>

        <div class="request-detail">
            <div class="detail-label">
                <i class="fas fa-info-circle"></i>
                Current Status
            </div>
            <div class="detail-value">
                <span class="status-badge ${request.status}">${formatStatus(request.status)}</span>
            </div>
        </div>
    `;

    statusSelect.value = request.status || 'pending';
    requestModal.classList.add('show');
}

async function updateRequestStatus(docId, newStatus, optionalMessage = "") {
    try {
        const db = firebase.firestore();

        // Update Firestore doc
        await db.collection("coding-requests").doc(docId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update local cache so UI feels instant
        const local = allRequests.find(r => r.id === docId);
        if (local) local.status = newStatus;

        showToast("Status updated!", "success");

        // Fetch latest doc to email the right person
        const snap = await db.collection("coding-requests").doc(docId).get();
        const req = snap.data() || {};

        // Prepare email (only if EmailJS is available and we have a recipient)
        const recipient = (req.email || req.reply_to || "").trim();
        if (typeof emailjs !== 'undefined' &&
            ADMIN_EMAILJS_CONFIG.serviceId &&
            ADMIN_EMAILJS_CONFIG.statusTemplateId &&
            ADMIN_EMAILJS_CONFIG.publicKey &&
            recipient) {

            const templateParams = {
                // Match your EmailJS template fields
                to_name: req.name || "there",
                reply_to: recipient,                 // Your template's "To Email" uses {{reply_to}}
                request_id: req.request_id || docId, // show either custom request code or Firestore ID
                new_status: formatStatus(newStatus),
                admin_message: optionalMessage || '',
                project_type: formatProjectType(req.projectType || ''),
                language: formatLanguage(req.language || ''),
                budget: req.budget ? formatBudget(req.budget) : 'Not specified',
                current_date: new Date().toLocaleDateString()
            };

            try {
                await emailjs.send(
                    ADMIN_EMAILJS_CONFIG.serviceId,
                    ADMIN_EMAILJS_CONFIG.statusTemplateId,
                    templateParams,
                    { publicKey: ADMIN_EMAILJS_CONFIG.publicKey }
                );
                console.log('Status update email sent:', templateParams);
            } catch (emailErr) {
                console.error('Failed to send status email:', emailErr);
                // Don't block the UI if email fails
            }
        } else {
            if (!recipient) console.warn('No recipient email on request; skipping status email.');
        }

        // Refresh visible table & close modal
        applyFilters();
        closeRequestModal();

    } catch (error) {
        console.error("Error updating request status:", error);
        showToast("Failed to update status", "error");
    }
}

async function deleteRequest(requestId) {
    try {
        await firebase.firestore()
            .collection('coding-requests')
            .doc(requestId)
            .delete();

        // Remove from local data
        allRequests = allRequests.filter(req => req.id !== requestId);

        updateStatistics();
        applyFilters();

        showToast("Request deleted successfully", "success");
        closeRequestModal();

    } catch (error) {
        console.error('Error deleting request:', error);
        showToast("Error deleting request. Please try again.", "error");
    }
}

function confirmDeleteRequest(requestId) {
    if (confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
        deleteRequest(requestId);
    }
}

function closeRequestModal() {
    requestModal.classList.remove('show');
    selectedRequestId = null;
}

// Export Functions
function exportToCSV() {
    if (filteredRequests.length === 0) {
        showToast("No data to export", "error");
        return;
    }

    const headers = ['Date', 'Name', 'Email', 'Language', 'Project Type', 'Budget', 'Status', 'Description'];
    const csvContent = [
        headers.join(','),
        ...filteredRequests.map(request => [
            formatDate(request.timestamp),
            `"${(request.name || '').replace(/"/g, '""')}"`,
            (request.email || request.reply_to || ''),
            formatLanguage(request.language || ''),
            formatProjectType(request.projectType || ''),
            request.budget ? formatBudget(request.budget) : 'Not specified',
            formatStatus(request.status || 'pending'),
            `"${(request.description || '').replace(/"/g, '""')}"`
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coding-requests-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showToast("Data exported successfully", "success");
}

// Utility Functions
function formatDate(date) {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatLanguage(language) {
    const languages = {
        'csharp': 'C#',
        'cpp': 'C++',
        'both': 'C# & C++'
    };
    return languages[language] || (language || '');
}

function formatProjectType(type) {
    const types = {
        'desktop': 'Desktop Application',
        'console': 'Console Application',
        'web': 'Web API/Service',
        'game': 'Game Development',
        'system': 'System Programming',
        'algorithm': 'Algorithm Implementation',
        'optimization': 'Code Optimization',
        'other': 'Other'
    };
    return types[type] || (type || '');
}

function formatBudget(budget) {
    const budgets = {
        'under-500': 'Under $500',
        '500-1000': '$500 - $1,000',
        '1000-2500': '$1,000 - $2,500',
        '2500-5000': '$2,500 - $5,000',
        '5000-plus': '$5,000+',
        'discuss': "Let's discuss"
    };
    return budgets[budget] || (budget || '');
}

function formatStatus(status) {
    const statuses = {
        'pending': 'Pending',
        'in-progress': 'In Progress',
        'completed': 'Completed'
    };
    return statuses[status] || (status || '');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// FIXED: no recursion — call the portal toast if available; otherwise fallback
function showToast(message, type = "success") {
    if (window.CodingRequestPortal && typeof window.CodingRequestPortal.showToast === 'function') {
        window.CodingRequestPortal.showToast(message, type);
    } else if (window._showToast && typeof window._showToast === 'function') {
        window._showToast(message, type);
    } else {
        alert(message);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin panel initialized');

    // Initialize Firebase auth
    initAuth();

    // Login form
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            login(email, password);
        });
    }

    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Filters and search
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }

    if (languageFilter) {
        languageFilter.addEventListener('change', applyFilters);
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }

    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadRequests);
    }

    // Export button
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }

    // Modal close
    if (closeModal) {
        closeModal.addEventListener('click', closeRequestModal);
    }

    // Modal background close
    if (requestModal) {
        requestModal.addEventListener('click', function(e) {
            if (e.target === requestModal) {
                closeRequestModal();
            }
        });
    }

    // Update status button (supports optional message textarea with id="statusNote")
    if (updateStatusBtn) {
        updateStatusBtn.addEventListener('click', function() {
            if (selectedRequestId && statusSelect.value) {
                const noteInput = document.getElementById('statusNote');
                const note = noteInput ? noteInput.value.trim() : '';
                updateRequestStatus(selectedRequestId, statusSelect.value, note);
            }
        });
    }

    // Delete request button
    if (deleteRequestBtn) {
        deleteRequestBtn.addEventListener('click', function() {
            if (selectedRequestId) {
                confirmDeleteRequest(selectedRequestId);
            }
        });
    }

    // Pagination
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                updateTable();
                updatePagination();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            const totalPages = Math.ceil(filteredRequests.length / requestsPerPage) || 1;
            if (currentPage < totalPages) {
                currentPage++;
                updateTable();
                updatePagination();
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && requestModal.classList.contains('show')) {
            closeRequestModal();
        }
    });
});

// Debounce function for search
function debounce(func, wait) {
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

// Auto-refresh every 30 seconds
setInterval(() => {
    if (currentUser && dashboardSection.style.display !== 'none') {
        loadRequests();
    }
}, 30000);
