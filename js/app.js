/**
 * =====================================================
 * GERENCIADOR FINANCEIRO - Aplicação Principal
 * =====================================================
 */

// =====================================================
// 1. IMPORTS E CONFIGURAÇÕES
// =====================================================

import { supabase } from './supabaseClient.js';

const TABLE_NAME = 'transactions';

// Variável global para armazenar o usuário atual
let currentUser = null;

// =====================================================
// 1.1 AUTHENTICATION CHECK
// =====================================================

async function checkAuth() {
  if (!supabase) return null;
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Não está logado, redireciona para login
      window.location.href = 'login.html';
      return null;
    }
    
    currentUser = session.user;
    return currentUser;
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    window.location.href = 'login.html';
    return null;
  }
}

async function handleLogout() {
  if (!supabase) return;
  
  try {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    showToast('Erro ao sair. Tente novamente.', 'error');
  }
}

function updateUserUI() {
  const userNameEl = document.getElementById('user-name');
  const userAvatarEl = document.getElementById('user-avatar');
  
  if (currentUser) {
    const name = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Usuário';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    if (userNameEl) userNameEl.textContent = name;
    if (userAvatarEl) userAvatarEl.textContent = initials;
  }
}

// =====================================================
// 2. THEME MANAGEMENT
// =====================================================

const THEME_STORAGE_KEY = 'gerenciador-financeiro-theme';

function getPreferredTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }
  
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  
  return 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#0a0a0f' : '#f8fafc');
  }
  
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(currentTheme === 'light' ? 'dark' : 'light');
}

function initTheme() {
  applyTheme(getPreferredTheme());
  
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

initTheme();

// =====================================================
// 3. CONFIGURAÇÃO DE ABAS
// =====================================================

const tabsConfig = [
  { key: 'receitas', label: 'Receitas', icon: '📈', type: 'income', placeholder: 'Ex.: Salário, Freelance...' },
  { key: 'contas_fixas', label: 'Contas Fixas', icon: '🏠', type: 'expense', placeholder: 'Ex.: Aluguel, Internet...' },
  { key: 'contas_variaveis', label: 'Contas Variáveis', icon: '🛒', type: 'expense', placeholder: 'Ex.: Supermercado...' },
  { key: 'cartoes_credito', label: 'Cartões de Crédito', icon: '💳', type: 'expense', placeholder: 'Ex.: Fatura Nubank...' },
  { key: 'dashboard_anual', label: 'Dashboard Anual', icon: '📅', type: 'dashboard' },
  { key: 'consultas', label: 'Consultas', icon: '🔍', type: 'query' }
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const defaultCategories = {
  receitas: ['Salário', 'Freelance', 'Investimentos', 'Vendas', 'Outros'],
  contas_fixas: ['Moradia', 'Transporte', 'Saúde', 'Educação', 'Serviços', 'Outros'],
  contas_variaveis: ['Alimentação', 'Lazer', 'Compras', 'Transporte', 'Saúde', 'Outros'],
  cartoes_credito: ['Compras', 'Assinaturas', 'Alimentação', 'Viagens', 'Outros']
};

// =====================================================
// 4. STATE MANAGEMENT
// =====================================================

const state = {
  activeTab: 'receitas',
  transactions: {
    receitas: [],
    contas_fixas: [],
    contas_variaveis: [],
    cartoes_credito: []
  },
  loading: {
    receitas: false,
    contas_fixas: false,
    contas_variaveis: false,
    cartoes_credito: false,
    dashboard_anual: false,
    consultas: false
  },
  initialized: false,
  dashboardYear: new Date().getFullYear(),
  dashboardCache: { year: null, data: null },
  // Estado dos filtros de consulta
  queryFilters: {
    startDate: '',
    endDate: '',
    tabTypes: [], // Array de tab_keys selecionados (vazio = todos)
    category: ''
  },
  queryResults: null // Resultados da última consulta
};

// =====================================================
// 5. SUPABASE DATA ACCESS LAYER
// =====================================================

async function fetchTransactions(tabKey) {
  if (!supabase) {
    showToast('Erro: Supabase não configurado', 'error');
    return [];
  }
  
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('tab_key', tabKey)
      .order('date', { ascending: false });
    
    if (error) {
      console.error(`Erro ao buscar transações (${tabKey}):`, error);
      showToast(`Erro ao carregar dados: ${error.message}`, 'error');
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error(`Erro inesperado (${tabKey}):`, error);
    showToast('Erro de conexão com o servidor', 'error');
    return [];
  }
}

async function insertTransaction(transaction) {
  if (!supabase) {
    showToast('Erro: Supabase não configurado', 'error');
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert([transaction])
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao inserir:', error);
      showToast(`Erro ao salvar: ${error.message}`, 'error');
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Erro inesperado ao inserir:', error);
    showToast('Erro ao salvar o lançamento', 'error');
    return null;
  }
}

async function insertMultipleTransactions(transactions) {
  if (!supabase) {
    showToast('Erro: Supabase não configurado', 'error');
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(transactions)
      .select();
    
    if (error) {
      console.error('Erro ao inserir múltiplas transações:', error);
      showToast(`Erro ao salvar: ${error.message}`, 'error');
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Erro inesperado ao inserir:', error);
    showToast('Erro ao salvar os lançamentos', 'error');
    return null;
  }
}

async function deleteTransaction(id) {
  if (!supabase) {
    showToast('Erro: Supabase não configurado', 'error');
    return false;
  }
  
  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Erro ao remover:', error);
      showToast(`Erro ao remover: ${error.message}`, 'error');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro inesperado ao remover:', error);
    showToast('Erro ao remover o lançamento', 'error');
    return false;
  }
}

async function updateTransactionPaid(id, isPaid) {
  if (!supabase) {
    showToast('Erro: Supabase não configurado', 'error');
    return false;
  }
  
  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ is_paid: isPaid })
      .eq('id', id);
    
    if (error) {
      console.error('Erro ao atualizar status:', error);
      showToast(`Erro ao atualizar: ${error.message}`, 'error');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro inesperado ao atualizar:', error);
    showToast('Erro ao atualizar o lançamento', 'error');
    return false;
  }
}

// =====================================================
// 6. CALCULATION LOGIC
// =====================================================

function sumTransactions(transactions) {
  return transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
}

/**
 * Filtra transações do mês/ano especificado
 */
function filterTransactionsByMonth(transactions, year, month) {
  return transactions.filter(t => {
    if (!t.date) return false;
    const date = new Date(t.date);
    return date.getFullYear() === year && date.getMonth() === month;
  });
}

/**
 * Calcula totais apenas do mês corrente
 */
function calculateCurrentMonthTotals(stateTransactions) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  const totals = {};
  let totalReceitas = 0;
  let totalDespesas = 0;
  
  tabsConfig.forEach(tab => {
    // Ignora abas especiais (dashboard e consultas)
    if (tab.type === 'dashboard' || tab.type === 'query') return;
    
    const allTransactions = stateTransactions[tab.key] || [];
    const monthTransactions = filterTransactionsByMonth(allTransactions, currentYear, currentMonth);
    const total = sumTransactions(monthTransactions);
    totals[tab.key] = total;
    
    if (tab.type === 'income') {
      totalReceitas += total;
    } else {
      totalDespesas += total;
    }
  });
  
  return {
    ...totals,
    totalReceitas,
    totalDespesas,
    saldoGeral: totalReceitas - totalDespesas,
    monthName: MONTH_NAMES[currentMonth],
    year: currentYear
  };
}

function calculateMonthlyData(year) {
  if (state.dashboardCache.year === year && state.dashboardCache.data) {
    return state.dashboardCache.data;
  }
  
  const monthlyData = Array.from({ length: 12 }, (_, index) => ({
    month: index,
    monthName: MONTH_NAMES[index],
    income: 0,
    expense: 0,
    balance: 0,
    transactionCount: 0
  }));
  
  let totalYearIncome = 0;
  let totalYearExpense = 0;
  
  tabsConfig.forEach(tabConfig => {
    // Ignora abas especiais (dashboard e consultas)
    if (tabConfig.type === 'dashboard' || tabConfig.type === 'query') return;
    
    const transactions = state.transactions[tabConfig.key] || [];
    
    transactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const transactionYear = transactionDate.getFullYear();
      const transactionMonth = transactionDate.getMonth();
      
      if (transactionYear !== year) return;
      
      const amount = parseFloat(transaction.amount || 0);
      
      if (tabConfig.type === 'income') {
        monthlyData[transactionMonth].income += amount;
        totalYearIncome += amount;
      } else {
        monthlyData[transactionMonth].expense += amount;
        totalYearExpense += amount;
      }
      
      monthlyData[transactionMonth].transactionCount++;
    });
  });
  
  monthlyData.forEach(month => {
    month.balance = month.income - month.expense;
  });
  
  const result = {
    year,
    months: monthlyData,
    totals: {
      income: totalYearIncome,
      expense: totalYearExpense,
      balance: totalYearIncome - totalYearExpense
    }
  };
  
  state.dashboardCache = { year, data: result };
  return result;
}

function getAvailableYears() {
  const years = new Set([new Date().getFullYear()]);
  
  tabsConfig.forEach(tabConfig => {
    // Ignora abas especiais (dashboard e consultas)
    if (tabConfig.type === 'dashboard' || tabConfig.type === 'query') return;
    
    (state.transactions[tabConfig.key] || []).forEach(t => {
      if (t.date) years.add(new Date(t.date).getFullYear());
    });
  });
  
  return Array.from(years).sort((a, b) => b - a);
}

function invalidateDashboardCache() {
  state.dashboardCache = { year: null, data: null };
}

// =====================================================
// 6.1 QUERY FILTERS - Consultas Avançadas
// =====================================================

/**
 * Obtém todas as categorias únicas de todas as transações
 * Inclui categorias padrão e categorias das transações existentes
 * @returns {string[]} Array de categorias únicas ordenadas
 */
function getAllCategories() {
  const categories = new Set();

  const transactionTabs = ['receitas', 'contas_fixas', 'contas_variaveis', 'cartoes_credito'];

  // Adiciona categorias padrão
  transactionTabs.forEach(tabKey => {
    (defaultCategories[tabKey] || []).forEach(cat => {
      if (cat && cat.trim()) {
        categories.add(cat.trim());
      }
    });
  });

  // Adiciona categorias das transações existentes
  transactionTabs.forEach(tabKey => {
    (state.transactions[tabKey] || []).forEach(t => {
      if (t.category && t.category.trim()) {
        categories.add(t.category.trim());
      }
    });
  });

  return Array.from(categories).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Filtra transações baseado nos critérios de consulta
 * @param {Object} filters - Filtros a serem aplicados
 * @returns {Object} Objeto com transações filtradas e somatórios
 */
function executeQuery(filters) {
  const { startDate, endDate, tabTypes, category } = filters;
  
  // Definir quais tabs consultar
  const tabsToQuery = tabTypes.length > 0 
    ? tabTypes 
    : ['receitas', 'contas_fixas', 'contas_variaveis', 'cartoes_credito'];
  
  const results = {
    transactions: [],
    totals: {
      receitas: 0,
      contas_fixas: 0,
      contas_variaveis: 0,
      cartoes_credito: 0,
      totalReceitas: 0,
      totalDespesas: 0,
      saldo: 0
    },
    counts: {
      receitas: 0,
      contas_fixas: 0,
      contas_variaveis: 0,
      cartoes_credito: 0,
      total: 0
    }
  };
  
  // Parsear datas para comparação
  const startDateObj = startDate ? new Date(startDate + 'T00:00:00') : null;
  const endDateObj = endDate ? new Date(endDate + 'T23:59:59') : null;
  
  tabsToQuery.forEach(tabKey => {
    const transactions = state.transactions[tabKey] || [];
    const tabConfig = tabsConfig.find(t => t.key === tabKey);
    
    transactions.forEach(t => {
      // Filtro por data
      if (t.date) {
        const transactionDate = new Date(t.date + 'T12:00:00');
        
        if (startDateObj && transactionDate < startDateObj) return;
        if (endDateObj && transactionDate > endDateObj) return;
      }
      
      // Filtro por categoria
      if (category && t.category !== category) return;
      
      // Transação passou nos filtros
      const amount = parseFloat(t.amount || 0);
      
      results.transactions.push({
        ...t,
        tabKey,
        tabLabel: tabConfig?.label || tabKey,
        tabIcon: tabConfig?.icon || '📄',
        tabType: tabConfig?.type || 'expense'
      });
      
      results.totals[tabKey] += amount;
      results.counts[tabKey]++;
      results.counts.total++;
      
      if (tabConfig?.type === 'income') {
        results.totals.totalReceitas += amount;
      } else {
        results.totals.totalDespesas += amount;
      }
    });
  });
  
  // Calcular saldo
  results.totals.saldo = results.totals.totalReceitas - results.totals.totalDespesas;
  
  // Ordenar por data (mais recente primeiro)
  results.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return results;
}

/**
 * Gera datas para meses subsequentes (começando no próximo mês)
 * @param {string} startDate - Data base (YYYY-MM-DD)
 * @param {number} count - Quantidade de parcelas
 * @returns {string[]} Array de datas
 */
function generateMonthlyDates(startDate, count) {
  const dates = [];
  const [year, month, day] = startDate.split('-').map(Number);
  
  // Começa no próximo mês (i = 1), não no mês atual
  for (let i = 1; i <= count; i++) {
    const date = new Date(year, month - 1 + i, day);
    
    // Ajusta para o último dia do mês se o dia original não existir
    // Ex: 31/01 + 1 mês = 28/02 (ou 29 em ano bissexto)
    const originalDay = day;
    if (date.getDate() !== originalDay) {
      date.setDate(0); // Volta para o último dia do mês anterior
    }
    
    dates.push(date.toISOString().split('T')[0]);
  }
  
  return dates;
}

// =====================================================
// 7. DOM RENDERING
// =====================================================

const dom = {
  tabContent: document.getElementById('tab-content'),
  tabs: document.querySelectorAll('.tab'),
  summaryReceitas: document.getElementById('summary-receitas'),
  summaryContasFixas: document.getElementById('summary-contas_fixas'),
  summaryContasVariaveis: document.getElementById('summary-contas_variaveis'),
  summaryCartoesCredito: document.getElementById('summary-cartoes_credito'),
  summaryTotalDespesas: document.getElementById('summary-total-despesas'),
  summarySaldo: document.getElementById('summary-saldo'),
  summaryBalanceContainer: document.getElementById('summary-balance-container'),
  btnRefresh: document.getElementById('btn-refresh'),
  toastContainer: document.getElementById('toast-container')
};

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function renderTab(tabKey) {
  const tabConfig = tabsConfig.find(t => t.key === tabKey);
  if (!tabConfig) return;
  
  // Filtra apenas transações do mês atual
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const allTransactions = state.transactions[tabKey] || [];
  const transactions = filterTransactionsByMonth(allTransactions, currentYear, currentMonth);
  
  const isLoading = state.loading[tabKey];
  const categories = defaultCategories[tabKey] || [];
  
  const html = `
    <section class="form-section">
      <h3 class="form-section__title">${tabConfig.icon} Novo Lançamento</h3>
      <form class="form" id="form-${tabKey}" data-tab="${tabKey}">
        <div class="form-group">
          <label class="form-label" for="date-${tabKey}">Data</label>
          <input type="date" class="form-input" id="date-${tabKey}" name="date" value="${getTodayDate()}" required>
        </div>
        
        <div class="form-group" style="flex: 2;">
          <label class="form-label" for="description-${tabKey}">Descrição</label>
          <input type="text" class="form-input" id="description-${tabKey}" name="description" placeholder="${tabConfig.placeholder}" required maxlength="200">
        </div>
        
        <div class="form-group">
          <label class="form-label" for="category-${tabKey}">Categoria</label>
          <select class="form-select" id="category-${tabKey}" name="category">
            <option value="">Selecione...</option>
            ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="amount-${tabKey}">Valor (R$)</label>
          <input type="number" class="form-input" id="amount-${tabKey}" name="amount" placeholder="0,00" step="0.01" min="0.01" required>
        </div>
        
        <!-- Checkbox Repetir (ao lado do valor) -->
        <div class="form-group form-group--checkbox">
          <label class="checkbox-label">
            <input type="checkbox" name="is_recurring" id="recurring-${tabKey}" class="checkbox-input">
            <span class="checkbox-custom"></span>
            <span>🔁 Repetir</span>
          </label>
        </div>
        
        <div class="form-group">
          <button type="submit" class="btn btn--primary">➕ Adicionar</button>
        </div>
        
        <!-- Opções de Recorrência (linha inteira, expande quando checkbox marcado) -->
        <div class="form-group form-group--full recurrence-options" id="recurrence-options-${tabKey}" style="display: none;">
          <div class="recurrence-section">
            <div class="recurrence-row">
              <select class="form-select recurrence-select" name="recurrence_type" id="recurrence-type-${tabKey}">
                <option value="fixed">Por X meses</option>
                <option value="monthly">Todos os meses (12x)</option>
              </select>
              
              <div class="recurrence-count" id="recurrence-count-wrapper-${tabKey}">
                <label class="form-label">Repetir por</label>
                <div class="recurrence-count-input">
                  <input type="number" class="form-input" name="recurrence_count" id="recurrence-count-${tabKey}" value="2" min="2" max="60">
                  <span>meses</span>
                </div>
              </div>
            </div>
            
            <p class="recurrence-info" id="recurrence-info-${tabKey}">
              📅 Serão criadas <strong>2 parcelas</strong> nos próximos meses
            </p>
          </div>
        </div>
      </form>
    </section>
    
    <section class="list-section">
      <h3 class="list-section__title">
        📋 Lançamentos de ${MONTH_NAMES[currentMonth]}
        <span class="list-section__count">(${transactions.length} ${transactions.length === 1 ? 'item' : 'itens'})</span>
      </h3>
      ${isLoading ? renderLoading() : renderTransactionsList(transactions, tabConfig)}
    </section>
  `;
  
  dom.tabContent.innerHTML = html;
  
  // Event listeners do formulário
  document.getElementById(`form-${tabKey}`)?.addEventListener('submit', handleFormSubmit);
  dom.tabContent.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', handleDeleteClick);
  });
  
  // Event listeners para checkbox "Pago"
  dom.tabContent.querySelectorAll('[data-action="toggle-paid"]').forEach(checkbox => {
    checkbox.addEventListener('change', handleTogglePaid);
  });
  
  // Event listeners de recorrência
  setupRecurrenceListeners(tabKey);
}

function setupRecurrenceListeners(tabKey) {
  const checkbox = document.getElementById(`recurring-${tabKey}`);
  const options = document.getElementById(`recurrence-options-${tabKey}`);
  const typeSelect = document.getElementById(`recurrence-type-${tabKey}`);
  const countWrapper = document.getElementById(`recurrence-count-wrapper-${tabKey}`);
  const countInput = document.getElementById(`recurrence-count-${tabKey}`);
  const dateInput = document.getElementById(`date-${tabKey}`);
  const info = document.getElementById(`recurrence-info-${tabKey}`);
  
  if (!checkbox || !options) return;
  
  // Toggle de exibição das opções
  checkbox.addEventListener('change', () => {
    options.style.display = checkbox.checked ? 'block' : 'none';
    updateRecurrenceInfo();
  });
  
  // Mudança no tipo de recorrência
  typeSelect?.addEventListener('change', () => {
    const isFixed = typeSelect.value === 'fixed';
    countWrapper.style.display = isFixed ? 'flex' : 'none';
    updateRecurrenceInfo();
  });
  
  // Mudança na quantidade
  countInput?.addEventListener('input', updateRecurrenceInfo);
  
  // Mudança na data
  dateInput?.addEventListener('change', updateRecurrenceInfo);
  
  function updateRecurrenceInfo() {
    if (!info) return;
    
    const isMonthly = typeSelect?.value === 'monthly';
    const count = isMonthly ? 12 : parseInt(countInput?.value || 2);
    const startDate = dateInput?.value || getTodayDate();
    
    // Calcula a data da primeira parcela (próximo mês)
    const [year, month, day] = startDate.split('-').map(Number);
    const firstDate = new Date(year, month, day); // month já é +1 porque começa do próximo
    const firstDateStr = firstDate.toISOString().split('T')[0];
    
    // Calcula a data da última parcela
    const lastDate = new Date(year, month - 1 + count, day);
    const lastDateStr = lastDate.toISOString().split('T')[0];
    
    info.innerHTML = `📅 Serão criadas <strong>${count} parcelas</strong>: primeira em <strong>${formatDate(firstDateStr)}</strong>, última em <strong>${formatDate(lastDateStr)}</strong>`;
  }
}

function renderTransactionsList(transactions, tabConfig) {
  if (transactions.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">📭</div>
        <p class="empty-state__text">Nenhum lançamento encontrado.<br>Adicione seu primeiro lançamento acima!</p>
      </div>
    `;
  }
  
  const amountClass = tabConfig.type === 'income' ? 'item-row__amount--income' : 'item-row__amount--expense';
  const isExpense = tabConfig.type === 'expense';
  
  return `
    <div class="items-header ${isExpense ? 'items-header--expense' : ''}">
      <span>Data</span>
      <span>Descrição</span>
      <span>Categoria</span>
      <span>Valor</span>
      ${isExpense ? '<span>Pago?</span>' : ''}
      <span>Ações</span>
    </div>
    <div class="items-list">
      ${transactions.map(t => `
        <div class="item-row ${isExpense ? 'item-row--expense' : ''} ${t.is_paid ? 'item-row--paid' : ''}" data-id="${t.id}">
          <span class="item-row__date">${formatDate(t.date)}</span>
          <span class="item-row__description" title="${t.description}">${t.description}</span>
          <span class="item-row__category">${t.category || '-'}</span>
          <span class="item-row__amount ${amountClass}">${formatCurrency(t.amount)}</span>
          ${isExpense ? `
            <div class="item-row__paid">
              <label class="paid-checkbox">
                <input type="checkbox" 
                  class="paid-checkbox__input" 
                  data-action="toggle-paid" 
                  data-id="${t.id}" 
                  data-tab="${tabConfig.key}"
                  ${t.is_paid ? 'checked' : ''}>
                <span class="paid-checkbox__box"></span>
              </label>
            </div>
          ` : ''}
          <div class="item-row__actions">
            <button class="btn btn--danger btn--small" data-action="delete" data-id="${t.id}" data-tab="${tabConfig.key}" title="Remover">🗑️</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderLoading() {
  return `
    <div class="loading">
      <div class="loading__spinner"></div>
      <p>Carregando dados...</p>
    </div>
  `;
}

function renderDashboardAnual() {
  const year = state.dashboardYear;
  const isLoading = state.loading.dashboard_anual;
  
  if (isLoading) {
    dom.tabContent.innerHTML = renderLoading();
    return;
  }
  
  const dashboardData = calculateMonthlyData(year);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const availableYears = getAvailableYears();
  const minYear = Math.min(...availableYears);
  const maxYear = Math.max(...availableYears);
  
  const html = `
    <div class="dashboard-header">
      <h3 class="dashboard-header__title">📅 Dashboard Financeiro Anual</h3>
      <div class="dashboard-header__controls">
        <div class="year-selector">
          <button class="year-selector__btn" id="btn-year-prev" title="Ano anterior" ${year <= minYear ? 'disabled' : ''}>◀</button>
          <span class="year-selector__value">${year}</span>
          <button class="year-selector__btn" id="btn-year-next" title="Próximo ano" ${year >= maxYear ? 'disabled' : ''}>▶</button>
        </div>
      </div>
    </div>
    
    <div class="dashboard-summary">
      <div class="dashboard-summary__card dashboard-summary__card--income">
        <div class="dashboard-summary__label">Total de Receitas em ${year}</div>
        <div class="dashboard-summary__value dashboard-summary__value--income">${formatCurrency(dashboardData.totals.income)}</div>
      </div>
      <div class="dashboard-summary__card dashboard-summary__card--expense">
        <div class="dashboard-summary__label">Total de Despesas em ${year}</div>
        <div class="dashboard-summary__value dashboard-summary__value--expense">${formatCurrency(dashboardData.totals.expense)}</div>
      </div>
      <div class="dashboard-summary__card dashboard-summary__card--balance">
        <div class="dashboard-summary__label">Saldo do Ano</div>
        <div class="dashboard-summary__value ${dashboardData.totals.balance >= 0 ? 'dashboard-summary__value--positive' : 'dashboard-summary__value--negative'}">${formatCurrency(dashboardData.totals.balance)}</div>
      </div>
    </div>
    
    <div class="calendar-grid">
      ${dashboardData.months.map((monthData, index) => {
        const isCurrentMonth = year === currentYear && index === currentMonth;
        const hasData = monthData.transactionCount > 0;
        const isFutureMonth = year === currentYear && index > currentMonth;
        
        return `
          <div class="month-card ${isCurrentMonth ? 'month-card--current' : ''} ${!hasData ? 'month-card--empty' : ''}">
            <div class="month-card__header">
              <span class="month-card__name">${monthData.monthName}</span>
              ${isCurrentMonth ? '<span class="month-card__badge month-card__badge--current">Atual</span>' : ''}
              ${isFutureMonth ? '<span class="month-card__badge">Futuro</span>' : ''}
            </div>
            ${hasData ? `
              <div class="month-card__content">
                <div class="month-card__row">
                  <span class="month-card__label">📈 Receitas</span>
                  <span class="month-card__value month-card__value--income">${formatCurrency(monthData.income)}</span>
                </div>
                <div class="month-card__row">
                  <span class="month-card__label">📉 Despesas</span>
                  <span class="month-card__value month-card__value--expense">${formatCurrency(monthData.expense)}</span>
                </div>
                <div class="month-card__balance">
                  <span class="month-card__balance-label">Saldo</span>
                  <span class="month-card__balance-value ${monthData.balance >= 0 ? 'month-card__balance-value--positive' : 'month-card__balance-value--negative'}">${formatCurrency(monthData.balance)}</span>
                </div>
                <div class="month-card__transactions">${monthData.transactionCount} ${monthData.transactionCount === 1 ? 'lançamento' : 'lançamentos'}</div>
              </div>
            ` : `
              <div class="month-card__content">
                <span>${isFutureMonth ? '📆 Mês futuro' : '📭 Sem lançamentos'}</span>
              </div>
            `}
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  dom.tabContent.innerHTML = html;
  
  document.getElementById('btn-year-prev')?.addEventListener('click', () => changeYear(-1));
  document.getElementById('btn-year-next')?.addEventListener('click', () => changeYear(1));
}

function changeYear(delta) {
  const newYear = state.dashboardYear + delta;
  const availableYears = getAvailableYears();
  const minYear = Math.min(...availableYears);
  const maxYear = Math.max(...availableYears);
  
  if (newYear < minYear || newYear > maxYear) return;
  
  state.dashboardYear = newYear;
  invalidateDashboardCache();
  renderDashboardAnual();
  showToast(`Exibindo dados de ${newYear}`, 'info', 2000);
}

// =====================================================
// 7.1 RENDER CONSULTAS - Aba de Consultas Avançadas
// =====================================================

function renderConsultas() {
  const isLoading = state.loading.consultas;
  const allCategories = getAllCategories();
  const filters = state.queryFilters;
  const results = state.queryResults;
  
  // Definir datas padrão (mês atual) se não houver filtros definidos
  const today = new Date();
  const defaultStartDate = filters.startDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEndDate = filters.endDate || today.toISOString().split('T')[0];
  
  const transactionTabs = tabsConfig.filter(t => t.type !== 'dashboard' && t.type !== 'query');
  
  const html = `
    <div class="query-container">
      <!-- Seção de Filtros -->
      <section class="query-filters">
        <h3 class="query-filters__title">🔍 Filtros de Consulta</h3>
        
        <form class="query-form" id="query-form">
          <!-- Linha 1: Datas -->
          <div class="query-form__row">
            <div class="form-group">
              <label class="form-label" for="query-start-date">📅 Data Inicial</label>
              <input type="date" class="form-input" id="query-start-date" name="startDate" value="${defaultStartDate}">
            </div>
            
            <div class="form-group">
              <label class="form-label" for="query-end-date">📅 Data Final</label>
              <input type="date" class="form-input" id="query-end-date" name="endDate" value="${defaultEndDate}">
            </div>
            
            <div class="form-group">
              <label class="form-label" for="query-category">🏷️ Categoria</label>
              <select class="form-select" id="query-category" name="category">
                <option value="">Todas as categorias</option>
                ${allCategories.map(cat => `
                  <option value="${cat}" ${filters.category === cat ? 'selected' : ''}>${cat}</option>
                `).join('')}
              </select>
            </div>
          </div>
          
          <!-- Linha 2: Tipos de lançamento -->
          <div class="query-form__row">
            <div class="form-group form-group--full">
              <label class="form-label">📋 Tipos de Lançamento</label>
              <div class="query-types">
                ${transactionTabs.map(tab => `
                  <label class="query-type-checkbox">
                    <input type="checkbox" name="tabTypes" value="${tab.key}" 
                      ${filters.tabTypes.length === 0 || filters.tabTypes.includes(tab.key) ? 'checked' : ''}>
                    <span class="query-type-checkbox__box"></span>
                    <span class="query-type-checkbox__icon">${tab.icon}</span>
                    <span class="query-type-checkbox__label">${tab.label}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>
          
          <!-- Botões de ação -->
          <div class="query-form__actions">
            <button type="submit" class="btn btn--primary btn--lg" id="btn-query">
              🔍 Consultar
            </button>
            <button type="button" class="btn btn--secondary" id="btn-clear-filters">
              🗑️ Limpar Filtros
            </button>
          </div>
        </form>
      </section>
      
      ${isLoading ? renderLoading() : renderQueryResults(results)}
    </div>
  `;
  
  dom.tabContent.innerHTML = html;
  
  // Event listeners
  document.getElementById('query-form')?.addEventListener('submit', handleQuerySubmit);
  document.getElementById('btn-clear-filters')?.addEventListener('click', handleClearFilters);
}

/**
 * Renderiza os resultados da consulta
 */
function renderQueryResults(results) {
  if (!results) {
    return `
      <section class="query-results query-results--empty">
        <div class="query-hint">
          <div class="query-hint__icon">💡</div>
          <h4 class="query-hint__title">Como usar os filtros</h4>
          <ul class="query-hint__list">
            <li>Selecione um <strong>período de datas</strong> para filtrar por intervalo</li>
            <li>Escolha uma <strong>categoria</strong> específica ou deixe em branco para todas</li>
            <li>Marque os <strong>tipos de lançamento</strong> que deseja incluir</li>
            <li>Clique em <strong>Consultar</strong> para ver os resultados</li>
          </ul>
        </div>
      </section>
    `;
  }
  
  if (results.counts.total === 0) {
    return `
      <section class="query-results">
        <div class="query-summary">
          ${renderQuerySummary(results)}
        </div>
        <div class="empty-state">
          <div class="empty-state__icon">🔎</div>
          <p class="empty-state__text">Nenhum lançamento encontrado<br>para os filtros selecionados.</p>
        </div>
      </section>
    `;
  }
  
  return `
    <section class="query-results">
      <!-- Resumo / Totais -->
      <div class="query-summary">
        ${renderQuerySummary(results)}
      </div>
      
      <!-- Lista de Resultados -->
      <div class="query-list">
        <h4 class="query-list__title">
          📋 Resultados
          <span class="query-list__count">(${results.counts.total} ${results.counts.total === 1 ? 'lançamento' : 'lançamentos'})</span>
        </h4>
        
        <div class="items-header items-header--query">
          <span>Data</span>
          <span>Tipo</span>
          <span>Descrição</span>
          <span>Categoria</span>
          <span>Valor</span>
        </div>
        
        <div class="items-list">
          ${results.transactions.map(t => {
            const amountClass = t.tabType === 'income' ? 'item-row__amount--income' : 'item-row__amount--expense';
            return `
              <div class="item-row item-row--query">
                <span class="item-row__date">${formatDate(t.date)}</span>
                <span class="item-row__type">
                  <span class="item-row__type-icon">${t.tabIcon}</span>
                  <span class="item-row__type-label">${t.tabLabel}</span>
                </span>
                <span class="item-row__description" title="${t.description}">${t.description}</span>
                <span class="item-row__category">${t.category || '-'}</span>
                <span class="item-row__amount ${amountClass}">${formatCurrency(t.amount)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

/**
 * Renderiza o resumo/somatório da consulta
 */
function renderQuerySummary(results) {
  const { totals, counts } = results;
  
  return `
    <div class="query-summary__grid">
      <!-- Card Receitas -->
      <div class="query-summary__card query-summary__card--income">
        <div class="query-summary__card-header">
          <span class="query-summary__card-icon">📈</span>
          <span class="query-summary__card-label">Receitas</span>
        </div>
        <div class="query-summary__card-value">${formatCurrency(totals.receitas)}</div>
        <div class="query-summary__card-count">${counts.receitas} ${counts.receitas === 1 ? 'lançamento' : 'lançamentos'}</div>
      </div>
      
      <!-- Card Contas Fixas -->
      <div class="query-summary__card query-summary__card--expense">
        <div class="query-summary__card-header">
          <span class="query-summary__card-icon">🏠</span>
          <span class="query-summary__card-label">Contas Fixas</span>
        </div>
        <div class="query-summary__card-value">${formatCurrency(totals.contas_fixas)}</div>
        <div class="query-summary__card-count">${counts.contas_fixas} ${counts.contas_fixas === 1 ? 'lançamento' : 'lançamentos'}</div>
      </div>
      
      <!-- Card Contas Variáveis -->
      <div class="query-summary__card query-summary__card--expense">
        <div class="query-summary__card-header">
          <span class="query-summary__card-icon">🛒</span>
          <span class="query-summary__card-label">Contas Variáveis</span>
        </div>
        <div class="query-summary__card-value">${formatCurrency(totals.contas_variaveis)}</div>
        <div class="query-summary__card-count">${counts.contas_variaveis} ${counts.contas_variaveis === 1 ? 'lançamento' : 'lançamentos'}</div>
      </div>
      
      <!-- Card Cartões de Crédito -->
      <div class="query-summary__card query-summary__card--expense">
        <div class="query-summary__card-header">
          <span class="query-summary__card-icon">💳</span>
          <span class="query-summary__card-label">Cartões de Crédito</span>
        </div>
        <div class="query-summary__card-value">${formatCurrency(totals.cartoes_credito)}</div>
        <div class="query-summary__card-count">${counts.cartoes_credito} ${counts.cartoes_credito === 1 ? 'lançamento' : 'lançamentos'}</div>
      </div>
    </div>
    
    <!-- Totais Gerais -->
    <div class="query-summary__totals">
      <div class="query-summary__total query-summary__total--income">
        <span class="query-summary__total-label">Total Receitas</span>
        <span class="query-summary__total-value">${formatCurrency(totals.totalReceitas)}</span>
      </div>
      <div class="query-summary__total query-summary__total--expense">
        <span class="query-summary__total-label">Total Despesas</span>
        <span class="query-summary__total-value">${formatCurrency(totals.totalDespesas)}</span>
      </div>
      <div class="query-summary__total query-summary__total--balance ${totals.saldo >= 0 ? 'positive' : 'negative'}">
        <span class="query-summary__total-label">Saldo do Período</span>
        <span class="query-summary__total-value">${formatCurrency(totals.saldo)}</span>
      </div>
    </div>
  `;
}

/**
 * Handler para submissão do formulário de consulta
 */
async function handleQuerySubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  // Coletar filtros
  const filters = {
    startDate: formData.get('startDate') || '',
    endDate: formData.get('endDate') || '',
    category: formData.get('category') || '',
    tabTypes: formData.getAll('tabTypes')
  };
  
  // Validar datas
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    showToast('A data inicial não pode ser maior que a data final', 'warning');
    return;
  }
  
  // Salvar filtros no estado
  state.queryFilters = filters;
  state.loading.consultas = true;
  renderConsultas();
  
  // Garantir que todos os dados estão carregados
  if (!state.initialized) {
    await loadAllData();
    state.initialized = true;
  }
  
  // Executar consulta
  state.queryResults = executeQuery(filters);
  state.loading.consultas = false;
  
  renderConsultas();
  showToast(`Consulta realizada: ${state.queryResults.counts.total} lançamentos encontrados`, 'success');
}

/**
 * Handler para limpar filtros
 */
function handleClearFilters() {
  state.queryFilters = {
    startDate: '',
    endDate: '',
    tabTypes: [],
    category: ''
  };
  state.queryResults = null;
  renderConsultas();
  showToast('Filtros limpos', 'info');
}

function renderSummary() {
  const totals = calculateCurrentMonthTotals(state.transactions);
  
  // Atualiza título com o mês atual
  const summaryTitle = document.querySelector('.summary-panel__title');
  if (summaryTitle) {
    summaryTitle.innerHTML = `📊 Resumo de ${totals.monthName}`;
  }
  
  if (dom.summaryReceitas) dom.summaryReceitas.textContent = formatCurrency(totals.receitas || 0);
  if (dom.summaryContasFixas) dom.summaryContasFixas.textContent = formatCurrency(totals.contas_fixas || 0);
  if (dom.summaryContasVariaveis) dom.summaryContasVariaveis.textContent = formatCurrency(totals.contas_variaveis || 0);
  if (dom.summaryCartoesCredito) dom.summaryCartoesCredito.textContent = formatCurrency(totals.cartoes_credito || 0);
  if (dom.summaryTotalDespesas) dom.summaryTotalDespesas.textContent = formatCurrency(totals.totalDespesas);
  if (dom.summarySaldo) dom.summarySaldo.textContent = formatCurrency(totals.saldoGeral);
  
  if (dom.summaryBalanceContainer) {
    dom.summaryBalanceContainer.classList.remove('positive', 'negative');
    dom.summaryBalanceContainer.classList.add(totals.saldoGeral >= 0 ? 'positive' : 'negative');
  }
}

function updateTabsUI(activeTabKey) {
  dom.tabs.forEach(tab => {
    const tabKey = tab.dataset.tab;
    const isActive = tabKey === activeTabKey;
    tab.classList.toggle('tab--active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
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

// =====================================================
// 8. EVENT HANDLERS
// =====================================================

async function setActiveTab(tabKey) {
  const tabConfig = tabsConfig.find(t => t.key === tabKey);
  
  // Aba Dashboard Anual
  if (tabConfig?.type === 'dashboard') {
    state.activeTab = tabKey;
    updateTabsUI(tabKey);
    
    if (!state.initialized) {
      state.loading.dashboard_anual = true;
      renderDashboardAnual();
      await loadAllData();
      state.loading.dashboard_anual = false;
    }
    
    renderDashboardAnual();
    return;
  }
  
  // Aba Consultas
  if (tabConfig?.type === 'query') {
    state.activeTab = tabKey;
    updateTabsUI(tabKey);
    
    // Carregar dados se ainda não foram inicializados
    if (!state.initialized) {
      state.loading.consultas = true;
      renderConsultas(); // Mostra loading
      await loadAllData();
      state.initialized = true;
      state.loading.consultas = false;
    }
    
    // Renderiza após os dados estarem carregados
    renderConsultas();
    return;
  }
  
  // Abas de transações
  if (state.activeTab === tabKey && state.transactions[tabKey]?.length > 0) {
    renderTab(tabKey);
    return;
  }
  
  state.activeTab = tabKey;
  updateTabsUI(tabKey);
  await loadTabData(tabKey);
}

async function loadTabData(tabKey) {
  state.loading[tabKey] = true;
  renderTab(tabKey);
  
  const transactions = await fetchTransactions(tabKey);
  state.transactions[tabKey] = transactions;
  state.loading[tabKey] = false;
  
  renderTab(tabKey);
  renderSummary();
}

async function loadAllData() {
  const promises = tabsConfig
    .filter(tab => tab.type !== 'dashboard' && tab.type !== 'query')
    .map(tab => fetchTransactions(tab.key).then(data => {
      state.transactions[tab.key] = data;
    }));

  await Promise.all(promises);
  renderSummary();
}

async function handleFormSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const tabKey = form.dataset.tab;
  const submitBtn = form.querySelector('button[type="submit"]');
  
  const formData = new FormData(form);
  
  // Dados base da transação
  const baseTransaction = {
    tab_key: tabKey,
    date: formData.get('date'),
    description: formData.get('description').trim(),
    category: formData.get('category') || null,
    amount: parseFloat(formData.get('amount'))
  };
  
  // Validações
  if (!baseTransaction.description) {
    showToast('Por favor, informe uma descrição', 'warning');
    return;
  }
  
  if (isNaN(baseTransaction.amount) || baseTransaction.amount <= 0) {
    showToast('Por favor, informe um valor válido', 'warning');
    return;
  }
  
  // Verificar recorrência
  const isRecurring = formData.get('is_recurring') === 'on';
  const recurrenceType = formData.get('recurrence_type');
  const recurrenceCount = parseInt(formData.get('recurrence_count') || 2);
  
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Salvando...';
  
  let results = null;
  
  if (isRecurring) {
    // Criar múltiplas transações
    const count = recurrenceType === 'monthly' ? 12 : recurrenceCount;
    const dates = generateMonthlyDates(baseTransaction.date, count);
    
    const transactions = dates.map((date, index) => ({
      ...baseTransaction,
      date,
      description: `${baseTransaction.description} (${index + 1}/${count})`
    }));
    
    results = await insertMultipleTransactions(transactions);
    
    if (results) {
      // Adiciona todas ao estado local
      state.transactions[tabKey] = [...results, ...state.transactions[tabKey]];
      state.transactions[tabKey].sort((a, b) => new Date(b.date) - new Date(a.date));
      
      showToast(`${count} lançamentos criados com sucesso!`, 'success');
    }
  } else {
    // Criar transação única
    const result = await insertTransaction(baseTransaction);
    
    if (result) {
      state.transactions[tabKey].unshift(result);
      showToast('Lançamento adicionado com sucesso!', 'success');
    }
    
    results = result ? [result] : null;
  }
  
  submitBtn.disabled = false;
  submitBtn.textContent = '➕ Adicionar';
  
  if (results) {
    // Limpar formulário
    form.querySelector('[name="description"]').value = '';
    form.querySelector('[name="category"]').value = '';
    form.querySelector('[name="amount"]').value = '';
    form.querySelector('[name="is_recurring"]').checked = false;
    document.getElementById(`recurrence-options-${tabKey}`).style.display = 'none';
    
    invalidateDashboardCache();
    renderTab(tabKey);
    renderSummary();
  }
}

async function handleDeleteClick(event) {
  const button = event.currentTarget;
  const id = parseInt(button.dataset.id);
  const tabKey = button.dataset.tab;
  
  if (!confirm('Tem certeza que deseja remover este lançamento?')) return;
  
  button.disabled = true;
  
  const success = await deleteTransaction(id);
  
  if (success) {
    state.transactions[tabKey] = state.transactions[tabKey].filter(t => t.id !== id);
    invalidateDashboardCache();
    renderTab(tabKey);
    renderSummary();
    showToast('Lançamento removido!', 'success');
  } else {
    button.disabled = false;
  }
}

async function handleTogglePaid(event) {
  const checkbox = event.currentTarget;
  const id = parseInt(checkbox.dataset.id);
  const tabKey = checkbox.dataset.tab;
  const isPaid = checkbox.checked;
  
  // Desabilita temporariamente para evitar cliques duplos
  checkbox.disabled = true;
  
  const success = await updateTransactionPaid(id, isPaid);
  
  if (success) {
    // Atualiza o estado local
    const transaction = state.transactions[tabKey].find(t => t.id === id);
    if (transaction) {
      transaction.is_paid = isPaid;
    }
    
    // Atualiza a UI da linha
    const row = checkbox.closest('.item-row');
    if (row) {
      row.classList.toggle('item-row--paid', isPaid);
    }
    
    showToast(isPaid ? 'Marcado como pago!' : 'Desmarcado', 'success', 2000);
  } else {
    // Reverte o checkbox em caso de erro
    checkbox.checked = !isPaid;
  }
  
  checkbox.disabled = false;
}

function handleTabClick(event) {
  const tabKey = event.currentTarget.dataset.tab;
  if (tabKey) setActiveTab(tabKey);
}

async function handleRefreshClick() {
  dom.btnRefresh.disabled = true;
  dom.btnRefresh.textContent = '⏳ Atualizando...';
  
  await loadAllData();
  
  // Renderiza de acordo com a aba ativa
  if (state.activeTab === 'dashboard_anual') {
    invalidateDashboardCache();
    renderDashboardAnual();
  } else if (state.activeTab === 'consultas') {
    // Limpa resultados anteriores e re-renderiza consultas
    state.queryResults = null;
    renderConsultas();
  } else {
    await loadTabData(state.activeTab);
  }
  
  dom.btnRefresh.disabled = false;
  dom.btnRefresh.textContent = '🔄 Atualizar Dados';
  showToast('Dados atualizados!', 'success');
}

function setupEventListeners() {
  dom.tabs.forEach(tab => tab.addEventListener('click', handleTabClick));
  dom.btnRefresh?.addEventListener('click', handleRefreshClick);
}

// =====================================================
// 9. INITIALIZATION
// =====================================================

async function init() {
  console.log('🚀 Iniciando Gerenciador Financeiro...');

  if (!supabase) {
    dom.tabContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <p class="empty-state__text">
          <strong>Erro de conexão!</strong><br><br>
          Não foi possível conectar ao Supabase.<br>
          Verifique as credenciais em <code>js/config.js</code>
        </p>
      </div>
    `;
    return;
  }

  // Verifica se o usuário está autenticado
  const user = await checkAuth();
  if (!user) return; // Será redirecionado para login
  
  // Atualiza UI com dados do usuário
  updateUserUI();
  
  // Configura event listeners (incluindo logout)
  setupEventListeners();
  
  // Listener para logout
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  
  await loadAllData();
  await setActiveTab(state.activeTab);
  state.initialized = true;

  console.log('✅ Aplicação iniciada com sucesso!');
  console.log('👤 Usuário:', currentUser?.email);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Debug exports
window.appDebug = { state, tabsConfig, showToast, toggleTheme };
