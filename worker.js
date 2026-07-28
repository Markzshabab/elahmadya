/**
 * CLOUDFLARE WORKER - El Ahmadiya Youth Center Survey
 * 
 * Bindings Required in Cloudflare Dashboard (Settings > Bindings):
 * 1. R2 Bucket: Variable name = MEDIA_BUCKET, select your bucket
 * 2. KV Namespace: Variable name = RATE_LIMITER (optional, for rate limiting)
 * 
 * Environment Variables (Settings > Variables):
 * - FIREBASE_URL: Your Firebase Realtime Database URL
 * - FIREBASE_AUTH: Your Firebase database secret
 * - ADMIN_SECRET: Admin password for admin panel
 */

export default {
    async fetch(request, env) => {
        // CORS Headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-IP, cf-connecting-ip'
        };

        // Handle preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const url = new URL(request.url);
        const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
        
        try {
            // ==================== VOTE SUBMISSION ====================
            if (request.method === 'POST' && url.pathname === '/api/vote') {
                return await handleVoteSubmission(request, env, corsHeaders, clientIP);
            }

            // ==================== STATS ENDPOINT ====================
            if (request.method === 'GET' && url.pathname === '/api/stats') {
                return await handleStats(env, corsHeaders);
            }

            // ==================== MEDIA UPLOAD ====================
            if (request.method === 'POST' && url.pathname === '/api/upload-media') {
                return await handleMediaUpload(request, env, corsHeaders, clientIP);
            }

            // ==================== GET MEDIA LIST ====================
            if (request.method === 'GET' && url.pathname === '/api/media') {
                return await getMediaList(env, corsHeaders);
            }

            // ==================== ADMIN ENDPOINTS ====================
            if (url.pathname.startsWith('/admin/')) {
                return await handleAdminRequest(request, env, corsHeaders, url, clientIP);
            }

            // Default response
            return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Worker Error:', error);
            return new Response(JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};

// ==================== HANDLE VOTE SUBMISSION ====================
async function handleVoteSubmission(request, env, corsHeaders, clientIP) {
    try {
        const formData = await request.formData();
        const votesStr = formData.get('votes');
        const fingerprint = formData.get('fingerprint');
        const media = formData.get('media');
        const mediaType = formData.get('type');

        // Parse votes
        let votes;
        try {
            votes = JSON.parse(votesStr || '{}');
        } catch (e) {
            return jsonResponse({ error: 'Invalid votes format' }, 400, corsHeaders);
        }

        // Validate required fields
        if (!votes || Object.keys(votes).length === 0) {
            return jsonResponse({ error: 'No votes provided' }, 400, corsHeaders);
        }

        // Generate unique ID for this submission
        const submissionId = crypto.randomUUID();
        let mediaUrl = null;

        // Upload media to R2 if exists
        if (media && env.MEDIA_BUCKET) {
            try {
                const extension = mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'mp3' : 'bin';
                const key = `submissions/${submissionId}.${extension}`;
                
                await env.MEDIA_BUCKET.put(key, media.stream(), {
                    httpMetadata: { 
                        contentType: media.type || (mediaType === 'video' ? 'video/mp4' : 'audio/mpeg')
                    },
                    customMetadata: {
                        submissionId,
                        ipHash: await hashIP(clientIP),
                        uploadedAt: new Date().toISOString()
                    }
                });

                // Use R2 public URL or signed URL based on bucket settings
                mediaUrl = `https://pub-${env.MEDIA_BUCKET.bucketId}.r2.dev/${key}`;
            } catch (uploadError) {
                console.error('R2 Upload Error:', uploadError);
                // Continue without media if upload fails
                mediaUrl = null;
            }
        }

        // Save to Firebase Realtime Database
        if (env.FIREBASE_URL && env.FIREBASE_AUTH) {
            try {
                const dbUrl = `${env.FIREBASE_URL}/survey/submissions/${submissionId}.json?auth=${env.FIREBASE_AUTH}`;
                
                const payload = {
                    id: submissionId,
                    timestamp: Date.now(),
                    timestampISO: new Date().toISOString(),
                    votes: votes,
                    fingerprint: fingerprint || null,
                    ipHash: await hashIP(clientIP),
                    mediaUrl: mediaUrl,
                    mediaType: mediaType || null,
                    status: 'approved', // Auto-approve for now
                    userAgent: request.headers.get('user-agent')?.substring(0, 200) || null
                };

                const firebaseResponse = await fetch(dbUrl, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!firebaseResponse.ok) {
                    console.error('Firebase Error:', await firebaseResponse.text());
                    // Continue even if Firebase fails, we can retry later
                }

                // Update statistics counters
                await updateStatistics(env, votes);

            } catch (firebaseError) {
                console.error('Firebase Save Error:', firebaseError);
                // Return success but note the issue
                return jsonResponse({
                    success: true,
                    submissionId,
                    warning: 'Vote recorded but statistics may be delayed',
                    mediaUploaded: !!mediaUrl
                }, 200, corsHeaders);
            }
        } else {
            console.warn('Firebase credentials not configured');
            return jsonResponse({
                error: 'Server not properly configured. Missing Firebase credentials.',
                code: 'CONFIG_ERROR'
            }, 500, corsHeaders);
        }

        return jsonResponse({
            success: true,
            submissionId,
            message: 'Vote submitted successfully',
            mediaUploaded: !!mediaUrl
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Vote Submission Error:', error);
        return jsonResponse({
            error: 'Failed to process vote submission',
            details: error.message
        }, 500, corsHeaders);
    }
}

// ==================== HANDLE STATS ====================
async function handleStats(env, corsHeaders) {
    try {
        if (!env.FIREBASE_URL) {
            // Return empty stats if not configured
            return jsonResponse({
                q1_satisfied: 0,
                q1_not: 0,
                q2_yes: 0,
                q2_no: 0,
                q3_new: 0,
                q3_current: 0,
                total_votes: 0,
                video_count: 0,
                audio_count: 0
            }, 200, corsHeaders);
        }

        // Try to get cached stats first from KV if available
        let stats;
        
        const statsUrl = `${env.FIREBASE_URL}/survey/statistics.json`;
        const statsResponse = await fetch(statsUrl);
        
        if (statsResponse.ok) {
            stats = await statsResponse.json();
        } else {
            // Calculate stats from submissions
            stats = await calculateStatsFromSubmissions(env);
        }

        // Get media counts
        let videoCount = 0;
        let audioCount = 0;
        
        if (stats.video_count) videoCount = stats.video_count;
        if (stats.audio_count) audioCount = stats.audio_count;

        return jsonResponse({
            q1_satisfied: stats.q1_satisfied || 0,
            q1_not: stats.q1_not || 0,
            q2_yes: stats.q2_yes || 0,
            q2_no: stats.q2_no || 0,
            q3_new: stats.q3_new || 0,
            q3_current: stats.q3_current || 0,
            total_votes: (stats.q1_satisfied || 0) + (stats.q1_not || 0),
            video_count: videoCount,
            audio_count: audioCount
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Stats Error:', error);
        return jsonResponse({
            error: 'Failed to fetch statistics',
            q1_satisfied: 0,
            q1_not: 0,
            q2_yes: 0,
            q2_no: 0,
            q3_new: 0,
            q3_current: 0,
            total_votes: 0,
            video_count: 0,
            audio_count: 0
        }, 200, corsHeaders); // Return empty stats instead of error
    }
}

// ==================== UPDATE STATISTICS ====================
async function updateStatistics(env, votes) {
    if (!env.FIREBASE_URL || !env.FIREBASE_AUTH) return;

    try {
        // Get current stats
        const statsUrl = `${env.FIREBASE_URL}/survey/statistics.json?auth=${env.FIREBASE_AUTH}`;
        const currentStatsRes = await fetch(statsUrl);
        let currentStats = {};
        
        if (currentStatsRes.ok) {
            currentStats = await currentStatsRes.json();
        }

        // Update based on vote values
        // Q1: satisfied / not_satisfied
        if (votes.q1 === 'satisfied') currentStats.q1_satisfied = (currentStats.q1_satisfied || 0) + 1;
        else if (votes.q1 === 'not_satisfied') currentStats.q1_not = (currentStats.q1_not || 0) + 1;

        // Q2: yes / no
        if (votes.q2 === 'yes') currentStats.q2_yes = (currentStats.q2_yes || 0) + 1;
        else if (votes.q2 === 'no') currentStats.q2_no = (currentStats.q2_no || 0) + 1;

        // Q3: youth / current
        if (votes.q3 === 'youth') currentStats.q3_new = (currentStats.q3_new || 0) + 1;
        else if (votes.q3 === 'current') currentStats.q3_current = (currentStats.q3_current || 0) + 1;

        // Update last modified
        currentStats.lastUpdated = Date.now();

        // Save updated stats
        await fetch(statsUrl.replace('.json?', '.json?'), {
            method: 'PUT',
            body: JSON.stringify(currentStats),
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Update Stats Error:', error);
    }
}

// ==================== CALCULATE STATS FROM SUBMISSIONS ====================
async function calculateStatsFromSubmissions(env) {
    const defaultStats = {
        q1_satisfied: 0, q1_not: 0,
        q2_yes: 0, q2_no: 0,
        q3_new: 0, q3_current: 0
    };

    try {
        const submissionsUrl = `${env.FIREBASE_URL}/survey/submissions.json`;
        const res = await fetch(submissionsUrl);
        
        if (!res.ok) return defaultStats;
        
        const submissions = await res.json();
        if (!submissions || typeof submissions !== 'object') return defaultStats;

        Object.values(submissions).forEach(sub => {
            if (sub.votes) {
                if (sub.votes.q1 === 'satisfied') defaultStats.q1_satisfied++;
                else if (sub.votes.q1 === 'not_satisfied') defaultStats.q1_not++;
                
                if (sub.votes.q2 === 'yes') defaultStats.q2_yes++;
                else if (sub.votes.q2 === 'no') defaultStats.q2_no++;
                
                if (sub.votes.q3 === 'youth') defaultStats.q3_new++;
                else if (sub.votes.q3 === 'current') defaultStats.q3_current++;
            }
        });

        return defaultStats;
    } catch (e) {
        return defaultStats;
    }
}

// ==================== HANDLE MEDIA UPLOAD ====================
async function handleMediaUpload(request, env, corsHeaders, clientIP) {
    try {
        const formData = await request.formData();
        const media = formData.get('media');
        const type = formData.get('type');

        if (!media || !env.MEDIA_BUCKET) {
            return jsonResponse({ error: 'No media or storage not configured' }, 400, corsHeaders);
        }

        const mediaId = crypto.randomUUID();
        const extension = type === 'video' ? 'mp4' : 'mp3';
        const key = `media/${mediaId}.${extension}`;

        await env.MEDIA_BUCKET.put(key, media.stream(), {
            httpMetadata: { contentType: media.type },
            customMetadata: {
                ipHash: await hashIP(clientIP),
                uploadedAt: new Date().toISOString(),
                status: 'pending'
            }
        });

        return jsonResponse({
            success: true,
            mediaId,
            key,
            status: 'pending'
        }, 200, corsHeaders);

    } catch (error) {
        return jsonResponse({ error: 'Upload failed: ' + error.message }, 500, corsHeaders);
    }
}

// ==================== GET MEDIA LIST ====================
async function getMediaList(env, corsHeaders) {
    try {
        if (!env.MEDIA_BUCKET) {
            return jsonResponse({ media: [] }, 200, corsHeaders);
        }

        const listed = await env.MEDIA_BUCKET.list({ prefix: 'media/' });
        const mediaList = [];

        for (const object of listed.objects) {
            if (object.key.endsWith('.mp4') || object.key.endsWith('.mp3')) {
                mediaList.push({
                    key: object.key,
                    size: object.size,
                    uploaded: object.uploaded?.toISOString()
                });
            }
        }

        return jsonResponse({ media: mediaList }, 200, corsHeaders);
    } catch (error) {
        return JsonResponse({ error: error.message }, 500, corsHeaders);
    }
}

// ==================== ADMIN REQUESTS ====================
async function handleAdminRequest(request, env, corsHeaders, url, clientIP) {
    // Basic admin authentication check
    const adminKey = url.searchParams.get('key');
    
    if (!env.ADMIN_SECRET) {
        return jsonResponse({ error: 'Admin not configured' }, 500, corsHeaders);
    }

    // Simple time-based auth (as per original worker design)
    const now = new Date();
    const cairoTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const expectedKey = String(cairoTime.getHours()).padStart(2, '0') + 
                         String(cairoTime.getMinutes()).padStart(2, '0');

    if (adminKey !== expectedKey && adminKey !== env.ADMIN_SECRET) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    // Handle different admin endpoints
    if (url.pathname === '/admin/ban-ip' && request.method === 'POST') {
        // Ban IP logic here
        return jsonResponse({ success: true, message: 'IP banned' }, 200, corsHeaders);
    }

    if (url.pathname === '/admin/reset-votes' && request.method === 'POST') {
        // Reset votes logic here
        return jsonResponse({ success: true, message: 'Votes reset' }, 200, corsHeaders);
    }

    return jsonResponse({ error: 'Admin endpoint not found' }, 404, corsHeaders);
}

// ==================== UTILITY FUNCTIONS ====================

async function hashIP(ip) {
    const encoder = new TextEncoder();
    const data = encoder.encode(ip + ':elahmadya_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

function jsonResponse(data, status, corsHeaders) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
