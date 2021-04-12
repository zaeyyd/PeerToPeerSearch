let net = require("net"),
  cPTPpacket = require("./cPTPmessage"),
  singleton = require("./Singleton");

let isFull = {};
let peersToJoin = [];
let declinePorts = [];
let maxPeers, peerLocation;

module.exports = {
  handleClientJoining: function (sock, maxPeers, sender, peerTable) {
    let peersCount = peerTable.length;
    if (peersCount >= maxPeers) {
      declineClient(sock, sender, peerTable);
    } else {
      handleClient(sock, sender, peerTable);
    }
  },

  handleCommunications: function (client, maxPeers, location, peerTable) {
    communicate(client, maxPeers, location, peerTable);
  },
};

function communicate(client, maxPeers, location, peerTable) {

  // get message from server

  client.on("data", (message) => {
    let bitMarker = 0;
    let version = parseBitPacket(message, 0, 3);
    bitMarker += 3;
    let msgType = parseBitPacket(message, 3, 8);
    bitMarker += 8;
    let numberOfPeers = parseBitPacket(message, 11, 13);
    bitMarker += 13;
    let SenderIDSize = parseBitPacket(message, 24, 8);
    bitMarker += 8;
    let sender = bytes2string(message.slice(4, SenderIDSize + 4));
    bitMarker += SenderIDSize * 8;
    let msgPeerTable = [];
    if (numberOfPeers > 0) {
      for (var i = 0; i < numberOfPeers; i++) {
        let firstOctet = parseBitPacket(message, bitMarker, 8);
        bitMarker += 8;
        let secondOctet = parseBitPacket(message, bitMarker, 8);
        bitMarker += 8;
        let thirdOctet = parseBitPacket(message, bitMarker, 8);
        bitMarker += 8;
        let forthOctet = parseBitPacket(message, bitMarker, 8);
        bitMarker += 8;
        let port = parseBitPacket(message, bitMarker, 16);

        bitMarker += 16;

        let aPeer = {
          peerIP:
            firstOctet +
            "." +
            secondOctet +
            "." +
            thirdOctet +
            "." +
            forthOctet,
          peerPort: port,
        };
        msgPeerTable.push(aPeer);
      }
    }

    if (msgType == 1) {
      isFull[client.remotePort] = false;
      console.log(
        "Connected to peer " +
          sender +
          ":" +
          client.remotePort +
          " at timestamp: " +
          singleton.getTimestamp()
      );

      // add the server (the receiver request) into the table
      let receiverPeer = {
        peerIP: client.remoteAddress,
        peerPort: client.remotePort,
      };
      peerTable.push(receiverPeer);

      // Now run as a server
      let serverPeer = net.createServer();
      serverPeer.listen(client.localPort, client.localAddress);
      console.log(
        "This peer address is " +
          client.localAddress +
          ":" +
          client.localPort +
          " located at " +
          location
      );
      serverPeer.on("connection", function (sock) {
        let peersCount = peerTable.length;
        if (peersCount >= maxPeers) {
          declineClient(sock, location, peerTable);
        } else {
          handleClient(sock, location, peerTable);
        }
      });

      console.log("Received ack from " + sender + ":" + client.remotePort);
      if (numberOfPeers > 0) {
        let output = "  which is peered with: ";
        for (var i = 0; i < numberOfPeers - 1; i++) {
          output +=
            "[" +
            msgPeerTable[i].peerIP +
            ":" +
            msgPeerTable[i].peerPort +
            "], ";
        }
        output +=
          "[" + msgPeerTable[i].peerIP + ":" + msgPeerTable[i].peerPort + "]";
        console.log(output);
      }
    } else {
      console.log("Received ack from " + sender + ":" + client.remotePort);
      isFull[client.remotePort] = true;

      declinePorts.push(client.remotePort);

      const filtered = msgPeerTable.filter(
        (item) => !declinePorts.includes(item.peerPort)
      );

      peersToJoin = filtered.concat(peersToJoin);

      maxPeers = maxPeers;
      peerLocation = location;

      if (numberOfPeers > 0) {
        let output = "  which is peered with: ";
        for (var i = 0; i < numberOfPeers - 1; i++) {
          output +=
            "[" +
            msgPeerTable[i].peerIP +
            ":" +
            msgPeerTable[i].peerPort +
            "], ";
        }
        output +=
          "[" + msgPeerTable[i].peerIP + ":" + msgPeerTable[i].peerPort + "]";
        console.log(output);
      }
      console.log(
        "\nThe join has been declined; the auto-join process is performing ...\n"
      );
    }
  });
  client.on("end", () => {
    if (isFull[client.remotePort]) {
      // connect to the known peer address
      let newClientPeer = new net.Socket();
      // We will consider the first peer in the list, this is only for this assignment.
      // We must consider the new requirements in assignment 3.
      let joining = peersToJoin.shift();

      newClientPeer.connect(joining.peerPort, joining.peerIP, function () {
        // initialize peer table
        let newPeerTable = []; // array of objects
        communicate(newClientPeer, maxPeers, peerLocation, newPeerTable);
      });
    }
  });
}

function handleClient(sock, sender, peerTable) {
  // send acknowledgment to the client
  cPTPpacket.init(7, 1, sender, peerTable);
  sock.write(cPTPpacket.getPacket());
  sock.end();

  // accept client request
  addClient(sock, peerTable);
}

function declineClient(sock, sender, peerTable) {
  let peerAddress = sock.remoteAddress + ":" + sock.remotePort;
  console.log("\nPeer table full: " + peerAddress + " redirected");

  // send acknowledgment to the client
  cPTPpacket.init(7, 2, sender, peerTable);
  sock.write(cPTPpacket.getPacket());
  sock.end();
}

function addClient(sock, peerTable) {
  let peersCount = peerTable.length;
  // peerTable format
  // [{
  //   peerIP: peer ip address,
  //   peerPort: peer port number
  // }]
  let joiningPeer = { peerIP: sock.remoteAddress, peerPort: sock.remotePort };
  peerTable.push(joiningPeer);

  let peerAddress = sock.remoteAddress + ":" + sock.remotePort;
  console.log("\nConnected from peer " + peerAddress);
}

function bytes2string(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    if (array[i] > 0) result += String.fromCharCode(array[i]);
  }
  return result;
}

// return integer value of a subset bits
function parseBitPacket(packet, offset, length) {
  let number = "";
  for (var i = 0; i < length; i++) {
    // let us get the actual byte position of the offset
    let bytePosition = Math.floor((offset + i) / 8);
    let bitPosition = 7 - ((offset + i) % 8);
    let bit = (packet[bytePosition] >> bitPosition) % 2;
    number = (number << 1) | bit;
  }
  return number;
}
