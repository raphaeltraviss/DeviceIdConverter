<?php
/**
 * @class DeviceIdConverter
 *
 * Validates a given string against several cellular device ID formats,
 * and converts it to every other possible format.
 */

class DeviceIdConverter {

  /* REGEXP EXPRESSIONS FOR INPUT VALIDATION */
  const VALIDATE_ICCID         = '/^[0-9]{19,20}$/';
  const VALIDATE_IMEI         = '/^[0-9]{14,15}$/';
  const VALIDATE_MEID_HEX     = '/^[a-fA-F0-9]{14,15}$/';
  const VALIDATE_MEID_DEC     = '/^[0-9]{18}$/';
  const VALIDATE_ESN_HEX      = '/^[a-fA-F0-9]{8}$/';
  const VALIDATE_ESN_DEC      = '/^[0-9]{11}$/';

  /* @param string $input - The stored user input */
  protected $input;

  /* @param string - The determined user input type constant value. */
  protected $inputType;

  /* @param string - The display format (hex or dec) of the input type. */
  protected $displayFormat;

  /* @param array - The converted results of the input ID in every format. */
  protected $results;

  /**
   * @function __construct
   * Returns a new Instance of this class
   *
   * @param $input string - Optional input value to start with, or you can set it later
   * @return DeviceIdConverter
   */
  public function __construct($input=NULL){
    if (isset($input)) {
      $this->convert($input);
    }
    return $this;
  }

  /**
   * @function clearInput
   * Clears out all input values to start fresh!
   */
  protected function clearInput(){
    $this->inputType = NULL;
    $this->displayFormat = NULL;
    $this->results = array();
  }

  /**
   * @function validateInput
   * Sets the input. It is then validated.
   *
   * @param string $input - The input to calculate
   * @return DeviceIdConverter
   */
  public function validateInput($input){
    // Clear out the prior results if the object is being re-used.
    $this->clearInput();
    $this->input = $input;
    // Validate the input and declare type, format, and attributes.
    if (preg_match(self::VALIDATE_ICCID, $input)) {
      // Remove check digit, if preset.
      // Assumes 19-digit IMEI with a check digit.
      $input = substr($input, 0, 19);

      $this->inputType = 'iccid';
      $this->displayFormat = 'dec';
      $this->results['iccid_dec'] = $input;
    }
    elseif (preg_match(self::VALIDATE_IMEI, $input)) {
      // Remove check digit, if preset.
      $input = substr($input, 0, 14);

      $this->inputType = 'imei';
      $this->displayFormat = 'hex';
      // Internally, IMEI are treated as MEID.
      $this->results['meid_hex'] = $input;
    }
    elseif (preg_match(self::VALIDATE_MEID_HEX, $input)) {
      // Remove check digit, if preset.
      $input = substr($input, 0, 14);

      $this->inputType = 'meid';
      $this->displayFormat = 'hex';
      $this->results['meid_hex'] = $input;
    }
    elseif (preg_match(self::VALIDATE_MEID_DEC, $input)) {
      $hex_id = $this->transformSerial($input, 10, 16, 10, 8, 6);

      // Check for mathematically invalid decimal number given.
      if (strlen($hex_id) == 14) {
        // Check for a IMEI in decimal display format.
        if (preg_match(self::VALIDATE_IMEI, $hex_id)) {
          $this->inputType = 'imei';
          $this->displayFormat = 'dec';
          // Internally, IMEI are treated as MEID.
          $this->results['meid_dec'] = $input;
        }
        else {
          $this->inputType = 'meid';
          $this->displayFormat = 'dec';
          $this->results['meid_dec'] = $input;
        }
      }
      else {
        return FALSE;
      }
    }
    elseif (preg_match(self::VALIDATE_ESN_HEX, $input)) {
      $this->inputType = 'esn';
      $this->displayFormat = 'hex';
      $this->results['esn_hex'] = $input;
    }
    elseif (preg_match(self::VALIDATE_ESN_DEC, $input)) {
      $this->inputType = 'esn';
      $this->displayFormat = 'dec';
      $this->results['esn_dec'] = $input;
    }
    else {
      $this->inputType = FALSE;
      $this->displayFormat = FALSE;
      return FALSE;
    }
    return $this;
  }

  /**
   * Gets the current input value; used from outside this object.
   *
   * @return The stored user input
   */
  public function getInput() {
    return $this->input;
  }

  /**
   * Gets the current input type; used from outside this object.
   *
   * @return The stored user input
   */
  public function getInputType() {
    return $this->inputType.'_'.$this->displayFormat;
  }

  /**
   * Gets the current results; used from outside this object.
   *
   * @return An array of results, keyed by type_format.
   */
  public function getResults() {
    return $this->results;
  }

  /**
   * Converts the specified input
   *
   * @return array - An array of key value conversion values
   */
  public function convert($input = NULL) {
    // Only validate if it hasn't already been done.
    if ($this->input != $input) {
      $this->validateInput($input);
    }

    if ($this->inputType) {
      if ($this->inputType == 'iccid') {
        $this->results['iccid_dec_check'] = $this->calculateCheckLuhn($this->results['iccid_dec'], 10);
      }
      elseif (($this->inputType == 'imei') || ($this->inputType == 'meid')) {
        if ($this->displayFormat == 'hex') {
          $this->results['meid_dec'] = $this->transformSerial($this->results['meid_hex'], 16, 10, 8, 10, 8);
        }
        else if ($this->displayFormat == 'dec') {
          $this->results['meid_hex'] = $this->transformSerial($this->results['meid_dec'], 10, 16, 10, 8, 6);
        }
        $this->results['meid_hex_check'] = $this->calculateCheckLuhn($this->results['meid_hex'], 16);
        $this->results['meid_dec_check'] = $this->calculateCheckLuhn($this->results['meid_dec'], 10);
        $this->results['esn_hex'] = $this->calculatePesn($this->results['meid_hex']);
        $this->results['esn_dec'] =$this->transformSerial($this->results['esn_hex'], 16, 10, 2, 3, 8);
      }
      elseif ($this->inputType == 'esn') {
        if ($this->displayFormat == 'hex') {
          $this->results['esn_dec'] = $this->transformSerial($this->results['esn_hex'], 16, 10, 2, 3, 8);
        }
        else if ($this->displayFormat == 'dec') {
          $this->results['esn_hex'] = $this->transformSerial($this->results['esn_dec'], 10, 16, 3, 2, 6);
        }
      }
      return $this;
    }
    else {
      return FALSE;
    }
  }

  /**
   * calculatePesn
   *
   * @return - The calculated pESN
   */
  protected function calculatePesn($input){
    $p = '';
    for ($i = 0; $i < strlen($input); $i += 2){
      $p .= chr(intval(substr($input, $i, 2), 16));
    }
    $hash = sha1($p);

    return strtoupper("80".substr($hash,(strlen($hash) -6)));
  }

  /**
   * @var string $input
   *  The device ID you wish to calculate the Luhn check digit for.  Make sure
   *  you feed it the input ID with the check removed, if one was already entered.
   *
   * @return - The calculated check digit INT
   */
  protected function calculateCheckLuhn($input, $base) {
    $checkstring = '';
    $digits = str_split((string) $input);
    $digits[] = 0;
    $digits = array_reverse($digits);

    $digit_sum = function($checkstring) {
      return substr((string) 10 - (array_sum(str_split($checkstring)) % 10), -1, 1);
    };

    switch ($base) {
      case 10:
        foreach ($digits as $i => $d) {
          $checkstring .= $i %2 !== 0 ? $d * 2 : $d;
        }
        return $digit_sum($checkstring);
        break;

      case 16:
        foreach ($digits as $i => $d) {
          // Convert to dec so PHP can do math.
          $d = hexdec($d);
          $checkstring .= $i %2 !== 0 ? $d * 2 : $d;
        }
        return dechex($digit_sum($checkstring));
        break;

    }
  }

  /**
   * transformSerial
   *
   * @param string $n - The input
   * @param int $srcBase - The Source Base Size
   * @param int $dstBase - The Destination Base Size
   * @param int $p1Width - The Width of the First Part
   * @param int $p1Padding - The Padding for the First Part
   * @param int $p2Padding - The Padding for the Second Part
   *
   * @return string - The transformed serial number
   */
  protected function transformSerial($n, $srcBase, $dstBase, $p1Width, $p1Padding, $p2Padding)
  {
    return strtoupper(
      $this->lPad(base_convert(substr($n,0,$p1Width),$srcBase,$dstBase),$p1Padding,0).
      $this->lPad(base_convert(substr($n,$p1Width),$srcBase,$dstBase),$p2Padding,0)
    );
  }

  /**
   * lPad
   *
   * @param $s string - The input
   * @param $len int - Length
   * @param $p int - Padding
   */
  protected function lPad($s, $len, $p)
  {
    if($len <= strlen($s)){
      return $s;
    }
    return $this->lPad($p.$s, $len, $p);
  }
}
