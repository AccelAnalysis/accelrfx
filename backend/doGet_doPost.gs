/**
 * AccelRFx Request Router
 * Handles incoming GET/POST requests and delegates to Code.gs logic.
 */

function doGet(e) {
  try {
    const params = e.parameter;
    const action = params.action || '';
    switch (action) {
      case 'getRFPs':
        return getRFPs();
      case 'getUsers':
        return getUsers();
      case 'initSheets':
        return ContentService.createTextOutput(initializeSheets());
      default:
        return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || '';
    switch (action) {
      case 'addRFP':
        return addRFP(payload);
      case 'updateCredits':
        return updateCredits(payload);
      default:
        return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid POST action' }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
