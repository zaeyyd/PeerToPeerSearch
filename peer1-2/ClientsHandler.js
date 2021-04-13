var ITPpacket = require("./ITPResponse"),
cPTPsearch = require("./cPTPsearch"),
  singleton = require("./Singleton");
const fs = require("fs");

var path = require("path");
var currFile = path.dirname(__filename).split("/");
let folder = currFile.slice(-1)[0];
folder = folder.split("-");

let peerID = folder[0];

var nickNames = {},
  clientIP = {},
  startTimestamp = {};

module.exports = {
  handleClientJoining: function (sock, HOST, PORT) {
    assignClientName(sock, nickNames);
    const chunks = [];
    console.log(
      "\n" +
        nickNames[sock.id] +
        " is connected at timestamp: " +
        startTimestamp[sock.id]
    );
    sock.on("data", function (requestPacket) {
      handleClientRequests(requestPacket, sock, HOST, PORT); //read client requests and respond
    });
    sock.on("close", function () {
      handleClientLeaving(sock);
    });
  },
};

function handleClientRequests(data, sock, HOST, PORT) {
  console.log("\nITP packet received:");
  printPacketBit(data);

  let version = parseBitPacket(data, 0, 3);
  let imageCount = parseBitPacket(data, 3, 5);
  let requestType = parseBitPacket(data, 24, 8);
  let requestName = {
    0: "Query",
    1: "Found",
    2: "Not found",
    3: "Busy",
  };
  let imageExtension = {
    1: "BMP",
    2: "JPEG",
    3: "GIF",
    4: "PNG",
    5: "TIFF",
    15: "RAW",
  };
  let imageType = [];
  let imageTypeName = [];
  let imageName = [];
  let imageSize = [];


  let marker = 32; // start of the first image info
  for (var i = 0; i < imageCount; i++) {
    imageType[i] = parseBitPacket(data, marker, 4);
    marker += 4;
    imageTypeName[i] = imageExtension[imageType[i]];
    imageSize[i] = parseBitPacket(data, marker, 12);
    marker += 12;
    var imageNameBytePosition = marker / 8;
    imageName[i] = bytes2string(
      data.slice(imageNameBytePosition, imageNameBytePosition + imageSize[i])
    );
    marker += imageSize[i] * 8; // position of the next image info
  }

  console.log(
    "\n" +
      nickNames[sock.id] +
      " requests:" +
      "\n    --ITP version: " +
      version +
      "\n    --Image Count: " +
      imageCount +
      "\n    --Request type: " +
      requestName[requestType] +
      "\n    --Image file extension(s): " +
      imageTypeName +
      "\n    --Image file name(s): " +
      imageName +
      "\n"
  );
  if (version == 7) {
    let full = true
    let imagesData = [];
    let imagesDataSize = 0;

    let notHere = []
    for (var i = 0; i < imageCount; i++) {

      try {

        let imageFullName = "images/" + imageName[i] + "." + imageTypeName[i];
        //console.log(imageFullName)
        imagesData[i] = fs.readFileSync(imageFullName);
        imagesDataSize += imagesData[i].length + imageName[i].length;
      } catch (error) {
        //console.log(error, 'this is the error')
        full = false
        notHere.push(i)
        //console.log(i, 'up')
      }
     
    }

    if(full){
      ITPpacket.init(
        version,
        1, // response type
        singleton.getSequenceNumber(), // sequence number
        singleton.getTimestamp(), // timestamp
        imageType, // array of image types
        imageName, // array of image names
        imagesData, // array of images data
        imagesDataSize, //total size of all images
        1 // full or partial load (we assume the best-case scenacio in this assigment)
      );
    }
    else{

      //console.log(imageType, imageName, imagesData)

      for(let i of notHere){
        //console.log(i, 'down')
        imageType.splice(i,1)
        imageName.splice(i,1)
        imagesData.splice(i,1)
      }

      //console.log(imageType, imageName, imagesData)

      ITPpacket.init(
        version,
        2, // response type
        singleton.getSequenceNumber(), // sequence number
        singleton.getTimestamp(), // timestamp
        imageType, // array of image types
        imageName, // array of image names
        imagesData, // array of images data
        imagesDataSize, //total size of all images
        0 // full or partial load (we assume the best-case scenacio in this assigment)
      );

      cPTPsearch.init(
        version,
        2,
        notHere.length,
        singleton.getSequenceNumber(),
        peerID.length,
        peerID,
        HOST,
        PORT
      )

      console.log("SEARCH PACKET", cPTPsearch.getBytePacket())
    }

    


    sock.write(ITPpacket.getBytePacket());
    sock.end();
  } else {
    console.log("The protocol version is not supported");
    sock.end();
  }
}

function handleClientLeaving(sock) {
  console.log(nickNames[sock.id] + " closed the connection");
}

function assignClientName(sock, nickNames) {
  sock.id = sock.remoteAddress + ":" + sock.remotePort;
  startTimestamp[sock.id] = singleton.getTimestamp();
  var name = "Client-" + startTimestamp[sock.id];
  nickNames[sock.id] = name;
  clientIP[sock.id] = sock.remoteAddress;
}

function bytes2string(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    result += String.fromCharCode(array[i]);
  }
  return result;
}

function bytes2number(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    result ^= array[array.length - i - 1] << (8 * i);
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
