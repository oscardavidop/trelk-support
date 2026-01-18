import { useEffect, useState } from 'react';



export function useFileSize(url: string) {
  const [size, setSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchSize = async () => {
      try {
        const res = await fetch(url, { method: 'HEAD' });

        const length = res.headers.get('Content-Length');
        if (!cancelled && length) {
          setSize(Number(length));
        }
      } catch {
        // Silencioso: no todos los servidores permiten HEAD
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSize();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { size, loading };
}

export function useFileDownload(url: string) {
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const download = async (fileName: string) => {
    setIsDownloading(true);
    setProgress(0);

    const response = await fetch(url);
    const reader = response.body?.getReader();
    const contentLength = Number(response.headers.get('Content-Length'));

    if (!reader || !contentLength) {
      window.open(url, '_blank');
      setIsDownloading(false);
      return;
    }

    let received = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        setProgress(Math.round((received / contentLength) * 100));
      }
    }

    const blob = new Blob(chunks as BlobPart[]);
    const downloadUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(downloadUrl);
    setIsDownloading(false);
  };

  return { download, progress, isDownloading };
}


export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
