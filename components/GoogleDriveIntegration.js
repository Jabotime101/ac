import { useState, useEffect } from 'react';

const GoogleDriveIntegration = ({ onFileUploaded, onFolderSelected }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/google/auth-status');
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
      
      if (data.authenticated) {
        loadFolders();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  const handleGoogleAuth = () => {
    window.location.href = '/auth/google';
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/google/logout');
      const data = await response.json();
      
      if (data.success) {
        setIsAuthenticated(false);
        setFolders([]);
        setSelectedFolder(null);
        setShowFolderSelector(false);
        setError('');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const loadFolders = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/google-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'list-folders',
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setFolders(data.folders);
      } else {
        setError(data.error || 'Failed to load folders');
      }
    } catch (error) {
      console.error('Error loading folders:', error);
      setError('Failed to load folders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFolderSelect = (folder) => {
    setSelectedFolder(folder);
    setShowFolderSelector(false);
    if (onFolderSelected) {
      onFolderSelected(folder);
    }
  };

  const uploadToDrive = async (file) => {
    if (!selectedFolder) {
      setError('Please select a folder first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
          const response = await fetch('/api/google-drive', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'upload',
              fileData: reader.result,
              fileName: file.name,
              folderId: selectedFolder.id,
            }),
          });

          const data = await response.json();
          
          if (data.success) {
            if (onFileUploaded) {
              onFileUploaded(data.file);
            }
            setError('');
          } else {
            setError(data.error || 'Upload failed');
          }
        } catch (error) {
          console.error('Upload error:', error);
          setError('Upload failed');
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setIsLoading(false);
      };
    } catch (error) {
      console.error('Upload error:', error);
      setError('Upload failed');
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google Drive Integration
        </h3>
        <p className="text-gray-600 mb-4">
          Connect your Google Drive to save transcriptions and audio files directly to your folders.
        </p>
        <button
          onClick={handleGoogleAuth}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Connect to Google Drive
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <svg className="w-5 h-5 mr-2 text-green-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google Drive Connected
        </h3>
        <button
          onClick={handleLogout}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Disconnect
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selected Folder
          </label>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFolderSelector(!showFolderSelector)}
              className="flex-1 text-left px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {selectedFolder ? selectedFolder.name : 'Select a folder...'}
            </button>
            <button
              onClick={loadFolders}
              disabled={isLoading}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {showFolderSelector && (
          <div className="border border-gray-200 rounded-md p-3 max-h-48 overflow-y-auto">
            {folders.length === 0 ? (
              <p className="text-gray-500 text-sm">No folders found</p>
            ) : (
              <div className="space-y-1">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleFolderSelect(folder)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 text-sm"
                  >
                    📁 {folder.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        {selectedFolder && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-green-800 text-sm">
              Files will be saved to: <strong>{selectedFolder.name}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleDriveIntegration; 