import BN from 'bn.js';
import dexterity from '@hxronetwork/dexterity-ts';
import * as solana from '@solana/web3.js';
import React from "react";
import Header from './Header.js';
import Books from './Books.js';

import './PerpChart.css';

const MAX_ASK = new BN(2).pow(new BN(63)).subn(1);
const MIN_BID = new BN(2).pow(new BN(63)).neg();
const ZERO_BN = new BN(0);

class PerpChart extends React.Component {
    static DefaultTRGState() {
        return {
            trader: null,
            selectedTRG: null,
            trgs: [],
            atmValue: '',
        };
    }

    static DefaultGunState() {
        return { 
            selectedProductIndex: null,
            selectedProductName: null,
            size: null,
            price: null,
            isValidSize: true,
            isValidPrice: true,
       };
    }

    static DefaultWalletState() {
        return {
            /// has to do with connection code:
            isWalletConnected: false,
            walletProvider: null,
            walletProviderStr: '',
        };
    }

    static DefaultState() {
        const rpcs = new Map();
        rpcs.set('Mainnet (HXRO)', 'https://hxro.rpcpool.com/');
        rpcs.set('Devnet (HXRO)', 'https://hxro-hxro-b289.devnet.rpcpool.com/');
        rpcs.set('Testnet (HXRO)', 'https://hxro-hxro-b289.testnet.rpcpool.com/');
        rpcs.set('Local', 'http://localhost:8899/');
        rpcs.set('Mainnet (Public)', 'https://api.mainnet-beta.solana.com');
        rpcs.set('Devnet (Public)', 'https://api.devnet.solana.com');
        const DEFAULT_RPC_NAME = 'Mainnet (HXRO)'; // 'Mainnet (HXRO)';
        return {
            manifest: null,
            rpcs,
            selectedRPC: rpcs.get(DEFAULT_RPC_NAME),
            selectedRPCName: DEFAULT_RPC_NAME,
            selectedMPG: null,
            selectedMPGObject: null,
            isFetchingManifest: false,
            books: {}, // product key str -> books struct
            eventQueues: {}, // event queue key str -> event queue struct
            trg: PerpChart.DefaultTRGState(),
            wallet: PerpChart.DefaultWalletState(),
            gun: PerpChart.DefaultGunState(),
        };
    }

    constructor(props) {
        super(props);
        this.state = PerpChart.DefaultState();
        this.mpgSocket = null;
        this.product2Sockets = {};
    }

    streamBooks(product) {
        const meta = dexterity.productToMeta(product);
        const productKey = meta.productKey;
        const productKeyStr = productKey.toBase58();
        const baseDecimals = meta.baseDecimals;
        const tickSize = dexterity.Fractional.From(meta.tickSize);
        const priceOffset = dexterity.Fractional.From(meta.priceOffset);
        const priceDecimals = dexterity.getPriceDecimals(meta);
        const manifest = this.state.manifest;
        let marketState = null;
        const orderbookStr = meta.orderbook.toBase58();
        for (const [k, { pubkey, mpg, orderbooks }] of manifest.fields.mpgs) {
            const orderbook = orderbooks.get(orderbookStr);
            if (orderbook) {
                marketState = orderbook;
                break;
            }
        }
        if (marketState === null) {
            console.error('Failed to find orderbook. This should never happen!');
            return;
        }
        const offsetFrac = dexterity.Fractional.From(priceOffset);
        if (this.product2Sockets.hasOwnProperty(productKeyStr)) {
            const sockets = this.product2Sockets[productKeyStr];
            sockets.bidsSocket.close();
            sockets.asksSocket.close();
            sockets.markPricesSocket.close();
            this.product2Sockets[productKeyStr] = undefined;
        }
        this.setState({
            ...this.state,
            books: {
                ...this.state.books,
                [productKeyStr]: {
                    baseDecimals,
                    tickSize,
                    priceDecimals,
                    markPrice: dexterity.Fractional.Nan(),
                    spreadEma: dexterity.Fractional.Nan(),
                    indexPrice: dexterity.Fractional.Nan(),
                    bids: [],
                    asks: [],
                },
            }
        });
        let p;
        if (product.hasOwnProperty('outright')) {
            p = product.outright.outright;
        } else if (product.hasOwnProperty('combo')) {
            p = product.combo.combo;
        } else {
            console.error('unrecognized product object; this should never happen');
            return;
        }
        this.product2Sockets[productKeyStr] = manifest.streamBooks(
            p,
            marketState,
            book => {
                this.setState({
                    ...this.state,
                    books: {
                        ...this.state.books,
                        [productKeyStr]: {
                            ...this.state.books[productKeyStr],
                            bids: book.bids,
                            asks: book.asks,
                        },
                    }
                });                
            },
            markPrices => {
                const updateSlot = 'TODO: Grab slot from specific product'; // markPrices.updateSlot.toString();
                const markPrice = dexterity.Manifest.GetMarkPrice(markPrices, productKey);
                const spreadEma = dexterity.Manifest.GetMarkPriceOracleMinusBookEwma(markPrices, productKey);
                const indexPrice = markPrice.add(spreadEma);

                let bookPrice = 'NaN';
                let isFound = false;
                for (const [pkStr, { pubkey, mpg, orderbooks }] of this.state.manifest.fields.mpgs) {
                    for (let [productName, { index, product }] of dexterity.Manifest.GetActiveProductsOfMPG(mpg)) {
                        let meta = dexterity.productToMeta(product);
                        if (meta.productKey.toBase58() === productKeyStr) {
                            let p;
                            if (product.hasOwnProperty('outright')) {
                                p = product.outright.outright;
                            } else if (product.hasOwnProperty('combo')) {
                                p = product.combo.combo;
                            } else {
                                console.error('unrecognized product object; this should never happen');
                                return;
                            }
                            const askPriceFrac = dexterity.Fractional.From(p.metadata.prices.ask);
                            const bidPriceFrac = dexterity.Fractional.From(p.metadata.prices.bid);
                            const bookPriceFrac = askPriceFrac.add(bidPriceFrac).div(dexterity.Fractional.New(2, 0));
                            const isAskValid = !(askPriceFrac.m.eq(MAX_ASK) && askPriceFrac.exp.eq(ZERO_BN));
                            const isBidValid = !(bidPriceFrac.m.eq(MIN_BID) && bidPriceFrac.exp.eq(ZERO_BN));
                            if (isAskValid && isBidValid) {
                                bookPrice = bookPriceFrac.toString();
                            } else if (isAskValid) {
                                bookPrice = askPriceFrac.toString();
                            } else if (isBidValid) {
                                bookPrice = bidPriceFrac.toString();
                            }
                            isFound = true;
                            break;
                        }
                    }
                    if (isFound) {
                        break;
                    }
                }

                this.setState({
                    ...this.state,
                    books: {
                        ...this.state.books,
                        [productKeyStr]: {
                            ...this.state.books[productKeyStr],
                            updateSlot,
                            markPrice,
                            spreadEma,
                            indexPrice,
                        },
                    }
                });                
            },
        );
    }

    async fetchTRG(trgStr) {
        this.setState({
            ...this.state,
            trg: {
                ...this.state.trg,
                isFetching: true,
                selectedTRG: trgStr,
                selectedTRGObject: null,
            }
        });
        if (trgStr.trim() === '') {
            this.setState({
                ...this.state,
                trg: {
                    ...this.state.trg,
                    isFetching: false,
                    isValid: true,
                }
            });
            return;
        }
        let trgPubkey;
        try {
            trgPubkey = new solana.PublicKey(trgStr);
        } catch (e) {
            console.error(e);
            this.setState({
                ...this.state,
                trg: {
                    ...this.state.trg,
                    isFetching: false,
                    isValid: false,
                }
            });
            return;
        }
        this.setState({
            ...this.state,
            trg: {
                ...this.state.trg,
                isFetching: true,
                isValid: true,
                selectedTRG: trgStr,
                selectedTRGObject: null,
            }
        });
        // let trg = null;
        let trader = null;
        try {
            trader = new dexterity.Trader(this.state.manifest, trgPubkey, true);
            await trader.connect(
                this.onTraderUpdate.bind(this),
                this.onTraderUpdate.bind(this),
            );
            // trg = await this.state.manifest.getTRG(trgPubkey);
            // console.log(trg);
        } catch (e) {
            console.error(e);
            this.setState({
                ...this.state,
                trg: {
                    ...this.state.trg,
                    isFetching: false,
                    isValid: false,
                    selectedTRG: null,
                    selectedTRGObject: null,
                    selectedTrader: null,
                }
            });
            return;            
        }
        const pastTrgs = [...new Set(this.state.trg.pastTrgs.concat([trgStr]))];
        localStorage.setItem('perp-chart-past-trgs', JSON.stringify(pastTrgs));
        this.setState({
            ...this.state,
            trg: {
                ...this.state.trg,
                isFetching: false,
                isValid: true,
                selectedTRG: trgStr,
                selectedTRGObject: trader.trg,
                selectedTrader: trader,
                updateTime: new Date(),
                pastTrgs,
            }
        });        
    }

    onTraderUpdate() {
        const trader = this.state.trg.selectedTrader;
        if (!trader) {
            return;
        }
        this.setState({
            ...this.state,
            trg: {
                ...this.state.trg,
                selectedTrader: trader,
                updateTime: new Date(),
            }
        });
    }

    async fetchManifest(rpcName, rpc, useCache = true, wallet = undefined) {
        try {
            let url = new URL(rpc);
            this.setState({
                selectedRPCName: rpcName,
                selectedRPC: rpc,
                isFetchingManifest: true,
                isValidRPC: true,
            });
            const manifest = await dexterity.getManifest(rpc, useCache, wallet);
            await manifest.fetchOrderbooks();
            await manifest.updateCovarianceMetadatas();
            let arbitraryMPGStr = null;
            let arbitraryMPGPk = null;
            if (this.state.selectedRPCName.includes('Mainnet')) {
                for (const [pkStr, { pubkey, orderbooks, covarianceMetadatas }] of manifest.fields.mpgs) {
                    arbitraryMPGStr = pkStr;
                    arbitraryMPGPk = pubkey;
                    if (pkStr === '4cKB5xKtDpv4xo6ZxyiEvtyX3HgXzyJUS1Y8hAfoNkMT') {
                        break;
                    }
                }
            } else {
                for (const [pkStr, { pubkey, orderbooks, covarianceMetadatas }] of manifest.fields.mpgs) {
                    arbitraryMPGStr = pkStr;
                    arbitraryMPGPk = pubkey;
                    break;
                }
            }
            if (arbitraryMPGPk !== null) {
                if (this.mpgSocket !== null) {
                    this.mpgSocket.close();
                }
                this.mpgSocket = manifest.streamMPG(
                    arbitraryMPGPk,
                    async mpg => {
                        const manifest = this.state.manifest;
                        const oldObj = manifest.fields.mpgs.get(arbitraryMPGStr);
                        manifest.fields.mpgs.set(
                            arbitraryMPGStr,
                            { ...oldObj, mpg, pubkey: arbitraryMPGPk }
                        );
                        // for (const [pkStr, { pubkey, orderbooks }] of manifest.fields.mpgs) {
                        //    if (pkStr !== arbitraryMPGStr) {
                        //        continue;
                        //    }
                        //    for (let [productName, { index, product }] of dexterity.Manifest.GetActiveProductsOfMPG(mpg)) {
                        //        const meta = dexterity.productToMeta(product);
                        //        if (!orderbooks.has(meta.orderbook.toBase58())) {
                        //            await manifest.fetchOrderbook(meta.orderbook);
                        //        }
                        //    }
                        // }
                        // await manifest.fetchOrderbooks(arbitraryMPGPk);
                        this.setState({
                            ...this.state,
                            manifest,
                        });
                    },
                );
            }
            this.setState({ manifest, selectedMPG: arbitraryMPGStr, isFetchingManifest: false });
        } catch (e) {
            console.error(e);
            this.setState({
                selectedRPCName: rpcName,
                selectedRPC: rpc,
                isFetchingManifest: false,
                isValidRPC: false
            });
        }
    }

    async componentDidMount() {
        this.fetchManifest(this.state.selectedRPCName, this.state.selectedRPC);
    }

    async timeTravelToDate(date) {
        await this.state.trg.selectedTrader.timeTravelToDate(date);
        this.forceUpdate();
    }

    componentDidUpdate() {
    }

    async connectWallet() {
        if (this.state.wallet.walletProvider) {
            try {
                let isConnected = await this.state.wallet.walletProvider.connect();
                this.setState({ wallet: { ...this.state.wallet, isWalletConnected: true } });
                this.state.manifest.setWallet(this.state.wallet.walletProvider);
                // const trgs = await this.state.manifest.getTRGsOfOwner(this.state.wallet.walletProvider.publicKey, new solana.PublicKey(this.state.selectedMPG));
                const trgs = await this.state.manifest.getTRGsOfWallet(new solana.PublicKey(this.state.selectedMPG));
                this.setState({ trg: { ...this.state.trg, trgs } });
            } catch (err) {
                console.log(err);
            }
        } else {
            alert("Please select a wallet provider from the dropdown.");
        }
    }

    async disconnectWallet() {
        if (this.state.wallet.walletProvider) {
            await this.state.wallet.walletProvider.disconnect();
        }
        this.setState({
            trg: PerpChart.DefaultTRGState(),
            wallet: PerpChart.DefaultWalletState(),
        });
    }

    handleWalletDropdownChange(e) {
        let provider = null;
        let providerStr = '';
        if (e.target.value === "solflare") {
            provider = getSolflareProvider();
            providerStr = 'solflare';
        } else if (e.target.value === "phantom") {
            provider = getPhantomProvider();
            providerStr = 'phantom';
        }
        this.setState({ wallet: { walletProvider: provider, walletProviderStr: providerStr } });
    }

    async handleTRGDropdownChange(e, isTrgNew = false) {
        if (isTrgNew) {
            try {
                const trgs = await this.state.manifest.getTRGsOfWallet(new solana.PublicKey(this.state.selectedMPG));
                this.setState({ trg: { ...this.state.trg, trgs } });
                setTimeout(async _ => {
                    const trgs = await this.state.manifest.getTRGsOfWallet(new solana.PublicKey(this.state.selectedMPG));
                    this.setState({ trg: { ...this.state.trg, trgs } });
                }, 1000);
            } catch (e) {
                console.error(e);
            }
        }
        try {
            const trgPubkey = new solana.PublicKey(e.target.value);
            this.setState({ trg: { ...this.state.trg, trader: null, selectedTRG: trgPubkey } });
            let trader = null;
            try {
                trader = new dexterity.Trader(this.state.manifest, trgPubkey, true);
                await trader.connect(
                    this.onTraderUpdate.bind(this),
                    this.onTraderUpdate.bind(this),
                );
                // trg = await this.state.manifest.getTRG(trgPubkey);
                // console.log(trg);
            } catch (e) {
                console.error(e);
                this.setState({
                    ...this.state,
                    trg: {
                        ...this.state.trg,
                        isFetching: false,
                        isValid: false,
                        selectedTRG: null,
                        selectedTRGObject: null,
                        selectedTrader: null,
                    }
                });
                return;
            }
            this.setState({
                ...this.state,
                trg: {
                    ...this.state.trg,
                    isFetching: false,
                    isValid: true,
                    trader,
                    updateTime: new Date(),
                }
            });
        } catch (e) {
            console.error(e);
        }
    }

    async handleGunDropdownChange(e) {
        this.setState({ gun: { ...this.state.gun, selectedProductIndex: e.target.value } });
    }

    async handleGunSizeChange(e) {
        this.setState({ gun: { ...this.state.gun, size: e.target.value, isSizeValid: !isNaN(parseFloat(e.target.value)) } });
    }

    async handleGunPriceChange(e) {
        this.setState({ gun: { ...this.state.gun, price: e.target.value, isPriceValid: !isNaN(parseFloat(e.target.value)) } });
    }

    async handleATMChange(e) {
        this.setState({ trg: { ...this.state.trg, atmValue: e.target.value } });
    }

    render() {
        return (
            <div className="PerpChart">
                <Header
                    isFetchingManifest={this.state.isFetchingManifest}
                    manifest={this.state.manifest}
                    selectedMPG={this.state.selectedMPG}
                    onMpgChange={pk => {
                        let pubkeyObject = null;
                        let orderbooksObject = null;
                        for (const [pkStr, { pubkey, orderbooks }] of this.state.manifest.fields.mpgs) {
                            if (pkStr === pk) {
                                pubkeyObject = pubkey;
                                orderbooksObject = orderbooks;
                                break;
                            }
                        }
                        if (this.mpgSocket !== null) {
                            this.mpgSocket.close();
                        }
                        if (pubkeyObject !== null) {
                            const manifest = this.state.manifest;
                            this.mpgSocket = manifest.streamMPG(
                                pubkeyObject,
                                async mpg => {
                                    const manifest = this.state.manifest;
                                    manifest.fields.mpgs.set(
                                        pk,
                                        { mpg, pubkey: pubkeyObject, orderbooks: orderbooksObject }
                                    );
                                    for (const [pkStr, { pubkey, orderbooks }] of manifest.fields.mpgs) {
                                        if (pkStr !== pk) {
                                            continue;
                                        }
                                        for (let [productName, { index, product }] of dexterity.Manifest.GetActiveProductsOfMPG(mpg)) {
                                            const meta = dexterity.productToMeta(product);
                                            if (!orderbooks.has(meta.orderbook.toBase58())) {
                                                await manifest.fetchOrderbook(meta.orderbook);
                                            }
                                        }
                                    }
                                    // await manifest.fetchOrderbooks(pubkeyObject);
                                    this.setState({
                                        ...this.state,
                                        manifest,
                                    });
                                },
                            );
                        }
                        this.setState({ selectedMPG: pk });
                    }}
                    rpcs={this.state.rpcs}
                    selectedRPC={this.state.selectedRPC}
                    selectedRPCName={this.state.selectedRPCName}
                    isValidRPC={this.state.isValidRPC}
                    onRpcChange={async rpc => {
                        this.setState({
                            trg: PerpChart.DefaultTRGState(),
                            wallet: PerpChart.DefaultWalletState(),
                        });
                        let rpcName = rpc;
                        for (let [name, v] of this.state.rpcs) {
                            if (v === rpc) {
                                rpcName = name;
                                break;
                            }
                        }
                        this.fetchManifest(rpcName, rpc);
                    }}
                    wallet={{
                        ...this.state.wallet,
                        handleWalletDropdownChange: this.handleWalletDropdownChange.bind(this),
                        connectWallet: this.connectWallet.bind(this),
                        disconnectWallet: this.disconnectWallet.bind(this),
                    }}
                    trg={{
                        ...this.state.trg,
                        handleTRGDropdownChange: this.handleTRGDropdownChange.bind(this),
                        handleATMChange: this.handleATMChange.bind(this),
                    }}
                    gun={{
                        ...this.state.gun,
                        handleGunDropdownChange: this.handleGunDropdownChange.bind(this),
                        handleGunSizeChange: this.handleGunSizeChange.bind(this),
                        handleGunPriceChange: this.handleGunPriceChange.bind(this),
                    }}
                />
                <div className="AppBody">
                    <Books
                        mpg={this.state.manifest?.fields?.mpgs?.get(this.state.selectedMPG)}
                        books={this.state.books}
                        streamBooks={this.streamBooks.bind(this)}
                    />
                    {/*
                    <MPG
                        mpg={this.state.manifest?.fields?.mpgs?.get(this.state.selectedMPG)}
                        books={this.state.books}
                        onStreamBooks={this.streamBooks.bind(this)}
                    />
                    <TRGBrowser
                        isFetchingTRG={this.state.trg.isFetching}
                        isValidTRG={this.state.trg.isValid}
                        trgUpdateTime={this.state.trg.updateTime}
                        selectedTRG={this.state.trg.selectedTRG}
                        selectedTRGObject={this.state.trg.selectedTRGObject}
                        selectedTrader={this.state.trg.selectedTrader}
                        pastTrgs={this.state.trg.pastTrgs}
                        onTrgChange={async trgStr => {
                            await this.fetchTRG(trgStr);
                        }}
                        timeTravelToDate={this.timeTravelToDate.bind(this)}
                        manifest={this.state.manifest}
                        isFetchingWallet={this.state.wallet.isFetching}
                        selectedWallet={this.state.wallet.selectedWallet}
                        walletTrgs={this.state.wallet.trgs}
                    />
                     */}
                </div>
            </div>
        );
    }
}
 
function getSolflareProvider() {
    if ('solflare' in window) {
        return window.solflare;
    }
    window.open('https://solflare.com', '_blank');
};

function getPhantomProvider() {
    if ("phantom" in window) {
        const provider = window.phantom?.solana;
        if (provider?.isPhantom) {
            return provider;
        }
    }
    window.open("https://phantom.app/", "_blank");
}

export default PerpChart;
