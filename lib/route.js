'use strict';

var Promise		= require('bluebird');
var _			= require('lodash');
var debug		= require('debug')('clientlinker-flow-httpproxy:route');
var rawBody		= Promise.promisify(require('raw-body'));
var signature	= require('../lib/signature');
var json		= require('./json');
var LRUCache	= require('lru-cache');

exports = module.exports = HttpProxyRoute;
exports.express = routeExpress;
exports.koa = routeKoa;

function HttpProxyRoute(linker)
{
	return function HttpProxyRouteHandle(req, res, next)
	{
		var serverRouterTime = new Date();
		res.set('XH-Httpproxy-RequestTime', +serverRouterTime);

		if (arguments.length >= 3)
			return routeExpress(linker, serverRouterTime, req, res, next);
		else
			return routeKoa(linker, serverRouterTime, req, res);
	};
}

function routeKoa(linker, serverRouterTime, ctx, next)
{
	if (!linker) return next();

	return httpAction(linker, serverRouterTime, ctx.req)
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
			res.set('XH-Httpproxy-ResponseTime', Date.now());
		});
}


function routeExpress(linker, serverRouterTime, req, res, next)
{
	if (!linker) return next();

	return httpAction(linker, serverRouterTime, req)
		.then(function(output)
		{
			res.statusCode = output.statusCode || 200;
			var data = output.data;
			data = json.stringify(data);
			data.CONST_KEY = json.CONST_KEY;

			res.set('XH-Httpproxy-ResponseTime', Date.now());
			res.json(data);
		});
}



function httpAction(linker, serverRouterTime, req)
{
	var deprecate_msg = [];
	var client_msg = [];

	var logmsg = 'route catch:' + formatLogTime(serverRouterTime);
	debug(logmsg);
	client_msg.push(logmsg);

	return rawBody(req)
		.then(function(buf)
		{
			var originalRaw = buf.toString();
			var originalBody = JSON.parse(originalRaw);
			var action = originalBody.action;
			var body = json.parse(originalBody.data, originalBody.CONST_KEY);

			return runAction(linker, action, serverRouterTime, body, req.headers, originalRaw, originalBody)
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
						+ ' ' + (endTime - serverRouterTime) + 'ms';
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
				+ ' ' + (endTime - serverRouterTime) + 'ms'
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



function runAction(linker, action, serverRouterTime, body, headers, originalRaw)
{
	return linker.parseAction(action)
		.then(function(methodInfo)
		{
			var options = methodInfo.client && methodInfo.client.options;
			var clientRequestTime = headers['xh-httpproxy-contenttime'];
			var requestKey = headers['xh-httpproxy-key'];

			if (checkHttpproxyTime(linker, action, serverRouterTime, clientRequestTime, requestKey, options) === false
				|| checkHttpproxyKey(action, clientRequestTime, requestKey, originalRaw, headers, options) ===  false)
			{
				return {statusCode: 403};
			}

			debug('[%s] catch proxy route', action);
			var args = [action, body.query, body.body, null, body.options];
			var env = _.extend({}, body.env, { httpproxyHeaders: headers });
			var retPromise = linker.runIn(args, 'httpproxy', env);
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

function checkHttpproxyTime(linker, action, serverRouterTime, clientRequestTime, requestKey, options)
{
	if (!clientRequestTime)
	{
		debug('[%s] no clientRequestTime:%s', action, clientRequestTime);
		return false;
	}

	var remain = Math.abs(serverRouterTime - clientRequestTime);
	var httpproxyKeyRemain = options && options.httpproxyKeyRemain || 5 * 1000;

	if (!remain || remain > httpproxyKeyRemain)
	{
		debug('[%s] key expired, remain:%sms', action, remain);
		return false;
	}

	// 用内存cache稍微档一下重放的请求。避免扫描导致的大量错误
	var cacheList = linker._httpproxy_cachelist || (linker._httpproxy_cachelist = {});
	var cache = cacheList[httpproxyKeyRemain] || (cacheList[httpproxyKeyRemain] = new LRUCache(
		{
			maxAge: httpproxyKeyRemain * 2,
			max: 100 * 1000,
		}));

	if (requestKey)
	{
		var key = action + ':' + requestKey;
		if (cache.peek(key))
		{
			debug('[%s] siginkey has require: %s', action, requestKey);
			return false;
		}
		else
		{
			cache.set(key, true);
		}
	}
}

function checkHttpproxyKey(action, clientRequestTime, requestKey, originalRaw, headers, options)
{
	options || (options = {});
	var httpproxyKey = options.httpproxyKey;

	debug('[%s] httpproxyKey: %s', action, httpproxyKey);

	if (!httpproxyKey) return;
	if (!requestKey)
	{
		debug('[%s] no httpproxy aes key', action);
		return false;
	}

	// if (httpproxyKey == key)
	// {
	// 	debug('[%s] pass:use original key', action);
	// 	return;
	// }

	var hashContent = signature.get_sha_content(originalRaw);
	var targetKey = signature.sha_content(hashContent, clientRequestTime, httpproxyKey);
	if (targetKey != requestKey)
	{
		debug('[%s] not match, time:%s cntMd5:%s %s retKey:%s %s',
			action, clientRequestTime,
			signature.md5(hashContent), headers['xh-httpproxy-debugmd5'],
			targetKey, requestKey);
		return false;
	}
}
