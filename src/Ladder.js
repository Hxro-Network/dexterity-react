import BN from 'bn.js';
import dexterity from '@hxronetwork/dexterity-ts';
import React from "react";
import './Ladder.css';
import AxisMode from './AxisMode';
import QuantityMode from './QuantityMode';

const ONE_HUNDRED = dexterity.Fractional.New(100, 0);
const MAX_LEVELS_PER_SIDE = 7;

class Ladder extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let indexPrice = 'No index price!';
        let markPrice = 'No mark price!';
        let spreadEma = 'No spread EMA!';
        const ticks = [];
        if (this.props.book) {
            indexPrice = this.props.book.indexPrice.toString(this.props.book.priceDecimals, true);
            markPrice = this.props.book.markPrice.toString(this.props.book.priceDecimals, true);
            spreadEma = this.props.book.spreadEma.toString(this.props.book.priceDecimals, true);
            const priceTick = dexterity.Fractional.New(1, this.props.book.priceDecimals);
            let groupSize = priceTick;
            try {
                groupSize = dexterity.Fractional.FromString(this.props.groupSize);
            } catch (e) {}
            if (groupSize.isNan() || groupSize.eq(dexterity.Fractional.Zero())) {
                groupSize = priceTick;
            }
            const priceLevels = [];
            let numAskLevels = 0;
            for (const ask of this.props.book.asks) {
                let priceBucket;
                if (groupSize.eq(priceTick)) {
                    priceBucket = ask.price;
                } else {
                    priceBucket = dexterity.Fractional.New(Math.ceil(ask.price.div(groupSize).toDecimal()), 0).mul(groupSize);
                }
                if (priceLevels.length > 0 && priceLevels[priceLevels.length-1].eq(priceBucket)) {
                    continue;
                }
                priceLevels.push(priceBucket);
                numAskLevels++;
            }
            let numBidLevels = 0;
            for (const bid of this.props.book.bids) {
                let priceBucket;
                if (groupSize.eq(priceTick)) {
                    priceBucket = bid.price;
                } else {
                    priceBucket = bid.price.div(groupSize).round_down(new BN(0)).mul(groupSize);
                }
                if (priceLevels.length > 0 && priceLevels[priceLevels.length-1].eq(priceBucket)) {
                    continue;
                }
                priceLevels.push(priceBucket);
                numBidLevels++;
            }
            let startIndex = 0, endIndex = priceLevels.length;
            if (this.props.axisMode == AxisMode.Midpoint) {
                if (numAskLevels > MAX_LEVELS_PER_SIDE) {
                    startIndex = numAskLevels - MAX_LEVELS_PER_SIDE;
                }
                if (numBidLevels > MAX_LEVELS_PER_SIDE) {
                    endIndex = numAskLevels + MAX_LEVELS_PER_SIDE;
                }
            }
            let shownLevels = priceLevels.slice(startIndex, endIndex);
            let cumBidQty = dexterity.Fractional.Zero();
            let maxQty = dexterity.Fractional.Zero();
            for (const price of shownLevels) {
                const lastPrice = price.add(groupSize);
                let levelQty = dexterity.Fractional.Zero();
                for (const bid of this.props.book.bids) {
                    if (bid.price.lt(price)) {
                        break;
                    }
                    if (bid.price.gte(price) && bid.price.lt(lastPrice)) {
                        levelQty = levelQty.add(bid.quantity);
                    }
                }
                if (levelQty.gt(maxQty)) {
                    maxQty = levelQty;
                }
                cumBidQty = cumBidQty.add(levelQty);
            }
            shownLevels.reverse();
            let cumAskQty = dexterity.Fractional.Zero();
            let cumAskQtys = [];
            for (const price of shownLevels) {
                const nextPrice = price.sub(groupSize);
                let levelQty = dexterity.Fractional.Zero();
                for (const ask of this.props.book.asks) {
                    if (ask.price.lte(nextPrice)) {
                        break;
                    }
                    if (ask.price.lte(price) && ask.price.gt(nextPrice)) {
                        levelQty = levelQty.add(ask.quantity);
                    }
                }
                if (levelQty.gt(maxQty)) {
                    maxQty = levelQty;
                }
                cumAskQty = cumAskQty.add(levelQty);
                cumAskQtys.push(cumAskQty);
            }
            if (this.props.isCumulativeQuantityShown) {
                maxQty = cumAskQty;
                if (cumBidQty.gt(maxQty)) {
                    maxQty = cumBidQty;
                }
            }
            cumBidQty = dexterity.Fractional.Zero();
            let cumAskQtyIndex = 0;
            for (const price of priceLevels.slice(startIndex, endIndex)) {
                const lastPrice = price.add(groupSize);
                const nextPrice = price.sub(groupSize);
                let asksGrid = '';
                const asks = [];
                let askQty = dexterity.Fractional.Zero();
                for (const ask of this.props.book.asks) {
                    if (ask.price.lte(nextPrice)) {
                        break;
                    }
                    if (ask.price.lte(price) && ask.price.gt(nextPrice)) {
                        asks.push(<div className="Order Ask">
                                      {this.props.quantityMode == QuantityMode.PerOrder ? ask.quantity.toString() : ''}
                                  </div>);
                        asksGrid += ask.quantity.div(maxQty).mul(ONE_HUNDRED).toString(0) + '%';
                        askQty = askQty.add(ask.quantity);
                    }
                }
                let cumAskQty = cumAskQtys[cumAskQtys.length-cumAskQtyIndex-1];
                if (this.props.isCumulativeQuantityShown && askQty.gt(dexterity.Fractional.Zero())) {
                    asks.push(<div className="Order CumAsk"></div>);
                    asksGrid += cumAskQty.sub(askQty).div(maxQty).mul(ONE_HUNDRED).toString(0) + '%';
                    // need to sub out the askQty ^^^ because of off-by-one indexing
                    // this only affects asks, not bids
                }
                cumAskQtyIndex += 1;
                let bidsGrid = '';
                const bids = [];
                let bidQty = dexterity.Fractional.Zero();
                for (const bid of this.props.book.bids) {
                    if (bid.price.lt(price)) {
                        break;
                    }
                    if (bid.price.gte(price) && bid.price.lt(lastPrice)) {
                        bids.push(<div className="Order Bid">
                                      {this.props.quantityMode == QuantityMode.PerOrder ? bid.quantity.toString() : ''}
                                  </div>);
                        bidsGrid += bid.quantity.div(maxQty).mul(ONE_HUNDRED).toString(0) + '%';
                        bidQty = bidQty.add(bid.quantity);
                    }
                }
                if (this.props.isCumulativeQuantityShown && bidQty.gt(dexterity.Fractional.Zero())) {
                    bids.push(<div className="Order CumBid"></div>);
                    bidsGrid += cumBidQty.div(maxQty).mul(ONE_HUNDRED).toString(0) + '%';
                }
                cumBidQty = cumBidQty.add(bidQty);
                ticks.push(<>
                               <div className="Bids" style={{gridTemplateColumns: bidsGrid}}>
                                   <>
                                   {bids}
                                   </>
                                   {this.props.quantityMode == QuantityMode.PerLevel && !bidQty.eq(dexterity.Fractional.Zero()) &&
                                    <div className="LevelQuantityOverlay LevelQuantityOverlayBid">{bidQty.toString()}</div>
                                   }
                                   {this.props.quantityMode == QuantityMode.CumulativePerLevel && !cumBidQty.eq(dexterity.Fractional.Zero()) &&
                                    <div className="LevelQuantityOverlay LevelQuantityOverlayBid">{cumBidQty.toString()}</div>
                                   }
                               </div>
                               <div className="Price">
                                   {price.toString(this.props.book.priceDecimals, true)}
                               </div>
                               <div className="Asks" style={{gridTemplateColumns: asksGrid}}>
                                   <>
                                   {asks}
                                   </>
                                   {this.props.quantityMode == QuantityMode.PerLevel && !askQty.eq(dexterity.Fractional.Zero()) &&
                                    <div className="LevelQuantityOverlay LevelQuantityOverlayAsk">{askQty.toString()}</div>
                                   }
                                   {this.props.quantityMode == QuantityMode.CumulativePerLevel && !cumAskQty.eq(dexterity.Fractional.Zero()) &&
                                    <div className="LevelQuantityOverlay LevelQuantityOverlayAsk">{cumAskQty.toString()}</div>
                                   }
                               </div>
                           </>);
            }
        }
        return (
            <div className="Ladder">
                {ticks.length > 0 ? ticks : 'Empty book'}
            </div>
        );
    }
}

export default Ladder;
