import { getCurrentWindow } from "@tauri-apps/api/window";
import { sendNotification } from "@tauri-apps/plugin-notification";

/**
 * Shows an OS notification, but only while the window is not focused: with
 * the app in front, the in-app toast already says the same thing.
 *
 * No permission is requested first: on desktop the notification plugin
 * reports permission as granted without asking, and the OS simply drops the
 * notification if the user has turned the app's notifications off.
 */
export async function notifyUnlessFocused(
  title: string,
  body: string,
): Promise<void> {
  if (await getCurrentWindow().isFocused()) return;
  sendNotification({ title, body });
}
