'use strict';

// ── Elements ──
const btnChairperson = document.getElementById('btnChairperson');
const btnFaculty     = document.getElementById('btnFaculty');
const roleInput      = document.getElementById('roleInput');
const cardSub        = document.getElementById('cardSub');
const emailInput     = document.getElementById('email');
const passwordInput  = document.getElementById('password');
const forgotLink     = document.getElementById('forgotLink');

// ── Placeholder hints per role ──
const PLACEHOLDERS = {
  chairperson: { email: 'chair@pup.edu.ph',    password: '••••••••••••' },
  faculty:     { email: 'bgarcia@pup.edu.ph',  password: '••••••••••••' },
};

// ── Switch role ──
function setRole(role) {
  roleInput.value = role;

  btnChairperson.classList.toggle('active', role === 'chairperson');
  btnFaculty.classList.toggle('active',     role === 'faculty');

  cardSub.textContent = role === 'chairperson' ? 'CHAIRPERSON PORTAL' : 'FACULTY PORTAL';

  emailInput.placeholder    = PLACEHOLDERS[role].email;
  passwordInput.placeholder = PLACEHOLDERS[role].password;

  // Only faculty can request a reset (the chairperson is who they ask).
  forgotLink.hidden = role !== 'faculty';
}

btnChairperson.addEventListener('click', () => setRole('chairperson'));
btnFaculty.addEventListener('click',     () => setRole('faculty'));

// ── Pre-select role from URL query param (?role=chairperson or ?role=faculty) ──
const urlRole = new URLSearchParams(window.location.search).get('role');
if (urlRole === 'faculty' || urlRole === 'chairperson') {
  setRole(urlRole);
}

// ── Show an error if we were bounced back here for using the wrong role ──
const urlError = new URLSearchParams(window.location.search).get('error');
if (urlError === 'access_denied') {
  const passwordErrorEl = document.getElementById('passwordError');
  if (passwordErrorEl) {
    passwordErrorEl.textContent = 'Access denied: that account does not have permission to view that portal. Please log in with the correct account.';
  }
}

// ── Password visibility toggle ──
const toggleBtn = document.getElementById('togglePassword');
const eyeIcon   = document.getElementById('eyeIcon');

const EYE_OPEN = `
  <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z"
        stroke="currentColor" stroke-width="1.5"/>
  <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
`;

const EYE_CLOSED = `
  <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z"
        stroke="currentColor" stroke-width="1.5"/>
  <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
  <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
`;

toggleBtn.addEventListener('click', () => {
  const showing       = passwordInput.type === 'password';
  passwordInput.type  = showing ? 'text' : 'password';
  eyeIcon.innerHTML   = showing ? EYE_CLOSED : EYE_OPEN;
});

// ── Validation ──
const form          = document.getElementById('loginForm');
const emailError    = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const submitBtn     = document.getElementById('submitBtn');

function validateEmail(v) {
  if (!v)                                     return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address.';
  return '';
}

function validatePassword(v) {
  if (!v) return 'Password is required.';
  const minLength = roleInput.value === 'faculty' ? 5 : 5;
  if (v.length < minLength) return `At least ${minLength} characters required.`;
  return '';
}

emailInput.addEventListener('blur',    () => { emailError.textContent    = validateEmail(emailInput.value.trim()); });
passwordInput.addEventListener('blur', () => { passwordError.textContent = validatePassword(passwordInput.value); });
emailInput.addEventListener('input',   () => { emailError.textContent    = ''; });
passwordInput.addEventListener('input',() => { passwordError.textContent = ''; });

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const eErr = validateEmail(emailInput.value.trim());
  const pErr = validatePassword(passwordInput.value);
  emailError.textContent    = eErr;
  passwordError.textContent = pErr;
  if (eErr || pErr) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  submitBtn.classList.add('loading');
  submitBtn.textContent = 'Logging in…';

  try {
    const response = await API.login(email, password);
    const user = response.user;
    const selectedRole = roleInput.value; // which tab was active when they submitted

    if (user.role !== selectedRole) {
      // Credentials were valid, but for the other portal. Reject explicitly
      // instead of silently logging them in and redirecting to their real
      // portal — end the session we just created so nothing is left active.
      await API.logout().catch(() => {});
      submitBtn.classList.remove('loading');
      submitBtn.textContent = 'LOGIN';
      const portalName = selectedRole === 'chairperson' ? 'Chairperson' : 'Faculty';
      passwordError.textContent = `That account is not a ${portalName.toLowerCase()} account. Please switch tabs above, or use the correct portal's credentials.`;
      return;
    }

    // Logged in with an emailed temporary password → must pick a new one first.
    if (response.must_change_password) {
      submitBtn.classList.remove('loading');
      submitBtn.textContent = 'LOGIN';
      openSetPassword(user);
      return;
    }

    goToPortal(user);
  } catch (err) {
    submitBtn.classList.remove('loading');
    submitBtn.textContent = 'LOGIN';
    passwordError.textContent = err.message || 'Invalid email or password.';
  }
});

function goToPortal(user) {
  // Redirect based on role from backend
  if (user.role === 'chairperson') {
    window.location.href = 'chairperson/dashboard.html';
  } else {
    window.location.href = 'faculty/dashboard.html';
  }
}

// ── Set a new password (after logging in with a temporary one) ──
const npOverlay = document.getElementById('npOverlay');
const npForm    = document.getElementById('npForm');
const npPass    = document.getElementById('npPass');
const npConfirm = document.getElementById('npConfirm');
const npError   = document.getElementById('npError');
const npSubmit  = document.getElementById('npSubmit');
let npUser = null;

function openSetPassword(user) {
  npUser = user;
  npPass.value = npConfirm.value = '';
  npError.textContent = '';
  npOverlay.hidden = false;
  npPass.focus();
}

// Closing = cancelling: end the half-finished session so they must start again.
document.getElementById('npClose').addEventListener('click', async () => {
  await API.logout().catch(() => {});
  npOverlay.hidden = true;
  npUser = null;
  passwordInput.value = '';
});

[npPass, npConfirm].forEach(el => el.addEventListener('input', () => { npError.textContent = ''; }));

npForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (npPass.value.length < 6)        { npError.textContent = 'At least 6 characters required.'; return; }
  if (npPass.value !== npConfirm.value) { npError.textContent = 'Passwords do not match.'; return; }

  npSubmit.classList.add('loading');
  npSubmit.textContent = 'Saving…';
  try {
    await API.setNewPassword(npPass.value);
    goToPortal(npUser);
  } catch (ex) {
    npError.textContent = ex.message || 'Could not save the new password. Please try again.';
    npSubmit.classList.remove('loading');
    npSubmit.textContent = 'SAVE NEW PASSWORD';
  }
});

// ── Forgot password (faculty) ──
const fpOverlay = document.getElementById('fpOverlay');
const fpForm    = document.getElementById('fpForm');
const fpEmail   = document.getElementById('fpEmail');
const fpError   = document.getElementById('fpError');
const fpSubmit  = document.getElementById('fpSubmit');
const fpDone    = document.getElementById('fpDone');
const fpDoneTxt = document.getElementById('fpDoneText');

function openForgot() {
  fpForm.hidden = false;
  fpDone.hidden = true;
  fpError.textContent = '';
  fpEmail.value = emailInput.value.trim();   // carry over what they already typed
  fpOverlay.hidden = false;
  fpEmail.focus();
}
function closeForgot() { fpOverlay.hidden = true; }

forgotLink.addEventListener('click', (e) => { e.preventDefault(); openForgot(); });
document.getElementById('fpClose').addEventListener('click', closeForgot);
document.getElementById('fpDoneBtn').addEventListener('click', closeForgot);
fpOverlay.addEventListener('click', (e) => { if (e.target === fpOverlay) closeForgot(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !fpOverlay.hidden) closeForgot(); });
fpEmail.addEventListener('input', () => { fpError.textContent = ''; });

fpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = fpEmail.value.trim();
  const err = validateEmail(email);
  if (err) { fpError.textContent = err; return; }

  fpSubmit.classList.add('loading');
  fpSubmit.textContent = 'Sending…';
  try {
    const res = await API.forgotPassword(email);
    fpForm.hidden = true;
    fpDone.hidden = false;
    // Same wording whether or not the email matched an account.
    fpDoneTxt.textContent = res.message ||
      'If that email belongs to a faculty account, a temporary password has been emailed to it.';
  } catch (ex) {
    fpError.textContent = ex.message || 'Could not send the email. Please try again.';
  } finally {
    fpSubmit.classList.remove('loading');
    fpSubmit.textContent = 'SEND TEMPORARY PASSWORD';
  }
});

/* ── Animated timetable grid ── */
(function () {
  const grid = document.getElementById('loginTTGrid');
  if (!grid) return;

  const DAYS = 5, ROWS = 5;
  const FILLED = [
    { d:0, r:0, c:'maroon' }, { d:2, r:0, c:'gold'   }, { d:4, r:0, c:'light'  },
    { d:1, r:1, c:'maroon' }, { d:3, r:1, c:'light'  },
    { d:0, r:2, c:'gold'   }, { d:2, r:2, c:'maroon' }, { d:4, r:2, c:'gold'   },
    { d:1, r:3, c:'light'  }, { d:3, r:3, c:'maroon' },
    { d:0, r:4, c:'maroon' }, { d:2, r:4, c:'light'  }, { d:4, r:4, c:'maroon' },
  ];

  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let d = 0; d < DAYS; d++) {
      const cell = document.createElement('div');
      cell.className = 'scene__tt-cell';
      const slot = FILLED.find(f => f.d === d && f.r === r);
      if (slot) cell.dataset.color = slot.c;
      grid.appendChild(cell);
      cells.push(cell);
    }
  }

  let idx = 0;
  function fillNext() {
    if (idx >= cells.length) { setTimeout(reset, 2000); return; }
    const cell = cells[idx++];
    if (cell.dataset.color) {
      cell.classList.add(`cell--${cell.dataset.color}`);
    }
    setTimeout(fillNext, 80);
  }

  function reset() {
    cells.forEach(c => { c.className = 'scene__tt-cell'; });
    idx = 0;
    setTimeout(fillNext, 500);
  }

  setTimeout(fillNext, 400);
})();
