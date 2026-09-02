import * as os from "os";

let oldUmask: number | null = null;

export function applySocketUmask(): void {
  if (os.platform() === "win32") return;
  // 0o117 inverts to 0o660 (rw-rw----)
  oldUmask = process.umask(0o117);
}

export function restoreSocketUmask(): void {
  if (os.platform() === "win32" || oldUmask === null) return;
  process.umask(oldUmask);
  oldUmask = null;
}
