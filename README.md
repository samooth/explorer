# Explorer JS Wrapper library for Bitcoin SV



## Documentation


This library helps manage the following APIs:

[Taal](https://docs.taal.com/core-products/whatsonchain)

[Bitails](https://docs.bitails.io/)


#### Methods

  status()

  chainInfo()

  blockHash()

  blockHeight()

  blockList ( height, limit )

  blockLatest ( hash )

  blockTransactions ( hash )

  txHash ( hash )

  downloadTx ( hash )
  
  downloadTxOut ( hash, index )

  broadcast( txhex )

  broadcastBinary ( txBuf)

  getOutputData ( hash, outputIndex )

  getOutputsData ( hash, fromIndex, toIndex ) 

  merkleProof ( hash )

  mempoolInfo ()

  mempoolTxs ()

  addressInfo ( address )

  balance ( address )

  history ( address )

  utxos ( address )

  detailScriptHash ( scriptHash )

  balanceScriptHash ( scriptHash )

  historyByScriptHash ( scriptHash )

  utxosByScriptHash ( scriptHash )

  search ( text )

## Install

---

```javascript
npm install git+https://github.com/samooth/explorer
```

## Sample Usage

```javascript
const Explorer = require('../src/index.js')

let woc = new Explorer("main", { api: "woc" });
woc.status().then((status) => console.log("woc status:", status))

woc.blockLatest(10)
.then((blk)=>console.log("woc latest:",blk))

woc.blockList("000000000000000005bf29a3bff05d1cbf120d052bdbea6d6b8643eefd44be83")
.then((blk)=>console.log("woc blk list:",blk))


let bitails = new Explorer("main", { api: "bitails" });
woc.status().then((status) => console.log("woc status:", status))




```

## History

### 0.2.0
- Support Cache, default is true. if you don't want cache, set option `{ enableCache: false }`
- Support ApiKey and rate limit to 3 requests/sec without apiKey.
```
  // with apiKey
  const explorer = new Bitails( 'testnet', { apiKey: 'your api key'}  )
```
```
  // without apiKey
  const explorer = new Bitails( 'testnet' )
```
- Support JSDoc type check.

### 0.1.0
- Initate, Support all API in document.

# License

It is released under the terms of the Open BSV license.
