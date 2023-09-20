import React from "react";
import dexterity from '@hxronetwork/dexterity-ts';
import Pubkey from './Pubkey.js';
import './WalletConnector.css';

class WalletConnector extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        return (
            <div className="WalletConnector">
                {!this.props.isWalletConnected ? (
                    <>
                        <select onChange={this.props.handleWalletDropdownChange}>
                            <option value="" selected={this.props.walletProviderStr === ''}>Select wallet provider</option>
                            <option value="solflare" selected={this.props.walletProviderStr === 'solflare'}>Solflare</option>
                            <option value="phantom" selected={this.props.walletProviderStr === 'phantom'}>Phantom</option>
                        </select>
                        <button onClick={this.props.connectWallet}>Connect Wallet</button>
                    </>
                ) : (
                    <>
                        <div>Wallet:</div>
                        <Pubkey pubkey={this.props.walletProvider.publicKey.toString()} />
                        <button onClick={this.props.disconnectWallet}>Disconnect Wallet</button>
                    </>
                )}
            </div>
        );
    }
}

export default WalletConnector;
