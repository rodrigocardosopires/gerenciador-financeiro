/**
 * =====================================================
 * GERENCIADOR FINANCEIRO - Módulo de Autenticação
 * =====================================================
 */

// Importa cliente Supabase do módulo centralizado
import { supabase } from './supabaseClient.js';

// =====================================================
// 2. THEME MANAGEMENT
// =====================================================

const THEME_STORAGE_KEY = 'gerenciador-financeiro-theme';

function getPreferredTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(currentTheme === 'light' ? 'dark' : 'light');
}

// =====================================================
// 3. DOM ELEMENTS
// =====================================================

const dom = {
  // Cards
  loginCard: document.getElementById('login-card'),
  registerCard: document.getElementById('register-card'),
  forgotCard: document.getElementById('forgot-card'),
  successCard: document.getElementById('success-card'),
  
  // Forms
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  forgotForm: document.getElementById('forgot-form'),
  
  // Buttons
  loginBtn: document.getElementById('login-btn'),
  registerBtn: document.getElementById('register-btn'),
  forgotBtn: document.getElementById('forgot-btn'),
  themeToggle: document.getElementById('theme-toggle'),
  
  // Links
  showRegister: document.getElementById('show-register'),
  showLogin: document.getElementById('show-login'),
  forgotPasswordLink: document.getElementById('forgot-password-link'),
  backToLogin: document.getElementById('back-to-login'),
  successBackBtn: document.getElementById('success-back-btn'),
  
  // Password toggles
  loginPasswordToggle: document.getElementById('login-password-toggle'),
  registerPasswordToggle: document.getElementById('register-password-toggle'),
  
  // Password strength
  passwordStrength: document.getElementById('password-strength'),
  
  // Success messages
  successTitle: document.getElementById('success-title'),
  successMessage: document.getElementById('success-message'),
  
  // Toast
  toastContainer: document.getElementById('toast-container')
};

// =====================================================
// 4. UI HELPERS
// =====================================================

function showCard(cardToShow) {
  [dom.loginCard, dom.registerCard, dom.forgotCard, dom.successCard].forEach(card => {
    if (card) card.style.display = 'none';
  });
  if (cardToShow) {
    cardToShow.style.display = 'block';
    cardToShow.classList.add('auth-card--animate');
  }
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
  
  const textEl = button.querySelector('.btn__text');
  const loaderEl = button.querySelector('.btn__loader');
  
  button.disabled = isLoading;
  if (textEl) textEl.style.display = isLoading ? 'none' : 'inline';
  if (loaderEl) loaderEl.style.display = isLoading ? 'inline' : 'none';
}

function showToast(message, type = 'info', duration = 4000) {
  if (!dom.toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__message">${message}</span>
    <button class="toast__close" aria-label="Fechar">✕</button>
  `;
  
  dom.toastContainer.appendChild(toast);
  toast.querySelector('.toast__close').addEventListener('click', () => removeToast(toast));
  setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  toast.style.animation = 'slideOut 0.3s ease-out forwards';
  setTimeout(() => toast.remove(), 300);
}

function showSuccess(title, message) {
  if (dom.successTitle) dom.successTitle.textContent = title;
  if (dom.successMessage) dom.successMessage.textContent = message;
  showCard(dom.successCard);
}

// =====================================================
// 5. PASSWORD STRENGTH INDICATOR
// =====================================================

function checkPasswordStrength(password) {
  let score = 0;
  
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  return score;
}

function updatePasswordStrength(password) {
  const strengthEl = dom.passwordStrength;
  if (!strengthEl) return;
  
  const bar = strengthEl.querySelector('.password-strength__bar');
  const text = strengthEl.querySelector('.password-strength__text');
  
  if (!password) {
    strengthEl.style.display = 'none';
    return;
  }
  
  strengthEl.style.display = 'flex';
  const score = checkPasswordStrength(password);
  
  const levels = [
    { class: 'weak', text: 'Muito fraca', width: '20%' },
    { class: 'weak', text: 'Fraca', width: '40%' },
    { class: 'medium', text: 'Média', width: '60%' },
    { class: 'good', text: 'Boa', width: '80%' },
    { class: 'strong', text: 'Forte', width: '100%' }
  ];
  
  const level = levels[Math.min(score, levels.length - 1)];
  
  bar.className = `password-strength__bar password-strength__bar--${level.class}`;
  bar.style.width = level.width;
  text.textContent = level.text;
  text.className = `password-strength__text password-strength__text--${level.class}`;
}

// =====================================================
// 6. PASSWORD VISIBILITY TOGGLE
// =====================================================

function togglePasswordVisibility(inputId, toggleBtn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  toggleBtn.textContent = isPassword ? '🙈' : '👁️';
}

// =====================================================
// 7. AUTHENTICATION FUNCTIONS
// =====================================================

async function handleLogin(event) {
  event.preventDefault();
  
  if (!supabase) {
    showToast('Erro: Supabase não configurado', 'error');
    return;
  }
  
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    showToast('Preencha todos os campos', 'warning');
    return;
  }
  
  setButtonLoading(dom.loginBtn, true);
  
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        showToast('E-mail ou senha incorretos', 'error');
      } else if (error.message.includes('Email not confirmed')) {
        showToast('Confirme seu e-mail antes de entrar', 'warning');
      } else {
        showToast(`Erro: ${error.message}`, 'error');
      }
      return;
    }
    
    showToast('Login realizado com sucesso!', 'success');
    
    // Redireciona para a página principal
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
    
  } catch (error) {
    console.error('Erro no login:', error);
    showToast('Erro ao fazer login. Tente novamente.', 'error');
  } finally {
    setButtonLoading(dom.loginBtn, false);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  
  if (!supabase) {
    showToast('Erro: Supabase não configurado', 'error');
    return;
  }
  
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;
  
  // Validações
  if (!name || !email || !password || !confirmPassword) {
    showToast('Preencha todos os campos', 'warning');
    return;
  }
  
  if (password.length < 6) {
    showToast('A senha deve ter pelo menos 6 caracteres', 'warning');
    return;
  }
  
  if (password !== confirmPassword) {
    showToast('As senhas não coincidem', 'warning');
    return;
  }
  
  setButtonLoading(dom.registerBtn, true);
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        },
        emailRedirectTo: window.location.origin + '/index.html'
      }
    });
    
    if (error) {
      if (error.message.includes('already registered')) {
        showToast('Este e-mail já está cadastrado', 'error');
      } else {
        showToast(`Erro: ${error.message}`, 'error');
      }
      return;
    }
    
    // Verifica se precisa confirmar e-mail
    if (data?.user?.identities?.length === 0) {
      showToast('Este e-mail já está cadastrado', 'error');
      return;
    }
    
    showSuccess(
      'Conta criada com sucesso! 🎉',
      'Enviamos um link de confirmação para o seu e-mail. Verifique sua caixa de entrada (e spam) para ativar sua conta.'
    );
    
  } catch (error) {
    console.error('Erro no cadastro:', error);
    showToast('Erro ao criar conta. Tente novamente.', 'error');
  } finally {
    setButtonLoading(dom.registerBtn, false);
  }
}

async function handleForgotPassword(event) {
  event.preventDefault();
  
  if (!supabase) {
    showToast('Erro: Supabase não configurado', 'error');
    return;
  }
  
  const email = document.getElementById('forgot-email').value.trim();
  
  if (!email) {
    showToast('Informe seu e-mail', 'warning');
    return;
  }
  
  setButtonLoading(dom.forgotBtn, true);
  
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password.html'
    });
    
    if (error) {
      showToast(`Erro: ${error.message}`, 'error');
      return;
    }
    
    showSuccess(
      'E-mail enviado! 📧',
      'Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Verifique sua caixa de entrada e spam.'
    );
    
  } catch (error) {
    console.error('Erro na recuperação:', error);
    showToast('Erro ao enviar e-mail. Tente novamente.', 'error');
  } finally {
    setButtonLoading(dom.forgotBtn, false);
  }
}

// =====================================================
// 8. CHECK IF ALREADY LOGGED IN
// =====================================================

async function checkSession() {
  if (!supabase) return;
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // Já está logado, redireciona
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Erro ao verificar sessão:', error);
  }
}

// =====================================================
// 9. EVENT LISTENERS
// =====================================================

function setupEventListeners() {
  // Theme toggle
  dom.themeToggle?.addEventListener('click', toggleTheme);
  
  // Form submissions
  dom.loginForm?.addEventListener('submit', handleLogin);
  dom.registerForm?.addEventListener('submit', handleRegister);
  dom.forgotForm?.addEventListener('submit', handleForgotPassword);
  
  // Navigation links
  dom.showRegister?.addEventListener('click', (e) => {
    e.preventDefault();
    showCard(dom.registerCard);
  });
  
  dom.showLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    showCard(dom.loginCard);
  });
  
  dom.forgotPasswordLink?.addEventListener('click', (e) => {
    e.preventDefault();
    showCard(dom.forgotCard);
  });
  
  dom.backToLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    showCard(dom.loginCard);
  });
  
  dom.successBackBtn?.addEventListener('click', () => {
    showCard(dom.loginCard);
  });
  
  // Password toggles
  dom.loginPasswordToggle?.addEventListener('click', function() {
    togglePasswordVisibility('login-password', this);
  });
  
  dom.registerPasswordToggle?.addEventListener('click', function() {
    togglePasswordVisibility('register-password', this);
  });
  
  // Password strength
  document.getElementById('register-password')?.addEventListener('input', function() {
    updatePasswordStrength(this.value);
  });
}

// =====================================================
// 10. INITIALIZATION
// =====================================================

function init() {
  console.log('🔐 Iniciando módulo de autenticação...');
  
  // Aplica tema
  applyTheme(getPreferredTheme());
  
  // Verifica se já está logado
  checkSession();
  
  // Configura event listeners
  setupEventListeners();
  
  // Mostra erro se Supabase não estiver configurado
  if (!supabase) {
    showToast('Configure o Supabase em js/config.js', 'error', 10000);
  }
  
  console.log('✅ Módulo de autenticação iniciado!');
}

// Inicia quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
