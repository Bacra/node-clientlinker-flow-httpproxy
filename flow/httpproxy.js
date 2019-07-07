'use strict';

var Promise		= require('bluebird');
var _			= require('lodash');
var debug		= require('debug')('clientlinker:httpproxy');
var deprecate	= require('depd')('clientlinker:httpproxy');
var request		= require('request');
var aes			= require('../lib/aes_cipher');
var json		= require('../lib/json');

exports = module.exports = httpproxy;

function httpproxy(runtime, callback)
{
	var body = getRequestBody(runtime);
	if (!body) return callback.next();

	return getRequestParams(runtime, body)
		.then(function(params)
		{
			return new Promise(function(resolve, reject)
			{
				request.post(params, function(err, respone, body)
				{
					if (err)
						reject(err);
					else
						resolve({ respone: respone, body: body });
				});
			});
		})
		.then(function(result) {
			try {
				var data = JSON.parse(result.body);
				data = json.parse(data, data.CONST_KEY);
			}
			catch(err)
			{
				debug('request parse json err:%o', err);
				runtime.debug && runtime.debug('httpproxyResponeError', err);
				return callback.next();
			}

			if (data && data.env)
			{
				_.extend(runtime.env, data.env, {source: runtime.env.source});
			}

			// 预留接口，在客户端显示server端日志
			if (data.httpproxy_msg
				&& Array.isArray(data.httpproxy_msg))
			{
				data.httpproxy_msg.forEach(function(msg)
				{
					debug('[route respone] %s', msg);
				});
			}

			// 预留接口，在客户端现实server端兼容日志
			if (data.httpproxy_deprecate
				&& Array.isArray(data.httpproxy_deprecate))
			{
				data.httpproxy_deprecate.forEach(function(msg)
				{
					deprecate('[route respone] '+msg);
				});
			}

			var respone = result.respone;
			if (respone && respone.statusCode != 200)
			{
				var err = new Error('httpproxy,respone!200,'+respone.statusCode);
				debug('request err:%o', err);
				if (respone.statusCode == 501)
				{
					runtime.debug && runtime.debug('httpproxyResponeError', err);
					return callback.next();
				}

				throw err;
			}

			if (data.result)
				throw data.result;
			else
				return data.data;
		});
}

exports.getRequestBody_ = getRequestBody;
function getRequestBody(runtime)
{
	var client = runtime.client;
	var options = client.options;

	if (!options.httpproxy) return false;

	var httpproxyMaxLevel = options.httpproxyMaxLevel;
	var httpproxyNextLevel = runtime.env.httpproxyLevel || 0;
	httpproxyNextLevel++;
	if ((!httpproxyMaxLevel && httpproxyMaxLevel !== 0)
		|| httpproxyMaxLevel < 0)
	{
		httpproxyMaxLevel = 1;
	}

	if (httpproxyNextLevel > httpproxyMaxLevel)
	{
		debug('[%s] not request httpproxy, level overflow:%d >= %d',
			runtime.action, httpproxyNextLevel, httpproxyMaxLevel);
		return false;
	}

	runtime.env.httpproxyLevel = httpproxyNextLevel;


	var body = {
		query	: runtime.query,
		body	: runtime.body,
		options	: runtime.options,
		env		: runtime.env
	};

	// check aes key
	if (options.httpproxyKey)
		body.key = aes.cipher(runtime.action+','+Date.now(), options.httpproxyKey);

	return body;
}

exports.getRequestParams_ = getRequestParams;
function getRequestParams(runtime, body)
{
	var client = runtime.client;
	var options = client.options;

	var headers = options.httpproxyHeaders || {};
	headers['Content-Type'] = 'application/json';

	var runOptions	= runtime.options || {};
	var timeout		= runOptions.timeout || options.httpproxyTimeout || 10000;
	var proxy		= runOptions.httpproxyProxy
			|| options.httpproxyProxy
			|| process.env.clientlinker_http_proxy
			|| process.env.http_proxy;

	body = json.stringify(body);
	body.CONST_KEY = json.CONST_KEY;
	body.action = runtime.action;

	var bodystr = JSON.stringify(body, null, '\t');

	return Promise.resolve(
	{
		url		: options.httpproxy,
		body	: bodystr,
		headers	: headers,
		timeout	: timeout,
		proxy	: proxy
	});
}
