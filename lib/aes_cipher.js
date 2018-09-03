'use strict';

var crypto	= require('crypto');


exports.cipher = cipher;
function cipher(str, key)
{
  var cipher = crypto.createCipher('aes-256-cbc', key);
  str += ','+Date.now()+','+Math.floor(Math.random()*1000);
  var out = cipher.update(str, 'utf8', 'base64');
  out += cipher.final('base64');

  return out;
}

exports.decipher = decipher;
function decipher(str, key)
{
    var decipher = crypto.createDecipher('aes-256-cbc', key);
    var str2 = decipher.update(str, 'base64', 'utf8');
    str2 += decipher.final('utf8');
    return str2.split(',').slice(0, -2).join(',');
}
