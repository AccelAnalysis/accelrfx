# AccelRFx Platform

## Overview
AccelRFx is a unified, map-based Request for Proposal (RFPx) platform that integrates both issuers (buyers) and responders (suppliers) within a single interactive interface. Built using **HTML, JavaScript, Leaflet.js**, and **Google Apps Script**, it combines discovery, bidding, and analytics under one cohesive ecosystem.

### Domain
https://accelrfx.com

---

## 🧭 Core Features
- Unified Map Interface (both issuers and responders)
- Credit System (100 starting credits per user)
- RFPx Creation & Management
- Dynamic Map Search and Marker Interaction
- Admin Console for Credit & Record Management
- Google Sheets Backend via Apps Script

---

## 🗂️ Project Structure
```
AccelRFx/
├── index.html
├── proposal.html
├── admin.html
├── /scripts/
│   ├── app.js
│   ├── profile.js
│   ├── shared.js
│   ├── config.js
│   ├── proposal.js
│   └── admin.js
├── /styles/
│   ├── styles.css
│   └── theme.css
├── /backend/
│   └── Code.gs
├── /data/
│   ├── sample_rfps.csv
│   ├── sample_users.csv
│   └── schema_reference.md
├── /assets/
│   ├── accel_logo.png
│   └── icons/
│       ├── user_marker.png
│       ├── company_marker.png
│       ├── cluster_icon.png
│       ├── dashboard.svg
│       ├── rfpx.svg
│       ├── analytics.svg
│       ├── settings.svg
│       └── notification.svg
├── manifest.json
└── README.md
```

---

## 🚀 Deployment

### 1. Frontend
Host via **GitHub Pages** or any static web host.  
For local testing:
```bash
python3 -m http.server 8000
```
Then visit:
```
http://localhost:8000/index.html
```

### 2. Backend
Deploy `/backend/Code.gs` in Google Apps Script:
1. Create a new Apps Script project.
2. Paste in the contents of `Code.gs`.
3. Link it to a Google Sheet.
4. Deploy as Web App (execute as “Me”, access: Anyone).

### 3. Domain Integration
Map `https://accelrfx.com` to GitHub Pages via GoDaddy DNS.

---

## 📊 Data Model
See `/data/schema_reference.md` for complete data dictionary.

---

## 🧩 Credits
- **Developed by:** Accel Analysis | Industrial Diplomacy Division  
- **Brand Colors:** #2F5597 (Primary), #FFD965 (Accent), #DCE6F5 (Light Gray)  
- **Logo:** © 2025 Accel Analysis  
- **License:** Proprietary - All rights reserved.
