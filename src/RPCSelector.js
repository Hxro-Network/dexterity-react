import React from "react";
import dexterity from '@hxronetwork/dexterity-ts';
import './RPCSelector.css';

const INVALID_RPC_STYLE = {
    border: 'solid 1px red',
    boxShadow: '1px 1px 5px 1px red',
    color: 'red',
};

class RPCSelector extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const rpcs = [];
        for (let [name, rpc] of this.props.rpcs) {
            rpcs.push(
                <option
                    key={rpc}
                    value={rpc}
                    selected={rpc === this.props.selectedRPC}
                >
                    {name}
                </option>
            );
        }
        return (
            <div className="RPCSelector">
                <div>Network</div>
                <div>
                    <input type="text"
                           onChange={e => this.props.onChange(e.target.value)}
                           placeholder="RPC (start typing)"
                           value={this.props.selectedRPCName}
                           list="hxroswap-rpcs"
                           isValid={this.props.isValid}
                           style={this.props.isValid ? {} : INVALID_RPC_STYLE}
                    />
                    <datalist id="hxroswap-rpcs">
                        {rpcs.length > 0 ? rpcs : (<option disabled selected>No RPCs Available</option>)}
                    </datalist>
                </div>
            </div>
        );
    }
}

export default RPCSelector;
