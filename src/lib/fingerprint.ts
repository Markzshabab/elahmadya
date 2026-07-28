// Device Fingerprint Generation Utility

export interface FingerprintData {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  platform: string;
  language: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  colorDepth: number;
  pixelRatio: number;
}

export async function generateFingerprint(): Promise<string> {
  const data: FingerprintData = {
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    platform: navigator.platform || '',
    language: navigator.language || '',
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as any).deviceMemory || 0,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio || 1,
  };

  // Create a simple hash from the fingerprint data
  const jsonString = JSON.stringify(data);
  return await simpleHash(jsonString);
}

async function simpleHash(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getStoredFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('device_fingerprint');
}

export function storeFingerprint(fingerprint: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('device_fingerprint', fingerprint);
}

export function hasVoted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('has_voted') === 'true';
}

export function setHasVoted(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('has_voted', 'true');
}
