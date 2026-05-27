// ============================================================
// ROBUST FILE DOWNLOAD UTILITIES
// These replace direct blob URL manipulation with proper
// download handling that works across all browsers.
// ============================================================

/**
 * Download a Blob as a file using a hidden anchor element.
 * - Appends to DOM before click (Firefox/Safari compatibility)
 * - Delays revokeObjectURL so browser finishes reading the blob
 * - Properly cleans up the DOM element after download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Delay cleanup so browser can finish reading the blob
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Download a file from an API endpoint.
 * Sends a POST request with optional JSON body, then triggers
 * a browser download of the response.
 *
 * Properly handles:
 * - Content-Disposition header for filename
 * - UTF-8 encoded filenames
 * - Error responses with JSON error messages
 */
export async function downloadFromApi(
  url: string,
  filename: string,
  body?: unknown,
): Promise<void> {
  // Include Authorization header if user has an active session token
  // This is required for authenticated API routes like /api/export-docx
  const { useAuthStore } = await import('@/lib/auth-store');
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(errorData.error || `Error ${res.status}`);
  }

  const blob = await res.blob();

  // Try to get filename from Content-Disposition header
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?["']?([^;"'\n]+)/i);
  const finalFilename = match?.[1] ? decodeURIComponent(match[1]) : filename;

  downloadBlob(blob, finalFilename);
}
