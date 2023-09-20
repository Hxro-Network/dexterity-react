import React from "react";
import dexterity from '@hxronetwork/dexterity-ts';
import './MPGSelector.css';

class MPGSelector extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const mpgs = [];
        for (let [pk, { mpg }] of this.props?.manifest?.fields?.mpgs ?? []) {
            mpgs.push(
                <option
                    key={pk}
                    value={pk}
                    selected={pk === this.props.selectedMPG}>
                    {dexterity.bytesToString(mpg.name) + ' (' + pk.slice(0,3) + '...)'}
                </option>
            );
        }
        return (
            <div className="MPGSelector">
                <div>Markets</div>
                <div>
                    <select
                        onChange={e => this.props.onChange(e.target.value)}
                    >
                        {mpgs.length > 0 ? mpgs : (<option disabled selected>Loading...</option>)}
                    </select>
                </div>
            </div>
        );
    }
}

export default MPGSelector;
