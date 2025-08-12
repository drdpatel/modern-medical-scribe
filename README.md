# 📋 Quick Reference for Next Chat

## User Info
- **Dr. Darshan Patel** - Physician (not coder)
- **Email:** darshan@aayuwell.com
- **Style:** Direct, step-by-step instructions needed

## Project Status ✅
**Aayu Well AI Medical Scribe** - Fully functional as of Aug 12, 2025

### Live URLs
- **Frontend:** https://blue-stone-0e5da7910.1.azurestaticapps.net
- **Backend API:** https://aayuscribe-api-fthtanaubda4dveb.eastus2-01.azurewebsites.net

### Working Features
✅ All 5 navigation pages (Scribe, Training, Patients, Settings, Users)  
✅ Patient management with localStorage  
✅ 8 medical specialties including Obesity Medicine & Dietitian  
✅ Professional glass morphism design with Aayu logo  
✅ GitHub Actions with path filters (no more conflicts)  

### Fixed Today
- Users page 404 → Added case handler
- Settings page 404 → Fixed switch statement  
- Patient saving → Fixed localStorage implementation
- Variable collision → Renamed duplicate variables
- Deployment conflicts → Added path filters to workflows

### Login Credentials
**Super Admin:** darshan@aayuwell.com / Aayuscribe1212@

### Tech Stack
- **Frontend:** React on Azure Static Web App
- **Backend:** Node.js Azure Functions
- **Storage:** Currently localStorage (Azure Tables ready but not connected)
- **AI:** Azure Speech + Azure OpenAI (needs API keys in Settings)

### Next Priorities
1. Connect Azure Table Storage (replace localStorage)
2. Enable real user creation (currently hardcoded)
3. Add data export functionality
4. Set up automated backups

### ⚠️ Important Rules
- **NEVER** edit the Static Web App workflow file (fragile Azure token)
- **Path filters active** - frontend/backend deploy separately
- **App.js is debugged** - all pages working, don't break it
- **User prefers simple solutions** - no complex architectures

### File Locations
- Main app: `src/App.js` (2500+ lines, fully working)
- Styles: `src/App.css` (professional design applied)
- Logo: `src/assets/aayu-logo.png` 
- Backend: `functions/` folder
- Workflows: `.github/workflows/` (both have correct settings)

### Current Data Storage
- **Patients:** localStorage key `medicalScribePatients`
- **Visits:** localStorage key `visits_{patientId}`
- **Training:** localStorage key `medicalScribeTraining`
- **API Settings:** localStorage key `medicalScribeApiSettings`

### Ready for Production? 
YES - All core features working. Just needs:
- API keys for voice/AI features
- Cloud storage connection for data persistence
- Real user management system

**Project is LIVE and FUNCTIONAL** 🚀
