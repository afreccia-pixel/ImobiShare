import React, { Component, ErrorInfo, ReactNode } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Unhandled exception caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans select-none">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/30">
            <WifiOff size={32} />
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">Conexão Instável ou Offline</h1>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            Não foi possível carregar todos os dados da rede no momento. O ImobiShare continuará funcionando com os imóveis salvos no seu dispositivo.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="flex items-center gap-2 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <RefreshCw size={16} />
            <span>Tentar Novamente</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
