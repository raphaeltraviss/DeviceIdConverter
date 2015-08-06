(function (global) {
  var deviceIDConverter = function(deviceID) {

    /**
     * leftPad
     *
     * @param number - The input number.
     * @param lenth - The total number of digits to stop padding at.
     */
    function leftPad(number, length) {
      var string = number+"";
      while (string.length < length) string = "0" + string;
      return string;
    }

    /**
     * transformSerial
     *
     * @param (string) deviceID - The input number
     * @param (int) srcBase - The Source Base Size
     * @param (int) destBase - The Destination Base Size
     * @param (int) part1Length - The length of the First Part
     * @param (int) part1PadLength - The total length, after padding, for the First Part
     * @param (int) part2PadLength - The total length, after padding, for the Second Part
     *
     * @return string - The transformed serial number
     */
    function transformSerial(serial, srcBase, destBase, part1Length, part1PadLength, part2PadLength) {
      // why is serial an object, and not a string???
      var part1 = serial.toString().substr(0, part1Length);
      var part2 = serial.toString().substr(part1Length);

      if (destBase == 16) {
        part1 = parseInt(part1, 10).toString(16);
        part2 = parseInt(part2, 10).toString(16);
      }
      else if (destBase == 10) {
        part1 = parseInt(part1, 16);
        part2 = parseInt(part2, 16);
      }

      part1 = leftPad(part1, part1PadLength);
      part2 = leftPad(part2, part2PadLength);

      var result = part1 + part2 +"";
      result = result.toUpperCase();

      return result;
    }

    /**
     * calculateCheck
     *
     * @param number - a decimal number to calculate the check digit for.
     *
     * @return - The calculated check digit INT
     */
    function calculateCheck(number) {
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
    }

    /**
     * calculatePseudoEsn
     *
     * @param deviceID - The MEID to convert to a pseudo ESN.
     */
    function calculatePseudoEsn(baseMEID) {
      var sha = new jsSHA("SHA-1", "HEX");
      sha.update(baseMEID.substr(0,14));
      var result = sha.getHash("HEX");
      result = "80"+result.substr(result.length - 6);
      return result;
    }

    var iccidPattern = new RegExp('^[0-9]{19,20}$');
    var imeiPattern = new RegExp('^[0-9]{14,15}$');
    var meidHexPattern = new RegExp('^[a-fA-F0-9]{14,15}$');
    var meidDecPattern = new RegExp('^[0-9]{18}$');
    var esnHexPattern = new RegExp('^[a-fA-F0-9]{8}$');
    var esnDecPattern = new RegExp('^[0-9]{11}$');

    var conversion = {
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
    }


    if (iccidPattern.test(deviceID)) {
      conversion.inputType = 'iccid';
      conversion.inputFormat = 'dec';
    }
    else if (imeiPattern.test(deviceID)) {
      conversion.inputType = 'imei';
      conversion.inputFormat = 'dec';
    }
    else if (meidHexPattern.test(deviceID)) {
      conversion.inputType = 'meid';
      conversion.inputFormat = 'hex';
    }
    else if (meidDecPattern.test(deviceID)) {
      var result = transformSerial(deviceID, 10, 16, 10, 8, 6);
      // An invalid decimal MEID can return an invalid hex MEID greater than 14 digits,
      // even though it passes the regex.  Right now, this is the only way I know of to test
      if (result.length < 15) {
        conversion.inputType = 'meid';
        conversion.inputFormat = 'dec';
      }
      else {
        conversion.inputType = 'invalid';
        conversion.inputFormat = 'invalid';
      }
    }
    else if (esnHexPattern.test(deviceID)) {
      conversion.inputType = 'esn';
      conversion.inputFormat = 'hex';
    }
    else if (esnDecPattern.test(deviceID)) {
      conversion.inputType = 'esn';
      conversion.inputFormat = 'dec';
    }
    else {
      conversion.inputType = 'invalid';
      conversion.inputFormat = 'invalid';
    }

    if (conversion.inputType !== 'invalid') {
      switch (conversion.inputType) {
        case 'iccid':
          var iccidDec = deviceID.substr(0,19);
          conversion.results.iccidDec = iccidDec;
          // Re-calculate the check digit, even if one was entered.
          conversion.results.iccidDecCheck = calculateCheck(iccidDec);
          break;

        case 'imei':
          var meidHex = deviceID.substr(0,14);
          conversion.results.meidHex = meidHex;
          // Re-calculate the check digit, even if one was entered.
          conversion.results.meidHexCheck = calculateCheck(deviceID);
          conversion.results.meidDec = transformSerial(meidHex, 16, 10, 8, 10, 8);
          var pseudoEsn = calculatePseudoEsn(meidHex);
          conversion.results.esnHex = pseudoEsn;
          conversion.results.esnDec = transformSerial(pseudoEsn, 16, 10, 2, 3, 8);
          break;

        case 'meid':
          switch (conversion.inputFormat) {
            case 'hex':
              var meidHex = deviceID.substr(0,14);
              conversion.results.meidHex = meidHex;
              conversion.results.meidDec = transformSerial(meidHex, 16, 10, 8, 10, 8);
              var pseudoEsn = calculatePseudoEsn(meidHex);
              conversion.results.esnHex = pseudoEsn;
              conversion.results.esnDec = transformSerial(pseudoEsn, 16, 10, 2, 3, 8);
              break;

            case 'dec':
              conversion.results.meidDec = deviceID;
              var meidHex = transformSerial(deviceID, 10, 16, 10, 8, 6);
              conversion.results.meidHex = meidHex;
              if (imeiPattern.test(meidHex)) {
                // The input is an IMEI using the "decimal" display format.
                conversion.results.meidHexCheck = calculateCheck(meidHex);
              }
              else {
                var pseudoEsn = calculatePseudoEsn(meidHex);
                conversion.results.esnHex = pseudoEsn;
                conversion.results.esnDec = transformSerial(pseudoEsn, 16, 10, 2, 3, 8);
              }
              break;

          }
          break;

        case 'esn':
          switch (conversion.inputFormat) {
            case 'hex':
              conversion.results.esnHex = deviceID;
              conversion.results.esnDec = transformSerial(deviceID, 16, 10, 2, 3, 8);
              break;
            case 'dec':
              conversion.results.esnDec = deviceID;
              conversion.results.esnHex = transformSerial(deviceID, 10, 16, 3, 2, 6);
              break;
          }
          break;
      }

      switch (conversion.inputType) {
        case 'iccid':
          conversion.formatted = conversion.results.iccidDec+conversion.results.iccidDecCheck;
          break;
        case 'imei':
          conversion.formatted = conversion.results.meidHex+conversion.results.meidHexCheck+" / "+conversion.results.meidDec;
          break;
        case 'meid':
          conversion.formatted = conversion.results.meidHex+" / "+conversion.results.meidDec;
          break;
        case 'esn':
          conversion.formatted = conversion.results.esnHex+" / "+conversion.results.esnDec;
          break;
        case 'invalid':
          conversion.formatted = false;
          break;
      }

      return conversion;
    } else {
      return false;
    }

  }




  if (("function" === typeof define) && (define["amd"])) /* AMD Support */
  {
    define(function()
    {
      return deviceIDConverter;
    });
  } else if ("undefined" !== typeof exports) /* Node Support */
  {
    if (("undefined" !== typeof module) && module["exports"])
    {
      module["exports"] = exports = deviceIDConverter;
    }
    else {
      exports = deviceIDConverter;
    }
  } else { /* Browsers and Web Workers*/
    global["deviceIDConverter"] = deviceIDConverter;
  }

}(this));
