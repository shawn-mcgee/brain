type GoogleToken = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};
type TokenClient = {
  requestAccessToken: (options: { prompt: string }) => void;
};
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            include_granted_scopes: boolean;
            callback: (token: GoogleToken) => void;
            error_callback: (error: { type: string }) => void;
          }) => TokenClient;
          revoke: (token: string, callback: () => void) => void;
        };
      };
    };
  }
}
export type Session = {
  token: string;
  expiresAt: number;
  name: string;
  email: string;
};
export function login(
  clientId: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<{ token: string; expiresAt: number }> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2)
      return reject(
        new Error(
          "Google sign-in has not loaded. Check your connection and try again.",
        ),
      );
    if (!clientId)
      return reject(new Error("Add your Google OAuth client ID in Settings."));
    if (options.signal?.aborted) return reject(new Error("Sign-in canceled."));
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const cancel = () => fail(new Error("Sign-in canceled."));
    options.signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(
      () =>
        fail(
          new Error(
            "Google did not finish sign-in. Close its popup and try again. If it keeps happening, check browser privacy extensions and that this site origin is authorized for the Google client ID.",
          ),
        ),
      options.timeoutMs ?? 90000,
    );
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        include_granted_scopes: false,
        callback: (response) => {
          if (settled) return;
          if (response.error) {
            fail(new Error(response.error_description || response.error));
            return;
          }
          const expiresIn = Number(response.expires_in);
          if (
            !response.access_token ||
            !Number.isFinite(expiresIn) ||
            expiresIn <= 0
          ) {
            fail(
              new Error(
                "Google returned an incomplete sign-in response. Please try again.",
              ),
            );
            return;
          }
          settled = true;
          cleanup();
          resolve({
            token: response.access_token,
            expiresAt: Date.now() + expiresIn * 1000,
          });
        },
        error_callback: (error) =>
          fail(
            new Error(
              error.type === "popup_closed"
                ? "Sign-in was canceled."
                : "Google could not open sign-in. Allow popups for this site.",
            ),
          ),
      });
      client.requestAccessToken({ prompt: "select_account" });
    } catch {
      fail(
        new Error(
          "Google sign-in could not start. Reload the page and try again.",
        ),
      );
    }
  });
}
export function logout(token: string) {
  window.google?.accounts.oauth2.revoke(token, () => {});
}
