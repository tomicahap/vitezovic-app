const fs = require('fs');
let s = fs.readFileSync('components/app-sidebar.tsx', 'utf8');

// Fix Logo drustva
s = s.replace(/Logo drustva/g, 'Logo društva');
// Fix Administracija drustva
s = s.replace(/Administracija drustva/g, 'Administracija društva');
// Fix HRD Pavao Ritter Vitezovic<nav...
s = s.replace('HRD Pavao Ritter Vitezovic<nav className="flex-1 px-3 flex flex-col overflow-y-auto">', 'HRD Pavao Ritter Vitezović</p>\n          </div>\n        </div>\n      </div>\n\n      {/* Navigation */}\n      <nav className="flex-1 px-3 flex flex-col overflow-y-auto">');
// Fix Ac 2026 HRD Pavao Ritter Vitezovic<div...
s = s.replace(/HRD Pavao Ritter Vitezovic<div className="md:hidden/, 'HRD Pavao Ritter Vitezović\n          </div>\n        </div>\n      </div>\n    )\n\n  return (\n    <>\n      {/* Mobile Top Bar */}\n      <div className="md:hidden');
// Fix HRD Vitezovic"flex...
s = s.replace('HRD Vitezovic"flex', 'HRD Vitezović</span>\n        </div>\n        <div className="flex');

fs.writeFileSync('components/app-sidebar.tsx', s);
