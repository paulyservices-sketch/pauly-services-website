// ===== NAV: scroll shadow =====
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ===== HAMBURGER =====
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
mobileMenu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// ===== FAQ ACCORDION =====
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

// ===== ANIMATED COUNTERS =====
function animateCounter(el, target, duration = 1500) {
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.dataset.target, 10);
    if (!isNaN(target)) animateCounter(el, target);
    counterObserver.unobserve(el);
  });
}, { threshold: 0.5 });

document.querySelectorAll('.count[data-target]').forEach(el => counterObserver.observe(el));

// ===== FADE-IN ON SCROLL =====
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.card, .service-cat, .stat-box, .faq-item, .area-card, .sidebar-card').forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = `opacity 0.55s ease ${i * 0.05}s, transform 0.55s ease ${i * 0.05}s`;
  el.classList.add('fade-target');
  fadeObserver.observe(el);
});

document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = '.fade-target.visible { opacity: 1 !important; transform: none !important; }';
  document.head.appendChild(style);
});

// ===== BOOKING FORM =====
const form = document.getElementById('booking-form');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.getElementById('btn-text');
const btnLoading = document.getElementById('btn-loading');
const successBox = document.getElementById('booking-success');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const worryFreeEl = form.querySelector('[name="worry_free"]');
  const worryFree = worryFreeEl && worryFreeEl.checked ? 'Yes (+$47)' : 'No';

  const name    = form.name.value.trim();
  const phone   = form.phone.value.trim();
  const address = form.address.value.trim();
  const service = form.service.value;
  const urgency = form.urgency.value;

  if (!name || !phone || !address || !service || !urgency) {
    alert('Please fill out all required fields.');
    return;
  }

  btnText.style.display = 'none';
  btnLoading.style.display = 'inline';
  submitBtn.disabled = true;

  const payload = {
    access_key:  document.getElementById('w3f-key').value,
    subject:     `New Booking — ${name} — ${service.split('—')[0].trim()}`,
    from_name:   'Pauly Services Website',
    name,
    phone,
    email:       form.email.value.trim() || '(not provided)',
    address,
    service,
    urgency,
    worry_free:  worryFree,
    notes:       form.notes.value.trim() || '(none)',
    submitted_at: new Date().toLocaleString('en-US', { timeZone: 'America/Detroit' }),
  };

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'submit failed');
  } catch (err) {
    console.error('Web3Forms error:', err);
    localStorage.setItem('pauly_booking_' + Date.now(), JSON.stringify(payload));
  }

  // Also send to the Pauly Services backend to create a ticket + website lead
  try {
    await fetch('http://34.46.22.83:5003/api/website-booking', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:       payload.name,
        phone:      payload.phone,
        address:    payload.address,
        email:      payload.email,
        service:    payload.service,
        urgency:    payload.urgency,
        worry_free: payload.worry_free,
        notes:      payload.notes,
        source:     'website_mi',
      }),
    });
  } catch (err) {
    console.error('Backend booking error:', err);
  }

  form.style.display = 'none';
  successBox.style.display = 'block';
  successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ===== TRIP CHARGE HINT =====
const urgencySelect = document.getElementById('urgency');
const tripHint = document.getElementById('trip-charge-hint');
if (urgencySelect && tripHint) {
  urgencySelect.addEventListener('change', () => {
    const val = urgencySelect.value;
    tripHint.className = 'trip-hint';
    if (val === 'Emergency — ASAP') {
      tripHint.textContent = '🚨 Emergency / after-hours trip charge: $397 — collected upfront before dispatch.';
      tripHint.classList.add('hint-emergency');
      tripHint.style.display = 'block';
    } else if (val === 'Same Day') {
      tripHint.textContent = '⚡ Regular hours trip charge: \$77 — collected upfront before dispatch. If after 5 pm or weekend, after-hours rate ($197) applies.';
      tripHint.classList.add('hint-regular');
      tripHint.style.display = 'block';
    } else if (val === 'This Week' || val === 'Schedule for Later') {
      tripHint.textContent = '📅 Regular hours trip charge: \$77 — collected upfront before dispatch.';
      tripHint.classList.add('hint-regular');
      tripHint.style.display = 'block';
    } else {
      tripHint.style.display = 'none';
    }
  });
}

// ===== ACTIVE NAV HIGHLIGHT =====
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => { if (window.scrollY >= sec.offsetTop - 90) current = sec.id; });
  navLinks.forEach(link => {
    link.style.color = link.getAttribute('href') === '#' + current ? 'var(--blue2)' : '';
  });
}, { passive: true });

// ===== DYNAMIC PRICING =====
fetch('./prices.json')
  .then(r => r.ok ? r.json() : null)
  .then(prices => {
    if (!prices) return;
    document.querySelectorAll('[data-pb-name]').forEach(el => {
      const name = el.dataset.pbName;
      if (prices[name] === undefined) return;
      const val = prices[name];
      // Static .pb-price span
      const pbSpan = el.querySelector('.pb-price');
      if (pbSpan) pbSpan.textContent = val;
      // Animated counter .count span — update data-target and current value
      const countSpan = el.querySelector('.count');
      if (countSpan) {
        el.dataset.target = val;
        countSpan.textContent = Math.round(val);
      }
    });
  })
  .catch(() => {}); // fail silently if prices.json missing
