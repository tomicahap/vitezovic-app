const fs = require('fs');
const path = require('path');

// 1. Fix app-sidebar.tsx (Move Zoom button)
let sidebar = fs.readFileSync('components/app-sidebar.tsx', 'utf8');
// Remove mobile zoom
sidebar = sidebar.replace(/<div className="flex items-center gap-1">[\s\S]*?<Button variant="ghost" size="icon" className="shrink-0" onClick=\{toggleZoom\} title="Povećaj prikaz \(za slabovidne\)">[\s\S]*?<ZoomIn className="h-5 w-5" \/>[\s\S]*?<\/Button>\s*<Sheet>/, '<div className="flex items-center gap-1">\n          <Sheet>');
// Remove desktop zoom (and fix the div structure correctly)
sidebar = sidebar.replace(/<div className="border-t border-border p-4">[\s\S]*?<div className="flex items-center justify-between gap-3 mb-3">[\s\S]*?<div className="flex items-center gap-3 min-w-0">([\s\S]*?)<\/div>\s*<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick=\{toggleZoom\} title="Povećaj prikaz \(za slabovidne\)">\s*<ZoomIn className="h-4 w-4 text-muted-foreground" \/>\s*<\/Button>\s*<\/div>/, '<div className="border-t border-border p-4">\n        <div className="flex items-center gap-3 mb-3">\n          $1\n        </div>');
// Add big zoom button above Odjava
sidebar = sidebar.replace(/<div className="border-t border-border p-3">\s*<button \s*onClick=\{logout\}/, '<div className="border-t border-border p-3 space-y-2">\n          <button \n            onClick={toggleZoom}\n            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 shadow-sm"\n            title="Povećaj prikaz (za slabovidne)"\n          >\n            <ZoomIn className="h-4 w-4 shrink-0" />\n            POVEĆAJ PRIKAZ\n          </button>\n          <button \n            onClick={logout}');
fs.writeFileSync('components/app-sidebar.tsx', sidebar, 'utf8');

// 2. Fix members-content.tsx (Euro icon and internal date formatter)
let members = fs.readFileSync('components/members-content.tsx', 'utf8');
members = members.replace(/Receipt/g, 'Euro');
members = members.replace(/\$\{parts\[2\]\}\.\$\{parts\[1\]\}\.\$\{parts\[0\]\}\./g, "${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}");
fs.writeFileSync('components/members-content.tsx', members, 'utf8');

// 3. Global search and replace for date formats
function walk(dir) {
    let results = [];
    let list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        let stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const allFiles = [...walk('components'), ...walk('lib'), ...walk('hooks')];
allFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    content = content.replace(/toLocaleDateString\("hr-HR"/g, 'toLocaleDateString("en-GB"');
    content = content.replace(/toLocaleDateString\('hr-HR'/g, 'toLocaleDateString(\'en-GB\'');
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
    }
});
