import React from "react";
import BN from 'bn.js';
import dexterity from '@hxronetwork/dexterity-ts';
import Pubkey from './Pubkey.js';
import './Gun.css';

const VALID_GUN_STYLE = { width: '10rem' };
const INVALID_GUN_STYLE = {
    border: 'solid 1px red',
    boxShadow: '1px 1px 5px 1px red',
    color: 'red',
    width: '10rem',
};

class Gun extends React.Component {
    constructor(props) {
        super(props);
    }

    static ParseMonth(month) {
        if (month === 'JAN') {
            return 0;
        } else if (month === 'FEB') {
            return 1;
        } else if (month === 'MAR') {
            return 2;
        } else if (month === 'APR') {
            return 3;
        } else if (month === 'MAY') {
            return 4;
        } else if (month === 'JUN') {
            return 5;
        } else if (month === 'JUL') {
            return 6;
        } else if (month === 'AUG') {
            return 7;
        } else if (month === 'SEP') {
            return 8;
        } else if (month === 'OCT') {
            return 9;
        } else if (month === 'NOV') {
            return 10;
        } else if (month === 'DEC') {
            return 11;
        }
        return NaN;
    }

    render() {
        let products = [];
        products.push(
            <option value="">Select a product...</option>
        );
        if (this.props.mpg) {
            const ps = dexterity.Manifest.GetProductsOfMPG(this.props.mpg.mpg);
            let keys = Array.from(ps.keys());
            keys.sort((a, b) => {
                const aIsCombo = a.includes('COMBO');
                const bIsCombo = b.includes('COMBO');
                if (aIsCombo && bIsCombo) {
                    return a > b; // TODO could sort chronologically                                                                                                                                                  
                } else if (aIsCombo && !bIsCombo) {
                    return true;
                } else if (!aIsCombo && bIsCombo) {
                    return false;
                }
                const aIsPerp = a.includes('PERP');
                const bIsPerp = b.includes('PERP');
                if (aIsPerp && bIsPerp) {
                    return a > b; // this should never happen                                                                                                                                                         
                } else if (aIsPerp && !bIsPerp) {
                    return false;
                } else if (!aIsPerp && bIsPerp) {
                    return true;
                }
                a = a.slice('BTCUSD-'.length);
                b = b.slice('BTCUSD-'.length);
                const [aDay, aMonth, aYear] = a.split('-');
                const [bDay, bMonth, bYear] = b.split('-');
                const aDate = new Date(2000 + parseInt(aYear), Gun.ParseMonth(aMonth), parseInt(aDay));
                const bDate = new Date(2000 + parseInt(bYear), Gun.ParseMonth(bMonth), parseInt(bDay));
                return aDate >= bDate;
            });
            for (const productName of keys) {
                const { index, product } = ps.get(productName);
                let productStatus = 'Invalid';
                try {
                    productStatus = dexterity.productStatus(product, this.props.mpg.mpg.marketProducts.array);
                } catch (e) {
                    console.error('failed to get product status for', productName, product, this.props.mpg.mpg.marketProducts);
                    console.error(e);
                    products.push(
                        <option disabled value={index} selected={this.props.gun.selectedProductIndex == index}>{productName.trim()}</option>
                    );
                    continue;
                }
                if (productStatus !== 'initialized') {
                    products.push(
                        <option disabled value={index} selected={this.props.gun.selectedProductIndex == index}>{productName.trim()}</option>
                    );
                    continue;
                }
                products.push(
                    <option value={index} selected={this.props.gun.selectedProductIndex == index}>{productName.trim()}</option>
                );
            }
        }
        const priceFrac = dexterity.Fractional.FromString(this.props.gun.price);
        const sizeFrac = dexterity.Fractional.FromString(this.props.gun.size);
        const productIndex = parseInt(this.props.gun.selectedProductIndex);
        const isGunDisabled = isNaN(productIndex) || priceFrac.isNan() || sizeFrac.isNan();
        return (
            <div className="Gun">
                <div>
                    <select onChange={this.props.gun.handleGunDropdownChange}>
                        {products}
                    </select>
                </div>
                <div>
                    <input type="text"
                           onChange={this.props.gun.handleGunSizeChange}
                           placeholder="size"
                           value={this.props.gun.size}
                           isValid={this.props.gun.isValidSize}
                           style={this.props.gun.isValidSize ? VALID_GUN_STYLE : INVALID_GUN_STYLE}
                    />
                </div>
                <div>
                    <input type="text"
                           onChange={this.props.gun.handleGunPriceChange}
                           placeholder="price"
                           value={this.props.gun.price}
                           isValid={this.props.gun.isValidPrice}
                           style={this.props.gun.isValidPrice ? VALID_GUN_STYLE : INVALID_GUN_STYLE}
                    />
                </div>
                <div>
                    <button className={isGunDisabled ? 'GunButtonDisabled' : 'GunBuyButton'}
                            disabled={isGunDisabled}
                            onClick={async _ => {
                                try {
                                    await this.props.trg.trader.newOrder(productIndex, true, priceFrac, sizeFrac);
                                } catch (e) {
                                    console.error(e, e.logs);
                                }
                            }}
                    >BUY</button>
                </div>
                <div>
                    <button className={isGunDisabled ? 'GunButtonDisabled' : 'GunSellButton'}
                            disabled={isGunDisabled}
                            onClick={async _ => {
                                try {
                                    await this.props.trg.trader.newOrder(productIndex, false, priceFrac, sizeFrac);
                                } catch (e) {
                                    console.error(e, e.logs);
                                }
                            }}
                    >SELL</button>
                </div>
                <div>
                    <button className={'GunCancelButton'}
                            onClick={_ => {
                                this.props.trg.trader.cancelAllOrders([]);
                            }}
                    >CANCEL ALL</button>
                </div>
            </div>
        );
    }
}

export default Gun;
