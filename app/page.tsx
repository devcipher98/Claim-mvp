'use client';

import { useState } from 'react';
import Link from 'next/link';
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

  const demoClaims = demoClaimsData as any[];

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
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      setError('Please upload a .txt file');
      return;
    }

    if (file.size > 1024 * 1024) {
      setError('File size must be less than 1MB');
      return;
    }

    try {
      const text = await file.text();
      setClinicianNote(text);
      setSelectedDemo('');
      setError('');
      setWorkflow(null);
      setProcessingSteps([]);
      setCurrentStep(0);
    } catch (err) {
      setError('Failed to read file');
      console.error('File read error:', err);
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
      const initialClaim = demo?.initial_claim;

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ClaimSense AI</h1>
            <p className="text-gray-600 mt-1">
              Healthcare billing assistant with AI-powered claim validation
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" size="lg">
              <Link href="/notes">Upload Notes</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/claims">View Claims</Link>
            </Button>
          </div>
        </div>

        {/* Demo Selector */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900">Demo Case</CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Choose a pre-configured test case
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo-select">Select Case</Label>
              <select
                id="demo-select"
                value={selectedDemo}
                onChange={handleDemoSelect}
                disabled={isProcessing}
                className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">-- Choose a demo case --</option>
                {demoClaims.map((demo) => (
                  <option key={demo.id} value={demo.id}>
                    {demo.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedDemo && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
                <p className="text-sm text-gray-700">
                  <strong>Description:</strong> {demoClaims.find(d => d.id === selectedDemo)?.description}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Issue:</strong> {demoClaims.find(d => d.id === selectedDemo)?.expected_issue}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mode Toggle */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  {useAgenticMode ? 'Agentic Mode' : 'Traditional Mode'}
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 mt-1">
                  {useAgenticMode 
                    ? 'AI agent autonomously decides workflow via MCP protocol'
                    : 'Follows predetermined workflow steps'
                  }
                </CardDescription>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAgenticMode}
                  onChange={(e) => setUseAgenticMode(e.target.checked)}
                  disabled={isProcessing}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ms-3 text-sm font-medium text-gray-900">
                  {useAgenticMode ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>
          </CardHeader>
        </Card>

        {/* Input Area */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900">Clinician Note</CardTitle>
                <CardDescription className="text-sm text-gray-500">
                  Enter note or upload a .txt file (max 1MB)
                </CardDescription>
              </div>
              <Label htmlFor="file-upload" className="cursor-pointer">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
                <Button variant="outline" size="sm" type="button" disabled={isProcessing}>
                  Upload File
                </Button>
              </Label>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {clinicianNote && !selectedDemo && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-3">
                <span className="text-sm text-green-600 font-medium">File loaded</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="clinician-note">Note Content</Label>
              <textarea
                id="clinician-note"
                value={clinicianNote}
                onChange={(e) => setClinicianNote(e.target.value)}
                disabled={isProcessing}
                className="flex min-h-[160px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                placeholder="Enter clinician note here..."
              />
            </div>
            <Button
              onClick={handleProcess}
              disabled={isProcessing || !clinicianNote.trim()}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Processing...
                </span>
              ) : (
                'Process Claim'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Agentic Processing Indicator */}
        {isProcessing && useAgenticMode && (
          <div className="animate-fade-in">
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
          <Card className="bg-red-50 border-red-200 shadow-sm rounded-2xl">
            <CardContent className="pt-6">
              <p className="text-red-800">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {workflow && !isProcessing && (
          <div className="space-y-6">
            {workflow.agenticMode && workflow.reasoning_chain && (
              <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-semibold text-gray-900">Agentic Processing Complete</CardTitle>
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
                    <div key={idx} className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-2">
                        {step.reasoning && (
                          <p className="text-sm text-gray-700">{step.reasoning}</p>
                        )}
                        {step.tool && (
                          <div className="bg-white rounded-xl p-2 border border-gray-200">
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

            {!workflow.agenticMode && (
              <>
                {/* Extracted Entities */}
                <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-gray-900">1. Extracted Entities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-50 p-4 rounded-xl overflow-x-auto text-sm border border-gray-200">
                      {JSON.stringify(workflow.entities, null, 2)}
                    </pre>
                  </CardContent>
                </Card>

                {/* Mapped Codes */}
                <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-gray-900">2. Mapped Codes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">CPT Codes:</h3>
                      {workflow.mappedCodes.cpt_codes.map((code: any, idx: number) => (
                        <div key={idx} className="bg-blue-50 p-3 rounded-2xl mb-2 border border-blue-200">
                          <p className="font-mono font-bold">{code.code}</p>
                          <p className="text-sm text-gray-600">{code.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Confidence: {(code.confidence * 100).toFixed(0)}% | Source: {code.source}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">ICD-10 Codes:</h3>
                      {workflow.mappedCodes.icd_codes.map((code: any, idx: number) => (
                        <div key={idx} className="bg-green-50 p-3 rounded-2xl mb-2 border border-green-200">
                          <p className="font-mono font-bold">{code.code}</p>
                          <p className="text-sm text-gray-600">{code.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Confidence: {(code.confidence * 100).toFixed(0)}% | Source: {code.source}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Validation Results */}
                <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-gray-900">3. Validation Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {workflow.validationResult.valid ? (
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                        <p className="text-green-800 font-semibold">Claim is valid</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {workflow.validationResult.issues.map((issue: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl border ${
                              issue.severity === 'error'
                                ? 'bg-red-50 border-red-200'
                                : 'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <p className="font-semibold">
                              {issue.severity.toUpperCase()}: {issue.message}
                            </p>
                            {issue.suggested_fix && (
                              <p className="text-sm mt-1">Suggested Fix: {issue.suggested_fix}</p>
                            )}
                            {issue.rule_reference && (
                              <p className="text-xs text-gray-600 mt-1">
                                Reference: {issue.rule_reference}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AI Fixes */}
                {workflow.fixResult && (
                  <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-xl font-semibold text-gray-900">4. AI-Generated Fixes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {workflow.fixResult.fixes_applied.map((fix: any, idx: number) => (
                        <div key={idx} className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
                          <p className="font-semibold text-blue-900">{fix.description}</p>
                          <p className="text-sm text-gray-700 mt-2">{fix.reasoning}</p>
                          {fix.rule_citation && (
                            <p className="text-xs text-gray-600 mt-2 italic">
                              Citation: {fix.rule_citation}
                            </p>
                          )}
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-600">Patches:</p>
                            <pre className="bg-white p-2 rounded-xl text-xs mt-1 overflow-x-auto border border-gray-200">
                              {JSON.stringify(fix.patches, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Payer Decision */}
                <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-gray-900">5. Payer Decision</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`p-6 rounded-2xl border ${
                        workflow.payerDecision.decision === 'approved'
                          ? 'bg-green-50 border-green-300'
                          : 'bg-red-50 border-red-300'
                      }`}
                    >
                      <p className="text-2xl font-bold mb-2 uppercase tracking-wide">
                        {workflow.payerDecision.decision === 'approved' ? 'APPROVED' : 'DENIED'}
                      </p>
                      <p className="text-lg mb-2">Claim ID: {workflow.payerDecision.claim_id}</p>
                      <p className="text-sm text-gray-700 mb-2">Reason: {workflow.payerDecision.reason}</p>
                      {workflow.payerDecision.amount_approved && (
                        <p className="text-xl font-bold text-green-700 mt-4">
                          Amount Approved: ${workflow.payerDecision.amount_approved.toFixed(2)}
                        </p>
                      )}
                      {workflow.payerDecision.reason_codes && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold">Reason Codes:</p>
                          <p className="text-sm">{workflow.payerDecision.reason_codes.join(', ')}</p>
                        </div>
                      )}
                      {workflow.payerDecision.pdf_url && (
                        <div className="mt-6 pt-4 border-t border-gray-300">
                          <Button asChild size="lg" className="w-full">
                            <a
                              href={workflow.payerDecision.pdf_url}
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
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
