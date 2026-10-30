import {build} from 'vite';
import {createPreviewServer} from '../../scripts/serve-dist.mjs';

export default async function globalSetup() {
  await build({configLoader:'native'});
  const server=createPreviewServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4173,'127.0.0.1',resolve);});
  // Owning the server in-process avoids Windows process-tree termination and
  // guarantees that the test command exits when the test suite is finished.
  return async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));};
}
