import { NextResponse } from 'next/server';
import { getAllResponses } from '@/lib/db-firebase';

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET() {
  try {
    // Get only approved responses with media
    const allResponses = await getAllResponses();
    
    const approvedMedia = allResponses
      .filter(r => r.status === 'approved' && r.mediaUrl && r.mediaType)
      .map(r => ({
        id: r.id,
        mediaType: r.mediaType,
        mediaUrl: r.mediaUrl,
        question1Answer: r.question1Answer,
        question2Answer: r.question2Answer,
        question3Answer: r.question3Answer,
        createdAt: r.createdAt,
      }));

    return NextResponse.json({ 
      items: approvedMedia,
      total: approvedMedia.length 
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Gallery error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
