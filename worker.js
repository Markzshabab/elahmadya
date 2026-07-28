/**
 * CLOUDFLARE WORKER - El Ahmadiya Youth Center Survey
 * 
 * ✅ هذا الإصدار يعمل بدون Firebase!
 * يستخدم Cloudflare KV للتخزين (اختياري)
 * 
 * ⚙️ الإعدادات المطلوبة:
 * - Settings > Variables: FIREBASE_URL, FIREBASE_AUTH (اختياري)
 * - Settings > Bindings: MEDIA_BUCKET (R2), STATS_KV (KV namespace)
 */

// ==================== التخزين المؤقت (In-Memory) ====================
// يعمل حتى بدون KV أو Firebase

const memoryStore = {
    submissions: [],
    statistics: {
        q1_satisfied: 0,
        q1_not: 0,
        q2_yes: 0,
        q2_no: 0,
        q3_new: 0,
        q3_current: 0,
        total_votes: 0,
        video_count: 0,
        audio_count: 0
    },
    // إضافة تصويت جديد
    addSubmission(submission) {
        this.submissions.push(submission);
        
        // تحديث الإحصائيات
        if (submission.votes) {
            if (submission.votes.q1 === 'satisfied') this.statistics.q1_satisfied++;
            else if (submission.votes.q1 === 'not_satisfied') this.statistics.q1_not++;
            
            if (submission.votes.q2 === 'yes') this.statistics.q2_yes++;
            else if (submission.votes.q2 === 'no') this.statistics.q2_no++;
            
            if (submission.votes.q3 === 'youth') this.statistics.q3_new++;
            else if (submission.votes.q3 === 'current') this.statistics.q3_current++;
            
            this.statistics.total_votes++;
        }
        
        if (submission.mediaType === 'video') this.statistics.video_count++;
        if (submission.mediaType === 'audio') this.statistics.audio_count++;
    },
    
    // الحصول على الإحصائيات
    getStats() {
        return { ...this.statistics };
    },
    
    // التحقق من البصمة/IP
    async checkDuplicate(fingerprint, ipHash) {
        return this.submissions.some(s => 
            s.fingerprint === fingerprint || s.ipHash === ipHash
        );
    },
    
    // الحصول على الميديا المعروضة
    getApprovedMedia() {
        return this.submissions.filter(s => s.status === 'approved' && s.mediaUrl);
    }
};

// ==================== CORS Headers ====================

function getCorsHeaders(request) {
    const origin = request.headers.get('Origin');
    
    // السماح بأي origin (يمكن تقييده لاحقاً)
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

// ==================== Main Handler ====================

export default {
    async fetch(request, env, ctx) {
        const corsHeaders = getCorsHeaders(request);
        
        // Handle OPTIONS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const url = new URL(request.url);
        const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
        
        try {
            let response;
            
            console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);
            
            // Route the request
            switch (url.pathname) {
                case '/api/vote':
                    if (request.method === 'POST') {
                        response = await handleVote(request, env, clientIP, corsHeaders);
                    } else {
                        response = jsonResponse({ error: 'Method not allowed' }, 405);
                    }
                    break;
                    
                case '/api/stats':
                    if (request.method === 'GET') {
                        response = await handleStats(env, corsHeaders);
                    } else {
                        response = jsonResponse({ error: 'Method not allowed' }, 405);
                    }
                    break;
                    
                case '/api/media':
                    if (request.method === 'GET') {
                        response = await handleGetMedia(env, corsHeaders);
                    } else if (request.method === 'POST') {
                        response = await handleUploadMedia(request, env, clientIP, corsHeaders);
                    } else {
                        response = jsonResponse({ error: 'Method not allowed' }, 405);
                    }
                    break;
                    
                case '/gallery/approved':
                    if (request.method === 'GET') {
                        response = await handleGalleryApproved(corsHeaders);
                    } else {
                        response = jsonResponse({ error: 'Method not allowed' }, 405);
                    }
                    break;
                    
                case '/api/health':
                    response = jsonResponse({
                        status: 'ok',
                        time: new Date().toISOString(),
                        storeType: 'memory',
                        totalSubmissions: memoryStore.submissions.length
                    }, 200);
                    break;
                    
                default:
                    // Root path or unknown
                    if (url.pathname === '/') {
                        response = jsonResponse({
                            service: 'El Ahmadiya Survey API',
                            version: '2.0.0',
                            endpoints: ['/api/vote', '/api/stats', '/api/media', '/gallery/approved'],
                            docs: 'See README for usage'
                        }, 200);
                    } else {
                        response = jsonResponse({ error: 'Not found' }, 404);
                    }
            }
            
            // Add CORS headers to ALL responses
            return addCorsHeaders(response, corsHeaders);
            
        } catch (error) {
            console.error('Worker Error:', error);
            return addCorsHeaders(
                jsonResponse({
                    error: 'Internal Server Error',
                    message: error.message,
                    timestamp: new Date().toISOString()
                }, 500),
                corsHeaders
            );
        }
    }
};

// ==================== Vote Handler ====================

async function handleVote(request, env, clientIP, corsHeaders) {
    try {
        // Parse form data
        let formData;
        try {
            formData = await request.formData();
        } catch (e) {
            return jsonResponse({ 
                error: 'Invalid form data. Expected multipart/form-data.',
                details: e.message 
            }, 400);
        }

        // Extract fields
        const votesStr = formData.get('votes');
        const fingerprint = formData.get('fingerprint');
        const mediaFile = formData.get('media');
        const mediaType = formData.get('type');

        // Validate votes field exists
        if (!votesStr) {
            return jsonResponse({ 
                error: 'Missing required field: votes',
                hint: 'Send votes as JSON string in form data'
            }, 400);
        }

        // Parse and validate votes JSON
        let votes;
        try {
            votes = JSON.parse(votesStr);
        } catch (e) {
            return jsonResponse({ 
                error: 'Invalid JSON in votes field',
                received: votesStr?.substring(0, 100),
                expectedFormat: '{"q1":"satisfied","q2":"yes","q3":"youth"}'
            }, 400);
        }

        // Validate votes structure
        if (!votes || typeof votes !== 'object') {
            return jsonResponse({ 
                error: 'votes must be a JSON object',
                example: { q1: 'satisfied', q2: 'yes', q3: 'youth' }
            }, 400);
        }

        // Log received votes for debugging
        console.log('Received votes:', JSON.stringify(votes));

        // Generate submission ID
        const submissionId = crypto.randomUUID();
        const ipHash = await simpleHash(clientIP);

        // Check for duplicate (optional - can be disabled)
        const isDuplicate = await memoryStore.checkDuplicate(fingerprint, ipHash);
        
        let mediaUrl = null;
        let mediaUploaded = false;

        // Upload to R2 if available
        if (mediaFile && mediaFile.size > 0 && env.MEDIA_BUCKET) {
            try {
                const extension = mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'mp3' : 'bin';
                const key = `submissions/${submissionId}.${extension}`;
                
                await env.MEDIA_BUCKET.put(key, mediaFile.stream(), {
                    httpMetadata: { contentType: mediaFile.type || 'application/octet-stream' },
                    customMetadata: {
                        ipHash,
                        uploadedAt: new Date().toISOString()
                    }
                });

                mediaUrl = `/api/media?key=${encodeURIComponent(key)}`;
                mediaUploaded = true;
                
                console.log(`Media uploaded: ${key}`);
            } catch (uploadError) {
                console.error('R2 upload failed:', uploadError.message);
                // Continue without media
            }
        }

        // Create submission object
        const submission = {
            id: submissionId,
            timestamp: Date.now(),
            timestampISO: new Date().toISOString(),
            votes: votes,
            fingerprint: fingerprint?.substring(0, 200) || null,
            ipHash: ipHash,
            clientIP: clientIP.substring(0, 45), // Partial IP for logging
            mediaUrl: mediaUrl,
            mediaType: mediaType || null,
            status: 'approved',
            userAgent: request.headers.get('user-agent')?.substring(0, 200)
        };

        // Store in memory (always works!)
        memoryStore.addSubmission(submission);

        // Try to sync with Firebase if configured
        let firebaseSynced = false;
        if (env.FIREBASE_URL && env.FIREBASE_AUTH) {
            try {
                await syncToFirebase(submission, env);
                firebaseSynced = true;
            } catch (fbError) {
                console.warn('Firebase sync failed (data saved locally):', fbError.message);
            }
        } else {
            console.log('Firebase not configured - using local storage only');
        }

        // Try to sync to KV if configured
        if (env.STATS_KV) {
            try {
                ctx.waitUntil(
                    env.STATS_KV.put(
                        `sub_${submissionId}`,
                        JSON.stringify(submission),
                        { expirationTtl: 86400 * 30 } // 30 days
                    )
                );
            } catch (kvError) {
                console.warn('KV sync failed:', kvError.message);
            }
        }

        // Return success response
        return jsonResponse({
            success: true,
            submissionId: submissionId,
            message: '✅ تم تسجيل تصويتك بنجاح!',
            isDuplicate: isDuplicate,
            mediaUploaded: mediaUploaded,
            firebaseSynced: firebaseSynced,
            currentStats: memoryStore.getStats()
        }, 201);

    } catch (error) {
        console.error('Vote handler error:', error);
        return jsonResponse({
            error: 'Failed to process vote',
            details: error.message
        }, 500);
    }
}

// ==================== Stats Handler ====================

async function handleStats(env, corsHeaders) {
    try {
        // Always return stats from memory first (fast & reliable)
        const stats = memoryStore.getStats();

        // If we have Firebase configured, try to merge stats from there too
        if (env.FIREBASE_URL) {
            try {
                const fbStats = await fetchFromFirebaseStats(env);
                if (fbStats && fbStats.total_votes > stats.total_votes) {
                    // Firebase has more data, use it
                    return jsonResponse(fbStats, 200);
                }
            } catch (e) {
                console.log('Firebase stats fetch failed, using local stats');
            }
        }

        return jsonResponse(stats, 200);

    } catch (error) {
        console.error('Stats error:', error);
        
        // NEVER fail - always return something
        return jsonResponse({
            q1_satisfied: 0,
            q1_not: 0,
            q2_yes: 0,
            q2_no: 0,
            q3_new: 0,
            q3_current: 0,
            total_votes: 0,
            video_count: 0,
            audio_count: 0,
            error: 'Stats unavailable'
        }, 200);
    }
}

// ==================== Media Handlers ====================

async function handleGetMedia(env, corsHeaders) {
    try {
        const approvedMedia = memoryStore.getApprovedMedia();
        
        return jsonResponse({
            media: approvedMedia.map(m => ({
                id: m.id,
                mediaType: m.mediaType,
                mediaUrl: m.mediaUrl,
                timestamp: m.timestamp
            })),
            total: approvedMedia.length
        }, 200);
    } catch (error) {
        return jsonResponse({ media: [], total: 0, error: error.message }, 200);
    }
}

async function handleUploadMedia(request, env, clientIP, corsHeaders) {
    try {
        const formData = await request.formData();
        const media = formData.get('media');
        const type = formData.get('type');

        if (!media || media.size === 0) {
            return jsonResponse({ error: 'No media file provided' }, 400);
        }

        if (!env.MEDIA_BUCKET) {
            return jsonResponse({ error: 'Media storage not configured on server' }, 503);
        }

        const mediaId = crypto.randomUUID();
        const extension = type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'bin';
        const key = `uploads/${mediaId}.${extension}`;

        await env.MEDIA_BUCKET.put(key, media.stream(), {
            httpMetadata: { contentType: media.type },
            customMetadata: {
                ipHash: await simpleHash(clientIP),
                uploadedAt: new Date().toISOString()
            }
        });

        return jsonResponse({
            success: true,
            mediaId,
            key,
            url: `/api/media?key=${key}`
        }, 201);

    } catch (error) {
        return jsonResponse({ error: 'Upload failed: ' + error.message }, 500);
    }
}

// ==================== Gallery Handler ====================

async function handleGalleryApproved(corsHeaders) {
    try {
        const approvedMedia = memoryStore.getApprovedMedia();
        
        // Format for gallery display
        const galleryItems = approvedMedia.map(item => ({
            id: item.id,
            mediaType: item.mediaType,
            mediaUrl: item.mediaUrl,
            timestamp: item.timestamp,
            status: 'approved'
        }));

        return jsonResponse(galleryItems, 200);
    } catch (error) {
        // Return empty array instead of error
        return jsonResponse([], 200);
    }
}

// ==================== Firebase Sync (Optional) ====================

async function syncToFirebase(submission, env) {
    const url = `${env.FIREBASE_URL}/survey/submissions/${submission.id}.json?auth=${env.FIREBASE_AUTH}`;
    
    await fetch(url, {
        method: 'PUT',
        body: JSON.stringify(submission),
        headers: { 'Content-Type': 'application/json' }
    });

    // Update statistics in Firebase
    const statsUrl = `${env.FIREBASE_URL}/survey/statistics.json?auth=${env.FIREBASE_AUTH}`;
    const currentRes = await fetch(statsUrl);
    let fbStats = {};
    
    if (currentRes.ok) {
        try { fbStats = await currentRes.json(); } catch (e) {}
    }

    // Increment counters
    if (submission.votes.q1 === 'satisfied') fbStats.q1_satisfied = (fbStats.q1_satisfied || 0) + 1;
    else if (submission.votes.q1 === 'not_satisfied') fbStats.q1_not = (fbStats.q1_not || 0) + 1;
    
    if (submission.votes.q2 === 'yes') fbStats.q2_yes = (fbStats.q2_yes || 0) + 1;
    else if (submission.votes.q2 === 'no') fbStats.q2_no = (fbStats.q2_no || 0) + 1;
    
    if (submission.votes.q3 === 'youth') fbStats.q3_new = (fbStats.q3_new || 0) + 1;
    else if (submission.votes.q3 === 'current') fbStats.q3_current = (fbStats.q3_current || 0) + 1;
    
    fbStats.lastUpdated = Date.now();
    fbStats.total_votes = (fbStats.total_votes || 0) + 1;

    await fetch(statsUrl, {
        method: 'PUT',
        body: JSON.stringify(fbStats),
        headers: { 'Content-Type': 'application/json' }
    });
}

async function fetchFromFirebaseStats(env) {
    const url = `${env.FIREBASE_URL}/survey/statistics.json`;
    const res = await fetch(url);
    
    if (res.ok) {
        return await res.json();
    }
    return null;
}

// ==================== Utility Functions ====================

async function simpleHash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(input) + ':elahmadya_v2');
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

function addCorsHeaders(response, corsHeaders) {
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    });
}
