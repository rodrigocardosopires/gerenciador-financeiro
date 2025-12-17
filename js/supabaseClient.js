/**
 * =====================================================
 * SUPABASE CLIENT - Configuração do Cliente Supabase
 * =====================================================
 */

import { config } from './config.js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = config;

// =====================================================
// INICIALIZAÇÃO DO CLIENTE
// =====================================================

function createSupabaseClient() {
  if (typeof window.supabase === 'undefined') {
    console.error('❌ SDK do Supabase não encontrado!');
    return null;
  }
  
  // Validação das credenciais
  if (!SUPABASE_URL || !SUPABASE_URL.includes('supabase.co')) {
    console.error(
      '⚠️ Configuração necessária!\n' +
      '1. Copie o arquivo js/config.example.js para js/config.js\n' +
      '2. Insira suas credenciais do Supabase'
    );
    return null;
  }
  
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 100) {
    console.error('⚠️ SUPABASE_ANON_KEY inválida');
    return null;
  }
  
  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'gerenciador-financeiro-auth',
      }
    });
    
    console.log('✅ Cliente Supabase inicializado!');
    return client;
    
  } catch (error) {
    console.error('❌ Erro ao criar cliente Supabase:', error);
    return null;
  }
}

const supabase = createSupabaseClient();

export { supabase };
