// GoogleDriveUploader: sign in users and upload transcript.txt to Drive
import React, { useEffect, useState } from 'react';
import { gapi } from 'gapi-script';

const GoogleDriveUploader = ({ transcript }) => {
  const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    gapi.load("client:auth2", () =>
      gapi.client.init({
        clientId: CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.file",
      })
    );
  }, [CLIENT_ID]);

  const handleSignIn = async () => {
    const auth = gapi.auth2.getAuthInstance();
    await auth.signIn();
    const token = auth.currentUser.get().getAuthResponse().access_token;
    setAccessToken(token);
    setIsSignedIn(true);
  };

  const handleUpload = async () => {
    if (!transcript) return alert("No transcript to upload.");
    
    const metadata = { name: "transcript.txt", mimeType: "text/plain" };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", new Blob([transcript], { type: "text/plain" }));
    
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
      }
    );
    
    const result = await res.json();
    alert(`Uploaded: ${result.name}`);
  };

  return (
    <div>
      {!isSignedIn
        ? <button onClick={handleSignIn}>Sign in with Google</button>
        : <button onClick={handleUpload}>Save to Google Drive</button>
      }
    </div>
  );
};

export default GoogleDriveUploader; 