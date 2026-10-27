import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/room-info-card.ts',
  output: { file: 'dist/room-info-card.js', format: 'es', inlineDynamicImports: true },
  plugins: [
    nodeResolve(),
    typescript({ tsconfig: './tsconfig.json', include: ['src/**/*.ts'], noEmit: false, declaration: false, types: [] }),
    terser({ format: { comments: false } }),
  ],
};
