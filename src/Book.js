import BN from 'bn.js';
import dexterity from '@hxronetwork/dexterity-ts';
import React from "react";
import './Book.css';
import Ladder from './Ladder';
import AxisMode from './AxisMode';
import QuantityMode from './QuantityMode';

const MAX_ASK = new BN(2).pow(new BN(63)).subn(1);
const MIN_BID = new BN(2).pow(new BN(63)).neg();
const ZERO_BN = new BN(0);

function getPriceStrings(p, quoteDecimals) { // p is a product.outright.outright or product.combo.combo
    const askPriceFrac = dexterity.Fractional.From(p.metadata.prices.ask);
    const bidPriceFrac = dexterity.Fractional.From(p.metadata.prices.bid);
    const bookPriceFrac = askPriceFrac.add(bidPriceFrac).div(dexterity.Fractional.New(2, 0));
    const isAskValid = !(askPriceFrac.m.eq(MAX_ASK) && askPriceFrac.exp.eq(ZERO_BN));
    const isBidValid = !(bidPriceFrac.m.eq(MIN_BID) && bidPriceFrac.exp.eq(ZERO_BN));
    let bidPrice, askPrice, bookPrice;
    if (isAskValid && isBidValid) {
        bidPrice = '$'+bidPriceFrac.toString(quoteDecimals, true);
        askPrice = '$'+askPriceFrac.toString(quoteDecimals, true);
        bookPrice = '$'+bookPriceFrac.toString(quoteDecimals, true);
    } else if (isAskValid) {
        bidPrice = 'No bid';
        askPrice = '$'+askPriceFrac.toString(quoteDecimals, true);
        bookPrice = '$'+askPriceFrac.toString(quoteDecimals, true) + ' (No bid)';
    } else if (isBidValid) {
        bidPrice = '$'+bidPriceFrac.toString(quoteDecimals, true);
        askPrice = 'No ask';
        bookPrice = '$'+bidPriceFrac.toString(quoteDecimals, true) + ' (No ask)';
    } else {
        bidPrice = 'No bid';
        askPrice = 'No ask';
        bookPrice = 'No bid or ask';
    }    
    const prevAskPriceFrac = dexterity.Fractional.From(p.metadata.prices.prevAsk);
    const prevBidPriceFrac = dexterity.Fractional.From(p.metadata.prices.prevBid);
    const prevAskPrice = (prevAskPriceFrac.m.eq(MAX_ASK) && prevAskPriceFrac.exp.eq(ZERO_BN))
          ? 'No prev. ask' : '$'+prevAskPriceFrac.toString(quoteDecimals, true);
    const prevBidPrice = (prevBidPriceFrac.m.eq(MIN_BID) && prevBidPriceFrac.exp.eq(ZERO_BN))
          ? 'No prev. bid' : '$'+prevBidPriceFrac.toString(quoteDecimals, true);
    return {
        askPrice,
        bidPrice,
        prevAskPrice,
        prevBidPrice,
        bookPrice,
    };
}

class Book extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isEmptyLevelsShown: false,
            isCumulativeQuantityShown: true,
            groupSize: null, // group levels together into buckets of this size (null or string)
            axisMode: AxisMode.Everything,
            quantityMode: QuantityMode.CumulativePerLevel,
            isDetailsOpen: false,
        }
    }

    render() {
        const quoteDecimals = dexterity.getPriceDecimals(this.props.product.metadata);
        const {
            askPrice,
            bidPrice,
            prevAskPrice,
            prevBidPrice,
            bookPrice,
        } = getPriceStrings(this.props.product, quoteDecimals);
        
        let indexPrice, markPrice;
        if (this.props.book) {
            indexPrice = '$'+this.props.book.indexPrice.toString(this.props.book.priceDecimals, true);
            markPrice = '$'+this.props.book.markPrice.toString(this.props.book.priceDecimals, true);
        } else {
            indexPrice = 'Loading...';
            markPrice = 'Loading...';
        }
        return (
            <div className="Book">
                <div className="BookTitleBar">
                    <div></div>
                    <div>
                        <div className="BookTitle">{this.props.productName}</div>
                        <div className="BookTitlePrice">🎯 {markPrice} | 📈 {indexPrice} | 📖 {bookPrice}</div>
                    </div>
                    <div>
                        <details open={this.state.isDetailsOpen} onToggle={_ => { this.setState({ isDetailsOpen: !this.state.isDetailsOpen }) } }>
                            <summary></summary>
                        </details>
                    </div>
                </div>
                {this.state.isDetailsOpen &&
                 <div className="BookDetails">
                 <div>Axis Mode</div><div><select value={this.state.axisMode} onChange={e => { this.setState({ axisMode: e.target.value }) } }>
                 <option value={AxisMode.Everything}>Everything</option>
                 <option value={AxisMode.Midpoint}>Midpoint</option>
                 <option value={AxisMode.UserControlled}>User Controlled</option>
                 </select></div>
                     <div>Group Levels</div><div><input type="text" placeholder="$0.00" style={{width: '10rem'}} onChange={e => { this.setState({ groupSize: e.target.value }) } }></input></div>
                 <div>Show Empty Levels</div><div><input type="checkbox"></input></div>
                     <div>Show Cumulative Qty</div><div><input type="checkbox" onChange={e => { this.setState({ isCumulativeQuantityShown: e.target.checked }) } }></input></div>
                 <div>Show Quantities</div><div><select value={this.state.quantityMode} onChange={e => { this.setState({ quantityMode: e.target.value }) } }>
                 <option value={QuantityMode.None}>None</option>
                 <option value={QuantityMode.PerOrder}>Per Order</option>
                 <option value={QuantityMode.PerLevel}>Per Level</option>
                 <option value={QuantityMode.CumulativePerLevel}>Cumulative Per Level</option>
                 </select></div>
                 </div>}
                <Ladder book={this.props.book} axisMode={this.state.axisMode}
                        isEmptyLevelsShown={this.state.isEmptyLevelsShown}
                        isCumulativeQuantityShown={this.state.isCumulativeQuantityShown}
                        groupSize={this.state.groupSize}
                        quantityMode={this.state.quantityMode}
                />
            </div>
        );
    }
}

export default Book;
