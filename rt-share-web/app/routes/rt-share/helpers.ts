function detectDeviceLabel(): string {
  try {
    // Prefer UA Client Hints where available
    const nav: any = typeof navigator !== 'undefined' ? navigator : {};
    const ua: string = String(nav.userAgent || '');
    const platform: string = String(nav.userAgentData?.platform || nav.platform || '');

    // iPad detection on iPadOS 13+ (reports as Macintosh)
    const isIpadLike = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && typeof nav.maxTouchPoints === 'number' && nav.maxTouchPoints > 1);
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (isIpadLike) return 'iPad';

    // Android phone/tablet (keep generic "Android")
    if (/Android/i.test(ua)) return 'Android';

    // Desktop platforms
    if (/Windows/i.test(ua) || /Win/i.test(platform)) return 'Windows';
    if (/CrOS/i.test(ua) || /Chrome\s?OS/i.test(platform)) return 'ChromeOS';
    if (/Mac OS X|Macintosh|MacIntel/i.test(ua) || /Mac/i.test(platform)) return 'Mac';
    if (/Linux/i.test(ua) || /Linux/i.test(platform)) return 'Linux';

    return 'Device';
  } catch {
    return 'Device';
  }
}

function randomLetters(count: number): string {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (typeof crypto !== 'undefined' && (crypto as any).getRandomValues) {
    const buf = new Uint8Array(count);
    crypto.getRandomValues(buf);
    return Array.from(buf, b => alpha[b % 26]).join('');
  }
  let s = '';
  for (let i = 0; i < count; i++) {
    s += alpha[Math.floor(Math.random() * 26)];
  }
  return s;
}

export function generateSessionId() {
  // Compose a recognizable ID: <DeviceType>-<AA>
  const label = detectDeviceLabel();
  const suffix = randomLetters(2);
  return `${label}-${suffix}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let i = -1;
  let size = bytes;
  do {
    size /= 1024;
    i++;
  } while (size >= 1024 && i < units.length - 1);
  return `${size.toFixed(1)} ${units[i]}`;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",", 2)[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes]);
}

export function base64SizeInBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length * 3) / 4 - padding;
}

export function sanitizeText(text: string): string {
  const doc = new DOMParser().parseFromString(text, "text/html");
  return doc.body.textContent || "";
}
