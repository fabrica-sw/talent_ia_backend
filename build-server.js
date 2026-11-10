import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  outfile: 'dist/server.cjs'
});

console.log("¡Compilación de backend server.ts completada con éxito en dist/server.cjs!");

