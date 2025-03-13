function ServerMsg(packetId) {
    this.packetId = packetId;
}

module.exports = ServerMsg;

// 91 : You have been banned
// 92 : Too many connections from your IP
// 93 : No more slots
// 94 : Too many nicks

ServerMsg.prototype.build = function() {
    var buf = new ArrayBuffer(16);
    var view = new DataView(buf);
    view.setUint8(0, this.packetId, true);
    view.setFloat64(1, this.packetId, true);
    return buf;
};