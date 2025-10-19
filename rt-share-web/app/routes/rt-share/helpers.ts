function deviceLabelFromUAString(ua: string): string {
  const s = ua || "";
  if (/iPhone/i.test(s)) return "iPhone";
  if (/iPad/i.test(s)) return "iPad";
  if (/Android/i.test(s)) return "Android";
  if (/Windows NT/i.test(s)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(s)) return "Mac";
  if (/CrOS/i.test(s)) return "ChromeOS";
  if (/Linux/i.test(s)) return "Linux";
  if (/Mobile/i.test(s)) return "Mobile";
  return "Device";
}

function deviceLabel(): string {
  try {
    // Prefer userAgentData if available
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    const uaDataPlatform = nav?.userAgentData?.platform as string | undefined;
    if (uaDataPlatform) {
      const p = uaDataPlatform.toLowerCase();
      if (p.includes("mac")) return "Mac";
      if (p.includes("win")) return "Windows";
      if (p.includes("android")) return "Android";
      if (p.includes("ios")) return "iPhone"; // generic iOS
      if (p.includes("chrome os") || p.includes("cros")) return "ChromeOS";
      if (p.includes("linux")) return "Linux";
    }
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return deviceLabelFromUAString(ua);
  } catch {
    return "Device";
  }
}

function randomLetters(len = 2): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < len; i++) {
    const idx = Math.floor(Math.random() * letters.length);
    out += letters[idx];
  }
  return out;
}

export function generateSessionId() {
  const label = deviceLabel();
  const rand = randomLetters(2);
  return `${label}-${rand}`;
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
