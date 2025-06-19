# Google Drive Integration Setup Guide

This guide will walk you through setting up Google Drive integration for the Audio Transcription App.

## Prerequisites

- Google Cloud Platform account
- Node.js 16+ installed
- Basic knowledge of Google Cloud Console

## Step 1: Google Cloud Platform Setup

### 1.1 Create a New Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "Audio Transcription App")
5. Click "Create"

### 1.2 Enable Required APIs

1. In your new project, go to "APIs & Services" > "Library"
2. Search for and enable these APIs:
   - **Google Drive API**
   - **Google Picker API**

### 1.3 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: "Audio Transcription App"
   - User support email: Your email
   - Developer contact information: Your email
   - Save and continue through the steps

4. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: "Audio Transcription Web Client"
   - Authorized JavaScript origins:
     ```
     http://localhost:10000
     https://your-app-name.onrender.com
     ```
   - Authorized redirect URIs:
     ```
     http://localhost:10000/auth/google/callback
     https://your-app-name.onrender.com/auth/google/callback
     ```
   - Click "Create"

5. **Important**: Copy the Client ID and Client Secret - you'll need these for the environment variables.

## Step 2: Environment Variables

Create a `.env.local` file in your project root with the following variables:

```env
# OpenAI API Key (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Google OAuth Credentials (from Step 1.3)
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here

# Redirect URI (use localhost for development)
GOOGLE_REDIRECT_URI=http://localhost:10000/auth/google/callback

# Session Secret (generate a random string)
SESSION_SECRET=your-random-session-secret-here

# Optional: Google API Key (if needed for additional services)
GOOGLE_API_KEY=your-google-api-key-here

# Node Environment
NODE_ENV=development

# Port (optional)
PORT=10000
```

### Generate Session Secret

You can generate a random session secret using Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Run the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Step 5: Test the Integration

1. Open your browser to `http://localhost:10000`
2. Click "Connect to Google Drive"
3. Sign in with your Google account
4. Grant permissions to the app
5. Select a folder from your Google Drive
6. Upload an audio file and test transcription
7. Try saving the transcript to Google Drive

## Deployment to Render

### 1. Create Render Account

1. Go to [Render](https://render.com/)
2. Sign up with your GitHub account
3. Create a new Web Service

### 2. Connect Repository

1. Connect your GitHub repository
2. Choose the repository with your audio transcription app
3. Set the following:
   - Name: `audio-transcription-app`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

### 3. Environment Variables

Add these environment variables in Render dashboard:

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `GOOGLE_CLIENT_ID` | Your Google Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google Client Secret |
| `GOOGLE_REDIRECT_URI` | `https://your-app-name.onrender.com/auth/google/callback` |
| `SESSION_SECRET` | Your random session secret |
| `NODE_ENV` | `production` |

### 4. Update Google Cloud Console

1. Go back to Google Cloud Console
2. Update your OAuth 2.0 Client ID
3. Add your Render URL to authorized origins and redirect URIs:
   ```
   https://your-app-name.onrender.com
   https://your-app-name.onrender.com/auth/google/callback
   ```

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" Error**
   - Ensure the redirect URI in Google Cloud Console exactly matches your app's callback URL
   - Check for trailing slashes or protocol mismatches

2. **"invalid_client" Error**
   - Verify your Client ID and Client Secret are correct
   - Make sure you're using the right credentials for your environment

3. **Session Issues**
   - Ensure `SESSION_SECRET` is set and consistent
   - Check that cookies are enabled in your browser

4. **File Upload Failures**
   - Verify Google Drive API is enabled
   - Check that the user has granted the necessary permissions
   - Ensure the selected folder is accessible

### Debug Mode

Enable detailed logging by setting `NODE_ENV=development` and checking the browser console and server logs.

### Testing OAuth Flow

1. Clear your browser cookies and cache
2. Try the OAuth flow in an incognito/private window
3. Check the Network tab in browser dev tools for any failed requests

## Security Best Practices

1. **Never commit `.env.local` to version control**
2. **Use strong, random session secrets**
3. **Enable HTTPS in production**
4. **Regularly rotate API keys and secrets**
5. **Monitor Google Cloud Console for unusual activity**

## Support

If you encounter issues:

1. Check the terminal logs for detailed error messages
2. Verify all environment variables are correctly set
3. Ensure Google Cloud Console settings match your deployment
4. Create an issue in the GitHub repository with detailed error information 