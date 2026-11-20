/**
 * CCISched — Homepage Scripts
 */

/* ── Navbar scroll effect ── */
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

/* ── Smooth scroll for navigation links ── */
document.querySelectorAll('.navbar__links a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = link.getAttribute('href');
    const targetSection = document.querySelector(targetId);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ── Animate feature cards on scroll ── */
const featureCards = document.querySelectorAll('.feature-card');

const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      cardObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

featureCards.forEach((card, i) => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(24px)';
  card.style.transition = `opacity 0.5s ease ${i * 0.08}s, transform 0.5s ease ${i * 0.08}s, box-shadow 0.3s, border-color 0.3s`;
  cardObserver.observe(card);
});

/* ── Animate step items on scroll ── */
const stepItems = document.querySelectorAll('.hiw__step');

const stepObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateX(0)';
      stepObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });

stepItems.forEach((step, i) => {
  step.style.opacity = '0';
  step.style.transform = 'translateX(-20px)';
  step.style.transition = `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s, background 0.3s, box-shadow 0.3s`;
  stepObserver.observe(step);
});

/* ── Animate role cards ── */
const roleCards = document.querySelectorAll('.role-card');

const roleObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      roleObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

roleCards.forEach((card, i) => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(32px)';
  card.style.transition = `opacity 0.6s ease ${i * 0.15}s, transform 0.6s ease ${i * 0.15}s`;
  roleObserver.observe(card);
});

/* ── Typewriter tagline ── */
(function () {
  const wordEl = document.getElementById('heroTypingWord');
  if (!wordEl) return;

  const PHRASES = [
    'manual scheduling.',
    'spreadsheet conflicts.',
    'double-booked rooms.',
    'missed assignments.',
  ];

  let phraseIdx = 0;
  let charIdx   = 0;
  let deleting  = false;

  function tick() {
    const current = PHRASES[phraseIdx];

    if (!deleting) {
      // Type forward
      charIdx++;
      wordEl.textContent = current.slice(0, charIdx);
      if (charIdx === current.length) {
        // Pause at full word then start deleting
        setTimeout(() => { deleting = true; tick(); }, 1800);
        return;
      }
      setTimeout(tick, 68);
    } else {
      // Delete backward
      charIdx--;
      wordEl.textContent = current.slice(0, charIdx);
      if (charIdx === 0) {
        deleting  = false;
        phraseIdx = (phraseIdx + 1) % PHRASES.length;
        setTimeout(tick, 400);
        return;
      }
      setTimeout(tick, 38);
    }
  }

  // Start after a short delay so the page settles
  setTimeout(tick, 800);
})();
