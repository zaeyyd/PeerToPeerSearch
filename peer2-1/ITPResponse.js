//size of the response packet header:
var HEADER_SIZE = 8;

//Fields that compose the header
var version, responseType, sequenceNumber, timeStamp, imageCount, imageFileName;

module.exports = {
  responseHeader: "", //Bitstream of the ITP header
  payloadSize: 0, //size of the ITP payload
  payload: "", //Bitstream of the ITP payload

  init: function (
    ver, // ITP version
    resType, // response type
    sequenceNum, // sequence number
    currentTime, // timestamp
    imageType, // array of image types
    imageName, // array of image names
    imagesData, // array of images data
    imagesDataSize, //total size of all images
    fullLoad // full or partial load
  ) {
    //fill by default packet fields:
    version = ver;
    imageCount = imagesData.length;

    //build the header bistream:
    //--------------------------
    this.responseHeader = new Buffer.alloc(HEADER_SIZE);

    //fill out the header array of byte with ITP header fields
    // V
    storeBitPacket(this.responseHeader, version, 0, 3);
    // F
    storeBitPacket(this.responseHeader, fullLoad, 3, 1);

    // Response type
    storeBitPacket(this.responseHeader, resType, 4, 8);

    // IC
    storeBitPacket(this.responseHeader, imageCount, 12, 5);

    // sequenceNumber
    storeBitPacket(this.responseHeader, sequenceNum, 17, 15);

    // timeStamp
    storeBitPacket(this.responseHeader, currentTime, 32, 32);

    //fill the payload bitstream:
    //--------------------------
    this.payload = new Buffer.alloc(imagesDataSize + 4 * imageCount);
    let bitMarker = 0; // Bit position of the first image info
    for (var i = 0; i < imageCount; i++) {
      // IT
      storeBitPacket(this.payload, imageType[i], bitMarker, 4);
      bitMarker += 4;
      // Image name size in byte
      storeBitPacket(this.payload, imageName[i].length, bitMarker, 12);
      bitMarker += 12;
      // Image size in byte
      storeBitPacket(this.payload, imagesData[i].length, bitMarker, 16);
      bitMarker += 16;
      // Image name
      var byteMarker = bitMarker / 8;
      k = 0;
      j = 0;
      for (j = byteMarker; j < imageName[i].length + byteMarker; j++) {
        this.payload[j] = stringToBytes(imageName[i][k++]);
      }
      bitMarker = j * 8; // current bit position
      // Image data
      byteMarker = bitMarker / 8;
      k = 0;
      j = 0;
       
      for (j = byteMarker; j < imagesData[i].length + byteMarker; j++) {
        this.payload[j] = imagesData[i][k++];
      }
      bitMarker = j * 8; // current bit position
    }
  },

  //--------------------------
  //getBytePacket: returns the entire packet in bytes
  //--------------------------
  getBytePacket: function () {
    let packet = new Buffer.alloc(this.payload.length + HEADER_SIZE);
    //construct the packet = header + payload
    for (var Hi = 0; Hi < HEADER_SIZE; Hi++)
      packet[Hi] = this.responseHeader[Hi];
    for (var Pi = 0; Pi < this.payload.length; Pi++)
      packet[Pi + HEADER_SIZE] = this.payload[Pi];

    return packet;
  },
};

// Store integer value into the packet bit stream
function storeBitPacket(packet, value, offset, length) {
  // let us get the actual byte position of the offset
  let lastBitPosition = offset + length - 1;
  let number = value.toString(2);
  let j = number.length - 1;
  for (var i = 0; i < number.length; i++) {
    let bytePosition = Math.floor(lastBitPosition / 8);
    let bitPosition = 7 - (lastBitPosition % 8);
    if (number.charAt(j--) == "0") {
      packet[bytePosition] &= ~(1 << bitPosition);
    } else {
      packet[bytePosition] |= 1 << bitPosition;
    }
    lastBitPosition--;
  }
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

function stringToBytes(str) {
  var ch,
    st,
    re = [];
  for (var i = 0; i < str.length; i++) {
    ch = str.charCodeAt(i); // get char
    st = []; // set up "stack"
    do {
      st.push(ch & 0xff); // push byte to stack
      ch = ch >> 8; // shift value down by 1 byte
    } while (ch);
    // add stack contents to result
    // done because chars have "wrong" endianness
    re = re.concat(st.reverse());
  }
  // return an array of bytes
  return re;
}

// Not used in this assignment
function setPacketBit(packet, position, value) {
  // let us get the actual byte position and the bit poistion
  // within this byte
  let bytePosition = Math.floor(position / 8);
  let bitPosition = 7 - (position % 8);
  if (value == 0) {
    packet[bytePosition] &= ~(1 << bitPosition);
  } else {
    packet[bytePosition] |= 1 << bitPosition;
  }
}