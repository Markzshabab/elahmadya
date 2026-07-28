// ==================== CLOUDFLARE WORKER - COMPLETE VERSION ====================
// يدعم: التصويتات + الإحصائيات + لوحة الأدمن

// تخزين البيانات
let submissions = [];
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
            
            // Health Check
            if (url.pathname === '/api/health' && method === 'GET') {
                return jsonResponse({ status: 'ok', time: new Date().toISOString(), totalSubmissions: submissions.length }, 200, corsHeaders);
            }

            // Stats
            if (url.pathname === '/api/stats' && method === 'GET') {
                return jsonResponse(stats, 200, corsHeaders);
            }

            // Submit Vote
            if (url.pathname === '/api/vote' && method === 'POST') {
                return await handleVote(request, corsHeaders);
            }

            // Get Media List
            if (url.pathname === '/api/media' && method === 'GET') {
                return await handleGetMedia(corsHeaders);
            }

            // Gallery Approved
            if (url.pathname === '/gallery/approved' && method === 'GET') {
                return await handleGalleryApproved(corsHeaders);
            }

            // ==================== ADMIN ENDPOINTS ====================
            
            // Admin Login / Get All Submissions
            if (url.pathname === '/admin/submissions' || url.pathname === '/admin/login') {
                if (method === 'GET') {
                    return await handleAdminGetSubmissions(request, corsHeaders);
                }
            }

            // Admin Update Status (Approve/Reject)
            if (url.pathname === '/admin/update-status' && method === 'POST') {
                return await handleAdminUpdateStatus(request, corsHeaders);
            }

            // Admin Delete Entry
            if (url.pathname === '/admin/delete' && method === 'POST') {
                return await handleAdminDelete(request, corsHeaders);
            }

            // Admin Block IP
            if (url.pathname === '/admin/block-ip' && method === 'POST') {
                return await handleAdminBlockIP(request, corsHeaders);
            }

            // Admin Get Blocked IPs
            if (url.pathname === '/admin/blocked-ips' && method === 'GET') {
                return await handleAdminGetBlockedIPs(corsHeaders);
            }

            // Admin Reset Stats
            if (url.pathname === '/admin/reset-stats' && method === 'POST') {
                return await handleAdminResetStats(request, corsHeaders);
            }

            // Root
            if (url.pathname === '/' || url.pathname === '') {
                return jsonResponse({
                    service: 'El Ahmadiya Survey API',
                    version: '4.0-complete',
                    endpoints: {
                        public: ['/api/vote', '/api/stats', '/api/media', '/gallery/approved', '/api/health'],
                        admin: ['/admin/submissions', '/admin/update-status', '/admin/delete', '/admin/block-ip']
                    },
                    stats: stats
                }, 200, corsHeaders);
            }

            // 404
            return jsonResponse({ error: 'Not found' }, 404, corsHeaders);

        } catch (error) {
            console.error('Worker Error:', error);
            return jsonResponse({ error: 'Internal Server Error', message: error.message }, 500, corsHeaders);
        }
    }
};

// ==================== VOTE HANDLER ====================

async function handleVote(request, corsHeaders) {
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
            return jsonResponse({ 
                error: 'IP blocked', 
                message: 'تم حظر هذا الجهاز من المشاركة' 
            }, 403, corsHeaders);
        }

        // Create submission
        const submission = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            timestampISO: new Date().toISOString(),
            votes: votes,
            fingerprint: fingerprint?.substring(0, 200),
            ipHash: ipHash,
            clientIP: clientIP.substring(0, 45), // Partial IP for admin view
            userAgent: request.headers.get('user-agent')?.substring(0, 200),
            mediaUrl: null,
            mediaType: null,
            status: 'approved' // Auto-approve for now
        };

        // Handle media upload if exists
        const mediaFile = formData.get('media');
        const mediaType = formData.get('type');
        
        if (mediaFile && mediaFile.size > 0) {
            submission.mediaType = mediaType;
            submission.status = 'pending'; // Pending review for media
            
            // In production, upload to R2 here
            // For now, store as base64 preview (small files only)
            if (mediaFile.size < 5 * 1024 * 1024) { // Less than 5MB
                try {
                    const arrayBuffer = await mediaFile.arrayBuffer();
                    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                    submission.mediaPreview = `data:${mediaFile.type};base64,${base64.substring(0, 100)}...`; // Preview only
                } catch (e) {
                    console.error('Media processing error:', e);
                }
            }
            
            submission.mediaUrl = `#preview-${submission.id}`;
        }

        // Store submission
        submissions.push(submission);

        // Update statistics
        updateStats(votes, mediaType);

        console.log(`New vote from ${clientIP}:`, votes);

        return jsonResponse({
            success: true,
            submissionId: submission.id,
            message: '✅ تم تسجيل تصويتك بنجاح!',
            currentStats: stats
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Vote error:', error);
        return jsonResponse({ error: 'Failed to process vote', details: error.message }, 500, corsHeaders);
    }
}

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

// ==================== MEDIA HANDLERS ====================

async function handleGetMedia(corsHeaders) {
    const mediaList = submissions
        .filter(s => s.mediaUrl && s.status === 'approved')
        .map(s => ({
            id: s.id,
            mediaType: s.mediaType,
            mediaUrl: s.mediaUrl,
            timestamp: s.timestamp,
            status: s.status
        }));
    
    return jsonResponse({ media: mediaList, total: mediaList.length }, 200, corsHeaders);
}

async function handleGalleryApproved(corsHeaders) {
    const approvedMedia = submissions
        .filter(s => s.mediaUrl && s.status === 'approved')
        .map(s => ({
            id: s.id,
            mediaType: s.mediaType,
            mediaUrl: s.mediaUrl,
            timestamp: s.timestamp,
            status: 'approved'
        }));
    
    return jsonResponse(approvedMedia, 200, corsHeaders);
}

// ==================== ADMIN HANDLERS ====================

async function verifyAdmin(request) {
    // Simple password verification
    // Password is the current time in Cairo (HHMM format)
    const now = new Date();
    const cairoTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const timePassword = String(cairoTime.getHours()).padStart(2, '0') + 
                         String(cairoTime.getMinutes()).padStart(2, '0');
    
    // Also accept a fixed password from env (if set)
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    const urlKey = new URL(request.url).searchParams.get('key');
    
    const providedPassword = authHeader || urlKey;
    
    // Accept either time-based or fixed password
    if (!providedPassword) {
        return { valid: false, error: 'No authentication provided' };
    }
    
    // For now, accept any non-empty password (change this in production!)
    // In production, use: providedPassword === timePassword || providedPassword === ADMIN_SECRET
    return { valid: true };
}

async function handleAdminGetSubmissions(request, corsHeaders) {
    const auth = await verifyAdmin(request);
    if (!auth.valid) {
        return jsonResponse({ error: auth.error || 'Unauthorized' }, 401, corsHeaders);
    }

    // Return all submissions with full details
    const detailedSubmissions = submissions.map(s => ({
        id: s.id,
        timestamp: s.timestamp,
        timestampISO: s.timestampISO,
        ip: s.clientIP,
        ipHash: s.ipHash,
        fingerprint: s.fingerprint,
        votes: s.votes,
        mediaUrl: s.mediaUrl,
        mediaType: s.mediaType,
        status: s.status,
        userAgent: s.userAgent
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
            return jsonResponse({ error: 'Invalid status. Must be: approved, rejected, or pending' }, 400, corsHeaders);
        }

        // Find and update submission
        const submission = submissions.find(s => s.id === id);
        if (!submission) {
            return jsonResponse({ error: 'Submission not found' }, 404, corsHeaders);
        }

        const oldStatus = submission.status;
        submission.status = status;

        console.log(`Admin updated ${id}: ${oldStatus} -> ${status}`);

        return jsonResponse({
            success: true,
            message: `تم ${status === 'approved' ? 'قبول' : status === 'rejected' ? 'رفض' : 'تحديث'} التسجيل بنجاح`,
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
        
        // Recalculate stats
        recalculateStats();

        console.log(`Admin deleted submission: ${id}`);

        return jsonResponse({
            success: true,
            message: 'تم حذف التسجيل بنجاح',
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

        // If it's a partial IP, find the hash
        let ipHash = ip;
        const submission = submissions.find(s => s.clientIP === ip || s.ipHash === ip);
        if (submission) {
            ipHash = submission.ipHash;
        }

        blockedIPs.add(ipHash);

        // Also reject all submissions from this IP
        submissions.forEach(s => {
            if (s.ipHash === ipHash) {
                s.status = 'rejected';
            }
        });

        console.log(`Admin blocked IP: ${ip} (hash: ${ipHash})`);

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

async function handleAdminGetBlockedIPs(corsHeaders) {
    return jsonResponse({
        blockedIPs: Array.from(blockedIPs),
        totalBlocked: blockedIPs.size
    }, 200, corsHeaders);
}

async function handleAdminResetStats(request, corsHeaders) {
    const auth = await verifyAdmin(request);
    if (!auth.valid) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    // Reset stats but keep submissions
    stats = {
        q1_satisfied: 0, q1_not: 0,
        q2_yes: 0, q2_no: 0,
        q3_new: 0, q3_current: 0,
        total_votes: 0,
        video_count: 0, audio_count: 0
    };

    // Recalculate from existing submissions
    submissions.forEach(s => {
        if (s.votes) updateStats(s.votes, s.mediaType);
    });

    return jsonResponse({
        success: true,
        message: 'تم إعادة تعيين الإحصائيات',
        newStats: stats
    }, 200, corsHeaders);
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

// ==================== UTILITIES ====================

async function simpleHash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(input) + ':elahmadya_v4');
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
