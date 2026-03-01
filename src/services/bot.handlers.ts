/**
 * Bot Handlers v2
 * Integrated with MongoDB persistence and Socket.IO
 */

import { ConversationState, TicketCategory } from '../config/index.js';
import type { TelegramMessage, TelegramCallbackQuery, Language } from '../types/index.js';
import { sendMessage, editMessage, answerCallbackQuery, resolveFileUrl, sendChatAction } from './telegram.js';
import { 
  getOrCreateUser,
  updateUserLanguage,
} from './user.service.js';
import {
  getOrCreateSession,
  getActiveSessionByTelegramChatId,
  transferToHuman,
  addMessage,
  updateSessionStatus,
} from './chat.service.js';
import { notifyNewSession, notifyNewMessage, notifyNewMediaMessage } from './socket.js';
import {
  triggerChatCreated,
  triggerMessageReceived,
  triggerKeywordDetected,
  triggerFileReceived,
  triggerMessageReceivedNoSession,
  triggerKeywordDetectedNoSession,
  triggerCommandReceivedNoSession,
  handleFlowButtonCallback,
} from './flowTriggers.service.js';
import {
  MESSAGES,
  getMessage,
  getMainMenuKeyboard,
  getFAQMenuKeyboard,
  getTicketCategoryKeyboard,
  getBackKeyboard,
  getLanguageKeyboard,
  getHumanConfirmKeyboard,
  getTicketDoneKeyboard,
  formatTicketConfirmation,
} from '../messages/index.js';
import { logger } from './logger.js';
import { SPAM_PROTECTION } from '../config/index.js';
import { getAutoReplySettings, getBotSettings, isWithinWorkingHours } from './settings-cache.service.js';
import { 
  startInactivityTimer, 
  resetInactivityTimer, 
  closeByUserRequest,
  startQueuedTimer,
  resetQueuedTimer,
} from './inactivity.service.js';
import { isUserBlocked, submitSurvey } from './enterprise.service.js';
import type { IUser } from '../database/index.js';
import type { ReplyKeyboardMarkup, ReplyMarkup } from '../types/index.js';

// ============= LOCAL TYPES =============

interface SendOptions {
  replyMarkup?: ReplyMarkup;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disablePreview?: boolean;
  reply_to_message_id?: number;
}

// ============= DYNAMIC SETTINGS HELPER =============

// Close chat button text (bilingual)
const CLOSE_CHAT_BUTTON = '🔒 Cerrar chat';

// Keyboard shown when user is in human support session
function getHumanSupportKeyboard(): ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: CLOSE_CHAT_BUTTON }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

/**
 * Send message with typing indicator and delay based on settings
 */
async function sendMessageWithTyping(
  chatId: number,
  text: string,
  options?: SendOptions
): Promise<void> {
  const settings = await getAutoReplySettings();
  
  // Show typing indicator if enabled
  if (settings.typingIndicator) {
    await sendChatAction(chatId, 'typing');
  }
  
  // Apply auto-reply delay if enabled
  if (settings.enabled && settings.delay > 0) {
    await new Promise(resolve => setTimeout(resolve, settings.delay));
  }
  
  await sendMessage(chatId, text, options);
}

async function getBotMessage(key: 'welcome' | 'transfer' | 'offline', lang: Language): Promise<string> {
  const settings = await getBotSettings();
  
  switch (key) {
    case 'welcome':
      return settings.welcomeMessage || getMessage('welcome', lang);
    case 'transfer':
      return settings.transferMessage || getMessage('humanConfirm', lang);
    case 'offline':
      return settings.offlineMessage || getMessage('error', lang);
    default:
      return '';
  }
}

// ============= IN-MEMORY STATE (for conversation flow) =============
// MongoDB stores persistent data, this is for temporary conversation state

interface ConversationContext {
  state: ConversationState;
  ticketCategory?: TicketCategory;
  lastActivity: number;
}

const conversationContexts = new Map<number, ConversationContext>();

function getContext(chatId: number): ConversationContext {
  let ctx = conversationContexts.get(chatId);
  if (!ctx) {
    ctx = { state: ConversationState.IDLE, lastActivity: Date.now() };
    conversationContexts.set(chatId, ctx);
  }
  ctx.lastActivity = Date.now();
  return ctx;
}

function updateContext(chatId: number, updates: Partial<ConversationContext>): void {
  const ctx = getContext(chatId);
  Object.assign(ctx, updates);
}

function resetContext(chatId: number): void {
  conversationContexts.set(chatId, { state: ConversationState.IDLE, lastActivity: Date.now() });
}

// ============= RATE LIMITING =============

const rateLimits = new Map<number, { count: number; lastMessage: number }>();

function checkRateLimit(chatId: number): { allowed: boolean; tooFast: boolean } {
  const now = Date.now();
  let limit = rateLimits.get(chatId);
  
  if (!limit) {
    limit = { count: 1, lastMessage: now };
    rateLimits.set(chatId, limit);
    return { allowed: true, tooFast: false };
  }
  
  // Too fast (spam)
  if (now - limit.lastMessage < 500) {
    return { allowed: false, tooFast: true };
  }
  
  // Reset counter after 1 minute
  if (now - limit.lastMessage > 60000) {
    limit.count = 0;
  }
  
  limit.count++;
  limit.lastMessage = now;
  
  // Rate limit: 30 messages per minute
  if (limit.count > 30) {
    return { allowed: false, tooFast: false };
  }
  
  return { allowed: true, tooFast: false };
}

// ============= COMMAND HANDLERS =============

const COMMANDS: Record<string, (msg: TelegramMessage, user: IUser) => Promise<void>> = {
  '/start': handleStart,
  '/help': handleHelp,
  '/faq': handleFAQ,
  '/ticket': handleTicket,
  '/human': handleHuman,
  '/language': handleLanguage,
  '/cancel': handleCancel,
};

/**
 * Handle incoming message (text + multimedia)
 */
export async function handleMessage(message: TelegramMessage): Promise<void> {
  const { from, chat, text, photo, document, voice, audio, sticker, caption } = message;
  
  // Check if it's a valid message type
  const hasContent = text || photo || document || voice || audio || sticker;
  
  if (!from || chat.type !== 'private') {
    if (chat.type !== 'private' && from) {
      await sendMessage(chat.id, getMessage('privateChatOnly', 'en'));
    }
    return;
  }
  
  if (!hasContent) {
    return; // Ignore messages without content
  }
  
  // Get or create user in MongoDB
  const user = await getOrCreateUser(from, chat.id);
  const lang = user.language;
  
  // Check if user is blocked
  const blockStatus = await isUserBlocked(from.id);
  // if (blockStatus.blocked) {
  //   const blockedMessage = lang === 'es'
  //     ? '🚫 Tu cuenta ha sido bloqueada temporalmente. Si crees que esto es un error, contacta con soporte por otro medio.'
  //     : '🚫 Your account has been temporarily blocked. If you believe this is an error, please contact support through another channel.';
  //   await sendMessage(chat.id, blockedMessage);
  //   return;
  // }
  
  // Rate limiting
  const rateCheck = checkRateLimit(chat.id);
  if (!rateCheck.allowed) {
    if (rateCheck.tooFast) {
      return; // Silently ignore very fast messages
    }
    await sendMessage(chat.id, getMessage('rateLimited', lang));
    return;
  }
  
  // Check message length (only for text)
  if (text && text.length > SPAM_PROTECTION.maxMessageLength) {
    await sendMessage(chat.id, getMessage('messageTooLong', lang));
    return;
  }
  
  // Check if user is in a human support session
  const activeSession = await getActiveSessionByTelegramChatId(chat.id);
  if (activeSession && (activeSession.status === 'waiting' || activeSession.status === 'human')) {
    
    // Check if user clicked "Close chat" button
    if (text === CLOSE_CHAT_BUTTON) {
      await closeByUserRequest(activeSession.sessionId, chat.id);
      
      const closeMessage = '✅ El chat ha sido cerrado. Gracias por contactar con Trelk Support.'
      
      await sendMessage(chat.id, closeMessage, {
        replyMarkup: { remove_keyboard: true },
      });
      
      logger.info('chat', { action: 'closed_by_user', sessionId: activeSession.sessionId });
      return;
    }
    
    // Handle multimedia messages
    if (photo || document || voice || audio || sticker) {
      await handleUserMediaMessage(
        activeSession.sessionId,
        message,
        lang
      );
      
      // Trigger flow: file received
      const fileType = photo ? 'photo' : document ? 'document' : voice ? 'voice' : audio ? 'audio' : 'sticker';
      await triggerFileReceived(activeSession, { 
        type: fileType, 
        caption: caption || undefined,
      });
      
      // Reset inactivity timer
      if (activeSession.status === 'human') {
        await resetInactivityTimer(activeSession.sessionId);
      }
      
      if (activeSession.status === 'waiting') {
        // Reset queued timer when user sends message
        await resetQueuedTimer(activeSession.sessionId);
        await sendMessage(
          chat.id, 
          lang === 'en' 
            ? '📝 Message received. A support agent will respond soon.' 
            : '📝 Mensaje recibido. Un agente responderá pronto.'
        );
      }
      return;
    }
    
    // Handle text messages
    if (text) {
      // Forward message to dashboard via Socket.IO
      await notifyNewMessage(activeSession.sessionId, text, message.message_id);
      
      // Trigger flow: message received
      await triggerMessageReceived(activeSession, { 
        content: text, 
        messageType: 'text',
        messageId: message.message_id,
      });
      
      // Trigger flow: keyword detected (flows will filter by keywords)
      await triggerKeywordDetected(activeSession, { content: text, messageType: 'text' });
      
      // // Reset inactivity timer when user responds
      // if (activeSession.status === 'human') {
      //   await resetInactivityTimer(activeSession.sessionId);
      // }
      
      if (activeSession.status === 'waiting') {
        // Reset queued timer when user sends message
        await resetQueuedTimer(activeSession.sessionId);
        await sendMessage(
          chat.id, 
          lang === 'en' 
            ? '📝 Message received. A support agent will respond soon.' 
            : '📝 Mensaje recibido. Un agente responderá pronto.'
        );
      }
    }
    return;
  }
  
  // Handle commands (only for text messages)
  if (text) {
    const command = text.split(' ')[0].toLowerCase();
    if (command.startsWith('/')) {
      const handler = COMMANDS[command];
      if (handler) {
        logger.command(command, from.id, chat.id);
        await handler(message, user);
        return;
      }
    }
  }
  
  // Handle conversation state
  await handleConversationMessage(message, user);
}

/**
 * Handle conversation-based messages
 */
async function handleConversationMessage(message: TelegramMessage, user: IUser): Promise<void> {
  const { chat, text } = message;
  const lang = user.language;
  const ctx = getContext(chat.id);
  // Trigger flows for messages without active session
  if (text) {
    // 1. First check for command triggers (higher priority)
    // Commands are /command or /command param (for deep links like t.me/bot?start=param)
    if (text.startsWith('/')) {
      const parts = text.split(' ');
      const commandWithSlash = parts[0]; // e.g., "/start"
      const commandName = commandWithSlash.substring(1).split('@')[0]; // Remove / and @botname
      const param = parts.slice(1).join(' '); // Everything after the command
      
      await triggerCommandReceivedNoSession(user, chat.id, {
        name: commandName,
        param: param || undefined,
        fullText: text,
        messageId: message.message_id,
      });
    }
    
    // 2. Then trigger message received and keyword detected
    await triggerMessageReceivedNoSession(user, chat.id, {
      content: text,
      messageType: 'text',
      messageId: message.message_id,
    });
    await triggerKeywordDetectedNoSession(user, chat.id, {
      content: text,
      messageType: 'text',
    });

  }
  
  // switch (ctx.state) {
  //   case ConversationState.TICKET_DESCRIPTION:
  //     if (text && ctx.ticketCategory) {
  //       await handleTicketDescription(chat.id, user, ctx.ticketCategory, text);
  //     }
  //     break;
      
  //   default:
  //     // Show main menu for unrecognized messages
  //     // await sendMessage(chat.id, getMessage('invalidInput', lang), {
  //     //   replyMarkup: getMainMenuKeyboard(lang),
  //     // });
  // }
}

// ============= COMMAND IMPLEMENTATIONS =============

async function handleStart(msg: TelegramMessage, user: IUser): Promise<void> {
  resetContext(msg.chat.id);
  await sendMessage(msg.chat.id, getMessage('welcome', user.language), {
    replyMarkup: getMainMenuKeyboard(user.language),
  });
}

async function handleHelp(msg: TelegramMessage, user: IUser): Promise<void> {
  await sendMessage(msg.chat.id, getMessage('help', user.language), {
    replyMarkup: getBackKeyboard(user.language),
  });
}

async function handleFAQ(msg: TelegramMessage, user: IUser): Promise<void> {
  updateContext(msg.chat.id, { state: ConversationState.FAQ });
  await sendMessage(msg.chat.id, getMessage('faqMenu', user.language), {
    replyMarkup: getFAQMenuKeyboard(user.language),
  });
}

async function handleTicket(msg: TelegramMessage, user: IUser): Promise<void> {
  updateContext(msg.chat.id, { state: ConversationState.TICKET_TYPE, ticketCategory: undefined });
  await sendMessage(msg.chat.id, getMessage('ticketSelectCategory', user.language), {
    replyMarkup: getTicketCategoryKeyboard(user.language),
  });
}

async function handleHuman(msg: TelegramMessage, user: IUser): Promise<void> {
  await sendMessage(msg.chat.id, getMessage('humanConfirm', user.language), {
    replyMarkup: getHumanConfirmKeyboard(user.language),
  });
}

async function handleLanguage(msg: TelegramMessage, user: IUser): Promise<void> {
  await sendMessage(msg.chat.id, getMessage('languageSelect', user.language), {
    replyMarkup: getLanguageKeyboard(),
  });
}

async function handleCancel(msg: TelegramMessage, user: IUser): Promise<void> {
  resetContext(msg.chat.id);
  await sendMessage(msg.chat.id, getMessage('cancelled', user.language), {
    replyMarkup: getMainMenuKeyboard(user.language),
  });
}

// ============= TICKET HANDLER =============

async function handleTicketDescription(
  chatId: number, 
  user: IUser,
  category: TicketCategory,
  description: string
): Promise<void> {
  const lang = user.language;
  
  // Create chat session in MongoDB
  const session = await getOrCreateSession(user, chatId);
  
  // Transfer to waiting status with category
  await transferToHuman(session.sessionId, category);
  
  // Start inactivity timer for queued session
  await startQueuedTimer(session.sessionId, chatId);
  
  // Add initial message
  await addMessage(session.sessionId, 'user', description);
  
  // Add bot system message
  await addMessage(session.sessionId, 'bot', `Ticket created with category: ${category}`, {
    messageType: 'system',
  });
  
  // Notify dashboard via Socket.IO
  const updatedSession = await getActiveSessionByTelegramChatId(chatId);
  if (updatedSession) {
    await notifyNewSession(updatedSession);
    
    // Trigger flow: chat created
    await triggerChatCreated(updatedSession);
  }
  
  // Send confirmation to user with ReplyKeyboard (no inline menu)
  await sendMessage(
    chatId,
    formatTicketConfirmation(session.sessionId, category, lang),
    { replyMarkup: getHumanSupportKeyboard() }
  );
  
  // Reset conversation context
  resetContext(chatId);
  
  logger.info('ticket', { action: 'created', sessionId: session.sessionId, category }, user.telegramId, chatId);
}

// ============= CALLBACK QUERY HANDLER =============

export async function handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
  const { id, from, message, data } = query;
  
  if (!message || !data) {
    await answerCallbackQuery(id);
    return;
  }
  
  const chatId = message.chat.id;
  
  // Check if this is a flow button callback first
  // Supports both legacy format (flow:...) and compact format (fb:...)
  if (data.startsWith('flow:') || data.startsWith('fb:')) {
    const user = await getOrCreateUser(from, message.chat.id);
    await answerCallbackQuery(id);
    
    const result = await handleFlowButtonCallback(data, user, chatId, message.message_id);
    if (result.handled) {
      logger.info('callback', { action: 'flow_button_handled', data: data.substring(0, 50) });
      return;
    }
    // If not handled (e.g., expired callback), log and continue
    if (result.error) {
      logger.warn('callback', { action: 'flow_button_not_handled', data, error: result.error });
    }
  }
  
  // Check if user has active human support session - block callbacks
  const activeSession = await getActiveSessionByTelegramChatId(chatId);
  if (activeSession && (activeSession.status === 'waiting' || activeSession.status === 'human')) {
    await answerCallbackQuery(id, 'Chat con soporte activo. Usa el botón "Cerrar chat" para salir.');
    return;
  }
  
  // Get user from MongoDB
  const user = await getOrCreateUser(from, message.chat.id);
  const lang = user.language;
  const messageId = message.message_id;
  
  logger.callback(data, from.id, chatId);
  
  // Answer callback immediately
  await answerCallbackQuery(id);
  
  // Route callback
  if (data.startsWith('menu_')) {
    await handleMenuCallback(chatId, messageId, data, lang);
  } else if (data.startsWith('faq_')) {
    await handleFAQCallback(chatId, messageId, data, lang);
  } else if (data.startsWith('ticket_')) {
    await handleTicketCallback(chatId, messageId, data, lang);
  } else if (data.startsWith('lang_')) {
    await handleLanguageCallback(chatId, messageId, data, user);
  } else if (data.startsWith('survey:')) {
    await handleSurveyCallback(chatId, messageId, data, user, lang);
  } else if (data === 'human_confirm') {
    await handleHumanConfirm(chatId, user);
  } else if (data === 'back_main') {
    await handleBackToMain(chatId, messageId, lang);
  } else if (data === 'cancel') {
    resetContext(chatId);
    await editMessage(chatId, messageId, getMessage('cancelled', lang), {
      replyMarkup: getMainMenuKeyboard(lang),
    });
  }
}

// ============= CALLBACK IMPLEMENTATIONS =============

async function handleMenuCallback(
  chatId: number, 
  messageId: number, 
  data: string, 
  lang: Language
): Promise<void> {
  switch (data) {
    case 'menu_faq':
      updateContext(chatId, { state: ConversationState.FAQ });
      await editMessage(chatId, messageId, getMessage('faqMenu', lang), {
        replyMarkup: getFAQMenuKeyboard(lang),
      });
      break;
      
    case 'menu_ticket':
      updateContext(chatId, { state: ConversationState.TICKET_TYPE, ticketCategory: undefined });
      await editMessage(chatId, messageId, getMessage('ticketSelectCategory', lang), {
        replyMarkup: getTicketCategoryKeyboard(lang),
      });
      break;
      
    case 'menu_human':
      await editMessage(chatId, messageId, getMessage('humanConfirm', lang), {
        replyMarkup: getHumanConfirmKeyboard(lang),
      });
      break;
      
    case 'menu_language':
      await editMessage(chatId, messageId, getMessage('languageSelect', lang), {
        replyMarkup: getLanguageKeyboard(),
      });
      break;
      
    case 'menu_help':
      await editMessage(chatId, messageId, getMessage('help', lang), {
        replyMarkup: getBackKeyboard(lang),
      });
      break;
  }
}

async function handleFAQCallback(
  chatId: number, 
  messageId: number, 
  data: string, 
  lang: Language
): Promise<void> {
  let content: string;
  
  switch (data) {
    case 'faq_usage':
      content = getMessage('faqUsage', lang);
      break;
    case 'faq_plans':
      content = getMessage('faqPlans', lang);
      break;
    case 'faq_issues':
      content = getMessage('faqIssues', lang);
      break;
    default:
      return;
  }
  
  await editMessage(chatId, messageId, content, {
    replyMarkup: getBackKeyboard(lang),
  });
}

async function handleTicketCallback(
  chatId: number, 
  messageId: number, 
  data: string, 
  lang: Language
): Promise<void> {
  const categoryKey = data.replace('ticket_', '') as TicketCategory;
  
  // Validate category
  if (!Object.values(TicketCategory).includes(categoryKey)) {
    return;
  }
  
  // Save category and ask for description
  updateContext(chatId, { 
    state: ConversationState.TICKET_DESCRIPTION,
    ticketCategory: categoryKey,
  });
  
  await editMessage(chatId, messageId, getMessage('ticketDescribe', lang));
}

async function handleLanguageCallback(
  chatId: number, 
  messageId: number, 
  data: string, 
  user: IUser
): Promise<void> {
  const newLang: Language = data === 'lang_es' ? 'es' : 'en';
  
  // Update in MongoDB
  await updateUserLanguage(user.telegramId, newLang);
  
  await editMessage(chatId, messageId, getMessage('languageChanged', newLang), {
    replyMarkup: getMainMenuKeyboard(newLang),
  });
}

/**
 * Handle survey callback from user
 */
async function handleSurveyCallback(
  chatId: number,
  messageId: number,
  data: string,
  user: IUser,
  lang: Language
): Promise<void> {
  // Parse rating from callback data (survey:1, survey:2, etc.)
  const rating = parseInt(data.split(':')[1], 10);
  
  if (isNaN(rating) || rating < 1 || rating > 5) {
    return;
  }
  
  // Find the most recent closed session for this user
  const { ChatSession } = await import('../database/index.js');
  const recentSession = await ChatSession.findOne({
    telegramChatId: chatId,
    status: 'closed',
  }).sort({ closedAt: -1 });
  
  if (!recentSession) {
    const noSessionMsg = lang === 'es'
      ? '❌ No se encontró una sesión reciente.'
      : '❌ No recent session found.';
    await editMessage(chatId, messageId, noSessionMsg);
    return;
  }
  
  // Submit survey
  await submitSurvey(recentSession.sessionId, rating);
  
  // Stars visualization
  const stars = '⭐'.repeat(rating);
  const thankYouMsg = lang === 'es'
    ? `¡Gracias por tu calificación! ${stars}\n\nTu opinión nos ayuda a mejorar.`
    : `Thank you for your rating! ${stars}\n\nYour feedback helps us improve.`;
  
  await editMessage(chatId, messageId, thankYouMsg);
  
  logger.info('survey', { action: 'submitted', rating, sessionId: recentSession.sessionId }, user.telegramId, chatId);
}

async function handleHumanConfirm(chatId: number, user: IUser): Promise<void> {
  const lang = user.language;
  
  // Create or get session
  const session = await getOrCreateSession(user, chatId);
  
  // Transfer to waiting
  await transferToHuman(session.sessionId);
  
  // Start inactivity timer for queued session
  await startQueuedTimer(session.sessionId, chatId);
  
  // Add system message
  await addMessage(session.sessionId, 'bot', 'User requested human support', {
    messageType: 'system',
  });
  
  // Notify dashboard
  const updatedSession = await getActiveSessionByTelegramChatId(chatId);
  if (updatedSession) {
    await notifyNewSession(updatedSession);
  }
  
  // Confirm to user with ReplyKeyboard (no inline menu)
  await sendMessage(chatId, getMessage('escalateConfirmation', lang), {
    replyMarkup: getHumanSupportKeyboard(),
  });
  
  logger.info('ticket', { action: 'escalated', sessionId: session.sessionId }, user.telegramId, chatId);
}

async function handleBackToMain(
  chatId: number, 
  messageId: number, 
  lang: Language
): Promise<void> {
  resetContext(chatId);
  await editMessage(chatId, messageId, getMessage('mainMenu', lang), {
    replyMarkup: getMainMenuKeyboard(lang),
  });
}

// ============= MEDIA MESSAGE HANDLER =============

/**
 * Handle multimedia messages from user in support session
 */
async function handleUserMediaMessage(
  sessionId: string,
  message: TelegramMessage,
  lang: Language
): Promise<void> {
  const { photo, document, voice, audio, sticker, caption } = message;
  
  let messageType: 'image' | 'document' | 'voice' | 'audio' | 'sticker' = 'image';
  let fileId: string | null = null;
  let fileName: string | undefined;
  let displayText = '';
  
  // Determine message type and get file_id
  if (photo && photo.length > 0) {
    // Get largest photo size
    const largestPhoto = photo[photo.length - 1];
    fileId = largestPhoto.file_id;
    messageType = 'image';
    displayText = caption || '📷 Imagen';
  } else if (document) {
    fileId = document.file_id;
    messageType = 'document';
    fileName = document.file_name;
    displayText = caption || `📎 ${document.file_name || 'Documento'}`;
  } else if (voice) {
    fileId = voice.file_id;
    messageType = 'voice';
    displayText = `🎤 Mensaje de voz (${voice.duration}s)`;
  } else if (audio) {
    fileId = audio.file_id;
    messageType = 'audio';
    displayText = `🎵 ${audio.title || audio.file_name || 'Audio'} (${audio.duration}s)`;
  } else if (sticker) {
    fileId = sticker.file_id;
    messageType = 'sticker';
    displayText = `${sticker.emoji || '🎨'} Sticker`;
  }
  
  if (!fileId) {
    logger.warn('chat', { action: 'media_no_file_id', sessionId });
    return;
  }
  
  // Resolve file URL from Telegram
  const mediaUrl = await resolveFileUrl(fileId);
  
  if (!mediaUrl) {
    logger.error('chat', { action: 'media_url_resolve_failed', sessionId, fileId });
    return;
  }
  
  // Notify dashboard with media
  await notifyNewMediaMessage(sessionId, {
    content: displayText,
    messageType,
    mediaUrl,
    fileName,
    telegramMessageId: message.message_id,
  });
  
  logger.info('chat', { 
    action: 'user_media_received', 
    sessionId, 
    messageType,
    hasUrl: !!mediaUrl 
  });
}

// ============= CLEANUP =============

// Cleanup old conversation contexts and rate limits every 30 minutes
setInterval(() => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes
  
  for (const [chatId, ctx] of conversationContexts) {
    if (now - ctx.lastActivity > timeout) {
      conversationContexts.delete(chatId);
    }
  }

  // Clean stale rate limit entries (no message in 30 min)
  for (const [chatId, limit] of rateLimits) {
    if (now - limit.lastMessage > timeout) {
      rateLimits.delete(chatId);
    }
  }
}, 30 * 60 * 1000);
