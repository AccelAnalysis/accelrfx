// config.js — ESM + global bridge for AccelRFx
// Fill in WEBAPP_URL and SHEET_ID for your deployment.

export const CONFIG = {
  WEBAPP_URL: 'YOUR_APPS_SCRIPT_WEBAPP_URL',  // e.g., https://script.google.com/macros/s/AKfycb.../exec
  SHEET_ID:   'YOUR_SHEET_ID_HERE',
  ENV:        'prod',

  // ---- Credit system (baseline) ----
  CREDITS: {
    STARTING: 100,          // default starting balance for a new account
    MIN_BALANCE: 0,         // do not allow negative by default
    ACTION_COSTS: {
      CREATE_RFx: 10,       // submitting/creating an RFx (RFP/RFQ/RFI/IFB) costs 10 credits
      RESPOND_RFx: 2,       // responding to an RFx costs 2 credits
      APPROVE_RFx: 2,       // approving an RFx costs 2 credits
      SEARCH: 1,            // baseline charge for a search action (map/search UI)
      OTHER: 0
    }
  }
};

// Expose globally for classic scripts
try { if (typeof window !== 'undefined') window.CONFIG = CONFIG; } catch(_) {}
export default CONFIG;
