const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrdashboardreels87e0b = onRequest({"region":"asia-southeast1","timeoutSeconds":540,"memory":"1GiB","maxInstances":3}, (req, res) => server.then(it => it.handle(req, res)));
  