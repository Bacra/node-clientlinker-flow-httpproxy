'use strict';

var crypto	= require('crypto');

exports.signature = signature;
function signature(action, time, key)
{
	return crypto.createHmac('sha256', key)
		.update(action + ',' + time)
		.digest('hex');
}
