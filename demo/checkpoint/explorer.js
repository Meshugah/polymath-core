
const duration = {
    seconds: function (val) { return val; },
    minutes: function (val) { return val * this.seconds(60); },
    hours: function (val) { return val * this.minutes(60); },
    days: function (val) { return val * this.hours(24); },
    weeks: function (val) { return val * this.days(7); },
    years: function (val) { return val * this.days(365); },
  };
var readlineSync = require('readline-sync');
var BigNumber = require('bignumber.js')

var contracts = require("../helpers/contract_addresses");
let tickerRegistryAddress = contracts.tickerRegistryAddress();
let securityTokenRegistryAddress = contracts.securityTokenRegistryAddress();
let cappedSTOFactoryAddress = contracts.cappedSTOFactoryAddress();
let etherDividendCheckpointFactoryAddress = contracts.etherDividendCheckpointFactoryAddress();

let tickerRegistryABI;
let securityTokenRegistryABI;
let securityTokenABI;
let cappedSTOABI;
let generalTransferManagerABI;
try{
  tickerRegistryABI           = JSON.parse(require('fs').readFileSync('./build/contracts/TickerRegistry.json').toString()).abi;
  securityTokenRegistryABI    = JSON.parse(require('fs').readFileSync('./build/contracts/SecurityTokenRegistry.json').toString()).abi;
  securityTokenABI            = JSON.parse(require('fs').readFileSync('./build/contracts/SecurityToken.json').toString()).abi;
  cappedSTOABI                = JSON.parse(require('fs').readFileSync('./build/contracts/CappedSTO.json').toString()).abi;
  generalTransferManagerABI   = JSON.parse(require('fs').readFileSync('./build/contracts/GeneralTransferManager.json').toString()).abi;
  etherDividendCheckpointABI  = JSON.parse(require('fs').readFileSync('./build/contracts/EtherDividendCheckpoint.json').toString()).abi;
}catch(err){
  console.log('\x1b[31m%s\x1b[0m',"Couldn't find contracts' artifacts. Make sure you ran truffle compile first");
  return;
}



const Web3 = require('web3');

if (typeof web3 !== 'undefined') {
  web3 = new Web3(web3.currentProvider);
} else {
  // set the provider you want from Web3.providers
  web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
}

let tokenSymbol;
let securityToken;

async function executeApp() {

  accounts = await web3.eth.getAccounts();
  Issuer = accounts[0];

  setup();

};

async function setup(){
  try {
    tickerRegistry = new web3.eth.Contract(tickerRegistryABI,tickerRegistryAddress);
    tickerRegistry.setProvider(web3.currentProvider);
    securityTokenRegistry = new web3.eth.Contract(securityTokenRegistryABI,securityTokenRegistryAddress);
    securityTokenRegistry.setProvider(web3.currentProvider);
  }catch(err){
    console.log(err)
    console.log('\x1b[31m%s\x1b[0m',"There was a problem getting the contracts. Make sure they are deployed to the selected network.");
    return;
  }

  start_explorer();

}

async function start_explorer(){

  let tokenDeployed = false;
  let tokenDeployedAddress;
  if(!tokenSymbol){
    tokenSymbol =  readlineSync.question('Enter the token symbol: ');
    // Let's check if token has already been deployed, if it has, skip to STO
    await securityTokenRegistry.methods.getSecurityTokenAddress(tokenSymbol).call({from: Issuer}, function(error, result){
      if(result != "0x0000000000000000000000000000000000000000"){
        securityToken = new web3.eth.Contract(securityTokenABI,result);
      }
    });
  }

  let checkpointNum = await securityToken.methods.currentCheckpointId().call({ from: Issuer });
  console.log("Token is at checkpoint:",checkpointNum);

  // Get the GTM
  await securityToken.methods.getModule(2, 0).call({ from: Issuer }, function (error, result) {
    generalTransferManagerAddress = result[1];
  });
  generalTransferManager = new web3.eth.Contract(generalTransferManagerABI, generalTransferManagerAddress);
  generalTransferManager.setProvider(web3.currentProvider);

  await securityToken.methods.getModule(4, 0).call({ from: Issuer }, function (error, result) {
    etherDividendCheckpointAddress = result[1];
    console.log("Dividends module address is:",etherDividendCheckpointAddress);
    if(etherDividendCheckpointAddress != "0x0000000000000000000000000000000000000000"){
      etherDividendCheckpoint = new web3.eth.Contract(etherDividendCheckpointABI, etherDividendCheckpointAddress);
      etherDividendCheckpoint.setProvider(web3.currentProvider);
    }
  });

  let options = ['Mint tokens','Transfer tokens',
   'Explore account at checkpoint', 'Explore total supply at checkpoint',
   'Create checkpoint', 'Calculate Dividends', 'Push dividends to account', 'Explore ETH balance'];
  let index = readlineSync.keyInSelect(options, 'What do you want to do?');
  console.log("Selected:",options[index]);
  switch(index){
    case 0:
      let _to =  readlineSync.question('Enter beneficiary of minting: ');
      let _amount =  readlineSync.question('Enter amount of tokens to mint: ');
      await mintTokens(_to,_amount);
    break;
    case 1:
      let _to2 =  readlineSync.question('Enter beneficiary of tranfer: ');
      let _amount2 =  readlineSync.question('Enter amount of tokens to transfer: ');
      await transferTokens(_to2,_amount2);
    break;
    case 2:
      let _address =  readlineSync.question('Enter address to explore: ');
      let _checkpoint =  readlineSync.question('At checkpoint: ');
      await exploreAddress(_address,_checkpoint);
    break;
    case 3:
      let _checkpoint2 =  readlineSync.question('Explore total supply at checkpoint: ');
      await exploreTotalSupply(_checkpoint2);
    break;
    case 4:
      //Create new checkpoint
      await securityToken.methods.createCheckpoint().send({ from: Issuer});
    break;
    case 5:
      //Create dividends
      let ethDividend =  readlineSync.question('How much eth would you like to distribute to token holders?: ');
      await createDividends(ethDividend);
    break;
    case 6:
      //Create dividends
      let _checkpoint3 =  readlineSync.question('Distribute dividends at checkpoint: ');
      let _address2 =  readlineSync.question('Enter address to push dividends to: ');
      await pushDividends(_checkpoint3,_address2);
    break;
    case 7:
      //explore eth balance
      let _checkpoint4 = readlineSync.question('Enter checkpoint to explore: ');
      let _address3 =  readlineSync.question('Enter address to explore: ');
      let divsAtCheckpoint = await etherDividendCheckpoint.methods.calculateDividend(_checkpoint4,_address3).call({ from: Issuer});
      console.log(`
         ETH Balance: ${web3.utils.fromWei(await web3.eth.getBalance(_address3),"ether")} ETH
         Dividends owed at checkpoint ${_checkpoint4}: ${web3.utils.fromWei(divsAtCheckpoint,"ether")} ETH
      `)
    break;
  }

  //Restart
  start_explorer();

}

async function createDividends(ethDividend){
  // Get the Dividends module
  await securityToken.methods.getModule(4, 0).call({ from: Issuer }, function (error, result) {
    etherDividendCheckpointAddress = result[1];
  });
  if(etherDividendCheckpointAddress != "0x0000000000000000000000000000000000000000"){
    etherDividendCheckpoint = new web3.eth.Contract(etherDividendCheckpointABI, etherDividendCheckpointAddress);
    etherDividendCheckpoint.setProvider(web3.currentProvider);
  }else{
    await securityToken.methods.addModule(etherDividendCheckpointFactoryAddress, web3.utils.fromAscii('', 16), 0, 0, false).send({ from: Issuer, gas:2500000 })
    .on('transactionHash', function(hash){
      console.log(`
        Your transaction is being processed. Please wait...
        TxHash: ${hash}\n`
      );
    })
    .on('receipt', function(receipt){
      console.log(`
        Congratulations! The transaction was successfully completed.
        Module deployed at address: ${receipt.events.LogModuleAdded.returnValues._module}
        Review it on Etherscan.
        TxHash: ${receipt.transactionHash}\n`
      );

      etherDividendCheckpoint = new web3.eth.Contract(etherDividendCheckpointABI, receipt.events.LogModuleAdded.returnValues._module);
      etherDividendCheckpoint.setProvider(web3.currentProvider);
    })
    .on('error', console.error);
  }

  let time = (await web3.eth.getBlock('latest')).timestamp;

  //Send eth dividends
  await etherDividendCheckpoint.methods.createDividend(time,time + duration.days(1000))
  .send({ from: Issuer, value: web3.utils.toWei(ethDividend,"ether"), gas:2500000 })
  .on('transactionHash', function(hash){
    console.log(`
      Your transaction is being processed. Please wait...
      TxHash: ${hash}\n`
    );
  })
  .on('receipt', function(receipt){
    console.log(`
      ${receipt.events}
      TxHash: ${receipt.transactionHash}\n`
    );
  })
}

async function pushDividends(checkpoint,account){
  let accs = new Array(account);
  await etherDividendCheckpoint.methods.pushDividendPaymentToAddresses(checkpoint,accs)
  .send({ from: Issuer, gas:4500000 })
  .on('transactionHash', function(hash){
    console.log(`
      Your transaction is being processed. Please wait...
      TxHash: ${hash}\n`
    );
  })
  .on('receipt', function(receipt){
    console.log(`
      ${receipt.events}
      TxHash: ${receipt.transactionHash}\n`
    );
  })

}

async function exploreAddress(address, checkpoint){
  let balance = await securityToken.methods.balanceOf(address).call({from: Issuer});
  balance = web3.utils.fromWei(balance,"ether");
  console.log("Balance of",address,"is:",balance,"(Using balanceOf)");

  let balanceAt = await securityToken.methods.balanceOfAt(address,checkpoint).call({from: Issuer});
  balanceAt = web3.utils.fromWei(balanceAt,"ether");
  console.log("Balance of",address,"is:",balanceAt,"(Using balanceOfAt - checkpoint",checkpoint,")");
}

async function exploreTotalSupply(checkpoint){
  let totalSupply = await securityToken.methods.totalSupply().call({from: Issuer});
  totalSupply = web3.utils.fromWei(totalSupply,"ether");
  console.log("TotalSupply is:",totalSupply,"(Using totalSupply)");

  let totalSupplyAt = await securityToken.methods.totalSupplyAt(checkpoint).call({from: Issuer});
  totalSupplyAt = web3.utils.fromWei(totalSupplyAt,"ether");
  console.log("totalSupply is:",totalSupplyAt,"(Using totalSupplyAt - checkpoint",checkpoint,")");
}


async function transferTokens(address, amount){

  let whitelistTransaction = await generalTransferManager.methods.modifyWhitelist(address,Math.floor(Date.now()/1000),Math.floor(Date.now()/1000),Math.floor(Date.now()/1000 + 31536000)).send({ from: Issuer, gas:2500000});

  try{
    await securityToken.methods.transfer(address,web3.utils.toWei(amount,"ether")).send({ from: Issuer, gas:250000})
    .on('transactionHash', function(hash){
      console.log(`
        Your transaction is being processed. Please wait...
        TxHash: ${hash}\n`
      );
    })
    .on('receipt', function(receipt){
      console.log(`
        Congratulations! The transaction was successfully completed.

        Account ${receipt.events.Transfer.returnValues.from}
        transfered ${web3.utils.fromWei(receipt.events.Transfer.returnValues.value,"ether")} tokens
        to account ${receipt.events.Transfer.returnValues.to}

        Review it on Etherscan.
        TxHash: ${receipt.transactionHash}\n`
      );
    });

  }catch (err){
    console.log(err);
    console.log("There was an error processing the transfer transaction. \n The most probable cause for this error is one of the involved accounts not being in the whitelist or under a lockup period.")
    return;
  }
}

async function mintTokens(address, amount){

  let whitelistTransaction = await generalTransferManager.methods.modifyWhitelist(address,Math.floor(Date.now()/1000),Math.floor(Date.now()/1000),Math.floor(Date.now()/1000 + 31536000),false).send({ from: Issuer, gas:2500000});

  try{
    await securityToken.methods.mint(address,web3.utils.toWei(amount,"ether")).send({ from: Issuer, gas:250000})
    .on('transactionHash', function(hash){
      console.log(`
        Your transaction is being processed. Please wait...
        TxHash: ${hash}\n`
      );
    })
    .on('receipt', function(receipt){
      console.log(`
        Congratulations! The transaction was successfully completed.

        Minted ${web3.utils.fromWei(receipt.events.Transfer.returnValues.value,"ether")} tokens
        to account ${receipt.events.Transfer.returnValues.to}

        Review it on Etherscan.
        TxHash: ${receipt.transactionHash}\n`
      );
    });

  }catch (err){
    console.log(err);
    console.log("There was an error processing the transfer transaction. \n The most probable cause for this error is one of the involved accounts not being in the whitelist or under a lockup period.")
    return;
  }
}

executeApp();
