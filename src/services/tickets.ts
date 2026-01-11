/**
 * Ticket Service
 * Handles ticket creation, storage and escalation
 */

import { v4 as uuidv4 } from 'uuid';
import { TicketCategory, SUPPORT_AGENTS, SUPPORT_GROUP_ID, TICKET_CATEGORY_LABELS } from '../config/index.js';
import type { Ticket, TicketStatus } from '../types/index.js';
import { sendMessage } from './telegram.js';
import { logger } from './logger.js';

// In-memory ticket storage (replace with database in production)
const tickets = new Map<string, Ticket>();

/**
 * Create a new support ticket
 */
export async function createTicket(
  userId: number,
  chatId: number,
  username: string | undefined,
  firstName: string,
  category: TicketCategory,
  description: string
): Promise<Ticket> {
  const ticketId = generateTicketId();
  
  const ticket: Ticket = {
    id: ticketId,
    odlerId: userId,
    chatId,
    username,
    firstName,
    category,
    description,
    status: 'open' as TicketStatus,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  tickets.set(ticketId, ticket);
  
  logger.ticket('created', ticketId, userId);
  
  // Notify support agents
  await notifyAgents(ticket);
  
  return ticket;
}

/**
 * Generate a short, readable ticket ID
 */
function generateTicketId(): string {
  const uuid = uuidv4();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `TK-${timestamp.slice(-4)}-${uuid.slice(0, 4).toUpperCase()}`;
}

/**
 * Notify support agents about new ticket
 */
async function notifyAgents(ticket: Ticket): Promise<void> {
  const message = formatAgentMessage(ticket);
  
  // Notify group if configured
  if (SUPPORT_GROUP_ID) {
    await sendMessage(SUPPORT_GROUP_ID, message);
  }
  
  // Notify individual agents
  for (const agentId of SUPPORT_AGENTS) {
    await sendMessage(agentId, message);
  }
}

/**
 * Format ticket message for agents
 */
function formatAgentMessage(ticket: Ticket): string {
  const categoryLabel = TICKET_CATEGORY_LABELS[ticket.category].en;
  const userDisplay = ticket.username ? `@${ticket.username}` : ticket.firstName;
  
  return `🆘 <b>New Support Ticket</b>

<b>Ticket ID:</b> <code>${ticket.id}</code>
<b>From:</b> ${userDisplay}
<b>User ID:</b> <code>${ticket.odlerId}</code>
<b>Category:</b> ${categoryLabel}

<b>Description:</b>
${escapeHtml(ticket.description)}

<b>Created:</b> ${new Date(ticket.createdAt).toISOString()}

<i>Reply with /reply ${ticket.id} [message] to respond.</i>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escalate to human support (without creating formal ticket)
 */
export async function escalateToHuman(
  userId: number,
  chatId: number,
  username: string | undefined,
  firstName: string,
  context?: string
): Promise<boolean> {
  const userDisplay = username ? `@${username}` : firstName;
  
  const message = `👤 <b>Human Support Request</b>

<b>From:</b> ${userDisplay}
<b>User ID:</b> <code>${userId}</code>
<b>Chat ID:</b> <code>${chatId}</code>

${context ? `<b>Context:</b>\n${escapeHtml(context)}` : '<i>User requested human support from main menu.</i>'}

<i>Use /chat ${chatId} to start a conversation.</i>`;

  let notified = false;
  
  if (SUPPORT_GROUP_ID) {
    const result = await sendMessage(SUPPORT_GROUP_ID, message);
    notified = notified || result;
  }
  
  for (const agentId of SUPPORT_AGENTS) {
    const result = await sendMessage(agentId, message);
    notified = notified || result;
  }
  
  logger.info('ticket', { action: 'escalated', userId }, userId, chatId);
  
  return notified;
}

/**
 * Get ticket by ID
 */
export function getTicket(ticketId: string): Ticket | undefined {
  return tickets.get(ticketId);
}

/**
 * Get all tickets for a user
 */
export function getUserTickets(userId: number): Ticket[] {
  return Array.from(tickets.values()).filter(t => t.odlerId === userId);
}

/**
 * Get ticket stats
 */
export function getTicketStats(): { total: number; byCategory: Record<string, number>; byStatus: Record<string, number> } {
  const stats = {
    total: tickets.size,
    byCategory: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
  };
  
  for (const ticket of tickets.values()) {
    stats.byCategory[ticket.category] = (stats.byCategory[ticket.category] || 0) + 1;
    stats.byStatus[ticket.status] = (stats.byStatus[ticket.status] || 0) + 1;
  }
  
  return stats;
}
