# Audio Transcription App with Google Drive Integration

A modern web application for transcribing audio files using AI models, with seamless Google Drive integration for file storage and management.

## Features

- 🎵 **Audio Transcription**: Support for multiple AI providers (OpenAI Whisper, LemonFox.ai)
- ☁️ **Google Drive Integration**: Direct upload and storage of audio files and transcripts
- 📁 **Folder Management**: Select specific Google Drive folders for file organization
- 💰 **Cost Estimation**: Real-time cost calculation based on audio duration
- 📊 **Progress Tracking**: Live progress updates during transcription
- 🎨 **Modern UI**: Beautiful, responsive interface built with Tailwind CSS
- 📝 **Logging System**: Comprehensive terminal-style logging for debugging

## Prerequisites

- Node.js 16+ 
- npm or yarn
- Google Cloud Platform account
- OpenAI API key (for transcription)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/yourname/your-repo.git
cd your-repo
npm install
```

### 2. Google Cloud Platform Setup

#### Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing for the project

#### Enable Required APIs

1. Go to "APIs & Services" > "Library"
2. Search for and enable the following APIs:
   - **Google Drive API**
   - **Google Picker API**

#### Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application" as the application type
4. Add authorized origins:
   - `http://localhost:10000` (for development)
   - `https://your-app-name.onrender.com` (for production)
5. Add authorized redirect URIs:
   - `http://localhost:10000/auth/google/callback` (for development)
   - `https://your-app-name.onrender.com/auth/google/callback` (for production)
6. Note down the **Client ID** and **Client Secret**

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:10000/auth/google/callback

# NextAuth URL
NEXTAUTH_URL=http://localhost:10000

# Session Secret (generate a random string)
SESSION_SECRET=your_random_session_secret_here

# Optional: Google API Key (if using additional Google services)
GOOGLE_API_KEY=your_google_api_key_here
```

### 4. Render Deployment Setup

If deploying to Render:

1. Create a new Web Service
2. Connect your GitHub repository
3. Set the following environment variables in Render dashboard:
   - `OPENAI_API_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL` (set to your Render URL + `/auth/google/callback`)
   - `NEXTAUTH_URL` (set to your Render URL)
   - `SESSION_SECRET`
   - `GOOGLE_API_KEY` (optional)

### 5. Run the Application

#### Development
```bash
npm run dev
```

#### Production
```bash
npm run build
npm start
```

The app will be available at `http://localhost:10000`

## Usage

### 1. Connect to Google Drive

1. Click the "Connect to Google Drive" button
2. Authorize the application in the Google OAuth popup
3. Select a folder from your Google Drive for file storage

### 2. Upload and Transcribe Audio

1. Choose your preferred transcription provider
2. Drag and drop an audio file or click "Choose File"
3. Click "Start Transcription"
4. Monitor progress in the terminal logs
5. Download the transcript or save it directly to Google Drive

### 3. File Management

- All uploaded files and transcripts are automatically saved to your selected Google Drive folder
- View uploaded files in the "Files Uploaded to Google Drive" section
- Click "View in Drive" to open files directly in Google Drive

## API Endpoints

### Authentication
- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - OAuth callback handler
- `GET /api/google/auth-status` - Check authentication status
- `GET /api/google/logout` - Logout and clear session

### Google Drive Operations
- `POST /api/google-drive` - Upload files and list folders
  - Action: `upload` - Upload file to Google Drive
  - Action: `list-folders` - List user's Google Drive folders

### Transcription
- `POST /api/transcribe` - Transcribe audio file

## Security Considerations

- OAuth tokens are stored securely in server-side sessions
- All API keys are kept server-side and never exposed to the client
- HTTPS is required for production deployments
- Session secrets should be strong, random strings

## Troubleshooting

### Common Issues

1. **OAuth Error**: Ensure redirect URIs match exactly in Google Cloud Console
2. **Session Issues**: Check that `SESSION_SECRET` is set and consistent
3. **File Upload Failures**: Verify Google Drive API is enabled and credentials are correct
4. **Transcription Errors**: Check OpenAI API key and quota limits

### Debug Mode

Enable detailed logging by setting `NODE_ENV=development` in your environment variables.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the terminal logs for detailed error messages
- Verify all environment variables are correctly set 