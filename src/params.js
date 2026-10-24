// URL parameters: developer switches and the test mode (README.md, docs/DEVELOPMENT.md)

export const Q = new URLSearchParams(location.search);
export const TEST = Q.has('test');
export const DEBUG = Q.has('debug') || TEST;
export const VIEW = parseInt(Q.get('view') || '0', 10);
export const DBG_MODE = parseInt(Q.get('dbg') || '0', 10);
export const TONEMAP = parseInt(Q.get('tm') || '1', 10);
export const CONTRAST = Q.has('con') ? parseFloat(Q.get('con')) : 1.0;
export const HAZE_K = Q.has('haze') ? parseFloat(Q.get('haze')) : 2.8e-5;
