import { assertEnv, env } from './config/env.js';
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
import { connectDB } from './config/database.js';
import { createApp } from './app.js';
import Product from './models/Product.js';


async function main() {
  
  assertEnv();
  await connectDB();
  await Product.init(); // ensure unique barcode index exists
  const app = createApp();
  app.listen(env.port || 4000 , () => console.log(`Wearora API running on http://localhost:${env.port} (${env.nodeEnv})`));
}
main().catch((e) => { console.error('Failed to start server:', e.message); process.exit(1); });
