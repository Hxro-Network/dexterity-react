import React from "react";
import dexterity from '@hxronetwork/dexterity-ts';
import Pubkey from './Pubkey.js';
import './TRGSelector.css';

class TRGSelector extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const trgs = [];
        trgs.push(
            <option value="">Select a trading account...</option>
        );
        if (this.props.trgs) {
            for (const trg of this.props.trgs) {
                const pubkeyStr = trg.pubkey.toString();
                trgs.push(
                    <option value={pubkeyStr} selected={this.props.selectedTRG === pubkeyStr}>{pubkeyStr}</option>
                );
            }
        }
        return (
            <div className="TRGSelector">
                <select onChange={this.props.handleTRGDropdownChange}>
                    {trgs}
                </select>
            </div>
        );
    }
}

export default TRGSelector;
