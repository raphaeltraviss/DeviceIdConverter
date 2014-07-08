DeviceIdConverter
=================

Converts between various cellular serial number formats and calculates check digits.

Usage
------

Supports hexadecimal and decimal representations of various formats:

```
$results = new DeviceIdConverter('a1000012345678');

$dec_meid = $results['meid_dec'];
$dec_esn = $results['esn_dec'];
$hex_esn = $results['esn_hex'];
```

Check digit calculation is also supported:

```
$results = new DeviceIdConverter('99000012345678')
$hex_meid = $results['meid_hex'] . $results['meid_hex_check'];
```

Note that internally, all-decimal IMEIs are treated similar to hexadecimal MEIDs, since the MEID format is a superset of the IMEI format.
