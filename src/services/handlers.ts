/**
 * Bot Handlers
 * Handles all bot commands, callbacks and messages
 */

import { ConversationState, TicketCategory } from '../config/index.js';
import type { TelegramMessage, TelegramCallbackQuery, Language } from '../types/index.js';
import { sendMessage, editMessage, answerCallbackQuery } from './telegram.js';
import { Survey } from '../database/models/Survey.js';
import { ChatSession } from '../database/models/ChatSession.js';
import { User } from '../database/models/User.js';
import { 
  getSession, 
  updateSessionState, 
  updateSessionLanguage, 
  updateTicketDraft,
  clearTicketDraft,
  resetSession,
  trackMessage 
} from './sessions.js';
import { createTicket, escalateToHuman } from './tickets.js';
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

// ============= COMMAND HANDLERS =============

const COMMANDS: Record<string, (msg: TelegramMessage, lang: Language) => Promise<void>> = {
  '/start': handleStart,
  '/help': handleHelp,
  '/faq': handleFAQ,
  '/ticket': handleTicket,
  '/human': handleHuman,
  '/language': handleLanguage,
  '/cancel': handleCancel,
};

/**
 * Handle incoming message
 */
export async function handleMessage(message: TelegramMessage): Promise<void> {
  const { from, chat, text } = message;
  
  if (!from || !text || chat.type !== 'private') {
    if (chat.type !== 'private' && from) {
      await sendMessage(chat.id, getMessage('privateChatOnly', 'en'));
    }
    return;
  }
  
  const session = getSession(from, chat.id);
  const lang = session.language;
  
  // Rate limiting
  const rateCheck = trackMessage(chat.id);
  if (!rateCheck.allowed) {
    if (rateCheck.tooFast) {
      return; // Silently ignore very fast messages
    }
    await sendMessage(chat.id, getMessage('rateLimited', lang));
    return;
  }
  
  // Check message length
  if (text.length > SPAM_PROTECTION.maxMessageLength) {
    await sendMessage(chat.id, getMessage('messageTooLong', lang));
    return;
  }
  
  // Handle commands
  const command = text.split(' ')[0].toLowerCase();
  if (command.startsWith('/')) {
    const handler = COMMANDS[command];
    if (handler) {
      logger.command(command, from.id, chat.id);
      await handler(message, lang);
      return;
    }
  }
  
  // Handle conversation state
  await handleConversationMessage(message, session);
}

/**
 * Handle conversation-based messages
 */
async function handleConversationMessage(
  message: TelegramMessage, 
  session: ReturnType<typeof getSession>
): Promise<void> {
  const { chat, text } = message;
  const lang = session.language;
  
  switch (session.state) {
    case ConversationState.TICKET_DESCRIPTION:
      if (text && session.currentTicket?.category) {
        await handleTicketDescription(chat.id, session, text);
      }
      break;
      
    case ConversationState.AWAITING_HUMAN:
      // User is waiting for human, acknowledge their message
      await sendMessage(
        chat.id, 
        lang === 'en' 
          ? '📝 Message received. A support agent will respond soon.' 
          : '📝 Mensaje recibido. Un agente responderá pronto.'
      );
      break;
      
    default:
      // Show main menu for unrecognized messages
      await sendMessage(chat.id, getMessage('invalidInput', lang), {
        replyMarkup: getMainMenuKeyboard(lang),
      });
  }
}

// ============= COMMAND IMPLEMENTATIONS =============

async function handleStart(msg: TelegramMessage, lang: Language): Promise<void> {
  resetSession(msg.chat.id);
  await sendMessage(msg.chat.id, getMessage('welcome', lang), {
    replyMarkup: getMainMenuKeyboard(lang),
  });
}

async function handleHelp(msg: TelegramMessage, lang: Language): Promise<void> {
  await sendMessage(msg.chat.id, getMessage('help', lang), {
    replyMarkup: getBackKeyboard(lang),
  });
}

async function handleFAQ(msg: TelegramMessage, lang: Language): Promise<void> {
  updateSessionState(msg.chat.id, ConversationState.FAQ);
  await sendMessage(msg.chat.id, getMessage('faqMenu', lang), {
    replyMarkup: getFAQMenuKeyboard(lang),
  });
}

async function handleTicket(msg: TelegramMessage, lang: Language): Promise<void> {
  updateSessionState(msg.chat.id, ConversationState.TICKET_TYPE);
  clearTicketDraft(msg.chat.id);
  await sendMessage(msg.chat.id, getMessage('ticketSelectCategory', lang), {
    replyMarkup: getTicketCategoryKeyboard(lang),
  });
}

async function handleHuman(msg: TelegramMessage, lang: Language): Promise<void> {
  await sendMessage(msg.chat.id, getMessage('humanConfirm', lang), {
    replyMarkup: getHumanConfirmKeyboard(lang),
  });
}

async function handleLanguage(msg: TelegramMessage, lang: Language): Promise<void> {
  await sendMessage(msg.chat.id, getMessage('languageSelect', lang), {
    replyMarkup: getLanguageKeyboard(),
  });
}

async function handleCancel(msg: TelegramMessage, lang: Language): Promise<void> {
  resetSession(msg.chat.id);
  await sendMessage(msg.chat.id, getMessage('cancelled', lang), {
    replyMarkup: getMainMenuKeyboard(lang),
  });
}

// ============= TICKET DESCRIPTION HANDLER =============

async function handleTicketDescription(
  chatId: number, 
  session: ReturnType<typeof getSession>,
  description: string
): Promise<void> {
  const lang = session.language;
  const category = session.currentTicket!.category!;
  
  // Create the ticket
  const ticket = await createTicket(
    session.userId,
    chatId,
    session.username,
    session.firstName,
    category,
    description
  );
  
  // Send confirmation
  await sendMessage(
    chatId,
    formatTicketConfirmation(ticket.id, category, lang),
    { replyMarkup: getTicketDoneKeyboard(lang) }
  );
  
  // Reset session
  resetSession(chatId);
}

// ============= CALLBACK QUERY HANDLER =============

export async function handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
  const { id, from, message, data } = query;
  
  if (!message || !data) {
    await answerCallbackQuery(id);
    return;
  }
  
  const session = getSession(from, message.chat.id);
  const lang = session.language;
  const chatId = message.chat.id;
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
    await handleTicketCallback(chatId, messageId, data, session);
  } else if (data.startsWith('lang_')) {
    await handleLanguageCallback(chatId, messageId, data, session);
  } else if (data.startsWith('survey:')) {
    await handleSurveyCallback(chatId, messageId, data, lang);
  } else if (data === 'human_confirm') {
    await handleHumanConfirm(chatId, session);
  } else if (data === 'back_main') {
    await handleBackToMain(chatId, messageId, lang);
  } else if (data === 'cancel') {
    resetSession(chatId);
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
      updateSessionState(chatId, ConversationState.FAQ);
      await editMessage(chatId, messageId, getMessage('faqMenu', lang), {
        replyMarkup: getFAQMenuKeyboard(lang),
      });
      break;
      
    case 'menu_ticket':
      updateSessionState(chatId, ConversationState.TICKET_TYPE);
      clearTicketDraft(chatId);
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
  session: ReturnType<typeof getSession>
): Promise<void> {
  const lang = session.language;
  const categoryKey = data.replace('ticket_', '') as TicketCategory;
  
  // Validate category
  if (!Object.values(TicketCategory).includes(categoryKey)) {
    return;
  }
  
  // Save category and ask for description
  updateTicketDraft(chatId, { category: categoryKey });
  updateSessionState(chatId, ConversationState.TICKET_DESCRIPTION);
  
  await editMessage(chatId, messageId, getMessage('ticketDescribe', lang));
}

async function handleLanguageCallback(
  chatId: number, 
  messageId: number, 
  data: string, 
  session: ReturnType<typeof getSession>
): Promise<void> {
  const newLang: Language = data === 'lang_es' ? 'es' : 'en';
  
  updateSessionLanguage(chatId, newLang);
  
  await editMessage(chatId, messageId, getMessage('languageChanged', newLang), {
    replyMarkup: getMainMenuKeyboard(newLang),
  });
}

async function handleHumanConfirm(
  chatId: number, 
  session: ReturnType<typeof getSession>
): Promise<void> {
  const lang = session.language;
  
  // Escalate to human support
  await escalateToHuman(
    session.userId,
    chatId,
    session.username,
    session.firstName
  );
  
  // Update state
  updateSessionState(chatId, ConversationState.AWAITING_HUMAN);
  
  // Confirm to user
  await sendMessage(chatId, getMessage('escalateConfirmation', lang), {
    replyMarkup: getMainMenuKeyboard(lang),
  });
}

async function handleBackToMain(
  chatId: number, 
  messageId: number, 
  lang: Language
): Promise<void> {
  resetSession(chatId);
  await editMessage(chatId, messageId, getMessage('mainMenu', lang), {
    replyMarkup: getMainMenuKeyboard(lang),
  });
}

async function handleSurveyCallback(
  chatId: number,
  messageId: number,
  data: string,
  lang: Language
): Promise<void> {
  try {
    // Extract rating from callback data (survey:1 -> 1)
    const rating = parseInt(data.split(':')[1], 10);
    
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return;
    }
    
    // Find the most recent closed session for this user
    const user = await User.findOne({ telegramChatId: chatId });
    if (!user) {
      logger.warn('api', { action: 'survey_user_not_found', chatId });
      return;
    }
    
    // Find last closed session
    const session = await ChatSession.findOne({
      user: user._id,
      status: 'closed',
    }).sort({ closedAt: -1 });
    
    if (!session) {
      logger.warn('api', { action: 'survey_session_not_found', userId: user._id });
      return;
    }
    
    // Check if survey already exists for this session
    const existingSurvey = await Survey.findOne({ session: session._id });
    if (existingSurvey) {
      // Already submitted - update the message
      const alreadyMessage = lang === 'es'
        ? '✅ Ya has enviado tu valoración. ¡Gracias!'
        : '✅ You have already submitted your rating. Thank you!';
      await editMessage(chatId, messageId, alreadyMessage);
      return;
    }
    
    // Save survey
    await Survey.create({
      session: session._id,
      user: user._id,
      agent: session.assignedAgent,
      rating,
      telegramMessageId: messageId,
      submittedAt: new Date(),
    });
    
    // Update message with thank you
    const stars = '⭐'.repeat(rating);
    const thankYouMessage = lang === 'es'
      ? `${stars}\n\n✅ ¡Gracias por tu valoración! Tu opinión nos ayuda a mejorar.`
      : `${stars}\n\n✅ Thank you for your rating! Your feedback helps us improve.`;
    
    await editMessage(chatId, messageId, thankYouMessage);
    
    logger.info('api', { action: 'survey_submitted', sessionId: session.sessionId, rating });
    
  } catch (error) {
    logger.error('api', { action: 'survey_error', chatId, error: String(error) });
  }
}
