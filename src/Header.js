import React from "react";
import Gun from './Gun.js';
import MPGSelector from './MPGSelector.js';
import RPCSelector from './RPCSelector.js';
import WalletConnector from './WalletConnector.js';
import TRGSelector from './TRGSelector.js';
import dexterity from '@hxronetwork/dexterity-ts';
import './Header.css';

function getPositions(trader) {
    const UNINITIALIZED = '11111111111111111111111111111111';
    let m = new Map();
    for (let p of trader.trg.traderPositions) {
        if (p.productKey.toBase58() === UNINITIALIZED || "uninitialized" in p.tag || dexterity.Fractional.From(p.position).eq(dexterity.Fractional.Zero())) {
            continue;
        }
        const meta = dexterity.productToMeta(trader.mpg.marketProducts.array[p.productIndex.toNumber()]);
        m.set(p.productIndex.toNumber(), { productName: dexterity.bytesToString(meta.name), position: dexterity.Fractional.From(p.position), markPrice: dexterity.Manifest.GetMarkPrice(trader.markPrices, p.productKey) });
    }
    return m;
}

class Header extends React.Component {
    constructor(props) {
        super(props);
    }

    getManifestRPCName() {
        const rpc = this.props.manifest.fields.rpc;
        let rpcName = rpc; // if rpc's name not found in map, then go with raw rpc
        for (let [name, v] of this.props.rpcs) {
            if (v === rpc) {
                rpcName = name;
                break;
            }
        }
        return rpcName;
    }

    getManifestCacheTime() {
        return new Date(this.props.manifest.fields.creationTime);
    }

    getManifestCacheTimeString() {
        const cacheDate = this.getManifestCacheTime();
        let diff = Math.round((Date.now() - cacheDate) / 1000);
        let units = 'seconds'
        if (diff > 60) {
            diff = Math.round(diff / 60);
            units = 'minutes';
            if (diff > 60) {
                diff = Math.round(diff / 60);
                units = 'hours';
                if (diff > 24) {
                    diff = Math.round(diff / 24);
                    units = 'days';
                    if (diff > 365) {
                        diff = Math.round(diff / 365);
                        units = 'years';
                    } // lol
                }
            }
        }
        return '~' + diff + ' ' + units + ' ago';
    }

    getManifestStatusString() {
        if (this.props.manifest?.fields) {
            return 'Currently displaying the "' + this.getManifestRPCName() + '" manifest which was cached ' + this.getManifestCacheTimeString();
        }
        return 'No manifest has been fetched yet.';
    }

    render() {
        let [manifestString, manifestTitleString] = ['', ''];
        if (this.props.isFetchingManifest) {
            manifestString += ' Fetching data from chain... ';
            manifestTitleString = '(this can take a while on devnet)';
            manifestString += this.getManifestStatusString();
        } else if (!this.props.isValidRPC) {
            manifestString = 'Invalid RPC. ';
            manifestTitleString = '(make sure you specify http:// or https://)';
            manifestString += this.getManifestStatusString();
        } else { // not fetching and is valid
            manifestString = 'Fully up to date.';
            if (this.props.manifest?.fields) {
                manifestString += ' Cached the "' + this.props.selectedRPCName + '" manifest ' + this.getManifestCacheTimeString();
                manifestTitleString = this.getManifestCacheTime() + '';
            }
        }
        const positions = [];
        if (this.props.trg.trader !== null) {
            const ps = getPositions(this.props.trg.trader);
            for (const [productIndex, { productName, position, markPrice }] of ps) {
                const notional = position.mul(markPrice);
                positions.push(
                    <>
                        <div>{productName.trim()}:</div>
                        <div>{position.toString(undefined, true)}</div>
                        {notional.gt(dexterity.Fractional.Zero()) ?
                         (<div style={{color: 'green'}}>{'$' + notional.toString(2, true)}</div>) :
                         (<div style={{color: 'red'}}>{'-$' + notional.abs().toString(2, true)}</div>)}
                    </>
                );
            }
        } else {
            positions.push(<div>This trading account holds no positions...</div>);
        }
        const openOrders = [];
        if (this.props.trg.trader !== null) {
            for (const [productName, _] of this.props.trg.trader.getPositions()) {
                const trimmedName = productName.trim();
                for (const order of this.props.trg.trader.getOpenOrders([trimmedName])) {
                    openOrders.push(
                        <div className="OpenOrder">
                            <div>{trimmedName}</div>
                            {order.isBid ? (<div className="Bid">bid</div>) : (<div className="Ask">ask</div>)}
                            <div>{'$' + order.price.toString()}</div>
                            <div>{order.qty.toString(undefined, true)}</div>
                            <div style={{color: 'grey'}}>{'value: $' + order.price.mul(order.qty).toString(2, true)}</div>
                            <div><button
                                     onClick={async _ => {
                                         try {
                                             await this.props.trg.trader.cancelOrder(order.productIndex, order.id);
                                         } catch (e) {
                                             console.error(e);
                                             console.error(e.logs);
                                         }
                                     }}
                                 >CANCEL</button></div>
                        </div>
                    );
                }
            }
        }
        if (openOrders.length <= 0) {
            openOrders.push(<div>No open orders!</div>);
        }
        return (
            <div className="Header">
                <div class="HeaderFirstRow">
                    <div title={manifestTitleString}>{manifestString.trim()}</div>
                </div>
                <div className="HeaderSecondRow">
                    <RPCSelector
                        rpcs={this.props.rpcs}
                        selectedRPC={this.props.selectedRPC}
                        selectedRPCName={this.props.selectedRPCName}
                        isValid={this.props.isValidRPC}
                        onChange={this.props.onRpcChange}
                    />
                    <MPGSelector
                        manifest={this.props.manifest}
                        selectedMPG={this.props.selectedMPG}
                        onChange={this.props.onMpgChange}
                    />
                    <WalletConnector
                        {...this.props.wallet}
                    />
                    <TRGSelector
                        {...this.props.trg}
                    />
                    <button
                        onClick={async _ => {
                            const trgPubkey = await this.props.manifest.createTrg(new dexterity.web3.PublicKey(this.props.selectedMPG));
                            this.props.trg.handleTRGDropdownChange({ target: { value: trgPubkey.toString() } }, true);
                        }}>
                        Create Trading Account
                    </button>
                </div>
                {this.props.trg.trader !== null &&
                 <>
                     <div class="HeaderRow">
                         {
                             // <div>Risk Update Slot:</div>
                             // <div>{this.props.trg.trader.getVarianceCacheUpdateSlot().toString()}</div>
                         }
                         <button onClick={_ => { this.props.trg.trader.updateVarianceCache(); } }>Update Risk Profile</button>
                         <div>Portfolio Value:</div>
                         <div>{'$' + this.props.trg.trader.getPortfolioValue().toString(2, true)}<span style={{color: 'grey'}}>{!this.props.trg.trader.trgSlot || this.props.trg.trader.trgSlot > this.props.trg.trader.getVarianceCacheUpdateSlot() ? ' (could be out of date)' : ' (up to date; ' + (this.props.trg.trader.getPortfolioValue().gt(this.props.trg.trader.getRequiredInitialMargin()) ? 'healthy' : (this.props.trg.trader.getPortfolioValue().gt(this.props.trg.trader.getRequiredMaintenanceMargin()) ? 'unhealthy' : 'liquidatable')) + ')'}</span></div>
                         <div>Cancel-Only Level:</div>
                         <div>{'$' + this.props.trg.trader.getRequiredInitialMargin().toString(2, true)}</div>
                         <div>Liquidatable Level:</div>
                         <div>{'$' + this.props.trg.trader.getRequiredMaintenanceMargin().toString(2, true)}{false && this.props.trg.trader.getRequiredMaintenanceMargin().gt(dexterity.Fractional.Zero()) && <span style={{color: 'grey'}}>{' (' + this.props.trg.trader.getPortfolioValue().div(this.props.trg.trader.getRequiredMaintenanceMargin()).sub(dexterity.Fractional.One()).mul(dexterity.Fractional.New(100, 0)).toString(1) + '% portfolio decline required)'}</span>}</div>
                         <div>
                             <input type="text"
                                    onChange={this.props.trg.handleATMChange}
                                    placeholder="1000 USDC"
                                    value={this.props.trg.atmValue}
                                    style={{width: '7rem'}}
                             />
                         </div>
                         <div>
                             <button className={'ATMButton'}
                                     onClick={_ => {
                                         try {
                                             this.props.trg.trader.deposit(dexterity.Fractional.FromString(this.props.trg.atmValue));
                                         } catch (e) {
                                             console.error(e);
                                             console.error(e.logs);
                                         }
                                     }}
                             >DEPOSIT</button>
                         </div>
                         <div>
                             <button className={'ATMButton'}
                                     onClick={_ => {
                                         try {
                                             this.props.trg.trader.withdraw(dexterity.Fractional.FromString(this.props.trg.atmValue));
                                         } catch (e) {
                                             console.error(e);
                                             console.error(e.logs);
                                         }
                                     }}
                             >WITHDRAW</button>
                         </div>
                     </div>
                     <div class="HeaderRow">
                         {positions}
                     </div>
                     <div class="HeaderRow">
                         <Gun gun={{...this.props.gun}} trg={{...this.props.trg}} mpg={this.props.manifest?.fields?.mpgs?.get(this.props.selectedMPG)} />
                     </div>
                     <div class="HeaderRow">
                         {openOrders}
                     </div>
                 </>
                }
            </div>
        );
    }
}

export default Header;
