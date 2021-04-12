//size of the request packet:
let HEADER_SIZE = 4;

//Fields that compose the RTP header
let version, requestType, imageCount, imageFileName;

module.exports = {
  requestHeader: "", //Bitstream of the request packet
  payloadSize: 0, //size of the ITP payload
  payload: "", //Bitstream of the ITP payload

  init: function (ver, imagesList) {
    //fill by default packet fields:
    version = ver;
    requestType = 0;
    imageCount = imagesList.length;

    //build the header bistream:
    //--------------------------
    this.rquestHeader = new Buffer.alloc(HEADER_SIZE);

    //fill the header array of bytes
    // v
    storeBitPacket(this.rquestHeader, version*1, 0, 3);
    // IC
    storeBitPacket(this.rquestHeader, imageCount, 3, 5);
    // Request type
    storeBitPacket(this.rquestHeader, requestType, 24, 8);

    let imageType = [];
    let imageName = [];
    let imageExtension = {
      BMP: 1,
      JPEG: 2,
      GIF: 3,
      PNG: 4,
      TIFF: 5,
      RAW: 15,
    };
    for (var i = 0; i < imageCount; i++) {
      imageName[i] = stringToBytes(imagesList[i].split(".")[0]);
      imageType[i] = imageExtension[imagesList[i].split(".")[1].toUpperCase()];
      this.payloadSize += imageName[i].length;
    }

    this.payload = new Buffer.alloc(this.payloadSize + 2 * imageCount);
    let bitMarker = 0;
    for (var i = 0; i < imageCount; i++) {
      // IT
      storeBitPacket(this.payload, imageType[i], bitMarker, 4);
      bitMarker += 4;
      //image name length
      storeBitPacket(this.payload, imageName[i].length, bitMarker, 12);
      bitMarker += 12;
      // image file name
      var byteMarker = bitMarker / 8;
      k = 0;
      j = 0;
      for (j = byteMarker; j < imageName[i].length + byteMarker; j++) {
        this.payload[j] = imageName[i][k++];
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
    for (var Hi = 0; Hi < HEADER_SIZE; Hi++) packet[Hi] = this.rquestHeader[Hi];
    for (var Pi = 0; Pi < this.payload.length; Pi++)
      packet[Pi + HEADER_SIZE] = this.payload[Pi];

    return packet;
  },
};

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
