'use client';

import { useState, useEffect } from 'react';

interface Note {
  id: string;
  filename: string;
  content: string;
  uploaded_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  claim_id?: string;
  pdf_url?: string;
  error?: string;
}

interface ProcessorStatus {
  initialized: boolean;
  fileWatcherRunning: boolean;
  queue: {
    queued: number;
    processing: number;
    active: string[];
  };
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processorStatus, setProcessorStatus] = useState<ProcessorStatus | null>(null);

  // Load notes on mount and refresh every 5 seconds
  useEffect(() => {
    loadNotes();
    loadProcessorStatus();
    initializeProcessors();
    
    const interval = setInterval(() => {
      loadNotes();
      loadProcessorStatus();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const initializeProcessors = async () => {
    try {
      await fetch('/api/processor/init', { method: 'POST' });
    } catch (err) {
      console.error('Failed to initialize processors:', err);
    }
  };

  const loadProcessorStatus = async () => {
    try {
      const response = await fetch('/api/processor/status');
      const result = await response.json();
      if (result.success) {
        setProcessorStatus(result.data);
      }
    } catch (err) {
      console.error('Failed to load processor status:', err);
    }
  };

  const loadNotes = async () => {
    try {
      const response = await fetch('/api/notes/list');
      const result = await response.json();
      if (result.success) {
        setNotes(result.data);
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    // Validate file type
    if (!file.name.endsWith('.txt')) {
      setError('Please upload a .txt file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    setError('');
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/notes/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Upload failed');
      }

      // Clear selection and reload notes
      setSelectedFile(null);
      await loadNotes();
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: Note['status']) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-800',
      processing: 'bg-blue-100 text-blue-800 animate-pulse',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };

    const icons = {
      pending: '⏳',
      processing: '⚙️',
      completed: '✅',
      failed: '❌',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
        {icons[status]} {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                📋 Clinician Notes Inbox
              </h1>
              <p className="text-xl text-gray-600">
                Upload notes to automatically generate and validate claims
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href="/"
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors"
              >
                ← Home
              </a>
              <a
                href="/claims"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors"
              >
                View Generated Claims →
              </a>
            </div>
          </div>
        </div>

        {/* Processor Status */}
        {processorStatus && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-md p-4 mb-6 border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${processorStatus.fileWatcherRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="font-semibold text-gray-900">
                    Background Processor: {processorStatus.fileWatcherRunning ? '🟢 Active' : '🔴 Inactive'}
                  </span>
                </div>
                {processorStatus.queue.processing > 0 && (
                  <div className="bg-blue-100 px-3 py-1 rounded-full text-sm font-semibold text-blue-800">
                    ⚙️ Processing: {processorStatus.queue.processing}
                  </div>
                )}
                {processorStatus.queue.queued > 0 && (
                  <div className="bg-yellow-100 px-3 py-1 rounded-full text-sm font-semibold text-yellow-800">
                    ⏳ Queued: {processorStatus.queue.queued}
                  </div>
                )}
              </div>
              <span className="text-sm text-gray-600">
                Auto-refresh every 5 seconds
              </span>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Upload New Note</h2>
          
          {/* Drag and Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="flex justify-center">
                <svg
                  className="w-16 h-16 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              
              {selectedFile ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-semibold">✓ {selectedFile.name}</p>
                  <p className="text-sm text-green-600">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="mt-2 text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-lg text-gray-600">
                    Drag and drop your note file here, or
                  </p>
                  <label className="cursor-pointer bg-blue-100 hover:bg-blue-200 text-blue-700 px-6 py-3 rounded-lg font-medium inline-block transition-colors">
                    Browse Files
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                  <p className="text-sm text-gray-500">
                    Supports .txt files up to 5MB
                  </p>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {selectedFile && (
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="mt-4 w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
            >
              {isUploading ? 'Uploading...' : 'Upload and Process'}
            </button>
          )}
        </div>

        {/* Notes List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Uploaded Notes</h2>
            <button
              onClick={loadNotes}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              🔄 Refresh
            </button>
          </div>

          {notes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No notes uploaded yet</p>
              <p className="text-sm mt-2">Upload a note to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {note.filename}
                        </h3>
                        {getStatusBadge(note.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Uploaded: {new Date(note.uploaded_at).toLocaleString()}
                      </p>
                      {note.claim_id && (
                        <p className="text-sm font-mono text-blue-600">
                          Claim ID: {note.claim_id}
                        </p>
                      )}
                      {note.error && (
                        <p className="text-sm text-red-600 mt-2">
                          ⚠️ Error: {note.error}
                        </p>
                      )}
                    </div>
                    {note.pdf_url && (
                      <a
                        href={note.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        📄 View PDF
                      </a>
                    )}
                  </div>
                  
                  {/* Collapsible content preview */}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-gray-700 hover:text-gray-900 font-medium">
                      View note content
                    </summary>
                    <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto max-h-40">
                      {note.content}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

