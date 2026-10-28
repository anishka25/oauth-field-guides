// Terminates every running sandbox of this app (stops agent usage immediately).
import { ModalClient } from "modal";
const modal = new ModalClient();
const app = await modal.apps.fromName("oauth-field-guides", { createIfMissing: true });
for await (const sb of modal.sandboxes.list({ appId: app.appId })) {
  await sb.terminate(); console.log("terminated", sb.sandboxId);
}
