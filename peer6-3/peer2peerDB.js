let net = require("net"),
  singleton = require("./Singleton"),
  handler = require("./PeersHandler");

singleton.init();

let HOST = "127.0.0.1";
let PORT = singleton.getPort(); //get random port number


// getting peer ID and max peer table size
var path = require("path");
var currFile = path.dirname(__filename).split("/");
let folder = currFile.slice(-1)[0];
folder = folder.split("-");

let peerID = folder[0];
let tableSize = folder[1];




if (process.argv.length > 2) {

    let hostserverIPandPort = process.argv[3].split(":");
  
    let knownHOST = hostserverIPandPort[0];
    let knownPORT = hostserverIPandPort[1];
  
    // connect to the known peer address
    let clientPeer = new net.Socket();

    clientPeer.connect(knownPORT, knownHOST, function () {
        let peerTable = [];
  
        handler.handleCommunications(clientPeer, tableSize, peerID, peerTable);
    });
  } else {
    // call as node peer (no arguments)
    // run as a server
    let serverPeer = net.createServer();
    serverPeer.listen(PORT, HOST);
    console.log(
      "This peer address is " + HOST + ":" + PORT + " located at " + currFile.slice(-1)[0]
    );
  
    // initialize peer table
    let peerTable = [];
    serverPeer.on("connection", function (sock) {
      // received connection request
      handler.handleClientJoining(sock, tableSize, peerID, peerTable);
    });
  }