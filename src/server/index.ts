// --- TAMBAHKAN DI AWAL FILE (setelah imports) ---
// Helper: Get cookie value
function getCookie(request: Request, name: string): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [key, value] = cookie.trim().split('=');
        if (key === name) return decodeURIComponent(value);
    }
    return null;
}

// Helper: Generate stable hash from identifier
async function generateRoomHash(identifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(identifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Helper: Get user from D1
async function getUserFromD1(env: any): Promise<string | null> {
    try {
        // Query D1 for the most recent user
        const result = await env.ROOM_DB.prepare(
            "SELECT user FROM messages ORDER BY rowid DESC LIMIT 1"
        ).first();
        return result?.user || null;
    } catch (error) {
        console.log("D1 query error (might be first time):", error);
        return null;
    }
}

// --- CLASS Chat TETAP SAMA PERSIS ---
export class Chat extends Server<Env> {
    // ... ALL ORIGINAL CODE REMAINS UNCHANGED ...
    // JANGAN DIUBAH
}

// --- UBAH HANYA fetch HANDLER ---
export default {
    async fetch(request: Request, env: any) {
        const url = new URL(request.url);
        const pathHash = url.pathname.split('/').filter(p => p)[0] || '';
        
        // 1. DAPATKAN USER IDENTIFIER
        let userIdentifier: string | null = null;
        
        // Coba dari query parameter
        userIdentifier = url.searchParams.get('email') || 
                         url.searchParams.get('user') || 
                         url.searchParams.get('user_id');
        
        // Coba dari cookie
        if (!userIdentifier) {
            userIdentifier = getCookie(request, 'email') || 
                             getCookie(request, 'user');
        }
        
        // Coba dari D1 (existing data)
        if (!userIdentifier) {
            userIdentifier = await getUserFromD1(env);
        }
        
        // 2. JIKA ADA USER IDENTIFIER, GENERATE ROOM HASH
        if (userIdentifier) {
            const roomHash = await generateRoomHash(userIdentifier);
            
            // 3. SIMPAN MAPPING KE D1 (jika belum ada)
            try {
                await env.ROOM_DB.prepare(
                    `CREATE TABLE IF NOT EXISTS user_rooms (
                        user_identifier TEXT PRIMARY KEY,
                        room_hash TEXT UNIQUE NOT NULL
                    )`
                ).run();
                
                await env.ROOM_DB.prepare(
                    "INSERT OR IGNORE INTO user_rooms (user_identifier, room_hash) VALUES (?, ?)"
                ).bind(userIdentifier, roomHash).run();
            } catch (error) {
                console.log("Error saving to user_rooms:", error);
            }
            
            // 4. REDIRECT LOGIC
            // Jika akses root atau hash salah, redirect ke hash yang benar
            if (!pathHash || pathHash !== roomHash) {
                return Response.redirect(`${url.origin}/${roomHash}`);
            }
        }
        
        // 5. JIKA TIDAK ADA USER IDENTIFIER, TAMPILKAN FORM SEDERHANA
        if (!userIdentifier && !pathHash) {
            if (request.method === 'POST') {
                const formData = await request.formData();
                const inputIdentifier = formData.get('identifier') as string;
                
                if (inputIdentifier) {
                    // Redirect dengan identifier
                    const roomHash = await generateRoomHash(inputIdentifier);
                    return Response.redirect(`${url.origin}/${roomHash}`);
                }
            }
            
            // Show simple form
            return new Response(`
                <h3>Masukkan Email/Username</h3>
                <form method="POST">
                    <input type="text" name="identifier" required>
                    <button type="submit">Masuk Chat</button>
                </form>
            `, { headers: { 'Content-Type': 'text/html' } });
        }
        
        // 6. LANJUTKAN KE ROUTING ORIGINAL
        return (
            (await routePartykitRequest(request, { ...env })) ||
            env.ASSETS.fetch(request)
        );
    },
} satisfies ExportedHandler<Env>;
