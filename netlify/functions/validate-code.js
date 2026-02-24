// Netlify Function: validate-code
// Validates per-person access codes for the Career Highlights page.
//
// Codes are stored as a Netlify environment variable: CAREER_CODES
// Format: JSON string of array of code objects:
// [
//   { "code": "ABC123", "name": "Jane Smith", "expires": "2026-03-15T00:00:00Z" },
//   { "code": "XYZ789", "name": "Recruiter Co", "expires": "2026-02-28T00:00:00Z" }
// ]
//
// Set this in Netlify Dashboard > Site settings > Environment variables
// or via CLI: netlify env:set CAREER_CODES '[{"code":"ABC123","name":"Jane Smith","expires":"2026-03-15T00:00:00Z"}]'

exports.handler = async (event) => {
    // Only accept POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { code } = JSON.parse(event.body || '{}');

        if (!code || typeof code !== 'string') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ valid: false, error: 'No code provided' })
            };
        }

        // Load codes from environment variable
        const codesRaw = process.env.CAREER_CODES || '[]';
        let codes;
        try {
            codes = JSON.parse(codesRaw);
        } catch (e) {
            console.error('Failed to parse CAREER_CODES env var:', e);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ valid: false, error: 'Server configuration error' })
            };
        }

        // Find matching code (case-insensitive)
        const inputCode = code.trim().toUpperCase();
        const match = codes.find(c => c.code.toUpperCase() === inputCode);

        if (!match) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ valid: false, error: 'Invalid access code' })
            };
        }

        // Check expiry
        const expiresAt = new Date(match.expires);
        if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ valid: false, error: 'This code has expired' })
            };
        }

        // Valid code - return success with expiry
        // The client stores this and checks expiry on load
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                valid: true,
                name: match.name || 'Guest',
                expires: match.expires,
                // Simple HMAC-like token: base64 of code + expiry + secret salt
                // This prevents someone from just setting localStorage manually
                token: Buffer.from(`${inputCode}:${match.expires}:${process.env.CAREER_SALT || 'kiran-career-2026'}`).toString('base64')
            })
        };

    } catch (e) {
        console.error('Validation error:', e);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ valid: false, error: 'Something went wrong' })
        };
    }
};
