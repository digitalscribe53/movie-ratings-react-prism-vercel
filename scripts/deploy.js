// scripts/deploy.js
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('Deploying Prisma schema...');
    
    // Run prisma generate
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Deploy migrations
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    console.log('Deployment completed successfully!');
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

main();