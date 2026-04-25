const fs = require('fs');
const solc = require('solc');
const { Web3 } = require('web3');

// Connect to Ganache
const web3 = new Web3('http://127.0.0.1:7545');

async function deploy() {
  try {
    // Check if ganache is reachable
    const isListening = await web3.eth.net.isListening();
    if (!isListening) {
      console.error("Cannot connect to Ganache at http://127.0.0.1:7545");
      return;
    }

    const content = fs.readFileSync('contracts/ThreatLog.sol', 'utf8');

    const input = {
      language: 'Solidity',
      sources: {
        'ThreatLog.sol': {
          content: content
        }
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['*']
          }
        }
      }
    };

    console.log("Compiling contract...");
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    if (output.errors) {
      output.errors.forEach(err => console.error(err.formattedMessage));
      if (output.errors.some(e => e.severity === 'error')) return;
    }

    const contract = output.contracts['ThreatLog.sol']['ThreatLog'];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    const accounts = await web3.eth.getAccounts();
    console.log('Deploying from account:', accounts[0]);

    const deployTx = new web3.eth.Contract(abi).deploy({ data: '0x' + bytecode });
    
    // Estimate gas
    const gas = await deployTx.estimateGas({from: accounts[0]});
    
    const deployedContract = await deployTx.send({
      from: accounts[0],
      gas: gas
    });

    console.log('Contract deployed at:', deployedContract.options.address);
    
    // Update blockchain.js with new address
    let blockchainJs = fs.readFileSync('src/services/blockchain.js', 'utf8');
    blockchainJs = blockchainJs.replace(
      /const CONTRACT_ADDRESS = '.*';/,
      `const CONTRACT_ADDRESS = '${deployedContract.options.address}';`
    );
    fs.writeFileSync('src/services/blockchain.js', blockchainJs);
    console.log('Updated src/services/blockchain.js with new contract address.');

  } catch (err) {
    console.error("Error during deployment:", err);
  }
}

deploy();
