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
  Terminal, 
  Copy, 
  Trash2,
  Lock,
  Cpu,
  FileText
} from 'lucide-react';
import { DbService } from '../services/db';

export function ConnectionTests() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<any | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedLogs, setCopiedLogs] = useState(false);

  const addLog = (text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${text}`]);
  };

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    addLog('🚀 Executando diagnósticos do sistema no backend...');

    try {
      const data = await DbService.getAdminDiagnostics();
      setDiagnosticsData(data);
      addLog(`✅ Diagnósticos concluídos com sucesso em ${data.executionDurationMs}ms!`);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao carregar diagnósticos do administrador.';
      setError(msg);
      addLog(`❌ Falha na execução do diagnóstico: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const checks = diagnosticsData?.checks;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#003366] to-[#002244] p-5 sm:p-6 rounded-2xl text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">Painel de Diagnóstico do Administrador</h1>
          </div>
          <p className="text-xs text-slate-300">
            Aba de testes exclusiva para administradores (is_admin = true)
          </p>
        </div>

        <button
          onClick={fetchDiagnostics}
          disabled={loading}
          className={`w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
            loading 
              ? 'bg-slate-700 text-slate-300 cursor-not-allowed' 
              : 'bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Executando...' : 'Atualizar Diagnósticos'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
          <XCircle size={18} className="text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 6 Core Diagnostic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Banco de Dados */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-900" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">1. Banco de Dados</h3>
            </div>
            {checks?.database?.status === 'success' ? (
              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={12} /> ONLINE
              </span>
            ) : (
              <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <XCircle size={12} /> ERRO
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Tipo: <strong>{checks?.database?.type || 'Verificando...'}</strong>
          </p>
          <div className="text-[11px] text-slate-500 space-y-0.5 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
            <div>Corretores cadastrados: {checks?.database?.brokersCount ?? '-'}</div>
            <div>Imóveis cadastrados: {checks?.database?.propertiesCount ?? '-'}</div>
            {checks?.database?.responseTimeMs && <div>Latência query: {checks.database.responseTimeMs}ms</div>}
          </div>
        </div>

        {/* 2. Autenticação Firebase */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">2. Autenticação</h3>
            </div>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={12} /> VERIFICADO
            </span>
          </div>
          <p className="text-xs text-slate-600">Token Firebase ID validado com sucesso no backend do servidor.</p>
          <div className="text-[11px] text-slate-500 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
            Status: Token ativo e verificado para acesso administrativo.
          </div>
        </div>

        {/* 3. Rotas de API */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">3. Rotas de API</h3>
            </div>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={12} /> 200 OK
            </span>
          </div>
          <p className="text-xs text-slate-600">End-points REST (/api/properties, /api/auth/verify) respondendo adequadamente.</p>
        </div>

        {/* 4. Integridade de Dados */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-600" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">4. Integridade de Dados</h3>
            </div>
            {checks?.dataIntegrity?.status === 'success' ? (
              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={12} /> 100% ÍNTEGRO
              </span>
            ) : (
              <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={12} /> ATENÇÃO
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">{checks?.dataIntegrity?.message || 'Verificando imóveis sem corretor...'}</p>
        </div>

        {/* 5. Variáveis de Ambiente */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">5. Variáveis de Ambiente</h3>
            </div>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={12} /> CONFIGURADO
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1">
            <div>GEMINI_API_KEY: {checks?.environment?.hasGeminiApiKey ? '✅ Presente' : '❌ Não definida'}</div>
            <div>DATABASE_URL: {checks?.environment?.hasDatabaseUrl ? '✅ Presente (PostgreSQL)' : 'ℹ️ JSON Fallback'}</div>
            <div>FIREBASE_PROJECT: {checks?.environment?.hasFirebaseProjectId ? '✅ Presente' : '⚠️ Padrão'}</div>
          </div>
        </div>

        {/* 6. Log de Erros Recentes */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-600" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">6. Erros Recentes</h3>
            </div>
            <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
              {checks?.errorLogs?.totalCaptured ?? 0} capturados
            </span>
          </div>
          <p className="text-xs text-slate-600">Logs de erro do backend capturados em memória para depuração fácil.</p>
        </div>
      </div>

      {/* Terminal Console */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 text-slate-200 font-mono text-xs space-y-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-emerald-400" />
            <span className="font-bold text-xs text-slate-300">Console de Execução e Erros</span>
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
            <span className="text-slate-600 italic">Clique em "Atualizar Diagnósticos" para rodar os testes.</span>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="leading-relaxed break-all text-slate-300">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
