function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    Boolean(nav.standalone) ||
    Boolean(window.matchMedia?.('(display-mode: standalone)').matches) ||
    Boolean(window.matchMedia?.('(display-mode: minimal-ui)').matches)
  );
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function triggerAnchorDownload(href: string, filename: string, isBlobUrl: boolean) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    if (isBlobUrl) {
      URL.revokeObjectURL(href);
    }
  }, 60_000);
}

/**
 * Downloads or shares a Blob file reliably across desktop web, mobile browsers,
 * and installed PWAs (iOS Safari / Android WebAPK).
 */
export function saveBlobFile(blob: Blob, filename: string): void {
  const shouldPreferShare = isStandaloneApp() || isIosDevice();

  if (
    shouldPreferShare &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  ) {
    try {
      const file = new File([blob], filename, {
        type: blob.type || 'application/octet-stream',
      });
      if (
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        void navigator
          .share({ files: [file], title: filename })
          .catch((err: unknown) => {
            if (err instanceof DOMException && err.name === 'AbortError') {
              return;
            }
            const url = URL.createObjectURL(blob);
            triggerAnchorDownload(url, filename, true);
          });
        return;
      }
    } catch {
      // Fall through to anchor download
    }
  }

  const url = URL.createObjectURL(blob);
  triggerAnchorDownload(url, filename, true);
}
