'use strict';

var httpproxy = require('./httpproxy');
var methods = require('./methods');

module.exports = function(flow)
{
	flow.register(httpproxy);
	flow.register('methods', methods);
};
