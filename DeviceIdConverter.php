<?php
/**
 *
 */

class DeviceIdConverter {

  /* REGEXP EXPRESSIONS FOR INPUT VALIDATION */
  const VALIDATE_IMEI_CHECK   = '/^[0-9]{15}$/';
  const VALIDATE_IMEI         = '/^[0-9]{14}$/';
  const VALIDATE_MEID_HEX     = '/^[a-fA-F0-9]{14}$/';
  const VALIDATE_MEID_DEC     = '/^[0-9]{18}$/';
  // @TODO:, validate MEIDs supplied with a check digit.
  const VALIDATE_ESN_HEX      = '/^[a-fA-F0-9]{8}$/';
  const VALIDATE_ESN_DEC      = '/^[0-9]{11}$/';

  /* @param string $input - The stored user input */
  protected $input = NULL;

  /* @param string $input - The determined user input type constant value */
  protected $inputType = NULL;

  /* @param string - The inputFormat (hex or dec) of the input type */
  protected $inputFormat = NULL;

  /* @param boolean - Indicates if the input MEID is an IMEI
  *  Note than an IMEI will use hex_meid, even though it is decimal.
  */
  protected $isImei = FALSE;

  /**
   * @function __construct
   * Returns a new Instance of this class
   *
   * @param $input string - Optional input value to start with, or you can set it later
   * @return DeviceIdConverter
   */
  public function __construct($input=NULL){
    $this->results = array();

    if(!is_NULL($input)){
      $this->setInput($input);
    }

    return $this;
  }

  /**
   * @function setInput
   * Sets the input. It is then validated.
   *
   * @param string $input - The input to calculate
   * @throws Exception - When not validated
   * @return DeviceIdConverter
   */
  public function setInput($input){
    // Reset the conversion values when the input changes.
    if($input != $this->getInput()){
      $this->results = array();
    }

    // Validate the input and declare type, format, and attributes.
    if(preg_match(self::VALIDATE_IMEI_CHECK, $input)){
      $this->inputType = 'meid';
      $this->inputFormat = 'hex';
      $this->isImei = TRUE;
      // Discard the check digit; it is trivial to calculate and could be incorrect.
      $input = substr($input,0,-1);
    } else if(preg_match(self::VALIDATE_IMEI, $input)){
      $this->inputType = 'meid';
      $this->inputFormat = 'hex';
      $this->isImei = TRUE;
    } else if(preg_match(self::VALIDATE_MEID_DEC, $input)){
      $this->inputType = 'meid';
      $this->inputFormat = 'dec';
    } else if(preg_match(self::VALIDATE_MEID_HEX, $input)){
      $this->inputType = 'meid';
      $this->inputFormat = 'hex';
    } else if(preg_match(self::VALIDATE_ESN_DEC, $input)){
      $this->inputType = 'esn';
      $this->inputFormat = 'dec';
    } else if(preg_match(self::VALIDATE_ESN_HEX, $input)){
      $this->inputType = 'esn';
      $this->inputFormat = 'hex';
    } else {
      throw new Exception('Could Not Validate Your Input');
      return $this;
    }

    $this->input = $input;

    // Set the value that was already supplied in the input.
    $this->results[$this->inputType.'_'.$this->inputFormat] = $input;

    return $this;
  }

  /**
   * getInput
   *
   * @return The stored user input
   *
   */
  public function getInput(){
    return $this->input;
  }

  /**
   * Converts the specified input
   *
   * @return array - An array of key value conversion values
   */
  public function convert($input = NULL){
    if(is_NULL($input)) {
      $input = $this->getInput();
    }
    if($input != $this->getInput()) {
      $this->setInput($input);
    }

    // Do calculation based on the input we were given.
    switch (key($this->results)) {
      case 'meid_hex':
        $this->results['meid_dec'] =
        $this->transformSerial($this->results['meid_hex'], 16, 10, 8, 10, 8);

        /* Technically, this should be based of the first two digits.
         * All decimal = base10 Luhn, Hex = base 16 Luhn
         * See https://www.cdg.org/devices/meid/MEID-EUIMID-FAQv4.0.pdf
        */
        $this->results['meid_hex_check'] =
        ($this->isImei) ?
        $this->calculateCheckLuhn($this->results['meid_hex'], 10) :
        $this->calculateCheckLuhn($this->results['meid_hex'], 16);

        $this->results['meid_dec_check'] = $this->calculateCheckLuhn($this->results['meid_dec'], 10);
        $this->results['esn_hex'] = $this->calculatePesn($this->results['meid_hex']);

        $this->results['esn_dec'] =
        $this->transformSerial($this->results['esn_hex'], 16, 10, 2, 3, 8);

        break;
      case 'meid_dec':
        $this->results['meid_hex'] =
        $this->transformSerial($this->results['meid_dec'], 10, 16, 10, 8, 6);

        $this->results['esn_hex'] = FALSE;
        $this->results['esn_dec'] = FALSE;
        $this->results['meid_dec_check'] = FALSE;
        $this->results['meid_hex_check'] = FALSE;
        break;
      case 'esn_hex':
        $this->results['esn_dec'] = $this->transformSerial($this->results['esn_hex'], 16, 10, 2, 3, 8);
        break;
      case 'esn_dec':
        $this->results['esn_hex'] = $this->transformSerial($this->results['esn_dec'], 10, 16, 3, 2, 6);
        break;
    }
    return $this->results;
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
   * calculateCheck
   *
   * @return - The calculated check digit INT
   */
  protected function calculateCheckLuhn($input, $base) {
    $checkstring = '';
    $digits = str_split((string) $input);
    $digits[14] = 0;
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
