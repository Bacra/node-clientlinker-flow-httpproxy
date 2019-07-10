var fs = require('fs');
var crypto = require('crypto');
var constants = crypto.constants || require('constants');

function rsaEncrypt(text)
{
	var textBuffer= new Buffer(text);
	var encryptText= crypto.publicEncrypt(
		{
			key: fs.readFileSync(__dirname + '/rsa_public_key.pem'), // 如果通过文件方式读入就不必转成Buffer
			padding: constants.RSA_PKCS1_PADDING
		}, textBuffer);

	return encryptText;
}

function rsaDecrypt(text)
{
	var textBuffer= new Buffer(text);
	var decryptText= crypto.privateDecrypt(
		{
			key: fs.readFileSync(__dirname + '/rsa_private_key.pem'), // 如果通过文件方式读入就不必转成Buffer
			padding: constants.RSA_PKCS1_PADDING
		}, textBuffer);

	return decryptText;
}

function getSign(text)
{
	var sign = crypto.createSign('SHA256');
	sign.update(text);
	sign.end();

	return sign.sign(fs.readFileSync(__dirname + '/rsa_private_key.pem'));
}

function verifySign(text, signature)
{
	var verify = crypto.createVerify('SHA256');
	verify.update(text);
	verify.end();
	return verify.verify(fs.readFileSync(__dirname + '/rsa_public_key.pem'), signature);
}

var str = 'hello word';
var buf1 = rsaEncrypt(str);
console.log('str1', buf1.toString('base64'));

var buf2 = rsaDecrypt(buf1);
console.log('str2', buf2.toString());


var signature = getSign(str);
console.log('signature', signature.toString('base64'));

console.log(verifySign(str, signature));
