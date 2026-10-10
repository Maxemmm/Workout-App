// Metro — .sql pour les migrations Drizzle, .wasm + en-têtes COOP/COEP pour expo-sqlite sur le web
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql');
config.resolver.assetExts.push('wasm');
// Illustrations d'exercices : SVG embarqués comme fichiers (lus à la demande, pas dans le bundle JS)
config.resolver.assetExts.push('svg');

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
