/**
 * Universal file downloader / sharer supporting Desktop, Mobile Browsers, PWA, iOS Safari and Android.
 */
export async function downloadOrShareFile(
  blob: Blob,
  filename: string,
  mimeType: string,
  title?: string
): Promise<void> {
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const shareTitle = title || filename;

  // On mobile devices (iOS Safari 15+, Android Chrome, PWA), try the native Web Share API Level 2.
  // This opens the native OS share sheet (e.g., "Salvați în Fișiere" / "Save to Files" on iOS, or WhatsApp/Excel/Drive).
  if (isMobile && typeof navigator.share === 'function' && typeof File !== 'undefined') {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: shareTitle,
        });
        return;
      }
    } catch (err: unknown) {
      // If the user cancelled/dismissed the share sheet, do not trigger fallback or error
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      // If share was denied or failed, continue below to the download fallback
    }
  }

  // Fallback for Desktop and non-sharing mobile environments:
  // Create object URL and trigger <a> download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);

  try {
    link.click();
  } catch {
    // Fallback if click blocked
    window.location.href = url;
  }

  // CRITICAL: Do NOT revoke the object URL immediately in the same tick.
  // On iOS Safari and Android Chrome, synchronous revocation cancels the active download stream.
  // Keeping it alive for 60 seconds allows the OS download manager to complete the transfer.
  setTimeout(() => {
    try {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    } catch {
      // Ignore cleanup error
    }
  }, 60000);
}
