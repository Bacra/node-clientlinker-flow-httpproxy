'use strict';

var crypto	= require('crypto');

exports.signature = signature;
function signature(str, key)
{
	return crypto.createHmac('sha256', key)
		.update('' + str)
		.digest('hex');
}
