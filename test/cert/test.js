var fs = require('fs');
var crypto = require('crypto');
var constants = crypto.constants || require('constants');

function rsaDecrypt(text)
{
	var textBuffer= new Buffer(text);
	var decryptText= crypto.privateDecrypt(
		{
			key: fs.readFileSync(__dirname + '/rsa_private_key.pem'), // 如果通过文件方式读入就不必转成Buffer
			padding: constants.RSA_PKCS1_PADDING // 因为前端加密库使用的RSA_PKCS1_PADDING标准填充,所以这里也要使用RSA_PKCS1_PADDING
		}, textBuffer);

	return decryptText;
}

function rsaEncrypt(text)
{
	var textBuffer= new Buffer(text);
	var encryptText= crypto.publicEncrypt(
		{
			key: fs.readFileSync(__dirname + '/rsa_public_key.pem'), // 如果通过文件方式读入就不必转成Buffer
			padding: constants.RSA_PKCS1_PADDING // 因为前端加密库使用的RSA_PKCS1_PADDING标准填充,所以这里也要使用RSA_PKCS1_PADDING
		}, textBuffer);

	return encryptText;
}

var str = 'hello word';
var buf1 = rsaEncrypt(str);
console.log('str1', buf1.toString('base64'));

var buf2 = rsaDecrypt(buf1);
console.log('str2', buf2.toString());
