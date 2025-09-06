// Firebase Configuration
const firebaseConfig = {
    // Replace with your Firebase config
    apiKey: "AIzaSyDaKqeEVPALHErdrY8HtrOrU9cv4R0OLwg",
    authDomain: "fwewfwe-4b04c.firebaseapp.com",
    projectId: "fwewfwe-4b04c",
    storageBucket: "fwewfwe-4b04c.firebasestorage.app",
    messagingSenderId: "219753969044",
    appId: "1:219753969044:web:4f14a77dfd50088e2c4b81"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// EmailJS Configuration
const EMAILJS_CONFIG = {
    serviceId: 'service_64bmwtd', // Replace with your EmailJS service ID
    templateId: 'template_iunzxdz', // Replace with your EmailJS template ID
    publicKey: 'HdQVpdT33jKEojhyW' // Replace with your EmailJS public key
};

// Initialize EmailJS
(function(){
    emailjs.init({
        publicKey: EMAILJS_CONFIG.publicKey
    });
})();

// DOM Elements
const requestForm = document.getElementById('requestForm');
const submitBtn = document.getElementById('submitBtn');
const toast = document.getElementById('toast');

// Utility Functions
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

function showToast(message = "Request submitted successfully!", type = "success") {
    const toastIcon = toast.querySelector('.toast-icon i');
    const toastTitle = toast.querySelector('.toast-message h4');
    const toastText = toast.querySelector('.toast-message p');

    // Update toast content based on type
    if (type === "success") {
        toastIcon.className = "fas fa-check-circle";
        toastTitle.textContent = "Success!";
        toastText.textContent = message;
    } else if (type === "error") {
        toastIcon.className = "fas fa-exclamation-circle";
        toastTitle.textContent = "Error!";
        toastText.textContent = message;
    }

    // Show toast
    toast.classList.add('show');

    // Hide toast after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

function validateForm(formData) {
    const errors = [];

    if (!formData.language) {
        errors.push("Please select a programming language");
    }

    if (!formData.projectType) {
        errors.push("Please select a project type");
    }

    if (!formData.email || !isValidEmail(formData.email)) {
        errors.push("Please enter a valid email address");
    }

    if (!formData.name || formData.name.trim().length < 2) {
        errors.push("Please enter your full name");
    }

    if (!formData.description || formData.description.trim().length < 10) {
        errors.push("Please provide a detailed project description (minimum 10 characters)");
    }

    return errors;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function setLoadingState(isLoading) {
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

// Firebase Functions
async function saveRequestToFirebase(requestData) {
    try {
        const docRef = await db.collection('coding-requests').add({
            ...requestData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
            id: Date.now().toString()
        });

        console.log('Request saved with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        throw error;
    }
}

// EmailJS Functions
async function sendAutoReplyEmail(requestData) {
    try {
        const templateParams = {
            to_name: requestData.name,
            to_email: requestData.email,
            language: requestData.language === 'csharp' ? 'C#' :
                     requestData.language === 'cpp' ? 'C++' :
                     requestData.language === 'both' ? 'C# & C++' : requestData.language,
            project_type: requestData.projectType,
            description: requestData.description,
            budget: requestData.budget || 'Not specified',
            request_id: `REQ-${Date.now()}`,
            current_date: new Date().toLocaleDateString()
        };

        const response = await emailjs.send(
            EMAILJS_CONFIG.serviceId,
            EMAILJS_CONFIG.templateId,
            templateParams,
            {
                publicKey: EMAILJS_CONFIG.publicKey
            }
        );

        console.log('Auto-reply email sent:', response);
        return response;
    } catch (error) {
        console.error('Error sending auto-reply email:', error);
        throw error;
    }
}

// Form Submission Handler
async function handleFormSubmission(event) {
    event.preventDefault();

    // Get form data
    const formData = new FormData(requestForm);
    const requestData = {
        language: formData.get('language'),
        projectType: formData.get('projectType'),
        email: formData.get('email'),
        name: formData.get('name'),
        description: formData.get('description'),
        budget: formData.get('budget')
    };

    // Validate form
    const validationErrors = validateForm(requestData);
    if (validationErrors.length > 0) {
        showToast(validationErrors[0], "error");
        return;
    }

    // Set loading state
    setLoadingState(true);

    try {
        // Save to Firebase
        const requestId = await saveRequestToFirebase(requestData);

        // Send auto-reply email
        await sendAutoReplyEmail(requestData);

        // Show success message
        showToast("We've received your coding request and sent you a confirmation email!", "success");

        // Reset form
        requestForm.reset();

        // Analytics (optional)
        if (typeof gtag !== 'undefined') {
            gtag('event', 'form_submit', {
                event_category: 'engagement',
                event_label: 'coding_request',
                value: 1
            });
        }

    } catch (error) {
        console.error('Error submitting request:', error);
        showToast("Sorry, there was an error submitting your request. Please try again.", "error");
    } finally {
        setLoadingState(false);
    }
}

// Smooth Scrolling for Navigation
function initSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            scrollToSection(targetId);
        });
    });
}

// Navbar Scroll Effect
function initNavbarScrollEffect() {
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(10, 10, 10, 0.98)';
            navbar.style.backdropFilter = 'blur(20px)';
        } else {
            navbar.style.background = 'rgba(10, 10, 10, 0.95)';
            navbar.style.backdropFilter = 'blur(20px)';
        }
    });
}

// Intersection Observer for Animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe service cards
    const serviceCards = document.querySelectorAll('.service-card');
    serviceCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // Observe info cards
    const infoCards = document.querySelectorAll('.info-card');
    infoCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
}

// Particle Background Effect (Optional)
function createParticleBackground() {
    const heroSection = document.querySelector('.hero');
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: absolute;
            width: 2px;
            height: 2px;
            background: var(--accent-primary);
            border-radius: 50%;
            opacity: 0.3;
            pointer-events: none;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: particleFloat ${5 + Math.random() * 10}s ease-in-out infinite;
            animation-delay: ${Math.random() * 5}s;
        `;

        heroSection.appendChild(particle);
    }

    // Add particle animation CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes particleFloat {
            0%, 100% {
                transform: translateY(0px) translateX(0px);
                opacity: 0.3;
            }
            50% {
                transform: translateY(-100px) translateX(50px);
                opacity: 0.1;
            }
        }
    `;
    document.head.appendChild(style);
}

// Form Field Enhancements
function initFormEnhancements() {
    const formInputs = document.querySelectorAll('.form-input, .form-select, .form-textarea');

    formInputs.forEach(input => {
        // Add focus effects
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });

        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
            if (this.value) {
                this.parentElement.classList.add('has-value');
            } else {
                this.parentElement.classList.remove('has-value');
            }
        });

        // Add real-time validation
        input.addEventListener('input', function() {
            this.classList.remove('error');
            if (this.type === 'email' && this.value && !isValidEmail(this.value)) {
                this.classList.add('error');
            }
        });
    });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Coding Request Portal initialized');

    // Initialize all functionality
    initSmoothScrolling();
    initNavbarScrollEffect();
    initScrollAnimations();
    initFormEnhancements();
    createParticleBackground();

    // Bind form submission
    if (requestForm) {
        requestForm.addEventListener('submit', handleFormSubmission);
    }

    // Make scrollToSection globally available
    window.scrollToSection = scrollToSection;

    // Add some loading animation delays
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
});

// Export functions for admin panel
window.CodingRequestPortal = {
    db,
    auth,
    scrollToSection,
    showToast
};
