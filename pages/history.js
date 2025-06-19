import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function History() {
  const [transcriptions, setTranscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTranscription, setSelectedTranscription] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/history');
      const data = await response.json();

      if (data.success) {
        setTranscriptions(data.transcriptions);
      } else {
        setError(data.error || 'Failed to fetch history');
      }
    } catch (err) {
      setError('Failed to fetch history');
      console.error('History fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const downloadTranscript = (transcription) => {
    const blob = new Blob([transcription.full_transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${transcription.filename}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading transcription history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Head>
        <title>Transcription History - Audio Converter</title>
      </Head>

      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Transcription History</h1>
          <p className="text-gray-600">View and manage your past transcriptions</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {transcriptions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No transcriptions yet</h3>
            <p className="text-gray-600">Your transcription history will appear here once you transcribe some audio files.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {transcriptions.map((transcription) => (
              <div
                key={transcription.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {transcription.filename}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formatDate(transcription.created_at)}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedTranscription(transcription)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                    >
                      View Full
                    </button>
                    <button
                      onClick={() => downloadTranscript(transcription)}
                      className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                    >
                      Download
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {transcription.transcript_preview}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full Transcript Modal */}
        {selectedTranscription && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedTranscription.filename}
                </h2>
                <button
                  onClick={() => setSelectedTranscription(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {selectedTranscription.full_transcript}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end p-6 border-t border-gray-200">
                <button
                  onClick={() => downloadTranscript(selectedTranscription)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Download Transcript
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 