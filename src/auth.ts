type GoogleToken = { access_token: string; expires_in: number; error?: string };
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
): Promise<{ token: string; expiresAt: number }> {
  return new Promise((resolve, reject) => {
    if (!window.google)
      return reject(
        new Error(
          "Google sign-in has not loaded. Check your connection and try again.",
        ),
      );
    if (!clientId)
      return reject(new Error("Add your Google OAuth client ID in Settings."));
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      include_granted_scopes: false,
      callback: (response) =>
        response.error
          ? reject(new Error(response.error))
          : resolve({
              token: response.access_token,
              expiresAt: Date.now() + response.expires_in * 1000,
            }),
      error_callback: (error) =>
        reject(
          new Error(
            error.type === "popup_closed"
              ? "Sign-in was canceled."
              : "Google could not open sign-in. Allow popups for this site.",
          ),
        ),
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}
export function logout(token: string) {
  window.google?.accounts.oauth2.revoke(token, () => {});
}
