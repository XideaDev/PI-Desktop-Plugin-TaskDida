import { execFile } from 'node:child_process';

/**
 * Checks whether the PI-Desktop window/process is currently in the foreground (focused).
 * Returns true if the window is currently focused, false if blurred/in background.
 * In case of permission errors or platform unsupported, returns false (fail-safe).
 */
export async function isAppFocused(): Promise<boolean> {
  const platform = process.platform;

  return new Promise((resolve) => {
    try {
      if (platform === 'darwin') {
        // macOS AppleScript check (runs in < 40ms)
        const script = 'tell application "System Events" to get frontmost of process "PI-Desktop"';
        execFile('osascript', ['-e', script], { timeout: 800 }, (err, stdout) => {
          if (err || !stdout) {
            resolve(false);
            return;
          }
          resolve(stdout.trim().toLowerCase() === 'true');
        });
      } else if (platform === 'win32') {
        // Windows foreground window process check
        const script = `
          $fg = [System.IntPtr]::Zero
          Add-Type -TypeDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();' -Name Win32 -Namespace Native
          $fg = [Native.Win32]::GetForegroundWindow()
          $pi = Get-Process -Name "PI-Desktop" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -eq $fg }
          if ($pi) { Write-Output "true" } else { Write-Output "false" }
        `;
        execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 1200 }, (err, stdout) => {
          if (err || !stdout) {
            resolve(false);
            return;
          }
          resolve(stdout.trim().toLowerCase() === 'true');
        });
      } else {
        // Linux / other platforms: default to false
        resolve(false);
      }
    } catch {
      resolve(false);
    }
  });
}
