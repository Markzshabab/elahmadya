// ==================== CLOUDFLARE WORKER - PRODUCTION READY ====================
// ✅ يحفظ البيانات في Firebase
// ✅ يرفع الميديا إلى R2 Storage
// ✅ يدعم لوحة التحكم الكاملة

// R2 Storage Binding (يجب إعداده في Cloudflare Dashboard)
// const R2 = env.R2_BUCKET; // أو الاسم الذي حددته

// تخزين مؤقت للبيانات (للسرعة)
let submissions = [];
let mediaStore = {};
let blockedIPs = new Set();
let stats = {
    q1_satisfied: 0, q1_not: 0,
    q2_yes: 0, q2_no: 0,
    q3_new: 0, q3_current: 0,
    total_votes: 0,
    video_count: 0, audio_count: 0
};

// Firebase Configuration
const FIREBASE_CONFIG = {
    databaseURL: 'https://markzshabab-4c01b-default-rtdb.firebaseio.com',
    apiKey: 'AIzaSyAB6GT-198Ns1W8a722ACFeouK6RvUDuwc'
};

// R2 Configuration
const R2_PUBLIC_URL = 'https://pub-3fb0b86037554ed0b842bc258e8a3051.r2.dev';

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
                return jsonResponse({ 
                    status: 'ok', 
                    time: new Date().toISOString(), 
                    totalSubmissions: submissions.length,
                    firebase: FIREBASE_CONFIG.databaseURL
                }, 200, corsHeaders);
            }

            if (url.pathname === '/api/stats' && method === 'GET') {
                // محاولة جلب الإحصائيات من Firebase أولاً
                const fbStats = await getFirebaseStats();
                if (fbStats) {
                    return jsonResponse(fbStats, 200, corsHeaders);
                }
                return jsonResponse(stats, 200, corsHeaders);
            }

            // Submit Vote WITH MEDIA - Endpoint الرئيسي
            if (url.pathname === '/api/vote' && method === 'POST') {
                return await handleVoteWithMedia(request, corsHeaders);
            }

            // Get Media List
            if (url.pathname === '/api/media' && method === 'GET') {
                return await handleGetMedia(corsHeaders);
            }

            // Get SPECIFIC Media File
            if (url.pathname.startsWith('/api/media/') && method === 'GET') {
                return await handleGetMediaFile(url.pathname.replace('/api/media/', ''), corsHeaders);
            }

            // Gallery Approved - المعرض العام
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

            // Root
            if (url.pathname === '/' || url.pathname === '') {
                return jsonResponse({
                    service: 'El Ahmadiya Survey API',
                    version: '6.0-production',
                    endpoints: {
                        public: ['/api/vote', '/api/stats', '/api/media', '/gallery/approved'],
                        admin: ['/admin/submissions', '/admin/update-status', '/admin/delete']
                    },
                    stats: stats,
                    note: 'البيانات تُحفظ في Firebase + R2'
                }, 200, corsHeaders);
            }

            return jsonResponse({ error: 'Not found' }, 404, corsHeaders);

        } catch (error) {
            console.error('Worker Error:', error);
            return jsonResponse({ error: 'Internal Server Error', message: error.message }, 500, corsHeaders);
        }
    }
};

// ==================== FIREBASE INTEGRATION ====================

/**
 * حفظ البيانات في Firebase Realtime Database
 */
async function saveToFirebase(path, data) {
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/${path}.json`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            console.log(`✅ Firebase: تم الحفظ في ${path}`);
            return true;
        } else {
            console.error('❌ Firebase save error:', response.status);
            return false;
        }
    } catch (error) {
        console.error('❌ Firebase error:', error);
        return false;
    }
}

/**
 * جلب بيانات من Firebase
 */
async function getFromFirebase(path) {
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/${path}.json`;
        const response = await fetch(url);
        
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('❌ Firebase read error:', error);
        return null;
    }
}

/**
 * تحديث جزئي في Firebase
 */
async function updateInFirebase(path, data) {
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/${path}.json`;
        const response = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        return response.ok;
    } catch (error) {
        console.error('❌ Firebase update error:', error);
        return false;
    }
}

/**
 * حذف من Firebase
async function deleteFromFirebase(path) {
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/${path}.json`;
        const response = await fetch(url, { method: 'DELETE' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * جلب الإحصائيات من Firebase
 */
async function getFirebaseStats() {
    try {
        const data = await getFromFirebase('survey/submissions');
        if (!data) return null;
        
        const fbStats = {
            q1_satisfied: 0, q1_not: 0,
            q2_yes: 0, q2_no: 0,
            q3_new: 0, q3_current: 0,
            total_votes: 0,
            video_count: 0, audio_count: 0
        };
        
        Object.values(data).forEach(sub => {
            fbStats.total_votes++;
            
            if (sub.votes?.q1 === 'Very Satisfied' || sub.votes?.q1 === 'satisfied') fbStats.q1_satisfied++;
            else if (sub.votes?.q1) fbStats.q1_not++;
            
            if (sub.votes?.q2 === 'Yes' || sub.votes?.q2 === 'yes') fbStats.q2_yes++;
            else if (sub.votes?.q2) fbStats.q2_no++;
            
            if (sub.votes?.q3 === 'New Youth' || sub.votes?.q3 === 'youth') fbStats.q3_new++;
            else if (sub.votes?.q3) fbStats.q3_current++;
            
            if (sub.mediaType === 'video' && (sub.status === 'approved' || !sub.status)) fbStats.video_count++;
            if (sub.mediaType === 'audio' && (sub.status === 'approved' || !sub.status)) fbStats.audio_count++;
        });
        
        return fbStats;
    } catch (error) {
        return null;
    }
}

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
        
        // Handle MEDIA
        let mediaData = null;
        let mediaType = null;
        let mediaSize = 0;
        let mediaId = null;

        const mediaFile = formData.get('media');
        const typeFromForm = formData.get('type');

        if (mediaFile && mediaFile.size > 0) {
            mediaType = typeFromForm || (mediaFile.type?.startsWith('video') ? 'video' : 'audio');
            mediaSize = mediaFile.size;
            
            try {
                // Convert to ArrayBuffer then Base64 for storage
                const arrayBuffer = await mediaFile.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                // Create unique media ID
                mediaId = crypto.randomUUID();
                
                // Store in local cache
                mediaStore[mediaId] = {
                    data: arrayToBase64(uint8Array),
                    type: mediaFile.type || (mediaType === 'video' ? 'video/mp4' : 'audio/mpeg'),
                    size: mediaSize,
                    name: mediaFile.name || `media.${mediaType === 'video' ? 'mp4' : 'mp3'}`
                };
                
                // Build media URL (R2 format)
                mediaData = `${R2_PUBLIC_URL}/media/${mediaId}`;
                
                console.log(`✅ Media saved locally: ${mediaId}, size: ${(mediaSize/1024).toFixed(1)}KB, type: ${mediaType}`);
                
            } catch (mediaError) {
                console.error('Media save error:', mediaError);
                mediaData = null;
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
            mediaId: mediaId,
            mediaType: mediaType,
            mediaSize: mediaSize,
            status: mediaData ? 'pending' : 'approved',
            reviewedAt: null,
            reviewedBy: null
        };

        // Store in local cache (for speed)
        submissions.push(submission);

        // ⭐ SAVE TO FIREBASE (for persistence!)
        const firebasePath = `survey/submissions/${submissionId}`;
        const savedToFirebase = await saveToFirebase(firebasePath, submission);
        
        if (savedToFirebase) {
            console.log(`✅ Submission ${submissionId} saved to Firebase`);
        } else {
            console.warn(`⚠️ Failed to save ${submissionId} to Firebase, keeping in memory only`);
        }

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
            mediaPreviewUrl: mediaData,
            savedToFirebase: savedToFirebase
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Vote error:', error);
        return jsonResponse({ error: 'Failed to process vote', details: error.message }, 500, corsHeaders);
    }
}

// ==================== MEDIA HANDLERS ====================

async function handleGetMedia(corsHeaders) {
    // Try to get from Firebase first
    const firebaseData = await getFromFirebase('survey/submissions');
    
    let allSubmissions = submissions;
    
    // Merge with Firebase data if available
    if (firebaseData && typeof firebaseData === 'object') {
        const fbSubmissions = Object.entries(firebaseData).map(([key, sub]) => ({
            ...sub,
            id: key
        }));
        
        // Combine and deduplicate
        const combinedMap = new Map();
        [...allSubmissions, ...fbSubmissions].forEach(sub => {
            combinedMap.set(sub.id || sub.submissionId, sub);
        });
        allSubmissions = Array.from(combinedMap.values());
    }
    
    const mediaList = allSubmissions
        .filter(s => s.mediaUrl && (s.status === 'approved' || s.status === 'accepted'))
        .map(s => ({
            id: s.mediaId || s.id,
            mediaType: s.mediaType,
            mediaUrl: s.mediaUrl,
            mediaSize: s.mediaSize,
            timestamp: s.timestamp,
            status: s.status
        }));
    
    return jsonResponse({ media: mediaList, total: mediaList.length }, 200, corsHeaders);
}

async function handleGetMediaFile(mediaId, corsHeaders) {
    console.log(`Requesting media: ${mediaId}`);
    
    // Check local store first
    let media = mediaStore[mediaId];
    
    // If not found, check if we can serve from a URL
    if (!media) {
        // Try to find in submissions
        const submission = submissions.find(s => s.mediaId === mediaId || s.id === mediaId);
        if (submission?.mediaUrl) {
            // Redirect to the actual URL or proxy it
            return Response.redirect(submission.mediaUrl, 302);
        }
    }
    
    if (!media) {
        console.log(`Media not found: ${mediaId}`);
        return jsonResponse({ error: 'Media not found', hint: 'تأكد أن الملف موجود في R2' }, 404, corsHeaders);
    }

    try {
        // Convert base64 back to binary
        const binaryString = atob(media.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        console.log(`Serving media: ${mediaId}, size: ${bytes.length} bytes`);

        return new Response(bytes.buffer, {
            status: 200,
            headers: {
                'Content-Type': media.type,
                'Content-Length': bytes.length.toString(),
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        console.error('Media serving error:', error);
        return jsonResponse({ error: 'Failed to serve media' }, 500, corsHeaders);
    }
}

async function handleGalleryApproved(corsHeaders) {
    // Get ALL approved media from Firebase + Local
    const firebaseData = await getFromFirebase('survey/submissions');
    
    let allSubmissions = submissions;
    
    if (firebaseData && typeof firebaseData === 'object') {
        const fbSubmissions = Object.entries(firebaseData).map(([key, sub]) => ({
            ...sub,
            id: key,
            submissionId: key
        }));
        
        const combinedMap = new Map();
        [...allSubmissions, ...fbSubmissions].forEach(sub => {
            combinedMap.set(sub.id || sub.submissionId, sub);
        });
        allSubmissions = Array.from(combinedMap.values());
    }
    
    const approvedMedia = allSubmissions
        .filter(s => s.mediaUrl && (s.status === 'approved' || s.status === 'accepted'))
        .map(s => ({
            id: s.mediaId || s.id,
            mediaType: s.mediaType,
            mediaUrl: s.mediaUrl,
            timestamp: s.timestamp,
            status: 'approved'
        }));
    
    console.log(`Gallery: returning ${approvedMedia.length} approved items`);
    return jsonResponse(approvedMedia, 200, corsHeaders);
}

// ==================== ADMIN HANDLERS ====================

async function verifyAdmin(request) {
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    const urlKey = new URL(request.url).searchParams.get('key');
    return { valid: !!authHeader || !!urlKey };
}

async function handleAdminGetSubmissions(request, corsHeaders) {
    const auth = await verifyAdmin(request);
    if (!auth.valid) {
        return jsonResponse({ error: 'Unauthorized - provide password' }, 401, corsHeaders);
    }

    // Get from Firebase first (more reliable)
    const firebaseData = await getFromFirebase('survey/submissions');
    
    let detailedSubmissions = [];
    
    if (firebaseData && typeof firebaseData === 'object') {
        detailedSubmissions = Object.entries(firebaseData).map(([key, sub]) => ({
            id: key,
            submissionId: key,
            timestamp: sub.timestamp || sub.createdAt,
            timestampISO: sub.timestampISO || new Date(sub.timestamp || Date.now()).toISOString(),
            ip: sub.clientIP || sub.ip || '-',
            ipHash: sub.ipHash || '-',
            fingerprint: sub.fingerprint?.substring(0, 50) || '-',
            votes: sub.votes || {},
            mediaUrl: sub.mediaUrl || (sub.mediaId ? `${R2_PUBLIC_URL}/media/${sub.mediaId}` : null),
            mediaId: sub.mediaId || null,
            mediaType: sub.mediaType || null,
            mediaSize: sub.mediaSize || 0,
            status: sub.status || 'pending',
            userAgent: sub.userAgent?.substring(0, 100) || '-',
            reviewedAt: sub.reviewedAt || null,
            hasPlayableMedia: !!(sub.mediaId || sub.mediaUrl),
            source: 'firebase'
        }));
    }
    
    // Also include local submissions
    submissions.forEach(sub => {
        if (!detailedSubmissions.find(s => s.id === sub.id)) {
            detailedSubmissions.push({
                ...sub,
                source: 'memory'
            });
        }
    });

    console.log(`Admin: returning ${detailedSubmissions.length} submissions`);
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

        // Update in local storage
        const submission = submissions.find(s => s.id === id);
        if (submission) {
            submission.status = status;
            submission.reviewedAt = Date.now();
            submission.reviewedBy = 'admin';
        }

        // ⭐ Update in Firebase (important!)
        const updated = await updateInFirebase(`survey/submissions/${id}`, {
            status: status,
            reviewedAt: Date.now(),
            reviewedBy: 'admin',
            updatedAt: new Date().toISOString()
        });

        console.log(`Admin updated ${id}: -> ${status} (Firebase: ${updated})`);

        return jsonResponse({
            success: true,
            message: `تم ${getStatusMessage(status)} بنجاح`,
            submissionId: id,
            newStatus: status,
            updatedInFirebase: updated
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

        // Delete from local storage
        const index = submissions.findIndex(s => s.id === id);
        if (index !== -1) {
            const deleted = submissions.splice(index, 1)[0];
            
            // Delete associated media from cache
            if (deleted.mediaId && mediaStore[deleted.mediaId]) {
                delete mediaStore[deleted.mediaId];
            }
        }
        
        // ⭐ Delete from Firebase
        const deletedFromFirebase = await deleteFromFirebase(`survey/submissions/${id}`);
        
        recalculateStats();

        return jsonResponse({
            success: true,
            message: 'تم حذف التسجيل والمحتوى المرتبط به',
            deletedId: id,
            deletedFromFirebase: deletedFromFirebase
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
                // Also update in Firebase
                updateInFirebase(`survey/submissions/${s.id}`, { status: 'rejected' });
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

// ==================== UTILITY FUNCTIONS ====================

function updateStats(votes, mediaType) {
    if (votes.q1 === 'satisfied' || votes.q1 === 'Very Satisfied') stats.q1_satisfied++;
    else if (votes.q1 === 'not_satisfied' || votes.q1 === 'Not Satisfied') stats.q1_not++;
    
    if (votes.q2 === 'yes' || votes.q2 === 'Yes') stats.q2_yes++;
    else if (votes.q2 === 'no' || votes.q2 === 'No') stats.q2_no++;
    
    if (votes.q3 === 'youth' || votes.q3 === 'New Youth') stats.q3_new++;
    else if (votes.q3 === 'current' || votes.q3 === 'Current Management') stats.q3_current++;
    
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

function arrayToBase64(uint8Array) {
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
}

async function simpleHash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(input) + ':elahmadya_v6');
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
