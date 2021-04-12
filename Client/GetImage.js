let net = require("net");
let fs = require("fs");
let open = require("open");
let ITPpacket = require("./ITPRequest");

// call as GetImage -s <serverIP>:<port> -q <images list> -v <version>

let sFlag = process.argv[2];
let hostserverIPandPort = process.argv[3].split(":");

let qFlag = process.argv[4];
let imagesList = [];
let imageCounter = 0;
let index = 5;
while (process.argv[index] != "-v") {
  imagesList[imageCounter++] = process.argv[index++];
}

let vFlag = process.argv[index];
let ITPVersion = process.argv[index + 1];

let PORT = hostserverIPandPort[1];
let HOST = hostserverIPandPort[0];
 
ITPpacket.init(ITPVersion, imagesList);

let client = new net.Socket();
client.connect(PORT, HOST, function () {
  console.log("Connected to ImageDB server on: " + HOST + ":" + PORT);
  client.write(ITPpacket.getBytePacket());
});

// Add a 'data' event handler for the client socket
// data is what the server sent to this socket
let imageExtension = {
  1: "BMP",
  2: "JPEG",
  3: "GIF",
  4: "PNG",
  5: "TIFF",
  15: "RAW",
};
let responseName = {
  0: "Query",
  1: "Found",
  2: "Not found",
  3: "Busy",
};
const chunks = [];
client.on("data", (chunk) => {
  chunks.push(chunk);
});
client.on("pause", () => {
  console.log("pause");
});
client.on("end", () => {
  const responsePacket = Buffer.concat(chunks);
  let header = responsePacket.slice(0, 8);
  let payload = responsePacket.slice(8);

  console.log("\nITP packet header received:");
  printPacketBit(header);

  let imageCount = parseBitPacket(header, 12, 5);

  // save images
  let imageName = [];
  let bitMarker = 0;
  for (var i = 0; i < imageCount; i++) {
    let imageType = parseBitPacket(payload, bitMarker, 4);
    bitMarker += 4;
    let imageNameSize = parseBitPacket(payload, bitMarker, 12);
    bitMarker += 12;
    let imageDataSize = parseBitPacket(payload, bitMarker, 16);
    bitMarker += 16;

    var byteMarker = bitMarker / 8;
    let receivedImageName = bytes2string(payload.slice(byteMarker, imageNameSize + byteMarker));
    bitMarker += imageNameSize * 8; // current bit position

    byteMarker = bitMarker / 8;
    let imageDate = payload.slice(byteMarker, imageDataSize + byteMarker);
    bitMarker += imageDataSize * 8; // current bit position
    
    imageName[i] = receivedImageName + "." + imageExtension[imageType];
    fs.writeFileSync(imageName[i], imageDate);
  }

  // open images
  (async () => {
    // Opens the image in the default image viewer and waits for the opened app to finish.
    for (var i = 0; i < imageCount; i++) {
      await open(imageName[i], { wait: true });
    }
  })();

  console.log("\nServer sent:");
  console.log("    --ITP version = " + parseBitPacket(header, 0, 3));
  console.log(
    "    --Fulfilled = " + (parseBitPacket(header, 3, 1) ? "Yes" : "No")
  );

  console.log(
    "    --Response Type = " + responseName[parseBitPacket(header, 4, 8)]
  );
  console.log("    --Image Count = " + imageCount);
  console.log("    --Sequence Number = " + parseBitPacket(header, 17, 15));
  console.log("    --Timestamp = " + parseBitPacket(header, 32, 32));
  console.log();
  ////////////////////////////////////////
  client.end();
});

// Add a 'close' event handler for the client socket
client.on("close", function () {
  console.log("Connection closed");
});

client.on("end", () => {
  console.log("Disconnected from the server");
});

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

// Prints the entire packet in bits format
function printPacketBit(packet) {
  var bitString = "";

  for (var i = 0; i < packet.length; i++) {
    // To add leading zeros
    var b = "00000000" + packet[i].toString(2);
    // To print 4 bytes per line
    if (i > 0 && i % 4 == 0) bitString += "\n";
    bitString += " " + b.substr(b.length - 8);
  }
  console.log(bitString);
}
function bytes2string(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    result += String.fromCharCode(array[i]);
  }
  return result;
}

