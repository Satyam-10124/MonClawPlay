const hre = require("hardhat");

async function main() {
  console.log("Deploying DebateArena to Monad testnet...");

  const DebateArena = await hre.ethers.getContractFactory("DebateArena");
  const arena = await DebateArena.deploy();
  await arena.waitForDeployment();

  const address = await arena.getAddress();
  console.log(`DebateArena deployed to: ${address}`);
  console.log(`\nAdd this to your .env file:`);
  console.log(`DEBATE_ARENA_ADDRESS=${address}`);
  console.log(`\nView on Monad explorer:`);
  console.log(`https://testnet.monadscan.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
