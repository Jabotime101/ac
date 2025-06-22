import { useState, useRef, useCallback, useEffect } from 'react'
import Head from 'next/head'
import { useSession, signIn, signOut } from 'next-auth/react'

const PROVIDERS = [
  {
    id: 'lemonfox',
    name: 'LemonFox.ai ($0.17/hr) - Best Value + Speaker ID',
    model: 'whisper-large-v3',
    costPerHour: 0.17,
    features: [
      'Best value',
      'Speaker identification',
      'Fast processing',
      'GDPR compliant',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI ($0.36/hr) - Highest Accuracy',
    model: 'gpt-4o-transcribe',
    costPerHour: 0.36,
    features: [
      'Highest accuracy',
      'Industry leader',
      'Supports many languages',
    ],
  },
]

export default function Home() {
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const [selectedProvider, setSelectedProvider] = useState(PROVIDERS[0].id)
  const [selectedModel, setSelectedModel] = useState(PROVIDERS[0].model)
  const [duration, setDuration] = useState(0)
  const abortControllerRef = useRef(null)
  const [logs, setLogs] = useState([])
  const logsEndRef = useRef(null)
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false)
  const [googleAccessToken, setGoogleAccessToken] = useState(null)
  const [savingToDrive, setSavingToDrive] = useState(false)
  const [recentTranscriptions, setRecentTranscriptions] = useState([])
  const [showRecentTranscriptions, setShowRecentTranscriptions] = useState(false)

  // Load recent transcriptions from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('recentTranscriptions')
    if (saved) {
      try {
        setRecentTranscriptions(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to load recent transcriptions:', error)
      }
    }
  }, [])

  // Save recent transcriptions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('recentTranscriptions', JSON.stringify(recentTranscriptions))
  }, [recentTranscriptions])

  const addTranscriptionToHistory = (fileName, transcriptionText, provider, model) => {
    const newTranscription = {
      id: Date.now(),
      fileName: fileName,
      transcription: transcriptionText,
      provider: provider,
      model: model,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString()
    }
    
    setRecentTranscriptions(prev => [newTranscription, ...prev.slice(0, 9)]) // Keep only 10 most recent
  }

  const downloadTranscription = (transcription) => {
    const blob = new Blob([transcription.transcription], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${transcription.fileName.replace(/\.[^/.]+$/, '')}_transcript.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    addLog(`📥 Downloaded: ${transcription.fileName}`, 'success')
  }

  const deleteTranscription = (id) => {
    setRecentTranscriptions(prev => prev.filter(t => t.id !== id))
    addLog('🗑️ Transcription removed from history', 'info')
  }

  const clearAllTranscriptions = () => {
    setRecentTranscriptions([])
    addLog('🗑️ All transcriptions cleared from history', 'info')
  }

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [logs])

  // Add initial logs when component mounts
  useEffect(() => {
    addLog('🚀 Audio Transcription App loaded', 'success')
    addLog('Ready to process audio files...', 'info')
  }, [])

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { message, type, timestamp }])
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith('audio/')) {
      setFile(droppedFile)
      setError('')
      addLog(`File dropped: ${droppedFile.name} (${formatFileSize(droppedFile.size)})`)
    } else {
      setError('Please drop an audio file')
      addLog('Invalid file type dropped', 'error')
    }
  }, [])

  const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile && selectedFile.type.startsWith('audio/')) {
      setFile(selectedFile)
      setError('')
      addLog(`File selected: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`)
      getAudioDuration(selectedFile)
    } else {
      setError('Please select an audio file')
      addLog('Invalid file type selected', 'error')
    }
  }, [])

  const getAudioDuration = (file) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.src = url
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
      addLog(`Audio duration: ${Math.round(audio.duration)} seconds`)
      URL.revokeObjectURL(url)
    })
  }

  const handleTranscribe = async () => {
    if (!file) return

    setIsTranscribing(true)
    setProgress(0)
    setTranscript('')
    setError('')
    setLogs([]) // Clear previous logs

    // Create new AbortController for this transcription
    abortControllerRef.current = new AbortController()

    addLog('🚀 Starting transcription process...', 'success')
    addLog(`Provider: ${selectedProvider}`)
    addLog(`Model: ${selectedModel}`)
    addLog(`File: ${file.name} (${formatFileSize(file.size)})`)

    const formData = new FormData()
    formData.append('audio', file) // Changed from 'file' to 'audio' to match new API

    try {
      addLog('📤 Uploading file to server...')
      setProgress(10)

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      addLog('📥 File uploaded successfully')
      addLog('🔄 Processing audio file...')
      setProgress(30)

      // New API returns JSON response instead of streaming
      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      addLog('✅ Transcription completed successfully!', 'success')
      setProgress(100)
      setTranscript(result.transcription)
      
      // Add to recent transcriptions
      addTranscriptionToHistory(file.name, result.transcription, selectedProvider, selectedModel)
      
      setIsTranscribing(false)

    } catch (err) {
      if (err.name === 'AbortError') {
        addLog('⏹️ Transcription was cancelled by user', 'warning')
        setError('Transcription was cancelled')
      } else {
        addLog(`❌ Error: ${err.message}`, 'error')
        setError(err.message)
      }
      setIsTranscribing(false)
    } finally {
      abortControllerRef.current = null
    }
  }

  const handleStopTranscription = () => {
    if (abortControllerRef.current) {
      addLog('⏹️ Stopping transcription...', 'warning')
      abortControllerRef.current.abort()
    }
  }

  const handleFolderSelected = (folder) => {
    setSelectedFolder(folder)
    addLog(`📁 Google Drive folder selected: ${folder.name}`, 'success')
  }

  const handleFileUploaded = (file) => {
    setUploadedFiles(prev => [...prev, file])
    addLog(`📤 File uploaded to Google Drive: ${file.name}`, 'success')
  }

  const handleSaveToGoogleDrive = async () => {
    if (!googleAccessToken || !transcript) return;
    setSavingToDrive(true);
    try {
      const fileName = `${file?.name?.replace(/\.[^/.]+$/, '') || 'transcript'}.txt`;
      const fileData = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(transcript)))}`;

      const response = await fetch('/api/google-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${googleAccessToken}`,
        },
        body: JSON.stringify({
          action: 'upload',
          fileData: fileData,
          fileName: fileName,
          folderId: selectedFolder?.id,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        addLog('📤 Transcript saved to Google Drive!', 'success');
        setUploadedFiles(prev => [...prev, result.file]);
      } else {
        const errorData = await response.json();
        addLog(`❌ Failed to upload: ${errorData.error || response.statusText}`, 'error');
      }
    } catch (err) {
      addLog(`❌ Failed to upload: ${err.message}`, 'error');
    } finally {
      setSavingToDrive(false);
    }
  };

  const handleProviderChange = (e) => {
    const provider = PROVIDERS.find(p => p.id === e.target.value)
    setSelectedProvider(provider.id)
    setSelectedModel(provider.model)
    addLog(`Provider changed to: ${provider.name}`)
  }

  const estimateCost = () => {
    const provider = PROVIDERS.find(p => p.id === selectedProvider)
    if (!provider || !duration) return '$0.00'
    const hours = duration / 3600
    return `$${(provider.costPerHour * hours).toFixed(2)}`
  }

  const handleReset = () => {
    // Stop any ongoing transcription
    if (abortControllerRef.current) {
      addLog('⏹️ Stopping ongoing transcription...', 'warning')
      abortControllerRef.current.abort()
    }
    
    addLog('🔄 Resetting application...', 'info')
    
    // Clear all state
    setFile(null)
    setIsDragging(false)
    setIsTranscribing(false)
    setProgress(0)
    setTranscript('')
    setError('')
    setDuration(0)
    setSelectedProvider(PROVIDERS[0].id)
    setSelectedModel(PROVIDERS[0].model)
    setLogs([])
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownload = () => {
    if (!transcript) return

    const blob = new Blob([transcript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${file?.name?.replace(/\.[^/.]+$/, '') || 'transcript'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    addLog('📥 Transcript downloaded', 'success')
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Head>
        <title>AC - Audio Transcription</title>
        <meta name="description" content="Transcribe audio files with speed and accuracy." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            AC - Audio Transcription
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-lg text-gray-500">
            Upload your audio file, select a provider, and get a transcript in minutes.
          </p>
        </header>

        <div className="max-w-4xl mx-auto">

          <div className="mb-6">
            <AuthComponent />
          </div>

          {/* Provider Selection */}
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <label htmlFor="provider" className="block text-lg font-medium text-gray-700 mb-2">Choose Provider</label>
            <select
              id="provider"
              value={selectedProvider}
              onChange={handleProviderChange}
              className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
            >
              {PROVIDERS.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Model:</span>
              <span className="font-mono text-blue-700">{selectedModel}</span>
            </div>
            <div className="cost-estimate text-blue-600 font-semibold mb-2">
              Estimated Cost: {estimateCost()}
            </div>
            <ul className="text-xs text-gray-500 list-disc pl-5">
              {PROVIDERS.find(p => p.id === selectedProvider)?.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>

          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="text-6xl text-gray-400">🎵</div>
              <div>
                <p className="text-lg text-gray-600 mb-2">
                  Drag and drop your audio file here
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  or click to browse files
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Choose File
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* File Info */}
          {file && (
            <div className="mt-6 p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex gap-4">
            {/* Reset Button - Always visible */}
            <button
              onClick={handleReset}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Reset
            </button>
            
            {/* Start/Transcribe Button - Only visible when file is selected and not transcribing */}
            {file && !isTranscribing && (
              <button
                onClick={handleTranscribe}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-lg font-medium transition-colors"
              >
                Start Transcription
              </button>
            )}
          </div>

          {/* Progress Bar with Stop/Reset Controls */}
          {isTranscribing && (
            <div className="mt-6">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Transcribing...
                  </span>
                  <span className="text-sm text-gray-500">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                
                {/* Stop and Reset buttons during transcription */}
                <div className="flex gap-3">
                  <button
                    onClick={handleStopTranscription}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                  >
                    Stop Transcription
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                  >
                    Reset All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Terminal/Log Box - Always Visible */}
          <div className="mt-6">
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-400 font-semibold">Terminal Logs</span>
                <button
                  onClick={() => setLogs([])}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  Clear Logs
                </button>
              </div>
              <div className="h-48 overflow-y-auto bg-gray-900 p-3 rounded border border-gray-700">
                {logs.length === 0 ? (
                  <div className="text-gray-500 italic">No logs yet...</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      <span className="text-gray-500 text-xs">[{log.timestamp}]</span>
                      <span className={`ml-2 ${
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'success' ? 'text-green-400' :
                        log.type === 'warning' ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>

          {/* Transcript Display */}
          {transcript && (
            <div className="mt-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Transcript
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownload}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                      Download
                    </button>
                    {!isGoogleSignedIn ? (
                      <button
                        onClick={handleGoogleSignIn}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center"
                      >
                        <svg className="w-4 h-4 mr-1" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.7 33.4 30.1 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c2.6 0 5 .8 7 2.3l6.4-6.4C33.5 6.1 28.9 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 17.1 19.2 14 24 14c2.6 0 5 .8 7 2.3l6.4-6.4C33.5 6.1 28.9 4 24 4c-7.1 0-13.1 3.7-16.7 9.7z"/><path fill="#FBBC05" d="M24 44c5.9 0 10.8-1.9 14.4-5.1l-6.6-5.4C29.7 35.7 27 36.5 24 36.5c-6.1 0-10.7-2.6-13.7-6.5l-7 5.4C7.1 40.3 14.9 44 24 44z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.7C34.7 33.4 30.1 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c2.6 0 5 .8 7 2.3l6.4-6.4C33.5 6.1 28.9 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"/></g></svg>
                        Sign in to Save
                      </button>
                    ) : (
                      <button
                        onClick={handleSaveToGoogleDrive}
                        disabled={savingToDrive}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center disabled:opacity-60"
                      >
                        <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        {savingToDrive ? 'Saving...' : 'Save to Drive'}
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  className="w-full bg-gray-50 p-4 rounded-lg text-gray-700 whitespace-pre-wrap resize-none border border-gray-200 focus:outline-none"
                  value={transcript}
                  readOnly
                  rows={20}
                  aria-label="Transcript"
                />
              </div>
            </div>
          )}

          {/* Recent Transcriptions */}
          {recentTranscriptions.length > 0 && (
            <div className="mt-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Recent Transcriptions ({recentTranscriptions.length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRecentTranscriptions(!showRecentTranscriptions)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {showRecentTranscriptions ? 'Hide' : 'Show'} History
                    </button>
                    <button
                      onClick={clearAllTranscriptions}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
                {showRecentTranscriptions && (
                  <div className="space-y-3">
                    {recentTranscriptions.map((transcription) => (
                      <div key={transcription.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-gray-800">
                                {transcription.fileName}
                              </h4>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {transcription.provider}
                              </span>
                              <span className="text-xs text-gray-500">
                                {transcription.date} at {transcription.time}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {transcription.transcription.substring(0, 150)}
                              {transcription.transcription.length > 150 ? '...' : ''}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => downloadTranscription(transcription)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs transition-colors"
                              >
                                Download
                              </button>
                              <button
                                onClick={() => {
                                  setTranscript(transcription.transcription)
                                  setFile({ name: transcription.fileName })
                                  addLog(`📄 Loaded transcription: ${transcription.fileName}`, 'success')
                                }}
                                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs transition-colors"
                              >
                                Load
                              </button>
                              <button
                                onClick={() => deleteTranscription(transcription.id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="mt-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Files Uploaded to Google Drive
                </h3>
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-2 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span className="text-gray-700">{file.name}</span>
                      </div>
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View in Drive
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const AuthComponent = () => {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm text-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div>
      {/* If the user IS logged in, show their status */}
      {session && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Google Drive Connected</h3>
          <p className="mt-2 text-sm text-gray-600">Signed in as {session.user.email}</p>
          {/* You can pass session.accessToken to your upload function */}
          <button
            onClick={() => signOut()}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Sign Out
          </button>
        </div>
      )}

      {/* If the user is NOT logged in, show a single sign-in button */}
      {!session && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Connect and Save to Google Drive</h3>
          <p className="mt-2 text-sm text-gray-600">Sign in with your Google account to automatically save transcripts and audio files to your Drive.</p>
          <button
            onClick={() => signIn('google')}
            className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-5 h-5 mr-2" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 109.8 512 0 402.2 0 261.8S109.8 11.8 244 11.8c67.7 0 128.8 28.1 172.4 72.6l-63.1 61.9c-36.6-35.4-86.2-58.6-146-58.6-105.7 0-192.3 86.6-192.3 192.3s86.6 192.3 192.3 192.3c127.3 0 166.4-96.1 171-143.9H244V261.8h244z"></path></svg>
            Sign in with Google
          </button>
        </div>
      )}
    </div>
  )
}
