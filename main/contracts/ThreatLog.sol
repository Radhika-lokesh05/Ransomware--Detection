// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ThreatLog {
    struct LogEntry {
        string message;
        uint256 timestamp;
    }

    LogEntry[] public logs;

    event LogAdded(string message, uint256 timestamp);

    function addLog(string memory _message) public {
        logs.push(LogEntry({
            message: _message,
            timestamp: block.timestamp
        }));
        emit LogAdded(_message, block.timestamp);
    }

    function getLogs() public view returns (LogEntry[] memory) {
        return logs;
    }
}
