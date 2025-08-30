const { ethers } = require("hardhat");

async function main() {
  // Contract addresses
  const NEW_CONTRACT_ADDRESS = "0x2a2B24C36ee4734cd657c05c0B810f7adb38fb90"; // New SimpleFrameViewer contract
  
  // Player data from the old contract
  const users = [
    "0x037b7E34779690caAa51EA122B40f4DB25C68E9c",
    "0xD0bDc32e93B56A19cF78D8844C5cB6Afb41E9fA8",
    "0xa0aa2Da226fffa949e951D6d034F620E7d814708",
    "0x34530090E0800Afb612e1F6392EBe018cD93FCDB",
    "0xCee39A6DfD69c1E0bf05F9cFBedB87F8f06D7659",
    "0xcB2eE7cD5a4b11DCac3e86C19713e08EF68F6526",
    "0x9ee5Ad92F14D62aD22F3B4b6B5De967190796078",
    "0x59248590Ac5080eFD3238fA2E4E4c4107ED3B8aE",
    "0x39cb43Fe3FddfD071F1E95f5322aEb1b1aAc8204",
    "0xf96D1919d5c9301f9dC9D0bBEfA7fcda22EBd249",
    "0x5aC5b97cdF0d59F9A9ba1d722A13BC157994fC03",
    "0xf9B148c4A33Df205e3c16595af8009f6F6404aBd",
    "0x3771EF523A4952c4b7a60E0740933301d09448a4",
    "0x11a6d39cE15476eF7038D6D15ABf701653237d6a",
    "0xc2d9fdfC0C6cA7C29A4dFa0Ff243a82aDa8c50Ae",
    "0x0bFBC2CBFd55333465F1E7B40918dE39e1007358",
    "0xDbE87f942B7B9dCb369A727FEF29518127E4bAeb",
    "0x0bb3827CD87da4a7B0bE84484eD4531a5FDdf603",
    "0x2d2c7bF3e4f1774570AA029CE36c1b60f3Fe46bF",
    "0xEba89580Ad07Da48c87168940A13c654EC3DEa30"
  ];

  const slapCounts = [
    242, 118, 33, 28, 11, 10, 9, 8, 7, 7, 6, 5, 4, 4, 2, 2, 1, 1, 1, 1
  ];

  console.log("🚀 Starting manual population of new contract...");
  console.log(`📋 Contract: ${NEW_CONTRACT_ADDRESS}`);
  console.log(`👥 Players to migrate: ${users.length}`);

  // Get the signer
  const [signer] = await ethers.getSigners();
  console.log(`🔑 Using signer: ${signer.address}`);

  // Get the contract
  const SimpleFrameViewer = await ethers.getContractFactory("SimpleFrameViewer");
  const newContract = SimpleFrameViewer.attach(NEW_CONTRACT_ADDRESS);

  // Check if we're the owner
  const owner = await newContract.owner();
  console.log(`👑 Contract owner: ${owner}`);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error("❌ You are not the owner of this contract!");
    return;
  }

  // Populate the contract with data
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const slapCount = slapCounts[i];
    
    // Use current timestamp as lastSlapTimestamp (or you can set specific timestamps if you have them)
    const lastSlapTimestamp = Math.floor(Date.now() / 1000) - (i * 60); // Spread timestamps out
    
    console.log(`📝 Migrating user ${i + 1}/${users.length}: ${user} (${slapCount} slaps)`);
    
    try {
      // Set user data
      const tx1 = await newContract.setUserData(user, slapCount, lastSlapTimestamp);
      await tx1.wait();
      console.log(`   ✅ setUserData completed`);
      
      // Add player to the list
      const tx2 = await newContract.addPlayer(user);
      await tx2.wait();
      console.log(`   ✅ addPlayer completed`);
      
    } catch (error) {
      console.error(`   ❌ Error migrating user ${user}:`, error.message);
      // Continue with next user
    }
  }

  console.log("🎉 Migration completed!");
  
  // Verify the data
  console.log("\n🔍 Verifying migration...");
  const playerCount = await newContract.getAllPlayersCount();
  console.log(`📊 Total players in new contract: ${playerCount}`);
  
  // Check a few users
  for (let i = 0; i < Math.min(5, users.length); i++) {
    const user = users[i];
    const slapCount = await newContract.getSlapCount(user);
    const lastTimestamp = await newContract.getLastSlapTimestamp(user);
    console.log(`   ${user}: ${slapCount} slaps, last slap: ${new Date(lastTimestamp * 1000).toLocaleString()}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
