# Explorer JS Wrapper library for Bitcoin SV



## Documentation




## Install

---

```javascript
npm install git+https://github.com/samooth/explorer
```

## Sample Usage



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
