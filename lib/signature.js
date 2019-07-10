'use strict';

var crypto	= require('crypto');

exports.sha_content = sha_content;
function sha_content(content, time, key)
{
	var hash = crypto.createHash('sha256');
	hash.update(time + ',' + key);
	var newkey = hash.digest('hex');

	return crypto.createHmac('sha256', newkey)
		.update(content)
		.digest('hex');
}
