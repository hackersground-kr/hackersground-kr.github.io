// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenu = document.getElementById('mobile-menu');
    const navMenu = document.querySelector('.nav-menu');

    mobileMenu.addEventListener('click', function() {
        mobileMenu.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    // Calendar functionality
    initCalendar();

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add scroll effect to navbar
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 100) {
            navbar.style.background = 'rgba(0, 0, 0, 0.98)';
        } else {
            navbar.style.background = 'rgba(0, 0, 0, 0.95)';
        }
    });
});

// Calendar functionality
function initCalendar() {
    const currentMonthElement = document.getElementById('currentMonth');
    const calendarDaysElement = document.getElementById('calendarDays');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');

    let currentDate = new Date();

    // Sample events data (더미 데이터)
    const events = {
        '2025-09-14': [{ title: 'Docker 워크샵', type: 'handson', label: '핸즈온' }],
        '2025-09-21': [{ title: '성장 스토리 세미나', type: 'seminar', label: '세미나' }],
        '2025-10-05': [{ title: '코드 리뷰 파티', type: 'networking', label: '네트워킹' }],
        '2025-10-19': [{ title: 'ChatGPT 워크샵', type: 'handson', label: '핸즈온' }]
    };

    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Update month display
        const monthNames = [
            '1월', '2월', '3월', '4월', '5월', '6월',
            '7월', '8월', '9월', '10월', '11월', '12월'
        ];
        currentMonthElement.textContent = `${year}년 ${monthNames[month]}`;

        // Clear calendar days
        calendarDaysElement.innerHTML = '';

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            calendarDaysElement.appendChild(emptyDay);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';

            // Create day number element
            const dayNumber = document.createElement('div');
            dayNumber.className = 'calendar-day-number';
            dayNumber.textContent = day;
            dayElement.appendChild(dayNumber);

            // Check if this day has events
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (events[dateString]) {
                dayElement.classList.add('has-event');

                // Add event labels
                const eventContainer = document.createElement('div');
                eventContainer.className = 'calendar-event-container';

                events[dateString].forEach(event => {
                    const eventLabel = document.createElement('div');
                    eventLabel.className = `calendar-event-label event-${event.type}`;
                    eventLabel.textContent = event.label;
                    eventContainer.appendChild(eventLabel);
                });

                dayElement.appendChild(eventContainer);

                // Add click event to show event details
                dayElement.addEventListener('click', function() {
                    showEventPopup(dateString, events[dateString]);
                });
            }

            calendarDaysElement.appendChild(dayElement);
        }
    }

    function showEventPopup(date, dayEvents) {
        const formattedDate = new Date(date).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let eventList = dayEvents.map(event => {
            const typeEmojis = {
                'handson': '🛠️',
                'seminar': '📚',
                'networking': '🤝',
                'hackathon': '🏆'
            };
            return `${typeEmojis[event.type] || '📅'} ${event.title}`;
        }).join('\n');

        alert(`📅 ${formattedDate}\n\n${eventList}\n\n자세한 내용은 이벤트 섹션을 확인해주세요!`);
    }

    // Event listeners for month navigation
    prevMonthBtn.addEventListener('click', function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    // Initial render
    renderCalendar();
}

// Animation on scroll
function animateOnScroll() {
    const animateElements = document.querySelectorAll('.event-card, .about-content');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Initialize animations when DOM is loaded
document.addEventListener('DOMContentLoaded', animateOnScroll);

// Add event listeners for event buttons (더미 기능)
document.addEventListener('DOMContentLoaded', function() {
    const eventButtons = document.querySelectorAll('.event-button');

    eventButtons.forEach(button => {
        // 이벤트 상세 페이지가 아직 없는 경우를 위한 더미 처리
        button.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && !href.startsWith('#')) {
                // 실제 페이지가 있는 경우는 정상 처리
                return;
            }

            e.preventDefault();
            alert('🚧 준비중입니다!\n\n실제 서비스에서는 이벤트 상세 페이지로 이동하거나 신청 폼이 열립니다.');
        });
    });
});

// Parallax effect for floating characters
window.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
    const characters = document.querySelectorAll('.floating-character');

    characters.forEach((char, index) => {
        const speed = (index + 1) * 0.5;
        char.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// Add typing effect to hero title (optional enhancement)
function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.innerHTML = '';

    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// Enhanced hover effects for event cards
document.addEventListener('DOMContentLoaded', function() {
    const eventCards = document.querySelectorAll('.event-card');

    eventCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-15px) scale(1.02)';
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
});