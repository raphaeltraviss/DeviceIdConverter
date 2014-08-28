(function() {
  // Initialize the deviceIdConverter object available globally.
  window.deviceIdConverter = {
    imeiPattern: new RegExp('^[0-9]{14,15}$'),
    meidHexPattern: new RegExp('^[a-fA-F0-9]{14,15}$'),
    meidDecPattern: new RegExp('^[0-9]{18}$'),
    esnHexPattern: new RegExp('^[a-fA-F0-9]{8}$'),
    esnDecPattern: new RegExp('^[0-9]{11}$'),

    // Initializes a conversion, but only if the input is valid.
    initialize: function(deviceId) {
      var conversion = {
        input: deviceId,
        inputType: null,
        inputFormat: null,
        results: {
          //@todo: how do we know what inputFormat the check is for?
          'check': null,
          'imei': null,
          'meidHex': null,
          'meidDec': null,
          'esnHex': null,
          'esnDec': null,
        }
      };

      if (this.imeiPattern.test(deviceId)) {
        conversion.inputType = 'imei';
        conversion.inputFormat = 'dec';
      }
      else if (this.meidHexPattern.test(deviceId)) {
        conversion.inputType = 'meid';
        conversion.inputFormat = 'hex';
      }
      else if (this.meidDecPattern.test(deviceId)) {
        var result = this.transformSerial(deviceId, 10, 16, 10, 8, 6);
        // An invalid decimal MEID can return an invalid hex MEID greater than 14 digits,
        // even though it passes the regex.  Right now, this is the only way I know of to test this.
        if (result.length < 15) {
          conversion.inputType = 'meid';
          conversion.inputFormat = 'dec';
        }
        else {
          conversion.inputType = 'invalid';
          conversion.inputFormat = 'invalid';
        }
      }
      else if (this.esnHexPattern.test(deviceId)) {
        conversion.inputType = 'esn';
        conversion.inputFormat = 'hex';
      }
      else if (this.esnDecPattern.test(deviceId)) {
        conversion.inputType = 'esn';
        conversion.inputFormat = 'dec';
      }
      else {
        conversion.inputType = 'invalid';
        conversion.inputFormat = 'invalid';
      }
      return conversion;
    },

    validate: function(deviceId) {
      // @todo: check if check digit actually matches the device ID.
      var conversion = this.initialize(deviceId);
      if (conversion.inputType !== 'invalid') {
        return true;
      }
      else {
        return false;
      }
    },

    convert: function(deviceId) {
      var conversion = this.initialize(deviceId);
      if (conversion.inputType !== 'invalid') {
        switch (conversion.inputType) {
          case 'imei':
            conversion.results.imei = deviceId.substr(0,14);
            conversion.results.check = deviceId.substr(14);
            // Accept the check digit the user entered, if present.
            if (!(conversion.results.check)) {
              conversion.results.check = this.calculateCheck(deviceId);
            }
          break;
        case 'meid':
          switch (conversion.inputFormat) {
            case 'hex':
              var meidHex = deviceId.substr(0,14);
              conversion.results.meidHex = meidHex;
              conversion.results.meidDec = this.transformSerial(meidHex, 16, 10, 8, 10, 8);
              var pseudoEsn = this.calculatePseudoEsn(meidHex);
              conversion.results.esnHex = pseudoEsn;
              conversion.results.esnDec = this.transformSerial(pseudoEsn, 16, 10, 2, 3, 8);
              break;
            case 'dec':
              conversion.results.meidDec = deviceId;
              var meidHex = this.transformSerial(deviceId, 10, 16, 10, 8, 6);
              if (this.imeiPattern.test(meidHex)) {
                // The input is an IMEI using the "decimal" MEID display format.
                conversion.results.imei = meidHex;
                conversion.results.check = this.calculateCheck(meidHex);
              }
              else {
                conversion.results.meidHex = meidHex;
                var pseudoEsn = this.calculatePseudoEsn(meidHex);
                conversion.results.esnHex = pseudoEsn;
                conversion.results.esnDec = this.transformSerial(pseudoEsn, 16, 10, 2, 3, 8);
              }
              break;
          }
          break;
        case 'esn':
          switch (conversion.inputFormat) {
            case 'hex':
              conversion.results.esnHex = deviceId;
              conversion.results.esnDec = this.transformSerial(deviceId, 16, 10, 2, 3, 8);
              break;
            case 'dec':
              conversion.results.esnDec = deviceId;
              conversion.results.esnHex = this.transformSerial(deviceId, 10, 16, 3, 2, 6);
              break;
          }
          break;
        }
        return conversion;
      }
      else {
        return false;
      }
    },

    getResult: function(deviceId) {
      var conversion = this.convert(deviceId);
      switch (conversion.inputType) {
        case 'imei':
          return conversion.results.imei+conversion.results.check+" / "+conversion.results.meidDec;
          break;
        case 'meid':
          return conversion.results.meidHex+" / "+conversion.results.meidDec;
          break;
        case 'esn':
          return conversion.results.esnHex+" / "+conversion.results.esnDec;
          break;
      }
    },

    /**
     * calculateCheck
     *
     * Javascript code copyright 2009 by Fiach Reid : www.webtropy.com
     * This code may be used freely, as long as this copyright notice is intact.
     *
     * @return - The calculated check digit INT
     */
    calculateCheck: function(Luhn) {
      var sum = 0;
      for (i=0; i<Luhn.length; i++ ) {
        sum += parseInt(Luhn.substring(i, i+1));
      }
      var delta = new Array (0, 1, 2, 3, 4, -4, -3, -2, -1, 0);
      for (i = Luhn.length - 1; i >= 0; i -= 2 ) {
        var deltaIndex = parseInt(Luhn.substring(i, i+1));
        var deltaValue = delta[deltaIndex];
        sum += deltaValue;
      }
      var mod10 = sum % 10;
      mod10 = 10 - mod10;
      if (mod10 == 10) mod10 = 0;
      return mod10;
    },

    /**
     * calculatePseudoEsn
     *
     * @param deviceID - The MEID to convert to a pseudo ESN.
     */
    calculatePseudoEsn: function(deviceId) {
      var result = '';
      var sha = new jsSHA(deviceId, "HEX");
      result = sha.getHash("SHA-1", "HEX");
      result = "80"+result.substr(result.length - 6);
      return result;
    },

    /**
     * transformSerial
     *
     * @param (string) deviceId - The input number
     * @param (int) srcBase - The Source Base Size
     * @param (int) destBase - The Destination Base Size
     * @param (int) part1Length - The length of the First Part
     * @param (int) part1PadLength - The total length, after padding, for the First Part
     * @param (int) part2PadLength - The total length, after padding, for the Second Part
     *
     * @return string - The transformed serial number
     */
    transformSerial: function(deviceId, srcBase, destBase, part1Length, part1PadLength, part2PadLength) {
      var part1 = deviceId.substr(0, part1Length);
      var part2 = deviceId.substr(part1Length);

      if (destBase == 16) {
        part1 = parseInt(part1, 10).toString(16);
        part2 = parseInt(part2, 10).toString(16);
      }
      else if (destBase == 10) {
        part1 = parseInt(part1, 16);
        part2 = parseInt(part2, 16);
      }

      part1 = this.leftPad(part1, part1PadLength);
      part2 = this.leftPad(part2, part2PadLength);

      var result = part1 + part2 +"";
      result = result.toUpperCase();

      return result;
    },

    /**
     * leftPad
     *
     * @param number - The input number.
     * @param lenth - The total number of digits to stop padding at.
     */
    leftPad: function(number, length) {
      var string = number+"";
      while (string.length < length) string = "0" + string;
      return string;
    }
  };
})();
