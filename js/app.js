  async function api(action, payload = {}) {
    const syncUrl = (state.settings.syncUrl || '').trim();
    if (!syncUrl) throw new Error('Add a Google Apps Script web app URL in Settings first.');

    // Google Apps Script web apps commonly redirect their /exec response. Using
    // text/plain keeps this a CORS-simple request and avoids a browser OPTIONS
    // preflight, which Apps Script web apps do not handle.
    const response = await fetch(syncUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });

    if (!response.ok) {
      throw new Error(`Network error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.message || 'Sync request failed.');
    }
    return data;
  }
