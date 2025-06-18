import { useState, useRef, useCallback } from 'react'
import Head from 'next/head'

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
    } else {
      setError('Please drop an audio file')
    }
  }, [])

  const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile && selectedFile.type.startsWith('audio/')) {
      setFile(selectedFile)
      setError('')
      getAudioDuration(selectedFile)
    } else {
      setError('Please select an audio file')
    }
  }, [])

  const getAudioDuration = (file) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.src = url
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
      URL.revokeObjectURL(url)
    })
  }

  const handleTranscribe = async () => {
    if (!file) return

    setIsTranscribing(true)
    setProgress(0)
    setTranscript('')
    setError('')

    // Create new AbortController for this transcription
    abortControllerRef.current = new AbortController()

    const formData = new FormData()
    formData.append('audio', file)

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // New API returns JSON response instead of streaming
      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      setTranscript(result.transcription)
      setProgress(100)
      setIsTranscribing(false)

    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Transcription was cancelled')
      } else {
        setError(err.message)
      }
      setIsTranscribing(false)
    } finally {
      abortControllerRef.current = null
    }
  }

  const handleStopTranscription = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
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
  }

  const handleProviderChange = (e) => {
    const provider = PROVIDERS.find(p => p.id === e.target.value)
    setSelectedProvider(provider.id)
    setSelectedModel(provider.model)
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
      abortControllerRef.current.abort()
    }
    
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
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Head>
        <title>Audio Transcription App</title>
        <meta name="description" content="Upload audio files and get transcriptions using OpenAI Whisper" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
            Audio Transcription
          </h1>

          {/* Provider Selection */}
          <div className="provider-select-area mb-6 p-4 bg-white rounded-lg shadow-sm border border-blue-200">
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

          {/* Transcript Display */}
          {transcript && (
            <div className="mt-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Transcript
                  </h2>
                  <button
                    onClick={handleDownload}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Download
                  </button>
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
        </div>
      </main>
    </div>
  )
} 