pragma solidity ^0.4.23;

import "./EtherDividendCheckpoint.sol";
import "../../interfaces/IModuleFactory.sol";


contract EtherDividendCheckpointFactory is IModuleFactory {

    /**
     * @dev Constructor
     * @param _polyAddress Address of the polytoken
     */
    constructor (address _polyAddress, uint256 _setupCost, uint256 _usageCost, uint256 _subscriptionCost) public
    IModuleFactory(_polyAddress, _setupCost, _usageCost, _subscriptionCost)
    {

    }

    /**
     * @dev used to launch the Module with the help of factory
     * @return address Contract address of the Module
     */
    function deploy(bytes /* _data */) external returns(address) {
        if(setupCost > 0)
            require(polyToken.transferFrom(msg.sender, owner, setupCost), "Failed transferFrom because of sufficent Allowance is not provided");
        return address(new EtherDividendCheckpoint(msg.sender, address(polyToken)));
    }

    /**
     * @dev Type of the Module factory
     */
    function getType() public view returns(uint8) {
        return 4;
    }

    /**
     * @dev Get the name of the Module
     */
    function getName() public view returns(bytes32) {
        return "EtherDividendCheckpoint";
    }

    /**
     * @dev Get the description of the Module
     */
    function getDescription() public view returns(string) {
        return "Create ETH dividends for token holders at a specific checkpoint";
    }

    /**
     * @dev Get the title of the Module
     */
    function getTitle() public  view returns(string) {
        return "Ether Dividend Checkpoint";
    }

    /**
     * @dev Get the Instructions that helped to used the module
     */
    function getInstructions() public view returns(string) {
        return "Create a dividend which will be paid out to token holders proportional to their balances at the point the dividend is created";
    }

    /**
     * @dev Get the tags related to the module factory
     */
    function getTags() public view returns(bytes32[]) {
        bytes32[] memory availableTags = new bytes32[](0);
        return availableTags;
    }
}
