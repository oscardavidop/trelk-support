import { useState } from 'react';
import {
    MessageSquare,
    MessageCircle,
    ChevronDown,
    ChevronUp,
    Phone,
    Globe,
    Clock,
    User,
    Hash
} from 'lucide-react';

interface ContactProfileHeaderProps {
    contactInfo: any;
}

export default function ContactProfileHeader({ contactInfo }: ContactProfileHeaderProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="border-b border-zinc-800 bg-zinc-950 select-none">

            {/* Header Button */}
            <button
                onClick={() => setIsExpanded(v => !v)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-zinc-900/50 transition-all group"
            >
                {/* Avatar Container */}
                <div className="relative shrink-0">
                    <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center
            text-white text-lg font-bold border border-zinc-800 shadow-xl overflow-hidden
            ${contactInfo.user?.photoFileId
                                ? 'bg-zinc-900'
                                : 'bg-gradient-to-br from-indigo-600 to-purple-700'
                            }`}
                    >
                        {contactInfo.user?.photoFileId ? (
                            <img
                                src={`/api/media/${contactInfo.user.photoFileId}`}
                                alt={contactInfo.user.firstName}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                        ) : (
                            <span>{contactInfo.user.firstName.charAt(0).toUpperCase()}</span>
                        )}
                    </div>

                    {/* Status Indicator */}
                    <div className="absolute bottom-0 right-0 p-0.5 bg-zinc-950 rounded-full">
                        <div
                            className={`w-3.5 h-3.5 rounded-full border-2 border-zinc-950
                ${contactInfo.session.status === 'open'
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                    : 'bg-zinc-500'
                                }`}
                        />
                    </div>
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-white truncate leading-tight group-hover:text-indigo-200 transition-colors">
                        {contactInfo.user.firstName} {contactInfo.user.lastName}
                    </h3>

                    <div className="flex items-center gap-2 mt-1">
                        {contactInfo.user.username ? (
                            <span className="text-xs font-medium text-indigo-400 truncate bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                                @{contactInfo.user.username}
                            </span>
                        ) : (
                            <span className="text-xs text-zinc-500 italic">Sin username</span>
                        )}
                    </div>
                </div>

                {/* Mini Stats & Toggle */}
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400" title="Total Sesiones">
                            <MessageSquare className="w-3 h-3" /> {contactInfo.stats.totalSessions}
                        </div>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400" title="Total Mensajes">
                            <MessageCircle className="w-3 h-3" /> {contactInfo.stats.totalMessages}
                        </div>
                    </div>

                    <div className={`text-zinc-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </div>
            </button>

            {/* Expanded Details Panel */}
            {isExpanded && (
                <div className="px-5 pb-5 pt-5 bg-zinc-900/30 border-t border-zinc-800/50 shadow-inner animate-in slide-in-from-top-1 duration-200">
                    <div className="grid gap-3">

                        <DetailRow
                            icon={Hash}
                            label="ID Usuario"
                            value={contactInfo.user.telegramId}
                            copyable
                        />

                        {contactInfo.user.username && (
                            <div className="flex items-center justify-between text-xs group">
                                <div className="flex items-center gap-2 text-zinc-500">
                                    <Globe className="w-3.5 h-3.5" />
                                    <span>Enlace Directo</span>
                                </div>
                                <a
                                    href={`https://t.me/${contactInfo.user.username}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-400 hover:text-indigo-300 hover:underline font-mono"
                                >
                                    t.me/{contactInfo.user.username}
                                </a>
                            </div>
                        )}

                        {contactInfo.user.phoneNumber && (
                            <DetailRow
                                icon={Phone}
                                label="Teléfono"
                                value={contactInfo.user.phoneNumber}
                                copyable
                            />
                        )}

                        <DetailRow
                            icon={Clock}
                            label="Primer contacto"
                            value={new Date(contactInfo.session.createdAt).toLocaleString()}
                        />

                    </div>
                </div>
            )}
        </div>
    );
}

// Helper Component para filas de detalles
function DetailRow({ icon: Icon, label, value, copyable }: { icon: any, label: string, value: string, copyable?: boolean }) {
    const handleCopy = () => {
        if (copyable) navigator.clipboard.writeText(value);
    };

    return (
        <div
            className={`flex items-center justify-between text-xs group ${copyable ? 'cursor-pointer' : ''}`}
            onClick={handleCopy}
            title={copyable ? 'Click para copiar' : ''}
        >
            <div className="flex items-center gap-2 text-zinc-500 group-hover:text-zinc-400 transition-colors">
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
            </div>
            <span className={`font-mono text-zinc-300 ${copyable ? 'group-hover:text-white group-hover:bg-zinc-800 px-1.5 rounded transition-all' : ''}`}>
                {value}
            </span>
        </div>
    );
}