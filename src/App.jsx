import React, { useState, useEffect, useRef } from 'react';

// --- Configuration ---
// The configuration is now loaded from a .env.local file in your project's root directory.
// Create a file named .env.local and add the following variables.
// NOTE: For Vite projects, environment variables MUST start with the VITE_ prefix.
//
// VITE_GOOGLE_API_KEY=YOUR_API_KEY
// VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
// VITE_FOLDER_ID_VACATION=YOUR_FOLDER_ID_FOR_VACATION_PHOTOS
// VITE_FOLDER_ID_FAMILY=YOUR_FOLDER_ID_FOR_FAMILY_EVENTS
// VITE_FOLDER_ID_PROJECTS=YOUR_FOLDER_ID_FOR_PROJECT_DOCS
//
// After creating or updating the .env.local file, you MUST restart your development server.

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// The API discovery document and the scope for file uploads.
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

// Reconstruct the folder IDs object from environment variables.
const GOOGLE_DRIVE_FOLDER_IDS = {
  'Vacation Photos': import.meta.env.VITE_FOLDER_ID_NIKKAH,
  'Family Events': import.meta.env.VITE_FOLDER_ID_MAYUN_RAMIN,
  'Project Documents': import.meta.env.VITE_FOLDER_ID_MAYUN_IRZUM,
};


// --- Components ---

const ProgressBar = ({ progress }) => {
  return (
    <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700 overflow-hidden">
      <div
        className="bg-blue-600 h-4 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-full transition-all duration-300 ease-in-out"
        style={{ width: `${progress}%` }}
      >
        {Math.round(progress)}%
      </div>
    </div>
  );
};

const FileStatus = ({ file, progress }) => {
  const isCompleted = progress === 100;
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
      <div className="flex items-center truncate">
        <svg className={`w-6 h-6 mr-3 ${isCompleted ? 'text-green-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span className="text-sm font-medium text-gray-700 truncate">{file.name}</span>
      </div>
      <div className="text-sm font-semibold text-gray-600">
        {isCompleted ? 'Uploaded!' : 'Pending...'}
      </div>
    </div>
  );
};


/**
 * The main application component.
 */
export default function App() {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState(Object.keys(GOOGLE_DRIVE_FOLDER_IDS)[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [totalProgress, setTotalProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [error, setError] = useState(null);

  // Google API state
  const [gapiReady, setGapiReady] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  const fileInputRef = useRef(null);

  // --- Google API Initialization ---

  useEffect(() => {
    // Check if credentials are provided
    if (!API_KEY || !CLIENT_ID) {
        setError("API Key or Client ID is missing. Please check your .env.local file.");
        return;
    }

    // Load the GAPI client for the Drive API
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = () => window.gapi.load('client', initGapiClient);
    document.body.appendChild(gapiScript);

    // Load the Google Identity Services (GIS) client
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = initGisClient;
    document.body.appendChild(gisScript);
  }, []);

  const initGapiClient = () => {
    window.gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: DISCOVERY_DOCS,
    }).then(() => {
      setGapiReady(true);
    }).catch(err => {
      setError("Error initializing Google API. This might be a temporary network issue or a problem with your API Key. Please check your console for details and try again later.");
      console.error("Error initializing GAPI client", err);
    });
  };

  const initGisClient = () => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          setAccessToken(tokenResponse.access_token);
        } else {
            setError("Failed to get access token.");
            console.error("Provided token response was invalid:", tokenResponse);
        }
      },
    });
    setTokenClient(client);
    setGisReady(true);
  };

  const handleSignIn = () => {
    if (tokenClient) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      tokenClient.requestAccessToken();
    } else {
        setError("Google Identity Service not ready. Please try again in a moment.");
    }
  };

  const handleSignOut = () => {
    if (accessToken) {
      window.google.accounts.oauth2.revoke(accessToken, () => {
        setAccessToken(null);
      });
    }
  };


  // --- Event Handlers ---

  const handleFileSelect = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setUploadProgress({});
      setTotalProgress(0);
      setCurrentFileIndex(0);
      setError(null);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };
  
  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
  };

  /**
   * Handles the actual file upload to Google Drive.
   */
  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select files to upload first.");
      return;
    }
    if (!accessToken) {
      // FIX: The error "Unterminated string constant" happens when this string is not
      // properly closed with a quote and parenthesis.
      setError("You must be signed in to upload files.");
      return;
    }

    setIsUploading(true);
    setError(null);
    
    // Set the access token for the GAPI client
    window.gapi.client.setToken({ access_token: accessToken });

    const folderId = GOOGLE_DRIVE_FOLDER_IDS[category];
    if (!folderId) {
        setError(`Folder ID for category "${category}" is not configured in your .env.local file.`);
        setIsUploading(false);
        return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFileIndex(i);

      const metadata = {
        name: file.name,
        parents: [folderId],
      };

      const reader = new FileReader();
      reader.readAsBinaryString(file);
      reader.onload = async () => {
          const boundary = '-------314159265358979323846';
          const delimiter = `\r\n--${boundary}\r\n`;
          const close_delim = `\r\n--${boundary}--`;

          const contentType = file.type || 'application/octet-stream';
          const base64Data = btoa(reader.result);
          
          const multipartRequestBody =
              delimiter +
              'Content-Type: application/json\r\n\r\n' +
              JSON.stringify(metadata) +
              delimiter +
              'Content-Type: ' + contentType + '\r\n' +
              'Content-Transfer-Encoding: base64\r\n' +
              '\r\n' +
              base64Data +
              close_delim;

          try {
              const request = window.gapi.client.request({
                  path: 'https://www.googleapis.com/upload/drive/v3/files',
                  method: 'POST',
                  params: { uploadType: 'multipart' },
                  headers: {
                      'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                  },
                  body: multipartRequestBody
              });

              await request;
              
              setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

          } catch (err) {
              console.error("Upload error for file:", file.name, err);
              setError(`Error uploading ${file.name}: ${err.result?.error?.message || 'Unknown error'}`);
              setIsUploading(false); // Stop on error
              window.gapi.client.setToken(null); // Clear token
              return;
          }
      };
    }
  };

  // --- Effects ---

  useEffect(() => {
    if (files.length === 0) {
        setTotalProgress(0);
        return;
    }
    const completedFiles = Object.values(uploadProgress).filter(p => p === 100).length;
    setTotalProgress((completedFiles / files.length) * 100);

    if (completedFiles === files.length) {
        setIsUploading(false);
        if (window.gapi && window.gapi.client) {
            window.gapi.client.setToken(null); // Clear token after all uploads are done
        }
    }
  }, [uploadProgress, files]);


  // --- Render ---

  const allFilesUploaded = files.length > 0 && totalProgress >= 100;
  const isSignedIn = accessToken !== null;

  return (
    <div className="bg-gray-100 min-h-screen font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6">
        
        <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800">Ramin and Irzum Wedding Album</h1>
            <p className="text-gray-500 mt-2">Sign in to upload your pictures directly.</p>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {(!gapiReady || !gisReady) ? (
          <p className="text-center text-gray-600">Loading Google API...</p>
        ) : !isSignedIn ? (
          <div className="text-center">
            <p className="mb-4">Please sign in to continue.</p>
            <button
              onClick={handleSignIn}
              className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <>
            <div className="text-center">
              <button
                onClick={handleSignOut}
                className="text-sm text-blue-600 hover:underline"
              >
                Sign Out
              </button>
            </div>
            <div>
              <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-2">1. Choose a Category</label>
              <select id="category-select" value={category} onChange={handleCategoryChange} disabled={isUploading} className="block w-full p-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 transition">
                {Object.keys(GOOGLE_DRIVE_FOLDER_IDS).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">2. Select Your Pictures</label>
              <input type="file" multiple accept="image/*" onChange={handleFileSelect} ref={fileInputRef} className="hidden"/>
              <button onClick={triggerFileSelect} disabled={isUploading} className="w-full flex justify-center items-center p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:border-blue-500 transition disabled:bg-gray-200 disabled:cursor-not-allowed">
                <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                <span>{files.length > 0 ? `${files.length} file(s) selected` : 'Click to choose files'}</span>
              </button>
            </div>
            <div className="pt-2">
              <button onClick={handleUpload} disabled={isUploading || files.length === 0} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-transform transform active:scale-95">
                {isUploading ? `Uploading ${currentFileIndex + 1} of ${files.length}...` : 'Upload to Google Drive'}
              </button>
            </div>
            {(isUploading || allFilesUploaded) && (
              <div className="space-y-4 pt-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-medium text-gray-700">Overall Progress</h3>
                  </div>
                  <ProgressBar progress={totalProgress} />
                </div>
                <div className="max-h-40 overflow-y-auto p-2 bg-gray-100 rounded-lg">
                  {files.map(file => (<FileStatus key={file.name} file={file} progress={uploadProgress[file.name] || 0} />))}
                </div>
              </div>
            )}
            {allFilesUploaded && (
              <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                <h2 className="text-2xl font-semibold text-green-800">Upload Complete!</h2>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
