import { MessageCircle, ArrowRight, Inbox, CheckCircle2, MessageSquare } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';

export default function EmptyState() {
  const stats = useChatStore((state) => state.stats);
  const waitingCount = stats?.sessions.waiting || 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in-95 duration-500">
      
      {/* Icon Container - Clean Style (Sin brillo) */}
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-zinc-900 rounded-3xl border border-zinc-800 flex items-center justify-center shadow-xl">
           <MessageSquare className="w-10 h-10 text-zinc-600" strokeWidth={1.5} />
        </div>
        
        {/* Notification Badge */}
        {waitingCount > 0 && (
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center border-4 border-zinc-950 text-zinc-950 font-bold text-xs shadow-lg animate-bounce">
            {waitingCount}
          </div>
        )}
      </div>

      {/* Main Text */}
      <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
        Selecciona una conversación
      </h2>
      
      <p className="text-zinc-500 max-w-sm leading-relaxed mb-8 text-sm">
        Elige un chat de la barra lateral para ver el historial, enviar mensajes o gestionar la información del contacto.
      </p>

      {/* Dynamic Status Pill */}
      {waitingCount > 0 ? (
        <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-500 text-sm font-medium transition-all hover:bg-amber-500/20 cursor-default">
          <Inbox className="w-4 h-4" />
          <span>{waitingCount} {waitingCount === 1 ? 'usuario esperando' : 'usuarios esperando'} atención</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      ) : (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-500 text-xs font-medium cursor-default">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/50" />
          <span>Bandeja al día, buen trabajo</span>
        </div>
      )}

    </div>
  );
}