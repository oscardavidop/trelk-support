/**
 * Message templates for Trelk Support Bot
 * Bilingual support: English (en) and Spanish (es)
 */

import { TicketCategory, TICKET_CATEGORY_LABELS } from '../config/index.js';
import type { InlineKeyboardMarkup, Language } from '../types/index.js';

// ============= MESSAGE TEMPLATES =============

export const MESSAGES = {
  // Welcome & Onboarding
  welcome: {
    en: `👋 <b>Welcome to Trelk Support!</b>

I'm here to help you with any questions or issues related to <b>@TrelkBot</b>.

🔹 Get answers to frequently asked questions
🔹 Report bugs or issues
🔹 Get help with your account or subscription
🔹 Connect with our support team

How can I assist you today?`,
    es: `👋 <b>¡Bienvenido a Trelk Support!</b>

Estoy aquí para ayudarte con cualquier pregunta o problema relacionado con <b>@TrelkBot</b>.

🔹 Respuestas a preguntas frecuentes
🔹 Reportar errores o problemas
🔹 Ayuda con tu cuenta o suscripción
🔹 Conectar con nuestro equipo de soporte

¿Cómo puedo asistirte hoy?`
  },

  // Main Menu
  mainMenu: {
    en: `📋 <b>Main Menu</b>

Choose an option:`,
    es: `📋 <b>Menú Principal</b>

Elige una opción:`
  },

  // FAQ Menu
  faqMenu: {
    en: `❓ <b>Frequently Asked Questions</b>

Select a category:`,
    es: `❓ <b>Preguntas Frecuentes</b>

Selecciona una categoría:`
  },

  // FAQ: Using Trelk Bot
  faqUsage: {
    en: `📱 <b>How to Use Trelk Bot</b>

<b>Getting Started:</b>
1. Start @TrelkBot in Telegram
2. Use /start to begin
3. Follow the setup instructions

<b>Main Commands:</b>
• <code>/help</code> - View all commands
• <code>/settings</code> - Configure your preferences
• <code>/status</code> - Check your account status

<b>Need more help?</b>
Visit our documentation at trelkbot.com/docs`,
    es: `📱 <b>Cómo Usar Trelk Bot</b>

<b>Primeros Pasos:</b>
1. Inicia @TrelkBot en Telegram
2. Usa /start para comenzar
3. Sigue las instrucciones de configuración

<b>Comandos Principales:</b>
• <code>/help</code> - Ver todos los comandos
• <code>/settings</code> - Configurar preferencias
• <code>/status</code> - Ver estado de tu cuenta

<b>¿Necesitas más ayuda?</b>
Visita nuestra documentación en trelkbot.com/docs`
  },

  // FAQ: Plans & Subscriptions
  faqPlans: {
    en: `💎 <b>Plans & Subscriptions</b>

<b>Available Plans:</b>
• <b>Free</b> - Basic features, limited usage
• <b>Pro</b> - Advanced features, priority support
• <b>Premium</b> - All features, unlimited usage

<b>How to Subscribe:</b>
1. Visit trelkbot.com/plans
2. Choose your plan
3. Complete payment via PayPal

<b>Manage Subscription:</b>
Use /subscription in @TrelkBot to view your current plan.

<b>Questions about billing?</b>
Create a support ticket below.`,
    es: `💎 <b>Planes y Suscripciones</b>

<b>Planes Disponibles:</b>
• <b>Gratis</b> - Funciones básicas, uso limitado
• <b>Pro</b> - Funciones avanzadas, soporte prioritario
• <b>Premium</b> - Todas las funciones, uso ilimitado

<b>Cómo Suscribirse:</b>
1. Visita trelkbot.com/plans
2. Elige tu plan
3. Completa el pago por PayPal

<b>Gestionar Suscripción:</b>
Usa /subscription en @TrelkBot para ver tu plan actual.

<b>¿Preguntas sobre facturación?</b>
Crea un ticket de soporte abajo.`
  },

  // FAQ: Common Issues
  faqIssues: {
    en: `🔧 <b>Common Issues & Solutions</b>

<b>Bot Not Responding:</b>
• Check if @TrelkBot is online (/status)
• Try /restart command
• Wait a few minutes and try again

<b>Command Not Working:</b>
• Make sure you're using the correct syntax
• Check if you have the required permissions
• Verify your subscription is active

<b>Login Issues:</b>
• Ensure your Telegram account is verified
• Check your account wasn't suspended
• Contact support if issues persist

<b>Still having problems?</b>
Create a support ticket for personalized help.`,
    es: `🔧 <b>Problemas Comunes y Soluciones</b>

<b>El Bot No Responde:</b>
• Verifica si @TrelkBot está en línea (/status)
• Prueba el comando /restart
• Espera unos minutos e intenta de nuevo

<b>Comando No Funciona:</b>
• Asegúrate de usar la sintaxis correcta
• Verifica que tienes los permisos necesarios
• Confirma que tu suscripción está activa

<b>Problemas de Acceso:</b>
• Asegúrate de que tu cuenta de Telegram esté verificada
• Verifica que tu cuenta no fue suspendida
• Contacta soporte si el problema persiste

<b>¿Aún tienes problemas?</b>
Crea un ticket de soporte para ayuda personalizada.`
  },

  // Ticket Creation
  ticketSelectCategory: {
    en: `📝 <b>Create Support Ticket</b>

Please select the category that best describes your issue:`,
    es: `📝 <b>Crear Ticket de Soporte</b>

Por favor selecciona la categoría que mejor describe tu problema:`
  },

  ticketDescribe: {
    en: `📝 <b>Describe Your Issue</b>

Please provide a detailed description of your problem. Include:
• What you were trying to do
• What happened instead
• Any error messages you received

<i>Type your message below:</i>`,
    es: `📝 <b>Describe Tu Problema</b>

Por favor proporciona una descripción detallada de tu problema. Incluye:
• Qué estabas intentando hacer
• Qué sucedió en su lugar
• Cualquier mensaje de error que recibiste

<i>Escribe tu mensaje abajo:</i>`
  },

  ticketConfirmation: {
    en: `✅ <b>Ticket Created Successfully!</b>

<b>Ticket ID:</b> <code>{{ticketId}}</code>
<b>Category:</b> {{category}}

Our support team will review your request and get back to you as soon as possible.

<b>What to expect:</b>
• Response within 24 hours
• Updates sent to this chat
• You can add more details anytime

Thank you for contacting Trelk Support! 💙`,
    es: `✅ <b>¡Ticket Creado Exitosamente!</b>

<b>ID del Ticket:</b> <code>{{ticketId}}</code>
<b>Categoría:</b> {{category}}

Nuestro equipo de soporte revisará tu solicitud y te responderá lo antes posible.

<b>Qué esperar:</b>
• Respuesta en 24 horas
• Actualizaciones enviadas a este chat
• Puedes agregar más detalles en cualquier momento

¡Gracias por contactar a Trelk Support! 💙`
  },

  // Human Support
  humanConfirm: {
    en: `👤 <b>Connect with Human Support</b>

Would you like to speak with a human support agent?

<b>Please note:</b>
• Average response time: 2-4 hours
• Available 24/7
• An agent will reply in this chat`,
    es: `👤 <b>Conectar con Soporte Humano</b>

¿Te gustaría hablar con un agente de soporte humano?

<b>Ten en cuenta:</b>
• Tiempo promedio de respuesta: 2-4 horas
• Disponible 24/7
• Un agente responderá en este chat`
  },

  escalateConfirmation: {
    en: `✅ <b>Request Received</b>

Your conversation has been escalated to our support team.

<b>What happens next:</b>
• A support agent will respond as soon as available
• You'll receive a notification in this chat
• Feel free to add more details while you wait

Thank you for your patience! 🙏`,
    es: `✅ <b>Solicitud Recibida</b>

Tu conversación ha sido escalada a nuestro equipo de soporte.

<b>Qué sucede ahora:</b>
• Un agente de soporte responderá tan pronto esté disponible
• Recibirás una notificación en este chat
• Puedes agregar más detalles mientras esperas

¡Gracias por tu paciencia! 🙏`
  },

  // Agent Notification
  agentNotification: {
    en: `🆘 <b>New Support Request</b>

<b>From:</b> {{username}}
<b>User ID:</b> <code>{{userId}}</code>
<b>Category:</b> {{category}}

<b>Description:</b>
{{description}}

<i>Reply to this message to respond to the user.</i>`,
    es: `🆘 <b>Nueva Solicitud de Soporte</b>

<b>De:</b> {{username}}
<b>ID de Usuario:</b> <code>{{userId}}</code>
<b>Categoría:</b> {{category}}

<b>Descripción:</b>
{{description}}

<i>Responde a este mensaje para contestar al usuario.</i>`
  },

  // Errors
  error: {
    en: `❌ <b>Something went wrong</b>

Please try again later or use /start to return to the main menu.`,
    es: `❌ <b>Algo salió mal</b>

Por favor intenta de nuevo más tarde o usa /start para volver al menú principal.`
  },

  rateLimited: {
    en: `⚠️ <b>Slow down!</b>

You're sending messages too quickly. Please wait a moment.`,
    es: `⚠️ <b>¡Más despacio!</b>

Estás enviando mensajes muy rápido. Por favor espera un momento.`
  },

  invalidInput: {
    en: `⚠️ Please use the buttons or type a valid command.`,
    es: `⚠️ Por favor usa los botones o escribe un comando válido.`
  },

  messageTooLong: {
    en: `⚠️ Message too long. Please keep it under 2000 characters.`,
    es: `⚠️ Mensaje muy largo. Por favor mantenlo por debajo de 2000 caracteres.`
  },

  // Help Command
  help: {
    en: `📚 <b>Available Commands</b>

/start - Start the bot & show main menu
/help - Show this help message
/faq - View frequently asked questions
/ticket - Create a support ticket
/human - Connect with a human agent
/language - Change language
/cancel - Cancel current operation

<b>Need more help?</b>
Visit trelkbot.com/help`,
    es: `📚 <b>Comandos Disponibles</b>

/start - Iniciar el bot y mostrar menú
/help - Mostrar este mensaje de ayuda
/faq - Ver preguntas frecuentes
/ticket - Crear un ticket de soporte
/human - Conectar con un agente humano
/language - Cambiar idioma
/cancel - Cancelar operación actual

<b>¿Necesitas más ayuda?</b>
Visita trelkbot.com/help`
  },

  // Cancel
  cancelled: {
    en: `✅ Operation cancelled. Use /start to see the main menu.`,
    es: `✅ Operación cancelada. Usa /start para ver el menú principal.`
  },

  // Language
  languageSelect: {
    en: `🌐 <b>Select Your Language</b>`,
    es: `🌐 <b>Selecciona Tu Idioma</b>`
  },

  languageChanged: {
    en: `✅ Language changed to <b>English</b>`,
    es: `✅ Idioma cambiado a <b>Español</b>`
  },

  // Private chat only
  privateChatOnly: {
    en: `⚠️ This bot only works in private chats. Please message me directly: @TrelkSupportBot`,
    es: `⚠️ Este bot solo funciona en chats privados. Por favor escríbeme directamente: @TrelkSupportBot`
  }
} as const;

// ============= KEYBOARD BUILDERS =============

export function getMainMenuKeyboard(lang: Language): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: lang === 'en' ? '❓ FAQ' : '❓ Preguntas Frecuentes', callback_data: 'menu_faq' }
      ],
      [
        { text: lang === 'en' ? '📝 Create Ticket' : '📝 Crear Ticket', callback_data: 'menu_ticket' }
      ],
      [
        { text: lang === 'en' ? '👤 Human Support' : '👤 Soporte Humano', callback_data: 'menu_human' }
      ],
      [
        { text: '🌐 Language', callback_data: 'menu_language' },
        { text: lang === 'en' ? '📚 Help' : '📚 Ayuda', callback_data: 'menu_help' }
      ]
    ]
  };
}

export function getFAQMenuKeyboard(lang: Language): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: lang === 'en' ? '📱 Using Trelk Bot' : '📱 Usar Trelk Bot', callback_data: 'faq_usage' }
      ],
      [
        { text: lang === 'en' ? '💎 Plans & Subscriptions' : '💎 Planes y Suscripciones', callback_data: 'faq_plans' }
      ],
      [
        { text: lang === 'en' ? '🔧 Common Issues' : '🔧 Problemas Comunes', callback_data: 'faq_issues' }
      ],
      [
        { text: lang === 'en' ? '⬅️ Back' : '⬅️ Volver', callback_data: 'back_main' }
      ]
    ]
  };
}

export function getTicketCategoryKeyboard(lang: Language): InlineKeyboardMarkup {
  const l = (obj: Record<string, string>) => obj[lang] || obj.en || '';
  return {
    inline_keyboard: [
      [{ text: l(TICKET_CATEGORY_LABELS[TicketCategory.BUG] as any), callback_data: `ticket_${TicketCategory.BUG}` }],
      [{ text: l(TICKET_CATEGORY_LABELS[TicketCategory.PAYMENT] as any), callback_data: `ticket_${TicketCategory.PAYMENT}` }],
      [{ text: l(TICKET_CATEGORY_LABELS[TicketCategory.ACCOUNT] as any), callback_data: `ticket_${TicketCategory.ACCOUNT}` }],
      [{ text: l(TICKET_CATEGORY_LABELS[TicketCategory.FEATURE] as any), callback_data: `ticket_${TicketCategory.FEATURE}` }],
      [{ text: l(TICKET_CATEGORY_LABELS[TicketCategory.OTHER] as any), callback_data: `ticket_${TicketCategory.OTHER}` }],
      [{ text: lang === 'en' ? '❌ Cancel' : '❌ Cancelar', callback_data: 'cancel' }]
    ]
  };
}

export function getBackKeyboard(lang: Language): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: lang === 'en' ? '⬅️ Back to Menu' : '⬅️ Volver al Menú', callback_data: 'back_main' }]
    ]
  };
}

export function getLanguageKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🇺🇸 English', callback_data: 'lang_en' },
        { text: '🇪🇸 Español', callback_data: 'lang_es' }
      ],
      [{ text: '⬅️ Back', callback_data: 'back_main' }]
    ]
  };
}

export function getHumanConfirmKeyboard(lang: Language): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: lang === 'en' ? '✅ Yes, connect me' : '✅ Sí, conéctame', callback_data: 'human_confirm' }],
      [{ text: lang === 'en' ? '❌ Cancel' : '❌ Cancelar', callback_data: 'back_main' }]
    ]
  };
}

export function getTicketDoneKeyboard(lang: Language): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: lang === 'en' ? '🏠 Main Menu' : '🏠 Menú Principal', callback_data: 'back_main' }]
    ]
  };
}

// ============= MESSAGE HELPERS =============

export function getMessage(key: keyof typeof MESSAGES, lang: Language): string {
  const msg = MESSAGES[key];
  if (typeof msg === 'object' && lang in msg) {
    return (msg as Record<string, string>)[lang] as string;
  }
  return '';
}

export function formatTicketConfirmation(ticketId: string, category: TicketCategory, lang: Language): string {
  const template = (MESSAGES.ticketConfirmation as Record<string, string>)[lang] || MESSAGES.ticketConfirmation.en;
  return template
    .replace('{{ticketId}}', ticketId)
    .replace('{{category}}', (TICKET_CATEGORY_LABELS[category] as Record<string, string>)[lang] || '');
}

export function formatAgentNotification(
  userId: number,
  username: string | undefined,
  category: TicketCategory,
  description: string,
  lang: Language
): string {
  const template = (MESSAGES.agentNotification as Record<string, string>)[lang] || MESSAGES.agentNotification.en;
  return template
    .replace('{{username}}', username ? `@${username}` : `User ${userId}`)
    .replace('{{userId}}', String(userId))
    .replace('{{category}}', (TICKET_CATEGORY_LABELS[category] as Record<string, string>)[lang] || '')
    .replace('{{description}}', description);
}
