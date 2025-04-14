const ethers = require('ethers');
const prompt = require('prompt-sync')({ sigint: true });
const schedule = require('node-schedule');

// Mapping of Chain IDs to native token symbols (extend as needed)
const chainIdToNativeToken = {
  1: { symbol: 'ETH', decimals: 18 }, // Ethereum Mainnet
  11155111: { symbol: 'ETH', decimals: 18 }, // Sepolia
  10218: { symbol: 'TEA', decimals: 18 }, // Tea Sepolia
  137: { symbol: 'MATIC', decimals: 18 }, // Polygon
  56: { symbol: 'BNB', decimals: 18 }, // BSC
  // Add more chains as needed
};

// Function to get random number in range
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to validate Ethereum address
function isValidAddress(address) {
  return ethers.utils.isAddress(address);
}

// Function to validate private key
function isValidPrivateKey(privateKey) {
  try {
    new ethers.Wallet(privateKey);
    return true;
  } catch {
    return false;
  }
}

// Function to format native token balance
function formatNativeToken(wei, symbol = 'Native Token', decimals = 18) {
  return `${ethers.utils.formatUnits(wei, decimals)} ${symbol}`;
}

// Function to send transactions (used for immediate and scheduled runs)
async function executeTransactions(wallet, provider, walletAddresses, nativeToken) {
  console.log(`Starting transactions at ${new Date().toUTCString()}`);

  // Determine number of transactions (100-122)
  const numTxs = getRandomInt(100, 122);
  console.log(`Planning to send ${numTxs} transactions...`);

  for (let i = 1; i <= numTxs; i++) {
    // Select random recipient from provided addresses
    const recipient = walletAddresses[getRandomInt(0, walletAddresses.length - 1)];
    console.log(`Transaction ${i}: Sending 0.001 ${nativeToken.symbol} to ${recipient}`);

    // Prepare transaction
    const tx = {
      to: recipient,
      value: ethers.utils.parseEther('0.001'), // Sending 0.001 of native token
    };

    let success = false;
    let retryCount = 0;
    const maxRetries = 3;

    while (!success && retryCount < maxRetries) {
      try {
        // Fetch dynamic gas price
        const gasPrice = await provider.getGasPrice();
        tx.gasPrice = gasPrice;

        // Estimate gas limit dynamically
        const gasLimit = await provider.estimateGas({
          ...tx,
          from: wallet.address,
        });
        tx.gasLimit = gasLimit;

        console.log(`TX ${i} - Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei, Gas Limit: ${gasLimit}`);

        // Send transaction
        const txResponse = await wallet.sendTransaction(tx);
        console.log(`TX ${i} Hash: ${txResponse.hash}`);

        // Wait for transaction confirmation
        const receipt = await txResponse.wait();
        console.log(`TX ${i} Confirmed: Block ${receipt.blockNumber}`);
        success = true;
      } catch (error) {
        retryCount++;
        console.error(`TX ${i} Failed (Attempt ${retryCount}/${maxRetries}):`, error.message);
        if (retryCount < maxRetries) {
          console.log(`Retrying TX ${i} after 5 seconds...`);
          await delay(5000);
        } else {
          console.error(`TX ${i} Failed after ${maxRetries} attempts. Moving to next transaction.`);
        }
      }
    }

    // Random delay between 2-5 seconds
    const delayMs = getRandomInt(2000, 5000);
    console.log(`Waiting ${delayMs / 1000} seconds before next transaction...`);
    await delay(delayMs);
  }

  console.log('Transactions completed.');
}

// Main function to handle transactions
async function sendTransactions() {
  console.log('Starting transaction script...');

  // Prompt user for inputs
  const privateKey = prompt('Enter your private key: ');
  if (!isValidPrivateKey(privateKey)) {
    console.error('Invalid private key provided.');
    return;
  }

  const walletAddresses = [];
  for (let i = 1; i <= 5; i++) {
    const address = prompt(`Enter wallet address ${i}: `);
    if (!isValidAddress(address)) {
      console.error(`Invalid wallet address ${i} provided.`);
      return;
    }
    walletAddresses.push(address);
  }

  const rpcUrl = prompt('Enter the chain RPC URL: ');
  if (!rpcUrl.startsWith('http')) {
    console.error('Invalid RPC URL provided.');
    return;
  }

  // Initialize provider and wallet
  let provider, wallet;
  try {
    provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    wallet = new ethers.Wallet(privateKey, provider);
  } catch (error) {
    console.error('Failed to connect to RPC:', error.message);
    return;
  }

  // Derive and display wallet details
  const senderAddress = wallet.address;
  console.log('Sender Wallet Address:', senderAddress);

  let balance, network, nativeToken;
  try {
    balance = await provider.getBalance(senderAddress);
    network = await provider.getNetwork();
    // Determine native token symbol and decimals
    nativeToken = chainIdToNativeToken[network.chainId] || { symbol: 'Native Token', decimals: 18 };
    console.log(`Network: ${network.name || 'Unknown'} (Chain ID: ${network.chainId})`);
    console.log('Balance:', formatNativeToken(balance, nativeToken.symbol, nativeToken.decimals));
  } catch (error) {
    console.error('Failed to fetch wallet details:', error.message);
    return;
  }

  // Run transactions immediately for today
  console.log('Executing transactions for today...');
  await executeTransactions(wallet, provider, walletAddresses, nativeToken);

  // Schedule transactions for subsequent days at 00:00 UTC
  const job = schedule.scheduleJob('0 0 * * *', async () => {
    console.log(`Scheduled transactions starting at ${new Date().toUTCString()}`);
    await executeTransactions(wallet, provider, walletAddresses, nativeToken);
  });

  console.log('Transaction scheduler started for future days at 00:00 UTC.');
}

// Run the script
sendTransactions().catch(error => {
  console.error('Script failed:', error.message);
});
