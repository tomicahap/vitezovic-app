const fs = require('fs');
let s = fs.readFileSync('components/app-sidebar.tsx', 'utf8');

// 1. Remove ZoomIn from Mobile Top Bar
s = s.replace(/<div className="flex items-center gap-1">[\s\S]*?<Button variant="ghost" size="icon" className="shrink-0" onClick=\{toggleZoom\} title="Povećaj prikaz \(za slabovidne\)">[\s\S]*?<ZoomIn className="h-5 w-5" \/>[\s\S]*?<\/Button>([\s\S]*?)<\/div>/, '<div className="flex items-center gap-1">$1</div>');

// 2. Remove ZoomIn from Desktop User Profile and restore layout
s = s.replace(/<div className="border-t border-border p-4">[\s\S]*?<div className="flex items-center justify-between gap-3 mb-3">[\s\S]*?<div className="flex items-center gap-3 min-w-0">([\s\S]*?)<\/div>\s*<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick=\{toggleZoom\} title="Povećaj prikaz \(za slabovidne\)">\s*<ZoomIn className="h-4 w-4 text-muted-foreground" \/>\s*<\/Button>\s*<\/div>/, '<div className="border-t border-border p-4">\n        <div className="flex items-center gap-3 mb-3">$1</div>');

// 3. Add prominent ZoomIn button above Odjava
s = s.replace(/<div className="border-t border-border p-3">\s*<button \s*onClick=\{logout\}/, '<div className="border-t border-border p-3 space-y-2">\n          <button \n            onClick={toggleZoom}\n            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 shadow-sm"\n            title="Povećaj prikaz (za slabovidne)"\n          >\n            <ZoomIn className="h-4 w-4 shrink-0" />\n            POVEĆAJ PRIKAZ\n          </button>\n          <button \n            onClick={logout}');

fs.writeFileSync('components/app-sidebar.tsx', s);
