declare module 'react' { const R: any; export = R; }
declare namespace JSX {
  interface IntrinsicElements { [elem: string]: any; }
}
declare module 'react/jsx-runtime' { export const jsx: any; export const jsxs: any; export const Fragment: any; }
declare module 'react-dom/*' { const X: any; export = X; }
declare module 'zod' { export const z: any; const d: any; export default d; }
declare module 'dompurify' { const D: any; export default D; }
declare module 'isomorphic-dompurify' { const D: any; export default D; }
