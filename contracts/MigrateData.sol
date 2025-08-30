// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Old contract interface (read-only)
interface IOldContract {
    function userSlapCount(address user) external view returns (uint256);
    function userLeaderboardIndex(address user) external view returns (uint256);
    function leaderboard(uint256 index) external view returns (
        address user,
        uint256 slapCount,
        uint256 lastSlapTimestamp
    );
    function getLeaderboardLength() external view returns (uint256);
}

// New contract interface (write)
interface INewContract {
    function setUserData(
        address user,
        uint256 slapCount,
        uint256 lastSlapTimestamp
    ) external;
    function addPlayer(address user) external;
}

/**
 * @title MigrateData
 * @dev Helper contract to migrate data from old GaslessFrameViewer to new SimpleFrameViewer
 * @dev This contract reads data from the old contract and can be used to populate the new one
 */
contract MigrateData {
    
    // Owner tracking
    address public owner;
    
    IOldContract public oldContract;
    INewContract public newContract;
    
    // Events
    event MigrationStarted(uint256 totalUsers);
    event UserMigrated(address indexed user, uint256 slapCount, uint256 timestamp);
    event MigrationCompleted(uint256 totalMigrated);
    
    constructor(address _oldContract, address _newContract) {
        require(_oldContract != address(0), "Invalid old contract address");
        require(_newContract != address(0), "Invalid new contract address");
        
        owner = msg.sender;
        oldContract = IOldContract(_oldContract);
        newContract = INewContract(_newContract);
    }
    
    // Modifier for owner-only functions
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    /**
     * @dev Migrate a single user's data
     */
    function migrateUser(address user) external onlyOwner {
        require(user != address(0), "Invalid user address");
        
        uint256 slapCount = oldContract.userSlapCount(user);
        if (slapCount > 0) {
            // Get the user's data from the old leaderboard
            uint256 leaderboardIndex = oldContract.userLeaderboardIndex(user);
            if (leaderboardIndex > 0) {
                (address _user, uint256 _slapCount, uint256 _lastSlapTimestamp) = 
                    oldContract.leaderboard(leaderboardIndex - 1);
                
                // Set the data in the new contract
                newContract.setUserData(_user, _slapCount, _lastSlapTimestamp);
                newContract.addPlayer(_user);
                
                emit UserMigrated(_user, _slapCount, _lastSlapTimestamp);
            }
        }
    }
    
    /**
     * @dev Migrate all users from the old leaderboard
     */
    function migrateAllUsers() external onlyOwner {
        uint256 length = oldContract.getLeaderboardLength();
        require(length > 0, "No users to migrate");
        
        emit MigrationStarted(length);
        
        uint256 migratedCount = 0;
        
        for (uint256 i = 0; i < length; i++) {
            (address user, uint256 slapCount, uint256 lastSlapTimestamp) = 
                oldContract.leaderboard(i);
            
            if (slapCount > 0) {
                newContract.setUserData(user, slapCount, lastSlapTimestamp);
                newContract.addPlayer(user);
                migratedCount++;
                
                emit UserMigrated(user, slapCount, lastSlapTimestamp);
            }
        }
        
        emit MigrationCompleted(migratedCount);
    }
    function debugOwnership() external view returns (
    address currentOwner,
    address msgSender,
    bool isOwner
    ) {
    currentOwner = owner;
    msgSender = msg.sender;
    isOwner = (msg.sender == owner);
    return (currentOwner, msgSender, isOwner);
    }

    /**
     * @dev Test function to verify the modifier works
     */
    function testModifier() external onlyOwner returns (string memory) {
    // Copy the migration logic here
    uint256 length = oldContract.getLeaderboardLength();
    require(length > 0, "No users to migrate");
    
    uint256 migratedCount = 0;
    
    for (uint256 i = 0; i < length; i++) {
        (address user, uint256 slapCount, uint256 lastSlapTimestamp) = 
            oldContract.leaderboard(i);
        
        if (slapCount > 0) {
            newContract.setUserData(user, slapCount, lastSlapTimestamp);
            newContract.addPlayer(user);
            migratedCount++;
        }
    }
    
    return "Migration completed successfully";
    }
    
    /**
     * @dev Get user data from old contract for verification
     */
    function getUserDataFromOld(address user) external view returns (
        uint256 slapCount,
        uint256 leaderboardIndex,
        bool inLeaderboard
    ) {
        require(user != address(0), "Invalid user address");
        
        slapCount = oldContract.userSlapCount(user);
        leaderboardIndex = oldContract.userLeaderboardIndex(user);
        inLeaderboard = leaderboardIndex > 0;
    }
    
    /**
     * @dev Get leaderboard entry from old contract
     */
    function getLeaderboardEntry(uint256 index) external view returns (
        address user,
        uint256 slapCount,
        uint256 lastSlapTimestamp
    ) {
        uint256 length = oldContract.getLeaderboardLength();
        require(index < length, "Index out of bounds");
        
        return oldContract.leaderboard(index);
    }
    
    /**
     * @dev Get total leaderboard length from old contract
     */
    function getOldLeaderboardLength() external view returns (uint256) {
        return oldContract.getLeaderboardLength();
    }
    
    /**
     * @dev Fallback function to prevent accidental ETH transfers
     */
    receive() external payable {
        revert("This contract does not accept ETH");
    }
    
    /**
     * @dev Fallback function to prevent accidental calls
     */
    fallback() external {
        revert("Function not found");
    }
}
