# PlantScan: Advanced Plant Analysis Tool

## Overview

PlantScan is an AI-powered web application that enables users to upload plant images and receive instant, detailed analysis. Leveraging Google Gemini AI, the tool identifies plant species, assesses health, and provides personalized care recommendations. Users can download comprehensive PDF reports for documentation or sharing.

## Features

- **AI-Driven Plant Identification:** Utilizes Google Gemini 1.5 Flash model for accurate species recognition.
- **Health Assessment:** Analyzes plant condition and highlights potential issues.
- **Care Recommendations:** Offers tailored advice for optimal plant care.
- **PDF Report Generation:** Exports analysis and images to professional, timestamped PDF documents.
- **User-Friendly Interface:** Drag-and-drop image upload, real-time preview, and responsive design.
- **Fast Processing:** Handles concurrent requests with sub-3-second response times.

## Technology Stack

- Node.js
- Express.js
- Google Generative AI SDK
- Multer (file uploads)
- PDFKit (PDF generation)
- HTML5, CSS3, JavaScript (frontend)
-NodeMailer is used for forget password

## Getting Started

### Prerequisites

- Node.js and npm installed
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Sanjilsharma7074/GreenLens.git
   cd GreenLens
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory:
   ```
   GEMINI_API_KEY=your_google_gemini_api_key
   PORT=5001
   ## Environment Variables

GEMINI_API_KEY=your_google_gemini_api_key
PORT=5001
EMAIL_USER=your_email
EMAIL_PASS=your_email_app_password
JWT_SECRET=your_secret_key

   ```
4. Start the server (development):
   ```bash
   npm run dev    # uses nodemon to auto-restart on changes
   ```

5. Useful helper commands
   - Restart (kills any process on port 5001 then starts):
     ```bash
     npm run restart
     ```
   - Windows PowerShell helper:
     ```powershell
     .\scripts\restart-server.ps1
     ```

Notes:
- `npm run dev` watches the project and restarts automatically.
- `npm run restart` is handy if port 5001 is left open by an orphaned process.
5. Open your browser and navigate to [http://localhost:5001](http://localhost:5001)

## Usage

1. Upload a plant image via the web interface.
2. Click "Analyze Plant" to receive instant results.
3. Download the PDF report for your records.

## Troubleshooting

- **API Rate Limits:** If you encounter a "429 Too Many Requests" error, wait a few minutes or obtain a new API key.
- **Port Issues:** Ensure port 5001 is free or change the `PORT` value in `.env`.

## License




