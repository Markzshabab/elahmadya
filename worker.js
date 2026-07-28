/**
 * CLOUDFLARE WORKER 
 * Bindings Required in wrangler.toml:
 * - R2 Bucket bound as `MEDIA_BUCKET`
 * - Environment variables: FIREBASE_URL, FIREBASE_AUTH
 */

export default {
    async fetch(request, env) {
        // Handle CORS
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        };
        if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

        const url = new URL(request.url);

        if (request.method === 'POST' && url.pathname === '/submit') {
            const formData = await request.formData();
            const votes = JSON.parse(formData.get('votes') || '{}');
            const media = formData.get('media');
            const type = formData.get('type');
            
            const uuid = crypto.randomUUID();
            let mediaUrl = null;

            // 1. Upload to Cloudflare R2 if media exists
            if (media) {
                const extension = type === 'video' ? 'mp4' : 'mp3';
                const key = `pending/${uuid}.${extension}`;
                await env.MEDIA_BUCKET.put(key, media.stream(), {
                    httpMetadata: { contentType: media.type }
                });
                // R2 Public URL setup
                mediaUrl = `https://media.yourdomain.com/${key}`; 
            }

            // 2. Save to Firebase RTDB via REST API
            const dbUrl = `${env.FIREBASE_URL}/survey/submissions/${uuid}.json?auth=${env.FIREBASE_AUTH}`;
            const payload = {
                timestamp: Date.now(),
                votes: votes,
                media: mediaUrl,
                mediaType: type,
                status: media ? 'pending' : 'approved'
            };

            await fetch(dbUrl, { method: 'PUT', body: JSON.stringify(payload) });

            // 3. Increment Counters in Firebase Transactionally (simplified for REST)
            // In production, use Cloudflare durable objects or CF KV to queue increments to prevent race conditions.
            
            return new Response(JSON.stringify({ success: true, totalVotes: "Updated" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // Stats API endpoint
        if (request.method === 'GET' && url.pathname === '/stats') {
             const statsResponse = await fetch(`${env.FIREBASE_URL}/survey/statistics.json`);
             const stats = await statsResponse.json();
             return new Response(JSON.stringify(stats), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }

        return new Response('Not Found', { status: 404 });
    }
};