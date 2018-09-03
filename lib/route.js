'use strict';

var Promise	= require('bluebird');
var debug	= require('debug')('clientlinker:httpproxy:route');
var rawBody	= Promise.promisify(require('raw-body'));
var aes		= require('./aes_cipher');
var json	= require('./json');

exports = module.exports = HttpProxyRoute;
exports.express = routeExpress;
exports.koa = routeKoa;

function HttpProxyRoute(linker)
{
	return function HttpProxyRouteHandle(req, res, next)
	{
		if (arguments.length >= 3)
			return routeExpress(linker, req, res, next);
		else
			return routeKoa(linker, req, res);
	};
}

function routeKoa(linker, ctx, next)
{
	var action = ctx.query.action;
	if (!action || !linker) return next();

	return httpAction(action, ctx)
		.then(function(output)
		{
			var res = ctx.respone;
			res.statusCode = output.statusCode || 200;
			var data = output.data;
			if (data && typeof data == 'object')
			{
				data = json.stringify(data);
				data.CONST_KEY = json.CONST_KEY;
			}

			res.type = 'json';
			res.body = data;
		});
}


function routeExpress(linker, req, res, next)
{
	var action = req.query.action;
	if (!action || !linker) return next();

	return httpAction(linker, action, req)
		.then(function(output)
		{
			res.statusCode = output.statusCode || 200;
			var data = output.data;
			data = json.stringify(data);
			data.CONST_KEY = json.CONST_KEY;

			res.json(data);
		});
}



function httpAction(linker, action, req)
{
	var deprecate_msg = [];
	var client_msg = [];
	var startTime = new Date;

	var logmsg = 'route catch:' + formatLogTime(startTime);
	debug(logmsg);
	client_msg.push(logmsg);

	return rawBody(req)
		.then(function(buf)
		{
			var body = buf.toString();

			body = JSON.parse(body);
			body = json.parse(body, body.CONST_KEY);

			return runAction(linker, action, body)
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
				+ ' action='+action
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



function runAction(linker, action, body)
{
	return linker.parseAction(action)
		.then(function(methodInfo)
		{
			var options = methodInfo.client && methodInfo.client.options;

			if (checkHttpproxyKey(action, body, options) ===  false)
				return {statusCode: 403};

			debug('[%s] catch proxy route', action);
			var args = [action, body.query, body.body, null, body.options];
			var retPromise = linker.runIn(args, 'httpproxy', body.env);

			return retPromise.then(function(data)
				{
					var runtime = retPromise.runtime;
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
					var runtime = retPromise.runtime;
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


exports.checkHttpproxyKey = checkHttpproxyKey;
function checkHttpproxyKey(action, body, options)
{
	options || (options = {});
	var httpproxyKey = options.httpproxyKey;
	var httpproxyKeyRemain = options.httpproxyKeyRemain || 15*60*1000;

	debug('httpproxyKey: %s, remain:%sms', httpproxyKey, httpproxyKeyRemain);

	if (!httpproxyKey) return;
	if (!body.key)
	{
		debug('[%s] no httpproxy aes key', action);
		return false;
	}

	if (httpproxyKey == body.key)
	{
		debug('[%s] pass:use body key', action);
		return;
	}

	var realAction, remain;
	try {
		realAction = aes.decipher(body.key, httpproxyKey).split(',');
	}
	catch(err)
	{
		debug('[%s] can not decipher key:%s, err:%o', action, body.key, err);
		return false;
	}

	remain = Date.now() - realAction.pop();
	realAction = realAction.join(',');

	if (remain > httpproxyKeyRemain)
	{
		debug('[%s] key expired, remain:%sms', action, remain);
		return false;
	}

	if (realAction != action)
	{
		debug('[%s] inval aes key, aes:%s', action, realAction);
		return false;
	}
}
