const fs = require('fs');
const f = 'src/lib/api.ts';
let s = fs.readFileSync(f, 'utf8');
const start = s.indexOf('export function hasPermission');
if (start >= 0) {
  const end = s.indexOf('\nexport ', start + 1);
  if (end >= 0) {
    const replacement = `export function hasPermission(user: SessionUser | null | undefined, permission: string): boolean {\n  if (!user) return false;\n  const roles = (user as any)?.roles;\n  if (!Array.isArray(roles)) return false;\n  for (let i = 0; i < roles.length; i++) {\n    const role = roles[i];\n    if (!role) continue;\n    const perms = role?.permissions;\n    if (Array.isArray(perms) && perms.includes(permission)) return true;\n  }\n  return false;\n}\n\n`;
    s = s.slice(0, start) + replacement + s.slice(end + 1);
    fs.writeFileSync(f, s);
    console.log('ok');
  } else console.log('end not found');
} else console.log('start not found');
