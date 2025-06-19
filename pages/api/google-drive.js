import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, fileData, fileName, folderId, id_token } = req.body;

  try {
    let oauth2Client;

    if (action === 'exchange_token') {
      // Handle token exchange for client-side OAuth
      if (!id_token) {
        return res.status(400).json({ error: 'ID token is required' });
      }

      oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Exchange ID token for access token
      const ticket = await oauth2Client.verifyIdToken({
        idToken: id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const user_id = payload['sub'];

      // Get access token using authorization code flow
      // For now, we'll use the ID token as a temporary solution
      // In production, you'd want to implement proper OAuth2 flow
      
      return res.status(200).json({
        access_token: id_token, // This is temporary - should be proper access token
        user_id: user_id,
      });
    }

    // For other actions, check if we have access token from client
    const accessToken = req.headers.authorization?.replace('Bearer ', '') || id_token;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Set up Google Drive client with access token
    oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    switch (action) {
      case 'upload':
        if (!fileData || !fileName) {
          return res.status(400).json({ error: 'File data and name are required' });
        }

        // Convert base64 to buffer
        const fileBuffer = Buffer.from(fileData.split(',')[1], 'base64');
        
        const fileMetadata = {
          name: fileName,
          parents: folderId ? [folderId] : undefined,
        };

        const media = {
          mimeType: 'text/plain', // For transcript files
          body: fileBuffer,
        };

        const uploadedFile = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id,name,webViewLink',
        });

        return res.status(200).json({
          success: true,
          file: uploadedFile.data,
        });

      case 'list-folders':
        const folders = await drive.files.list({
          q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
          fields: 'files(id,name,parents)',
          orderBy: 'name',
        });

        return res.status(200).json({
          success: true,
          folders: folders.data.files,
        });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Google Drive API error:', error);
    
    // Handle token refresh if needed
    if (error.code === 401) {
      return res.status(401).json({ error: 'Authentication expired. Please sign in again.' });
    }
    
    return res.status(500).json({ error: 'Google Drive operation failed', details: error.message });
  }
} 