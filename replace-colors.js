const fs = require('fs');
const path = require('path');

const colorMap = {
  // Backgrounds
  'bg-white': 'bg-slate-950',
  'bg-slate-50': 'bg-slate-900',
  'bg-slate-100': 'bg-slate-800',
  'bg-slate-200': 'bg-slate-700',
  
  // Text
  'text-slate-900': 'text-slate-50',
  'text-slate-800': 'text-slate-200',
  'text-slate-700': 'text-slate-300',
  'text-slate-600': 'text-slate-400',
  'text-slate-500': 'text-slate-400',
  'text-slate-400': 'text-slate-500',
  'text-slate-300': 'text-slate-600',
  
  // Borders
  'border-slate-100': 'border-slate-800',
  'border-slate-200': 'border-slate-700',
  'border-slate-300': 'border-slate-600',
  
  // Hover Backgrounds
  'hover:bg-slate-50': 'hover:bg-slate-800',
  'hover:bg-slate-100': 'hover:bg-slate-700',
  'hover:bg-slate-200': 'hover:bg-slate-600',
  
  // Accents (Indigo)
  'bg-indigo-50': 'bg-indigo-900/40',
  'bg-indigo-100': 'bg-indigo-800/60',
  'bg-indigo-600': 'bg-indigo-500',
  'bg-indigo-700': 'bg-indigo-400',
  'text-indigo-500': 'text-indigo-400',
  'text-indigo-600': 'text-indigo-400',
  'text-indigo-700': 'text-indigo-300',
  'border-indigo-200': 'border-indigo-800',
  'border-indigo-300': 'border-indigo-700',
  'hover:bg-indigo-50': 'hover:bg-indigo-900/40',
  'hover:bg-indigo-100': 'hover:bg-indigo-800/60',
  'hover:bg-indigo-700': 'hover:bg-indigo-600',
  'hover:border-indigo-300': 'hover:border-indigo-700',
  'ring-indigo-100': 'ring-indigo-900',
  'ring-indigo-200': 'ring-indigo-800',
  'ring-indigo-300': 'ring-indigo-700',
  'ring-indigo-400': 'ring-indigo-500',

  // Accents (Red)
  'bg-red-50': 'bg-red-900/40',
  'text-red-500': 'text-red-400',
  'text-red-700': 'text-red-300',
  'border-red-200': 'border-red-800',
  'border-red-300': 'border-red-700',
  'hover:bg-red-50': 'hover:bg-red-900/40',
  
  // Accents (Teal)
  'bg-teal-50': 'bg-teal-900/40',
  'text-teal-500': 'text-teal-400',
  'border-teal-200': 'border-teal-800',
  'hover:bg-teal-50': 'hover:bg-teal-900/40',
  
  // Accents (Yellow)
  'bg-yellow-50': 'bg-yellow-900/40',
  'text-yellow-600': 'text-yellow-400',
  'border-yellow-200': 'border-yellow-800',
  'border-yellow-300': 'border-yellow-700',
  'hover:bg-yellow-50': 'hover:bg-yellow-900/40',
  
  // Accents (Emerald)
  'bg-emerald-50': 'bg-emerald-900/40',
  'text-emerald-600': 'text-emerald-400',
};

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walkDir(path.join(__dirname, 'src'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // We need to match whole words to avoid partial replacements.
  // Using word boundaries or splitting by classes in className strings is safer.
  // A simple regex word boundary is fine for tailwind classes.
  for (const [light, dark] of Object.entries(colorMap)) {
    // Escape special characters in class names like ":" and "/"
    const escapedLight = light.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?<![a-zA-Z0-9-])` + escapedLight + `(?![a-zA-Z0-9-])`, 'g');
    content = content.replace(regex, dark);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
