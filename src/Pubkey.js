import React from "react";
import './Pubkey.css';

class Pubkey extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isShown: false
        };
    }
    render() {
        return (
            <div className="Pubkey" onClick={_ => { navigator.clipboard.writeText(this.props.pubkey) }}>
                <div>{this.props.pubkey ? (this.state.isShown ? this.props.pubkey : this.props.pubkey.slice(0,5) + '...') : 'Loading...'}</div>
                <div>📋</div>
                <div onClick={_ => this.setState({ isShown: true })}>+</div>
            </div>
        );
    }
}

export default Pubkey;
