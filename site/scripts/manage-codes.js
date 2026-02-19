#!/usr/bin/env node

// ============================================
// Career Highlights - Access Code Manager
// ============================================
//
// Usage:
//   node scripts/manage-codes.js add "Jane Smith" 7d          # 7-day code
//   node scripts/manage-codes.js add "Recruiter Inc" 30d      # 30-day code
//   node scripts/manage-codes.js add "Conference Lead" 48h    # 48-hour code
//   node scripts/manage-codes.js list                          # show all codes
//   node scripts/manage-codes.js revoke ABC123                 # remove a code
//   node scripts/manage-codes.js export                        # output JSON for Netlify env var
//   node scripts/manage-codes.js cleanup                       # remove expired codes
//
// Codes are stored in scripts/career-codes.json (gitignored).
// After changes, copy the export output to your Netlify env var CAREER_CODES.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CODES_FILE = path.join(__dirname, 'career-codes.json');

// Load existing codes
function loadCodes() {
    try {
        return JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

// Save codes
function saveCodes(codes) {
    fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2));
}

// Generate a readable 6-character code
function generateCode() {
    // Uppercase letters + digits, excluding confusing chars (0/O, 1/I/L)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return code;
}

// Parse duration string (e.g., "7d", "48h", "30d")
function parseDuration(str) {
    const match = str.match(/^(\d+)(h|d)$/i);
    if (!match) {
        console.error('Invalid duration format. Use e.g., 7d (days) or 48h (hours)');
        process.exit(1);
    }
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const ms = unit === 'h' ? value * 60 * 60 * 1000 : value * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
}

// Commands
const [,, command, ...args] = process.argv;

switch (command) {
    case 'add': {
        const name = args[0];
        const duration = args[1];
        if (!name || !duration) {
            console.error('Usage: manage-codes.js add "Name" 7d');
            process.exit(1);
        }
        const codes = loadCodes();
        const code = generateCode();
        const expires = parseDuration(duration);
        codes.push({ code, name, expires: expires.toISOString(), created: new Date().toISOString() });
        saveCodes(codes);

        console.log('\n  Code created successfully:\n');
        console.log(`  Code:     ${code}`);
        console.log(`  For:      ${name}`);
        console.log(`  Expires:  ${expires.toLocaleDateString()} ${expires.toLocaleTimeString()}`);
        console.log(`\n  Direct link: https://kirangorapalli.netlify.app/career-highlights.html?code=${code}`);
        console.log('\n  Run "manage-codes.js export" to get the Netlify env var value.\n');
        break;
    }

    case 'list': {
        const codes = loadCodes();
        if (codes.length === 0) {
            console.log('\n  No codes found.\n');
            break;
        }
        console.log('\n  Active access codes:\n');
        const now = new Date();
        codes.forEach(c => {
            const exp = new Date(c.expires);
            const expired = exp < now;
            const status = expired ? '  EXPIRED' : `  valid until ${exp.toLocaleDateString()}`;
            console.log(`  ${c.code}  |  ${c.name.padEnd(20)}  |${status}`);
        });
        console.log('');
        break;
    }

    case 'revoke': {
        const codeToRevoke = (args[0] || '').toUpperCase();
        if (!codeToRevoke) {
            console.error('Usage: manage-codes.js revoke ABC123');
            process.exit(1);
        }
        let codes = loadCodes();
        const before = codes.length;
        codes = codes.filter(c => c.code.toUpperCase() !== codeToRevoke);
        if (codes.length === before) {
            console.error(`\n  Code "${codeToRevoke}" not found.\n`);
            process.exit(1);
        }
        saveCodes(codes);
        console.log(`\n  Code "${codeToRevoke}" revoked.\n`);
        break;
    }

    case 'cleanup': {
        let codes = loadCodes();
        const before = codes.length;
        codes = codes.filter(c => new Date(c.expires) > new Date());
        saveCodes(codes);
        console.log(`\n  Removed ${before - codes.length} expired codes. ${codes.length} active.\n`);
        break;
    }

    case 'export': {
        const codes = loadCodes();
        // Output the JSON to set as CAREER_CODES env var
        const exportData = codes.map(c => ({
            code: c.code,
            name: c.name,
            expires: c.expires
        }));
        console.log('\n  Copy this value to Netlify > Site settings > Environment variables > CAREER_CODES:\n');
        console.log(JSON.stringify(exportData));
        console.log('\n  Or via CLI:');
        console.log(`  netlify env:set CAREER_CODES '${JSON.stringify(exportData)}'`);
        console.log('');
        break;
    }

    default:
        console.log(`
  Career Highlights - Access Code Manager

  Commands:
    add "Name" <duration>   Create a new code (e.g., 7d, 48h, 30d)
    list                    Show all codes and their status
    revoke <CODE>           Remove a specific code
    cleanup                 Remove all expired codes
    export                  Output JSON for Netlify CAREER_CODES env var

  Examples:
    node scripts/manage-codes.js add "Jane Smith" 7d
    node scripts/manage-codes.js add "Recruiter Inc" 30d
    node scripts/manage-codes.js list
    node scripts/manage-codes.js export
`);
}
