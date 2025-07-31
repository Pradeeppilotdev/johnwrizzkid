# John Getting Punched - Interactive Frame Viewer

An interactive frame viewer with smart contract integration, wallet connection, and gasless transactions using Privy and Pimlico.

## Features

- 🎬 Interactive frame viewer (162 frames)
- 💰 Smart contract integration with MON token deposits
- 🔗 Wallet connection via Privy
- ⛽ Gasless transactions via Pimlico
- 🎯 Account Abstraction (ERC-4337) support

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Pimlico API Key - Get from https://console.pimlico.io/
NEXT_PUBLIC_PIMLICO_API_KEY=your_pimlico_api_key_here

# Privy App ID - Get from https://console.privy.io/
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
```

### 3. Get API Keys

#### Pimlico API Key
1. Go to [Pimlico Console](https://console.pimlico.io/)
2. Sign up/Login
3. Create a new project
4. Copy your API key
5. Add it to `.env.local`

#### Privy App ID
1. Go to [Privy Console](https://console.privy.io/)
2. Create a new app
3. Copy your App ID
4. Add it to `.env.local`

### 4. Deploy Smart Contract

Deploy the `NewFrameViewer.sol` contract to Monad testnet and update the contract address in `pages/index.js`.

### 5. Run the Application

```bash
npm run dev
```

## Troubleshooting

### Common Issues

#### 1. "UserOperation reverted during simulation with reason: 0x"

**Cause**: Gas limits are set to 0 or Pimlico API key is invalid.

**Solutions**:
- Check your Pimlico API key is correct
- Ensure you have sufficient funds in your wallet
- Check browser console for detailed error messages

#### 2. "Smart account setup failed"

**Cause**: Missing dependencies or incorrect configuration.

**Solutions**:
- Run `npm install` to install all dependencies
- Check your environment variables are set correctly
- Ensure you're connected to Monad testnet

#### 3. "Deposit failed"

**Cause**: Contract address is incorrect or contract is not deployed.

**Solutions**:
- Verify the contract address in `pages/index.js`
- Ensure the contract is deployed to Monad testnet
- Check you have MON tokens in your wallet

### Debugging Steps

1. **Check Console Logs**: Open browser dev tools and check the console for detailed error messages.

2. **Test Smart Account**: Use the "Test Smart Account" button to verify the setup.

3. **Verify Environment Variables**: Ensure your API keys are correctly set in `.env.local`.

4. **Check Network**: Make sure you're connected to Monad testnet (chain ID: 10143).

5. **Verify Contract**: Ensure your smart contract is deployed and the address is correct.

### Gas Estimation Issues

If you encounter gas estimation problems:

1. The app includes fallback gas prices for Monad testnet
2. Check that Pimlico supports Monad testnet
3. Try with smaller transaction amounts first

## Smart Contract

The `NewFrameViewer.sol` contract allows users to:
- Deposit MON tokens
- View frames (costs 0.001 MON per frame)
- Batch view multiple frames
- Withdraw deposited tokens

## Technology Stack

- **Frontend**: Next.js, React
- **Wallet**: Privy (embedded wallets)
- **Smart Account**: Pimlico (Account Abstraction)
- **Blockchain**: Monad testnet
- **Smart Contracts**: Solidity, OpenZeppelin

## Development

### Project Structure

```
├── contracts/          # Smart contracts
├── pages/             # Next.js pages
├── public/            # Static assets (frames)
├── styles/            # CSS styles
├── utils/             # Utility functions
└── package.json       # Dependencies
```

### Key Files

- `pages/index.js` - Main application
- `utils/pimlico.js` - Pimlico smart account setup
- `utils/chains.js` - Chain configuration
- `contracts/NewFrameViewer.sol` - Smart contract

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify all environment variables are set
3. Ensure you have MON tokens in your wallet
4. Check that the smart contract is deployed correctly

## License

ISC 