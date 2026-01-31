// {/* Messages Area */}
// <div
//   ref={messagesContainerRef}
//   onScroll={handleScroll}
//   className="flex-1 overflow-y-auto px-4 py-4 space-y-6 bg-zinc-950 scroll-smooth custom-scrollbar relative"
// >
  
//   {/* 1. Load More Button */}
//   {hasMoreMessages && (
//     <div className="flex justify-center pt-2 pb-6">
//       {isLoadingOlderMessages ? (
//         <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-full border border-zinc-800 text-xs text-zinc-400">
//           <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
//           <span>Cargando historial...</span>
//         </div>
//       ) : (
//         <button
//           onClick={loadOlderMessages}
//           className="group flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all shadow-sm"
//         >
//           <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-indigo-500 transition-colors" />
//           Cargar mensajes anteriores
//         </button>
//       )}
//     </div>
//   )}

//   {/* 2. Pinned Message (Floating Glass) */}
//   {pinnedMessage && (
//     <div className="sticky top-0 z-20 -mx-2 px-2 pb-4">
//       <div className="flex items-center gap-3 p-3 bg-zinc-900/90 backdrop-blur-md border border-indigo-500/20 rounded-xl shadow-xl shadow-black/20 ring-1 ring-black/5 animate-in slide-in-from-top-2 duration-300">
//         <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0">
//           <Pin className="w-4 h-4 text-indigo-400" />
//         </div>

//         <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleScrollToMessage(pinnedMessage._id)}>
//           <p className="text-sm text-zinc-100 font-medium truncate">
//             {pinnedMessage.content}
//           </p>
//           <div className="flex items-center gap-1.5 mt-0.5">
//             <span className="text-[10px] font-boldtext-zinc-500">
//               {pinnedMessage.senderAgent?.name || (pinnedMessage.sender === 'user' ? 'Usuario' : 'Bot')}
//             </span>
//             <span className="w-0.5 h-0.5 bg-zinc-600 rounded-full" />
//             <span className="text-[10px] text-zinc-600">Fijado</span>
//           </div>
//         </div>

//         <button
//           onClick={(e) => { e.stopPropagation(); handleUnpin(pinnedMessage); }}
//           className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
//           title="Desfijar"
//         >
//           <X className="w-4 h-4" />
//         </button>
//       </div>
//     </div>
//   )}

//   {/* 3. Whispers (Supervisors) */}
//   {sessionWhispers.length > 0 && (
//     <div className="mb-6 animate-in fade-in zoom-in-95 duration-300">
//       <WhisperDisplay
//         sessionId={session.sessionId}
//         whispers={sessionWhispers.map(w => ({
//           _id: w.id,
//           sessionId: w.sessionId,
//           fromSupervisor: { _id: w.supervisorId, name: w.supervisorName },
//           message: w.content,
//           isRead: w.isRead,
//           createdAt: w.createdAt.toString(),
//         }))}
//         onMarkAsRead={handleWhisperRead}
//       />
//     </div>
//   )}

//   {/* 4. Messages State Handling */}
//   {isLoadingMessages ? (
//     <div className="flex flex-col items-center justify-center h-[60vh] gap-3 opacity-60">
//       <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
//       <span className="text-sm text-zinc-500 font-medium">Sincronizando conversación...</span>
//     </div>
//   ) : messages.length === 0 ? (
//     <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 select-none opacity-50">
//       <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
//         <MessageSquare className="w-8 h-8 text-zinc-700" />
//       </div>
//       <p className="text-sm font-medium text-zinc-400">Sin mensajes</p>
//       <p className="text-xs text-zinc-600 mt-1">La conversación está vacía</p>
//     </div>
//   ) : (
//     <div className="space-y-1"> {/* Reduced vertical spacing for chat density */}
//       {messages.map((msg, index) => {
//         const prev = messages[index - 1];
//         // Calculate date separator
//         const showDate = !prev || new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
        
//         // Calculate grouping (same sender within short time)
//         const isGroupStart = !prev || prev.sender !== msg.sender || (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 60000);
//         const isGroupEnd = !messages[index + 1] || messages[index + 1].sender !== msg.sender || (new Date(messages[index + 1].createdAt).getTime() - new Date(msg.createdAt).getTime() > 60000);

//         return (
//           <React.Fragment key={msg._id}>
//             {showDate && (
//               <div className="flex justify-center py-6">
//                 <span className="px-3 py-1 bg-zinc-900/50 border border-zinc-800 rounded-full text-[10px] font-medium text-zinc-500 tracking-widest shadow-sm">
//                   {new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
//                 </span>
//               </div>
//             )}
            
//             <div className={`${isGroupStart ? 'mt-3' : 'mt-0.5'}`}> {/* Visual grouping logic */}
//               <MessageBubble
//                 message={msg}
//                 onContextMenu={(e) => handleMessageClick(msg, e)}
//                 isPinned={pinnedMessage?._id === msg._id}
//                 isHighlighted={highlightedMessageId === msg._id}
//                 session={session}
//                 isGroupStart={isGroupStart}
//                 isGroupEnd={isGroupEnd}
//               />
//             </div>
//           </React.Fragment>
//         );
//       })}
//     </div>
//   )}

//   {/* 5. Typing Indicator */}
//   {isUserTyping && (
//     <div className="pl-4 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
//       <TypingIndicator name={session.user.firstName} />
//     </div>
//   )}

//   {/* 6. Closed Session Survey */}
//   {isClosed && survey && (
//     <div className="mt-8 mb-4 px-4 sm:px-12 animate-in slide-in-from-bottom-4 duration-500">
//       <div className="relative">
//         <div className="absolute inset-0 flex items-center" aria-hidden="true">
//           <div className="w-full border-t border-zinc-800"></div>
//         </div>
//         <div className="relative flex justify-center mb-6">
//           <span className="px-3 bg-zinc-950 text-xs font-medium text-zinc-500 ">
//             Conversación Finalizada
//           </span>
//         </div>
//       </div>
//       <SurveyDisplay survey={survey as any} />
//     </div>
//   )}

//   <div ref={messagesEndRef} className="h-2" />
// </div>