// Test script to verify your setup
// Run this with: node test-setup.js

const fs = require('fs');
const path = require('path');
const { createPublicClient, http } = require('viem');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      }
    });
  }
}

// Load environment variables
loadEnvFile();

// Monad testnet configuration
const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz/'] },
    public: { http: ['https://testnet-rpc.monad.xyz/'] },
  },
};

async function testSetup() {
  console.log('🔍 Testing your setup...\n');

  // Test 1: Check environment variables
  console.log('1. Environment Variables:');
  console.log('   NEXT_PUBLIC_PIMLICO_API_KEY:', process.env.NEXT_PUBLIC_PIMLICO_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('   NEXT_PUBLIC_PRIVY_APP_ID:', process.env.NEXT_PUBLIC_PRIVY_APP_ID ? '✅ Set' : '❌ Missing');
  console.log('');

  // Test 2: Check Monad testnet connection
  console.log('2. Monad Testnet Connection:');
  try {
    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(monadTestnet.rpcUrls.default.http[0]),
    });
    
    const blockNumber = await publicClient.getBlockNumber();
    console.log('   ✅ Connected to Monad testnet');
    console.log('   📦 Latest block:', blockNumber.toString());
  } catch (error) {
    console.log('   ❌ Failed to connect to Monad testnet:', error.message);
  }
  console.log('');

  // Test 3: Check contract address
  console.log('3. Contract Address:');
  const contractAddress = '0x00CDd1C3881047B7419498047729A21e016d95Dc';
  console.log('   Contract address:', contractAddress);
  console.log('   ⚠️  Make sure this contract is deployed to Monad testnet');
  console.log('');

  // Test 4: Check dependencies
  console.log('4. Dependencies:');
  try {
    require('permissionless');
    console.log('   ✅ permissionless installed');
  } catch (error) {
    console.log('   ❌ permissionless not installed');
  }
  
  try {
    require('viem');
    console.log('   ✅ viem installed');
  } catch (error) {
    console.log('   ❌ viem not installed');
  }
  console.log('');

  // Test 5: Check if .env.local exists
  console.log('5. Environment File:');
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    console.log('   ✅ .env.local file exists');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasPimlico = envContent.includes('NEXT_PUBLIC_PIMLICO_API_KEY');
    const hasPrivy = envContent.includes('NEXT_PUBLIC_PRIVY_APP_ID');
    console.log('   Pimlico API key in file:', hasPimlico ? '✅ Yes' : '❌ No');
    console.log('   Privy App ID in file:', hasPrivy ? '✅ Yes' : '❌ No');
  } else {
    console.log('   ❌ .env.local file not found');
  }
  console.log('');

  console.log('📋 Next Steps:');
  console.log('1. Set your environment variables in .env.local');
  console.log('2. Deploy the smart contract to Monad testnet');
  console.log('3. Update the contract address in pages/index.js');
  console.log('4. Run: npm run dev');
  console.log('5. Check browser console for detailed logs');
}

testSetup().catch(console.error); 