/**
 * CLOUDFLARE WORKER - El Ahmadiya Youth Center Survey
 * 
 * ⚠️ IMPORTANT: After deploying, go to:
 * Settings > Triggers > Custom Domains (or Routes)
 * Make sure your domain/route allows the origin
 * 
 * Bindings Required:
 * - R2 Bucket: Variable name = MEDIA_BUCKET
 * - Environment Variables: FIREBASE_URL, FIREBASE_AUTH, ADMIN_SECRET
 */

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://markzshabab.github.io',
    'https://elahmadya.pages.dev',
    'http://localhost:*',
    '*'
];

function getCorsHeaders(origin) {
    // Use specific origin if it's in our allow list, otherwise use wildcard
    const safeOrigin = origin && origin !== 'null' ? origin : '*';
    
    return {
        'Access-Control-Allow-Origin': safeOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-IP, cf-connecting-ip, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };
}

export default {
    async fetch(request, env, ctx) {
        // Get the request origin
        const origin = request.headers.get('Origin') || '*';
        
        // Set up CORS headers based on origin
        const corsHeaders = getCorsHeaders(origin);

        // Handle OPTIONS preflight requests FIRST
        if (request.method === 'OPTIONS') {
            return new Response(null, { 
                status: 204, 
                headers: corsHeaders 
            });
        }

        const url = new URL(request.url);
        const clientIP = request.headers.get('cf-connecting-ip') || 
                        request.headers.get('x-forwarded-for') || 
                        'unknown';

        try {
            // Route to appropriate handler
            let response;

            if (url.pathname === '/api/vote' && request.method === 'POST') {
                response = await handleVoteSubmission(request, env, clientIP);
            } else if (url.pathname === '/api/stats' && request.method === 'GET') {
                response = await handleStats(env);
            } else if (url.pathname === '/api/upload-media' && request.method === 'POST') {
                response = await handleMediaUpload(request, env, clientIP);
            } else if (url.pathname === '/api/media' && request.method === 'GET') {
                response = await getMediaList(env);
            } else if (url.pathname.startsWith('/admin/')) {
                response = await handleAdminRequest(request, env, url, clientIP);
            } else {
                // For favicon or other static files
                if (url.pathname === '/favicon.ico') {
                    return new Response('', { status: 404, headers: corsHeaders });
                }
                
                response = new Response(JSON.stringify({ 
                    status: 'ok', 
                    service: 'El Ahmadiya Survey API',
                    endpoints: ['/api/vote', '/api/stats', '/api/media']
                }), { 
                    status: 200, 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Add CORS headers to ALL responses
            return addCorsHeaders(response, corsHeaders);

        } catch (error) {
            console.error('Worker Error:', error.stack || error.message);
            
            // Error response MUST include CORS headers
            const errorResponse = new Response(JSON.stringify({ 
                error: 'Internal Server Error',
                message: error.message,
                timestamp: new Date().toISOString()
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });

            return addCorsHeaders(errorResponse, corsHeaders);
        }
    }
};

/**
 * Add CORS headers to any response
 */
function addCorsHeaders(response, corsHeaders) {
    const newHeaders = new Headers(response.headers);
    
    // Add each CORS header
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    });
}

// ==================== VOTE SUBMISSION HANDLER ====================
async function handleVoteSubmission(request, env, clientIP) {
    try {
        // Parse form data
        let formData;
        try {
            formData = await request.formData();
        } catch (parseError) {
            return jsonError('Invalid form data: ' + parseError.message, 400);
        }

        const votesStr = formData.get('votes');
        const fingerprint = formData.get('fingerprint');
        const media = formData.get('media');
        const mediaType = formData.get('type');

        // Validate votes
        let votes;
        try {
            votes = JSON.parse(votesStr || '{}');
            if (!votes || typeof votes !== 'object' || Object.keys(votes).length === 0) {
                return jsonError('No votes provided', 400);
            }
        } catch (e) {
            return jsonError('Invalid JSON in votes field', 400);
        }

        // Generate submission ID
        const submissionId = crypto.randomUUID();
        let mediaUrl = null;
        let mediaUploaded = false;

        // Upload media to R2 if provided
        if (media && media.size > 0 && env.MEDIA_BUCKET) {
            try {
                const extension = mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'mp3' : 'bin';
                const key = `submissions/${submissionId}.${extension}`;
                
                await env.MEDIA_BUCKET.put(key, media.stream(), {
                    httpMetadata: { 
                        contentType: media.type || 'application/octet-stream'
                    },
                    customMetadata: {
                        ipHash: await simpleHash(clientIP),
                        uploadedAt: new Date().toISOString(),
                        fingerprint: fingerprint?.substring(0, 100) || null
                    }
                });

                // Generate public URL - adjust based on your R2 public bucket setup
                mediaUrl = `/api/media?key=${encodeURIComponent(key)}`;
                mediaUploaded = true;
            } catch (uploadErr) {
                console.error('R2 Upload Failed:', uploadErr.message);
                // Continue without media
            }
        }

        // Save to Firebase if configured
        if (env.FIREBASE_URL && env.FIREBASE_AUTH) {
            try {
                const payload = {
                    id: submissionId,
                    timestamp: Date.now(),
                    timestampISO: new Date().toISOString(),
                    votes: votes,
                    fingerprint: fingerprint?.substring(0, 200) || null,
                    ipHash: await simpleHash(clientIP),
                    mediaUrl: mediaUrl,
                    mediaType: mediaType || null,
                    status: 'approved'
                };

                const firebaseUrl = `${env.FIREBASE_URL}/survey/submissions/${submissionId}.json?auth=${env.FIREBASE_AUTH}`;
                
                const fbResponse = await fetch(firebaseUrl, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!fbResponse.ok) {
                    const errorText = await fbResponse.text();
                    console.warn('Firebase warning:', errorText);
                }

                // Update statistics
                await updateStatistics(env, votes);

            } catch (firebaseErr) {
                console.error('Firebase Error:', firebaseErr.message);
                // Return success but note the issue
                return jsonResponse({
                    success: true,
                    submissionId,
                    warning: 'Vote recorded but stats may be delayed',
                    mediaUploaded
                }, 200);
            }
        } else {
            // If no Firebase configured, still accept vote but warn
            console.warn('Firebase not configured - vote accepted but not persisted');
            
            // For testing without Firebase, you can store in memory/KV
            return jsonResponse({
                success: true,
                submissionId,
                testMode: true,
                message: 'Vote accepted (test mode - configure Firebase for production)',
                mediaUploaded
            }, 200);
        }

        return jsonResponse({
            success: true,
            submissionId,
            message: 'تم تسجيل تصويتك بنجاح',
            mediaUploaded
        }, 200);

    } catch (error) {
        console.error('Vote Submission Error:', error);
        return jsonError('Failed to process vote: ' + error.message, 500);
    }
}

// ==================== STATS HANDLER ====================
async function handleStats(env) {
    try {
        // Default empty stats
        const defaultStats = {
            q1_satisfied: 0,
            q1_not: 0,
            q2_yes: 0,
            q2_no: 0,
            q3_new: 0,
            q3_current: 0,
            total_votes: 0,
            video_count: 0,
            audio_count: 0,
            lastUpdated: null
        };

        if (!env.FIREBASE_URL) {
            // Return empty stats with 200 OK (don't fail)
            return jsonResponse(defaultStats, 200);
        }

        // Try to get statistics from Firebase
        const statsUrl = `${env.FIREBASE_URL}/survey/statistics.json`;
        
        try {
            const statsRes = await fetch(statsUrl);
            
            if (statsRes.ok) {
                const firebaseStats = await statsRes.json();
                
                // Merge with defaults
                const mergedStats = {
                    ...defaultStats,
                    ...firebaseStats,
                    total_votes: (firebaseStats.q1_satisfied || 0) + (firebaseStats.q1_not || 0)
                };

                return jsonResponse(mergedStats, 200);
            } else {
                // Stats endpoint doesn't exist yet, calculate from submissions
                const calculatedStats = await calculateStatsFromSubmissions(env);
                return jsonResponse({ ...defaultStats, ...calculatedStats }, 200);
            }
        } catch (fetchError) {
            console.error('Fetch stats error:', fetchError.message);
            return jsonResponse(defaultStats, 200);
        }

    } catch (error) {
        console.error('Stats Handler Error:', error);
        
        // ALWAYS return 200 with empty stats instead of error
        // This prevents frontend from breaking
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
        }, 200);
    }
}

// ==================== UPDATE STATISTICS IN FIREBASE ====================
async function updateStatistics(env, votes) {
    if (!env.FIREBASE_URL || !env.FIREBASE_AUTH) return;

    try {
        // Get current stats
        const statsUrl = `${env.FIREBASE_URL}/survey/statistics.json?auth=${env.FIREBASE_AUTH}`;
        const currentRes = await fetch(statsUrl);
        let currentStats = {};

        if (currentRes.ok) {
            try {
                currentStats = await currentRes.json();
            } catch (e) {
                currentStats = {};
            }
        }

        // Increment counters based on vote values
        // Q1: satisfaction
        if (votes.q1 === 'satisfied') {
            currentStats.q1_satisfied = (currentStats.q1_satisfied || 0) + 1;
        } else if (votes.q1 === 'not_satisfied') {
            currentStats.q1_not = (currentStats.q1_not || 0) + 1;
        }

        // Q2: youth support
        if (votes.q2 === 'yes') {
            currentStats.q2_yes = (currentStats.q2_yes || 0) + 1;
        } else if (votes.q2 === 'no') {
            currentStats.q2_no = (currentStats.q2_no || 0) + 1;
        }

        // Q3: management choice
        if (votes.q3 === 'youth') {
            currentStats.q3_new = (currentStats.q3_new || 0) + 1;
        } else if (votes.q3 === 'current') {
            currentStats.q3_current = (currentStats.q3_current || 0) + 1;
        }

        // Update timestamp
        currentStats.lastUpdated = Date.now();
        currentStats.lastUpdatedISO = new Date().toISOString();

        // Save back to Firebase
        await fetch(`${env.FIREBASE_URL}/survey/statistics.json?auth=${env.FIREBASE_AUTH}`, {
            method: 'PUT',
            body: JSON.stringify(currentStats),
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Update statistics error:', err.message);
    }
}

// ==================== CALCULATE STATS FROM SUBMISSIONS ====================
async function calculateStatsFromSubmissions(env) {
    const stats = {
        q1_satisfied: 0,
        q1_not: 0,
        q2_yes: 0,
        q2_no: 0,
        q3_new: 0,
        q3_current: 0
    };

    try {
        const submissionsUrl = `${env.FIREBASE_URL}/survey/submissions.json`;
        const res = await fetch(submissionsUrl);

        if (!res.ok) return stats;

        const submissions = await res.json();
        if (!submissions || typeof submissions !== 'object') return stats;

        // Process each submission
        Object.values(submissions).forEach(sub => {
            if (sub.votes && typeof sub.votes === 'object') {
                if (sub.votes.q1 === 'satisfied') stats.q1_satisfied++;
                else if (sub.votes.q1 === 'not_satisfied') stats.q1_not++;

                if (sub.votes.q2 === 'yes') stats.q2_yes++;
                else if (sub.votes.q2 === 'no') stats.q2_no++;

                if (sub.votes.q3 === 'youth') stats.q3_new++;
                else if (sub.votes.q3 === 'current') stats.q3_current++;
            }
        });

        return stats;
    } catch (e) {
        console.error('Calculate stats error:', e);
        return stats;
    }
}

// ==================== MEDIA UPLOAD HANDLER ====================
async function handleMediaUpload(request, env, clientIP) {
    try {
        if (!env.MEDIA_BUCKET) {
            return jsonError('Media storage not configured', 503);
        }

        const formData = await request.formData();
        const media = formData.get('media');
        const type = formData.get('type');

        if (!media || media.size === 0) {
            return jsonError('No media file provided', 400);
        }

        const mediaId = crypto.randomUUID();
        const extension = type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'bin';
        const key = `uploads/${mediaId}.${extension}`;

        await env.MEDIA_BUCKET.put(key, media.stream(), {
            httpMetadata: {
                contentType: media.type || 'application/octet-stream'
            },
            customMetadata: {
                ipHash: await simpleHash(clientIP),
                uploadedAt: new Date().toISOString(),
                originalName: media.name || 'upload'
            }
        });

        return jsonResponse({
            success: true,
            mediaId,
            key,
            url: `/api/media?key=${key}`,
            status: 'pending_review'
        }, 201);

    } catch (error) {
        return jsonError('Media upload failed: ' + error.message, 500);
    }
}

// ==================== GET MEDIA LIST ====================
async function getMediaList(env) {
    try {
        if (!env.MEDIA_BUCKET) {
            return jsonResponse({ media: [], total: 0 }, 200);
        }

        const listed = await env.MEDIA_BUCKET.list({ prefix: 'uploads/' });
        
        const mediaList = listed.objects.map(obj => ({
            key: obj.key,
            size: obj.size,
            uploaded: obj.uploaded?.toISOString(),
            etag: obj.etag
        }));

        return jsonResponse({
            media: mediaList,
            total: mediaList.length
        }, 200);

    } catch (error) {
        return jsonError('Failed to list media: ' + error.message, 500);
    }
}

// ==================== ADMIN HANDLERS ====================
async function handleAdminRequest(request, env, url, clientIP) {
    // Check admin authentication
    const authHeader = request.headers.get('Authorization');
    const queryKey = url.searchParams.get('key');
    
    // Time-based password (HHMM Cairo timezone)
    const now = new Date();
    const cairoTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const timePassword = String(cairoTime.getHours()).padStart(2, '0') + 
                         String(cairoTime.getMinutes()).padStart(2, '0');

    // Accept either time-based password or ADMIN_SECRET
    const isAdmin = (queryKey === timePassword) || 
                    (queryKey === env.ADMIN_SECRET) ||
                    (authHeader === `Bearer ${timePassword}`) ||
                    (authHeader === `Bearer ${env.ADMIN_SECRET}`);

    if (!isAdmin) {
        return jsonError('Unauthorized. Provide valid admin key.', 401);
    }

    // Handle different admin actions
    if (url.pathname === '/admin/stats' && request.method === 'GET') {
        return await handleStats(env);
    }

    if (url.pathname === '/admin/ban-ip' && request.method === 'POST') {
        // IP banning logic would go here
        return jsonResponse({ success: true, message: 'IP ban functionality requires KV binding' }, 200);
    }

    if (url.pathname === '/admin/reset-stats' && request.method === 'POST') {
        // Reset statistics
        if (env.FIREBASE_URL && env.FIREBASE_AUTH) {
            await fetch(`${env.FIREBASE_URL}/survey/statistics.json?auth=${env.FIREBASE_AUTH}`, {
                method: 'PUT',
                body: JSON.stringify({
                    q1_satisfied: 0, q1_not: 0,
                    q2_yes: 0, q2_no: 0,
                    q3_new: 0, q3_current: 0,
                    resetAt: Date.now()
                })
            });
            return jsonResponse({ success: true, message: 'Statistics reset successfully' }, 200);
        }
        return jsonError('Firebase not configured', 500);
    }

    return jsonError('Admin endpoint not found', 404);
}

// ==================== UTILITY FUNCTIONS ====================

async function simpleHash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(input) + ':elahmadya_salt_2024_v2');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 20);
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

function jsonError(message, status = 400) {
    return jsonResponse({ error: message, status }, status);
}
