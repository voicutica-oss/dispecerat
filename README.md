<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/48152be3-c441-4098-bb51-2bb133936dd1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
# Acces la versiunea web Dispecerat

Versiunea web de producție acceptă numai conectarea cu Google. Datele sunt disponibile numai dacă acel cont are acces la foaia configurată. Dreptul de vizualizare nu permite salvarea modificărilor. Pentru acces exclusiv al echipei, păstrează partajarea foii pe **Restricționat** și partajeaz-o cu persoanele sau grupurile aprobate.

## Configurarea pentru administrator

1. În proiectul Google Cloud, activează Google Drive API și configurează un client OAuth de tip **Web application**. Înregistrează URI-ul `https://dispecerat.netlify.app/api/auth/google/callback`. Clientul solicită `openid`, `email` și `https://www.googleapis.com/auth/drive.metadata.readonly`. Configurează ecranul de consimțământ și includerea conturilor echipei. Pentru o echipă din aceeași organizație Google Workspace, folosește audiența **Internal**, dacă este disponibilă.
2. În proiectul Apps Script al foii, actualizează `Code.gs` și configurează proprietățile scriptului `DISPECERAT_SHEET_ID` (doar ID-ul foii) și `DISPECERAT_SCRIPT_KEY` (o cheie nouă, unică, aleatorie). Publică o nouă versiune a aplicației web, cu executare în numele administratorului și acces pentru solicitările serverului. Arhivează implementările vechi care acceptau cheia încorporată anterior.
3. Configurează `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `DISPECERAT_SHEET_ID`, `DISPECERAT_SCRIPT_URL` (adresa care se termină în `/exec`) și `DISPECERAT_SCRIPT_KEY` în mediul de producție al serverului. Cheia trebuie să coincidă cu proprietatea din Apps Script. Nu o include în aplicația web, în URL-ul partajat sau în surse.
4. Activează Google ca furnizor de autentificare al aplicației. Pagina de producție trebuie să fie accesibilă fără autentificare pe platforma de găzduire, astfel încât colegii să poată ajunge la butonul Google. API-ul rămâne protejat de verificarea drepturilor pe foaie. Înainte de a deschide accesul public la pagina de intrare, elimină accesul la implementările vechi care publicau exportul de date.

După activare, distribuie doar `https://dispecerat.netlify.app`. La prima conectare, Google poate cere și consimțământul pentru verificarea accesului la foaie. Utilizatorii nu au nevoie de cont Netlify sau de cheia Apps Script.
