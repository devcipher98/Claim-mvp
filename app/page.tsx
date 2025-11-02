'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { processCompleteWorkflow } from './lib/api-client';
import demoClaimsData from '@/data/demo_claims.json';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { AgentProcessor } from '@/app/components/ui/agent-processor';
import { LoadingSpinner } from '@/app/components/ui/loading-spinner';

export default function Home() {
  const [selectedDemo, setSelectedDemo] = useState<string>('');
  const [clinicianNote, setClinicianNote] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [workflow, setWorkflow] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [useAgenticMode, setUseAgenticMode] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [processingSteps, setProcessingSteps] = useState<any[]>([]);
  const [fileUploaded, setFileUploaded] = useState(false);
  const router = useRouter();

  // Safely handle demo claims data
  let demoClaims: any[] = [];
  try {
    demoClaims = Array.isArray(demoClaimsData) ? demoClaimsData : [];
  } catch (err) {
    console.error('Error loading demo claims:', err);
    demoClaims = [];
  }

  const handleDemoSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const demoId = e.target.value;
    setSelectedDemo(demoId);
    
    const demo = demoClaims.find(d => d.id === demoId);
    if (demo) {
      setClinicianNote(demo.clinician_note);
      setWorkflow(null);
      setError('');
      setProcessingSteps([]);
      setCurrentStep(0);
      setFileUploaded(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file extension
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.txt', '.json', '.pdf', '.md', '.doc', '.docx', '.rtf'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      setError('Please upload a PDF, JSON, or text file (.txt, .json, .pdf, .md, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    try {
      let text = '';
      
      if (fileName.endsWith('.pdf')) {
        // For PDF files, we'll need to extract text
        // Note: This requires a PDF parsing library in production
        setError('PDF file reading requires additional setup. Please use a text file or copy-paste the content.');
        return;
      } else {
        // For text-based files, read as text
        text = await file.text();
      }

      // If it's a JSON file, try to extract relevant text fields
      if (fileName.endsWith('.json')) {
        try {
          const jsonData = JSON.parse(text);
          // Try to extract clinician note or similar fields
          if (jsonData.clinician_note) {
            text = jsonData.clinician_note;
          } else if (jsonData.note) {
            text = jsonData.note;
          } else if (jsonData.content) {
            text = jsonData.content;
          } else if (typeof jsonData === 'string') {
            text = jsonData;
          } else {
            // If it's structured JSON, stringify it
            text = JSON.stringify(jsonData, null, 2);
          }
        } catch (jsonErr) {
          // If JSON parsing fails, use the raw text
          console.log('JSON parse failed, using raw text');
        }
      }

      setClinicianNote(text);
      setSelectedDemo('');
      setError('');
      setWorkflow(null);
      setProcessingSteps([]);
      setCurrentStep(0);
      setFileUploaded(true);
    } catch (err) {
      setError('Failed to read file. Please try a different file or copy-paste the content.');
      console.error('File read error:', err);
    }
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validExtensions = ['.txt', '.json', '.pdf', '.md', '.doc', '.docx', '.rtf'];
    const validFiles: File[] = [];

    // Validate all files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name.toLowerCase();
      const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

      if (!hasValidExtension) {
        setError(`File "${file.name}" has an invalid extension. Skipping...`);
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError(`File "${file.name}" is too large (max 5MB). Skipping...`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      setError('No valid files selected');
      return;
    }

    // Store files in sessionStorage as base64 for transfer
    try {
      const filesData = await Promise.all(
        validFiles.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ''
            )
          );
          return {
            name: file.name,
            size: file.size,
            type: file.type,
            data: base64,
          };
        })
      );

      sessionStorage.setItem('batchUploadFiles', JSON.stringify(filesData));
      sessionStorage.setItem('batchUploadCount', validFiles.length.toString());
      
      // Redirect to notes page
      router.push('/notes');
    } catch (err) {
      setError('Failed to process files. Please try again.');
      console.error('Batch upload error:', err);
    }
  };

  const handleProcess = async () => {
    if (!clinicianNote.trim()) {
      setError('Please enter a clinician note');
      return;
    }

    setIsProcessing(true);
    setError('');
    setWorkflow(null);
    setProcessingSteps([]);
    setCurrentStep(0);

    try {
      const demo = demoClaims.find(d => d.id === selectedDemo);
      const initialClaim = demo?.initial_claim as any;

      if (useAgenticMode) {
        // Simulate processing steps for visual feedback
        const steps = [
          { step: 1, reasoning: 'Analyzing clinician note...', status: 'processing' as const },
          { step: 2, reasoning: 'Extracting medical entities...', status: 'pending' as const },
          { step: 3, reasoning: 'Mapping to CPT/ICD codes...', status: 'pending' as const },
          { step: 4, reasoning: 'Validating claim structure...', status: 'pending' as const },
          { step: 5, reasoning: 'Applying fixes if needed...', status: 'pending' as const },
        ];
        
        setProcessingSteps(steps.map(s => ({ ...s, timestamp: new Date().toISOString() })));

        const response = await fetch('/api/agent/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinician_note: clinicianNote,
            initial_claim: initialClaim,
          }),
        });
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error?.message || 'Agent processing failed');
        }
        
        const agentResult = result.data;
        setWorkflow({
          agenticMode: true,
          reasoning_chain: agentResult.reasoning_chain,
          final_result: agentResult.final_result,
          total_steps: agentResult.total_steps,
          duration_ms: agentResult.duration_ms,
        });
      } else {
        const result = await processCompleteWorkflow(clinicianNote, initialClaim);
        setWorkflow({ ...result, agenticMode: false });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during processing');
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
      setProcessingSteps([]);
      setCurrentStep(0);
    }
  };

  // Debug: Log to verify component is rendering
  if (typeof window !== 'undefined') {
    console.log('Home component rendering...', { demoClaimsCount: demoClaims.length });
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero + Demo Split Section */}
      <div className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white min-h-[90vh] overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-8 py-8 lg:py-12">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left: Hero Content */}
            <div className="lg:sticky lg:top-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium mb-4 border border-white/20">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>AI-Powered Healthcare Billing Automation</span>
              </div>
              
              <h1 className="text-3xl lg:text-4xl font-bold mb-3 leading-tight">
                AI-Driven CPT Coding &<br />
                <span className="bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
                  Billing Automation for Hospitals
                </span>
              </h1>
              
              <p className="text-base lg:text-lg text-blue-100 mb-4 leading-relaxed">
                Solving healthcare's biggest hidden inefficiency: post-procedure billing.
              </p>
              
              <p className="text-sm text-blue-200 mb-4">
                15% of all claims are denied. 94,000 denied claims every day.<br />
                Our AI agent fully automates CPT coding & claim drafting — cutting costs by 50% with <strong className="text-white">zero data leaving the hospital</strong>.
              </p>

              {/* Key Stats - Prominent and Visible */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 border-2 border-white/30 shadow-lg">
                  <div className="text-3xl lg:text-4xl font-bold mb-1 text-white">15%</div>
                  <div className="text-blue-100 text-xs font-medium">Claims denied</div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 border-2 border-white/30 shadow-lg">
                  <div className="text-3xl lg:text-4xl font-bold mb-1 text-white">$20B+</div>
                  <div className="text-blue-100 text-xs font-medium">Lost annually</div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 border-2 border-white/30 shadow-lg">
                  <div className="text-3xl lg:text-4xl font-bold mb-1 text-white">50%</div>
                  <div className="text-blue-100 text-xs font-medium">Cost reduction</div>
                </div>
              </div>


              {/* HIPAA Compliance Badge - Compact */}
              <div className="mb-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-white text-sm mb-0.5">HIPAA Compliant</div>
                  <div className="text-xs text-blue-200">
                    Patient data is protected with local de-identification
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Demo Section */}
            <div id="demo-section" className="lg:sticky lg:top-8">
              <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-6 lg:p-8">
                {/* Section Header */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center gap-2 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-900 to-indigo-900 bg-clip-text text-transparent">
                      Try It Live
                    </h2>
                  </div>
                </div>

                {/* Input Area - Compact */}
                <Card className="bg-gradient-to-br from-white via-indigo-50/30 to-blue-50/30 border-2 border-indigo-200 shadow-xl rounded-2xl overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4">
            <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
              <div>
                          <CardTitle className="text-lg font-bold text-white">Clinician Note</CardTitle>
                          <CardDescription className="text-blue-100 text-xs mt-0.5">
                            Paste note or upload file (PDF, JSON, TXT, etc.)
                </CardDescription>
                        </div>
              </div>
              <div className="flex gap-2">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".txt,.json,.pdf,.md,.doc,.docx,.rtf,text/*"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    type="button" 
                    disabled={isProcessing}
                    className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 hover:text-white h-8 text-xs px-3"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('file-upload')?.click();
                    }}
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload
                  </Button>
                </Label>
                <Input
                  id="batch-upload"
                  type="file"
                  accept=".txt,.json,.pdf,.md,.doc,.docx,.rtf,text/*"
                  onChange={handleBatchUpload}
                  disabled={isProcessing}
                  multiple
                  className="hidden"
                />
                <Label htmlFor="batch-upload" className="cursor-pointer">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    type="button" 
                    disabled={isProcessing}
                    className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 hover:text-white h-8 text-xs px-3"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('batch-upload')?.click();
                    }}
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Batch Upload
                  </Button>
                </Label>
              </div>
            </div>
                  </div>
                  <CardContent className="p-4 space-y-4">
            {fileUploaded && clinicianNote && !selectedDemo && (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-3 flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-semibold text-green-900 text-sm">File Loaded</div>
                          <div className="text-xs text-green-700">Ready to process</div>
                        </div>
              </div>
            )}
            <div className="space-y-2">
                      <Label htmlFor="clinician-note" className="text-xs font-semibold text-gray-700">
                        Note Content
                      </Label>
                <textarea
                id="clinician-note"
                value={clinicianNote}
                onChange={(e) => {
                  setClinicianNote(e.target.value);
                  setFileUploaded(false);
                }}
                disabled={isProcessing}
                        className="flex min-h-[150px] w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 font-mono transition-all"
                        placeholder="Paste your clinician note here..."
              />
            </div>
            <Button
              onClick={handleProcess}
              disabled={isProcessing || !clinicianNote.trim()}
                      className={`w-full h-12 rounded-lg text-base font-semibold shadow-lg transition-all ${
                        isProcessing || !clinicianNote.trim()
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white hover:shadow-xl transform hover:-translate-y-0.5'
                      }`}
              size="lg"
            >
              {isProcessing ? (
                        <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                          <span>Processing...</span>
                </span>
              ) : (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Process Claim with AI
                        </span>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Agentic Processing Indicator */}
        {isProcessing && useAgenticMode && (
                  <div className="mt-6 animate-fade-in">
            <AgentProcessor
              isProcessing={isProcessing}
              currentStep={currentStep}
              totalSteps={processingSteps.length}
              currentAction={processingSteps[currentStep]?.reasoning}
              steps={processingSteps}
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
                  <Card className="mt-6 bg-red-50 border-red-200 shadow-sm rounded-2xl">
            <CardContent className="pt-6">
              <p className="text-red-800">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {workflow && !isProcessing && (
                  <div className="mt-6 space-y-4">
            {workflow.agenticMode && workflow.reasoning_chain && (
              <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                              <CardTitle className="text-lg font-semibold text-gray-900">Agentic Processing Complete</CardTitle>
                      <CardDescription className="text-sm text-gray-500 mt-1">
                        Completed {workflow.total_steps} steps in {workflow.duration_ms}ms
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-green-700">Success</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {workflow.reasoning_chain.map((step: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-2">
                        {step.reasoning && (
                                  <p className="text-xs text-gray-700">{step.reasoning}</p>
                        )}
                        {step.tool && (
                                  <div className="bg-white rounded-lg p-2 border border-gray-200">
                            <p className="text-xs font-medium text-gray-600">
                              Tool: <span className="font-mono text-blue-600">{step.tool}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {workflow.final_result?.pdf_url && (
                    <div className="pt-4 border-t border-gray-200">
                      <Button asChild size="lg" className="w-full">
                        <a
                          href={workflow.final_result.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Download CMS 1500 Form
                        </a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Problem Section */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              The Problem
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              After every surgery or procedure, hospitals manually translate doctors' notes into CPT codes. 
              This slow, error-prone workflow drains time and money.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-gray-900">$172</div>
                    <div className="text-sm text-gray-600">per bill in the U.S.</div>
                  </div>
                </div>
                <p className="text-gray-700">
                  Coding & billing administrative processes cost over <strong>$172 per bill</strong>.
                  <a 
                    href="https://med.stanford.edu/news/all-news/2022/08/study-lower-us-billing-costs.html" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 block mt-2 underline"
                  >
                    Stanford Medicine Study
                  </a>
                </p>
              </div>

              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-amber-100 rounded-xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-gray-900">30%</div>
                    <div className="text-sm text-gray-600">of healthcare costs</div>
                  </div>
                </div>
                <p className="text-gray-700">
                  Administrative/billing costs account for approximately <strong>30% of U.S. healthcare costs</strong>.
                  <a 
                    href="https://med.stanford.edu/news/all-news/2022/08/study-lower-us-billing-costs.html" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 block mt-2 underline"
                  >
                    Stanford Medicine Study
                  </a>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">The Billing Workflow Today</h3>
              <p className="text-gray-700 mb-6">
                A doctor writes a note. A billing clerk manually reads it, searches for codes, fills in forms, 
                sends claims to insurers, and waits. Every step is manual. Every typo, missing modifier, or late 
                submission means money lost. <strong>It's like using a typewriter in the era of GPT-5.</strong>
              </p>
              <h4 className="text-xl font-semibold text-gray-900 mb-4">Pain Points</h4>
              <div className="space-y-4">
                {[
                  'Manual de-identification & review processes',
                  'Coders reading free-text notes, selecting CPT codes manually',
                  'Drafting claims in Excel templates',
                  'High error/denial rates, slow reimbursement cycles',
                  'Diverts skilled staff from higher-value work',
                ].map((point, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                      <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-gray-700 flex-1">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Denial Prevalence Section */}
      <div className="py-20 bg-red-50 border-y border-red-100">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Denial Prevalence</h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto mb-8">
              The American Hospital Association reports that hospitals face <strong>34.4 million admissions a year</strong> — 
              and <strong className="text-red-700">15% of all claims are denied</strong>.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-2xl p-8 border-2 border-red-200 shadow-lg text-center">
              <div className="text-5xl font-bold text-red-700 mb-3">94K</div>
              <div className="text-lg text-gray-700 mb-2">Denied claims</div>
              <div className="text-sm text-gray-600">Every single day</div>
            </div>
            <div className="bg-white rounded-2xl p-8 border-2 border-red-200 shadow-lg text-center">
              <div className="text-5xl font-bold text-red-700 mb-3">60%</div>
              <div className="text-lg text-gray-700 mb-2">Never resubmitted</div>
              <div className="text-sm text-gray-600">Revenue just disappears</div>
            </div>
            <div className="bg-white rounded-2xl p-8 border-2 border-red-200 shadow-lg text-center">
              <div className="text-5xl font-bold text-red-700 mb-3">$172</div>
              <div className="text-lg text-gray-700 mb-2">Cost per bill</div>
              <div className="text-sm text-gray-600">Manual processing overhead</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 border-2 border-red-300 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Common Denial Reasons</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { issue: 'Missing codes', impact: '→ Partial reimbursement' },
                { issue: 'Wrong codes', impact: '→ Claim denied' },
                { issue: 'Upcoding / downcoding', impact: '→ Fraud flags or underpayment' },
                { issue: 'Late submission', impact: '→ Claim expired' },
                { issue: 'Typos or wrong patient info', impact: '→ Rejection before review' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{item.issue}</div>
                    <div className="text-sm text-gray-600">{item.impact}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-gray-800">
                <strong>Our insight:</strong> All these stem from manual human interpretation of complex notes. 
                If an AI can summarize a 20-page radiology report, it can also assign the correct CPT codes.
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Solution Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Our Solution: AI Agent for CPT & Claim Drafting
            </h2>
            <p className="text-2xl text-gray-600 mb-2">One Agent. Three Steps.</p>
            <p className="text-lg text-gray-500">
              Fully automated end-to-end workflow with HIPAA-compliant local de-identification
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              {
                step: 1,
                title: 'De-Identify Locally',
                description: 'HIPAA-compliant local de-identification removes PHI before any remote processing, ensuring complete patient privacy.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                bgColor: 'bg-blue-100',
                textColor: 'text-blue-600',
                stepBg: 'bg-blue-600'
              },
              {
                step: 2,
                title: 'AI Codes & Maps',
                description: 'AI reads unstructured notes, understands clinical context, and proposes all relevant CPT codes with confidence scores.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                bgColor: 'bg-purple-100',
                textColor: 'text-purple-600',
                stepBg: 'bg-purple-600'
              },
              {
                step: 3,
                title: 'Draft Claim Automatically',
                description: 'AI drafts the complete CMS-1500 claim submission text for insurance, ready for review and submission.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                bgColor: 'bg-green-100',
                textColor: 'text-green-600',
                stepBg: 'bg-green-600'
              }
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className={`w-16 h-16 ${item.bgColor} rounded-xl flex items-center justify-center ${item.textColor} mb-6`}>
                    {item.icon}
                  </div>
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${item.stepBg} text-white font-bold text-lg mb-4`}>
                    {item.step}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.description}</p>
                </div>
                {item.step < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white text-center shadow-xl">
            <p className="text-xl mb-4">
              <strong>Result:</strong> Instant reimbursement, fewer denials, and happier staff — 
              with complete transparency and auditability.
            </p>
            <p className="text-lg text-blue-100 mt-4">
              What used to take hours now takes seconds.
            </p>
          </div>
        </div>
      </div>

      {/* Competitive Advantage Section */}
      <div className="py-20 bg-indigo-50 border-y border-indigo-100">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Competitive Advantage</h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto">
              Current solutions either rely on manual coders or basic CPT lookup tools.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                What Competitors Offer
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">×</span>
                  <span>Manual coders or basic CPT lookup tools</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">×</span>
                  <span>No end-to-end automation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">×</span>
                  <span>PHI leaves the hospital</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">×</span>
                  <span>No LLM agents generating actual claim text</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border-2 border-green-400 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                Our Differentiator
              </h3>
              <ul className="space-y-3 text-gray-800">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span><strong>Full automation</strong> — AI agent handles entire workflow</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span><strong>Local PHI handling</strong> — zero data leaves the hospital</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span><strong>LLM agents</strong> that generate the actual claim text</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span><strong>HIPAA-compliant</strong> by design</span>
                </li>
              </ul>
              <div className="mt-6 p-4 bg-white rounded-xl border-2 border-green-400">
                <p className="text-center font-bold text-gray-900 text-lg">
                  Full automation with zero data leaving the hospital.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HIPAA Compliance Section */}
      <div className="py-16 bg-gradient-to-br from-green-50 via-emerald-50 to-blue-50 border-y border-green-100">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full text-sm font-semibold text-green-800 mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>HIPAA Compliant</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Your Patient Data is Protected
              </h2>
              <p className="text-lg text-gray-700 mb-4">
                We understand that patient privacy is paramount. Our platform ensures complete HIPAA compliance 
                through local de-identification before any processing occurs.
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>Local Processing:</strong> PHI is de-identified on your system before any data leaves your control</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>Zero Exposure:</strong> Sensitive patient information never reaches our servers</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>Compliance Built-In:</strong> Our de-identification process meets all HIPAA requirements</span>
                </li>
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-8 border-2 border-green-200 shadow-xl">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Secure by Design</h3>
                <p className="text-gray-700 leading-relaxed">
                  Patient data security isn't an afterthought—it's the foundation of our platform. 
                  We protect your sensitive information with industry-leading privacy practices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team & Traction Section */}
      <div className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Team</h2>
            <p className="text-xl text-gray-700 mb-2">
              <strong>Our strength is deep domain + AI execution</strong>
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-2xl p-8 border-2 border-blue-200 shadow-lg">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Amin Rouzi</h3>
              <p className="text-lg text-gray-700 font-semibold mb-3">AI Engineer, UCLA Health</p>
              <p className="text-gray-600 text-sm">
                <strong>4 years of clinical AI</strong> at UCLA Health. Extensive experience building clinical AI systems 
                at top-tier health systems. Deep expertise in healthcare data, workflows, and AI integration.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 border-2 border-purple-200 shadow-lg">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Komeel Abbas</h3>
              <p className="text-lg text-gray-700 font-semibold mb-3">Software Engineer</p>
              <p className="text-gray-600 text-sm">
                <strong>Scaled enterprise SaaS.</strong> Proven track record building and scaling software systems 
                for enterprise customers. Deep experience in revenue cycle management and billing operations.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-green-200 shadow-lg">
              <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Shashwat Panigrahi</h3>
              <p className="text-lg text-gray-700 font-semibold mb-3">GetTalky AI</p>
              <p className="text-gray-600 text-sm">
                <strong>Built ML agents at GetTalky.</strong> Deep expertise in machine learning and AI agent systems. 
                Proven experience building production-grade AI solutions that automate complex workflows.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-bold text-lg mb-4">ClaimSense AI</h4>
              <p className="text-sm">
                Automating CPT coding and claims drafting with AI. From procedure to reimbursement — streamlined.
              </p>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-3">Product</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Features</a></li>
                <li><a href="#" className="hover:text-white transition">Demo</a></li>
                <li><a href="#" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition">Security</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-3">Company</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Team</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-3">Resources</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition">Case Studies</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Support</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2024 ClaimSense AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
