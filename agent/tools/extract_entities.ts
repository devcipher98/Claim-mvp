/**
 * MCP Tool: Extract Entities
 * Wraps the /api/extract_entities endpoint
 */

export interface ExtractEntitiesInput {
  clinician_note: string;
}

export async function extractEntitiesTool(input: ExtractEntitiesInput): Promise<any> {
  try {
    const response = await fetch('http://localhost:3000/api/extract_entities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Entity extraction failed');
    }
    
    return result.data;
  } catch (error: any) {
    console.error('Error in extract_entities tool:', error);
    throw new Error(`Failed to extract entities: ${error.message}`);
  }
}

