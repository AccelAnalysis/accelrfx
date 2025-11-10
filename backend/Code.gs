/** Code.gs — Google Apps Script backend for AccelRFx (RFx)
 *  Deploy as Web App: "Anyone" can access (read/write) for testing.
 *  Sheets used:
 *   - "Sites" columns: id,name,lat,lon
 *   - "RFx" columns: id,status,createdAt,updatedAt,payloadJSON
 *  Set SHEET_ID in config.js on the client; here we also support a fallback.
 */

// ----- CONFIG -----
const SHEET_ID = 'YOUR_SHEET_ID_HERE'; // keep as placeholder until set
const SITES_SHEET = 'Sites';
const RFX_SHEET   = 'RFx';

// ----- Entrypoints -----
function doGet(e){
  try{
    const action = (e.parameter.action || '').toString();
    if (action === 'getSites') return jsonOk({ data: getSites_() });
    if (action === 'getRfx')   return jsonOk({ data: getRfx_(e.parameter.id) });
    // health check or unknown
    return jsonOk({ ok:true, msg:'AccelRFx WebApp is live.' });
  }catch(err){ return jsonErr(err); }
}

function doPost(e){
  try{
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = (body.action || '').toString();

    if (action === 'saveRfx')    return jsonOk({ data: saveRfx_(body.payload) });
    if (action === 'publishRfx') return jsonOk({ data: publishRfx_(body.id) });
    if (action === 'cancelRfx')  return jsonOk({ data: cancelRfx_(body.id, body.reason) });

    return jsonErr(new Error('Unknown action.'));
  }catch(err){ return jsonErr(err); }
}

// ----- Helpers: JSON responses -----
function jsonOk(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}
function jsonErr(err){
  const out = { error: (err && err.message) ? err.message : String(err) };
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----- Sheet utils -----
function getBook_(){
  if (!SHEET_ID || SHEET_ID === 'YOUR_SHEET_ID_HERE') throw new Error('SHEET_ID not set.');
  return SpreadsheetApp.openById(SHEET_ID);
}
function getSheet_(name){
  const ss = getBook_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}
function ensureHeaders_(sheet, headers){
  const range = sheet.getRange(1,1,1,headers.length);
  const existing = range.getValues()[0];
  let needs = false;
  for (let i=0;i<headers.length;i++){ if (existing[i] !== headers[i]) { needs=true; break; } }
  if (needs) range.setValues([headers]);
}

// ----- Sites -----
function getSites_(){
  const sh = getSheet_(SITES_SHEET);
  ensureHeaders_(sh, ['id','name','lat','lon']);
  const rows = sh.getDataRange().getValues();
  const out = [];
  for (let r=2; r<=rows.length; r++){
    const id  = sh.getRange(r,1).getValue();
    const nm  = sh.getRange(r,2).getValue();
    const lat = sh.getRange(r,3).getValue();
    const lon = sh.getRange(r,4).getValue();
    if (!id) continue;
    out.push({ id:String(id), name:String(nm||''), lat:Number(lat||0), lon:Number(lon||0) });
  }
  return out;
}

// ----- RFx core -----
function saveRfx_(payload){
  const sh = getSheet_(RFX_SHEET);
  ensureHeaders_(sh, ['id','status','createdAt','updatedAt','payloadJSON']);

  const now = new Date();
  let id = payload && payload.meta && payload.meta.id ? String(payload.meta.id) : null;

  if (!id){
    id = 'rfx_' + Utilities.getUuid();
    const row = [ id, 'DRAFT', now, now, JSON.stringify(payload || {}) ];
    sh.appendRow(row);
  } else {
    // update by id
    const data = sh.getDataRange().getValues();
    for (let r=2; r<=data.length; r++){
      const rid = sh.getRange(r,1).getValue();
      if (String(rid) === id){
        sh.getRange(r,2).setValue('DRAFT');
        sh.getRange(r,3).setValue(sh.getRange(r,3).getValue() || now);
        sh.getRange(r,4).setValue(now);
        sh.getRange(r,5).setValue(JSON.stringify(payload || {}));
        break;
      }
    }
  }
  return { id };
}

function getRfx_(id){
  if (!id) return null;
  const sh = getSheet_(RFX_SHEET);
  const data = sh.getDataRange().getValues();
  for (let r=2; r<=data.length; r++){
    const rid = sh.getRange(r,1).getValue();
    if (String(rid) === String(id)){
      return {
        id: rid,
        status: sh.getRange(r,2).getValue(),
        createdAt: sh.getRange(r,3).getValue(),
        updatedAt: sh.getRange(r,4).getValue(),
        payload: JSON.parse(sh.getRange(r,5).getValue() || '{}')
      };
    }
  }
  return null;
}

function publishRfx_(id){
  if (!id) throw new Error('Missing id');
  const sh = getSheet_(RFX_SHEET);
  const now = new Date();
  const data = sh.getDataRange().getValues();
  for (let r=2; r<=data.length; r++){
    const rid = sh.getRange(r,1).getValue();
    if (String(rid) === String(id)){
      sh.getRange(r,2).setValue('PUBLISHED');
      sh.getRange(r,4).setValue(now);
      return { id, status:'PUBLISHED' };
    }
  }
  throw new Error('RFx not found.');
}

function cancelRfx_(id, reason){
  if (!id) throw new Error('Missing id');
  const sh = getSheet_(RFX_SHEET);
  const now = new Date();
  const data = sh.getDataRange().getValues();
  for (let r=2; r<=data.length; r++){
    const rid = sh.getRange(r,1).getValue();
    if (String(rid) === String(id)){
      sh.getRange(r,2).setValue('CANCELED');
      sh.getRange(r,4).setValue(now);
      // append the cancel reason into payload.cancelDesc
      try{
        const obj = JSON.parse(sh.getRange(r,5).getValue() || '{}');
        const pre = (obj.meta && obj.meta.cancelDesc) ? (obj.meta.cancelDesc + '\n') : '';
        if (!obj.meta) obj.meta = {};
        obj.meta.cancelDesc = pre + 'Reason: ' + String(reason || '');
        sh.getRange(r,5).setValue(JSON.stringify(obj));
      }catch(_){}
      return { id, status:'CANCELED' };
    }
  }
  throw new Error('RFx not found.');
}
