// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Airdrop is Ownable {
    IERC20 public monToken;
    address public gameContract;
    uint256 public constant AIRDROP_AMOUNT = 0.8 * 10**18; // 0.8 MON (assuming 18 decimals)
    
    // Track which addresses have claimed their airdrop
    mapping(address => bool) public hasClaimed;
    
    // Track which addresses have interacted with the game
    mapping(address => bool) public hasInteractedWithGame;
    
    event AirdropClaimed(address indexed recipient, uint256 amount);
    event TokensWithdrawn(address indexed owner, uint256 amount);
    
    constructor(address _monToken, address _gameContract) {
        require(_monToken != address(0), "Invalid token address");
        require(_gameContract != address(0), "Invalid game contract address");
        
        monToken = IERC20(_monToken);
        gameContract = _gameContract;
    }
    
    // Only the game contract can call this to mark an address as having interacted
    function markAsInteracted(address _user) external {
        require(msg.sender == gameContract, "Only game contract can call this");
        hasInteractedWithGame[_user] = true;
    }
    
    // Claim airdrop - can only be called by the user's wallet
    function claimAirdrop() external {
        require(!hasClaimed[msg.sender], "Airdrop already claimed");
        require(!hasInteractedWithGame[msg.sender], "Already interacted with game");
        
        // Verify the contract has enough tokens
        uint256 contractBalance = monToken.balanceOf(address(this));
        require(contractBalance >= AIRDROP_AMOUNT, "Insufficient tokens in contract");
        
        // Mark as claimed before transfer to prevent reentrancy
        hasClaimed[msg.sender] = true;
        
        // Transfer tokens to the user
        bool success = monToken.transfer(msg.sender, AIRDROP_AMOUNT);
        require(success, "Token transfer failed");
        
        emit AirdropClaimed(msg.sender, AIRDROP_AMOUNT);
    }
    
    // Owner can withdraw remaining tokens
    function withdrawTokens(uint256 amount) external onlyOwner {
        uint256 balance = monToken.balanceOf(address(this));
        require(amount <= balance, "Insufficient balance");
        
        bool success = monToken.transfer(owner(), amount);
        require(success, "Token transfer failed");
        
        emit TokensWithdrawn(owner(), amount);
    }
    
    // Update the game contract address if needed
    function setGameContract(address _gameContract) external onlyOwner {
        require(_gameContract != address(0), "Invalid address");
        gameContract = _gameContract;
    }
    
    // Check if a user is eligible for airdrop
    function isEligible(address _user) external view returns (bool) {
        return !hasClaimed[_user] && !hasInteractedWithGame[_user];
    }
}
