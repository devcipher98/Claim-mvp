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

// Function to strip RTF formatting and convert to plain text
const stripRTF = (rtfText: string): string => {
  if (!rtfText) return '';
  
  // Check if it's RTF content
  if (!rtfText.startsWith('{\\rtf')) {
    return rtfText; // Return as-is if not RTF
  }
  
  try {
    let text = rtfText;
    
    // Remove RTF header and preamble more aggressively
    text = text.replace(/\{\\rtf1[^}]*\}/g, '');
    text = text.replace(/\\rtf1[^\\{]*/, '');
    
    // Remove font table with nested groups
    text = text.replace(/\{\\fonttbl(?:[^{}]|\{[^{}]*\})*\}/g, '');
    
    // Remove color table
    text = text.replace(/\{\\colortbl[^}]*\}/g, '');
    text = text.replace(/\{[\\*]\\expandedcolortbl[^}]*\}/g, '');
    
    // Remove style sheet
    text = text.replace(/\{\\stylesheet[^}]*\}/g, '');
    
    // Remove info group
    text = text.replace(/\{\\info[^}]*\}/g, '');
    
    // Remove document formatting
    text = text.replace(/\\cocoatextscaling\d+/g, '');
    text = text.replace(/\\cocoaplatform\d+/g, '');
    text = text.replace(/\\margl\d+\\margr\d+\\vieww\d+\\viewh\d+\\viewkind\d+/g, '');
    text = text.replace(/\\pard[^\\]*/g, '\n');
    
    // Replace \par, \line, and paragraph markers with newlines
    text = text.replace(/\\par\s?/g, '\n');
    text = text.replace(/\\line\s?/g, '\n');
    
    // Replace \tab with tab
    text = text.replace(/\\tab\s?/g, '\t');
    
    // Remove font and style commands
    text = text.replace(/\\f\d+/g, '');
    text = text.replace(/\\fs\d+/g, '');
    text = text.replace(/\\cf\d+/g, '');
    text = text.replace(/\\fswiss/g, '');
    text = text.replace(/\\fcharset\d+/g, '');
    
    // Remove all other RTF control words
    text = text.replace(/\\[a-z]+(-?\d+)?[ ]?/g, ' ');
    
    // Remove curly braces
    text = text.replace(/[{}]/g, '');
    
    // Clean up whitespace
    text = text.replace(/^\s+/gm, ''); // Remove leading whitespace from lines
    text = text.replace(/\n{3,}/g, '\n\n'); // Reduce multiple newlines
    text = text.replace(/[ \t]+/g, ' '); // Normalize spaces
    
    // Trim whitespace
    text = text.trim();
    
    return text || rtfText; // Fallback to original if empty
  } catch (e) {
    console.error('Error stripping RTF:', e);
    return rtfText;
  }
};

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processorStatus, setProcessorStatus] = useState<ProcessorStatus | null>(null);
  const [liveProgress, setLiveProgress] = useState<Map<string, any>>(new Map());

  // Load notes on mount and refresh every 5 seconds
  useEffect(() => {
    console.log('📋 Notes page loaded - Auto-refresh every 5 seconds');
    console.log('💡 TIP: Open browser console to see detailed processing logs');
    
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
        
        // Connect to SSE for processing notes
        result.data.forEach((note: Note) => {
          if (note.status === 'processing' && !liveProgress.has(note.id)) {
            connectToProgressStream(note.id);
          }
        });
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  };

  const connectToProgressStream = (noteId: string) => {
    console.log(`📡 Connecting to progress stream for note ${noteId}`);
    
    const eventSource = new EventSource(`/api/processor/progress?noteId=${noteId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status) {
          console.log(`📊 Progress update for ${noteId}:`, data);
          setLiveProgress(prev => new Map(prev).set(noteId, data));
        }
      } catch (err) {
        console.error('Error parsing progress data:', err);
      }
    };
    
    eventSource.onerror = () => {
      console.log(`📡 Progress stream closed for note ${noteId}`);
      eventSource.close();
      setLiveProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(noteId);
        return newMap;
      });
    };
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
      console.log('📤 Uploading file:', selectedFile.name);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/notes/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('📥 Upload response:', result);

      if (!result.success) {
        throw new Error(result.error?.message || 'Upload failed');
      }

      console.log('✅ File uploaded successfully, note ID:', result.data.id);
      console.log('⏳ Background processing started - check status updates below');

      // Connect to progress stream for this note
      connectToProgressStream(result.data.id);

      // Clear selection and reload notes
      setSelectedFile(null);
      await loadNotes();
    } catch (err: any) {
      console.error('❌ Upload failed:', err);
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: Note['status']) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-700 border border-gray-300',
      processing: 'bg-blue-50 text-blue-700 border border-blue-300 animate-pulse',
      completed: 'bg-green-50 text-green-700 border border-green-300',
      failed: 'bg-red-50 text-red-700 border border-red-300',
    };

    return (
      <span className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide ${styles[status]}`}>
        {status}
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
                Clinical Notes
              </h1>
              <p className="text-xl text-gray-600">
                Upload notes to automatically generate and validate claims
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href="/"
                className="inline-flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-xl shadow hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
              >
                Home
              </a>
              <a
                href="/claims"
                className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl shadow hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
              >
                View Claims
              </a>
            </div>
          </div>
        </div>

        {/* Processor Status */}
        {processorStatus && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${processorStatus.fileWatcherRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="font-medium text-gray-900">
                    Processor: {processorStatus.fileWatcherRunning ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {processorStatus.queue.processing > 0 && (
                  <div className="bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-full text-sm font-medium text-blue-700">
                    Processing: {processorStatus.queue.processing}
                  </div>
                )}
                {processorStatus.queue.queued > 0 && (
                  <div className="bg-amber-50 border border-amber-200 px-4 py-1.5 rounded-full text-sm font-medium text-amber-700">
                    Queued: {processorStatus.queue.queued}
                  </div>
                )}
              </div>
              <span className="text-sm text-gray-500">
                Auto-refresh every 5s
              </span>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload New Note</h2>
          
          {/* Drag and Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
              dragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
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
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <p className="text-green-800 font-semibold">{selectedFile.name}</p>
                  <p className="text-sm text-green-600 mt-1">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-base text-gray-600">
                    Drag and drop your note file here, or
                  </p>
                  <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold inline-block transition-all duration-200 shadow hover:shadow-lg active:scale-[0.98]">
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
            <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {selectedFile && (
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="mt-4 w-full bg-blue-600 text-white py-3 px-6 rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow hover:shadow-lg active:scale-[0.98]"
            >
              {isUploading ? 'Uploading...' : 'Upload and Process'}
            </button>
          )}
        </div>

        {/* Notes List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Uploaded Notes</h2>
            <button
              onClick={loadNotes}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold px-5 py-2 rounded-xl hover:bg-blue-50 transition-all duration-200 active:scale-[0.98]"
            >
              Refresh
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
                  className={`border rounded-2xl p-6 transition-all duration-200 ${
                    note.status === 'processing' 
                      ? 'border-blue-300 bg-blue-50/30 shadow-md' 
                      : note.status === 'completed'
                      ? 'border-green-300 bg-green-50/20 shadow-sm hover:shadow-md'
                      : note.status === 'failed'
                      ? 'border-red-300 bg-red-50/20 shadow-sm'
                      : 'border-gray-200 hover:shadow-md hover:border-gray-300'
                  }`}
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
                      {note.status === 'processing' && (() => {
                        const processingTime = Date.now() - new Date(note.uploaded_at).getTime();
                        const seconds = Math.floor(processingTime / 1000);
                        if (seconds > 60) {
                          return (
                            <p className="text-sm text-amber-600 mt-2 font-medium">
                              Processing for {Math.floor(seconds / 60)}m {seconds % 60}s - This may take 1-2 minutes
                            </p>
                          );
                        }
                        return (
                          <p className="text-sm text-blue-600 mt-2 font-medium">
                            Processing... ({seconds}s elapsed)
                          </p>
                        );
                      })()}
                      {note.error && (
                        <div className="mt-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl border border-red-200 p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-red-900 mb-1">Processing Failed</h4>
                              <p className="text-sm text-red-700">{note.error}</p>
                              <button 
                                onClick={() => loadNotes()}
                                className="mt-3 text-xs font-semibold text-red-700 hover:text-red-900 bg-white px-3 py-1.5 rounded-lg border border-red-300 hover:border-red-400 transition-all duration-200"
                              >
                                Retry Processing
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Enhanced Live Progress Display */}
                      {note.status === 'processing' && liveProgress.has(note.id) && (() => {
                        const progress = liveProgress.get(note.id);
                        
                        // Detailed workflow steps with tool information
                        const detailedSteps = [
                          { 
                            id: 1, 
                            label: 'Initializing Workflow',
                            description: 'Starting AI agent and analyzing note structure',
                            tool: 'AI Agent Coordinator',
                            icon: '🚀'
                          },
                          { 
                            id: 2, 
                            label: 'Extracting Medical Entities',
                            description: 'Identifying diagnoses, procedures, patient info, and provider details',
                            tool: 'extract_entities',
                            icon: '🔍'
                          },
                          { 
                            id: 3, 
                            label: 'Mapping Medical Codes',
                            description: 'Converting diagnoses to ICD-10 and procedures to CPT codes',
                            tool: 'map_codes',
                            icon: '🏥'
                          },
                          { 
                            id: 4, 
                            label: 'Validating Claim',
                            description: 'Checking NCCI edits, code compatibility, and compliance rules',
                            tool: 'validate_claim',
                            icon: '✓'
                          },
                          { 
                            id: 5, 
                            label: 'Generating CMS 1500',
                            description: 'Creating standardized claim form with all validated data',
                            tool: 'build_claim',
                            icon: '📄'
                          },
                        ];
                        
                        const currentStep = Math.min(progress.step, detailedSteps.length);
                        const progressPercent = (currentStep / detailedSteps.length) * 100;
                        
                        return (
                          <div className="mt-4">
                            {/* Progress Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl p-4 text-white">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold flex items-center gap-2">
                                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                  Processing Workflow
                                </h4>
                                <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
                                  Step {currentStep} of {detailedSteps.length}
                                </span>
                              </div>
                              <div className="w-full bg-blue-900/30 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full bg-white transition-all duration-500 ease-out"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <div className="flex justify-between items-center mt-2 text-xs">
                                <span className="opacity-90">{progress.message || 'Processing...'}</span>
                                <span className="font-semibold">{Math.round(progressPercent)}%</span>
                              </div>
                            </div>
                            
                            {/* Detailed Steps */}
                            <div className="bg-white rounded-b-2xl border border-t-0 border-gray-200 p-4 space-y-3">
                              {detailedSteps.map((stepInfo, index) => {
                                const isCompleted = index + 1 < currentStep;
                                const isActive = index + 1 === currentStep && progress.status === 'processing';
                                const isPending = index + 1 > currentStep;
                                
                                return (
                                  <div
                                    key={stepInfo.id}
                                    className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-300 ${
                                      isActive 
                                        ? 'bg-blue-50 border-2 border-blue-300 shadow-sm scale-[1.02]' 
                                        : isCompleted 
                                        ? 'bg-green-50/50 border border-green-200' 
                                        : 'bg-gray-50/50 border border-gray-200 opacity-60'
                                    }`}
                                  >
                                    {/* Step Icon/Number */}
                                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all duration-300 ${
                                      isCompleted 
                                        ? 'bg-green-500 text-white shadow-sm' 
                                        : isActive 
                                        ? 'bg-blue-600 text-white shadow-md animate-pulse' 
                                        : 'bg-gray-300 text-gray-600'
                                    }`}>
                                      {isCompleted ? (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : isActive ? (
                                        <div className="relative">
                                          <div className="w-3 h-3 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                      ) : (
                                        <span className="text-xl">{stepInfo.icon}</span>
                                      )}
                                    </div>
                                    
                                    {/* Step Details */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <h5 className={`font-semibold ${isActive ? 'text-blue-900' : isCompleted ? 'text-green-900' : 'text-gray-700'}`}>
                                          {stepInfo.label}
                                        </h5>
                                        {isActive && (
                                          <span className="flex-shrink-0 text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded-full animate-pulse">
                                            Active
                                          </span>
                                        )}
                                        {isCompleted && (
                                          <span className="flex-shrink-0 text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                            Done
                                          </span>
                                        )}
                                      </div>
                                      <p className={`text-sm mb-2 ${isActive ? 'text-gray-700' : 'text-gray-600'}`}>
                                        {stepInfo.description}
                                      </p>
                                      <div className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg ${
                                        isActive 
                                          ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                          : isCompleted 
                                          ? 'bg-green-100 text-green-700 border border-green-200' 
                                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                                      }`}>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                        </svg>
                                        {stepInfo.tool}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {note.pdf_url && (
                      <a
                        href={note.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 inline-flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-200 shadow hover:shadow-lg active:scale-[0.98]"
                      >
                        View PDF
                      </a>
                    )}
                  </div>
                  
                  {/* Completed Summary */}
                  {note.status === 'completed' && (
                    <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-green-900">Processing Complete</h4>
                          <p className="text-sm text-green-700">Claim successfully generated and validated</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-white/60 rounded-xl p-3 border border-green-200">
                          <p className="text-green-600 font-medium mb-1">Workflow Steps</p>
                          <p className="text-green-900 font-semibold">5/5 Completed</p>
                        </div>
                        <div className="bg-white/60 rounded-xl p-3 border border-green-200">
                          <p className="text-green-600 font-medium mb-1">Status</p>
                          <p className="text-green-900 font-semibold">Ready for Review</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Collapsible content preview */}
                  <details className="mt-3 group">
                    <summary className="cursor-pointer flex items-center justify-between text-sm text-gray-600 hover:text-gray-900 font-medium p-3 rounded-xl hover:bg-gray-50 transition-all duration-200">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 transition-transform duration-200 group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        View Clinical Note Content
                      </span>
                      <span className="text-xs text-gray-500">Click to expand</span>
                    </summary>
                    <div className="mt-2 bg-white border border-gray-200 rounded-xl p-5 text-sm overflow-auto max-h-96 shadow-inner">
                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap font-normal leading-relaxed text-gray-700 space-y-2">
                          {stripRTF(note.content).split('\n\n').map((paragraph, idx) => (
                            <p key={idx} className="mb-3">{paragraph}</p>
                          ))}
                        </div>
                      </div>
                    </div>
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

