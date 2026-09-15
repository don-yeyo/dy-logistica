const serverless = require('serverless-http');
const app = require('../../server/app');

// Handler Serverless de Netlify Functions
module.exports.handler = serverless(app, {
  binary: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/octet-stream']
});
