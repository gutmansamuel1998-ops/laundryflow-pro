import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { currentRuntime } from '@/lib/runtimeConfig';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// In a browser this is unchanged (serverUrl '' = same origin). Inside the native app the web files
// are bundled on the device, so requests must go to the published site's absolute address.
const runtime = currentRuntime(appBaseUrl);

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: runtime.serverUrl,
  requiresAuth: false,
  appBaseUrl: runtime.appBaseUrl
});
