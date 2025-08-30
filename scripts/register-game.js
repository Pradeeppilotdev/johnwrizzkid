const { createPublicClient, http, encodeFunctionData } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { monadTestnet } = require('../utils/chains');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const MONAD_GAMES_ID_CONTRACT = '0xceCBFF203C8B6044F52CE23D914A1bfD997541A4';
const GAME_SUBMITTER_ADDRESS = '0xF3b0A442334894FdDD62FCf61859f07D04029803';
const SERVER_SUBMITTER_PRIVATE_KEY = process.env.SERVER_SUBMITTER_PRIVATE_KEY;

async function registerGame() {
  if (!SERVER_SUBMITTER_PRIVATE_KEY) {
    console.error('❌ SERVER_SUBMITTER_PRIVATE_KEY not found in .env.local');
    console.log('Please add your private key (without 0x) to .env.local');
    return;
  }

  try {
    // Create public client
    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http('https://testnet-rpc.monad.xyz/'),
    });

    // Create account from private key
    const account = privateKeyToAccount(SERVER_SUBMITTER_PRIVATE_KEY);
    console.log('🔑 Using account:', account.address);

    // Check if this matches the game submitter address
    if (account.address.toLowerCase() !== GAME_SUBMITTER_ADDRESS.toLowerCase()) {
      console.error('❌ Private key does not match GAME_SUBMITTER_ADDRESS');
      console.log('Expected:', GAME_SUBMITTER_ADDRESS);
      console.log('Got:', account.address);
      return;
    }

    // Encode the registerGame function call
    const registerData = encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: '_game', type: 'address' },
            { name: '_name', type: 'string' },
            { name: '_image', type: 'string' },
            { name: '_url', type: 'string' }
          ],
          name: 'registerGame',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'registerGame',
      args: [
        GAME_SUBMITTER_ADDRESS, // Game address that will submit scores
        'John Getting Punched', // Game name
        'https://your-game-icon.png', // Game icon (placeholder)
        'https://your-game-url.com' // Game URL (placeholder)
      ]
    });

    console.log('📝 Registering game with data:', registerData);
    console.log('🎮 Game Name: John Getting Punched');
    console.log('🏗️ Game Address:', GAME_SUBMITTER_ADDRESS);
    console.log('📋 Contract:', MONAD_GAMES_ID_CONTRACT);

    // Get current gas price
    const gasPrice = await publicClient.getGasPrice();
    console.log('⛽ Current gas price:', (Number(gasPrice) / 1e9).toFixed(2), 'gwei');

    // Estimate gas
    const estimatedGas = await publicClient.estimateGas({
      account: account.address,
      to: MONAD_GAMES_ID_CONTRACT,
      data: registerData,
    });
    console.log('⛽ Estimated gas:', Number(estimatedGas));

    // Get nonce
    const nonce = await publicClient.getTransactionCount({
      address: account.address,
    });
    console.log('🔢 Nonce:', nonce);

    console.log('\n✅ Game registration data prepared successfully!');
    console.log('📋 To register manually:');
    console.log('1. Go to: https://testnet.monadexplorer.com/address/0xceCBFF203C8B6044F52CE23D914A1bfD997541A4');
    console.log('2. Click "Contract" tab');
    console.log('3. Click "Write Contract"');
    console.log('4. Connect wallet:', account.address);
    console.log('5. Call registerGame with:');
    console.log('   - _game:', GAME_SUBMITTER_ADDRESS);
    console.log('   - _name: John Getting Punched');
    console.log('   - _image: https://your-game-icon.png');
    console.log('   - _url: https://your-game-url.com');

  } catch (error) {
    console.error('❌ Error preparing game registration:', error);
  }
}

// Run the registration
registerGame();
