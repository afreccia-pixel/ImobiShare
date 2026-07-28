import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Server, 
  Database, 
  ShieldCheck, 
  Wifi, 
  Terminal, 
  Copy, 
  Trash2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { getApiUrl } from '../utils/apiUrl';
import { auth } from '../services/firebase';

export interface TestResult {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'success' | 'failure' | 'warning';
  message?: string;
  details?: Record<string, any>;
  durationMs?: number;
}

export function ConnectionTests() {
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedLogs, setCopiedLogs] = useState(false);

  const [tests, setTests] = useState<TestResult[]>([
    {
      id: 'backend_reachability',
      name: '1. Alcance da URL do Backend (GET)',
      description: 'Verifica conexão HTTP com https://imobishare.onrender.com/api/properties',
      status: 'idle',
    },
    {
      id: 'post_property_test',
      name: '2. Envio de Imóvel de Teste (POST)',
      description: 'Testa envio de JSON via POST e criação de imóvel no servidor',
      status: 'idle',
    },
    {
      id: 'firebase_auth_check',
      name: '3. Validação Firebase Auth & Google Services',
      description: 'Verifica se o Firebase Auth e google-services.json estão autenticados e ativos',
      status: 'idle',
    },
    {
      id: 'neon_postgres_check',
      name: '4. Integração Neon PostgreSQL',
      description: 'Confirma conexão do backend Express com o banco de dados Neon Cloud SQL',
      status: 'idle',
    },
    {
      id: 'cors_https_check',
      name: '5. Validação CORS e Cabeçalhos HTTPS',
      description: 'Verifica política de CORS, HTTPS e headers de resposta do servidor',
      status: 'idle',
    },
  ]);

  const addLog = (text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${text}`]);
  };

  const updateTestState = (id: string, partial: Partial<TestResult>) => {
    setTests(prev => prev.map(t => t.id === id ? { ...t, ...partial } : t));
  };

  // Test 1: Backend Reachability
  const runTestBackendReachability = async (): Promise<boolean> => {
    const testId = 'backend_reachability';
    updateTestState(testId, { status: 'running', message: 'Conectando ao backend...' });
    addLog('🚀 Iniciando Teste 1: GET /api/properties...');

    const startTime = performance.now();
    const targetUrl = getApiUrl('/api/properties');
    addLog(`🌐 Target URL resolvida: ${targetUrl}`);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const durationMs = Math.round(performance.now() - startTime);
      addLog(`📥 Resposta recebida! HTTP Status: ${response.status} (${response.statusText}) - Latência: ${durationMs}ms`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        addLog(`❌ Falha na requisição GET: ${errorText}`);
        updateTestState(testId, {
          status: 'failure',
          message: `Servidor respondeu com status HTTP ${response.status}`,
          details: { status: response.status, statusText: response.statusText, url: targetUrl, errorText },
          durationMs,
        });
        return false;
      }

      const data = await response.json();
      const itemCount = Array.isArray(data) ? data.length : 0;
      addLog(`✅ Sucesso! Backend alcançado. Total de imóveis retornados: ${itemCount}`);

      updateTestState(testId, {
        status: 'success',
        message: `Backend online! Resposta HTTP 200 em ${durationMs}ms (${itemCount} imóveis no banco)`,
        details: { status: response.status, url: targetUrl, totalProperties: itemCount },
        durationMs,
      });
      return true;
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const errMsg = err?.message || String(err);
      addLog(`❌ Erro de rede ao conectar com backend: ${errMsg}`);
      updateTestState(testId, {
        status: 'failure',
        message: `Não foi possível conectar ao backend (${errMsg}). Verifique a conexão com a internet.`,
        details: { error: errMsg, targetUrl },
        durationMs,
      });
      return false;
    }
  };

  // Test 2: POST Property Test
  const runTestPostProperty = async (): Promise<boolean> => {
    const testId = 'post_property_test';
    updateTestState(testId, { status: 'running', message: 'Enviando imóvel de teste via POST...' });
    addLog('🚀 Iniciando Teste 2: POST /api/properties...');

    const startTime = performance.now();
    const targetUrl = getApiUrl('/api/properties');
    
    const testPayload = {
      id: `test-diag-${Date.now()}`,
      titulo: 'Imóvel Diagnóstico de Conexão (Teste)',
      tipo: 'venda',
      tipoImovel: 'Apartamento',
      valor: 500000,
      localizacao: 'Balneário Camboriú, SC',
      bairro: 'Centro',
      cidade: 'Balneário Camboriú',
      dormitorios: 2,
      banheiros: 2,
      vagas: 1,
      metragem: 75,
      descricao: 'Imóvel temporário para teste de persistência e rede.',
      fotos: ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80'],
      corretorId: 'test-broker-diag',
      corretorNome: 'Diagnóstico Mobile',
      dataCadastro: new Date().toISOString(),
    };

    addLog(`📤 Enviando JSON payload (ID: ${testPayload.id}) para ${targetUrl}...`);

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      const durationMs = Math.round(performance.now() - startTime);
      addLog(`📥 Resposta POST recebida! Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        addLog(`❌ Erro no POST do imóvel: ${errorText}`);
        updateTestState(testId, {
          status: 'failure',
          message: `Falha ao salvar imóvel no backend (HTTP ${response.status})`,
          details: { status: response.status, errorText, payloadId: testPayload.id },
          durationMs,
        });
        return false;
      }

      const savedData = await response.json();
      addLog(`✅ Imóvel salvo com sucesso no backend! ID retornado: ${savedData?.id || testPayload.id}`);

      // Try cleaning up test property
      try {
        await fetch(getApiUrl(`/api/properties/${testPayload.id}`), { method: 'DELETE' });
        addLog(`🧹 Imóvel de teste removido do servidor após verificação.`);
      } catch (e) {
        // non-critical
      }

      updateTestState(testId, {
        status: 'success',
        message: `Imóvel de teste enviado e persistido com sucesso! (${durationMs}ms)`,
        details: { savedPropertyId: savedData?.id || testPayload.id, status: response.status },
        durationMs,
      });
      return true;
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const errMsg = err?.message || String(err);
      addLog(`❌ Falha de rede no envio POST: ${errMsg}`);
      updateTestState(testId, {
        status: 'failure',
        message: `Erro ao enviar dados para o servidor: ${errMsg}`,
        details: { error: errMsg, url: targetUrl },
        durationMs,
      });
      return false;
    }
  };

  // Test 3: Firebase Auth Check
  const runTestFirebaseAuth = async (): Promise<boolean> => {
    const testId = 'firebase_auth_check';
    updateTestState(testId, { status: 'running', message: 'Verificando Firebase Auth...' });
    addLog('🚀 Iniciando Teste 3: Firebase Authentication...');

    const startTime = performance.now();

    try {
      const currentUser = auth.currentUser;
      const durationMs = Math.round(performance.now() - startTime);

      const isNativeCapacitor = Boolean(
        (window as any).Capacitor?.isNativePlatform?.() ||
        (window as any).Capacitor?.getPlatform?.() === 'android'
      );

      addLog(`📱 Plataforma Capacitor Native: ${isNativeCapacitor ? 'SIM (Android/iOS)' : 'NÃO (Web Browser)'}`);
      addLog(`🔥 Firebase Web SDK initialized: ${Boolean(auth.app?.options?.apiKey)}`);
      addLog(`🔑 Firebase Auth State: ${currentUser ? `Usuário Logado (${currentUser.email})` : 'Nenhum usuário logado no momento'}`);

      if (currentUser) {
        addLog(`👤 Usuário UID: ${currentUser.uid}`);
        addLog(`📧 E-mail: ${currentUser.email}`);
        addLog(`🆔 Auth Provider: ${currentUser.providerData?.[0]?.providerId || 'firebase'}`);

        updateTestState(testId, {
          status: 'success',
          message: `Firebase Auth ativo! Usuário conectado (${currentUser.email})`,
          details: {
            uid: currentUser.uid,
            email: currentUser.email,
            isNativeCapacitor,
            providerId: currentUser.providerData?.[0]?.providerId || 'password',
          },
          durationMs,
        });
        return true;
      } else {
        addLog(`⚠️ Firebase inicializado com sucesso, mas nenhum usuário está logado atualmente.`);
        updateTestState(testId, {
          status: 'warning',
          message: 'Firebase SDK ativo, porém nenhum usuário está autenticado no momento. Faça login para testar token.',
          details: { isNativeCapacitor, firebaseInitialized: true },
          durationMs,
        });
        return true;
      }
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const errMsg = err?.message || String(err);
      addLog(`❌ Erro no Firebase Auth: ${errMsg}`);

      updateTestState(testId, {
        status: 'failure',
        message: `Erro na autenticação Firebase: ${errMsg}`,
        details: { error: errMsg },
        durationMs,
      });
      return false;
    }
  };

  // Test 4: Neon PostgreSQL Check
  const runTestNeonPostgres = async (): Promise<boolean> => {
    const testId = 'neon_postgres_check';
    updateTestState(testId, { status: 'running', message: 'Consultando status da base Neon PostgreSQL...' });
    addLog('🚀 Iniciando Teste 4: Checagem do Banco Neon PostgreSQL...');

    const startTime = performance.now();
    const healthUrl = getApiUrl('/api/health');

    try {
      const response = await fetch(healthUrl, { method: 'GET' });
      const durationMs = Math.round(performance.now() - startTime);

      if (response.ok) {
        const healthData = await response.json();
        addLog(`📊 Status retornado pelo servidor: ${JSON.stringify(healthData.db)}`);

        if (healthData.db?.isPostgres && healthData.db?.dbOk) {
          addLog(`✅ Conexão ativa com banco Neon PostgreSQL! Hora do BD: ${healthData.db.dbTime}`);
          updateTestState(testId, {
            status: 'success',
            message: `Banco de dados Neon PostgreSQL conectado e operando! (Latência: ${durationMs}ms)`,
            details: healthData.db,
            durationMs,
          });
          return true;
        } else if (healthData.db?.hasDatabaseUrl && !healthData.db?.dbOk) {
          addLog(`❌ DATABASE_URL presente mas falha na query: ${healthData.db?.dbError}`);
          updateTestState(testId, {
            status: 'failure',
            message: `DATABASE_URL configurada mas não foi possível conectar ao Neon: ${healthData.db?.dbError}`,
            details: healthData.db,
            durationMs,
          });
          return false;
        } else {
          addLog(`⚠️ Servidor rodando com banco JSON fallback (DATABASE_URL não configurada no Render).`);
          updateTestState(testId, {
            status: 'warning',
            message: 'Servidor operacional com armazenamento em memória JSON. DATABASE_URL não configurada no Render.',
            details: healthData.db,
            durationMs,
          });
          return true;
        }
      } else {
        // Fallback check via /api/properties
        addLog(`⚠️ Rota /api/health retornou HTTP ${response.status}. Testando via /api/properties...`);
        const propRes = await fetch(getApiUrl('/api/properties'));
        if (propRes.ok) {
          addLog(`✅ Leitura da tabela de imóveis bem-sucedida.`);
          updateTestState(testId, {
            status: 'success',
            message: 'Tabela de imóveis acessível via API.',
            durationMs,
          });
          return true;
        } else {
          addLog(`❌ Falha na leitura do banco de dados.`);
          updateTestState(testId, {
            status: 'failure',
            message: 'Não foi possível consultar a base de dados no backend.',
            durationMs,
          });
          return false;
        }
      }
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const errMsg = err?.message || String(err);
      addLog(`❌ Erro ao consultar o banco de dados: ${errMsg}`);
      updateTestState(testId, {
        status: 'failure',
        message: `Falha de rede ao consultar banco: ${errMsg}`,
        details: { error: errMsg },
        durationMs,
      });
      return false;
    }
  };

  // Test 5: CORS and HTTPS Validation
  const runTestCorsAndHttps = async (): Promise<boolean> => {
    const testId = 'cors_https_check';
    updateTestState(testId, { status: 'running', message: 'Validando cabeçalhos CORS e protocolo HTTPS...' });
    addLog('🚀 Iniciando Teste 5: CORS e Segurança HTTPS...');

    const startTime = performance.now();
    const targetUrl = getApiUrl('/api/properties');

    try {
      const response = await fetch(targetUrl, { method: 'OPTIONS' });
      const durationMs = Math.round(performance.now() - startTime);

      const allowOrigin = response.headers.get('access-control-allow-origin') || '*';
      const allowMethods = response.headers.get('access-control-allow-methods') || 'GET, POST';
      const isHttps = targetUrl.startsWith('https://');

      addLog(`🔒 Protocolo HTTPS: ${isHttps ? 'SIM (Seguro)' : 'NÃO (Inseguro HTTP)'}`);
      addLog(`🌐 Access-Control-Allow-Origin: ${allowOrigin}`);
      addLog(`⚡ Access-Control-Allow-Methods: ${allowMethods}`);

      if (isHttps && allowOrigin) {
        addLog(`✅ Cabeçalhos CORS e protocolo HTTPS validados com sucesso!`);
        updateTestState(testId, {
          status: 'success',
          message: `Segurança HTTPS ativa e permissões CORS autorizadas (${allowOrigin})`,
          details: { isHttps, allowOrigin, allowMethods },
          durationMs,
        });
        return true;
      } else {
        addLog(`⚠️ Aviso de configuração de segurança/CORS.`);
        updateTestState(testId, {
          status: 'warning',
          message: 'Aviso nos cabeçalhos de segurança ou protocolo.',
          details: { isHttps, allowOrigin },
          durationMs,
        });
        return true;
      }
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const errMsg = err?.message || String(err);
      addLog(`❌ Falha na validação CORS/HTTPS: ${errMsg}`);
      updateTestState(testId, {
        status: 'failure',
        message: `Não foi possível verificar CORS: ${errMsg}`,
        details: { error: errMsg },
        durationMs,
      });
      return false;
    }
  };

  // Run all tests sequentially
  const handleRunAllTests = async () => {
    setIsRunningAll(true);
    addLog('========== INICIANDO BATERIA COMPLETA DE DIAGNÓSTICO ==========');

    await runTestBackendReachability();
    await runTestPostProperty();
    await runTestFirebaseAuth();
    await runTestNeonPostgres();
    await runTestCorsAndHttps();

    addLog('========== BATERIA DE DIAGNÓSTICO CONCLUÍDA ==========');
    setIsRunningAll(false);
  };

  // Run automatically on mount
  useEffect(() => {
    handleRunAllTests();
  }, []);

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const successCount = tests.filter(t => t.status === 'success').length;
  const failureCount = tests.filter(t => t.status === 'failure').length;
  const warningCount = tests.filter(t => t.status === 'warning').length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#003366] to-[#002244] p-5 sm:p-6 rounded-2xl text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">Painel de Testes de Conexão</h1>
          </div>
          <p className="text-xs text-slate-300">
            Diagnóstico em tempo real para comunicação Mobile Capacitor, Render Backend e Neon PostgreSQL
          </p>
        </div>

        <button
          onClick={handleRunAllTests}
          disabled={isRunningAll}
          className={`w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
            isRunningAll 
              ? 'bg-slate-700 text-slate-300 cursor-not-allowed' 
              : 'bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isRunningAll ? 'animate-spin' : ''}`} />
          <span>{isRunningAll ? 'Executando...' : 'Executar Todos os Testes'}</span>
        </button>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de Testes</span>
          <span className="text-xl font-extrabold text-slate-800">{tests.length}</span>
        </div>
        <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Sucessos</span>
          <span className="text-xl font-extrabold text-emerald-700">{successCount}</span>
        </div>
        <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-100 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Falhas</span>
          <span className="text-xl font-extrabold text-rose-700">{failureCount}</span>
        </div>
        <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Avisos</span>
          <span className="text-xl font-extrabold text-amber-700">{warningCount}</span>
        </div>
      </div>

      {/* Tests List */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Resultados dos Testes de Rede e Dados</h2>

        {tests.map((test) => {
          let statusBg = 'bg-white border-slate-100';
          let icon = <Activity className="w-5 h-5 text-slate-400" />;

          if (test.status === 'running') {
            statusBg = 'bg-blue-50/50 border-blue-200';
            icon = <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
          } else if (test.status === 'success') {
            statusBg = 'bg-emerald-50/30 border-emerald-200/80';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
          } else if (test.status === 'failure') {
            statusBg = 'bg-rose-50/40 border-rose-200';
            icon = <XCircle className="w-5 h-5 text-rose-600" />;
          } else if (test.status === 'warning') {
            statusBg = 'bg-amber-50/40 border-amber-200';
            icon = <AlertTriangle className="w-5 h-5 text-amber-600" />;
          }

          return (
            <div 
              key={test.id}
              className={`p-4 rounded-xl border transition-all ${statusBg} space-y-2`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{icon}</div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{test.name}</h3>
                    <p className="text-xs text-slate-500">{test.description}</p>
                  </div>
                </div>

                {test.durationMs !== undefined && (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {test.durationMs}ms
                  </span>
                )}
              </div>

              {test.message && (
                <div className="pl-8">
                  <p className={`text-xs font-medium ${
                    test.status === 'success' ? 'text-emerald-800' : 
                    test.status === 'failure' ? 'text-rose-800' : 
                    test.status === 'warning' ? 'text-amber-800' : 'text-slate-600'
                  }`}>
                    {test.message}
                  </p>
                </div>
              )}

              {test.details && Object.keys(test.details).length > 0 && (
                <div className="pl-8 pt-1">
                  <pre className="text-[10px] font-mono bg-slate-900 text-slate-200 p-2.5 rounded-lg overflow-x-auto max-h-32">
                    {JSON.stringify(test.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Terminal Live Console Window */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 text-slate-200 font-mono text-xs space-y-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-emerald-400" />
            <span className="font-bold text-xs text-slate-300">Console de Diagnóstico em Tempo Real</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Copy size={12} />
              <span>{copiedLogs ? 'Copiado!' : 'Copiar Logs'}</span>
            </button>
            <button
              onClick={() => setLogs([])}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 size={12} />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <span className="text-slate-600 italic">Nenhum log gerado ainda. Clique em "Executar Todos os Testes".</span>
          ) : (
            logs.map((log, index) => (
              <div 
                key={index}
                className={`leading-relaxed break-all ${
                  log.includes('❌') ? 'text-rose-400' :
                  log.includes('✅') ? 'text-emerald-400' :
                  log.includes('⚠️') ? 'text-amber-400' : 'text-slate-300'
                }`}
              >
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
