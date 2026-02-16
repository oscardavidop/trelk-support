/**
 * Export Service — Frontend API client for chat exports
 * Manages export job creation, status polling, download, and deletion
 */

import { set } from 'date-fns';
import { api } from './api';
import jsPDF from 'jspdf';


// ============= TYPES =============

export type ExportFormat = 'json' | 'xlsx' | 'zip' | 'csv' | 'html' | 'pdf';

export interface ExportIncludeOptions {
  messages?: boolean;
  notes?: boolean;
  systemLogs?: boolean;
  agentActions?: boolean;
  transfers?: boolean;
  ratings?: boolean;
  userInfo?: boolean;
  media?: boolean;
  scheduledMessages?: boolean;
  whispers?: boolean;
  contactHistory?: boolean;
  qaReview?: boolean;
  disposition?: boolean;
}

export interface ExportAdvancedOptions {
  redactPII?: boolean;
  gdprMode?: boolean;
}

export interface CreateExportParams {
  format: ExportFormat;
  include?: ExportIncludeOptions;
  advanced?: ExportAdvancedOptions;
  pdfOptions?: {
    companyName?: string;
    includeBranding?: boolean;
  };
}

export interface ExportJobData {
  _id: string;
  id: string;
  type: string;
  format: ExportFormat;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  fileSize?: number;
  recordCount?: number;
  error?: string;
  createdAt: string;
  requestedAt: string;
  completedAt?: string;
  expiresAt?: string;
  requestedBy?: string;
  downloadUrl?: string;
  sessionId?: string;
}

export interface ExportJobStatusData {
  id: string;
  type: string;
  format: ExportFormat;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  totalItems?: number;
  processedItems?: number;
  fileUrl?: string;
  fileSize?: number;
  error?: string;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  downloadCount: number;
}

// ============= API CALLS =============

/**
 * Create a session export job
 */
export async function createSessionExport(
  sessionId: string,
  params: CreateExportParams
): Promise<{ jobId: string; status: string }> {
  const res = await api.post<{ success: boolean; data: { jobId: string; status: string } }>(
    `/api/exports/session/${sessionId}`,
    {
      format: params.format === 'html' ? 'pdf' : params.format,
      include: params.include,
      advanced: params.advanced,
      pdfOptions: params.pdfOptions,
    }
  );
  return res.data.data;
}

/**
 * Get export job status (for polling)
 */
export async function getExportJobStatus(jobId: string): Promise<ExportJobStatusData> {
  const res = await api.get<{ success: boolean; data: ExportJobStatusData }>(
    `/api/exports/jobs/${jobId}`
  );
  return res.data.data;
}

/**
 * List export jobs for the session (paginated)
 */
export async function getExportJobs(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ data: ExportJobData[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);

  const res = await api.get<{
    success: boolean;
    data: ExportJobData[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(`/api/exports/jobs?${qs.toString()}`);

  return { data: res.data.data, pagination: res.data.pagination };
}

/**
 * Download export file — triggers browser download
 */
export function downloadExport(jobId: string, format?: ExportFormat, setIsExporting?: (exporting: boolean) => void): void {
  setIsExporting?.(true);

  const token = getToken();
  const url = `/api/exports/jobs/${jobId}/download`;

  // Use hidden anchor to trigger download with auth
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  // For auth, use a fetch + blob approach
  fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
    .then(r => r.blob())
    .then(blob => {
      if (format && format === 'pdf') {
        exportToPdf(URL.createObjectURL(blob), { id: jobId, format: 'pdf' } as ExportJobData, setIsExporting);
      } else {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        // Extract filename from content-disposition or use default
        a.download = `export-${jobId}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      }
    })
    .catch(err => {
      setIsExporting?.(false);
    });
}

/**
 * Delete an export job
 */
export async function deleteExportJob(jobId: string): Promise<void> {
  await api.delete(`/api/exports/jobs/${jobId}`);
}

// ============= HELPERS =============

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('trelk-support-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.token || null;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function exportToPdf(htmlUrl: string, job: ExportJobData, setIsExporting?: (exporting: boolean) => void) {
  const response = await fetch(htmlUrl);
  const htmlText = await response.text();


  function handlePdfExport() {
    console.log('Generating PDF from HTML export...');
    const doc = document.createElement('div');
    doc.innerHTML = htmlText.replace('inline-block', 'block'); // Fix for html2pdf rendering issues
    try {
      (window as any).html2pdf()
        .set({
          margin: 0,
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },

        })
        .from(doc).save(`export-${job.id}.pdf`).then(() => {
          console.log('PDF generation completed');
          setIsExporting?.(false);
        });
    } catch (error) {
      console.error('Error generating PDF:', error);
      setIsExporting?.(false);
    }
  }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
  script.id = 'html2pdf-script';

  script.onload = () => {
    handlePdfExport();
  };
  if (!document.getElementById('html2pdf-script')) {
    document.body.appendChild(script);
  } else {
    console.warn('html2pdf script already loaded, proceeding to export');
    handlePdfExport();
  }
}

/** Format file size for display */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format labels for export formats */
export const FORMAT_LABELS: Record<ExportFormat, { label: string; icon: string; description: string }> = {
  zip: { label: 'JSON + Media (ZIP)', icon: '📦', description: 'Paquete completo con archivos media' },
  xlsx: { label: 'Excel (.xlsx)', icon: '📊', description: 'Múltiples hojas con datos tabulares' },
  html: { label: 'HTML Report', icon: '📄', description: 'Reporte visual profesional' },
  json: { label: 'JSON', icon: '🔧', description: 'Datos estructurados' },
  csv: { label: 'CSV', icon: '📋', description: 'Datos tabulares básicos' },
  pdf: { label: 'PDF', icon: '📄', description: 'Documento visual de alta calidad' },
};
