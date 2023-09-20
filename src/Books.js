import BN from 'bn.js';
import dexterity from '@hxronetwork/dexterity-ts';
import React from "react";
import Book from './Book';
import './Books.css';

class Books extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isStreamingBook: {} // maps product key to bool
        }
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
        let books = [];
        if (this.props.mpg) {
            const ps = dexterity.Manifest.GetProductsOfMPG(this.props.mpg.mpg);
            let keys = Array.from(ps.keys());
            keys.sort((a, b) => {
                const aIsCombo = a.includes('COMBO');
                const bIsCombo = b.includes('COMBO');
                if (aIsCombo && bIsCombo) {
                    return a < b; // TODO could sort chronologically                                                                                                                                                  
                } else if (aIsCombo && !bIsCombo) {
                    return true;
                } else if (!aIsCombo && bIsCombo) {
                    return false;
                }
                const aIsPerp = a.includes('PERP');
                const bIsPerp = b.includes('PERP');
                if (aIsPerp && bIsPerp) {
                    return a < b; // this should never happen                                                                                                                                                         
                } else if (aIsPerp && !bIsPerp) {
                    return false;
                } else if (!aIsPerp && bIsPerp) {
                    return true;
                }
                a = a.slice('BTCUSD-'.length);
                b = b.slice('BTCUSD-'.length);
                const [aDay, aMonth, aYear] = a.split('-');
                const [bDay, bMonth, bYear] = b.split('-');
                const aDate = new Date(2000 + parseInt(aYear), Books.ParseMonth(aMonth), parseInt(aDay));
                const bDate = new Date(2000 + parseInt(bYear), Books.ParseMonth(bMonth), parseInt(bDay));
                return aDate >= bDate;
            });
            for (const productName of keys) {
                const { product } = ps.get(productName);
                let productStatus = 'Invalid';
                try {
                    productStatus = dexterity.productStatus(product, this.props.mpg.mpg.marketProducts.array);
                } catch (e) {
                    console.error('failed to get product status for', productName, product, this.props.mpg.mpg.marketProducts);
                    console.error(e);
                }
                let p;
                if (product.hasOwnProperty('outright')) {
                    p = product.outright.outright;
                } else if (product.hasOwnProperty('combo')) {
                    p = product.combo.combo;
                } else {
                    console.error('warning unrecognized product');
                    continue;
                }
                if (!(productName.includes('ETHUSD-PERP') || productName.includes('BTCUSD-PERP') || productName.includes('SOLUSD-PERP') || productName.includes('BITCOIN0D'))) {
                    continue;
                }
                const productKey = p.metadata.productKey.toBase58();
                if (!this.state.isStreamingBook[productKey]) {
                    this.setState({
                        ...this.state,
                        isStreamingBook: {
                            ...this.state.isStreamingBook,
                            [productKey]: true,
                        }
                    });
                    this.props.streamBooks(product);
                }
                books.push(
                    <Book book={this.props.books[productKey]} product={p}
                          productName={productName} productStatus={productStatus} />
                );
                if (books.length >= 4) {
                    break;
                }
            }
        }
        return (
            <div className="Books">
                {books.length > 0 ? books : 'Loading...'}
            </div>
        );
    }
}

export default Books;
