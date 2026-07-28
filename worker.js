// ==================== CLOUDFLARE WORKER - WITH MEDIA SUPPORT ====================
// يدعم: التصويتات + حفظ الميديا + لوحة الأدمن الكاملة

// تخزين البيانات
let submissions = [];
let mediaStore = {}; // لتخزين الميديا الفعلية
let blockedIPs = new Set();
let stats = {
    q1_satisfied: 0, q1_not: 0,
    q2_yes: 0, q2_no: 0,
    q3_new: 0, q3_current: 0,
    total_votes: 0,
    video_count: 0, audio_count: 0
};

export default {
    async fetch(request) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Content-Type': 'application/json'
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            const url = new URL(request.url);
            const method = request.method;
            
            console.log(`[${new Date().toISOString()}] ${method} ${url.pathname}`);

            // ==================== PUBLIC ENDPOINTS ====================
            
            if (url.pathname === '/api/health' && method === 'GET') {
                return jsonResponse({ status: 'ok', time: new Date().toISOString(), totalSubmissions: submissions.length }, 200, corsHeaders);
            }

            if (url.pathname === '/api/stats' && method === 'GET') {
                return jsonResponse(stats, 200, corsHeaders);
            }

            // Submit Vote WITH MEDIA
            if (url.pathname === '/api/vote' && method === 'POST') {
                return await handleVoteWithMedia(request, corsHeaders);
            }

            // Get Media List
            if (url.pathname === '/api/media' && method === 'GET') {
                return await handleGetMedia(corsHeaders);
            }

            // Get SPECIFIC Media File (for playback)
            if (url.pathname.startsWith('/api/media/') && method === 'GET') {
                return await handleGetMediaFile(url.pathname.replace('/api/media/', ''), corsHeaders);
            }

            // Gallery Approved
            if (url.pathname === '/gallery/approved' && method === 'GET') {
                return await handleGalleryApproved(corsHeaders);
            }

            // ==================== ADMIN ENDPOINTS ====================
            
            if (url.pathname === '/admin/submissions' && method === 'GET') {
                return await handleAdminGetSubmissions(request, corsHeaders);
            }

            if (url.pathname === '/admin/update-status' && method === 'POST') {
                return await handleAdminUpdateStatus(request, corsHeaders);
            }

            if (url.pathname === '/admin/delete' && method === 'POST') {
                return await handleAdminDelete(request, corsHeaders);
            }

            if (url.pathname === '/admin/block-ip' && method === 'POST') {
                return await handleAdminBlockIP(request, corsHeaders);
            }

            if (url.pathname === '/admin/reset-stats' && method === 'POST') {
                return await handleAdminResetStats(request, corsHeaders);
            }

            // Root
            if (url.pathname === '/' || url.pathname === '') {
                return jsonResponse({
                    service: 'El Ahmadiya Survey API',
                    version: '5.0-media',
                    endpoints: {
                        public: ['/api/vote', '/api/stats', '/api/media', '/api/media/{id}', '/gallery/approved'],
                        admin: ['/admin/submissions', '/admin/update-status', '/admin/delete', '/admin/block-ip']
                    },
                    stats: stats
                }, 200, corsHeaders);
            }

            return jsonResponse({ error: 'Not found' }, 404, corsHeaders);

        } catch (error) {
            console.error('Worker Error:', error);
            return jsonResponse({ error: 'Internal Server Error', message: error.message }, 500, corsHeaders);
        }
    }
};

// ==================== VOTE HANDLER WITH MEDIA STORAGE ====================

async function handleVoteWithMedia(request, corsHeaders) {
    try {
        const formData = await request.formData();
        const votesStr = formData.get('votes');
        
        if (!votesStr) {
            return jsonResponse({ error: 'Missing votes field' }, 400, corsHeaders);
        }

        let votes;
        try {
            votes = JSON.parse(votesStr);
        } catch (e) {
            return jsonResponse({ error: 'Invalid JSON in votes' }, 400, corsHeaders);
        }

        const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
        const ipHash = await simpleHash(clientIP);
        const fingerprint = formData.get('fingerprint');

        // Check if IP is blocked
        if (blockedIPs.has(ipHash)) {
            return jsonResponse({ error: 'IP blocked', message: 'تم حظر هذا الجهاز' }, 403, corsHeaders);
        }

        // Create submission ID
        const submissionId = crypto.randomUUID();
        
        // Handle MEDIA - Save the actual file!
        let mediaData = null;
        let mediaType = null;
        let mediaSize = 0;

        const mediaFile = formData.get('media');
        const typeFromForm = formData.get('type');

        if (mediaFile && mediaFile.size > 0) {
            mediaType = typeFromForm || (mediaFile.type?.startsWith('video') ? 'video' : 'audio');
            mediaSize = mediaFile.size;
            
            try {
                // Convert to ArrayBuffer then Base64 for storage
                const arrayBuffer = await mediaFile.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                // Store as base64 in mediaStore
                mediaStore[submissionId] = {
                    data: arrayToBase64(uint8Array),
                    type: mediaFile.type || (mediaType === 'video' ? 'video/mp4' : 'audio/mpeg'),
                    size: mediaSize,
                    name: mediaFile.name || `media.${mediaType === 'video' ? 'mp4' : 'mp3'}`
                };
                
                mediaData = `/api/media/${submissionId}`;
                
                console.log(`✅ Media saved: ${submissionId}, size: ${(mediaSize/1024).toFixed(1)}KB, type: ${mediaType}`);
                
            } catch (mediaError) {
                console.error('Media save error:', mediaError);
                mediaData = null; // Continue without media
            }
        }

        // Create submission object
        const submission = {
            id: submissionId,
            timestamp: Date.now(),
            timestampISO: new Date().toISOString(),
            votes: votes,
            fingerprint: fingerprint?.substring(0, 200),
            ipHash: ipHash,
            clientIP: clientIP.substring(0, 45),
            userAgent: request.headers.get('user-agent')?.substring(0, 200),
            mediaUrl: mediaData,
            mediaType: mediaType,
            mediaSize: mediaSize,
            status: mediaData ? 'pending' : 'approved', // Pending review if has media
            reviewedAt: null,
            reviewedBy: null
        };

        // Store submission
        submissions.push(submission);

        // Update statistics
        updateStats(votes, mediaType);

        console.log(`New vote from ${clientIP}:`, votes, mediaType ? `+${mediaType}` : '');

        return jsonResponse({
            success: true,
            submissionId: submissionId,
            message: mediaData ? 
                '✅ تم تسجيل تصويتك والمحتوى قيد المراجعة!' : 
                '✅ تم تسجيل تصويتك بنجاح!',
            currentStats: stats,
            hasMedia: !!mediaData,
            mediaPreviewUrl: mediaData
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Vote error:', error);
        return jsonResponse({ error: 'Failed to process vote', details: error.message }, 500, corsHeaders);
    }
}

// ==================== MEDIA HANDLERS ====================

// Get list of all media
async function handleGetMedia(corsHeaders) {
    const mediaList = submissions
        .filter(s => s.mediaUrl && s.status === 'approved')
        .map(s => ({
            id: s.id,
            mediaType: s.mediaType,
            mediaUrl: s.mediaUrl,
            mediaSize: s.mediaSize,
            timestamp: s.timestamp,
            status: s.status
        }));
    
    return jsonResponse({ media: mediaList, total: mediaList.length }, 200, corsHeaders);
}

// Get ACTUAL media file for playback
async function handleGetMediaFile(mediaId, corsHeaders) {
    console.log(`Requesting media: ${mediaId}`);
    
    const media = mediaStore[mediaId];
    
    if (!media) {
        console.log(`Media not found: ${mediaId}`);
        return jsonResponse({ error: 'Media not found' }, 404, corsHeaders);
    }

    try {
        // Convert base64 back to ArrayBuffer
        const binaryString = atob(media.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        console.log(`Serving media: ${mediaId}, size: ${bytes.length} bytes`);

        // Return as actual media file with correct content-type
        return new Response(bytes.buffer, {
            status: 200,
            headers: {
                'Content-Type': media.type,
                'Content-Length': bytes.length.toString(),
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        console.error('Media serving error:', error);
        return jsonResponse({ error: 'Failed to serve media' }, 500, corsHeaders);
    }
}

// Get approved media for gallery
async function handleGalleryApproved(corsHeaders) {
    const approvedMedia = submissions
        .filter(s => s.mediaUrl && s.status === 'approved')
        .map(s => ({
            id: s.id,
            mediaType: s.mediaType,
            mediaUrl: s.mediaUrl, // This is now a working URL!
            timestamp: s.timestamp,
            status: 'approved'
        }));
    
    return jsonResponse(approvedMedia, 200, corsHeaders);
}

// ==================== ADMIN HANDLERS ====================

async function verifyAdmin(request) {
    // Simple verification - accept any non-empty auth
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    const urlKey = new URL(request.url).searchParams.get('key');
    const providedPassword = authHeader || urlKey;
    
    return { valid: !!providedPassword };
}

async function handleAdminGetSubmissions(request, corsHeaders) {
    const auth = await verifyAdmin(request);
    if (!auth.valid) {
        return jsonResponse({ error: 'Unauthorized - provide password' }, 401, corsHeaders);
    }

    // Return ALL submissions with full details including media URLs
    const detailedSubmissions = submissions.map(s => ({
        id: s.id,
        timestamp: s.timestamp,
        timestampISO: s.timestampISO,
        ip: s.clientIP,
        ipHash: s.ipHash,
        fingerprint: s.fingerprint,
        votes: s.votes,
        mediaUrl: s.mediaUrl, // This is now /api/media/{id} - WORKING URL!
        mediaType: s.mediaType,
        mediaSize: s.mediaSize,
        status: s.status,
        userAgent: s.userAgent,
        reviewedAt: s.reviewedAt,
        // Helper flag for admin UI
        hasPlayableMedia: !!(s.mediaUrl && mediaStore[s.id])
    }));

    return jsonResponse(detailedSubmissions, 200, corsHeaders);
}

async function handleAdminUpdateStatus(request, corsHeaders) {
    const auth = await verifyAdmin(request);
    if (!auth.valid) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    try {
        const body = await request.json();
        const { id, status } = body;

        if (!id || !status) {
            return jsonResponse({ error: 'Missing id or status' }, 400, corsHeaders);
        }

        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return jsonResponse({ error: 'Invalid status' }, 400, corsHeaders);
        }

        const submission = submissions.find(s => s.id === id);
        if (!submission) {
            return jsonResponse({ error: 'Submission not found' }, 404, corsHeaders);
        }

        const oldStatus = submission.status;
        submission.status = status;
        submission.reviewedAt = Date.now();
        submission.reviewedBy = 'admin';

        console.log(`Admin updated ${id}: ${oldStatus} -> ${status}`);

        return jsonResponse({
            success: true,
            message: `تم ${getStatusMessage(status)} بنجاح`,
            submissionId: id,
            newStatus: status
        }, 200, corsHeaders);

    } catch (error) {
        return jsonResponse({ error: 'Failed to update: ' + error.message }, 500, corsHeaders);
    }
}

async function handleAdminDelete(request, corsHeaders) {
    const auth = await verifyAdmin(request);
    if (!auth.valid) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return jsonResponse({ error: 'Missing id' }, 400, corsHeaders);
        }

        const index = submissions.findIndex(s => s.id === id);
        if (index === -1) {
            return jsonResponse({ error: 'Submission not found' }, 404, corsHeaders);
        }

        const deleted = submissions.splice(index, 1)[0];
        
        // Also delete associated media
        if (deleted.id && mediaStore[deleted.id]) {
            delete mediaStore[deleted.id];
            console.log(`Deleted media: ${deleted.id}`);
        }
        
        recalculateStats();

        return jsonResponse({
            success: true,
            message: 'تم حذف التسجيل والمحتوى المرتبط به',
            deletedId: id
        }, 200, corsHeaders);

    } catch (error) {
        return jsonResponse({ error: 'Failed to delete: ' + error.message }, 500, corsHeaders);
    }
}

async function handleAdminBlockIP(request, corsHeaders) {
    const auth = await verifyAdmin(request);
    if (!auth.valid) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    try {
        const body = await request.json();
        let { ip } = body;

        if (!ip) {
            return jsonResponse({ error: 'Missing IP address' }, 400, corsHeaders);
        }

        let ipHash = ip;
        const submission = submissions.find(s => s.clientIP === ip || s.ipHash === ip);
        if (submission) {
            ipHash = submission.ipHash;
        }

        blockedIPs.add(ipHash);

        // Reject all from this IP
        submissions.forEach(s => {
            if (s.ipHash === ipHash) {
                s.status = 'rejected';
            }
        });

        return jsonResponse({
            success: true,
            message: `تم حظر IP: ${ip}`,
            blockedIP: ip,
            totalBlocked: blockedIPs.size
        }, 200, corsHeaders);

    } catch (error) {
        return jsonResponse({ error: 'Failed to block IP: ' + error.message }, 500, corsHeaders);
    }
}

async function handleAdminResetStats(request, corsHeaders) {
    const auth = await verifyAdmin(request);
    if (!auth.valid) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    recalculateStats();

    return jsonResponse({
        success: true,
        message: 'تم إعادة حساب الإحصائيات',
        newStats: stats
    }, 200, corsHeaders);
}

// ==================== UTILITY FUNCTIONS ====================

function updateStats(votes, mediaType) {
    if (votes.q1 === 'satisfied') stats.q1_satisfied++;
    else if (votes.q1 === 'not_satisfied') stats.q1_not++;
    
    if (votes.q2 === 'yes') stats.q2_yes++;
    else if (votes.q2 === 'no') stats.q2_no++;
    
    if (votes.q3 === 'youth') stats.q3_new++;
    else if (votes.q3 === 'current') stats.q3_current++;
    
    stats.total_votes++;
    
    if (mediaType === 'video') stats.video_count++;
    else if (mediaType === 'audio') stats.audio_count++;
}

function recalculateStats() {
    stats = {
        q1_satisfied: 0, q1_not: 0,
        q2_yes: 0, q2_no: 0,
        q3_new: 0, q3_current: 0,
        total_votes: 0,
        video_count: 0, audio_count: 0
    };

    submissions.forEach(s => {
        if (s.votes && s.status !== 'rejected') {
            updateStats(s.votes, s.mediaType);
        }
    });
}

function getStatusMessage(status) {
    switch(status) {
        case 'approved': return 'القبول والنشر';
        case 'rejected': return 'الرفض';
        case 'pending': return 'تغيير الحالة';
        default: return 'تحديث';
    }
}

// Array to Base64 conversion
function arrayToBase64(uint8Array) {
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
}

async function simpleHash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(input) + ':elahmadya_v5');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 20);
}

function jsonResponse(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: headers || { 'Content-Type': 'application/json' }
    });
}
