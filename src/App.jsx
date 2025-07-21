import React, { useState, useEffect, useRef } from 'react';

// --- Assets ---
// Make sure to place your image files in the 'src/assets' folder of your project.
import weddingPhoto from './assets/irzumramin.jpg'; // This is the new image for the right column

// --- Configuration ---
// The configuration is now loaded from a .env.local file in your project's root directory.
// Create a file named .env.local and add the following variables.
// NOTE: For Vite projects, environment variables MUST start with the VITE_ prefix.
//
// VITE_GOOGLE_API_KEY=YOUR_API_KEY
// VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
// VITE_FOLDER_ID_NIKKAH=YOUR_FOLDER_ID_FOR_NIKKAH
// VITE_FOLDER_ID_MAYUN_RAMIN=YOUR_FOLDER_ID_FOR_RAMIN_MAYUN
// VITE_FOLDER_ID_MAYUN_IRZUM=YOUR_FOLDER_ID_FOR_IRZUM_MAYUN
// VITE_FOLDER_ID_MEHDI=YOUR_FOLDER_ID_FOR_MEHDI
// VITE_FOLDER_ID_BARAAT=YOUR_FOLDER_ID_FOR_BARAAT
// VITE_FOLDER_ID_VALIMA=YOUR_FOLDER_ID_FOR_VALIMA
//
// After creating or updating the .env.local file, you MUST restart your development server.

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// The API discovery document and the scope for file uploads.
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

// Reconstruct the folder IDs object from environment variables.
const GOOGLE_DRIVE_FOLDER_IDS = {
  'Nikkah': import.meta.env.VITE_FOLDER_ID_NIKKAH,
  'Ramin Mayun': import.meta.env.VITE_FOLDER_ID_MAYUN_RAMIN,
  'Irzum Mayun': import.meta.env.VITE_FOLDER_ID_MAYUN_IRZUM,
  'Mehndi': import.meta.env.VITE_FOLDER_ID_MEHNDI,
  'Baraat': import.meta.env.VITE_FOLDER_ID_BARAAT,
  'Ramin Birthday': import.meta.env.VITE_FOLDER_ID_RAMINBDAY,
  'Valima': import.meta.env.VITE_FOLDER_ID_VALIMA,
};


// --- Components ---

const ProgressBar = ({ progress }) => {
  return (
    <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700 overflow-hidden">
      <div
        className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300 ease-in-out"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
};

const FileStatus = ({ file, progress }) => {
  const isCompleted = progress === 100;
  return (
    <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg mb-2">
      <div className="flex items-center truncate">
        <svg className={`w-5 h-5 mr-3 flex-shrink-0 ${isCompleted ? 'text-emerald-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
      </div>
      <div className="text-sm font-semibold text-slate-600">
        {isCompleted ? 'Done!' : 'Pending...'}
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
    if (!API_KEY || !CLIENT_ID) {
        setError("API Key or Client ID is missing. Please check your .env.local file.");
        return;
    }
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = () => window.gapi.load('client', initGapiClient);
    document.body.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = initGisClient;
    document.body.appendChild(gisScript);
  }, []);

  const initGapiClient = () => {
    window.gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: DISCOVERY_DOCS,
    }).then(() => setGapiReady(true))
      .catch(err => {
        setError("Error initializing Google API. This might be a temporary network issue or a problem with your API Key.");
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
      tokenClient.requestAccessToken();
    } else {
      setError("Google Identity Service not ready. Please try again.");
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

  const triggerFileSelect = () => fileInputRef.current?.click();
  const handleCategoryChange = (e) => setCategory(e.target.value);

  const handleViewFolder = () => {
    const folderId = GOOGLE_DRIVE_FOLDER_IDS[category];
    if (folderId) {
      const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      window.open(folderUrl, '_blank', 'noopener,noreferrer');
    } else {
      setError(`Could not find folder ID for category "${category}".`);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select files to upload first.");
      return;
    }
    if (!accessToken) {
      setError("You must be signed in to upload files.");
      return;
    }

    setIsUploading(true);
    setError(null);
    window.gapi.client.setToken({ access_token: accessToken });

    const folderId = GOOGLE_DRIVE_FOLDER_IDS[category];
    if (!folderId) {
      setError(`Folder ID for category "${category}" is not configured.`);
      setIsUploading(false);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFileIndex(i);
      const metadata = { name: file.name, parents: [folderId] };
      const reader = new FileReader();
      reader.readAsBinaryString(file);
      reader.onload = async () => {
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const close_delim = `\r\n--${boundary}--`;
        const contentType = file.type || 'application/octet-stream';
        const base64Data = btoa(reader.result);
        const multipartRequestBody =
          delimiter + `Content-Type: application/json\r\n\r\n` + JSON.stringify(metadata) +
          delimiter + `Content-Type: ${contentType}\r\n` + `Content-Transfer-Encoding: base64\r\n\r\n` +
          base64Data + close_delim;

        try {
          await window.gapi.client.request({
            path: 'https://www.googleapis.com/upload/drive/v3/files',
            method: 'POST',
            params: { uploadType: 'multipart' },
            headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
            body: multipartRequestBody,
          });
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        } catch (err) {
          console.error("Upload error for file:", file.name, err);
          setError(`Error uploading ${file.name}: ${err.result?.error?.message || 'Unknown error'}`);
          setIsUploading(false);
          window.gapi.client.setToken(null);
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
        window.gapi.client.setToken(null);
      }
    }
  }, [uploadProgress, files]);

  // --- Render ---

  const allFilesUploaded = files.length > 0 && totalProgress >= 100;
  const isSignedIn = accessToken !== null;

  return (
    <div className="bg-slate-50 min-h-screen font-sans flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl shadow-slate-200 overflow-hidden grid md:grid-cols-2">
        
        {/* Left Column: Information & Controls */}
        <div className={`p-8 lg:p-12 bg-indigo-50 flex flex-col transition-all duration-500 ${allFilesUploaded ? 'justify-center' : ''}`}>
          <div className="flex-grow">
            <h2 className="text-2xl md:text-3xl font-bold text-indigo-500 mb-4">Wedding Album</h2>
            <p className="text-slate-600 mt-4 leading-relaxed">
              Welcome! Please help us capture all the beautiful moments from our wedding events. 
              Sign in with your Google account, choose an event, and upload your photos.
            </p>
          </div>
          <div className="mt-8">
            {(!gapiReady || !gisReady) ? (
              <p className="text-center text-slate-600">Loading Google API...</p>
            ) : !isSignedIn ? (
              <div className="text-center">
                <p className="mb-4 text-slate-600">Please sign in to continue.</p>
                <button
                  onClick={handleSignIn}
                  className="w-full bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform active:scale-95"
                >
                  Sign in with Google
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="category-select" className="block text-sm font-medium text-slate-700 mb-2">1. Choose an Event</label>
                  <select id="category-select" value={category} onChange={handleCategoryChange} disabled={isUploading} className="block w-full p-3 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500 transition">
                    {Object.keys(GOOGLE_DRIVE_FOLDER_IDS).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>
                <div className="text-center pt-2">
                  <button onClick={handleSignOut} className="text-sm text-indigo-600 hover:underline">Sign Out</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Uploader & Status */}
        <div className="p-8 lg:p-12 flex flex-col justify-center">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 text-red-700 p-4 rounded-lg" role="alert">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}
          
          {!isSignedIn && (
            <div className="w-full h-full flex items-center justify-center">
                <img 
                    src={weddingPhoto} 
                    alt="Wedding illustration" 
                    className="rounded-lg object-cover w-full h-full max-h-[400px] md:max-h-full"
                    onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/600x800/e0e7ff/4338ca?text=Wedding+Album'; }}
                />
            </div>
          )}

          {isSignedIn && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">2. Select Your Pictures</label>
                <input type="file" multiple accept="image/*,video/*" onChange={handleFileSelect} ref={fileInputRef} className="hidden"/>
                <button onClick={triggerFileSelect} disabled={isUploading} className="w-full flex justify-center items-center p-6 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:bg-slate-50 hover:border-indigo-500 transition disabled:bg-slate-200 disabled:cursor-not-allowed">
                  <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                  <span>{files.length > 0 ? `${files.length} file(s) selected` : 'Click to choose files'}</span>
                </button>
              </div>
              
              <div className="pt-2">
                <button onClick={handleUpload} disabled={isUploading || files.length === 0} className="w-full bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-transform transform active:scale-95">
                  {isUploading ? `Uploading ${currentFileIndex + 1} of ${files.length}...` : 'Upload to Album'}
                </button>
              </div>

              {(isUploading || allFilesUploaded) && (
                <div className="space-y-4 pt-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-sm font-medium text-slate-700">Overall Progress</h3>
                      <p className="text-sm text-slate-500">{Math.round(totalProgress)}%</p>
                    </div>
                    <ProgressBar progress={totalProgress} />
                  </div>
                  <div className="max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-lg border">
                    {files.map(file => (<FileStatus key={file.name} file={file} progress={uploadProgress[file.name] || 0} />))}
                  </div>
                </div>
              )}

              {allFilesUploaded && (
                <div className="text-center p-6 bg-emerald-50 rounded-lg border border-emerald-200 space-y-4">
                  <div className="flex justify-center items-center">
                    <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-emerald-800">Upload Complete!</h2>
                  <p className="text-emerald-700">Thank you for sharing your memories.</p>
                  <button
                      onClick={handleViewFolder}
                      className="w-full bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform active:scale-95"
                  >
                      View Pictures
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
