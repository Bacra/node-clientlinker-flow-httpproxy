'use strict';

var crypto	= require('crypto');

exports.sha_content = sha_content;
function sha_content(content, time, key)
{
	var newkey = sha256(time + ',' + key);

	return crypto.createHmac('sha256', newkey)
		.update(content)
		.digest('hex');
}

exports.get_sha_content = get_sha_content;
function get_sha_content(content)
{
	return [
		sha256(content),
		md5(content),
		content.slice(1, 20),
	]
	.join(',');
}

exports.sha256 = sha256;
function sha256(str)
{
	var hash = crypto.createHash('sha256');
	hash.update(str);
	return hash.digest('hex');
}

exports.md5 = md5;
function md5(str)
{
	var hash = crypto.createHash('md5');
	hash.update(str);
	return hash.digest('hex');
}
