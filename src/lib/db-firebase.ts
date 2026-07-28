// Firebase Database Client for Vercel Serverless
// Uses Firebase Realtime Database as primary database for production

const FIREBASE_URL = process.env.NEXT_PUBLIC_FIREBASE_URL || 'https://markzshabab-4c01b-default-rtdb.firebaseio.com';

export interface SurveyResponse {
  id: string;
  deviceFingerprint: string;
  sportsActivities: string[];
  culturalActivities: string[];
  socialActivities: string[];
  suggestions: string[];
  question1Answer: string;
  question2Answer: string;
  question3Answer: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface DeviceFingerprint {
  fingerprint: string;
  hasVoted: boolean;
  hasRecordedMedia: boolean;
  createdAt: string;
}

// Helper to make Firebase requests
async function firebaseRequest(path: string, options?: RequestInit): Promise<any> {
  const url = `${FIREBASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Firebase error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Check if device has voted
export async function checkDeviceFingerprint(fingerprint: string): Promise<{ hasVoted: boolean; hasRecordedMedia: boolean }> {
  try {
    const data = await firebaseRequest(`/fingerprints/${fingerprint}.json`);
    
    if (data && !data.error) {
      return {
        hasVoted: data.hasVoted || false,
        hasRecordedMedia: data.hasRecordedMedia || false,
      };
    }
    
    return { hasVoted: false, hasRecordedMedia: false };
  } catch (error) {
    console.error('Error checking fingerprint:', error);
    return { hasVoted: false, hasRecordedMedia: false };
  }
}

// Mark device as voted
export async function markDeviceAsVoted(fingerprint: string): Promise<void> {
  const now = new Date().toISOString();
  
  // Get existing record
  const existing = await firebaseRequest(`/fingerprints/${fingerprint}.json`).catch(() => null);
  
  const data: DeviceFingerprint = {
    fingerprint,
    hasVoted: true,
    hasRecordedMedia: existing?.hasRecordedMedia || false,
    createdAt: existing?.createdAt || now,
  };
  
  await firebaseRequest(`/fingerprints/${fingerprint}.json`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Mark device as recorded media
export async function markDeviceAsRecordedMedia(fingerprint: string): Promise<void> {
  const now = new Date().toISOString();
  
  // Get existing record
  const existing = await firebaseRequest(`/fingerprints/${fingerprint}.json`).catch(() => null);
  
  const data: DeviceFingerprint = {
    fingerprint,
    hasVoted: existing?.hasVoted || false,
    hasRecordedMedia: true,
    createdAt: existing?.createdAt || now,
  };
  
  await firebaseRequest(`/fingerprints/${fingerprint}.json`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Create survey response
export async function createSurveyResponse(responseData: Omit<SurveyResponse, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const fullResponse: SurveyResponse = {
    ...responseData,
    id,
    createdAt: now,
    updatedAt: now,
  };
  
  await firebaseRequest(`/responses/${id}.json`, {
    method: 'PUT',
    body: JSON.stringify(fullResponse),
  });
  
  // Also mark device as voted
  await markDeviceAsVoted(responseData.deviceFingerprint);
  
  return id;
}

// Get all responses
export async function getAllResponses(): Promise<SurveyResponse[]> {
  try {
    const data = await firebaseRequest('/responses.json');
    
    if (!data || data.error || data === null) {
      return [];
    }
    
    // Convert object to array
    return Object.values(data).filter(r => r && r.id) as SurveyResponse[];
  } catch (error) {
    console.error('Error getting responses:', error);
    return [];
  }
}

// Update response status
export async function updateResponseStatus(id: string, status: 'approved' | 'rejected'): Promise<void> {
  const now = new Date().toISOString();
  
  await firebaseRequest(`/responses/${id}/status.json`, {
    method: 'PUT',
    body: JSON.stringify(status),
  });
  
  await firebaseRequest(`/responses/${id}/updatedAt.json`, {
    method: 'PUT',
    body: JSON.stringify(now),
  });
}

// Get single response
export async function getResponse(id: string): Promise<SurveyResponse | null> {
  try {
    const data = await firebaseRequest(`/responses/${id}.json`);
    
    if (!data || data.error || data === null) {
      return null;
    }
    
    return data as SurveyResponse;
  } catch (error) {
    console.error('Error getting response:', error);
    return null;
  }
}

// Get statistics
export async function getStatistics() {
  const responses = await getAllResponses();
  
  // Calculate Question 1 stats (Satisfaction)
  const q1Satisfied = responses.filter(r => r.question1Answer === 'satisfied').length;
  const q1NotSatisfied = responses.filter(r => r.question1Answer === 'not_satisfied').length;

  // Calculate Question 2 stats (Support nomination)
  const q2Support = responses.filter(r => r.question2Answer === 'support').length;
  const q2NotSupport = responses.filter(r => r.question2Answer === 'not_support').length;

  // Calculate Question 3 stats (Preferred management)
  const q3NewYouth = responses.filter(r => r.question3Answer === 'new_youth').length;
  const q3CurrentManagement = responses.filter(r => r.question3Answer === 'current_management').length;

  // Parse and count activities
  const activityCounts: Record<string, number> = {};
  
  responses.forEach(response => {
    try {
      [...(response.sportsActivities || []), ...(response.culturalActivities || []), 
       ...(response.socialActivities || []), ...(response.suggestions || [])].forEach((activity: string) => {
        activityCounts[activity] = (activityCounts[activity] || 0) + 1;
      });
    } catch (e) {
      console.error('Error parsing activities:', e);
    }
  });

  // Sort activities by count
  const topActivities = Object.entries(activityCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  // Status counts
  const statusCounts = {
    pending: responses.filter(r => r.status === 'pending').length,
    approved: responses.filter(r => r.status === 'approved').length,
    rejected: responses.filter(r => r.status === 'rejected').length,
  };

  return {
    totalResponses: responses.length,
    question1: {
      satisfied: q1Satisfied,
      not_satisfied: q1NotSatisfied,
      total: q1Satisfied + q1NotSatisfied,
      satisfiedPercentage: q1Satisfied + q1NotSatisfied > 0 
        ? Math.round((q1Satisfied / (q1Satisfied + q1NotSatisfied)) * 100) 
        : 0,
    },
    question2: {
      support: q2Support,
      not_support: q2NotSupport,
      total: q2Support + q2NotSupport,
      supportPercentage: q2Support + q2NotSupport > 0 
        ? Math.round((q2Support / (q2Support + q2NotSupport)) * 100) 
        : 0,
    },
    question3: {
      new_youth: q3NewYouth,
      current_management: q3CurrentManagement,
      total: q3NewYouth + q3CurrentManagement,
      newYouthPercentage: q3NewYouth + q3CurrentManagement > 0 
        ? Math.round((q3NewYouth / (q3NewYouth + q3CurrentManagement)) * 100) 
        : 0,
    },
    topActivities,
    statusCounts,
    mediaCount: responses.filter(r => r.mediaUrl && r.mediaType).length,
  };
}
