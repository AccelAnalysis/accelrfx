# AccelRFx Data Schema Reference

## Google Sheets Tabs

### 1. RFPx_Records
| Column | Type | Description |
|---------|------|--------------|
| ID | String | Unique identifier for the RFPx record |
| Title | String | Title of the RFP or RFQ |
| Type | Enum (RFP, RFQ, RFI) | Type of procurement |
| Issued | Date | Issue date |
| Close | Date | Close date |
| Description | String | Description of the opportunity |
| Tags | String | Comma-separated list of tags |
| Company | String | Issuing company |
| CreatedBy | String | Email of the creator |
| CreatedAt | DateTime | Timestamp of creation |

### 2. User_Profiles
| Column | Type | Description |
|---------|------|--------------|
| UserID | String | Unique user identifier |
| Name | String | Full name |
| Company | String | Company name |
| Email | String | Email address |
| Credits | Integer | Current credit balance |
| PrimaryLat | Float | Primary site latitude |
| PrimaryLng | Float | Primary site longitude |
| SitesJSON | JSON | Array of site objects |

### 3. Credit_Ledger
| Column | Type | Description |
|---------|------|--------------|
| UserID | String | Related user ID |
| Date | Date | Transaction date |
| Change | Integer | Credit amount added or subtracted |
| Reason | String | Reason for change |
| NewBalance | Integer | Resulting balance |

## API Endpoints (Apps Script)
- `GET?action=getRFPs` → Returns all RFPx records in JSON
- `GET?action=getUsers` → Returns all user profiles in JSON
- `POST { action: 'addRFP' }` → Creates new RFP record
- `POST { action: 'updateCredits' }` → Updates user credit balance and ledger