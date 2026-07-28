// ==================== CLOUDFLARE WORKER - SIMPLE VERSION ====================
// هذا الإصدار مبطط ومضمون العمل

// تخزين البيانات في الذاكرة
let submissions = [];
let stats = {
    q1_satisfied: 0,
    q1_not: 0,
    q2_yes: 0,
    q2_no: 0,
    q3_new: 0,
    q3_current: 0,
    total_votes: 0,
    video_count: 0,
    audio_count: 0
};

export default {
    async fetch(request) {
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Content-Type': 'application/json'
        };

        // Handle preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            const url = new URL(request.url);
            
            console.log('Request:', request.method, url.pathname);

            // ======== STATS ENDPOINT ========
            if (url.pathname === '/api/stats' && request.method === 'GET') {
                return new Response(JSON.stringify(stats), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            // ======== VOTE ENDPOINT ========
            if (url.pathname === '/api/vote' && request.method === 'POST') {
                
                try {
                    // قراءة البيانات
                    const formData = await request.formData();
                    const votesStr = formData.get('votes');
                    
                    console.log('Received votes string:', votesStr);

                    if (!votesStr) {
                        return new Response(JSON.stringify({
                            error: 'Missing votes field',
                            hint: 'Send votes as JSON string'
                        }), { status: 400, headers: corsHeaders });
                    }

                    // تحويل JSON
                    let votes;
                    try {
                        votes = JSON.parse(votesStr);
                        console.log('Parsed votes:', votes);
                    } catch (parseError) {
                        return new Response(JSON.stringify({
                            error: 'Invalid JSON in votes',
                            received: String(votesStr).substring(0, 100)
                        }), { status: 400, headers: corsHeaders });
                    }

                    // تحديث الإحصائيات
                    if (votes.q1 === 'satisfied') stats.q1_satisfied++;
                    else if (votes.q1 === 'not_satisfied') stats.q1_not++;
                    
                    if (votes.q2 === 'yes') stats.q2_yes++;
                    else if (votes.q2 === 'no') stats.q2_no++;
                    
                    if (votes.q3 === 'youth') stats.q3_new++;
                    else if (votes.q3 === 'current') stats.q3_current++;
                    
                    stats.total_votes++;

                    // حفظ التصويت
                    submissions.push({
                        id: crypto.randomUUID(),
                        timestamp: Date.now(),
                        votes: votes
                    });

                    console.log('Updated stats:', stats);

                    // نجاح!
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'تم تسجيل التصويت بنجاح!',
                        submissionId: submissions[submissions.length - 1].id,
                        currentStats: stats
                    }), { status: 200, headers: corsHeaders });

                } catch (formError) {
                    console.error('Form processing error:', formError);
                    return new Response(JSON.stringify({
                        error: 'Failed to process form',
                        details: formError.message
                    }), { status: 500, headers: corsHeaders });
                }
            }

            // ======== HEALTH CHECK ========
            if (url.pathname === '/api/health') {
                return new Response(JSON.stringify({
                    status: 'ok',
                    time: new Date().toISOString(),
                    totalSubmissions: submissions.length
                }), { status: 200, headers: corsHeaders });
            }

            // ======== ROOT ========
            if (url.pathname === '/' || url.pathname === '') {
                return new Response(JSON.stringify({
                    service: 'El Ahmadiya Survey API',
                    version: '3.0-simple',
                    endpoints: ['/api/vote', '/api/stats', '/api/health'],
                    totalVotes: stats.total_votes
                }), { status: 200, headers: corsHeaders });
            }

            // ======== 404 ========
            return new Response(JSON.stringify({ 
                error: 'Not found',
                availableEndpoints: ['/api/vote', '/api/stats', '/api/health']
            }), { status: 404, headers: corsHeaders });

        } catch (error) {
            console.error('Worker Error:', error);
            return new Response(JSON.stringify({
                error: 'Internal Server Error',
                message: error.message
            }), { status: 500, headers: corsHeaders });
        }
    }
};
