const fs = require('fs');
let s = fs.readFileSync('components/app-sidebar.tsx', 'utf8');

s = s.replace(/<span className="font-serif font-bold text-sm tracking-tight uppercase">HRD Vitezovi[cć]"flex items-center gap-1">/, '<span className="font-serif font-bold text-sm tracking-tight uppercase">HRD Vitezović</span>\n        </div>\n        <div className="flex items-center gap-1">');

fs.writeFileSync('components/app-sidebar.tsx', s);
