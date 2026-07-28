import { NextRequest, NextResponse } from 'next/server';
import { 
  checkDeviceFingerprint, 
  createSurveyResponse, 
  getAllResponses,
} from '@/lib/db-firebase';

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      deviceFingerprint,
      sportsActivities,
      culturalActivities,
      socialActivities,
      suggestions,
      question1Answer,
      question2Answer,
      question3Answer,
      mediaType,
      mediaUrl,
    } = body;

    // Validate required fields
    if (!deviceFingerprint || !question1Answer || !question2Answer || !question3Answer) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if device has already voted (using Firebase)
    const deviceStatus = await checkDeviceFingerprint(deviceFingerprint);
    
    if (deviceStatus.hasVoted) {
      return NextResponse.json(
        { error: 'Device has already voted' },
        { status: 409 }
      );
    }

    // Parse activities arrays
    const parsedSports = typeof sportsActivities === 'string' ? JSON.parse(sportsActivities || '[]') : (sportsActivities || []);
    const parsedCultural = typeof culturalActivities === 'string' ? JSON.parse(culturalActivities || '[]') : (culturalActivities || []);
    const parsedSocial = typeof socialActivities === 'string' ? JSON.parse(socialActivities || '[]') : (socialActivities || []);
    const parsedSuggestions = typeof suggestions === 'string' ? JSON.parse(suggestions || '[]') : (suggestions || []);

    // Create survey response in Firebase
    const id = await createSurveyResponse({
      deviceFingerprint,
      sportsActivities: parsedSports,
      culturalActivities: parsedCultural,
      socialActivities: parsedSocial,
      suggestions: parsedSuggestions,
      question1Answer,
      question2Answer,
      question3Answer,
      mediaType: mediaType || null,
      mediaUrl: mediaUrl || null,
      status: 'pending',
    });

    return NextResponse.json({
      success: true,
      id,
      message: 'Survey submitted successfully',
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Submit survey error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET all responses (for admin)
export async function GET() {
  try {
    const responses = await getAllResponses();

    // Convert to string format for compatibility
    const formattedResponses = responses.map(r => ({
      ...r,
      sportsActivities: JSON.stringify(r.sportsActivities),
      culturalActivities: JSON.stringify(r.culturalActivities),
      socialActivities: JSON.stringify(r.socialActivities),
      suggestions: JSON.stringify(r.suggestions),
    }));

    return NextResponse.json({ responses: formattedResponses }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Get responses error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
