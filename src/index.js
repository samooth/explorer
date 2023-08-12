const { Tx, TxOut, TxIn, Script, Br, deps } = require("bsv2");
const Buffer = deps.Buffer;

const { cacheAdapterEnhancer, throttleAdapterEnhancer } = require('axios-extensions')

const axios = require("axios");

const FormData = require("form-data");
const Blob = require("node-blob");

let endpoints = {

    bitails: {
        main: "https://api.bitails.io/",
        test: "https://test-api.bitails.io/",
        headerKey: 'bitails-api-key'
    },
    bsvdirect: {
        main: "https://explora.bsv.direct/rest/",
        test: "https://explora.bsv.direct/testrest/",
        headerKey: 'bsv.direct-api-key'

    },
    electrumx: {
        main: "https://api.bsv.direct/e5/",
        test: "https://api.bsv.direct/test/e5/",
        headerKey: 'bsv.direct-api-key'

    },
    woc: {
        main: "https://api.whatsonchain.com/v1/bsv/main/",
        test: "https://api.whatsonchain.com/v1/bsv/test/",
        headerKey: 'woc-api-key'

    }
}

let ordinalEndpoints = {
    gorillapool: {
        main: "https://ordinals.gorillapool.io/api/",
        test: ""

    },
    bsvdirect: {
        main: "",
        test: ""
    }
}

class Explorer {
    /**
     * Explorer API Wrapper
     * @param {string} network Selected network: main , test or TODO:stn
     * @param {object} opts timeout, userAgent, apiKey and enableCache
     */
    constructor(network = 'main', opts = {}) {
        this._buffer = Buffer
        this._endpoints = endpoints
        this._network = (network === 'main' || network === 'mainnet' || network === 'livenet') ? 'main' : (network === 'test' || network === 'testnet') ? 'test' : 'stn'
        this._timeout = opts.timeout || 30000
        this._userAgent = opts.userAgent | opts._userAgent
        this._api = (opts.api !== undefined) ? this._endpoints[opts.api] : this._endpoints["bitails"]
        this._apiKey = opts.apiKey || undefined
        this._enableCache = (opts.cache === undefined) ? true : !!opts.cache
        this._url = opts.url ? opts.url : this._api[this._network]
        this._init()
    }

    _init() {


        // enhance the original axios adapter with throttle and cache enhancer 
        const headers = {
            'Cache-Control': 'no-cache'
        }
        const throttleOpt = {}
        const cacheOpt = {
            enabledByDefault: this._enableCache
        }

        if (this._userAgent) {
            headers['User-Agent'] = this._userAgent
        }

        if (this._apiKey) {
            headers[this._api["headerKey"]] = this._apiKey
            throttleOpt['threshold'] = 0
        } else {
            //Up to 3 requests/sec.
            // #rate-limits
            throttleOpt['threshold'] = 2000
        }
        this._httpClient = axios.create({
            baseURL: `${this._url}`,
            timeout: this._timeout,
            headers,
            adapter: throttleAdapterEnhancer(cacheAdapterEnhancer(axios.defaults.adapter, cacheOpt), throttleOpt)
        })


        return this
    }

    _parseResponse(response, options) {
        return response.data
    }

    _parseError(error) {
        if (error.response) {
            // server return error
            //  console.log(error.request.path)
            //console.warn(error.response.data)
            // console.warn(error.response.status)
            // console.warn(error.response.headers)
            if (error.response.data && error.response.data.hasOwnProperty("byteLength")) {
                error.response.data = JSON.parse(error.response.data.toString("utf8"))
            }
            throw new Error(JSON.stringify(error.response.data))
        } else if (error.request) {
            // console.warn( error.message )
            throw new Error(error.message)
        } else {
            // console.warn( 'Error', error )
            throw error
        }
    }

    _get(command, params = {}) {
        const options = {
            params
        }
        return this._httpClient.get(command, params)
            .then(this._parseResponse)
            .catch(this._parseError)
    }

    _post(command, data) {
        const options = {
            headers: {
                'Content-Type': 'application/json'
            }
        }

        return this._httpClient.post(command, data, options)
            .then((resp) => { return this._parseResponse(resp); })
            .catch(this._parseError)
    }

    _postBinary(command, data, url = "") {

        const form_data = new FormData();
        // for browser
        form_data.append("raw", new Blob([data]), { type: 'raw' });
        if (url === "") {
            url = `${this.url}/tx/broadcast/multipart`
        }
        console.log(form_data)
        return axios({
                method: 'post',
                url: url,
                headers: { 'Content-Type': 'multipart/form-data' },
                data: form_data,
                timeout: 100000,
                maxBodyLength: Infinity

            }).then(this._parseResponse)
            .catch(this._parseError);


    }
    _returnError(error) {
        return new Promise((resolve, reject) => { reject(error) })

    }


    /**
     * Get api status
     * Simple endpoint to show API server is up and running
     * https://docs.bitails.io/#get-api-status
     */
    status() {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._get('chaininfo.json')
                break;
            case this._endpoints["bitails"]:
                return this._get('network/stats').then(result => result)
                break;

            case this._endpoints["electrumx"]:
                return this._get('getcurrentblock')

                break;

            case this._endpoints["woc"]:
                return this._get('woc').then(result => result)
                break;
        }
    }

    /**
     * Get api stats
     * Simple endpoint to show API server is up and running
     * https://docs.bitails.io/#get-api-status
     */
    stats(block) {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("Not implemented.")
                break;

            case this._endpoints["bitails"]:
                return this._get('network/stats').then(result => result)
                break;

            case this._endpoints["electrumx"]:
                return this._returnError("Not implemented.")
                break;

            case this._endpoints["woc"]:
                switch (typeof block) {
                    case "number":
                        return this._get(`block/height/${block}/stats`);
                        break;
                    case "string":
                        return this._get(`block/hash/${block}/stats`);
                        break;
                }

                break;
        }
    }

    /**
     * Get api miner stats
     * https://docs.taal.com/core-products/whatsonchain/stats#get-miner-block-stats
     * @param {string} days must be 1 or 30
     */
    minerStats(days = 30) {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("Not implemented.")
                break;
            case this._endpoints["bitails"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["electrumx"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["woc"]:
                return this._get(`miner/blocks/stats?days=${days}`);
                break;
                break;
        }
    }


    /**
     * Get blockhain info
     * This endpoint retrieves various state info of the chain for the selected network.
     * https://docs.bitails.io/#chain-info
     */
    chainInfo() {

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._get('chaininfo.json')
                break;

            case this._endpoints["bitails"]:
                return this._get('network/info')
                break;

            case this._endpoints["electrumx"]:
                return this._get('getcurrentblock')
                break;

            case this._endpoints["woc"]:
                return this._get('chain/info')
                break;
        }


    }

    /**
     * Get chain tips
     * This endpoint retrieves the chain tips
     * https://docs.taal.com/core-products/whatsonchain/chain-info#get-chain-tips
     */
    chainTips() {

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("Not implemented.")
                break;

            case this._endpoints["bitails"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["electrumx"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["woc"]:
                return this._get('chain/tips')
                break;
        }


    }

    /**
     * Get Circulating Supply
     * This endpoint provides circulating supply of BSV.
     * https://docs.bitails.io/#get-circulating-supply

     */
    circulatingsupply() {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["bitails"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["electrumx"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["woc"]:
                return this._get('circulatingsupply')
                break;
        }

    }

    // ------------------------- Blocks ------------------------

    /**
     * Get by hash
     * This endpoint retrieves block details with given hash.
     * https://docs.bitails.io/#get-block-by-hash
     * @param {string} hash The hash of the block to retrieve
     */
    blockHash(hash, opt = { format: "json", notxdetails: true }) {

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                let txdetails = opt.notxdetails ? "notxdetails/" : "";
                return this._get(`block/${txdetails}${hash}.${opt.format}`)
                break;

            case this._endpoints["bitails"]:
                return this._get(`block/${hash}`)
                break;

            case this._endpoints["electrumx"]:
                return this._get(`getblockinfo?height=${hash}&cp_height=${hash}`)
                break;

            case this._endpoints["woc"]:
                return this._get(`block/hash/${hash}`)
                break;
        }

    }

    /**
     * Get by height
     * This endpoint retrieves block details with given block height.
     * https://docs.bitails.io/#get-by-height
     * @param {number} height The height of the block to retrieve
     */
    blockHeight(height) {

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["bitails"]:
                return this._get(`block/height/${height}`)
                break;

            case this._endpoints["electrumx"]:
                return this._get(`getblockinfo?height=${height}&cp_height=${height}`)
                break;

            case this._endpoints["woc"]:
                return this._get(`block/height/${height}`)
                break;
        }



    }

    /**
     * Get latest block
     * This endpoint retrieves latest block header details.
     * https://docs.bitails.io/#get-latest-block
     */
    blockLatest() {

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["bitails"]:
                return this._get(`block/latest`)
                break;

            case this._endpoints["electrumx"]:
                return this._get('getcurrentblock')
                break;

            case this._endpoints["woc"]:
                return this._returnError("Not implemented.")

                break;
        }



    }
    /**
     * Get block count by filter
     * @param {string} minerId

     */
    blockCount(minerId) {

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("Not implemented.")

                break;
            case this._endpoints["bitails"]:
                return this._get(`block/count?minerId=${minerId}`)
                break;

            case this._endpoints["electrumx"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["woc"]:
                return this._returnError("Not implemented.")

                break;
        }


    }
    /**
     * Get block pages
     * If the block has more that 1000 transactions the page URIs will be provided in the pages element when getting a block by hash or height.
     * https://docs.bitails.io/#get-block-pages
     * @param {string} hash The hash of the block to retrieve
     * @param {number} page Page number
     */
    blockList(heightOrHash, opt = { nPage: 1, skip: 0, limit: 100, sort: 'height', direction: 'asc', minerId: '' }) {
        let { skip, limit, direction, sort, minerId } = opt
        if (!opt.limit) { opt.limit = 100; }
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["bitails"]:
                return this._get(`block/list?skip=${skip}&from=${heightOrHash}&limit=${limit}&sort=${sort}&direction=${direction}&minerId=${minerId}`)
                break;

            case this._endpoints["electrumx"]:
                return this._get(`getblockinfo?height=${heightOrHash}&cp_height=${heightOrHash}`)
                    .then((res) => { if (res.msg === "success") return res.result; })
                break;

            case this._endpoints["woc"]:
                return this._get(`block/hash/${heightOrHash}/page/${opt.nPage}`)
                break;
        }


    }


    /**
     * Returns the transactions of a block based on the index
     * 
     */
    blockTransactions(hash, opt = { from: 0, limit: 10 }) {
        let { from, limit } = opt
        if (!opt.limit) { opt.limit = 100; }
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("Not implemented.")

                break;

            case this._endpoints["bitails"]:
                return this._get(`block/${opt.hash}/transactions?from=${opt.from}&limit=${opt.limit}`)
                break;

            case this._endpoints["electrumx"]:
                return this._get(`getblockinfo?height=${heightOrHash}&cp_height=${heightOrHash}`)
                    .then((res) => { if (res.msg === "success") return res.result; })
                break;

            case this._endpoints["woc"]:
                return this._get(`block/hash/${heightOrHash}/page/${opt.nPage}`)
                break;
        }


    }

    /**
     * Returns the tags stats of blocks
     *  Perdiod: 1h || 24h || 7d
     */
    blockTagHistogram(period = '24h', opt = { from: 0, to: 100, period: "1h" }) {

        switch (this._api) {
            case this._endpoints["bitals"]:
                return this._get(`block/stats/tag/${period}/histogramblock?fromTime=${opt.from}&toTime=${opt.to}&period=${period}`)
                break;
            default:
                return this._returnError("Not implemented.");
                break;
        }
    }


    /**
     * Returns the mining stats of blocks
     *  Perdiod: 1h || 24h || 7d 
     */
    blockMiningHistogram(period = '24h', opt = { from: 0, to: 100, period: "1h" }) {
        switch (this._api) {
            case this._endpoints["bitals"]:
                return this._get(`block/stats/mining/${period}/histogramblock?fromTime=${opt.from}&toTime=${opt.to}&period=${period}`)
                break;
            default:
                return this._returnError("Not implemented.");
                break;

        }
    }


    /**
     * Returns the props of blocks in given period
     *    *  Perdiod: 1h || 24h || 7d
     */
    blockPropsHistogram(period = '24h', opt = { from: 0, to: 100 }) {
        switch (this._api) {
            case this._endpoints["bitals"]:
                return this._get(`block/stats/props/${period}/histogramblock?fromTime=${opt.from}&toTime=${opt.to}`)
                break;
            default:
                return this._returnError("Not implemented.");
                break;

        }
    }

    // --------------------------------------------------------------------------------------------------


    /**
     * Get by tx hash
     * This endpoint retrieves transaction details with given transaction hash.
     * In the response body, if any output hex size, exceeds 100KB then data is truncated
     * NOTICE:A separate endpoint get raw transaction output data can be used to fetch full hex data
     * https://docs.bitails.io/#get-by-tx-hash
     * @param {string} hash The hash/txId of the transaction to retrieve
     */
    txHash(hash, opts = { format: "json" }) {

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._get(`tx/${hash}.${opts.format}`, opts)
                    .then((laTx) => {
                        switch (opts.format) {
                            case "bin":
                                return Tx.fromBr(new Br(laTx));
                                break;
                            case "json":
                                return { ...laTx, Tx: Tx.fromHex(laTx.hex) };
                                break;
                            case "hex":
                                return Tx.fromHex(laTx);
                                break;

                        }

                    })
                break;
            case this._endpoints["bitails"]:
                return this._get(`tx/${hash}`)
                break;
            case this._endpoints["electrumx"]:
                return this._get(`gettransaction?txid=${hash}`)
                    .then((resp) => {
                        if (resp.msg === "success") {
                            let laTx = resp.result;
                            switch (opts.format) {
                                default:
                                case "bsv":
                                    return Tx.fromHex(laTx);
                                    break;
                                case "bin":
                                    return Tx.fromHex(laTx).toBuffer();
                                    break;
                                case "json":
                                    return Tx.fromHex(laTx).toJSON();
                                    break;
                                case "hex":
                                    return laTx;
                                    break;

                            }
                        }
                    })
                break;
            case this._endpoints["woc"]:
                return this._get(`tx/hash/${hash}`)
                    .then((laTx) => {
                        console.log("txhash woc:", laTx)
                        switch (opts.format) {
                            default:
                            case "bsv":
                                laTx;
                                break;
                            case "bin":
                                return laTx.toBuffer();
                                break;
                            case "json":
                                return laTx.toJSON();
                                break;
                            case "hex":
                                return laTx.toHex();
                                break;

                        }
                    })

                break;
        }




    }



    /**
     * Download raw transactions
     * https://docs.bitails.io/#download-transaction
     * @param {string} hash The hash/txId of the transaction to retrieve
     */
    downloadTx(hash, opts = { format: "bsv" }) {

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                if (opts.format === "bsv") opts.format = "bin"
                if (opts.format === "bin") {
                    opts.responseType = "arraybuffer"
                }

                return this._get(`tx/${hash}.${opts.format}`, opts)
                    .then((laTx) => {
                        //console.log("downloaded tx: ",laTx)
                        switch (opts.format) {
                            default:
                            case "bsv":
                            case "bin":
                                return Tx.fromBr(new Br(this._buffer.from(laTx, "binary")));
                                break;
                            case "json":
                                return { ...laTx, Tx: Tx.fromHex(laTx.hex) };
                                break;
                            case "hex":
                                return Tx.fromHex(laTx);
                                break;

                        }

                    })
                break;
            case this._endpoints["bitails"]:
                let extra = ""
                if (opts.format === "hex") {
                    extra += "/hex"
                }
                return this._get(`download/tx/${hash}`, { responseType: "arraybuffer" })
                    .then((laTx) => {
                        switch (opts.format) {
                            case "json":
                                return Tx.fromBr(new Br(this._buffer.from(laTx, "binary"))).toJSON();
                                break;
                            case "hex":
                                return Tx.fromBr(new Br(this._buffer.from(laTx, "binary"))).toHex();
                                break;
                            case "bin":
                                return this._buffer.from(laTx, "binary");
                                break;
                            default:
                            case "bsv":
                                return Tx.fromBr(new Br(this._buffer.from(laTx, "binary")));
                                break;
                        }
                    })
                break;
            case this._endpoints["electrumx"]:
                return this._get(`gettransaction?txid=${hash}`)
                    .then((resp) => {
                        return Tx.fromHex(resp.result)
                    })
                break;
            case this._endpoints["woc"]:
                return this._get(`tx/${hash}/hex`)
                    .then((laTx) => {
                        switch (opts.format) {
                            case "json":
                                return Tx.fromHex(laTx).toJSON();
                                break;
                            case "hex":
                                return laTx;
                                break;
                            case "bin":
                                return Tx.fromHex(laTx, "hex");
                                break;
                            default:
                            case "bsv":
                                return Tx.fromHex(laTx, "hex");
                                break;
                        }
                    })
                break;
        }



    }



    /**
     * Download specific transaction input
     * https://docs.bitails.io/#download-transaction
     * @param {string} hash The hash/txId of the transaction to retrieve
     * @param {integer} index The index of the input to retrieve
     */
    downloadTxIn(hash, index, opts = { format: "bsv" }) {
        let tx
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this.txHash(hash)
                    .then((dTx) => {
                        if (dTx.hash === hash)
                            return { ...dTx.vin[index],
                                unlock: Script.fromHex(dTx.vin[index].scriptSig.hex)
                            }
                    })

                break;
            case this._endpoints["bitails"]:
                return this._get(`download/tx/${hash}/input/${index}`, { responseType: "arraybuffer" })
                    .then((resp) => {
                        switch (opts.format) {
                            default:
                            case "bsv":
                                return Script.fromBuffer(this._buffer.from(resp, "binary"));
                                break;
                            case "json":
                                return Script.fromBuffer(this._buffer.from(resp, "binary")).toJSON();
                                break;
                            case "hex":
                                return Script.fromBuffer(this._buffer.from(resp, "binary")).toHex();
                                break;
                        }

                    })
                break;
            case this._endpoints["electrumx"]:
                return this._get(`gettransaction?txid=${hash}`)
                    .then((resp) => {
                        if (resp.msg === "success") {
                            let dTx = Tx.fromHex(resp.result)
                            return dTx.txIns[index]
                        }
                    })
                break;
            case this._endpoints["woc"]:
                return this.txHash(hash)
                    .then((dTx) => {
                        console.log("woc from hash", dTx)
                        if (dTx.hash === hash)
                            return { ...dTx.vin[index], unlock: Script.fromHex(dTx.vin[index].scriptSig.hex) }
                    })

                break;
        }

    }

    /**
     * Download specific transaction output
     * https://docs.bitails.io/#download-transaction
     * @param {string} hash The hash/txId of the transaction to retrieve
     * @param {integer} index The index of the output to retrieve
     */
    downloadTxOut(hash, index, opts = { format: "bsv" }) {
        let tx
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this.txHash(hash).then((dTx) => {
                    return { ...dTx.vout[index], lock: Script.fromHex(dTx.vout[index].scriptPubKey.hex) }
                })
                break;
            case this._endpoints["bitails"]:
                return this._get(`download/tx/${hash}/output/${index}`, { responseType: 'arraybuffer' })
                    .then((resp) => {
                        switch (opts.format) {
                            default:
                            case "bsv":
                                return Script.fromBuffer(this._buffer.from(resp, 'binary'));
                                break;
                            case "json":
                                return Script.fromBuffer(this._buffer.from(resp, 'binary')).toJSON();
                                break;
                            case "hex":
                                return Script.fromBuffer(this._buffer.from(resp, 'binary')).toHex();
                                break;
                            case "bin":
                                return this._buffer.from(resp, 'binary');
                                break;

                        }
                    })
                break;
            case this._endpoints["electrumx"]:
                return this._get(`gettransaction?txid=${hash}`).then((resp) => {
                    if (resp.msg === "success") {
                        return Tx.fromHex(resp.result).txOuts[index]
                    }
                })

                break;
            case this._endpoints["woc"]:
                return this.txHash(hash).then((dTx) => {
                    return { ...dTx.vout[index], lock: Script.fromHex(dTx.vout[index].scriptPubKey.hex) }
                })

                break;
        }


    }

    /**
     * Download receipt
     * Download transaction receipt (PDF)
     * https://developers.whatsonchain.com/#download-receipt
     * @param {string} hash The hash/txId of the transaction
     */
    receiptPDF(hash) {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                break;
            case this._endpoints["bitails"]:
                break;
            case this._endpoints["electrumx"]:
                break;
            case this._endpoints["woc"]:
                return this._get(`https://${this._network}.whatsonchain.com/receipt/${hash}`)
                break;
        }
    }


    /**
     * Broadcast transaction
     * Broadcast transaction using this endpoint. Get txid in response or error msg from node with header content-type: text/plain.
     * https://docs.bitails.io/#broadcast-transaction
     * @param {string} txhex Raw transaction data in hex
     */
    broadcast(txhex, opts = { format: "hex" }) {

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._get(`mempool/info.json`)
                break;
            case this._endpoints["bitails"]:
                if (opts.format === "hex") {
                    return this._post('tx/broadcast', { raw: txhex })
                } else {
                    return this._postBinary('tx/broadcast/multipart', { raw: this._buffer.from(txhex, "hex") })
                }
                break;
            case this._endpoints["electrumx"]:
                return this._post('pushtx', { rawtx: txhex })
                break;
            case this._endpoints["woc"]:
                return this._post('tx/raw', { txhex })
                break;
        }



    }


    /**
     * Bulk transaction details
     * Fetch details for multiple transactions in single request
     * - Max 20 transactions per request
     * https://docs.bitails.io/#bulk-transaction-details
     * @param {Array} txidArray 

    bulkTxDetails ( txidArray ) {
      return this._post( `txs`, {
        txids: txidArray
      } )
    }
    */


    /**
     * Decode transaction
     * Decode raw transaction using this endpoint. Get json in response or error msg from node.
     * https://docs.bitails.io/#decode-transaction
     * @param {string} txhex Raw transaction data in hex
     */

    decodeTx(txhex) {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                break;
            case this._endpoints["bitails"]:
                return this._post('tx/decode', { params: { txhex } })
                break;
            case this._endpoints["electrumx"]:
                break;
            case this._endpoints["woc"]:
                return this._post('tx/decode', { params: { txhex } })
                break;
        }
    }



    /**
     * Download receipt
     * Download transaction receipt (PDF)
     * https://docs.bitails.io/#download-receipt
     * @param {string} hash The hash/txId of the transaction
    receiptPDF ( hash ) {
      return this._get( `https://${this._network}.Bitails.com/receipt/${hash}` )
    }
     */


    /**
     * Get raw data from transaction output chunk
     * @param {string} hash The hash/txId of the transaction
     * @param {number} outputIndex Output index
     * @param {number} chunkIndex chunk index

     */
    getOutputDataChunk(hash, outputIndex, chunkIndex, opts = { format: "bsv" }) {

        switch (this._api) {
            case this._endpoints["electrumx"]:
            case this._endpoints["bsvdirect"]:
            case this._endpoints["woc"]:
                return this.downloadTxOut(hash, outputIndex, { format: "bsv" })
                    .then((out) => {
                        switch (opts.format) {
                            default:
                            case "bsv":
                                return out.script.chunks[chunkIndex];
                                break;
                            case "hex":
                                return out.script.chunks[chunkIndex].buf.toString("hex");
                                break;

                        }
                    })
                break;
            case this._endpoints["bitails"]:
                return this._get(`tx/${hash}/output/${outputIndex}`);
                break;

        }
    }

    /**
     * Get raw transaction output data
     * Get raw transaction vout data in hex
     * https://docs.bitails.io/#get-raw-transaction-output-data
     * @param {string} hash The hash/txId of the transaction
     * @param {number} outputIndex Output index
     */
    getOutputData(hash, outputIndex) {

        switch (this._api) {
            case this._endpoints["electrumx"]:
            case this._endpoints["bsvdirect"]:
            case this._endpoints["woc"]:
                return this.downloadTxOut(hash, outputIndex, { format: "bsv" })
                    .then((out) => {
                        return out.script.toAsmString()
                    })
                break;
            case this._endpoints["bitails"]:
                return this._get(`tx/${hash}/output/${outputIndex}`);
                break;

        }
    }

    /**
     * Get the script data from tx 
     * https://docs.bitails.io/#get-raw-transaction-output-data
     * @param {string} hash The hash/txId of the transaction
     * @param {number} fromIndex Start at this Output index 
     * @param {number} toIndex Stop at this Out index
     */
    getOutputsData(hash, fromIndex, toIndex) {
        switch (this._api) {
            case this._endpoints["electrumx"]:
            case this._endpoints["bsvdirect"]:
            case this._endpoints["woc"]:
                return this.downloadTx(hash).then((laTx) => {
                    return laTx.txOuts.slice(fromIndex, toIndex).map((out) => { return out.script.toAsmString() })
                })
                break;
            case this._endpoints["bitails"]:
                return this._get(`tx/${hash}/outputs/${fromIndex}/${toIndex}`);
                break;

        }
    }

    /**
     * Get merkle proof
     * This endpoint returns merkle branch to a confirmed transaction
     * https://docs.bitails.io/#get-merkle-proof
     * @param {string} hash The hash/txId of the transaction
     */
    merkleProof(hash, opts = { tsc: true }) {
        let tsc = opts.tsc ? "/tsc" : ""

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("merkleProof not implemented.")
                break;
            case this._endpoints["bitails"]:
                return this._get(`tx/${hash}/proof${tsc}`)
                break;
            case this._endpoints["electrumx"]:
                if (opts.height) {
                    return this._get(`getmerkle?txid=${hash}&height=${opts.height}`)
                        .then((res) => {
                            if (res.msg === "success") {
                                return res.result;
                            } else {
                                return this._returnError("Specify block height of the transaction.")

                            }
                        })
                } else {
                    return this._returnError("Specify block height of the transaction.")
                    //throw new Error("you need to specify height")
                }

                break;
            case this._endpoints["woc"]:
                return this._get(`tx/${hash}/proof${tsc}`)
                break;
        }
    }


    /**
     * Get mempool info
     * This endpoint retrieves various info about the node's mempool for the selected network.
     * https://docs.bitails.io/#get-mempool-info
     */
    mempoolInfo() {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._get(`mempool/info.json`)
                break;
            case this._endpoints["bitails"]:
                return this._get(`mempool`)
                break;
            case this._endpoints["electrumx"]:
                // Not implemented
                return this._returnError("mempoolInfo Not implemented.")
                break;
            case this._endpoints["woc"]:
                return this._get(`mempool/info`)
                break;
        }
    }


    /**
     * Get mempool transactions
     * This endpoint retrieve list of transaction ids from the node's mempool for the selected network.
     * https://docs.bitails.io/#get-mempool-transactions
     * 
     */
    mempoolTxs(scripthash) {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._get(`mempool/contents.json`)
                break;
            case this._endpoints["bitails"]:
                return this._get(`mempool/transactions`)
                break;
            case this._endpoints["electrumx"]:
                return this._get(`getmempooltx?scripthash=${scripthash}`)
                break;
            case this._endpoints["woc"]:
                return this._get(`mempool/raw`)
                break;
        }
    }

    /**
     * Get address info
     * This endpoint retrieves various address info.
     * @param {string} address 
     */
    addressInfo(address) {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("addressInfo Not implemented.")

                break;
            case this._endpoints["bitails"]:
                return this._get(`address/${address}/details`)
                break;

            case this._endpoints["electrumx"]:
                return this._returnError("addressInfoNot implemented.")

                // Not implemented
                break;

            case this._endpoints["woc"]:
                return this._get(`address/${address}/info`)
                break;
        }


    }

    /**
     * Get balance
     * This endpoint retrieves confirmed and unconfirmed address balance.
     * @param {string} address 
     */
    balance(address) {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("balance Not implemented.")

                break;

            case this._endpoints["bitails"]:
                return this._get(`address/${address}/balance`)
                break;

            case this._endpoints["electrumx"]:
                return this._get(`getbalance?address=${address}`)
                break;

            case this._endpoints["woc"]:
                return this._get(`address/${address}/balance`)
                break;
        }

    }

    /**
     * Get history
     * This endpoint retrieves confirmed and unconfirmed address transactions.
     * https://docs.bitails.io/#get-history
     * @param {string} address 
     */
    history(address, pgkey = "", limit = 100, pagination = true, pagesize = 10, page = 1) {

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("history Not implemented.")

                break;
            case this._endpoints["bitails"]:
                let pgkeyParam = ""
                if (pgkey != "") { pgkeyParam = `pgkey=${pgkey}&`; } else { pgkeyParam = ""; }
                return this._get(`address/${address}/history?${pgkeyParam}limit=${limit}`)
                break;

            case this._endpoints["electrumx"]:
                return this._get(`listtransactions?address=${address}&pagination=${pagination}&pagesize=${pagesize}&page=${page}`)
                break;

            case this._endpoints["woc"]:
                return this._get(`address/${address}/history`)
                break;
        }



    }

    /**
     * Get unspent transactions
     * This endpoint retrieves ordered list of UTXOs.
     * https://docs.bitails.io/#get-unspent-transactions
     * @param {string} address 
     */
    utxos(address, opts = { from: 0, limit: 100, format: "json" }) {

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("utxos Not implemented.")
                //return this._get(`listunspent?address=${address}&ip=explora.bsv.direct&port=50002&proto=ssl`)
                break;
            case this._endpoints["bitails"]:
                return this._get(`address/${address}/unspent?from=${opts.from}&limit=${opts.limit}`)

                break;
            case this._endpoints["electrumx"]:
                return this._get(`listunspent?address=${address}`)

                break;
            case this._endpoints["woc"]:
                return this._get(`address/${address}/unspent`)
                break;

        }


    }

    /**
     * Get unspent status of outpoints
     * This endpoint retrieves the unspent status of an array of outpoints.
     * https://docs.bitails.io/#get-unspent-transactions
     * @param {string} address 
     */
    isUnspent(outpoints, opts = { checkmempool: true, format: "json" }) {
        !opts.format ? opts.format = "json" : false;
        let outpointPath = ""
        let checkmempoolPath = ""
        if (Array.isArray(outpoints)) {
            outpointPath = outpoints.join("/")
        } else {
            outpointPath = outpoints
        }
        if (opts.checkmempool) {
            checkmempoolPath = "checkmempool/"
        }
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._get(`getutxos/${checkmempoolPath}${outpointPath}.${opts.format}`)
                break;
            case this._endpoints["electrumx"]:
                return this._returnError("isUnspent Not implemented.")
            case this._endpoints["bitails"]:
                return this._returnError("isUnspent Not implemented.")
                break;
            case this._endpoints["woc"]:
                return this._returnError("isUnspent Not implemented.")
                break;

        }

    }





    /**
     * Get balance of  scriptHash
     * This endpoint retrieves balace if ScriptHash
     * https://docs.bitails.io/#get-balance-of-scripthash
     * @param {string} scriptHash Script hash: Sha256 hash of the binary bytes of the locking script (ScriptPubKey), expressed as a hexadecimal string.
     */
    balanceScriptHash(scriptHash) {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("balanceScriptHash Not implemented.")
                break;
            case this._endpoints["bitails"]:
                return this._get(`scripthash/${scriptHash}/balance`)
                break;
            case this._endpoints["electrumx"]:
                return this._get(`getbalance?address=${scriptHash}`)
                break;
            case this._endpoints["woc"]:
                return this._get(`script/${scriptHash}/balance`)
                break;
            default:
                return this._returnError("balanceScriptHash Not implemented.");
                break;
        }

        // 
    }
    /**
     * Get scriptHash history
     * This endpoint retrieves confirmed and unconfirmed script transactions.
     * https://docs.bitails.io/#get-history-of-scripthash
     * @param {string} scriptHash Script hash: Sha256 hash of the binary bytes of the locking script (ScriptPubKey), expressed as a hexadecimal string.
     */
    historyByScriptHash(scriptHash, opts = { pgkey: "", limit: 100, pagination: true, pagesize: 100, page: 1 }) {
        let { pagination, pagesize, page } = opts
        if (!opts.limit) { opts.limit = 100 }
        switch (this._api) {
            default:
            case this._endpoints["bsvdirect"]:
                return this._returnError("historyByScriptHash Not implemented.")
                break;

            case this._endpoints["bitails"]:
                let pgkeyParam
                if (opts.pgkey != "") { pgkeyParam = `pgkey=${opts.pgkey}&`; } else { pgkeyParam = ""; }
                return this._get(`scripthash/${scriptHash}/history?${pgkeyParam}limit=${opts.limit}`)
                break;
            case this._endpoints["electrumx"]:
                return this._get(`listtransactions?address=${scriptHash}&pagination=${pagination}&pagesize=${pagesize}&page=${page}`)

                break;
            case this._endpoints["woc"]:
                return this._get(`script/${scriptHash}/history`)
                break;
        }





    }

    /**
     * Get scriptHash information
     * This endpoint retrieves information abut ScriptHash
     * https://docs.bitails.io/#get-details-of-scripthash
     * @param {string} scriptHash Script hash: Sha256 hash of the binary bytes of the locking script (ScriptPubKey), expressed as a hexadecimal string.
     */
    detailsScriptHash(scriptHash) {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("detailsScriptHash Not implemented.")
                break;
            case this._endpoints["bitails"]:
                return this._get(`scripthash/${scriptHash}/details`)
                break;
            case this._endpoints["electrumx"]:
                return this._returnError("detailsScriptHash Not implemented.")
                break;
            case this._endpoints["woc"]:
                return this._returnError("detailsScriptHash Not implemented.")
                break;
            default:
                return this._returnError("detailsScriptHash Not implemented.")
                break;

        }
    }

    /**
     * Get scriptHash unspent transactions
     * This endpoint retrieves ordered list of UTXOs.
     * https://docs.bitails.io/#get-script-unspent-transactions
     * @param {string} scriptHash Script hash: Sha256 hash of the binary bytes of the locking script (ScriptPubKey), expressed as a hexadecimal string.
     */
    utxosByScriptHash(scriptHash, opts = { from: 0, limit: 100, format: "json" }) {
        if (!opts.format) { opts.format = "json" }
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._get(`getutxos/${scriptHash}.${opts.format}`)
                break;
            case this._endpoints["bitails"]:
                return this._get(`scripthash/${scriptHash}/unspent?from=${opts.from}&limit=${opts.limit}`)
                break;
            case this._endpoints["electrumx"]:
                return this._get(`listunspent?address=${scriptHash}`)

                break;
            case this._endpoints["woc"]:
                return this._get(`script/${scriptHash}/unspent`)
                break;
            default:
                return this._returnError("utxosByScriptHash Not implemented.")
                break;
        }

    }
    utxosByScriptHashBulk(scriptHashes, opts = { from: 0, limit: 100 }) {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                //return this._get(`getutxos/${address}.${format}`)
                return this._returnError("utxosByScriptHashBulk Not implemented.")
                break;
            case this._endpoints["bitails"]:
                return this._post(`scripthash/unspent/multi?from=${from}&limit=${limit}`, { scriptHashes })
                break;
            case this._endpoints["electrumx"]:
                return this._returnError("utxosByScriptHashBulk Not implemented.")
                break;
            case this._endpoints["woc"]:
                // 20 Max limit
                if (!Array.isArray(scriptHashes) && scriptHashes.length > 20) {
                    throw new Error("Array of max 20 script hashes")
                } else {
                    return this._post(`scripts/unspent`, { scripts: scriptHashes })
                }
                break;
            default:
                return this._returnError("utxosByScriptHashBulk Not implemented.")
                break;
        }

    }

    /**
     * Fee quotes
     * This endpoint provides fee quotes from multiple transaction processors. Each quote also contains transaction processor specific txSubmissionUrl and txStatusUrl. These unique URLs can be used to submit transactions to the selected transaction processor and check the status of the submitted transaction.
     * https://docs.bitails.io/#merchant-api-beta
    feeQuotes () {
      return this._get( `https://api.whatsonchain.com/v1/bsv/main/mapi/feeQuotes` )
    }
     */

    /**
     * Submit transaction
     * Submit a transaction to a specific transaction processor using the txSubmissionUrl provided with each quote in the Fee quotes response.
     * https://docs.bitails.io/#submit-transaction
     * @param {string} providerId Unique providerId from the Fee quotes response
     * @param {string} rawtx Raw transaction data in hex
    submitTx ( providerId, rawtx ) {
      return this._post( `mapi/${providerId}/tx`, {
        rawtx
      } )
    }
     */


    /**
     * Transaction status
     * Get a transaction's status from a specific transaction processor using the txStatusUrl provided with each quote in Fee quotes response.
     * @param {string} providerId Unique providerId from the Fee quotes response
     * @param {string} hash The hash/txId of the transaction

    txStatus ( providerId, hash ) {
      return this._get( `mapi/${providerId}/tx/${hash}` )
    }
     */


    /**
     * Get txid details links
     * This endpoint retrieves transactions including the search parameter.
     * https://docs.bitails.io/#Search
     * type: all || ops || tx || block || scripthash || address
     * @param {string} 
     */
    search(q, opts = { type: 'all', from: null, fromTime: null, toTime: null, limit: 10 }) {
        if (!opts.type) { opts.type = "all"; }
        if (!opts.limit) { opts.limit = 10; }

        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("search Not implemented.")

                break;
            case this._endpoints["bitails"]:
                let extra = ""
                if (opts.from) { extra += `&from=${opts.from}`; }
                if (opts.fromTime) { extra += `&fromTime=${opts.fromTime}`; }
                if (opts.toTime) { extra += `&toTime=${opts.toTime}`; }
                return this._get(`search?type=${opts.type}&q=${q}&limit=${opts.limit}${extra}`)

                break;
            case this._endpoints["electrumx"]:
                // not implemented
                return this._returnError("search Not implemented.")

                break;
            case this._endpoints["woc"]:
                return this._post(`search/links`, { params: { query: q } })
                break;
            default:
                return this._returnError("search Not implemented.")
        }
    }


    /**
     * Get exchange rate
     * This endpoint provides exchange rate for BSV.
     * https://developers.whatsonchain.com/#exchange-rate
     */
    exchangeRate() {
        switch (this._api) {
            case this._endpoints["bsvdirect"]:
                return this._returnError("exchangeRate Not implemented.")

                break;
            case this._endpoints["bitails"]:
                return this._returnError("exchangeRate Not implemented.")

                break;
            case this._endpoints["electrumx"]:
                return this._returnError("exchangeRate Not implemented.")

                // not implemented
                break;
            case this._endpoints["woc"]:
                return this._get(`exchangerate`)
                break;
            default:
                return this._returnError("exchangeRate Not implemented.")
        }
    }

}

module.exports = Explorer