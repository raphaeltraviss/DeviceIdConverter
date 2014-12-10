<?php

include('DeviceIdConverter.php');
$converter = new DeviceIdConverter();
$is_valid = $converter->convert('99000264755157');
if ($is_valid) {
  print_r($converter);
}
else {
  echo "Invalid ID!\n";
}


$x = 'testing';
