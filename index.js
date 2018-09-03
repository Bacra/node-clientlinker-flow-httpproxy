'use strict';

var httpproxy = require('./flow/httpproxy');

exports = module.exports = function(flow)
{
	flow.register(httpproxy);
};

exports.route = require('./lib/route');
