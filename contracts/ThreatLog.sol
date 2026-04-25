// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ThreatLog {
    
    // Struct to define the structure of a single log entry
    struct LogEntry {
        string message;
        uint256 timestamp;
    }

    // Array to store all the log entries
    LogEntry[] private logs;

    // Event emitted when a new log is added (useful for frontend listeners)
    event LogAdded(string message, uint256 timestamp);

    /**
     * @dev Adds a new threat log to the blockchain.
     * @param _message The description or signature of the detected threat.
     */
    function addLog(string memory _message) public {
        // Create the new log entry using block.timestamp
        LogEntry memory newLog = LogEntry({
            message: _message,
            timestamp: block.timestamp
        });

        // Push the entry into the state array
        logs.push(newLog);

        // Emit an event for off-chain indexing or frontend listeners
        emit LogAdded(_message, block.timestamp);
    }

    /**
     * @dev Retrieves the entire history of threat logs.
     * @return An array of LogEntry structs containing all recorded messages and timestamps.
     */
    function getLogs() public view returns (LogEntry[] memory) {
        return logs;
    }
}
