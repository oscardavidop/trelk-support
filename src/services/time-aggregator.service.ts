/**
 * Time Aggregator Service
 *
 * Calculates agent time stats from AgentStatusLog records.
 * Used for payroll, reporting, export to Excel.
 * 
 * Optimized for large volumes via MongoDB aggregation pipelines.
 */

import ExcelJS from 'exceljs';
import { Agent } from '../database/models/Agent.js';
import { AgentStatusLog } from '../database/models/AgentStatusLog.js';
import { AuxiliaryState } from '../database/models/AuxiliaryState.js';

export interface AgentTimeStats {
  agentId: string;
  name: string;
  email: string;

  // Milliseconds per state
  byState: Record<string, { label: string; durationMs: number; durationHuman: string; color: string }>;

  // Computed totals
  totalLoggedMs: number;
  totalPaidMs: number;
  totalBreakMs: number;
  totalAvailableMs: number;
  totalBusyMs: number;
  utilizationPct: number;  // busy+available / totalLogged

  // Unexpected events count
  unexpectedDisconnects: number;
}

export interface DailyAgentStats {
  date: string;       // YYYY-MM-DD
  agentId: string;
  name: string;
  email: string;
  byState: Record<string, number>;  // code → ms
  totalLoggedMs: number;
  unusualEvents: number;
}

// ─── Core Aggregator ──────────────────────────────────────────────────────────

/**
 * Compute all logs for an agent in a date range.
 * Includes the currently-open log (partial duration up to `to` or now)
 * so that live states are included in stats and Excel export.
 */
async function resolveLogsForRange(
  agentId: string,
  from: Date,
  to: Date
): Promise<any[]> {
  const effectiveTo = to > new Date() ? new Date() : to;

  // Closed logs that started in range
  const closedLogs = await AgentStatusLog.find({
    agentId,
    startedAt: { $gte: from, $lte: effectiveTo },
    endedAt:   { $exists: true },
  }).lean() as any[];

  // Currently open log (might have started before 'from' — still counts partially)
  const openLog = await AgentStatusLog.findOne({
    agentId,
    startedAt: { $lte: effectiveTo },
    endedAt:   { $exists: false },
  }).sort({ startedAt: -1 }).lean() as any;

  const allLogs = [...closedLogs];

  if (openLog) {
    const logStart = new Date(openLog.startedAt).getTime();
    const rangeStart = from.getTime();
    const effectiveStart = Math.max(logStart, rangeStart);
    const partialDur = effectiveTo.getTime() - effectiveStart;
    if (partialDur > 0) {
      allLogs.push({
        ...openLog,
        durationMs: partialDur,
        _isPartial: true,
      });
    }
  }

  return allLogs;
}

export async function getAgentTimeStats(
  agentId: string,
  from: Date,
  to: Date
): Promise<AgentTimeStats> {
  const [agent, auxStates, logs] = await Promise.all([
    Agent.findById(agentId).select('name email').lean() as Promise<any>,
    AuxiliaryState.find({ isActive: true }).lean() as Promise<any[]>,
    resolveLogsForRange(agentId, from, to),
  ]);

  if (!agent) throw new Error('Agent not found');

  const stateMap = new Map(auxStates.map((s: any) => [s.code, s]));

  const byState: Record<string, { label: string; durationMs: number; durationHuman: string; color: string }> = {};
  let totalLoggedMs = 0;
  let totalPaidMs = 0;
  let totalBreakMs = 0;
  let totalAvailableMs = 0;
  let totalBusyMs = 0;
  let unexpectedDisconnects = 0;

  for (const log of logs) {
    const dur = log.durationMs || 0;
    const code = log.auxiliaryStateCode;
    const state = stateMap.get(code);

    if (!byState[code]) {
      byState[code] = {
        label: log.auxiliaryStateLabel,
        durationMs: 0,
        durationHuman: '',
        color: state?.color || '#6b7280',
      };
    }
    byState[code].durationMs += dur;

    if (code !== 'offline') totalLoggedMs += dur;
    if (state?.countsPaidTime) totalPaidMs += dur;
    if (code.startsWith('break') || code === 'break') totalBreakMs += dur;
    if (code === 'available') totalAvailableMs += dur;
    if (code === 'busy') totalBusyMs += dur;
    if (log.isUnexpected) unexpectedDisconnects++;
  }

  // Format human durations
  for (const code of Object.keys(byState)) {
    byState[code].durationHuman = formatDuration(byState[code].durationMs);
  }

  const utilizationPct = totalLoggedMs > 0
    ? Math.round(((totalAvailableMs + totalBusyMs) / totalLoggedMs) * 100)
    : 0;

  return {
    agentId,
    name: agent.name,
    email: agent.email,
    byState,
    totalLoggedMs,
    totalPaidMs,
    totalBreakMs,
    totalAvailableMs,
    totalBusyMs,
    utilizationPct,
    unexpectedDisconnects,
  };
}

export async function getTeamTimeStats(
  from: Date,
  to: Date,
  teamId?: string
): Promise<AgentTimeStats[]> {
  const query: any = { isActive: true };
  if (teamId) query.teamId = teamId;
  const agents = await Agent.find(query).select('_id').lean() as any[];
  return Promise.all(agents.map((a: any) => getAgentTimeStats(String(a._id), from, to)));
}

// ─── Daily Breakdown ──────────────────────────────────────────────────────────

export async function getDailyBreakdown(
  agentId: string,
  from: Date,
  to: Date
): Promise<DailyAgentStats[]> {
  const agent = await Agent.findById(agentId).select('name email').lean() as any;
  if (!agent) throw new Error('Agent not found');

  const logs = await resolveLogsForRange(agentId, from, to);

  // Group by day
  const byDay = new Map<string, { byState: Record<string, number>; unusualEvents: number }>();

  for (const log of logs) {
    const day = new Date(log.startedAt).toISOString().split('T')[0];
    if (!byDay.has(day)) byDay.set(day, { byState: {}, unusualEvents: 0 });
    const d = byDay.get(day)!;
    d.byState[log.auxiliaryStateCode] = (d.byState[log.auxiliaryStateCode] || 0) + (log.durationMs || 0);
    if (log.isUnexpected) d.unusualEvents++;
  }

  const result: DailyAgentStats[] = [];
  for (const [date, data] of byDay.entries()) {
    const totalLoggedMs = Object.entries(data.byState)
      .filter(([code]) => code !== 'offline')
      .reduce((acc, [, ms]) => acc + ms, 0);

    result.push({
      date,
      agentId,
      name: agent.name,
      email: agent.email,
      byState: data.byState,
      totalLoggedMs,
      unusualEvents: data.unusualEvents,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── State History ────────────────────────────────────────────────────────────

export async function getAgentStatusHistory(
  agentId: string,
  from: Date,
  to: Date,
  limit = 200
): Promise<any[]> {
  return AgentStatusLog.find({
    agentId,
    startedAt: { $gte: from, $lte: to },
  })
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();
}

export async function getUnexpectedEvents(
  agentId: string,
  from: Date,
  to: Date
): Promise<any[]> {
  return AgentStatusLog.find({
    agentId,
    isUnexpected: true,
    startedAt: { $gte: from, $lte: to },
  })
    .sort({ startedAt: -1 })
    .lean();
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

export async function exportTimeReportExcel(
  agentIds: string[],
  from: Date,
  to: Date
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Trelk Support System';
  workbook.created = new Date();

  const auxStates = await AuxiliaryState.find({ isActive: true }).sort({ sortOrder: 1 }).lean() as any[];
  const stateCodes = auxStates.map((s: any) => s.code);

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Resumen por Agente');
  summarySheet.properties.defaultColWidth = 18;

  // Header row
  const summaryHeaders = [
    'Agent ID', 'Nombre', 'Email',
    ...auxStates.map((s: any) => s.label),
    'Total Logueado', 'Tiempo Pago', 'Descanso Total',
    'Utilización %', 'Desconexiones Inesperadas',
  ];
  const headerRow = summarySheet.addRow(summaryHeaders);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e293b' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF374151' } },
    };
  });

  // Data rows
  for (const agentId of agentIds) {
    try {
      const stats = await getAgentTimeStats(agentId, from, to);
      const row = [
        agentId,
        stats.name,
        stats.email,
        ...stateCodes.map(code => {
          const ms = stats.byState[code]?.durationMs || 0;
          return formatDuration(ms);
        }),
        formatDuration(stats.totalLoggedMs),
        formatDuration(stats.totalPaidMs),
        formatDuration(stats.totalBreakMs),
        `${stats.utilizationPct}%`,
        stats.unexpectedDisconnects,
      ];
      const dataRow = summarySheet.addRow(row);
      dataRow.eachCell(cell => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    } catch {}
  }

  summarySheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: summaryHeaders.length },
  };

  // ── Sheet 2: Daily Breakdown ───────────────────────────────────────────────
  const dailySheet = workbook.addWorksheet('Desglose Diario');
  dailySheet.properties.defaultColWidth = 16;

  const dailyHeaders = [
    'Fecha', 'Agent ID', 'Nombre', 'Email',
    ...auxStates.map((s: any) => s.label),
    'Total Logueado', 'Eventos Inesperados',
  ];
  const dailyHeaderRow = dailySheet.addRow(dailyHeaders);
  dailyHeaderRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0f172a' } };
    cell.alignment = { horizontal: 'center' };
  });

  for (const agentId of agentIds) {
    try {
      const daily = await getDailyBreakdown(agentId, from, to);
      for (const day of daily) {
        const row = [
          day.date,
          agentId,
          day.name,
          day.email,
          ...stateCodes.map(code => formatDuration(day.byState[code] || 0)),
          formatDuration(day.totalLoggedMs),
          day.unusualEvents,
        ];
        dailySheet.addRow(row);
      }
    } catch {}
  }

  dailySheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: dailyHeaders.length },
  };

  // ── Sheet 3: Full Logs ─────────────────────────────────────────────────────
  const logsSheet = workbook.addWorksheet('Logs Completos');
  logsSheet.properties.defaultColWidth = 20;

  const logHeaders = [
    'Agent ID', 'Nombre', 'Estado', 'Etiqueta Estado', 'Motivo',
    'Inicio', 'Fin', 'Duración', 'IP', 'Disparado Por',
    'Supervisor', '¿Inesperado?', 'Hash Integridad',
  ];
  const logHeaderRow = logsSheet.addRow(logHeaders);
  logHeaderRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
    cell.alignment = { horizontal: 'center' };
  });

  const agentMap = new Map<string, string>();
  const agents = await Agent.find({ _id: { $in: agentIds } }).select('_id name').lean() as any[];
  agents.forEach((a: any) => agentMap.set(String(a._id), a.name));

  for (const agentId of agentIds) {
    const logs = await AgentStatusLog.find({
      agentId,
      startedAt: { $gte: from, $lte: to },
    }).sort({ startedAt: 1 }).lean() as any[];

    for (const log of logs) {
      logsSheet.addRow([
        agentId,
        agentMap.get(agentId) || '',
        log.auxiliaryStateCode,
        log.auxiliaryStateLabel,
        log.reason || '',
        log.startedAt ? new Date(log.startedAt).toLocaleString('es') : '',
        log.endedAt ? new Date(log.endedAt).toLocaleString('es') : 'Abierto',
        log.durationMs ? formatDuration(log.durationMs) : '-',
        log.ip,
        log.triggeredBy,
        log.triggeredByAgentId ? String(log.triggeredByAgentId) : '',
        log.isUnexpected ? 'Sí' : 'No',
        log.integrityHash?.substring(0, 16) + '...',
      ]);
    }
  }

  logsSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: logHeaders.length },
  };

  // Freeze header rows
  [summarySheet, dailySheet, logsSheet].forEach(ws => {
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '0m';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
