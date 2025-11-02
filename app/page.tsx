'use client';

import { useState } from 'react';
import { processCompleteWorkflow } from './lib/api-client';
import demoClaimsData from '@/data/demo_claims.json';

export default function Home() {
  const [selectedDemo, setSelectedDemo] = useState<string>('');
  const [clinicianNote, setClinicianNote] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [workflow, setWorkflow] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [useAgenticMode, setUseAgenticMode] = useState(true); // Default to agentic

  const demoClaims = demoClaimsData as any[];

  const handleDemoSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const demoId = e.target.value;
    setSelectedDemo(demoId);
    
    const demo = demoClaims.find(d => d.id === demoId);
    if (demo) {
      setClinicianNote(demo.clinician_note);
      setWorkflow(null);
      setError('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.name.endsWith('.txt')) {
      setError('Please upload a .txt file');
      return;
    }

    // Check file size (max 1MB)
    if (file.size > 1024 * 1024) {
      setError('File size must be less than 1MB');
      return;
    }

    try {
      const text = await file.text();
      setClinicianNote(text);
      setSelectedDemo(''); // Clear demo selection
      setError('');
      setWorkflow(null);
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

    try {
      // Get the initial claim data from demo if available
      const demo = demoClaims.find(d => d.id === selectedDemo);
      const initialClaim = demo?.initial_claim;

      if (useAgenticMode) {
        // AGENTIC MODE: AI agent autonomously uses MCP tools
        console.log('🤖 Using AGENTIC mode with MCP protocol');
        
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
        
        // Transform agent result to match workflow format for display
        const agentResult = result.data;
        setWorkflow({
          agenticMode: true,
          reasoning_chain: agentResult.reasoning_chain,
          final_result: agentResult.final_result,
          total_steps: agentResult.total_steps,
          duration_ms: agentResult.duration_ms,
        });
      } else {
        // TRADITIONAL MODE: Hardcoded workflow
        console.log('📋 Using TRADITIONAL mode (hardcoded workflow)');
        const result = await processCompleteWorkflow(clinicianNote, initialClaim);
        setWorkflow({ ...result, agenticMode: false });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during processing');
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            ClaimSense AI Billing Employee
          </h1>
          <p className="text-xl text-gray-600">
            Healthcare billing assistant with AI-powered claim validation and fixing
          </p>
          <div className="flex gap-4 justify-center mt-4">
            <a
              href="/notes"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors"
            >
              📋 Upload Notes (Auto-Process)
            </a>
            <a
              href="/claims"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors"
            >
              📑 View Generated Claims
            </a>
          </div>
        </div>

        {/* Demo Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Demo Case
          </label>
          <select
            value={selectedDemo}
            onChange={handleDemoSelect}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Choose a demo case --</option>
            {demoClaims.map((demo) => (
              <option key={demo.id} value={demo.id}>
                {demo.name}
              </option>
            ))}
          </select>
          {selectedDemo && (
            <div className="mt-4 p-4 bg-blue-50 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>Description:</strong>{' '}
                {demoClaims.find(d => d.id === selectedDemo)?.description}
              </p>
              <p className="text-sm text-gray-700 mt-2">
                <strong>Expected Issue:</strong>{' '}
                {demoClaims.find(d => d.id === selectedDemo)?.expected_issue}
              </p>
              <p className="text-sm text-gray-700 mt-2">
                <strong>Expected Fix:</strong>{' '}
                {demoClaims.find(d => d.id === selectedDemo)?.expected_fix}
              </p>
            </div>
          )}
        </div>

        {/* Mode Toggle */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-md p-6 mb-6 border-2 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {useAgenticMode ? '🤖 Agentic Mode (MCP)' : '📋 Traditional Mode'}
              </h3>
              <p className="text-sm text-gray-600">
                {useAgenticMode 
                  ? 'AI agent autonomously decides which tools to use and when via Metorial MCP protocol'
                  : 'Hardcoded workflow follows predetermined steps'
                }
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useAgenticMode}
                onChange={(e) => setUseAgenticMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
              <span className="ms-3 text-sm font-medium text-gray-900">
                {useAgenticMode ? 'ON' : 'OFF'}
              </span>
            </label>
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Clinician Note
            </label>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors">
                📄 Upload .txt File
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {clinicianNote && !selectedDemo && (
                <span className="text-xs text-green-600 font-medium">
                  ✓ File loaded
                </span>
              )}
            </div>
          </div>
          <textarea
            value={clinicianNote}
            onChange={(e) => setClinicianNote(e.target.value)}
            className="w-full h-40 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="Enter clinician note here or upload a .txt file..."
          />
          <div className="mt-2 text-xs text-gray-500">
            You can type directly, select a demo case above, or upload a .txt file (max 1MB)
          </div>
          <button
            onClick={handleProcess}
            disabled={isProcessing || !clinicianNote.trim()}
            className="mt-4 w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {isProcessing ? 'Processing...' : 'Process Claim'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Results */}
        {workflow && (
          <div className="space-y-6">
            {/* Agentic Mode: Show Reasoning Chain */}
            {workflow.agenticMode && workflow.reasoning_chain && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg shadow-md p-6 border-2 border-purple-300">
                <h2 className="text-2xl font-bold text-purple-900 mb-4">
                  🤖 AI Agent Reasoning Chain
                </h2>
                <div className="mb-4 flex items-center gap-4 text-sm">
                  <span className="bg-purple-100 px-3 py-1 rounded-full font-semibold">
                    Total Steps: {workflow.total_steps}
                  </span>
                  <span className="bg-indigo-100 px-3 py-1 rounded-full font-semibold">
                    Duration: {workflow.duration_ms}ms
                  </span>
                </div>
                
                <div className="space-y-4">
                  {workflow.reasoning_chain.map((step: any, idx: number) => (
                    <div key={idx} className="bg-white rounded-lg p-4 shadow border-l-4 border-purple-500">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                          {step.step}
                        </div>
                        <div className="flex-1">
                          {step.reasoning && (
                            <p className="text-gray-700 mb-2">
                              <strong className="text-purple-700">💭 Thinking:</strong> {step.reasoning}
                            </p>
                          )}
                          {step.tool && (
                            <div className="mt-2 bg-purple-50 rounded p-3">
                              <p className="text-sm font-semibold text-purple-900">
                                🔧 Tool Used: <code className="bg-purple-200 px-2 py-1 rounded">{step.tool}</code>
                              </p>
                              {step.tool_output && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-xs font-semibold text-gray-900 hover:text-purple-700 underline">
                                    View tool output
                                  </summary>
                                  <pre className="mt-2 text-xs bg-white p-2 rounded overflow-x-auto max-h-40 text-gray-900 border border-gray-200">
                                    {JSON.stringify(step.tool_output, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Final Result */}
                {workflow.final_result && (
                  <div className="mt-6 bg-green-50 rounded-lg p-4 border-2 border-green-300">
                    <h3 className="text-lg font-bold text-green-900 mb-2">
                      ✅ Final Result
                    </h3>
                    <pre className="bg-white p-4 rounded overflow-x-auto text-sm">
                      {JSON.stringify(workflow.final_result, null, 2)}
                    </pre>
                    
                    {/* PDF Download Link */}
                    {workflow.final_result?.pdf_url && (
                      <div className="mt-4 pt-4 border-t border-green-300">
                        <a
                          href={workflow.final_result.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Download CMS 1500 Form (PDF)
                        </a>
                        <p className="text-xs text-gray-600 mt-2">
                          📋 This form is pre-filled with your claim information and ready for submission.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Traditional Mode: Show Old Format */}
            {!workflow.agenticMode && (
              <>
            {/* Extracted Entities */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                1. Extracted Entities
              </h2>
              <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-sm">
                {JSON.stringify(workflow.entities, null, 2)}
              </pre>
            </div>

            {/* Mapped Codes */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                2. Mapped Codes
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">CPT Codes:</h3>
                  {workflow.mappedCodes.cpt_codes.map((code: any, idx: number) => (
                    <div key={idx} className="bg-blue-50 p-3 rounded-md mb-2">
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
                    <div key={idx} className="bg-green-50 p-3 rounded-md mb-2">
                      <p className="font-mono font-bold">{code.code}</p>
                      <p className="text-sm text-gray-600">{code.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Confidence: {(code.confidence * 100).toFixed(0)}% | Source: {code.source}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Validation Results */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                3. Validation Results
              </h2>
              {workflow.validationResult.valid ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-semibold">✓ Claim is valid!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {workflow.validationResult.issues.map((issue: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border ${
                        issue.severity === 'error'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-yellow-50 border-yellow-200'
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
            </div>

            {/* AI Fixes */}
            {workflow.fixResult && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  4. AI-Generated Fixes
                </h2>
                <div className="space-y-4">
                  {workflow.fixResult.fixes_applied.map((fix: any, idx: number) => (
                    <div key={idx} className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <p className="font-semibold text-purple-900">{fix.description}</p>
                      <p className="text-sm text-gray-700 mt-2">{fix.reasoning}</p>
                      {fix.rule_citation && (
                        <p className="text-xs text-gray-600 mt-2 italic">
                          Citation: {fix.rule_citation}
                        </p>
                      )}
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-600">Patches:</p>
                        <pre className="bg-white p-2 rounded text-xs mt-1 overflow-x-auto">
                          {JSON.stringify(fix.patches, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payer Decision */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                5. Payer Decision
              </h2>
              <div
                className={`p-6 rounded-lg border-2 ${
                  workflow.payerDecision.decision === 'approved'
                    ? 'bg-green-50 border-green-500'
                    : 'bg-red-50 border-red-500'
                }`}
              >
                <p className="text-2xl font-bold mb-2">
                  {workflow.payerDecision.decision === 'approved' ? '✓ APPROVED' : '✗ DENIED'}
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
                    <a
                      href={workflow.payerDecision.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Download CMS 1500 Form (PDF)
                    </a>
                    <p className="text-xs text-gray-600 mt-2">
                      📋 This form is pre-filled with your claim information and ready for submission.
                    </p>
                  </div>
                )}
              </div>
            </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

