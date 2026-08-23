const { parentPort, workerData } = require('node:worker_threads');
const decode = require('heic-decode');

void (async () => {
  const decoded = await decode({ buffer: workerData });
  parentPort.postMessage(
    {
      width: decoded.width,
      height: decoded.height,
      data: decoded.data.buffer,
    },
    [decoded.data.buffer],
  );
})();
