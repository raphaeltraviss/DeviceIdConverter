(function() {
  // Initialize the deviceIdConverter object available globally.
  window.deviceIdConverter = {
    iccidPattern: new RegExp('^[0-9]{19,20}$'),
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
          // note that decimal IMEI are handled internally as hex MEID.
          'iccidDec': null,
          'iccidDecCheck': null,
          'meidHex': null,
          'meidHexCheck': null,
          'meidDec': null,
          'esnHex': null,
          'esnDec': null,
        }
      };

      if (this.iccidPattern.test(deviceId)) {
        conversion.inputType = 'iccid';
        conversion.inputFormat = 'dec';
      }
      else if (this.imeiPattern.test(deviceId)) {
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
          case 'iccid':
            var iccidDec = deviceId.substr(0,19);
            conversion.results.iccidDec = iccidDec;
            // Re-calculate the check digit, even if one was entered.
            conversion.results.iccidDecCheck = this.calculateCheck(iccidDec);
            break;

          case 'imei':
            var meidHex = deviceId.substr(0,14);
            conversion.results.meidHex = meidHex;
            // Re-calculate the check digit, even if one was entered.
            conversion.results.meidHexCheck = this.calculateCheck(deviceId);
            conversion.results.meidDec = this.transformSerial(meidHex, 16, 10, 8, 10, 8);
            var pseudoEsn = this.calculatePseudoEsn(meidHex);
            conversion.results.esnHex = pseudoEsn;
            conversion.results.esnDec = this.transformSerial(pseudoEsn, 16, 10, 2, 3, 8);
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
                conversion.results.meidHex = meidHex;
                if (this.imeiPattern.test(meidHex)) {
                  // The input is an IMEI using the "decimal" display format.
                  conversion.results.meidHexCheck = this.calculateCheck(meidHex);
                }
                else {
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
        case 'iccid':
          return conversion.results.iccidDec+conversion.results.iccidDecCheck;
          break;
        case 'imei':
          return conversion.results.meidHex+conversion.results.meidHexCheck+" / "+conversion.results.meidDec;
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
     * @param number - a decimal number to calculate the check digit for.
     *
     * @return - The calculated check digit INT
     */
    calculateCheck: function(number) {
      // Note that this only calculates base-10 check digits.
      var sum = 0;
      for (i = 0; i < number.length; i++ ) {
        sum += parseInt(number.substring(i, i+1));
      }
      var delta = new Array (0, 1, 2, 3, 4, -4, -3, -2, -1, 0);
      for (i = number.length - 1; i >= 0; i -= 2 ) {
        var deltaIndex = parseInt(number.substring(i, i+1));
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
