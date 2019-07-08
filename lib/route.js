'use strict';

var Promise		= require('bluebird');
var debug		= require('debug')('clientlinker-flow-httpproxy:route');
var rawBody		= Promise.promisify(require('raw-body'));
var signature	= require('./signature');
var json		= require('./json');

exports = module.exports = HttpProxyRoute;
exports.express = routeExpress;
exports.koa = routeKoa;

function HttpProxyRoute(linker)
{
	return function HttpProxyRouteHandle(req, res, next)
	{
		var startTime = new Date();
		res.set('XH-Httpproxy-RequestTime', +startTime);

		if (arguments.length >= 3)
			return routeExpress(linker, startTime, req, res, next);
		else
			return routeKoa(linker, startTime, req, res);
	};
}

function routeKoa(linker, startTime, ctx, next)
{
	if (!linker) return next();

	return httpAction(linker, startTime, ctx.req)
		.then(function(output)
		{
			var res = ctx.response;
			res.statusCode = output.statusCode || 200;
			var data = output.data;
			if (data && typeof data == 'object')
			{
				data = json.stringify(data);
				data.CONST_KEY = json.CONST_KEY;
			}

			res.type = 'json';
			res.body = data;
			res.set('XH-Httpproxy-ResponeTime', Date.now());
		});
}


function routeExpress(linker, startTime, req, res, next)
{
	if (!linker) return next();

	return httpAction(linker, startTime, req)
		.then(function(output)
		{
			res.statusCode = output.statusCode || 200;
			var data = output.data;
			data = json.stringify(data);
			data.CONST_KEY = json.CONST_KEY;

			res.set('XH-Httpproxy-ResponeTime', Date.now());
			res.json(data);
		});
}



function httpAction(linker, startTime, req)
{
	var deprecate_msg = [];
	var client_msg = [];

	var logmsg = 'route catch:' + formatLogTime(startTime);
	debug(logmsg);
	client_msg.push(logmsg);

	return rawBody(req)
		.then(function(buf)
		{
			var originalBody = buf.toString();

			originalBody = JSON.parse(originalBody);
			var action = originalBody.action;
			var body = json.parse(originalBody, originalBody.CONST_KEY);

			return runAction(linker, action, body, originalBody, req.headers, startTime)
				.catch(function(err)
				{
					debug('[%s] linker run err:%o', action, err);
					return {
						statusCode: 500,
						data:
						{
							env: body && body.env,
							result: err
						}
					};
				})
				.then(function(output)
				{
					var endTime = new Date;
					var logmsg = 'clientlinker run end:'
						+ formatLogTime(endTime)
						+ ' ' + (endTime - startTime) + 'ms';
					debug(logmsg);
					client_msg.push(logmsg);

					return output;
				});
		})
		.catch(function(err)
		{
			var endTime = new Date;
			var logmsg = 'clientlinker run err:'
				+ ' ' + formatLogTime(endTime)
				+ ' ' + (endTime - startTime) + 'ms'
				+ ' msg=' + ((err && err.message) || err);
			debug(logmsg);
			client_msg.push(logmsg);

			return {
				statusCode: 500,
				data:
				{
					result	: err
				}
			};
		})
		.then(function(output)
		{
			var data = output.data || (output.data = {});

			if (client_msg.length)
				data.httpproxy_msg = client_msg;
			if (deprecate_msg.length)
				data.httpproxy_deprecate = deprecate_msg;

			return output;
		});
}


function runAction(linker, action, body, originalBody, headers, startTime)
{
	return linker.parseAction(action)
		.then(function(methodInfo)
		{
			var options = methodInfo.client && methodInfo.client.options;
			var clentRequestTime = headers['xh-httpproxy-time'];

			if (checkHttpproxyReqRemain(clentRequestTime, startTime, options) === false
				|| checkHttpproxyKey(action, originalBody, options) ===  false)
			{
				return {statusCode: 403};
			}

			debug('[%s] catch proxy route', action);
			var args = [action, body.query, body.body, null, body.options];
			var retPromise = linker.runIn(args, 'httpproxy', body.env);
			var runtime = linker.lastRuntime;

			return retPromise.then(function(data)
				{
					// console.log('svr env for data', runtime.env);
					return {
						statusCode	: 200,
						data:
						{
							env		: runtime ? runtime.env : body.env,
							data	: data
						}
					};
				},
				function(err)
				{
					var output =
					{
						data:
						{
							env		: runtime ? runtime.env : body.env,
							result	: err
						}
					};

					// console.log('svr env for err', env);
					if (err && err.message && err.message.substr(0, 21) == 'CLIENTLINKER:NotFound')
					{
						debug('[%s] %s', action, err);
						output.statusCode = 501;
					}
					else
					{
						output.statusCode = 200;
					}

					return output;
				});
		});
}


function formatLogTime(date)
{
	return date.getHours()
		+':'+date.getMinutes()
		+':'+date.getSeconds()
		+'.'+date.getMilliseconds();
}

function checkHttpproxyReqRemain(clientRequestTime, serverStartTime, options)
{
	var httpproxyReqRemain = options && options.httpproxyReqRemain;

	if (httpproxyReqRemain === false) return;
	if (!httpproxyReqRemain) httpproxyReqRemain = 2000;

	var remain = serverStartTime - clientRequestTime;
	if (!remain || remain < 0 || remain > httpproxyReqRemain)
	{
		debug('client request time expired, remain:%sms', remain);
		return false;
	}
}

function checkHttpproxyKey(action, originalBody, options)
{
	if (!options) return;

	var httpproxyKey = options.httpproxyKey;
	var httpproxyKeyRemain = options.httpproxyKeyRemain || 5*60*1000;
	var ckey = originalBody.ckey;

	debug('httpproxyKey: %s, remain:%sms', httpproxyKey, httpproxyKeyRemain);

	if (!httpproxyKey) return;
	if (!ckey)
	{
		debug('[%s] no httpproxy signature key', action);
		return false;
	}

	if (httpproxyKey == ckey)
	{
		debug('[%s] pass:use body key', action);
		return;
	}

	var time = +originalBody.time;
	var random = +originalBody.random;
	if (!time || !random)
	{
		debug('[%s] key inval input, time: %s, random: %s', action, time, random);
		return false;
	}

	var remain = Date.now() - time;
	if (!remain || remain < 0 || remain > httpproxyKeyRemain)
	{
		debug('[%s] key expired, remain:%sms', action, remain);
		return false;
	}

	var key = signature.signature([action, time, random], httpproxyKey);
	if (key != ckey)
	{
		debug('[%s] inval signature', action);
		return false;
	}
}
