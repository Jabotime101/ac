const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const express = require('express');
const cookieParser = require('cookie-parser');
const { google } = require('googleapis');

// Import Redis session configuration
const setupSession = require('./session');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 10000;

console.log(`Starting server on ${hostname}:${port}`);

// Google OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/auth/google/callback`
);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Create Express app
const expressApp = express();

// Session configuration
expressApp.use(cookieParser());
setupSession(expressApp);

// Google OAuth routes
expressApp.get('/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  
  res.redirect(authUrl);
});

expressApp.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.googleTokens = tokens;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        res.redirect('/?error=session_error');
      } else {
        res.redirect('/?success=connected');
      }
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect('/?error=auth_error');
  }
});

expressApp.get('/api/google/auth-status', (req, res) => {
  const isAuthenticated = !!(req.session.googleTokens && req.session.googleTokens.access_token);
  res.json({ 
    authenticated: isAuthenticated,
    hasRefreshToken: !!(req.session.googleTokens && req.session.googleTokens.refresh_token)
  });
});

expressApp.get('/api/google/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      res.json({ success: false, error: 'Logout failed' });
    } else {
      res.json({ success: true });
    }
  });
});

// Handle all other routes with Next.js
expressApp.all('*', (req, res) => {
  return handle(req, res);
});

app.prepare().then(() => {
  expressApp.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
}); 