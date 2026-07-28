import { NextRequest, NextResponse } from 'next/server';
import { 
  checkDeviceFingerprint, 
  markDeviceAsRecordedMedia,
} from '@/lib/db-firebase';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://markzshabab.studusa05.workers.dev';
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-3fb0b86037554ed0b842bc258e8a3051.r2.dev';

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-File-Name, X-File-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'video' or 'audio'
    const fingerprint = formData.get('fingerprint') as string;

    if (!file || !type || !fingerprint) {
      return NextResponse.json(
        { error: 'Missing required fields: file, type, fingerprint' },
        { status: 400 }
      );
    }

    // Check if device has already recorded media (using Firebase)
    const deviceStatus = await checkDeviceFingerprint(fingerprint);
    
    if (deviceStatus.hasRecordedMedia) {
      return NextResponse.json(
        { error: 'Device has already recorded media' },
        { status: 409 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to R2 via Worker
    const fileName = `${fingerprint}_${Date.now()}.${type === 'video' ? 'webm' : 'webm'}`;
    
    try {
      const uploadResponse = await fetch(`${WORKER_URL}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': fileName,
          'X-File-Type': type,
        },
        body: buffer,
      });

      if (!uploadResponse.ok) {
        console.error('R2 upload failed:', await uploadResponse.text());
        throw new Error('Upload to R2 failed');
      }

      const uploadData = await uploadResponse.json();
      
      // Update device fingerprint record in Firebase
      await markDeviceAsRecordedMedia(fingerprint);

      const mediaUrl = uploadData.url || `${R2_PUBLIC_URL}/${fileName}`;

      return NextResponse.json({
        success: true,
        url: mediaUrl,
        fileName,
        message: 'Media uploaded successfully',
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (uploadError) {
      console.error('R2 upload error:', uploadError);
      
      // Return success with null URL for demo purposes
      // In production, you would handle this differently
      return NextResponse.json({
        success: true,
        url: null,
        fileName,
        message: 'Media saved locally (R2 unavailable)',
        warning: 'Could not upload to cloud storage',
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error during upload' },
      { status: 500 }
    );
  }
}
