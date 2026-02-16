// /**
//  * ReplayTimeline — Visual timeline scrubber for Chat Replay
//  * Shows a minimap of the conversation with event markers and silence gaps.
//  */

// import { useMemo } from 'react';
// import {
//   Clock, ArrowRightLeft, X as XIcon, Tag, MessageSquare,
//   Star, AlertTriangle, Shield, Workflow, UserCheck, RotateCcw,
// } from 'lucide-react';
// import type { ReplayTimelineItem } from '../hooks/useReplayEngine';
// import { SILENCE_THRESHOLD, formatDuration } from '../hooks/useReplayEngine';

// interface ReplayTimelineProps {
//   timeline: ReplayTimelineItem[];
//   currentIndex: number;
//   onSeek: (index: number) => void;
// }

// const EVENT_ICONS: Record<string, typeof Clock> = {
//   session_created: MessageSquare,
//   session_assigned: UserCheck,
//   session_transferred: ArrowRightLeft,
//   session_closed: XIcon,
//   session_reopened: RotateCcw,
//   session_queued: Clock,
//   tag_added: Tag,
//   tag_removed: Tag,
//   category_changed: Tag,
//   priority_changed: AlertTriangle,
//   rating_received: Star,
//   rule_triggered: Workflow,
//   user_blocked: Shield,
//   first_response: Clock,
//   sla_warning: AlertTriangle,
//   sla_breached: AlertTriangle,
//   note_added: MessageSquare,
//   whisper_sent: MessageSquare,
// };

// const EVENT_COLORS: Record<string, string> = {
//   session_created: 'bg-blue-500',
//   session_assigned: 'bg-emerald-500',
//   session_transferred: 'bg-amber-500',
//   session_closed: 'bg-red-500',
//   session_reopened: 'bg-cyan-500',
//   session_queued: 'bg-zinc-500',
//   tag_added: 'bg-purple-500',
//   tag_removed: 'bg-purple-400',
//   category_changed: 'bg-purple-500',
//   priority_changed: 'bg-orange-500',
//   rating_received: 'bg-yellow-500',
//   rule_triggered: 'bg-indigo-500',
//   sla_warning: 'bg-amber-500',
//   sla_breached: 'bg-red-500',
//   note_added: 'bg-zinc-500',
//   whisper_sent: 'bg-violet-500',
// };

// export default function ReplayTimeline({ timeline, currentIndex, onSeek }: ReplayTimelineProps) {
//   // Compute time range
//   const timeRange = useMemo(() => {
//     if (timeline.length < 2) return { start: 0, end: 1, duration: 1 };
//     const start = new Date(timeline[0].timestamp).getTime();
//     const end = new Date(timeline[timeline.length - 1].timestamp).getTime();
//     return { start, end, duration: Math.max(end - start, 1) };
//   }, [timeline]);

//   // Silence blocks
//   const silenceBlocks = useMemo(() => {
//     const blocks: { startPercent: number; widthPercent: number; durationMs: number; afterIndex: number }[] = [];
//     for (let i = 1; i < timeline.length; i++) {
//       const prev = new Date(timeline[i - 1].timestamp).getTime();
//       const curr = new Date(timeline[i].timestamp).getTime();
//       const gap = curr - prev;
//       if (gap >= SILENCE_THRESHOLD) {
//         const startPercent = ((prev - timeRange.start) / timeRange.duration) * 100;
//         const widthPercent = (gap / timeRange.duration) * 100;
//         blocks.push({ startPercent, widthPercent: Math.max(widthPercent, 0.5), durationMs: gap, afterIndex: i - 1 });
//       }
//     }
//     return blocks;
//   }, [timeline, timeRange]);

//   // Event markers (only events, not messages)
//   const eventMarkers = useMemo(() => {
//     return timeline
//       .map((item, index) => ({ item, index }))
//       .filter(({ item }) => item.kind === 'event')
//       .map(({ item, index }) => {
//         const t = new Date(item.timestamp).getTime();
//         const percent = ((t - timeRange.start) / timeRange.duration) * 100;
//         return { item, index, percent };
//       });
//   }, [timeline, timeRange]);

//   // Progress position
//   const progressPercent = useMemo(() => {
//     if (currentIndex < 0 || timeline.length === 0) return 0;
//     const idx = Math.min(currentIndex, timeline.length - 1);
//     const t = new Date(timeline[idx].timestamp).getTime();
//     return ((t - timeRange.start) / timeRange.duration) * 100;
//   }, [currentIndex, timeline, timeRange]);

//   const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
//     const rect = e.currentTarget.getBoundingClientRect();
//     const x = e.clientX - rect.left;
//     const percent = x / rect.width;
//     const targetTime = timeRange.start + percent * timeRange.duration;

//     // Find closest timeline item
//     let closest = 0;
//     let minDiff = Infinity;
//     for (let i = 0; i < timeline.length; i++) {
//       const t = new Date(timeline[i].timestamp).getTime();
//       const diff = Math.abs(t - targetTime);
//       if (diff < minDiff) {
//         minDiff = diff;
//         closest = i;
//       }
//     }
//     onSeek(closest);
//   };

//   if (timeline.length === 0) return null;

//   return (
//     <div className="space-y-2">
//       {/* Scrubber bar */}
//       <div
//         className="relative h-8 bg-zinc-900 border border-zinc-700/50 rounded-lg cursor-pointer group overflow-hidden"
//         onClick={handleBarClick}
//       >
//         {/* Message density track */}
//         <div className="absolute inset-0">
//           {timeline.map((item, i) => {
//             if (item.kind !== 'message') return null;
//             const t = new Date(item.timestamp).getTime();
//             const percent = ((t - timeRange.start) / timeRange.duration) * 100;
//             const color = item.sender === 'user' ? 'bg-blue-500/40' :
//                           item.sender === 'agent' ? 'bg-emerald-500/40' :
//                           item.sender === 'bot' ? 'bg-purple-500/40' : 'bg-zinc-600/40';
//             return (
//               <div
//                 key={i}
//                 className={`absolute top-0 h-full ${color}`}
//                 style={{ left: `${percent}%`, width: '2px' }}
//               />
//             );
//           })}
//         </div>

//         {/* Silence blocks */}
//         {silenceBlocks.map((block, i) => (
//           <div
//             key={`silence-${i}`}
//             className="absolute top-0 h-full bg-amber-500/10 border-x border-amber-500/20"
//             style={{ left: `${block.startPercent}%`, width: `${block.widthPercent}%` }}
//             title={`Silencio: ${formatDuration(block.durationMs)}`}
//           />
//         ))}

//         {/* Event markers */}
//         {eventMarkers.map(({ item, index, percent }) => {
//           const colorClass = EVENT_COLORS[item.eventAction || ''] || 'bg-zinc-500';
//           return (
//             <div
//               key={`evt-${index}`}
//               className={`absolute top-1 bottom-1 w-1.5 rounded-full ${colorClass} opacity-80 hover:opacity-100 transition-opacity z-10`}
//               style={{ left: `${percent}%` }}
//               title={item.eventDescription || item.eventAction}
//               onClick={(e) => { e.stopPropagation(); onSeek(index); }}
//             />
//           );
//         })}

//         {/* Playback progress */}
//         <div
//           className="absolute top-0 h-full bg-white/10 transition-[width] duration-150"
//           style={{ width: `${progressPercent}%` }}
//         />

//         {/* Playhead */}
//         <div
//           className="absolute top-0 h-full w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)] z-20 transition-[left] duration-150"
//           style={{ left: `${progressPercent}%` }}
//         />
//       </div>

//       {/* Legend */}
//       <div className="flex items-center gap-4 text-[10px] text-zinc-500 px-1">
//         <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500/60 inline-block" /> Usuario</span>
//         <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500/60 inline-block" /> Agente</span>
//         <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500/60 inline-block" /> Bot</span>
//         <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500/30 inline-block border border-amber-500/40" /> Silencio</span>
//         {eventMarkers.length > 0 && (
//           <span className="flex items-center gap-1 ml-auto">
//             {eventMarkers.length} eventos
//           </span>
//         )}
//       </div>
//     </div>
//   );
// }

// // ============= EVENT PILL (used by ChatReplayModal) =============

// interface EventPillProps {
//   item: ReplayTimelineItem;
//   animate?: boolean;
// }

// export function EventPill({ item, animate }: EventPillProps) {
//   const IconComp = EVENT_ICONS[item.eventAction || ''] || Clock;
//   const colorBg = EVENT_COLORS[item.eventAction || ''] || 'bg-zinc-600';

//   return (
//     <div className={`flex justify-center my-3 ${animate ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''}`}>
//       <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-zinc-800/80 border border-zinc-700/50 backdrop-blur-sm max-w-[80%]">
//         <div className={`w-5 h-5 rounded-full ${colorBg} flex items-center justify-center flex-shrink-0`}>
//           <IconComp className="w-3 h-3 text-zinc-50" />
//         </div>
//         <span className="text-xs text-zinc-400 truncate">{item.eventDescription || item.eventAction}</span>
//         <span className="text-[10px] text-zinc-600 flex-shrink-0">
//           {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
//         </span>
//       </div>
//     </div>
//   );
// }

// // ============= SILENCE BLOCK (used by ChatReplayModal) =============

// interface SilenceBlockProps {
//   durationMs: number;
//   animate?: boolean;
// }

// export function SilenceBlock({ durationMs, animate }: SilenceBlockProps) {
//   return (
//     <div className={`flex justify-center my-4 ${animate ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''}`}>
//       <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 backdrop-blur-sm">
//         <Clock className="w-4 h-4 text-amber-500/70" />
//         <span className="text-sm font-medium text-amber-400/80">
//           Silencio durante {formatDuration(durationMs)}
//         </span>
//       </div>
//     </div>
//   );
// }

/**
 * ReplayTimeline - Premium Zinc Refactor
 * Professional video-editor style timeline scrubber and event markers.
 */

import { useMemo } from 'react';
import {
  Clock, ArrowRightLeft, X as XIcon, Tag, MessageSquare,
  Star, AlertTriangle, Shield, Workflow, UserCheck, RotateCcw,
  PauseCircle, Info
} from 'lucide-react';
import type { ReplayTimelineItem } from '../hooks/useReplayEngine';
import { SILENCE_THRESHOLD, formatDuration } from '../hooks/useReplayEngine';

// ============= CONFIGURATION =============

interface ReplayTimelineProps {
  timeline: ReplayTimelineItem[];
  currentIndex: number;
  onSeek: (index: number) => void;
}

const EVENT_CONFIG: Record<string, { icon: any; color: string; dotColor: string }> = {
  session_created:    { icon: MessageSquare, color: 'text-blue-400', dotColor: 'bg-blue-500' },
  session_assigned:   { icon: UserCheck,     color: 'text-emerald-400', dotColor: 'bg-emerald-500' },
  session_transferred:{ icon: ArrowRightLeft,color: 'text-orange-400', dotColor: 'bg-orange-500' },
  session_closed:     { icon: XIcon,         color: 'text-red-400', dotColor: 'bg-red-500' },
  session_reopened:   { icon: RotateCcw,     color: 'text-cyan-400', dotColor: 'bg-cyan-500' },
  session_queued:     { icon: Clock,         color: 'text-zinc-400', dotColor: 'bg-zinc-500' },
  tag_added:          { icon: Tag,           color: 'text-purple-400', dotColor: 'bg-purple-500' },
  category_changed:   { icon: Tag,           color: 'text-pink-400', dotColor: 'bg-pink-500' },
  priority_changed:   { icon: AlertTriangle, color: 'text-amber-400', dotColor: 'bg-amber-500' },
  rating_received:    { icon: Star,          color: 'text-yellow-400', dotColor: 'bg-yellow-500' },
  rule_triggered:     { icon: Workflow,      color: 'text-indigo-400', dotColor: 'bg-indigo-500' },
  sla_breached:       { icon: AlertTriangle, color: 'text-red-500', dotColor: 'bg-red-600' },
  whisper_sent:       { icon: MessageSquare, color: 'text-violet-400', dotColor: 'bg-violet-500' },
  default:            { icon: Info,          color: 'text-zinc-400', dotColor: 'bg-zinc-500' }
};

// ============= MAIN COMPONENT: TIMELINE SCRUBBER =============

export default function ReplayTimeline({ timeline, currentIndex, onSeek }: ReplayTimelineProps) {
  
  // Logic: Calculate Time Range
  const timeRange = useMemo(() => {
    if (timeline.length < 2) return { start: 0, end: 1, duration: 1 };
    const start = new Date(timeline[0].timestamp).getTime();
    const end = new Date(timeline[timeline.length - 1].timestamp).getTime();
    return { start, end, duration: Math.max(end - start, 1) };
  }, [timeline]);

  // Logic: Identify Silence Blocks
  const silenceBlocks = useMemo(() => {
    const blocks: { startPercent: number; widthPercent: number; durationMs: number; afterIndex: number }[] = [];
    for (let i = 1; i < timeline.length; i++) {
      const prev = new Date(timeline[i - 1].timestamp).getTime();
      const curr = new Date(timeline[i].timestamp).getTime();
      const gap = curr - prev;
      if (gap >= SILENCE_THRESHOLD) {
        const startPercent = ((prev - timeRange.start) / timeRange.duration) * 100;
        const widthPercent = (gap / timeRange.duration) * 100;
        blocks.push({ startPercent, widthPercent: Math.max(widthPercent, 0.5), durationMs: gap, afterIndex: i - 1 });
      }
    }
    return blocks;
  }, [timeline, timeRange]);

  // Logic: Identify Events
  const eventMarkers = useMemo(() => {
    return timeline
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.kind === 'event')
      .map(({ item, index }) => {
        const t = new Date(item.timestamp).getTime();
        const percent = ((t - timeRange.start) / timeRange.duration) * 100;
        return { item, index, percent };
      });
  }, [timeline, timeRange]);

  // Logic: Current Progress
  const progressPercent = useMemo(() => {
    if (currentIndex < 0 || timeline.length === 0) return 0;
    const idx = Math.min(currentIndex, timeline.length - 1);
    const t = new Date(timeline[idx].timestamp).getTime();
    return ((t - timeRange.start) / timeRange.duration) * 100;
  }, [currentIndex, timeline, timeRange]);

  // Interaction Handler
  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const targetTime = timeRange.start + percent * timeRange.duration;

    // Find closest item
    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < timeline.length; i++) {
      const t = new Date(timeline[i].timestamp).getTime();
      const diff = Math.abs(t - targetTime);
      if (diff < minDiff) { minDiff = diff; closest = i; }
    }
    onSeek(closest);
  };

  if (timeline.length === 0) return null;

  return (
    <div className="space-y-3 select-none">
      
      {/* === SCRUBBER TRACK === */}
      <div 
        className="relative h-10 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer group overflow-hidden shadow-inner ring-1 ring-black/50"
        onClick={handleBarClick}
      >
        {/* 1. Background Grid (Decoration) */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20%_100%] pointer-events-none" />

        {/* 2. Message Density Lines */}
        <div className="absolute inset-0 top-2 bottom-2">
          {timeline.map((item, i) => {
            if (item.kind !== 'message') return null;
            const t = new Date(item.timestamp).getTime();
            const percent = ((t - timeRange.start) / timeRange.duration) * 100;
            
            // Colors for density lines
            const bgClass = item.sender === 'user' ? 'bg-blue-500' :
                            item.sender === 'agent' ? 'bg-emerald-500' :
                            item.sender === 'bot' ? 'bg-purple-500' : 'bg-zinc-600';
            
            return (
              <div
                key={i}
                className={`absolute top-0 bottom-0 w-[2px] ${bgClass} opacity-30 group-hover:opacity-50 transition-opacity`}
                style={{ left: `${percent}%` }}
              />
            );
          })}
        </div>

        {/* 3. Silence Blocks (Striped Areas) */}
        {silenceBlocks.map((block, i) => (
          <div
            key={`silence-${i}`}
            className="absolute top-0 bottom-0 bg-amber-500/5 border-x border-amber-500/10"
            style={{ 
              left: `${block.startPercent}%`, 
              width: `${block.widthPercent}%`,
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(245, 158, 11, 0.05) 5px, rgba(245, 158, 11, 0.05) 10px)'
            }}
            title={`Silencio: ${formatDuration(block.durationMs)}`}
          />
        ))}

        {/* 4. Event Markers (Dots) */}
        {eventMarkers.map(({ item, index, percent }) => {
          const conf = EVENT_CONFIG[item.eventAction || ''] || EVENT_CONFIG.default;
          return (
            <div
              key={`evt-${index}`}
              className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${conf.dotColor} z-10 hover:scale-150 transition-transform cursor-pointer shadow-[0_0_8px_rgba(0,0,0,0.5)] border border-black/50`}
              style={{ left: `${percent}%` }}
              title={`${item.eventDescription || item.eventAction} - Click para saltar`}
              onClick={(e) => { e.stopPropagation(); onSeek(index); }}
            />
          );
        })}

        {/* 5. Progress Fill (Played Portion) */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-white/5 pointer-events-none transition-[width] duration-75 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />

        {/* 6. Playhead (Cursor) */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.8)] z-20 pointer-events-none transition-[left] duration-75 ease-linear"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-indigo-500 rounded-full border-2 border-zinc-950" />
        </div>
      </div>

      {/* === LEGEND === */}
      <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-medium px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500/50" /> Usuario
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500/50" /> Agente
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-purple-500/50" /> Bot
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded bg-amber-500/20 border border-amber-500/30" /> Silencio
        </div>
        {eventMarkers.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-white/50" /> {eventMarkers.length} Eventos
          </div>
        )}
      </div>
    </div>
  );
}

// ============= SUB-COMPONENT: EVENT PILL =============

export function EventPill({ item, animate }: { item: ReplayTimelineItem; animate?: boolean }) {
  const conf = EVENT_CONFIG[item.eventAction || ''] || EVENT_CONFIG.default;
  const Icon = conf.icon;

  return (
    <div className={`flex justify-center my-4 ${animate ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/80 border border-zinc-800 rounded-full backdrop-blur-md shadow-sm max-w-[85%]">
        
        {/* Icon Circle */}
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-zinc-800 border border-zinc-700 ${conf.color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        
        {/* Text */}
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-zinc-300 font-medium truncate">
            {item.eventDescription || item.eventAction}
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============= SUB-COMPONENT: SILENCE BLOCK =============

export function SilenceBlock({ durationMs, animate }: { durationMs: number; animate?: boolean }) {
  return (
    <div className={`flex justify-center my-6 ${animate ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''}`}>
      <div className="group flex items-center gap-3 px-5 py-2.5 rounded-xl border border-dashed border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-help">
        <PauseCircle className="w-4 h-4 text-amber-500/50 group-hover:text-amber-500 transition-colors" />
        <span className="text-xs font-mono font-medium text-amber-500/60 group-hover:text-amber-500 transition-colors">
          Inactividad: {formatDuration(durationMs)}
        </span>
      </div>
    </div>
  );
}