import type { NextApiRequest, NextApiResponse } from 'next';
import { APIResponse, ExtractedEntities } from '@/types';
import { extractEntitiesFromNote } from '@/server/ai/coordinator';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<APIResponse<ExtractedEntities>>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed',
      },
      timestamp: new Date().toISOString(),
    });
  }
  
  try {
    const { clinician_note } = req.body;
    
    if (!clinician_note || typeof clinician_note !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing or invalid clinician_note in request body',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Extract entities using AI
    const entities = await extractEntitiesFromNote(clinician_note);
    
    return res.status(200).json({
      success: true,
      data: entities,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in extract_entities:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'EXTRACTION_FAILED',
        message: error.message || 'Failed to extract entities',
        details: error,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

