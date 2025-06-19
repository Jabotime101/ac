import { OAuth2Client } from 'google-auth-library';

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in session
    req.session.googleTokens = tokens;
    
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    res.redirect('/?success=connected');
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect('/?error=auth_error');
  }
} 